import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "tests");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".test.mjs"))
  .map((f) => join(dir, f));

if (!files.length) {
  console.error("run-tests: no *.test.mjs files under tests/");
  process.exit(1);
}

const r = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
  cwd: root,
});
process.exit(r.status ?? 1);
