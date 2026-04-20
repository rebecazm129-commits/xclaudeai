"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sg_detect_pii_schema = void 0;
exports.handle_sg_detect_pii = handle_sg_detect_pii;
const zod_1 = require("zod");
const pii_detector_js_1 = require("../utils/pii-detector.js");
exports.sg_detect_pii_schema = {
    name: "sg_detect_pii",
    description: "Scan a text payload for personally identifiable information, credentials, or " +
        "sensitive data patterns. Use before sending content to external services, " +
        "storing to disk, or including in outputs.",
    inputSchema: {
        type: "object",
        properties: {
            content: {
                type: "string",
                description: "Text to scan — max 10,000 chars per call.",
            },
            scan_types: {
                type: "array",
                items: { type: "string", enum: ["pii", "credentials", "financial", "health", "all"] },
                description: "Which categories to scan for. Default: all.",
            },
            context: {
                type: "string",
                description: "Where this content came from — 'user prompt', 'web_fetch result', etc.",
            },
            agent_id: {
                type: "string",
                description: "Calling agent identifier for audit scoping.",
            },
        },
        required: ["content"],
    },
};
const InputSchema = zod_1.z.object({
    content: zod_1.z.string().max(10_000),
    scan_types: zod_1.z.array(zod_1.z.enum(["pii", "credentials", "financial", "health", "all"])).default(["all"]),
    context: zod_1.z.string().optional(),
    agent_id: zod_1.z.string().optional(),
});
function handle_sg_detect_pii(raw, logger) {
    const input = InputSchema.parse(raw);
    const scanTypes = (input.scan_types.includes("all")
        ? ["pii", "credentials", "financial", "health"]
        : input.scan_types);
    const findings = (0, pii_detector_js_1.scanForPii)(input.content, scanTypes);
    const risk = (0, pii_detector_js_1.riskLevel)(findings);
    const clean = findings.length === 0;
    if (!clean) {
        const eventType = findings.some(f => f.type === "credentials")
            ? "credential_detected"
            : "pii_detected";
        // FIX: Severity según tabla oficial de xCLAUDE
        // - Credentials → CRITICAL (rojo)
        // - PII → MEDIUM (amarillo)
        const event = logger.log({
            event_type: eventType,
            severity: eventType === "credential_detected" ? "critical" : "medium",
            agent_id: input.agent_id,
            tool: "sg_detect_pii",
            description: `${findings.length} finding(s) in ${input.context ?? "unknown source"}`,
            source: input.context,
            snippet: findings[0]?.redacted_preview,
            meta: { finding_count: findings.length, risk_level: risk },
        });
        return {
            clean: false,
            findings: findings.map(f => ({
                type: f.type,
                subtype: f.subtype,
                offset: f.offset,
                confidence: f.confidence,
                redacted_preview: f.redacted_preview,
            })),
            risk_level: risk,
            event_id: event.id,
        };
    }
    return { clean: true, findings: [], risk_level: "clean", event_id: null };
}
//# sourceMappingURL=sg_detect_pii.js.map