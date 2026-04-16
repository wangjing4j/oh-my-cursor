---
name: team
description: >-
  oh-my-cursor Team mode — staged pipeline (plan, PRD, exec, verify, fix loop)
  using .oh-my-cursor/ artifacts. Prefer CLI scripts/run-team.mjs for execution.
---

# Team mode (oh-my-cursor)

## When to use

Multi-step work that needs a shared task list, explicit PRD/acceptance criteria, implementation, and verification with a fix loop.

## Canonical stages

`team-plan → team-prd → team-exec → team-verify → team-fix (loop) → complete`

## CLI (preferred)

From repo root:

```bash
node scripts/run-team.mjs '3:executor "your task in quotes"'
node scripts/run-team.mjs --no-commit '3:executor "task without per-item commits"'
node scripts/run-team.mjs resume
```

## Git (CLI Team mode)

When the workspace is a git repository, **team-exec** and **team-fix** prompts instruct the agent: **one `git commit` per completed requirement-level task** in `team-tasklist.md` (top-level deliverable, or parent block when all nested items under it are done), after detecting message style from `git log` (aligned with `agents/git-master.md`). **team-plan** should structure top-level `- [ ]` lines as deliverable requirements. **team-verify** commits **`verification.md`** only. Executor’s plan read-only rule is relaxed for `team-tasklist.md` updates during Team exec/fix. No `git push` unless the user's task explicitly requires it.

Disable that cadence: **`--no-commit`** on `run-team.mjs` / `oh-my-cursor team`, or **`OH_MY_CURSOR_TEAM_NO_COMMIT=1`**. The choice is stored in `team.json` so **`resume`** stays consistent.

## Artifacts (must match CLI)

| Stage | Output |
|--------|--------|
| team-plan | `.oh-my-cursor/plans/team-tasklist.md` |
| team-prd | `.oh-my-cursor/plans/prd-<team-name>.md` |
| team-verify | `.oh-my-cursor/plans/verification.md` — **first line** `STATUS: PASS` or `STATUS: FAIL` |
| state | `.oh-my-cursor/state/team.json` |

## IDE-only execution

If the user cannot run CLI, replicate the same stages in order: read/write those files, adopt `agents/<role>.md` for **team-exec** and **team-fix** (role from user or default `executor`), use `agents/planner.md` mindset for plan/PRD phases and `agents/verifier.md` for verification.

## Constraints

- Prefer sequential implementation unless tasks are clearly file-disjoint.
- Do not edit PRD/task list semantics during exec except checking off tasks where appropriate.
- In git repos, default **one commit per completed requirement-level task** during exec/fix (unless `--no-commit` / env disabled the policy).
