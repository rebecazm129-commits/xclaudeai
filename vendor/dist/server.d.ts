export declare class XClaudServer {
    private server;
    private logger;
    private policy;
    private counter;
    private registry;
    private proxy;
    private proxied;
    private cfg;
    constructor();
    private registerHandlers;
    private dispatchTool;
    start(): Promise<void>;
    stop(): Promise<void>;
}
//# sourceMappingURL=server.d.ts.map