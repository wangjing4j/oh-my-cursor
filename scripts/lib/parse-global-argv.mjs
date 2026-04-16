/**
 * Remove --workspace / -w <path> from anywhere in argv (last wins).
 * Used so flags can appear before or after subcommands, e.g.
 *   oh-my-cursor team 1:executor "task" --workspace C:\app
 */
export function parseGlobalOptions(argv) {
  let workspace;
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if ((a === "--workspace" || a === "-w") && argv[i + 1]) {
      workspace = argv[i + 1];
      i++;
      continue;
    }
    out.push(a);
  }
  return { workspace, argv: out };
}
