export type PiiType = "pii" | "credentials" | "financial" | "health";
export type PiiSubtype = "email" | "phone" | "ip_address" | "name_pattern" | "api_key" | "aws_key" | "github_token" | "jwt" | "private_key" | "password_field" | "generic_secret" | "credit_card" | "iban" | "sort_code" | "icd_code" | "nhs_number";
export interface PiiMatch {
    type: PiiType;
    subtype: PiiSubtype;
    offset: number;
    length: number;
    redacted_preview: string;
    confidence: "high" | "medium" | "low";
}
export declare function scanForPii(content: string, scanTypes?: (PiiType | "all")[]): PiiMatch[];
export declare function riskLevel(matches: PiiMatch[]): "clean" | "low" | "medium" | "high";
//# sourceMappingURL=pii-detector.d.ts.map