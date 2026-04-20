export interface ShadowServer {
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
}
export interface ShadowRegistry {
    version: string;
    created_at: string;
    servers: ShadowServer[];
}
export declare class ShadowRegistryManager {
    private registryPath;
    private registry;
    constructor(registryPath?: string);
    load(): ShadowRegistry;
    save(registry: ShadowRegistry): void;
    getServers(): ShadowServer[];
    hasServers(): boolean;
    static proxyToolName(serverName: string, toolName: string): string;
    static parseProxyToolName(proxyName: string): {
        server: string;
        tool: string;
    } | null;
}
//# sourceMappingURL=shadow-registry.d.ts.map