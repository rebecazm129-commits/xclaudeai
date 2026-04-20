export interface ClaudeDesktopConfig {
    mcpServers?: Record<string, {
        command: string;
        args?: string[];
        env?: Record<string, string>;
    }>;
}
export interface RewriteResult {
    success: boolean;
    backup_path?: string;
    servers_captured: string[];
    error?: string;
}
export declare function resolveClaudeConfigPath(): string;
export declare function readClaudeConfig(configPath: string): ClaudeDesktopConfig;
export declare function rewriteClaudeConfig(params: {
    configPath?: string;
    apiKey: string;
    mode?: "stdio" | "cloud" | "on-premise";
    serverUrl?: string;
}): RewriteResult;
export declare function restoreClaudeConfig(configPath?: string): boolean;
//# sourceMappingURL=config-rewriter.d.ts.map