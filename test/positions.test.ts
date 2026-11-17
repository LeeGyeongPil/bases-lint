import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lintPaths } from "../src/files.js";
import { FIXTURES } from "./helpers.js";

const DIR = join(FIXTURES, "positions");
const EXPECT = /expect:\s*(\d+):(\d+)\s+([a-z-]+)/g;

const files = readdirSync(DIR).filter((f) => f.endsWith(".base") || f.endsWith(".md"));

describe("AC-3 positions", () => {
  it("has at least 6 cases including a markdown fence", () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
    expect(files.some((f) => f.endsWith(".md"))).toBe(true);
  });

  for (const file of files) {
    it(`reports exactly the expected line:column and rule for ${file}`, async () => {
      const text = readFileSync(join(DIR, file), "utf8");
      const expected = [...text.matchAll(EXPECT)].map((m) => `${m[1]}:${m[2]} ${m[3]}`);
      expect(expected.length).toBeGreaterThan(0);
      const result = await lintPaths([join(DIR, file)], { noVault: true, cwd: DIR });
      const actual = result.diagnostics.map((d) => `${d.line}:${d.column} ${d.rule}`);
      expect(actual).toEqual(expected);
    });
  }
});
