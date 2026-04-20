# Security policy

## Supported versions

We address security issues in the **latest release** (and `main` when practical).
This package has **no runtime npm dependencies**; keep your **Node.js** and
**Cursor CLI** installs patched per their vendors.

## Reporting a vulnerability

**Please do not** open a public GitHub issue for undisclosed security problems.

Instead:

1. Use [GitHub private vulnerability reporting](https://github.com/wangjing4j/oh-my-cursor/security/advisories/new) for this repository (if enabled for the org/repo), **or**
2. Open a **draft** security advisory or contact repository maintainers through a private channel they publish on the repo or profile.

Include steps to reproduce, affected versions or commits, and impact assessment
when you can.

## Scope

`oh-my-cursor` orchestrates local processes (`agent` / Cursor CLI) and writes
files under `.oh-my-cursor/` in the workspace you choose. Reports about **Cursor
CLI itself**, **Cursor account / API key handling**, or **TLS to Cursor
servers** should go to [Cursor](https://cursor.com/) support or forums as
appropriate; we can still document mitigations in this repo when relevant.

## Secrets

Never commit `CURSOR_API_KEY`, personal tokens, or workspace-specific secrets.
The repository `.gitignore` excludes common env files; double-check `git diff`
before pushing.
