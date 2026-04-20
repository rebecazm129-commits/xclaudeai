"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogger = void 0;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const constants_js_1 = require("../constants.js");
class AuditLogger {
    logPath;
    constructor(logPath = constants_js_1.DEFAULT_LOG_PATH) {
        this.logPath = logPath.replace("~", os_1.default.homedir());
        this.ensureDir();
    }
    ensureDir() {
        const dir = path_1.default.dirname(this.logPath);
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
    }
    log(event) {
        const full = {
            id: this.generateId(),
            ts: new Date().toISOString(),
            ...event,
        };
        const line = JSON.stringify(full) + "\n";
        require("fs").appendFileSync(this.logPath, line);
        return full;
    }
    // Read recent events (tail)
    recent(n = 50) {
        if (!fs_1.default.existsSync(this.logPath))
            return [];
        const lines = fs_1.default.readFileSync(this.logPath, "utf8")
            .trim().split("\n").filter((l) => Boolean(l)).slice(-n);
        return lines.map(l => JSON.parse(l));
    }
    close() {
    }
    generateId() {
        return "evt_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }
}
exports.AuditLogger = AuditLogger;
//# sourceMappingURL=logger.js.map