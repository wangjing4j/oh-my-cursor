# oh-my-cursor

Teams-first style **multi-agent prompts** and **Cursor CLI** orchestration, inspired by [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode). Agent markdown files are vendored from that project (MIT) — see `NOTICE`.

## Prerequisites

- [Cursor CLI](https://cursor.com/docs/cli/installation) — the `agent` command must be on your `PATH`, or set **`OH_MY_CURSOR_AGENT`** (or **`CURSOR_AGENT_BIN`**) to the full path of `agent.exe` / `agent`.
- On **Windows**, oh-my-cursor **prefers** `%LOCALAPPDATA%\\cursor-agent\\versions\\<ver>\\node.exe` + `index.js` with `shell:false` so the **full multiline prompt** reaches the CLI (going through `agent.cmd` / cmd.exe often truncates it so the model only sees the wrapper line). If you set **`OH_MY_CURSOR_AGENT`** / **`CURSOR_AGENT_BIN`**, that override is used instead (may hit truncation with `.cmd`). If `agent` is missing from PATH, the older `.cmd` / `where` / PowerShell fallbacks still apply when no bundled `versions/` layout exists.
- Node.js 18+
- For scripted runs: set `CURSOR_API_KEY` (see [headless docs](https://cursor.com/docs/cli/headless))

## Install / use this repo

Clone or copy the repo, then from the repository root:

```bash
npm install   # optional; no dependencies required for scripts
```

### Command-line tool `oh-my-cursor`

Link globally for a shell command (development):

```bash
npm link
oh-my-cursor help
```

Or run via npx from the package directory / registry (if published):

```bash
npx oh-my-cursor help
```

Global options (`--workspace` / `-w` may appear **before or after** the subcommand; last flag wins):

- `--workspace <path>` / `-w <path>` — **project root** for code and `.oh-my-cursor/` (path relative to your current directory unless absolute). Overrides `OH_MY_CURSOR_ROOT` for that invocation. The folder does **not** need its own `agents/`; if missing, bundled role prompts from this package are used (with a short warning).
- `OH_MY_CURSOR_ROOT` — same as `--workspace`, if unset via flag.

Team task form: `N:role "task"` or `N:role task` (quotes optional). Example:

`oh-my-cursor team 1:executor "增加about us功能" --workspace C:\\path\\to\\app`

If you do not pass `--workspace`, **Cursor’s workspace is your current working directory** (`process.cwd()`). Role prompts use the nearest `agents/` folder **above** cwd, or the **bundled** prompts from this package (with a warning). Previously, cwd could jump to a parent that contained `agents/` or to the package root — that made `oh-my-cursor agent …` edit **this repo** when run from inside a clone. Now: **`cd` into the project you want to change**, then run `oh-my-cursor agent …`, or pass `-w path\\to\\that\\project`.

Subcommands:

| Command | Meaning |
|---------|---------|
| `oh-my-cursor agent ...` | Same as `node scripts/run-agent.mjs ...` |
| `oh-my-cursor team ...` | Same as `node scripts/run-team.mjs ...` |
| `oh-my-cursor interview ...` | Same as `node scripts/run-interview.mjs ...` (deep-interview skill + analyst) |
| `oh-my-cursor about` | Project description, credits (oh-my-claudecode), and license |
| `oh-my-cursor help` | Usage |

## Single agent

```bash
oh-my-cursor agent executor -- "Implement feature X"
node scripts/run-agent.mjs executor -- "Implement feature X"
npm run agent -- planner --no-force --mode plan -- "Plan migration Y"
```

## Deep interview (`/deep-interview`)

In [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode), **`/deep-interview`** is a Claude Code plugin skill. Here the same procedure is **`.cursor/skills/deep-interview/SKILL.md`** (use it from Cursor chat like any Agent Skill) and **`oh-my-cursor interview`** for the CLI (runs **analyst** with that skill inlined).

```bash
oh-my-cursor interview -- -- "Vague idea or product you want clarified before building"
node scripts/run-interview.mjs --standard -- -- "Same via node"
npm run interview -- -- "Same via npm"
```

Before `--`, optional flags: **`--quick`**, **`--standard`** (default), **`--deep`**, **`--autoresearch`**. Specs and interview state go under **`.oh-my-cursor/specs/`** and **`.oh-my-cursor/state/`**. For a long Socratic back-and-forth, prefer the **editor** with the skill; a single CLI invocation is one model run (see skill for resume via state file).

### Using interview outputs

| Path | What it is |
|------|------------|
| `.oh-my-cursor/specs/deep-interview-{slug}.md` | **Primary deliverable** — the clarified spec (handoff target in the skill). Use this for planning and implementation. |
| `.oh-my-cursor/state/deep-interview-state.json` | **Resume state** (if written). Use for continuing an interview in the editor or another CLI run. |
| `.oh-my-cursor/prompts/headless-prompt-*.md` | **Transport only** — when the full CLI prompt is too long for Windows, [`scripts/lib/run-cursor-agent.mjs`](scripts/lib/run-cursor-agent.mjs) writes it here. **Not** the spec you hand off; rely on `specs/` when present. |

**Next steps (pick one):**

1. **Implement directly** — treat the spec as the PRD:

   `oh-my-cursor agent executor -- "Implement per .oh-my-cursor/specs/deep-interview-<slug>.md; list changes before editing code."`

2. **Team pipeline** — put the spec path in the task so every phase shares the same source of truth:

   `oh-my-cursor team '3:executor "Implement to satisfy .oh-my-cursor/specs/deep-interview-<slug>.md"'`

3. **Plan / review first** — there is no `omc-plan` / `autopilot` plugin here; chain roles manually, e.g.:

   `oh-my-cursor agent planner --no-force --mode plan -- "Read .oh-my-cursor/specs/deep-interview-<slug>.md and output tasks and risks."`  
   `oh-my-cursor agent architect --no-force --mode plan -- "From that spec, propose module boundaries and a technical approach."`  
   `oh-my-cursor agent critic --no-force --mode plan -- "Challenge unclear assumptions in the spec or design."`

4. **In the Cursor editor** — `@`-mention the `deep-interview-*.md` file (or paste excerpts) and ask for implementation, review, or tests.

**Caveats:** A single headless `interview` run is one model turn; a full multi-round interview works best with the skill in chat. If the spec is missing or thin, run `interview` again or edit `specs/` by hand. Do not use `headless-prompt-*.md` as the handoff document — use **`specs/deep-interview-*.md`**. For OMC `Skill("…")` bridges, see *Oh-my-claudecode vs oh-my-cursor* below.

## Team pipeline

Stages: `team-plan → team-prd → team-exec → team-verify → team-fix (if needed)`.

```bash
oh-my-cursor team '3:executor "fix all TypeScript errors in src/"'
node scripts/run-team.mjs '3:executor "fix all TypeScript errors in src/"'
npm run team -- '1:executor "add REST endpoint for users"'
```

Resume:

```bash
oh-my-cursor team resume
node scripts/run-team.mjs resume
```

Artifacts: `.oh-my-cursor/plans/` and `.oh-my-cursor/state/team.json`.

**Git (team-exec / team-fix):** In a git workspace, the agent is instructed to make **one commit per completed requirement-level task** in `team-tasklist.md` (a top-level deliverable, or a parent requirement once all nested checkboxes under it are done — see `team-plan` structure), using `git log` for message style like `git-master`. No `git push` unless your task says so. **team-verify** commits **`verification.md`** only. **`.oh-my-cursor/state/team.json`** is rewritten by the CLI between phases — it often stays unstaged; add `.oh-my-cursor/state/` to `.gitignore` if you do not want to track it. To turn this commit cadence off: **`oh-my-cursor team --no-commit …`** or **`OH_MY_CURSOR_TEAM_NO_COMMIT=1`**. The flag is stored in `team.json` so **`team resume`** keeps the same policy.

## Cursor editor

Rules in `.cursor/rules/omc-cursor.mdc` apply automatically. Agent Skills under `.cursor/skills/` include **team** and **deep-interview**. The CLI also loads `AGENTS.md` and `.cursor/rules` when run from this root.

## Oh-my-claudecode vs oh-my-cursor

| OMC (Claude Code plugins) | oh-my-cursor |
|---------------------------|--------------|
| Slash commands such as `/deep-interview` | **deep-interview:** `.cursor/skills/deep-interview/SKILL.md` + `oh-my-cursor interview` |
| `omc-plan`, consensus planner loop | Use **`oh-my-cursor team`** or **`oh-my-cursor agent planner` / `architect` / `critic`** manually; not a separate plugin |
| `autopilot`, `ralph` | **Not ported** — use Team / single roles or upstream OMC |
| `omc autoresearch` | **Not ported** — skill’s autoresearch lane documents handoff only |
| `.omc/` state and plans | **`.oh-my-cursor/`** |

## Parallelism

The `N:` prefix is reserved for future multi-invocation execution. **v1 runs one `agent` process per phase** to reduce merge conflicts. For parallel work, split tasks by directory or use Cursor CLI `--worktree` (see Cursor documentation).

## Troubleshooting

### `spawnSync … ENAMETOOLONG` (Windows)

The Cursor CLI receives the task as a **command-line argument**. Prompts longer than the OS limit (common with **`oh-my-cursor interview`**, which inlines the full deep-interview skill) used to fail with **`ENAMETOOLONG`**. Current **`run-cursor-agent.mjs`** automatically writes oversized prompts to **`.oh-my-cursor/prompts/headless-prompt-*.md`** under your workspace and passes a **short** `-p` message that tells the agent to read that file. If you still see this error, upgrade this repo or shorten the task.

### `Connection lost, reconnecting…` / `certificate has expired`

That message comes from **Cursor CLI** talking to Cursor’s servers, not from the `oh-my-cursor` scripts. Typical causes:

| Check | What to do |
|-------|------------|
| **System time** | Wrong date/time or timezone makes TLS look “expired”. Fix the clock, then retry. |
| **Corporate proxy / SSL inspection** | Antivirus or a proxy may replace certificates. Install your org’s root CA, or try from a network without inspection. |
| **VPN / firewall** | Temporarily rule out blocking or MITM. |
| **Stale CLI** | Run `agent update` (or reinstall with the [official install](https://cursor.com/docs/cli/installation)). |
| **Auth** | Ensure you are logged in / `CURSOR_API_KEY` is valid per [headless docs](https://cursor.com/docs/cli/headless). |

oh-my-cursor does not control TLS; if the error persists, use Cursor **Help** / [forum](https://forum.cursor.com) with the full log line.

## License

MIT — see `LICENSE`. Vendored agent prompts: see `NOTICE`.
