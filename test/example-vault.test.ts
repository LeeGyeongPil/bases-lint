import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lintPaths } from "../src/files.js";
import { ROOT, runCli } from "./helpers.js";

describe("AC-9 example vault", () => {
  it("broken.base gets diagnostics, tasks.base and dashboard.md get none, in under 2 seconds", async () => {
    const started = Date.now();
    const run = await runCli(["examples/vault", "--lang", "en"]);
    const elapsed = Date.now() - started;
    expect(run.code).toBe(1);
    expect(run.out).toContain("examples/vault/broken.base:");
    expect(run.out).toContain("problems (");
    expect(run.out).not.toContain("examples/vault/tasks.base");
    expect(run.out).not.toContain("examples/vault/dashboard.md");
    expect(elapsed).toBeLessThan(2000);
  });

  it("covers the headline rules that the README shows", async () => {
    const r = await lintPaths(["examples/vault"], { cwd: ROOT });
    const rules = new Set(r.diagnostics.map((d) => d.rule));
    for (const rule of [
      "expr-parse",
      "mixed-type",
      "type-mismatch",
      "empty-list-item",
      "unknown-method",
      "unknown-function",
      "unknown-property",
      "formula-cycle",
      "sort-string",
      "sort-not-in-order",
    ]) {
      expect(rules.has(rule), rule).toBe(true);
    }
    expect(r.diagnostics.every((d) => d.file === "examples/vault/broken.base")).toBe(true);
    expect(join(r.vaults[0] ?? "")).toBe(join(ROOT, "examples", "vault"));
  });
});
