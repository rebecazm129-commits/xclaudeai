"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShadowRegistryManager = void 0;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const constants_js_1 = require("../constants.js");
class ShadowRegistryManager {
    registryPath;
    registry = null;
    constructor(registryPath = constants_js_1.DEFAULT_REGISTRY_PATH) {
        this.registryPath = registryPath.replace("~", os_1.default.homedir());
    }
    load() {
        if (this.registry)
            return this.registry;
        if (!fs_1.default.existsSync(this.registryPath)) {
            this.registry = { version: "1", created_at: new Date().toISOString(), servers: [] };
            return this.registry;
        }
        try {
            this.registry = JSON.parse(fs_1.default.readFileSync(this.registryPath, "utf8"));
            return this.registry;
        }
        catch {
            this.registry = { version: "1", created_at: new Date().toISOString(), servers: [] };
            return this.registry;
        }
    }
    save(registry) {
        const dir = path_1.default.dirname(this.registryPath);
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
        fs_1.default.writeFileSync(this.registryPath, JSON.stringify(registry, null, 2));
        this.registry = registry;
    }
    getServers() {
        return this.load().servers;
    }
    hasServers() {
        return this.getServers().length > 0;
    }
    // Build the sg_proxy__ tool name for a given real tool
    static proxyToolName(serverName, toolName) {
        return `sg_proxy__${serverName}__${toolName}`;
    }
    // Reverse: extract server and tool from proxy name
    static parseProxyToolName(proxyName) {
        const match = proxyName.match(/^sg_proxy__([^_]+(?:_[^_]+)*)__(.+)$/);
        if (!match)
            return null;
        return { server: match[1], tool: match[2] };
    }
}
exports.ShadowRegistryManager = ShadowRegistryManager;
//# sourceMappingURL=shadow-registry.js.map