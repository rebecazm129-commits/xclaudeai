import { PiiType } from "../utils/pii-detector.js";
import { AuditLogger } from "../audit/logger.js";
export declare const sg_detect_pii_schema: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            content: {
                type: string;
                description: string;
            };
            scan_types: {
                type: string;
                items: {
                    type: string;
                    enum: string[];
                };
                description: string;
            };
            context: {
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
export declare function handle_sg_detect_pii(raw: unknown, logger: AuditLogger): {
    clean: boolean;
    findings: {
        type: PiiType;
        subtype: import("../utils/pii-detector.js").PiiSubtype;
        offset: number;
        confidence: "low" | "medium" | "high";
        redacted_preview: string;
    }[];
    risk_level: "low" | "medium" | "high" | "clean";
    event_id: string;
} | {
    clean: boolean;
    findings: never[];
    risk_level: string;
    event_id: null;
};
//# sourceMappingURL=sg_detect_pii.d.ts.map