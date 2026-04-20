export interface AgentBudget {
    agent_id: string;
    tokens_used: number;
    tokens_limit: number;
    cost_usd_used: number;
    cost_usd_limit: number;
    session_start: string;
    last_updated: string;
}
export declare class TokenCounter {
    private budgets;
    private filePath;
    constructor(budgetDir?: string);
    ensureBudget(agentId: string, tokenLimit?: number, costLimit?: number): AgentBudget;
    add(agentId: string, tokens: number): AgentBudget;
    getStatus(agentId: string, scope?: "session" | "daily" | "weekly"): {
        tokens_used: number;
        tokens_limit: number;
        tokens_remaining: number;
        cost_usd_used: number;
        cost_usd_limit: number;
        cost_usd_remaining: number;
        pct_remaining: number;
        status: "ok" | "warning" | "exceeded";
        scope: "session" | "daily" | "weekly";
        session_start: string;
    };
    reset(agentId: string): void;
    private load;
    private save;
}
//# sourceMappingURL=token-counter.d.ts.map