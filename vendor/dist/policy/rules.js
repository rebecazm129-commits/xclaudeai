"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RULES = void 0;
// ─── Default ruleset shipped with the package ─────────────────────────────────
exports.DEFAULT_RULES = [
    {
        id: "block-ssh",
        description: "Block access to SSH and credentials directories",
        action_types: ["file_read", "file_write"],
        target_match: ".ssh",
        decision: "block",
        reason: "Access to .ssh directory is restricted by your xCLAUDE policy.",
    },
    {
        id: "block-keychain",
        description: "Block access to system keychains",
        action_types: ["file_read", "file_write"],
        target_match: "Keychain",
        decision: "block",
        reason: "Access to system keychain is restricted.",
    },
    {
        id: "block-env-files",
        description: "Block access to .env files containing secrets",
        action_types: ["file_read", "file_write"],
        target_match: ".env",
        decision: "block",
        reason: "Access to .env files is restricted — they may contain credentials.",
    },
    {
        id: "warn-new-network",
        description: "Warn on first network request to any destination",
        action_types: ["network_request"],
        decision: "allow_with_warning",
        reason: "This agent is making a network request. Review the destination.",
    },
    {
        id: "warn-email-send",
        description: "Warn before sending any email",
        action_types: ["email_send"],
        decision: "allow_with_warning",
        reason: "Your agent is about to send an email. Review before allowing.",
    },
    {
        id: "warn-data-export",
        description: "Warn on data export operations",
        action_types: ["data_export"],
        decision: "allow_with_warning",
        reason: "Your agent is exporting data. Confirm this is intended.",
    },
    {
        id: "allow-default",
        description: "Default allow for all other actions",
        action_types: ["file_read", "file_write", "network_request", "email_send", "tool_invoke", "data_export"],
        decision: "allow",
        reason: "Action permitted by default policy.",
    },
];
//# sourceMappingURL=rules.js.map