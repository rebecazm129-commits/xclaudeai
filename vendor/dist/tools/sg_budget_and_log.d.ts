import { TokenCounter } from "../utils/token-counter.js";
import { AuditLogger } from "../audit/logger.js";
export declare const sg_get_budget_status_schema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            agent_id: {
                type: string;
            };
            scope: {
                type: string;
                enum: string[];
                description: string;
            };
        };
        required: never[];
    };
};
export declare function handle_sg_get_budget_status(raw: unknown, counter: TokenCounter): {
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
export declare const sg_log_event_schema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            event_type: {
                type: string;
                enum: string[];
            };
            severity: {
                type: string;
                enum: string[];
            };
            description: {
                type: string;
                description: string;
            };
            source: {
                type: string;
                description: string;
            };
            snippet: {
                type: string;
                description: string;
                maxLength: number;
            };
            agent_id: {
                type: string;
            };
        };
        required: string[];
    };
};
export declare function handle_sg_log_event(raw: unknown, logger: AuditLogger): {
    logged: boolean;
    event_id: string;
    ts: string;
};
//# sourceMappingURL=sg_budget_and_log.d.ts.map