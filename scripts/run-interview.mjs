#!/usr/bin/env node
/**
 * Socratic deep interview: analyst role + bundled `.cursor/skills/deep-interview/SKILL.md`.
 *
 * Usage:
 *   node scripts/run-interview.mjs [--workspace <path>] [--quick|--standard|--deep] [--autoresearch] -- "<idea>"
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getPackageRoot, resolveProjectLayout } from "./lib/repo-root.mjs";
import { parseGlobalOptions } from "./lib/parse-global-argv.mjs";
import { runCursorAgent } from "./lib/run-cursor-agent.mjs";

function usage() {
  console.error(`Usage: node scripts/run-interview.mjs [--workspace <path>] [--quick|--standard|--deep] [--autoresearch] -- "<idea>"

Example:
  node scripts/run-interview.mjs -- -- "A vague idea for a team dashboard"
  oh-my-cursor interview --deep -- "Refactor the payment module"`);
  process.exit(1);
}

const rawArgv = process.argv.slice(2);
if (rawArgv.length === 0) usage();

const { workspace: workspaceOpt, argv } = parseGlobalOptions(rawArgv);

let depth = "standard";
let autoresearch = false;
const tail = [];
let i = 0;
while (i < argv.length) {
  const a = argv[i];
  if (a === "--quick") {
    depth = "quick";
    i++;
    continue;
  }
  if (a === "--standard") {
    depth = "standard";
    i++;
    continue;
  }
  if (a === "--deep") {
    depth = "deep";
    i++;
    continue;
  }
  if (a === "--autoresearch") {
    autoresearch = true;
    i++;
    continue;
  }
  if (a === "--") {
    tail.push(...argv.slice(i + 1));
    break;
  }
  tail.push(a);
  i++;
}

const idea = tail.join(" ").trim();
if (!idea) usage();

const skillPath = join(getPackageRoot(), ".cursor", "skills", "deep-interview", "SKILL.md");
if (!existsSync(skillPath)) {
  console.error(`oh-my-cursor: missing deep-interview skill:\n  ${skillPath}`);
  process.exit(1);
}

const skillBody = readFileSync(skillPath, "utf8");
const { cwd, agentsDir } = resolveProjectLayout({ explicitWorkspace: workspaceOpt });
const analystPath = join(agentsDir, "analyst.md");
if (!existsSync(analystPath)) {
  console.error(`oh-my-cursor: missing analyst role:\n  ${analystPath}`);
  process.exit(1);
}
const analystBody = readFileSync(analystPath, "utf8");

const flagBits = [depth !== "standard" ? `--${depth}` : null, autoresearch ? "--autoresearch" : null].filter(
  Boolean,
);
const argumentsLine = flagBits.length ? `${flagBits.join(" ")} ${idea}` : idea;

const prompt = `${analystBody}

---

## Deep interview (oh-my-cursor)

Execute the following **deep-interview** skill end-to-end. Use \`.oh-my-cursor/state/\` and \`.oh-my-cursor/specs/\` for persistence. In the skill text, treat \`{{ARGUMENTS}}\` as:

${argumentsLine}

${skillBody}

---

## Invocation summary

- **Depth:** ${depth}
- **Autoresearch lane:** ${autoresearch ? "yes — follow Autoresearch_Mode in the skill; this package has no `omc autoresearch` CLI, so output a concrete command line or steps for the user to run separately." : "no"}
- **User idea:** ${idea}
`;

process.exit(runCursorAgent({ cwd, prompt, force: true }));
