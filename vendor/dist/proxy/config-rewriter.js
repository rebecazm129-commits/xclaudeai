"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveClaudeConfigPath = resolveClaudeConfigPath;
exports.readClaudeConfig = readClaudeConfig;
exports.rewriteClaudeConfig = rewriteClaudeConfig;
exports.restoreClaudeConfig = restoreClaudeConfig;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const constants_js_1 = require("../constants.js");
function resolveClaudeConfigPath() {
    const raw = constants_js_1.CLAUDE_CONFIG_PATH;
    const expanded = raw.replace("~", os_1.default.homedir());
    // Cross-platform fallback
    if (process.platform === "win32") {
        return path_1.default.join(process.env.APPDATA ?? os_1.default.homedir(), "Claude", "claude_desktop_config.json");
    }
    if (process.platform === "linux") {
        return path_1.default.join(os_1.default.homedir(), ".config", "Claude", "claude_desktop_config.json");
    }
    return expanded;
}
function readClaudeConfig(configPath) {
    if (!fs_1.default.existsSync(configPath))
        return {};
    try {
        return JSON.parse(fs_1.default.readFileSync(configPath, "utf8"));
    }
    catch {
        return {};
    }
}
function rewriteClaudeConfig(params) {
    const configPath = params.configPath ?? resolveClaudeConfigPath();
    const mode = params.mode ?? "stdio";
    const existing = readClaudeConfig(configPath);
    const currentServers = existing.mcpServers ?? {};
    const serverNames = Object.keys(currentServers).filter(k => k !== "xclaude");
    // Back up current config
    const backupPath = configPath + ".xclaude-backup.json";
    try {
        if (fs_1.default.existsSync(configPath)) {
            fs_1.default.copyFileSync(configPath, backupPath);
        }
    }
    catch (e) {
        return { success: false, servers_captured: [], error: `Backup failed: ${String(e)}` };
    }
    // Capture shadow registry
    const shadowServers = serverNames.map(name => ({
        name,
        command: currentServers[name].command,
        args: currentServers[name].args,
        env: currentServers[name].env,
    }));
    const registry = {
        version: "1",
        created_at: new Date().toISOString(),
        servers: shadowServers,
    };
    // Write shadow registry
    const registryDir = path_1.default.join(os_1.default.homedir(), ".xclaude");
    const registryPath = path_1.default.join(registryDir, "shadow_registry.json");
    try {
        if (!fs_1.default.existsSync(registryDir))
            fs_1.default.mkdirSync(registryDir, { recursive: true });
        fs_1.default.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    }
    catch (e) {
        return { success: false, servers_captured: [], error: `Registry write failed: ${String(e)}` };
    }
    // Build the new xclaud entry
    let sgEntry = {};
    if (mode === "stdio") {
        sgEntry = {
            "xclaude": {
                command: "npx",
                args: ["-y", "xclaudeai"],
                env: {
                    SG_MODE: "stdio",
                    SG_API_KEY: params.apiKey,
                    SG_PROXIED_SERVERS: serverNames.join(","),
                },
            },
        };
    }
    else {
        sgEntry = {
            "xclaude": {
                command: "npx",
                args: ["-y", "xclaudeai"],
                env: {
                    SG_MODE: mode,
                    SG_API_KEY: params.apiKey,
                    SG_SERVER_URL: params.serverUrl ?? "",
                },
            },
        };
    }
    // Write new config
    const newConfig = { ...existing, mcpServers: sgEntry };
    try {
        const dir = path_1.default.dirname(configPath);
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
        fs_1.default.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
    }
    catch (e) {
        // Roll back
        if (fs_1.default.existsSync(backupPath))
            fs_1.default.copyFileSync(backupPath, configPath);
        return { success: false, servers_captured: [], error: `Config write failed: ${String(e)}` };
    }
    return {
        success: true,
        backup_path: backupPath,
        servers_captured: serverNames,
    };
}
function restoreClaudeConfig(configPath) {
    const cp = configPath ?? resolveClaudeConfigPath();
    const backupPath = cp + ".xclaude-backup.json";
    if (!fs_1.default.existsSync(backupPath))
        return false;
    try {
        fs_1.default.copyFileSync(backupPath, cp);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=config-rewriter.js.map