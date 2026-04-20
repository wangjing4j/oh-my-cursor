# Contributing to oh-my-cursor

Thank you for helping improve this project. This repository is a community tool
around the [Cursor CLI](https://cursor.com/docs/cli/installation); it is **not**
an official Cursor product.

## How to contribute

1. **Issues first (when in doubt)** — Open a [GitHub issue](https://github.com/wangjing4j/oh-my-cursor/issues) to describe the bug, doc gap, or feature so maintainers can agree on direction.
2. **Small, focused PRs** — One logical change per pull request when possible; include context in the description and link related issues.
3. **Match existing style** — Follow patterns in nearby scripts (ESM, `node:` imports, minimal dependencies).
4. **Verify locally** — Before opening a PR:

   ```bash
   npm ci
   npm test
   npm run check
   ```

## Agent prompts (`agents/`)

Files under `agents/` are **vendored** from [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) (MIT). Prefer upstreaming generic prompt improvements there when appropriate; use this repo for Cursor-specific paths (`.oh-my-cursor/`), CLI behavior, and packaging.

## Code of conduct

All participants are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Please read [SECURITY.md](SECURITY.md) for how to report vulnerabilities.
