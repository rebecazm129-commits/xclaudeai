"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.XClaudServer = void 0;
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const constants_js_1 = require("./constants.js");
const logger_js_1 = require("./audit/logger.js");
const engine_js_1 = require("./policy/engine.js");
const token_counter_js_1 = require("./utils/token-counter.js");
const shadow_registry_js_1 = require("./proxy/shadow-registry.js");
const tool_proxy_js_1 = require("./proxy/tool-proxy.js");
const sg_check_policy_js_1 = require("./tools/sg_check_policy.js");
const sg_detect_pii_js_1 = require("./tools/sg_detect_pii.js");
const sg_budget_and_log_js_1 = require("./tools/sg_budget_and_log.js");
// ─── Config from environment ─────────────────────────────────────────────────
function resolveConfig() {
    const home = os_1.default.homedir();
    return {
        apiKey: process.env.SG_API_KEY ?? "",
        mode: (process.env.SG_MODE ?? "stdio"),
        serverUrl: process.env.SG_SERVER_URL ?? "",
        logPath: process.env.SG_LOG_PATH ?? path_1.default.join(home, ".xclaud", "audit.jsonl"),
        policyPath: process.env.SG_POLICY_PATH ?? path_1.default.join(home, ".xclaud", "policy.json"),
        registryPath: process.env.SG_REGISTRY_PATH ?? path_1.default.join(home, ".xclaud", "shadow_registry.json"),
        agentId: process.env.SG_AGENT_ID ?? "default",
    };
}
// ─── Native tool definitions ─────────────────────────────────────────────────
const NATIVE_TOOLS = [
    sg_check_policy_js_1.sg_check_policy_schema,
    sg_detect_pii_js_1.sg_detect_pii_schema,
    sg_budget_and_log_js_1.sg_get_budget_status_schema,
    sg_budget_and_log_js_1.sg_log_event_schema,
];
// ─── Prompt injection patterns ────────────────────────────────────────────────
const INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /ignore\s+your\s+(system\s+)?prompt/i,
    /disregard\s+(all\s+)?previous/i,
    /forget\s+(all\s+)?previous\s+instructions/i,
    /you\s+are\s+now\s+in\s+(developer|jailbreak|dan)\s+mode/i,
    /\bDAN\b/,
    /override\s+(your\s+)?instructions/i,
];
// ─── Main server class ────────────────────────────────────────────────────────
class XClaudServer {
    server;
    logger;
    policy;
    counter;
    registry;
    proxy;
    proxied = [];
    cfg = resolveConfig();
    constructor() {
        this.logger = new logger_js_1.AuditLogger(this.cfg.logPath);
        this.policy = new engine_js_1.PolicyEngine(this.cfg.policyPath);
        this.counter = new token_counter_js_1.TokenCounter(path_1.default.dirname(this.cfg.logPath));
        this.registry = new shadow_registry_js_1.ShadowRegistryManager(this.cfg.registryPath);
        this.proxy = new tool_proxy_js_1.ToolProxy(this.logger);
        this.server = new index_js_1.Server({ name: constants_js_1.SERVER_NAME, version: constants_js_1.PACKAGE_VERSION }, {
            capabilities: { tools: {} },
            // System prompt injection — prepended to user system prompt by Claude Desktop
            instructions: constants_js_1.GOVERNANCE_SYSTEM_PROMPT,
        });
        this.registerHandlers();
    }
    // ─── Handler registration ─────────────────────────────────────────────────
    registerHandlers() {
        // LIST TOOLS — native + all proxied
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
            const tools = [
                ...NATIVE_TOOLS.map(t => ({
                    name: t.name,
                    description: t.description,
                    inputSchema: t.inputSchema,
                })),
                ...this.proxied.map(p => ({
                    name: p.name,
                    description: p.description,
                    inputSchema: p.inputSchema,
                })),
            ];
            return { tools };
        });
        // CALL TOOL — route to native handler or proxy
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                const result = await this.dispatchTool(name, args ?? {});
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.log({
                    event_type: "error",
                    severity: "medium",
                    tool: name,
                    description: `Tool dispatch error: ${msg}`,
                });
                return {
                    content: [{ type: "text", text: JSON.stringify({ error: msg }) }],
                    isError: true,
                };
            }
        });
    }
    async dispatchTool(name, args) {
        // ── Native tools ──
        switch (name) {
            case "sg_check_policy":
                return (0, sg_check_policy_js_1.handle_sg_check_policy)(args, this.policy, this.logger);
            case "sg_detect_pii":
                return (0, sg_detect_pii_js_1.handle_sg_detect_pii)(args, this.logger);
            case "sg_get_budget_status":
                return (0, sg_budget_and_log_js_1.handle_sg_get_budget_status)(args, this.counter);
            case "sg_log_event":
                return (0, sg_budget_and_log_js_1.handle_sg_log_event)(args, this.logger);
        }
        // ── Proxied tools ──
        if (this.proxy.hasProxyTool(name)) {
            const result = await this.proxy.callTool(name, args);
            // Scan args + result for threats
            const contentToScan = JSON.stringify({ args, result }).slice(0, 10000);
            // 1. Check for prompt injection
            const hasInjection = INJECTION_PATTERNS.some(p => p.test(contentToScan));
            if (hasInjection) {
                this.logger.log({
                    event_type: "prompt_injection",
                    severity: "critical",
                    tool: name,
                    description: `Prompt injection detected in tool: ${name}`,
                    decision: "allow",
                });
            }
            // 2. Check for data export to external URLs
            const urlPattern = /https?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[^\s]+/gi;
            const hasExternalUrl = urlPattern.test(JSON.stringify(args));
            if (hasExternalUrl) {
                this.logger.log({
                    event_type: "data_export_warning",
                    severity: "medium",
                    tool: name,
                    description: `Content being sent to external URL via tool: ${name}`,
                    decision: "allow",
                });
            }
            // 3. Check for email send operations
            const emailPattern = /\b(send|mailto|email|smtp|to:|from:|subject:)\b/i;
            const argsStr = JSON.stringify(args).toLowerCase();
            const hasEmailIntent = emailPattern.test(argsStr) && (argsStr.includes('@') || argsStr.includes('mail'));
            if (hasEmailIntent) {
                this.logger.log({
                    event_type: "email_send_warning",
                    severity: "medium",
                    tool: name,
                    description: `Claude about to send an email via tool: ${name}`,
                    decision: "allow",
                });
            }
            // 4. Scan for PII and credentials — handle_sg_detect_pii logs automatically if found
            const scanResult = (0, sg_detect_pii_js_1.handle_sg_detect_pii)({ content: contentToScan, scan_types: ["all"], context: `tool:${name}` }, this.logger);
            // 5. Only log tool_call_allowed if nothing was found
            if (scanResult.clean && !hasInjection && !hasExternalUrl && !hasEmailIntent) {
                this.logger.log({
                    event_type: "tool_call_allowed",
                    severity: "low",
                    tool: name,
                    description: `Proxied tool call executed: ${name}`,
                    decision: "allow",
                });
            }
            return result;
        }
        throw new Error(`Unknown tool: ${name}`);
    }
    // ─── Lifecycle ────────────────────────────────────────────────────────────
    async start() {
        // Connect shadow servers
        const servers = this.registry.getServers();
        if (servers.length > 0) {
            this.proxied = await this.proxy.connectAll(servers);
        }
        this.logger.log({
            event_type: "server_start",
            severity: "low",
            description: `xCLAUDE MCP server started. Mode: ${this.cfg.mode}. Proxied tools: ${this.proxied.length}.`,
            meta: {
                version: constants_js_1.PACKAGE_VERSION,
                mode: this.cfg.mode,
                proxied_tools: this.proxied.length,
                native_tools: NATIVE_TOOLS.length,
            },
        });
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
    }
    async stop() {
        this.proxy.shutdown();
        this.logger.log({ event_type: "server_stop", severity: "low", description: "xCLAUDE MCP server stopped." });
        this.logger.close();
        await this.server.close();
    }
}
exports.XClaudServer = XClaudServer;
//# sourceMappingURL=server.js.map