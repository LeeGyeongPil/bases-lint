import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BasesLintUsageError, indexVault, lintBase, lintPaths, parseExpression } from "../src/index.js";
import { FIXTURES, VAULT } from "./helpers.js";

describe("AC-10 library API", () => {
  it("lintBase without a vault returns the five vault-free diagnostics", () => {
    const source = readFileSync(join(FIXTURES, "bad.base"), "utf8");
    const result = lintBase(source);
    expect(Array.isArray(result)).toBe(true);
    expect(result.map((d) => `${d.line}:${d.column}`)).toEqual(["3:28", "5:13", "7:21", "8:10", "13:11"]);
    for (const d of result) {
      expect(d.file).toBe("<input>");
      expect(d.endLine).toBeGreaterThanOrEqual(d.line);
    }
  });

  it("lintBase uses the file name and line offset it is given", () => {
    const [d] = lintBase("views: x\n", { file: "note.md", lineOffset: 10 });
    expect(d?.file).toBe("note.md");
    expect(d?.line).toBe(11);
  });

  it("parseExpression returns null and the offset of a syntax error", () => {
    const r = parseExpression("a +");
    expect(r.ast).toBeNull();
    expect(r.errors[0]?.offset).toBe(3);
    const ok = parseExpression('status == "x"');
    expect(ok.errors).toEqual([]);
    expect(ok.ast?.kind).toBe("binary");
  });

  it("indexVault reports the observed types per property", async () => {
    const vault = await indexVault(VAULT);
    expect(vault.properties["status"]?.types).toEqual(["string", "list"]);
    expect(vault.properties["priority"]?.types).toEqual(["number", "string"]);
    expect(vault.properties["due"]?.types).toEqual(["date"]);
    expect(vault.properties["tags"]?.emptyItemNotes).toEqual(["notes/a.md"]);
    expect(vault.notes).toBe(3);
  });

  it("lintPaths returns files, diagnostics and a summary", async () => {
    const r = await lintPaths([join(FIXTURES, "good.base")], { vaultDir: VAULT });
    expect(r.files).toBe(1);
    expect(r.summary).toEqual({ errors: 0, warnings: 4, infos: 0 });
  });

  it("throws BasesLintUsageError for a missing path or vault", async () => {
    await expect(lintPaths([join(FIXTURES, "missing.base")])).rejects.toBeInstanceOf(BasesLintUsageError);
    await expect(indexVault(join(FIXTURES, "missing-vault"))).rejects.toMatchObject({ code: "vault-missing" });
  });
});
