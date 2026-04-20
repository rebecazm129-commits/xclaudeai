"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyEngine = void 0;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const rules_js_1 = require("./rules.js");
const constants_js_1 = require("../constants.js");
class PolicyEngine {
    globalRules = [...rules_js_1.DEFAULT_RULES];
    agentRules = new Map();
    policyPath;
    constructor(policyPath = constants_js_1.DEFAULT_POLICY_PATH) {
        this.policyPath = policyPath.replace("~", os_1.default.homedir());
        this.load();
    }
    evaluate(params) {
        const { action_type, target, agent_id } = params;
        const now = new Date().getHours();
        const flags = [];
        // Per-agent rules take precedence over global
        const rules = [
            ...(this.agentRules.get(agent_id) ?? []),
            ...this.globalRules,
        ];
        for (const rule of rules) {
            // Action type match
            if (!rule.action_types.includes(action_type))
                continue;
            // Agent scope match
            if (rule.agent_ids && !rule.agent_ids.includes(agent_id))
                continue;
            // Target pattern match
            if (rule.target_match && !target.toLowerCase().includes(rule.target_match.toLowerCase()))
                continue;
            // Time window match
            if (rule.hours && !rule.hours.includes(now)) {
                flags.push("outside_permitted_hours");
                return {
                    decision: "block",
                    reason: `This action is only permitted between hours ${rule.hours.join(", ")}.`,
                    rule_id: rule.id,
                    flags,
                };
            }
            if (rule.decision === "allow_with_warning") {
                flags.push("policy_warning");
            }
            return { decision: rule.decision, reason: rule.reason, rule_id: rule.id, flags };
        }
        // No matching rule — default allow
        return { decision: "allow", reason: "No matching policy rule.", rule_id: "default", flags };
    }
    addRule(rule, agentId) {
        if (agentId) {
            const existing = this.agentRules.get(agentId) ?? [];
            this.agentRules.set(agentId, [rule, ...existing]);
        }
        else {
            this.globalRules = [rule, ...this.globalRules];
        }
        this.save();
    }
    getRules(agentId) {
        if (agentId)
            return this.agentRules.get(agentId) ?? [];
        return this.globalRules;
    }
    load() {
        try {
            if (fs_1.default.existsSync(this.policyPath)) {
                const sets = JSON.parse(fs_1.default.readFileSync(this.policyPath, "utf8"));
                for (const set of sets) {
                    if (set.agent_id) {
                        this.agentRules.set(set.agent_id, set.rules);
                    }
                    else {
                        // Merge — user rules prepend defaults
                        this.globalRules = [...set.rules, ...rules_js_1.DEFAULT_RULES];
                    }
                }
            }
        }
        catch { /* use defaults */ }
    }
    save() {
        try {
            const dir = path_1.default.dirname(this.policyPath);
            if (!fs_1.default.existsSync(dir))
                fs_1.default.mkdirSync(dir, { recursive: true });
            const sets = [{ version: "1", rules: this.globalRules }];
            this.agentRules.forEach((rules, agent_id) => sets.push({ version: "1", agent_id, rules }));
            fs_1.default.writeFileSync(this.policyPath, JSON.stringify(sets, null, 2));
        }
        catch { /* non-fatal */ }
    }
}
exports.PolicyEngine = PolicyEngine;
//# sourceMappingURL=engine.js.map