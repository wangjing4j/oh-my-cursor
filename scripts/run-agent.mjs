#!/usr/bin/env node
/**
 * Run a single specialized agent via Cursor CLI: reads agents/<role>.md and sends role + task to `agent -p`.
 *
 * Usage:
 *   node scripts/run-agent.mjs [--workspace <path>] <role> [--no-force] [--mode ask|plan] -- <task...>
 *   node scripts/run-agent.mjs executor -- "Fix all TypeScript errors in src/"
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { resolveProjectLayout } from "./lib/repo-root.mjs";
import { parseGlobalOptions } from "./lib/parse-global-argv.mjs";
import { runCursorAgent } from "./lib/run-cursor-agent.mjs";

function usage() {
  console.error(`Usage: node scripts/run-agent.mjs [--workspace <path>] <role> [--no-force] [--mode ask|plan] -- <task>

Example:
  node scripts/run-agent.mjs executor -- "Add input validation to login form"
  node scripts/run-agent.mjs --workspace ../my-app executor -- "Fix login"`);
  process.exit(1);
}

const rawArgv = process.argv.slice(2);
if (rawArgv.length === 0) usage();

const { workspace: workspaceOpt, argv } = parseGlobalOptions(rawArgv);
const { cwd, agentsDir } = resolveProjectLayout({ explicitWorkspace: workspaceOpt });
if (argv.length === 0) usage();

let force = true;
let mode;
const parts = [];
let i = 0;
while (i < argv.length) {
  const a = argv[i];
  if (a === "--no-force") {
    force = false;
    i++;
    continue;
  }
  if (a === "--mode" && argv[i + 1]) {
    mode = argv[i + 1];
    i += 2;
    continue;
  }
  if (a === "--") {
    parts.push(...argv.slice(i + 1));
    break;
  }
  parts.push(a);
  i++;
}

const role = parts.shift();
if (!role) usage();

const task = parts.join(" ").trim();
if (!task) usage();

const promptPath = join(agentsDir, `${role}.md`);
if (!existsSync(promptPath)) {
  console.error(`Unknown role "${role}": missing ${promptPath}`);
  process.exit(1);
}

const roleBody = readFileSync(promptPath, "utf8");
const prompt = `${roleBody}

---

## Delegated task (orchestrator)

${task}

Follow the role instructions above. This run is driven by Cursor CLI; use repository paths under .oh-my-cursor/ for team artifacts when applicable.`;

process.exit(runCursorAgent({ cwd, prompt, force, mode }));
