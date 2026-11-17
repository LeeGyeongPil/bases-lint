import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lintBase } from "../src/index.js";
import { FIELDS, FILE_FIELDS, GLOBALS, methodTableNames, methodsOf } from "../src/signatures.js";
import { FIXTURES } from "./helpers.js";

const corpus = JSON.parse(readFileSync(join(FIXTURES, "corpus.json"), "utf8")) as string[];

/** Wrap one expression in a minimal base as a filter. */
function asBase(expr: string): string {
  return `filters:\n  and:\n    - ${JSON.stringify(expr)}\n`;
}

describe("AC-2 corpus", () => {
  const traced = new Set<string>();

  it("accepts every valid expression with no diagnostics", () => {
    const failures: string[] = [];
    for (const expr of corpus) {
      const diagnostics = lintBase(asBase(expr), { trace: (e) => traced.add(e) });
      if (diagnostics.length > 0) {
        failures.push(`${expr} -> ${diagnostics.map((d) => `${d.rule}: ${d.message}`).join(" | ")}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("uses every function, method and field of signatures.json at least once", () => {
    // Make sure the previous test filled `traced` even when run alone.
    for (const expr of corpus) lintBase(asBase(expr), { trace: (e) => traced.add(e) });
    const expected: string[] = [];
    for (const name of GLOBALS.keys()) expected.push(`globals.${name}`);
    for (const table of methodTableNames()) {
      for (const name of methodsOf(table).keys()) expected.push(`methods.${table}.${name}`);
    }
    for (const [table, fields] of FIELDS) for (const name of fields.keys()) expected.push(`fields.${table}.${name}`);
    for (const name of FILE_FIELDS.keys()) expected.push(`fileFields.${name}`);
    const missing = expected.filter((e) => !traced.has(e));
    expect(missing).toEqual([]);
    expect(expected.length).toBeGreaterThan(80);
  });

  it("still reports real mistakes in the same style (guards against a checker that accepts everything)", () => {
    const bad = [
      '"abc".lowr()',
      "tody()",
      "if(true)",
      "file.nmae",
      '(1).lower()',
      '"a" * 2',
    ];
    for (const expr of bad) {
      expect(lintBase(asBase(expr)).length, expr).toBeGreaterThan(0);
    }
  });
});
