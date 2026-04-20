"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolProxy = void 0;
const child_process_1 = require("child_process");
const shadow_registry_js_1 = require("./shadow-registry.js");
const constants_js_1 = require("../constants.js");
// ─── One live connection to a shadow MCP child process ───────────────────────
class ShadowConnection {
    proc;
    pending = new Map();
    msgId = 1;
    buf = "";
    ready = false;
    constructor(server) {
        this.proc = (0, child_process_1.spawn)(server.command, server.args ?? [], {
            stdio: ["pipe", "pipe", "inherit"],
            env: { ...process.env, ...(server.env ?? {}) },
        });
        this.proc.stdout?.on("data", (chunk) => {
            this.buf += chunk.toString();
            let nl;
            while ((nl = this.buf.indexOf("\n")) !== -1) {
                const line = this.buf.slice(0, nl).trim();
                this.buf = this.buf.slice(nl + 1);
                if (line)
                    this.handleLine(line);
            }
        });
        this.proc.on("error", () => { });
    }
    handleLine(line) {
        try {
            const msg = JSON.parse(line);
            if (msg.id !== undefined) {
                const pending = this.pending.get(Number(msg.id));
                if (pending) {
                    this.pending.delete(Number(msg.id));
                    if (msg.error)
                        pending.reject(new Error(JSON.stringify(msg.error)));
                    else
                        pending.resolve(msg.result);
                }
            }
        }
        catch { /* ignore malformed lines */ }
    }
    send(method, params) {
        return new Promise((resolve, reject) => {
            const id = this.msgId++;
            const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
            this.pending.set(id, { resolve, reject });
            this.proc.stdin?.write(msg);
            // Timeout after 10s
            setTimeout(() => {
                if (this.pending.has(id)) {
                    this.pending.delete(id);
                    reject(new Error(`Timeout waiting for response to ${method}`));
                }
            }, 10_000);
        });
    }
    notify(method, params) {
        const msg = JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n";
        this.proc.stdin?.write(msg);
    }
    async initialize() {
        await this.send("initialize", {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "xclaud-proxy", version: constants_js_1.PACKAGE_VERSION },
        });
        this.notify("notifications/initialized");
        this.ready = true;
    }
    async listTools() {
        const result = await this.send("tools/list", {});
        return (result?.tools ?? []).map(t => ({
            name: t.name,
            server_name: "", // filled by ToolProxy
            real_name: t.name,
            description: t.description ?? "",
            inputSchema: t.inputSchema ?? { type: "object", properties: {} },
        }));
    }
    async callTool(name, args) {
        return this.send("tools/call", { name, arguments: args });
    }
    kill() { this.proc.kill(); }
}
// ─── ToolProxy: manages all shadow connections ───────────────────────────────
class ToolProxy {
    connections = new Map();
    toolIndex = new Map();
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    async connectAll(servers) {
        const allTools = [];
        for (const server of servers) {
            try {
                const conn = new ShadowConnection(server);
                await conn.initialize();
                this.connections.set(server.name, conn);
                const tools = await conn.listTools();
                for (const tool of tools) {
                    const proxyName = shadow_registry_js_1.ShadowRegistryManager.proxyToolName(server.name, tool.name);
                    this.toolIndex.set(proxyName, { server: server.name, real: tool.name });
                    allTools.push({
                        ...tool,
                        name: proxyName,
                        server_name: server.name,
                        description: `[via ${server.name}] ${tool.description}`,
                    });
                }
                this.logger.log({
                    event_type: "server_start",
                    severity: "low",
                    description: `Shadow server connected: ${server.name} (${tools.length} tools)`,
                    meta: { server: server.name, tool_count: tools.length },
                });
            }
            catch (err) {
                this.logger.log({
                    event_type: "error",
                    severity: "medium",
                    description: `Failed to connect shadow server: ${server.name} — ${String(err)}`,
                    source: server.name,
                });
            }
        }
        return allTools;
    }
    async callTool(proxyName, args) {
        const entry = this.toolIndex.get(proxyName);
        if (!entry)
            throw new Error(`Unknown proxy tool: ${proxyName}`);
        const conn = this.connections.get(entry.server);
        if (!conn)
            throw new Error(`No connection to server: ${entry.server}`);
        return conn.callTool(entry.real, args);
    }
    hasProxyTool(name) {
        return this.toolIndex.has(name);
    }
    shutdown() {
        this.connections.forEach(c => c.kill());
        this.connections.clear();
    }
}
exports.ToolProxy = ToolProxy;
//# sourceMappingURL=tool-proxy.js.map