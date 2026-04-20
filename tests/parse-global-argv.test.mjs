import test from "node:test";
import assert from "node:assert/strict";
import { parseGlobalOptions } from "../scripts/lib/parse-global-argv.mjs";

test("parseGlobalOptions leaves argv unchanged when no workspace flags", () => {
  const argv = ["team", "1:executor", "task"];
  const { workspace, argv: out } = parseGlobalOptions(argv);
  assert.equal(workspace, undefined);
  assert.deepEqual(out, argv);
});

test("parseGlobalOptions strips --workspace and its value (last wins)", () => {
  const { workspace, argv: out } = parseGlobalOptions([
    "--workspace",
    "first",
    "agent",
    "executor",
    "--",
    "x",
    "-w",
    "last",
  ]);
  assert.equal(workspace, "last");
  assert.deepEqual(out, ["agent", "executor", "--", "x"]);
});

test("parseGlobalOptions accepts -w alias", () => {
  const { workspace, argv: out } = parseGlobalOptions(["-w", "/tmp/app", "help"]);
  assert.equal(workspace, "/tmp/app");
  assert.deepEqual(out, ["help"]);
});

test("parseGlobalOptions ignores trailing -w without value", () => {
  const { workspace, argv: out } = parseGlobalOptions(["agent", "-w"]);
  assert.equal(workspace, undefined);
  assert.deepEqual(out, ["agent", "-w"]);
});
