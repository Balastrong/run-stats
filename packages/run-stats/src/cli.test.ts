import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("prints help and exits successfully when no command is provided", () => {
  const cliPath = fileURLToPath(new URL("./cli.ts", import.meta.url));
  const result = spawnSync(process.execPath, [cliPath], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^Usage: run-stats \[options\] \[command\]/);
  assert.match(result.stdout, /bulk \[count\]/);
});
