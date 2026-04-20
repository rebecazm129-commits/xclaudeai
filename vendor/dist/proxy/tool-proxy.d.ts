import { ShadowServer } from "./shadow-registry.js";
import { AuditLogger } from "../audit/logger.js";
export interface ProxiedTool {
    name: string;
    server_name: string;
    real_name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}
export declare class ToolProxy {
    private connections;
    private toolIndex;
    private logger;
    constructor(logger: AuditLogger);
    connectAll(servers: ShadowServer[]): Promise<ProxiedTool[]>;
    callTool(proxyName: string, args: unknown): Promise<unknown>;
    hasProxyTool(name: string): boolean;
    shutdown(): void;
}
//# sourceMappingURL=tool-proxy.d.ts.map