import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Default install layout on Windows (see Cursor CLI installer).
 */
function windowsBundledAgentCmd() {
  const local = process.env.LOCALAPPDATA;
  if (!local) {
    return null;
  }
  const cmdPath = join(local, "cursor-agent", "agent.cmd");
  return existsSync(cmdPath) ? cmdPath : null;
}

/**
 * Cursor ships `node.exe` + `index.js` under versions/<YYYY.M.D-hash>/.
 * Spawning that with shell:false passes the full prompt as one argv (no cmd.exe mangling).
 * agent.cmd → PowerShell → node loses/truncates large multiline prompts on Windows.
 */
function versionDirScore(name) {
  const m = name.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})-([a-f0-9]+)$/i);
  if (!m) {
    return -1;
  }
  const y = m[1];
  const mo = m[2].padStart(2, "0");
  const d = m[3].padStart(2, "0");
  return parseInt(y + mo + d, 10);
}

function tryWindowsCursorAgentNodeBundle() {
  if (process.platform !== "win32") {
    return null;
  }
  const local = process.env.LOCALAPPDATA;
  if (!local) {
    return null;
  }
  const versionsRoot = join(local, "cursor-agent", "versions");
  if (!existsSync(versionsRoot)) {
    return null;
  }
  const candidates = readdirSync(versionsRoot)
    .filter((name) => versionDirScore(name) >= 0)
    .sort((a, b) => {
      const diff = versionDirScore(b) - versionDirScore(a);
      return diff !== 0 ? diff : b.localeCompare(a);
    });

  for (const name of candidates) {
    const nodePath = join(versionsRoot, name, "node.exe");
    const scriptPath = join(versionsRoot, name, "index.js");
    if (existsSync(nodePath) && existsSync(scriptPath)) {
      return { node: nodePath, script: scriptPath };
    }
  }
  return null;
}

/**
 * PowerShell often has `agent` on PATH even when cmd.exe / `where agent` does not.
 */
function resolveAgentViaPowerShell() {
  if (process.platform !== "win32") {
    return null;
  }
  const ps = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$c = Get-Command agent -ErrorAction SilentlyContinue; if ($c) { $c.Source }",
    ],
    { encoding: "utf8", windowsHide: true, timeout: 15000 },
  );
  if (ps.status !== 0 || !ps.stdout) {
    return null;
  }
  const line = ps.stdout.trim().split(/\r?\n/)[0]?.trim();
  return line && existsSync(line) ? line : line || null;
}

/**
 * Resolve Cursor CLI agent executable (wrapper script path or command name).
 * Not used when Windows direct node bundle runs (no env override).
 *
 * Priority:
 * 1. OH_MY_CURSOR_AGENT or CURSOR_AGENT_BIN
 * 2. Windows: %LOCALAPPDATA%\cursor-agent\agent.cmd if present
 * 3. Windows: `where agent` (cmd)
 * 4. Windows: PowerShell Get-Command agent (PATH as in PS)
 * 5. Unix: command -v agent
 * 6. Fallback: "agent"
 */
export function resolveAgentExecutable() {
  const fromEnv = (process.env.OH_MY_CURSOR_AGENT || process.env.CURSOR_AGENT_BIN || "").trim();
  if (fromEnv) {
    return fromEnv;
  }

  if (process.platform === "win32") {
    const bundled = windowsBundledAgentCmd();
    if (bundled) {
      return bundled;
    }

    const comspec = process.env.ComSpec || "cmd.exe";
    const w = spawnSync(comspec, ["/d", "/c", "where", "agent"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (w.status === 0 && w.stdout) {
      const first = w.stdout
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)[0];
      if (first) {
        return first;
      }
    }

    const viaPs = resolveAgentViaPowerShell();
    if (viaPs) {
      return viaPs;
    }
  } else {
    const sh = spawnSync("sh", ["-c", "command -v agent"], {
      encoding: "utf8",
    });
    if (sh.status === 0 && sh.stdout) {
      return sh.stdout.trim().split("\n")[0];
    }
  }

  return "agent";
}

function isLikelyFullPath(cmd) {
  if (process.platform === "win32") {
    return /^[a-zA-Z]:[\\/]/.test(cmd) || cmd.includes("\\") || cmd.startsWith("\\\\");
  }
  return cmd.startsWith("/") || cmd.includes("/");
}

/** Node on Windows cannot spawn .cmd/.bat directly with shell:false (EINVAL); use shell. */
function needsWindowsScriptShell(exe) {
  return process.platform === "win32" && /\.(cmd|bat|ps1)$/i.test(exe);
}

function printAgentMissingHelp() {
  const hint =
    process.platform === "win32"
      ? "\nWindows: default install is often %LOCALAPPDATA%\\cursor-agent\\agent.cmd (auto-detected when present).\n"
      : "\n";

  console.error(`
oh-my-cursor: Cursor CLI "agent" was not found.${hint}
Install: https://cursor.com/docs/cli/installation
  Windows (PowerShell):  irm 'https://cursor.com/install?win32=true' | iex

Then open a new terminal and run:  agent --version

If agent works in PowerShell but not here, set the full path:
  PowerShell:  $env:OH_MY_CURSOR_AGENT = "$env:LOCALAPPDATA\\cursor-agent\\agent.cmd"
  CMD:         set OH_MY_CURSOR_AGENT=%LOCALAPPDATA%\\cursor-agent\\agent.cmd

Alias: CURSOR_AGENT_BIN (same as OH_MY_CURSOR_AGENT).
`);
}

/**
 * Role markdown starts with YAML `---`; Cursor's `agent` CLI treats leading `-` tokens as flags.
 * With Windows shell:true, quoting can also expose `---` as a separate argv. Never pass a prompt
 * that begins (after whitespace) with `---`.
 */
export function wrapPromptForAgentCli(prompt) {
  if (/^\s*---/.test(prompt)) {
    return (
      "Below is one markdown document (role prompt + task). It is NOT CLI syntax. Execute it.\n\n" + prompt
    );
  }
  return prompt;
}

/**
 * Windows `CreateProcess` command lines are ~32K; huge `-p` bodies throw ENAMETOOLONG.
 * Write the full prompt under the workspace and pass a short pointer the agent can read.
 */
const SPILL_PROMPT_BYTE_THRESHOLD = 16000;

function spillPromptToWorkspaceFile(cwd, prompt) {
  const dir = join(cwd, ".oh-my-cursor", "prompts");
  mkdirSync(dir, { recursive: true });
  const id = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const rel = join(dir, `headless-prompt-${id}.md`);
  writeFileSync(rel, prompt, "utf8");
  const abs = resolve(rel);
  return (
    "Your complete task specification is in this markdown file. Read the entire file, then execute it fully " +
    "(including file writes and tools it describes). Open this path:\n\n" +
    abs +
    "\n\nThis message is only a pointer — the file is the real instructions."
  );
}

function promptForArgv(cwd, safePrompt) {
  if (Buffer.byteLength(safePrompt, "utf8") <= SPILL_PROMPT_BYTE_THRESHOLD) {
    return safePrompt;
  }
  return spillPromptToWorkspaceFile(cwd, safePrompt);
}

function spawnAgentProcess({ cwd, argv, exe, useShell }) {
  return spawnSync(exe, argv, {
    cwd,
    stdio: "inherit",
    shell: useShell,
    env: { ...process.env },
    windowsHide: true,
  });
}

/**
 * Invoke Cursor CLI `agent` in print mode from repo root (loads AGENTS.md + .cursor/rules).
 * @param {object} opts
 * @param {string} opts.cwd
 * @param {string} opts.prompt
 * @param {boolean} [opts.force]
 * @param {string} [opts.mode] ask | plan
 * @param {string} [opts.outputFormat] text | json | stream-json
 */
export function runCursorAgent({ cwd, prompt, force = true, mode, outputFormat }) {
  const safePrompt = wrapPromptForAgentCli(prompt);
  const argvPrompt = promptForArgv(cwd, safePrompt);
  const promptArgs = ["-p"];
  if (force) {
    promptArgs.push("--force");
  }
  if (mode) {
    promptArgs.push("--mode", mode);
  }
  if (outputFormat) {
    promptArgs.push("--output-format", outputFormat);
  }
  promptArgs.push(argvPrompt);

  const envOverride = (process.env.OH_MY_CURSOR_AGENT || process.env.CURSOR_AGENT_BIN || "").trim();
  const directNode = !envOverride ? tryWindowsCursorAgentNodeBundle() : null;

  let result;
  if (directNode) {
    result = spawnAgentProcess({
      cwd,
      exe: directNode.node,
      argv: [directNode.script, ...promptArgs],
      useShell: false,
    });
  } else {
    const exe = resolveAgentExecutable();
    const useShell = needsWindowsScriptShell(exe) || !isLikelyFullPath(exe);
    result = spawnAgentProcess({
      cwd,
      exe,
      argv: promptArgs,
      useShell,
    });
  }

  if (result.error) {
    if (result.error.code === "ENAMETOOLONG") {
      console.error(
        "oh-my-cursor: ENAMETOOLONG — the prompt exceeded the OS command-line limit.\n" +
          "  Update to a version that spills large prompts to .oh-my-cursor/prompts/, or shorten the task.\n",
      );
      console.error("(spawn failed)");
      process.exit(1);
    }
    console.error(result.error.message);
    if (result.error.code !== "ENOENT") {
      console.error("(spawn failed)");
    }
    printAgentMissingHelp();
    process.exit(1);
  }

  const status = result.status ?? 1;
  if (status === 9009) {
    printAgentMissingHelp();
    process.exit(1);
  }
  if (status === 127 && process.platform !== "win32") {
    printAgentMissingHelp();
    process.exit(1);
  }

  return status;
}
