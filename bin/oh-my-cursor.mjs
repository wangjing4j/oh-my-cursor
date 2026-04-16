#!/usr/bin/env node
/**
 * CLI entry: oh-my-cursor agent | team | interview | help | about
 * --workspace / -w may appear anywhere; last value wins.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseGlobalOptions } from "../scripts/lib/parse-global-argv.mjs";

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const runAgent = join(pkgRoot, "scripts", "run-agent.mjs");
const runTeam = join(pkgRoot, "scripts", "run-team.mjs");
const runInterview = join(pkgRoot, "scripts", "run-interview.mjs");

function loadPackageJson() {
  const path = join(pkgRoot, "package.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

function printAbout() {
  const pkg = loadPackageJson();
  console.log(`${pkg.name} ${pkg.version}
${pkg.description}

Project: multi-agent role prompts and Cursor CLI runners for Team and single-role workflows.
Documentation: AGENTS.md and README.md in the package root.
Artifacts when using Team mode: .oh-my-cursor/plans/ and .oh-my-cursor/state/

Credits: agent prompts are vendored from oh-my-claudecode (MIT)
  https://github.com/Yeachan-Heo/oh-my-claudecode See NOTICE in the package root for details.

License: MIT — see LICENSE.
`);
}

function printHelp() {
  console.log(`oh-my-cursor — multi-agent prompts + Cursor CLI runners

Usage:
  oh-my-cursor [--workspace <path>] <command> [args...]
  (or put --workspace / -w anywhere, e.g. after the task)

Commands:
  agent     Run one role (pass-through to run-agent.mjs)
  team      Team pipeline: N:role "task" (quotes optional) or resume
  interview Deep requirements interview (analyst + deep-interview skill)
  about     Project info, credits, and license
  help      Show this message

Global:
  --workspace <path>   Project root for code and .oh-my-cursor/ (relative to cwd).
  -w <path>           Same as --workspace. Last occurrence wins.

Team only:
  --no-commit         Do not require one git commit per completed requirement-level task (see README).
                      Env: OH_MY_CURSOR_TEAM_NO_COMMIT=1

Examples:
  oh-my-cursor agent executor -- "Fix TypeScript errors"
  oh-my-cursor team '1:executor "add login endpoint"'
  oh-my-cursor team 1:executor "add about page" --workspace C:\\path\\to\\my-app
  oh-my-cursor team resume --workspace ../my-app
  oh-my-cursor --workspace ../my-app agent explore --mode ask -- "Where is auth?"
  oh-my-cursor interview -- -- "Vague product idea for a mobile app"
`);
}

const raw = process.argv.slice(2);
if (raw[0] === "--help" || raw[0] === "-h") {
  printHelp();
  process.exit(0);
}

const { workspace, argv } = parseGlobalOptions(raw);
if (!argv.length) {
  printHelp();
  process.exit(1);
}

const cmd = argv[0];
const rest = argv.slice(1);
const wsPrefix = workspace ? ["--workspace", workspace] : [];

if (cmd === "help") {
  printHelp();
  process.exit(0);
}

if (cmd === "about") {
  printAbout();
  process.exit(0);
}

const node = process.execPath;
const inherit = { stdio: "inherit", shell: true };

if (cmd === "agent") {
  const st = spawnSync(node, [runAgent, ...wsPrefix, ...rest], inherit);
  process.exit(st.status ?? 1);
}

if (cmd === "team") {
  const st = spawnSync(node, [runTeam, ...wsPrefix, ...rest], inherit);
  process.exit(st.status ?? 1);
}

if (cmd === "interview") {
  const st = spawnSync(node, [runInterview, ...wsPrefix, ...rest], inherit);
  process.exit(st.status ?? 1);
}

console.error(`Unknown command: ${cmd}\n`);
printHelp();
process.exit(1);
