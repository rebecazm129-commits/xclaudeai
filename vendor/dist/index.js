"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_js_1 = require("./server.js");
const server = new server_js_1.XClaudServer();
process.on("SIGINT", () => server.stop().then(() => process.exit(0)));
process.on("SIGTERM", () => server.stop().then(() => process.exit(0)));
server.start().catch(err => {
    process.stderr.write(`[xclaude] Fatal: ${String(err)}\n`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map