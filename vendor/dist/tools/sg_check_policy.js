"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sg_check_policy_schema = void 0;
exports.handle_sg_check_policy = handle_sg_check_policy;
const zod_1 = require("zod");
exports.sg_check_policy_schema = {
    name: "sg_check_policy",
    description: "Check whether a proposed action is permitted under the active xCLAUDE policy. " +
        "Call this before any tool invocation that touches external services, files outside " +
        "the sandbox, or user credentials. Returns allow / block / allow_with_warning.",
    inputSchema: {
        type: "object",
        properties: {
            action_type: {
                type: "string",
                enum: ["file_write", "file_read", "network_request", "email_send", "tool_invoke", "data_export"],
                description: "The category of action being requested.",
            },
            target: {
                type: "string",
                description: "The destination, path, or endpoint — e.g. file path, URL, email address.",
            },
            payload_preview: {
                type: "string",
                description: "First 500 chars of the data being sent or written, for pre-scan.",
            },
            agent_id: {
                type: "string",
                description: "Identifier of the calling agent for per-agent policy scoping.",
            },
        },
        required: ["action_type", "target"],
    },
};
const InputSchema = zod_1.z.object({
    action_type: zod_1.z.enum(["file_write", "file_read", "network_request", "email_send", "tool_invoke", "data_export"]),
    target: zod_1.z.string(),
    payload_preview: zod_1.z.string().optional(),
    agent_id: zod_1.z.string().default("claude"),
});
function handle_sg_check_policy(raw, engine, logger) {
    const input = InputSchema.parse(raw);
    const decision = engine.evaluate({
        action_type: input.action_type,
        target: input.target,
        agent_id: input.agent_id,
    });
    const event = logger.log({
        event_type: decision.decision === "block" ? "tool_call_blocked" : "tool_call_allowed",
        severity: decision.decision === "block" ? "high" : "low",
        agent_id: input.agent_id,
        tool: "sg_check_policy",
        target: input.target,
        decision: decision.decision,
        description: `${input.action_type} on ${input.target}: ${decision.decision}`,
        meta: { rule_id: decision.rule_id, flags: decision.flags },
    });
    return {
        decision: decision.decision,
        reason: decision.reason,
        event_id: event.id,
        flags: decision.flags,
    };
}
//# sourceMappingURL=sg_check_policy.js.map