# oh-my-cursor — Multi-agent orchestration (Cursor CLI)

This project ports **role prompts** from [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) (MIT) and adds **Cursor CLI** runners. The Cursor `agent` command loads this file and `.cursor/rules` when run from the resolved project root.

**Recommended command:** `oh-my-cursor` (see `npm link` / global install in `README.md`). Equivalent: `node scripts/run-agent.mjs` and `node scripts/run-team.mjs`.

## Operating principles

- Prefer the smallest change that meets acceptance criteria; verify with tests or checks before claiming done.
- Specialized work uses prompts under `agents/<role>.md`.
- **Terminal entrypoints**: `oh-my-cursor agent` / `oh-my-cursor team` / `oh-my-cursor interview`, or `scripts/run-agent.mjs` / `scripts/run-team.mjs` / `scripts/run-interview.mjs` directly.
- Persistent artifacts live under `.oh-my-cursor/` (not `.omc/`).

## Project root resolution

`resolveProjectLayout` returns **cwd** (Cursor workspace for edits) and **agentsDir** (role markdown folder).

1. **`--workspace` / `-w` / `OH_MY_CURSOR_ROOT`**: **cwd** is that directory (must exist). If it has no `agents/`, prompts come from the bundled package (warning). Flags may appear anywhere in argv (CLI strips them first).
2. **Otherwise**: **cwd is always `process.cwd()`** — the directory you ran the command from. Role files: walk **upward from cwd** for the nearest `agents/`; if none, use bundled prompts (warning). This avoids using the oh-my-cursor install directory as cwd when you run from your app folder without local `agents/`.

## Cursor CLI

- Install: [Cursor CLI installation](https://cursor.com/docs/cli/installation). The executable name is `agent`.
- **Windows**: Prefer `%LOCALAPPDATA%\\cursor-agent\\versions\\<ver>\\node.exe` + `index.js` (no shell) so long prompts are not truncated; set `OH_MY_CURSOR_AGENT` only if you need a custom install (may use `.cmd` and truncate). Otherwise `agent.cmd` / `where` / PowerShell resolution applies. On Unix, `command -v agent` when env is unset.
- Non-interactive runs: [Headless / print mode](https://cursor.com/docs/cli/headless) (`-p` / `--print`, `--force` for writes).
- Scripts need `CURSOR_API_KEY` in the environment for automation (see Cursor docs).
- Optional project overrides: `.cursor/cli.json` (merged with `~/.cursor/cli-config.json`).

## Agent catalog (files in `agents/`)

| Role | File | Typical use |
|------|------|-------------|
| analyst | `agents/analyst.md` | Requirements, acceptance criteria |
| architect | `agents/architect.md` | System design, boundaries |
| code-reviewer | `agents/code-reviewer.md` | Deep review (also closest to “style” review) |
| code-simplifier | `agents/code-simplifier.md` | Simplification |
| critic | `agents/critic.md` | Challenge plans/designs |
| debugger | `agents/debugger.md` | Root cause |
| designer | `agents/designer.md` | UX/UI |
| document-specialist | `agents/document-specialist.md` | Documentation |
| executor | `agents/executor.md` | Implementation |
| explore | `agents/explore.md` | Codebase exploration |
| git-master | `agents/git-master.md` | Git workflow |
| planner | `agents/planner.md` | Planning, task breakdown |
| qa-tester | `agents/qa-tester.md` | Runtime validation |
| scientist | `agents/scientist.md` | Data / experiments |
| security-reviewer | `agents/security-reviewer.md` | Security |
| test-engineer | `agents/test-engineer.md` | Tests |
| tracer | `agents/tracer.md` | Tracing |
| verifier | `agents/verifier.md` | Evidence of completion |
| writer | `agents/writer.md` | Technical writing |

Aliases not present as files: map `style-reviewer` / `api-reviewer` → `code-reviewer` unless you add new files.

**Stacks:** Role prompts assume you detect the project from files at the repo root (Node **`package.json`**, Java **`pom.xml`** / **Gradle**, Python **`pyproject.toml`**, etc.) and use that stack’s tests, build, and style tools — not every example is JavaScript-specific.

## Single-role runs

```bash
oh-my-cursor agent executor -- "Your task"
oh-my-cursor --workspace ../my-app agent planner --no-force --mode plan -- "Break down the auth refactor"

node scripts/run-agent.mjs executor -- "Your task"
```

npm: `npm run agent -- executor -- "Your task"`

## Team mode (staged pipeline)

Canonical stages (aligned with oh-my-claudecode):

`team-plan → team-prd → team-exec → team-verify → team-fix (loop) → complete`

- **team-plan**: writes `.oh-my-cursor/plans/team-tasklist.md`
- **team-prd**: writes `.oh-my-cursor/plans/prd-<team-name>.md`
- **team-exec**: implementation using `agents/<role>.md` for the role you pass
- **team-verify**: writes `.oh-my-cursor/plans/verification.md` with a required first line `STATUS: PASS` or `STATUS: FAIL`
- **team-fix**: on FAIL (and under max attempts), fixes and returns to verify
- **Git**: **team-exec** / **team-fix** default to **one `git commit` per completed requirement-level task** in `team-tasklist.md` (top-level `- [ ]` deliverable, or one commit after all nested items under a parent requirement are done); **team-verify** commits **`verification.md`** only. **team-plan** should use one top-level checkbox per deliverable when possible. **`agents/executor.md`** allows editing `team-tasklist.md` in Team exec/fix. **`.oh-my-cursor/state/team.json`** is updated by the Node driver — often left unstaged; gitignore `state/` if unwanted. Disable with **`--no-commit`** or **`OH_MY_CURSOR_TEAM_NO_COMMIT=1`** (stored in `team.json` for **resume**).

Start (OMC-style):

```bash
oh-my-cursor team '3:executor "fix all TypeScript errors in src/"'
node scripts/run-team.mjs '3:executor "fix all TypeScript errors in src/"'
```

npm: `npm run team -- '3:executor "your task"'`

### Deep interview

Socratic requirements interview (upstream **`/deep-interview`**): **`.cursor/skills/deep-interview/SKILL.md`**, or CLI **`oh-my-cursor interview [--quick|--standard|--deep] [--autoresearch] -- "<idea>"`**. Writes under `.oh-my-cursor/specs/` and `.oh-my-cursor/state/`. OMC-only follow-ons (`omc-plan` plugin, `autopilot`, `ralph`, `omc autoresearch`) are not bundled — use Team / `agent <role>` or upstream OMC. Full mapping: `README.md` → *Oh-my-claudecode vs oh-my-cursor*.

**After a spec exists:** handoff file is **`.oh-my-cursor/specs/deep-interview-*.md`** (not `prompts/headless-prompt-*.md`, which is only for long CLI prompts). Feed it to **`oh-my-cursor agent executor`**, **`oh-my-cursor team 'N:role "…"'`** (mention the path in the task), or **`agent planner` / `architect` / `critic`** in plan mode — see `README.md` → **Using interview outputs**.

Resume after interruption:

```bash
oh-my-cursor team resume
node scripts/run-team.mjs resume
```

The `N:` prefix is a **worker-width hint**; v1 runs **one** `agent` invocation per phase for safety (sequential edits). Increase parallelism only after splitting work across paths or using CLI worktrees (see Cursor `--worktree` docs).

## State and memory

| Path | Purpose |
|------|---------|
| `.oh-my-cursor/state/team.json` | Active Team run: phase, role, task, fix attempts, `no_per_task_commit` when set |
| `.oh-my-cursor/plans/` | Task list, PRD, verification |
| `.oh-my-cursor/specs/` | Deep-interview output specs (`deep-interview-*.md`) |
| `.oh-my-cursor/state/deep-interview-state.json` | Deep-interview resume state (when used) |
| `.oh-my-cursor/prompts/headless-prompt-*.md` | Large CLI prompts spilled to disk (avoids Windows `ENAMETOOLONG`) |

## IDE (Cursor editor)

- Rules: `.cursor/rules/omc-cursor.mdc`
- Skills: `.cursor/skills/team/SKILL.md` (Team / CLI parity), `.cursor/skills/deep-interview/SKILL.md` (Socratic interview)

## License

Project `LICENSE` is MIT. Agent prompts are vendored from oh-my-claudecode; see `NOTICE`.
