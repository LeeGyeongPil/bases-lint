import { describe, expect, it } from "vitest";
import { lintBase } from "../src/index.js";

const formulas = (defs: Record<string, string>): string =>
  "formulas:\n" + Object.entries(defs).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}\n`).join("");

describe("AC-5 formulas and types", () => {
  it("reports an undefined formula reference", () => {
    const found = lintBase('filters: "formula.missing > 1"\n').filter((d) => d.rule === "formula-undefined");
    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe("error");
  });

  it("suggests the close formula name", () => {
    const src = formulas({ total: "1 + 2" }) + 'filters: "formula.totl > 1"\n';
    const found = lintBase(src).filter((d) => d.rule === "formula-undefined");
    expect(found[0]?.hint).toContain("formula.total");
  });

  it("reports a two-formula loop once with the path", () => {
    const found = lintBase(formulas({ a: "formula.b + 1", b: "formula.a * 2" })).filter(
      (d) => d.rule === "formula-cycle",
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain("a -> b -> a");
    expect(found[0]?.line).toBe(2);
  });

  it("reports a longer loop and a separate self loop, each once", () => {
    const src = formulas({ a: "formula.b", b: "formula.c", c: "formula.a", d: "formula.d", ok: "1" });
    const found = lintBase(src).filter((d) => d.rule === "formula-cycle");
    expect(found.map((d) => d.message)).toEqual([
      expect.stringContaining("a -> b -> c -> a"),
      expect.stringContaining("d -> d"),
    ]);
  });

  it("propagates a formula's type to the method called on it", () => {
    const found = lintBase(formulas({ n: "1 + 2", s: "formula.n.lower()" })).filter(
      (d) => d.rule === "type-mismatch",
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe("error");
    expect(found[0]?.message).toContain("lower()");
  });

  it("propagates types through a chain of formulas", () => {
    const src = formulas({ a: '"x"', b: "formula.a", c: "formula.b.abs()" });
    expect(lintBase(src).map((d) => d.rule)).toEqual(["type-mismatch"]);
  });

  it("treats a formula with a syntax error as unknown, not as a second problem", () => {
    const src = formulas({ a: "1 +", b: "formula.a.lower()" });
    expect(lintBase(src).map((d) => d.rule)).toEqual(["expr-parse"]);
  });

  it("reports an unknown global function with a suggestion", () => {
    const found = lintBase('filters: "tody() > now()"\n');
    expect(found).toHaveLength(1);
    expect(found[0]?.rule).toBe("unknown-function");
    expect(found[0]?.severity).toBe("error");
    expect(found[0]?.hint).toContain("today");
  });

  it("reports a wrong argument count", () => {
    const found = lintBase('filters: "if(x)"\n');
    expect(found).toHaveLength(1);
    expect(found[0]?.rule).toBe("wrong-arity");
    expect(found[0]?.severity).toBe("error");
    expect(found[0]?.hint).toContain("if(condition, trueResult, falseResult?)");
  });

  it("checks method argument counts", () => {
    const found = lintBase('filters: "\\"abc\\".replace(\\"a\\")"\n');
    expect(found.map((d) => d.rule)).toEqual(["wrong-arity"]);
  });

  it("flags arithmetic on text only when it can never work", () => {
    const found = lintBase(formulas({ a: '"x" * 2' })).filter((d) => d.rule === "type-mismatch");
    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe("error");
  });

  it("does not flag text concatenation or date arithmetic", () => {
    const src = formulas({ a: '"x" + 1', b: 'now() + "1 day"', c: "now() - now()", d: "formula.c.days" });
    expect(lintBase(src)).toEqual([]);
  });

  it("types callback variables inside filter, map and reduce as unknown, not as properties", () => {
    const src = formulas({ a: "[1, 2].map(value + index)", b: "[1, 2].reduce(acc + value, 0)" });
    expect(lintBase(src)).toEqual([]);
  });

  it("gives summaries the values list", () => {
    const src = "summaries:\n  avg: 'values.mean().round(2)'\n  bad: 'values.lowr()'\n";
    const found = lintBase(src);
    expect(found.map((d) => d.rule)).toEqual(["unknown-method"]);
  });
});
