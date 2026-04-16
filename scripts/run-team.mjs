#!/usr/bin/env node
/**
 * Team pipeline: team-plan → team-prd → team-exec → team-verify → (team-fix loop)
 * Drives Cursor CLI `agent` once per phase; state in .oh-my-cursor/state/team.json
 *
 * Usage (OMC-style):
 *   node scripts/run-team.mjs [--workspace <path>] '3:executor "fix all TypeScript errors"'
 *
 * Resume:
 *   node scripts/run-team.mjs [--workspace <path>] resume
 *
 * Per-requirement git commits (team-exec / team-fix): disabled with --no-commit or OH_MY_CURSOR_TEAM_NO_COMMIT=1.
 *
 * Note: `3:` is the worker width hint; v1 runs exec phase as one agent call (sequential/safe).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { resolveProjectLayout } from "./lib/repo-root.mjs";
import { parseGlobalOptions } from "./lib/parse-global-argv.mjs";
import { runCursorAgent } from "./lib/run-cursor-agent.mjs";

function usage() {
  console.error(`Usage:
  node scripts/run-team.mjs [--workspace <path>] [--no-commit] 'N:role "your task"'
  node scripts/run-team.mjs [--workspace <path>] resume

  --no-commit   Do not instruct per-requirement git commits (also: OH_MY_CURSOR_TEAM_NO_COMMIT=1)

Example:
  node scripts/run-team.mjs '3:executor "fix all TypeScript errors in src/"'`);
  process.exit(1);
}

function stripNoCommitFlag(argv) {
  let noCommit = false;
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--no-commit") {
      noCommit = true;
      continue;
    }
    out.push(argv[i]);
  }
  return { argv: out, noCommit };
}

function envTeamNoCommit() {
  const v = (process.env.OH_MY_CURSOR_TEAM_NO_COMMIT || "").trim();
  return /^(1|true|yes)$/i.test(v);
}

function gitPerTaskPolicyBlock({ noPerTaskCommit, tasklist }) {
  if (noPerTaskCommit) {
    return `

## Git (this run)
Per-requirement commits are **disabled** (\`--no-commit\` or \`OH_MY_CURSOR_TEAM_NO_COMMIT\`). Implement as usual; do not add commits solely to satisfy a per-requirement cadence unless the user's original task explicitly asks for git commits.
`;
  }
  return `

## Git — one commit per completed requirement-level task
**Precedence:** This section overrides any generic "plans are read-only" rule in your role for **task list updates** in \`${tasklist}\` only.

A **requirement-level task** is one user-deliverable unit (one described feature or requirement), not every tiny sub-step.

**Commit timing:**
- **Flat list** (only top-level \`- [ ]\` lines): when a line's scope is **fully** implemented, check that box, then **one** \`git add\` (only files for that requirement + task list) and **one** \`git commit\`.
- **Nested checkboxes** (children under a parent \`- [ ]\`): you may check off children as you go; run **one** commit only after **all** child checkboxes under that parent requirement are done — include all related files and the task list updates in that single commit.
- **Only nested** items with no parent requirement row: treat each **top-level** \`- [ ]\` as its own requirement (same as flat).

Work in this workspace (repository root). If \`git rev-parse --is-inside-work-tree\` succeeds, commits are **mandatory** for implemented work — do not end this phase with only unstaged product changes.

1. Inspect commit message style first: \`git log -30 --pretty=format:"%s"\` — match language and format (semantic \`feat:\`/\`fix:\` vs plain vs short), same spirit as **git-master**.
2. After each **requirement-level** completion per the rules above: \`git add\` only paths for that requirement, include \`${tasklist}\` edits in the same commit, then \`git commit -m "…"\`. Do not mix unrelated requirements in one commit.
3. If you finish all requirements, show \`git log -5 --oneline\` as evidence. Do **not** \`git push\` unless the user's original task explicitly requires it. Do **not** rebase \`main\` or \`master\`.
4. Do **not** commit \`.oh-my-cursor/state/team.json\` — it is updated by the host between phases and may stay dirty; ignore it for \`git add\`.

If this directory is **not** a git repository, skip commits and state that once in your summary.
`;
}

function gitVerifyPolicyBlock({ noPerTaskCommit, verification }) {
  if (noPerTaskCommit) {
    return `

## Git (verify phase)
Per-requirement commit policy is off; committing \`${verification}\` is optional.
`;
  }
  return `

## Git — commit verification file
If \`git rev-parse --is-inside-work-tree\` succeeds, after writing \`${verification}\` you **MUST** \`git add\` that file only and \`git commit\` with a message matching repo style (e.g. \`chore(team): verification results\` or plain equivalent). Do **not** commit \`.oh-my-cursor/state/team.json\`.
`;
}

function ensureDirs(root) {
  mkdirSync(join(root, ".oh-my-cursor", "state"), { recursive: true });
  mkdirSync(join(root, ".oh-my-cursor", "plans"), { recursive: true });
}

function parseStartArg(raw) {
  const s = raw.trim();
  const quoted = s.match(/^(\d+):(\w+)\s+"(.*)"\s*$/s);
  if (quoted) {
    return { agentCount: parseInt(quoted[1], 10), role: quoted[2], task: quoted[3] };
  }
  const loose = s.match(/^(\d+):(\w+)\s+([\s\S]+)$/);
  if (loose) {
    let task = loose[3].trim();
    if (task.length >= 2 && task.startsWith('"') && task.endsWith('"')) {
      task = task.slice(1, -1);
    }
    return { agentCount: parseInt(loose[1], 10), role: loose[2], task };
  }
  return null;
}

function teamNameSlug() {
  const d = new Date();
  return `team-${d.toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
}

function statePath(root) {
  return join(root, ".oh-my-cursor", "state", "team.json");
}

function paths(root, teamName) {
  return {
    state: statePath(root),
    tasklist: join(root, ".oh-my-cursor", "plans", "team-tasklist.md"),
    prd: join(root, ".oh-my-cursor", "plans", `prd-${teamName}.md`),
    verification: join(root, ".oh-my-cursor", "plans", "verification.md"),
  };
}

function readState(p) {
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function writeState(p, obj) {
  writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function verificationStatus(verificationPath) {
  if (!existsSync(verificationPath)) return "UNKNOWN";
  const text = readFileSync(verificationPath, "utf8");
  const line = text.split("\n").find((l) => l.startsWith("STATUS:"));
  if (!line) return "UNKNOWN";
  if (line.includes("FAIL")) return "FAIL";
  if (line.includes("PASS")) return "PASS";
  return "UNKNOWN";
}

function phasePrompt(phase, ctx) {
  const { task, tasklist, prd, verification, role, agentCount, noPerTaskCommit } = ctx;
  switch (phase) {
    case "team-plan":
      return `You are running the **team-plan** phase of oh-my-cursor Team mode.

User goal:
${task}

Create or overwrite the shared task list at:
${tasklist}

Requirements for the file:
- Markdown with checkboxes for actionable tasks (dependencies noted).
- Prefer **one top-level** \`- [ ]\` **per deliverable requirement** (user-facing unit of work). Put implementation sub-steps under it as **nested** \`- [ ]\` or indented bullets so **team-exec** can use **one git commit per completed top-level requirement** (nested children finished together before committing).
- Include a short "Definition of done" section.
- Do not implement code in this phase; only plan and write this file.

After saving, reply with a one-line summary.`;

    case "team-prd":
      return `You are running the **team-prd** phase of oh-my-cursor Team mode.

Read:
${tasklist}

Write a PRD to:
${prd}

Include: scope, non-goals, acceptance criteria, and risks. Reference tasks from the task list.

Do not implement product code in this phase.`;

    case "team-exec":
      return `${ctx.roleBody || ""}

---

You are running the **team-exec** phase of oh-my-cursor Team mode.

Worker width hint: ${agentCount} (orchestrator runs one CLI agent per phase in v1 — treat tasks sequentially to avoid file conflicts).

Read:
- ${tasklist}
- ${prd}

Implement the work: check off tasks in the task list as you complete them (group commits by **requirement-level** tasks per the Git section), keep edits minimal and tested.
Original user task: ${task}${gitPerTaskPolicyBlock({ noPerTaskCommit, tasklist })}`;

    case "team-verify":
      return `You are running the **team-verify** phase of oh-my-cursor Team mode.

Read:
- ${tasklist}
- ${prd}

Run appropriate checks (tests, lint, typecheck — whatever the repo uses). Write results to:
${verification}

The file MUST start with a line exactly one of:
STATUS: PASS
STATUS: FAIL

Then summarize evidence (commands run, key output).${gitVerifyPolicyBlock({ noPerTaskCommit, verification })}`;

    case "team-fix":
      return `${ctx.roleBody || ""}

---

You are running the **team-fix** phase of oh-my-cursor Team mode.

Read:
- ${verification}
- ${tasklist}
- ${prd}

Fix failing areas. Re-run or suggest re-run of verification after fixes. Update task list if needed.
Original task: ${task}${gitPerTaskPolicyBlock({ noPerTaskCommit, tasklist })}`;

    default:
      return "";
  }
}

function runPhase(cwd, phase, ctx) {
  const prompt = phasePrompt(phase, ctx);
  if (!prompt) return 1;
  const mode =
    phase === "team-plan" || phase === "team-prd"
      ? "plan"
      : phase === "team-verify"
        ? undefined
        : undefined;
  const force = phase !== "team-plan" && phase !== "team-prd";
  return runCursorAgent({ cwd, prompt, force: force === true, mode });
}

const rawArgv = process.argv.slice(2);
const { workspace: workspaceOpt, argv: afterWs } = parseGlobalOptions(rawArgv);
const { argv: afterFlags, noCommit: noCommitCli } = stripNoCommitFlag(afterWs);
const teamArgv = afterFlags[0] === "--" ? afterFlags.slice(1) : afterFlags;
const { cwd, agentsDir } = resolveProjectLayout({ explicitWorkspace: workspaceOpt });
ensureDirs(cwd);

const arg = teamArgv.join(" ").trim();
if (!arg) usage();

const noPerTaskCommitFromEnv = envTeamNoCommit();

let state;
let p;

if (arg === "resume") {
  state = readState(statePath(cwd));
  if (!state || !state.active) {
    console.error("No active team run in .oh-my-cursor/state/team.json");
    process.exit(1);
  }
  p = paths(cwd, state.team_name);
} else {
  const parsed = parseStartArg(arg);
  if (!parsed) {
    console.error('Could not parse. Expected: N:role "task" or N:role task...');
    usage();
  }
  const teamName = teamNameSlug();
  p = paths(cwd, teamName);
  const noPerTaskCommit = noPerTaskCommitFromEnv || noCommitCli;
  state = {
    active: true,
    current_phase: "team-plan",
    agent_count: parsed.agentCount,
    team_name: teamName,
    primary_role: parsed.role,
    task: parsed.task,
    fix_attempts: 0,
    max_fix_attempts: 5,
    started_at: new Date().toISOString(),
    completed_at: null,
    no_per_task_commit: noPerTaskCommit,
  };
  if (!existsSync(join(agentsDir, `${parsed.role}.md`))) {
    console.error(`Unknown role "${parsed.role}": missing ${join(agentsDir, `${parsed.role}.md`)}`);
    process.exit(1);
  }
  writeState(p.state, state);
}

let roleBody = "";
const rolePath = join(agentsDir, `${state.primary_role}.md`);
if (existsSync(rolePath)) {
  roleBody = readFileSync(rolePath, "utf8");
}

const ctx = {
  task: state.task,
  tasklist: p.tasklist,
  prd: p.prd,
  verification: p.verification,
  role: state.primary_role,
  agentCount: state.agent_count,
  roleBody,
  noPerTaskCommit: state.no_per_task_commit === true,
};

/** @type {string} */
let phase = state.current_phase;

while (phase !== "complete" && phase !== "failed" && phase !== "cancelled") {
  console.error(`\n--- Team phase: ${phase} ---\n`);
  const code = runPhase(cwd, phase, ctx);
  if (code !== 0) {
    state.current_phase = "failed";
    state.active = false;
    state.completed_at = new Date().toISOString();
    writeState(paths(cwd, state.team_name).state, state);
    process.exit(code ?? 1);
  }

  if (phase === "team-plan") {
    phase = "team-prd";
  } else if (phase === "team-prd") {
    phase = "team-exec";
  } else if (phase === "team-exec") {
    phase = "team-verify";
  } else if (phase === "team-verify") {
    const st = verificationStatus(p.verification);
    if (st === "FAIL" && state.fix_attempts < state.max_fix_attempts) {
      state.fix_attempts += 1;
      phase = "team-fix";
    } else {
      phase = "complete";
    }
  } else if (phase === "team-fix") {
    phase = "team-verify";
  } else {
    phase = "failed";
  }

  state.current_phase = phase;
  writeState(paths(cwd, state.team_name).state, state);
}

state.active = false;
state.completed_at = new Date().toISOString();
writeState(paths(cwd, state.team_name).state, state);

if (phase === "complete") {
  console.error("\nTeam run finished: complete\n");
  process.exit(0);
}
console.error(`\nTeam run ended: ${phase}\n`);
process.exit(phase === "failed" ? 1 : 0);
