"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanForPii = scanForPii;
exports.riskLevel = riskLevel;
// ─── Pattern definitions ──────────────────────────────────────────────────────
const PATTERNS = [
    // Credentials
    { type: "credentials", subtype: "api_key", confidence: "high", regex: /\bsk-ant-[a-zA-Z0-9_-]{10,}/g },
    { type: "credentials", subtype: "api_key", confidence: "high", regex: /\bsk-[a-zA-Z0-9]{32,}/g },
    { type: "credentials", subtype: "aws_key", confidence: "high", regex: /\bAKIA[A-Z0-9]{16}\b/g },
    { type: "credentials", subtype: "aws_key", confidence: "medium", regex: /\b[A-Z0-9]{20}\b(?=.*[a-z0-9\/+]{40})/g },
    { type: "credentials", subtype: "github_token", confidence: "high", regex: /\bghp_[a-zA-Z0-9]{36}\b/g },
    { type: "credentials", subtype: "github_token", confidence: "high", regex: /\bgho_[a-zA-Z0-9]{36}\b/g },
    { type: "credentials", subtype: "jwt", confidence: "high", regex: /\bey[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\b/g },
    { type: "credentials", subtype: "private_key", confidence: "high", regex: /-----BEGIN\s(?:RSA\s)?PRIVATE KEY-----/g },
    { type: "credentials", subtype: "password_field", confidence: "medium", regex: /(?:password|passwd|pwd)\s*[=:]\s*\S{6,}/gi },
    { type: "credentials", subtype: "generic_secret", confidence: "medium", regex: /(?:secret|token|api[_-]?key)\s*[=:]\s*["']?[a-zA-Z0-9\-_\.]{16,}["']?/gi },
    // PII
    { type: "pii", subtype: "email", confidence: "high", regex: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g },
    { type: "pii", subtype: "phone", confidence: "medium", regex: /(?:\+\d{1,3}[\s\-]?)?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}/g },
    { type: "pii", subtype: "ip_address", confidence: "medium", regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g },
    // Financial
    { type: "financial", subtype: "credit_card", confidence: "high", regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g },
    { type: "financial", subtype: "iban", confidence: "high", regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{1,30}\b/g },
    { type: "financial", subtype: "sort_code", confidence: "medium", regex: /\b\d{2}-\d{2}-\d{2}\b/g },
];
// ─── Main scan function ───────────────────────────────────────────────────────
function scanForPii(content, scanTypes = ["all"]) {
    const results = [];
    const resolved = scanTypes.includes("all")
        ? ["pii", "credentials", "financial", "health"]
        : scanTypes;
    const active = PATTERNS.filter(p => resolved.includes(p.type));
    for (const { type, subtype, regex, confidence } of active) {
        // Always create a fresh RegExp — never reuse a stateful /g regex across calls
        const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(content)) !== null) {
            results.push({
                type,
                subtype,
                offset: match.index,
                length: match[0].length,
                redacted_preview: redact(match[0], subtype),
                confidence,
            });
        }
    }
    return dedupeByOffset(results);
}
function redact(value, subtype) {
    if (subtype === "email") {
        const [local, domain] = value.split("@");
        return local.slice(0, 2) + "***@" + domain;
    }
    if (subtype === "credit_card") {
        return "**** **** **** " + value.slice(-4);
    }
    if (value.length <= 8)
        return value.slice(0, 2) + "***";
    return value.slice(0, 4) + "****..." + value.slice(-4);
}
function dedupeByOffset(matches) {
    const seen = new Set();
    return matches.filter(m => {
        if (seen.has(m.offset))
            return false;
        seen.add(m.offset);
        return true;
    });
}
function riskLevel(matches) {
    if (matches.length === 0)
        return "clean";
    if (matches.some(m => m.type === "credentials" && m.confidence === "high"))
        return "high";
    if (matches.some(m => m.type === "financial"))
        return "high";
    if (matches.some(m => m.confidence === "medium"))
        return "medium";
    return "low";
}
//# sourceMappingURL=pii-detector.js.map