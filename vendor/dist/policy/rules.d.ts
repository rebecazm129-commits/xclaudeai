export type ActionType = "file_write" | "file_read" | "network_request" | "email_send" | "tool_invoke" | "data_export";
export type RuleAction = "allow" | "block" | "allow_with_warning" | "log";
export interface PolicyRule {
    id: string;
    description: string;
    action_types: ActionType[];
    target_match?: string;
    agent_ids?: string[];
    hours?: number[];
    decision: RuleAction;
    reason: string;
}
export interface PolicySet {
    version: string;
    agent_id?: string;
    rules: PolicyRule[];
}
export declare const DEFAULT_RULES: PolicyRule[];
//# sourceMappingURL=rules.d.ts.map