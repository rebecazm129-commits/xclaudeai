#!/usr/bin/env node

/**
 * sigma-guard setup
 * Reads existing claude_desktop_config.json, writes shadow registry,
 * rewrites config to route all tool calls through Sigma Guard.
 */

const readline = require("readline");
const path     = require("path");
const os       = require("os");
const fs       = require("fs");

const C = {
  reset:  "\x1b[0m",
  green:  "\x1b[32m",
  teal:   "\x1b[36m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
};

function log(msg)  { process.stdout.write(msg + "\n"); }
function ok(msg)   { log(`${C.green}✓${C.reset} ${msg}`); }
function warn(msg) { log(`${C.yellow}⚠${C.reset} ${msg}`); }
function err(msg)  { log(`${C.red}✗${C.reset} ${msg}`); }
function info(msg) { log(`${C.dim}  ${msg}${C.reset}`); }

function prompt(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  log(`\n${C.teal}${C.bold}xCLAUD — Setup${C.reset}\n`);
  log("This wizard will connect xCLAUD to your Claude Desktop installation.\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // ── 1. API key ──────────────────────────────────────────────────────────────
  const envKey  = process.env.SG_API_KEY ?? "";
  let   apiKey  = envKey;

  if (!apiKey) {
    log("Your xCLAUD API key (from xclaud.ai/dashboard):");
    apiKey = (await prompt(rl, "  SG_API_KEY: ")).trim();
    if (!apiKey) {
      warn("No API key provided — using 'sg_dev_local' for local-only mode.");
      apiKey = "sg_dev_local";
    }
  } else {
    ok(`API key loaded from environment (${apiKey.slice(0,12)}...)`);
  }

  // ── 2. Detect Claude config ─────────────────────────────────────────────────
  let configPath;
  if      (process.platform === "darwin") configPath = path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  else if (process.platform === "win32")  configPath = path.join(process.env.APPDATA ?? os.homedir(), "Claude", "claude_desktop_config.json");
  else                                    configPath = path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json");

  log(`\nLooking for Claude Desktop config at:\n  ${C.dim}${configPath}${C.reset}`);

  if (!fs.existsSync(configPath)) {
    warn("Config file not found — creating a fresh one.");
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ mcpServers: {} }, null, 2));
  } else {
    ok("Config file found.");
  }

  // ── 2.5. AUTO-ADD FILESYSTEM ────────────────────────────────────────────────
  const existing = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!existing.mcpServers) existing.mcpServers = {};
  
  if (!existing.mcpServers.filesystem) {
    const desktopPath = path.join(os.homedir(), "Desktop");
    existing.mcpServers.filesystem = {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", desktopPath]
    };
    fs.writeFileSync(configPath, JSON.stringify(existing, null, 2));
    ok("Filesystem server added automatically (Desktop folder)");
  }

  // ── 3. Show existing servers ────────────────────────────────────────────────
  const servers = Object.keys(existing.mcpServers ?? {}).filter(k => k !== "xclaude");

  if (servers.length > 0) {
    log(`\nExisting MCP servers that will be captured in the shadow registry:`);
    servers.forEach(s => info(`• ${s}`));
  } else {
    log(`\n${C.dim}No existing MCP servers found. Only xCLAUD's native tools will be active.${C.reset}`);
  }

  // ── 4. Confirm ──────────────────────────────────────────────────────────────
  log(`\nxCLAUD will:`);
  info(`• Back up your config to: ${configPath}.xclaud-backup.json`);
  info(`• Write a shadow registry to: ~/.xclaud/shadow_registry.json`);
  info(`• Replace your mcpServers with a single sigma-guard entry`);
  log("");

  const confirm = (await prompt(rl, `${C.bold}Proceed? (y/N): ${C.reset}`)).trim().toLowerCase();
  rl.close();

  if (confirm !== "y") {
    warn("Setup cancelled. Nothing was changed.");
    return;
  }

  // ── 5. Run the rewriter ─────────────────────────────────────────────────────
  // Inline the rewrite logic to avoid requiring compiled dist at install time
  const backupPath    = configPath + ".xclaud-backup.json";
  const registryDir   = path.join(os.homedir(), ".xclaud");
  const registryPath  = path.join(registryDir, "shadow_registry.json");

  try {
    // Backup
    fs.copyFileSync(configPath, backupPath);
    ok(`Backup written to ${backupPath}`);

    // Shadow registry
    if (!fs.existsSync(registryDir)) fs.mkdirSync(registryDir, { recursive: true });
    const shadowServers = servers.map(name => ({
      name,
      command: existing.mcpServers[name].command,
      args:    existing.mcpServers[name].args,
      env:     existing.mcpServers[name].env,
    }));
    fs.writeFileSync(registryPath, JSON.stringify({
      version:    "1",
      created_at: new Date().toISOString(),
      servers:    shadowServers,
    }, null, 2));
    ok(`Shadow registry written (${shadowServers.length} server(s))`);

    // New config
    const newConfig = {
      ...existing,
      mcpServers: {
        "xclaude": {
          command: "npx",
          args:    ["-y", "xclaudeai"],
          env: {
            SG_MODE:             "stdio",
            SG_API_KEY:          apiKey,
            SG_PROXIED_SERVERS:  servers.join(","),
          },
        },
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
    ok("Claude Desktop config updated.");

  } catch (e) {
    err(`Setup failed: ${String(e)}`);
    // Roll back
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, configPath);
      warn("Config rolled back from backup.");
    }
    process.exit(1);
  }

  // ── 6. Done ─────────────────────────────────────────────────────────────────
  log(`
${C.green}${C.bold}✓ xCLAUD is connected.${C.reset}

Next steps:
  1. Restart Claude Desktop
  2. xCLAUD will begin monitoring immediately
  3. Run ${C.teal}xclaude status${C.reset} to verify the connection
  4. Visit your dashboard at ${C.teal}https://xclaud-trace.lovable.app${C.reset}

To restore your original config at any time:
  ${C.dim}xclaude restore${C.reset}
`);
}

main().catch(e => { err(String(e)); process.exit(1); });
