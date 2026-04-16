import { dirname, join, resolve } from "node:path";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Directory containing package.json, agents/, scripts/ (this npm package root).
 */
export function getPackageRoot() {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..");
}

/**
 * Find agents/ by walking upward from startDir (inclusive). For role prompts only.
 */
function findAgentsDirUpward(startDir) {
  let dir = resolve(startDir);
  for (;;) {
    const localAgents = join(dir, "agents");
    if (existsSync(localAgents)) {
      return localAgents;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
}

/**
 * Resolve where Cursor runs (cwd) vs where role markdown lives (agentsDir).
 *
 * - **cwd** (Cursor workspace): always **`process.cwd()`** when no `--workspace`, so edits land
 *   in the directory you ran the command from — not the oh-my-cursor repo you happened to have
 *   cloned. Use `-w` / `OH_MY_CURSOR_ROOT` to point at another project explicitly.
 * - **agentsDir**: nearest `agents/` walking up from **cwd**; else bundled package `agents/`.
 *
 * @param {{ explicitWorkspace?: string | undefined }} opts
 * @returns {{ cwd: string, agentsDir: string }}
 */
export function resolveProjectLayout(opts = {}) {
  const fromEnv = process.env.OH_MY_CURSOR_ROOT;
  const explicit =
    opts.explicitWorkspace !== undefined && opts.explicitWorkspace !== ""
      ? opts.explicitWorkspace
      : fromEnv && fromEnv !== ""
        ? fromEnv
        : undefined;

  const pkgRoot = getPackageRoot();
  const bundledAgents = join(pkgRoot, "agents");

  if (explicit) {
    const cwd = resolve(process.cwd(), explicit);
    if (!existsSync(cwd) || !statSync(cwd).isDirectory()) {
      console.error(`oh-my-cursor: --workspace / OH_MY_CURSOR_ROOT is not a directory:\n  ${cwd}`);
      process.exit(1);
    }
    const localAgents = join(cwd, "agents");
    if (existsSync(localAgents)) {
      return { cwd, agentsDir: localAgents };
    }
    if (existsSync(bundledAgents)) {
      console.warn(
        `oh-my-cursor: workspace has no agents/; using bundled role prompts from:\n  ${bundledAgents}`,
      );
      return { cwd, agentsDir: bundledAgents };
    }
    console.error(
      `oh-my-cursor: no agents/ under workspace and no bundled agents:\n  workspace: ${cwd}`,
    );
    process.exit(1);
  }

  const cwd = resolve(process.cwd());
  const upward = findAgentsDirUpward(cwd);
  if (upward) {
    return { cwd, agentsDir: upward };
  }

  if (existsSync(bundledAgents)) {
    console.warn(
      `oh-my-cursor: no agents/ above cwd; using bundled role prompts from:\n  ${bundledAgents}\n` +
        `  Cursor workspace (cwd) is still: ${cwd}`,
    );
    return { cwd, agentsDir: bundledAgents };
  }

  console.error(
    "oh-my-cursor: could not find agents/ and no bundled agents in this package.\n" +
      "  Install oh-my-cursor from a full checkout or set --workspace to a project that has agents/.",
  );
  process.exit(1);
}

/** @deprecated Prefer resolveProjectLayout; returns cwd only. */
export function resolveProjectRoot(opts = {}) {
  return resolveProjectLayout(opts).cwd;
}
