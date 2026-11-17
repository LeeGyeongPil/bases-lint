import { afterAll, describe, expect, it } from "vitest";
import { lintBase, indexVault } from "../src/index.js";
import { VAULT, cleanupVaults, makeVault, runCli } from "./helpers.js";
import { join } from "node:path";
import { FIXTURES } from "./helpers.js";

afterAll(cleanupVaults);

const filter = (expr: string): string => `filters: ${JSON.stringify(expr)}\n`;

const NOTES = {
  "notes/x.md": "---\ndue: 2026-11-20\n---\n",
  "notes/y.md": "---\ndue: soon\n---\n",
};

describe("AC-4 vault inference", () => {
  it("infers a date from a YYYY-MM-DD string and reports no diagnostics for due.year", async () => {
    const vault = await indexVault(VAULT);
    expect(vault.properties["due"]?.types).toEqual(["date"]);
    expect(lintBase(filter("due.year == 2026"), { vault })).toEqual([]);
  });

  it("prefers .obsidian/types.json over what the notes look like", async () => {
    const withoutTypes = await makeVault(NOTES);
    const withTypes = await makeVault({ ...NOTES, ".obsidian/types.json": '{"types":{"due":"date"}}' });
    const plain = await indexVault(withoutTypes);
    const declared = await indexVault(withTypes);
    // Without a declaration the two notes disagree (a date and a plain string).
    expect(plain.properties["due"]?.types).toEqual(["date", "string"]);
    expect(lintBase(filter("due.year == 2026"), { vault: plain }).map((d) => d.rule)).toContain("mixed-type");
    // With the declaration the property is a date and the check passes.
    expect(declared.properties["due"]?.declared).toBe("date");
    expect(lintBase(filter("due.year == 2026"), { vault: declared })).toEqual([]);
  });

  it("maps every declared Obsidian property type", async () => {
    const dir = await makeVault({
      ".obsidian/types.json": JSON.stringify({
        types: {
          a: "text",
          b: "multitext",
          c: "number",
          d: "checkbox",
          e: "date",
          f: "datetime",
          g: "tags",
          h: "aliases",
          i: "constructor",
        },
      }),
      "n.md": "---\na: x\n---\n",
    });
    const v = await indexVault(dir);
    const types = Object.fromEntries(Object.entries(v.properties).map(([k, p]) => [k, p.declared]));
    expect(types).toEqual({
      a: "string",
      b: "list",
      c: "number",
      d: "boolean",
      e: "date",
      f: "date",
      g: "list",
      h: "list",
    });
  });

  it("falls back to inference and warns when types.json cannot be read", async () => {
    const dir = await makeVault({ ".obsidian/types.json": "{ not json", "n.md": "---\na: 1\n---\n" });
    const v = await indexVault(dir);
    expect(v.warnings.length).toBe(1);
    expect(v.properties["a"]?.types).toEqual(["number"]);
  });

  it("suggests the close property name for a typo", async () => {
    const vault = await indexVault(VAULT);
    const [d] = lintBase(filter('statsu == "x"'), { vault });
    expect(d?.rule).toBe("unknown-property");
    expect(d?.severity).toBe("warning");
    expect(d?.hint).toContain("status");
  });

  it("makes a file.* typo an error with the right field as hint", async () => {
    const vault = await indexVault(VAULT);
    const [d] = lintBase(filter('file.nmae == "x"'), { vault });
    expect(d?.rule).toBe("unknown-property");
    expect(d?.severity).toBe("error");
    expect(d?.hint).toContain("file.name");
  });

  it("names an example note in the mixed-type message", async () => {
    const vault = await indexVault(VAULT);
    const d = lintBase(filter('status == "open"'), { vault }).find((x) => x.rule === "mixed-type");
    expect(d?.message).toContain("notes/b.md");
  });

  it("reports an empty list item once per file with example notes", async () => {
    const vault = await indexVault(VAULT);
    const src = "filters:\n  and:\n    - 'tags.contains(\"a\")'\n    - 'tags.isEmpty()'\n";
    const found = lintBase(src, { vault }).filter((d) => d.rule === "empty-list-item");
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain("notes/a.md");
  });

  it("does not warn about tags or aliases when no note sets them", async () => {
    const dir = await makeVault({ "n.md": "---\nx: 1\n---\n" });
    const vault = await indexVault(dir);
    expect(lintBase(filter('tags.contains("a") && aliases.isEmpty()'), { vault })).toEqual([]);
  });

  it("skips vault-aware checks with --no-vault", async () => {
    const run = await runCli([join(FIXTURES, "bad.base"), "--no-vault", "--format", "json"]);
    const rules = (JSON.parse(run.out) as { diagnostics: { rule: string }[] }).diagnostics.map((d) => d.rule);
    expect(rules).not.toContain("mixed-type");
    expect(rules).not.toContain("empty-list-item");
    expect(rules).not.toContain("unknown-property");
    expect(rules).not.toContain("type-mismatch");
    expect(rules.sort()).toEqual(["expr-parse", "expr-parse", "formula-cycle", "sort-string", "unknown-method"]);
  });

  it("finds the vault by walking up to .obsidian", async () => {
    const dir = await makeVault({
      ".obsidian/types.json": '{"types":{"due":"date"}}',
      "notes/a.md": "---\ndue: 2026-11-20\n---\n",
      "sub/t.base": filter("due.year == 2026"),
      "sub/u.base": filter("dew.year == 2026"),
    });
    const run = await runCli([join(dir, "sub"), "--format", "json"], { cwd: dir });
    const out = JSON.parse(run.out) as { diagnostics: { rule: string; file: string }[]; vaults: string[] };
    expect(out.diagnostics.map((d) => `${d.file} ${d.rule}`)).toEqual(["sub/u.base unknown-property"]);
    expect(out.vaults.length).toBe(1);
  });
});
