import { PolicyEngine } from "../policy/engine.js";
import { AuditLogger } from "../audit/logger.js";
export declare const sg_check_policy_schema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            action_type: {
                type: string;
                enum: string[];
                description: string;
            };
            target: {
                type: string;
                description: string;
            };
            payload_preview: {
                type: string;
                description: string;
            };
            agent_id: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function handle_sg_check_policy(raw: unknown, engine: PolicyEngine, logger: AuditLogger): {
    decision: import("../policy/rules.js").RuleAction;
    reason: string;
    event_id: string;
    flags: string[];
};
//# sourceMappingURL=sg_check_policy.d.ts.map