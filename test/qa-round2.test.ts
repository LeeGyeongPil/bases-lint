import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { indexVault, lintBase } from "../src/index.js";
import type { Diagnostic, Lang } from "../src/types.js";
import { FIXTURES, ROOT, VAULT, runCli } from "./helpers.js";

const bad = join(FIXTURES, "bad.base");

// A message is broken when a placeholder was left empty or unfilled:
// "for ." / " 에 없는", a leading blank, a blank before punctuation, a double blank,
// or a raw "{name}".
function brokenReason(text: string): string | null {
  if (/\{\w+\}/.test(text)) return "unfilled placeholder";
  if (text !== text.trim()) return "leading or trailing blank";
  // Quoted examples ("  direction: DESC") and paths (.obsidian/types.json) may hold
  // blanks on purpose, so look only at the sentence around them.
  const prose = text.replace(/"[^"]*"/g, '"x"');
  if (/ {2}/.test(prose)) return "double blank";
  if (/ [.,;:](\s|$)/.test(prose)) return "blank before punctuation";
  if (/\bfor \./.test(prose)) return "empty type list";
  if (/other types?\b/.test(prose)) return "untranslated fallback word";
  return null;
}

function expectClean(diags: Diagnostic[], lang: Lang): void {
  for (const d of diags) {
    for (const text of [d.message, d.hint ?? ""]) {
      if (text === "") continue;
      expect(brokenReason(text), `${lang} ${d.line}:${d.column} ${d.rule}: "${text}"`).toBeNull();
    }
  }
}

describe("Q-7 unknown-method without a known type (no vault)", () => {
  it("CLI --no-vault prints a whole English sentence at 5:13", async () => {
    const r = await runCli([bad, "--no-vault", "--lang", "en"]);
    const line = r.out.split("\n").find((l) => l.includes("bad.base:5:13"));
    expect(line).toContain('unknown-method Unknown method or field "containz".');
    expect(line).not.toContain("for .");
  });

  it("CLI --no-vault prints a whole Korean sentence at 5:13", async () => {
    const r = await runCli([bad, "--no-vault", "--lang", "ko"]);
    const line = r.out.split("\n").find((l) => l.includes("bad.base:5:13"));
    expect(line).toContain('unknown-method 알 수 없는 메서드 또는 필드 "containz" 입니다.');
    expect(line).not.toMatch(/unknown-method {2}/);
  });

  it("lintBase without a vault gives the same text in both languages", async () => {
    const src = await readFile(bad, "utf8");
    const en = lintBase(src, { lang: "en" }).find((d) => d.line === 5 && d.column === 13);
    const ko = lintBase(src, { lang: "ko" }).find((d) => d.line === 5 && d.column === 13);
    expect(en?.message).toBe('Unknown method or field "containz".');
    expect(ko?.message).toBe('알 수 없는 메서드 또는 필드 "containz" 입니다.');
    expect(en?.hint).toBe('Did you mean "contains"?');
  });

  it("with a vault the type name is still shown", async () => {
    const src = await readFile(bad, "utf8");
    const vault = await indexVault(VAULT);
    const en = lintBase(src, { lang: "en", vault }).find((d) => d.line === 5 && d.column === 13);
    expect(en?.message).toBe('Unknown method or field "containz" for list.');
  });
});

describe("same pattern elsewhere: a method name used as a field", () => {
  const src = [
    "filters:",
    "  and:",
    '    - "file.name.isTruthy"',
    '    - "file.name.lower"',
    "",
  ].join("\n");

  it("says to add parentheses instead of an empty or English owner list", () => {
    const en = lintBase(src, { lang: "en" });
    const ko = lintBase(src, { lang: "ko" });
    expect(en.map((d) => d.message)).toEqual([
      '"isTruthy" is a method, not a field; it needs parentheses.',
      '"lower" is a method, not a field; it needs parentheses.',
    ]);
    expect(en.map((d) => d.hint)).toEqual(['Call it as "isTruthy()".', 'Call it as "lower()".']);
    expect(ko[0]?.message).toBe('"isTruthy" 은(는) 필드가 아니라 메서드라서 괄호가 필요합니다.');
    expect(ko[0]?.hint).toBe('"isTruthy()" 처럼 호출하세요.');
    expect(ko.every((d) => !/other type/.test(d.message + (d.hint ?? "")))).toBe(true);
  });

  it("a string method on a number still names the owner type", () => {
    const en = lintBase('filters: "file.size.lower"\n', { lang: "en" });
    expect(en[0]?.message).toBe('".lower" is not available on number; it exists on string.');
  });
});

describe("no message has an empty or unfilled slot", () => {
  // Expressions that walk every message path of the type checker:
  // unknown members on known and unknown types, method-as-field, field on the
  // wrong type, arithmetic on wrong types, unary minus, arity, unknown function.
  const exprs = [
    'tags.containz("x")',
    'note.nothere.containz("x")',
    "note.nothere.lenght",
    "file.name.lenght",
    "file.name.isTruthy",
    "file.name.lower",
    "file.size.lower",
    "file.size.year",
    "file.mtime.containz(1)",
    "tags.isTruthy",
    "status.lower()",
    "priority * 2",
    "priority - tags",
    '"a" * 2',
    "-file.name",
    "-tags",
    "file.name.lower(1, 2, 3)",
    "nope(1)",
    "formula.missing",
    "[1, 2].map(value.foo)",
    "file.name.slice()",
  ];
  const src = ["formulas:", ...exprs.map((e, i) => `  f${i}: ${JSON.stringify(e)}`), ""].join("\n");

  for (const lang of ["en", "ko"] as const) {
    it(`${lang}, no vault`, () => {
      const diags = lintBase(src, { lang });
      expect(diags.length).toBeGreaterThan(5);
      expectClean(diags, lang);
    });

    it(`${lang}, test vault`, async () => {
      const diags = lintBase(src, { lang, vault: await indexVault(VAULT) });
      expect(diags.length).toBeGreaterThan(5);
      expectClean(diags, lang);
    });

    it(`${lang}, bundled example vault and fixtures through the CLI`, async () => {
      for (const args of [
        [bad, "--no-vault"],
        [bad, "--vault", VAULT],
        [join(ROOT, "examples", "vault")],
      ]) {
        const r = await runCli([...args, "--lang", lang, "--format", "json"]);
        const diags = (JSON.parse(r.out) as { diagnostics: Diagnostic[] }).diagnostics;
        expectClean(diags, lang);
      }
    });
  }
});
