export type EventType = "tool_call_allowed" | "tool_call_blocked" | "pii_detected" | "credential_detected" | "prompt_injection" | "data_export_warning" | "email_send_warning" | "budget_warning" | "budget_exceeded" | "injection_suspected" | "task_complete" | "policy_question" | "anomaly_self_report" | "suspicious_content" | "server_start" | "server_stop" | "error";
export interface AuditEvent {
    id: string;
    ts: string;
    event_type: EventType;
    severity: "low" | "medium" | "high" | "critical";
    agent_id?: string;
    tool?: string;
    target?: string;
    decision?: "allow" | "block" | "allow_with_warning" | "log";
    description: string;
    source?: string;
    snippet?: string;
    meta?: Record<string, unknown>;
}
export declare class AuditLogger {
    private logPath;
    constructor(logPath?: string);
    private ensureDir;
    log(event: Omit<AuditEvent, "id" | "ts">): AuditEvent;
    recent(n?: number): AuditEvent[];
    close(): void;
    private generateId;
}
//# sourceMappingURL=logger.d.ts.map