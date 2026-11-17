import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lintPaths } from "../src/files.js";
import { FIXTURES, VAULT, runCli } from "./helpers.js";

const at = (d: { line: number; column: number; rule: string; severity: string }): string =>
  `${d.line}:${d.column} ${d.rule} ${d.severity}`;

describe("AC-1 bad.base", () => {
  it("bad.base reports every problem in one run", async () => {
    const result = await lintPaths([join(FIXTURES, "bad.base")], { vaultDir: VAULT, cwd: FIXTURES });
    expect(result.diagnostics.map(at)).toEqual([
      "3:28 expr-parse error",
      "4:8 mixed-type warning",
      "4:15 type-mismatch warning",
      "5:8 empty-list-item warning",
      "5:13 unknown-method warning",
      "7:21 expr-parse error",
      "8:10 formula-cycle error",
      "13:11 sort-string warning",
    ]);
    const byRule = (rule: string) => result.diagnostics.find((d) => d.rule === rule && d.line !== 3)!;
    expect(byRule("unknown-method").hint).toContain("contains");
    expect(byRule("formula-cycle").message).toContain("loop -> loop");
    expect(result.summary).toEqual({ errors: 3, warnings: 5, infos: 0 });
  });

  it("exits with code 1 through the CLI", async () => {
    const run = await runCli([join(FIXTURES, "bad.base"), "--vault", VAULT]);
    expect(run.code).toBe(1);
    expect(run.out).toContain("8 problems (3 errors, 5 warnings) in 1 file");
  });
});

describe("AC-2 good.base", () => {
  it("good.base has no errors", async () => {
    const result = await lintPaths([join(FIXTURES, "good.base")], { vaultDir: VAULT, cwd: FIXTURES });
    expect(result.summary.errors).toBe(0);
    expect(result.diagnostics.map(at)).toEqual([
      "4:8 mixed-type warning",
      "6:10 mixed-type warning",
      "6:19 type-mismatch warning",
      "12:19 sort-not-in-order warning",
    ]);
    const mismatch = result.diagnostics.find((d) => d.rule === "type-mismatch")!;
    expect(mismatch.message).toContain("notes/b.md");
  });

  it("exits 0, and 1 with --strict", async () => {
    const file = join(FIXTURES, "good.base");
    expect((await runCli([file, "--vault", VAULT])).code).toBe(0);
    expect((await runCli([file, "--vault", VAULT, "--strict"])).code).toBe(1);
  });

  it("the embedded base block in embed.md has no diagnostics", async () => {
    const result = await lintPaths([join(VAULT, "notes", "embed.md")], { vaultDir: VAULT, cwd: VAULT });
    expect(result.files).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });
});
