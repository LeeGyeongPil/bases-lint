import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/en.js";
import { ko } from "../src/i18n/ko.js";
import { resolveLang } from "../src/i18n/index.js";
import { RULES } from "../src/rules.js";
import { RULE_IDS } from "../src/types.js";
import { FIXTURES, VAULT, runCli } from "./helpers.js";

const bad = join(FIXTURES, "bad.base");
const placeholders = (s: string): Set<string> => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!));

describe("AC-8 languages", () => {
  it("--lang picks the help language", async () => {
    expect((await runCli(["--lang", "ko", "--help"])).out).toContain("사용법");
    expect((await runCli(["--lang", "en", "--help"])).out).toContain("Usage");
  });

  it("prints the bad.base summary in both languages", async () => {
    const en = await runCli([bad, "--vault", VAULT, "--lang", "en"]);
    expect(en.out).toContain("8 problems (3 errors, 5 warnings)");
    const ko = await runCli([bad, "--vault", VAULT, "--lang", "ko"]);
    expect(ko.out).toContain("문제 8개 (오류 3, 경고 5)");
    expect(ko.out).toContain("오류 expr-parse");
  });

  it("keeps rule IDs and JSON keys the same in Korean", async () => {
    const a = JSON.parse((await runCli([bad, "--vault", VAULT, "--lang", "en", "--format", "json"])).out) as {
      diagnostics: { rule: string; line: number; severity: string; message: string }[];
    };
    const b = JSON.parse((await runCli([bad, "--vault", VAULT, "--lang", "ko", "--format", "json"])).out) as typeof a;
    expect(b.diagnostics.map((d) => [d.rule, d.line, d.severity])).toEqual(a.diagnostics.map((d) => [d.rule, d.line, d.severity]));
    expect(b.diagnostics[0]?.message).not.toBe(a.diagnostics[0]?.message);
  });

  it("BASES_LINT_LANG beats LANG, and --lang beats BASES_LINT_LANG", async () => {
    const env = { BASES_LINT_LANG: "ko", LANG: "en_US.UTF-8" };
    expect((await runCli(["--help"], { env })).out).toContain("사용법");
    expect((await runCli(["--help", "--lang", "en"], { env })).out).toContain("Usage");
  });

  it("falls back to LC_ALL, LC_MESSAGES then LANG, and treats non-Korean as English", async () => {
    expect((await runCli(["--help"], { env: { LANG: "ko_KR.UTF-8" } })).out).toContain("사용법");
    expect((await runCli(["--help"], { env: { LANG: "fr_FR.UTF-8" } })).out).toContain("Usage");
    expect((await runCli(["--help"], { env: {} })).out).toContain("Usage");
    expect(resolveLang(undefined, { LC_ALL: "ko_KR.UTF-8", LANG: "en_US.UTF-8" })).toBe("ko");
    expect(resolveLang(undefined, { LC_ALL: "", LC_MESSAGES: "ko", LANG: "en_US.UTF-8" })).toBe("ko");
    expect(resolveLang(undefined, { LC_ALL: "C", LANG: "ko_KR.UTF-8" })).toBe("en");
  });

  it("rejects an unsupported --lang value with exit 2", async () => {
    const run = await runCli(["--lang", "fr", "--help"]);
    expect(run.code).toBe(2);
    expect(run.err).toContain("fr");
  });

  it("translates usage errors", async () => {
    const run = await runCli([], { env: { LANG: "ko_KR.UTF-8" } });
    expect(run.err).toContain("경로가 없습니다");
  });

  it("en.ts and ko.ts define the same keys", () => {
    expect(Object.keys(ko).sort()).toEqual(Object.keys(en).sort());
  });

  it("ko placeholders are a subset of the en placeholders for every key", () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const extra = [...placeholders(ko[key])].filter((p) => !placeholders(en[key]).has(p));
      expect(extra, key).toEqual([]);
    }
  });

  it("every rule has message and hint keys present in both catalogs", () => {
    for (const id of RULE_IDS) {
      const rule = RULES[id];
      expect(rule.messages.length, id).toBeGreaterThan(0);
      expect(rule.hints.length, id).toBeGreaterThan(0);
      for (const key of [...rule.messages, ...rule.hints]) {
        expect(en[key], `${id}: ${key} (en)`).toBeTruthy();
        expect(ko[key], `${id}: ${key} (ko)`).toBeTruthy();
      }
    }
  });
});
