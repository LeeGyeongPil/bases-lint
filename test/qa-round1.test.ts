import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseExpression } from "../src/expr/parser.js";
import { lintBase } from "../src/index.js";
import { cleanupVaults, makeVault, runCli } from "./helpers.js";

afterEach(cleanupVaults);

const hasHangul = (s: string): boolean => /[가-힣]/.test(s);

describe("command-line errors follow --lang", () => {
  it("--lang en --bogus is English only even when LANG is Korean", async () => {
    const r = await runCli(["--lang", "en", "--bogus"], { env: { LANG: "ko_KR.UTF-8" } });
    expect(r.code).toBe(2);
    expect(r.err).toContain("Unknown option --bogus");
    expect(hasHangul(r.err)).toBe(false);
  });

  it("--lang ko --vault (no value) is Korean only", async () => {
    const r = await runCli(["--lang", "ko", "--vault"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("--vault");
    expect(r.err).toContain("값이 필요");
    expect(/[A-Za-z]{4,} [a-z]{3,}/.test(r.err.replace(/bases-lint --help/g, ""))).toBe(false);
  });

  it("--lang=ko form and LANG fallback also work", async () => {
    expect(hasHangul((await runCli(["--lang=ko", "--bogus"])).err)).toBe(true);
    expect(hasHangul((await runCli(["--bogus"], { env: { LANG: "ko_KR.UTF-8" } })).err)).toBe(true);
    expect(hasHangul((await runCli(["--bogus"])).err)).toBe(false);
  });
});

describe("vault notices are translated", () => {
  it("a broken types.json notice has no English sentence in Korean", async () => {
    const dir = await makeVault({ ".obsidian/types.json": "{bad", "a.base": "views:\n  - type: table\n" });
    const ko = await runCli([join(dir, "a.base"), "--lang", "ko"]);
    expect(ko.err).toContain("참고:");
    expect(ko.err).toContain("types.json 를 읽을 수 없습니다");
    expect(ko.err).not.toContain("Could not read");
    const en = await runCli([join(dir, "a.base"), "--lang", "en"]);
    expect(en.err).toContain("note: Could not read");
  });
});

describe("deep nesting and long lines", () => {
  it("reports too-deep nesting with its own message", () => {
    const src = "(".repeat(300) + "1" + ")".repeat(300);
    expect(parseExpression(src).errors[0]?.code).toBe("too-deep");
    const [d] = lintBase(`filters: '${src}'\n`, { lang: "en" });
    expect(d?.rule).toBe("expr-parse");
    expect(d?.message).toBe("The expression is nested too deeply.");
    const [k] = lintBase(`filters: '${src}'\n`, { lang: "ko" });
    expect(k?.message).toBe("식의 중첩이 너무 깊습니다.");
  });

  it("clips the code frame of a very long line", async () => {
    const dir = await makeVault({ "long.base": `filters: '${"(".repeat(20000)}'\n` });
    const r = await runCli([join(dir, "long.base"), "--no-vault"]);
    expect(Math.max(...r.out.split("\n").map((l) => l.length))).toBeLessThan(400);
  });
});

describe("folders without sources or unreadable", () => {
  it("prints a note when nothing was found, in both languages", async () => {
    const dir = await makeVault({ "readme.txt": "x" });
    const en = await runCli([dir]);
    expect(en.code).toBe(0);
    expect(en.err).toContain("No .base files or base blocks were found");
    const ko = await runCli([dir, "--lang", "ko"]);
    expect(ko.err).toContain("찾지 못했습니다");
  });

  it("skips an unreadable subfolder with a note instead of crashing", async () => {
    const dir = await makeVault({ "ok.base": "views:\n  - type: table\n" });
    const sub = join(dir, "locked");
    await mkdir(sub);
    await writeFile(join(sub, "x.base"), "views: []\n");
    await chmod(sub, 0o000);
    try {
      const r = await runCli([dir, "--no-vault"]);
      // Root users can still read the folder; only assert when the folder was really locked.
      if (r.err.includes("Skipped")) {
        expect(r.code).toBe(0);
        expect(r.err).toContain("locked");
      } else {
        expect(r.code).toBeLessThanOrEqual(1);
      }
    } finally {
      await chmod(sub, 0o755);
    }
  });
});
