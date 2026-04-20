"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenCounter = void 0;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
// Rough cost approximation — update when Anthropic pricing changes
const COST_PER_TOKEN_USD = 0.000003; // ~$3 / 1M tokens (Sonnet mid estimate)
class TokenCounter {
    budgets = new Map();
    filePath;
    constructor(budgetDir = "~/.xclaud") {
        this.filePath = path_1.default.join(budgetDir.replace("~", os_1.default.homedir()), "budgets.json");
        this.load();
    }
    ensureBudget(agentId, tokenLimit = 100_000, costLimit = 10) {
        if (!this.budgets.has(agentId)) {
            const budget = {
                agent_id: agentId,
                tokens_used: 0,
                tokens_limit: tokenLimit,
                cost_usd_used: 0,
                cost_usd_limit: costLimit,
                session_start: new Date().toISOString(),
                last_updated: new Date().toISOString(),
            };
            this.budgets.set(agentId, budget);
        }
        return this.budgets.get(agentId);
    }
    add(agentId, tokens) {
        const b = this.ensureBudget(agentId);
        b.tokens_used += tokens;
        b.cost_usd_used += tokens * COST_PER_TOKEN_USD;
        b.last_updated = new Date().toISOString();
        this.save();
        return b;
    }
    getStatus(agentId, scope = "session") {
        const b = this.ensureBudget(agentId);
        const remaining = Math.max(0, b.tokens_limit - b.tokens_used);
        const pct = Math.round((remaining / b.tokens_limit) * 100);
        const costLeft = Math.max(0, b.cost_usd_limit - b.cost_usd_used);
        let status = "ok";
        if (b.tokens_used >= b.tokens_limit)
            status = "exceeded";
        else if (pct < 20)
            status = "warning";
        return {
            tokens_used: b.tokens_used,
            tokens_limit: b.tokens_limit,
            tokens_remaining: remaining,
            cost_usd_used: parseFloat(b.cost_usd_used.toFixed(4)),
            cost_usd_limit: b.cost_usd_limit,
            cost_usd_remaining: parseFloat(costLeft.toFixed(4)),
            pct_remaining: pct,
            status,
            scope,
            session_start: b.session_start,
        };
    }
    reset(agentId) {
        this.budgets.delete(agentId);
        this.save();
    }
    load() {
        try {
            if (fs_1.default.existsSync(this.filePath)) {
                const raw = JSON.parse(fs_1.default.readFileSync(this.filePath, "utf8"));
                raw.forEach(b => this.budgets.set(b.agent_id, b));
            }
        }
        catch { /* start fresh */ }
    }
    save() {
        try {
            const dir = path_1.default.dirname(this.filePath);
            if (!fs_1.default.existsSync(dir))
                fs_1.default.mkdirSync(dir, { recursive: true });
            fs_1.default.writeFileSync(this.filePath, JSON.stringify([...this.budgets.values()], null, 2));
        }
        catch { /* non-fatal */ }
    }
}
exports.TokenCounter = TokenCounter;
//# sourceMappingURL=token-counter.js.map