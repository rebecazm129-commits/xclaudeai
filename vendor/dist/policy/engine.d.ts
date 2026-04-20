import { PolicyRule, ActionType, RuleAction } from "./rules.js";
export interface PolicyDecision {
    decision: RuleAction;
    reason: string;
    rule_id: string;
    flags: string[];
}
export declare class PolicyEngine {
    private globalRules;
    private agentRules;
    private policyPath;
    constructor(policyPath?: string);
    evaluate(params: {
        action_type: ActionType;
        target: string;
        payload_preview?: string;
        agent_id: string;
    }): PolicyDecision;
    addRule(rule: PolicyRule, agentId?: string): void;
    getRules(agentId?: string): PolicyRule[];
    private load;
    private save;
}
//# sourceMappingURL=engine.d.ts.map