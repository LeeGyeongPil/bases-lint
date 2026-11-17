import { describe, expect, it } from "vitest";
import { lintBase } from "../src/index.js";

const rules = (src: string): string[] => lintBase(src).map((d) => d.rule);

describe("AC-6 structure and silent-failure rules", () => {
  it("rejects an uppercase AND key", () => {
    const found = lintBase("filters:\n  AND:\n    - 'a == 1'\n");
    expect(found.map((d) => d.rule)).toEqual(["filter-shape"]);
    expect(found[0]?.hint).toContain("and");
    expect(found[0]?.line).toBe(2);
  });

  it("rejects an and value that is not a list", () => {
    const found = lintBase("filters:\n  and: x\n");
    expect(found.map((d) => d.rule)).toEqual(["filter-shape"]);
    expect(found[0]?.line).toBe(2);
    expect(found[0]?.column).toBe(8);
  });

  it("rejects a filter object with two keys, once", () => {
    const src = "filters:\n  and:\n    - 'a == 1'\n  or:\n    - 'b == 2'\n";
    const found = lintBase(src);
    expect(found.map((d) => d.rule)).toEqual(["filter-shape"]);
    expect(found[0]?.line).toBe(4);
  });

  it("rejects a filter item that is neither text nor an object", () => {
    expect(rules("filters:\n  and:\n    - 5\n")).toEqual(["filter-shape"]);
    expect(rules("filters:\n  and:\n    - [a, b]\n")).toEqual(["filter-shape"]);
  });

  it("accepts nested and/or/not filters and a plain string filter", () => {
    const src = [
      "filters:",
      "  and:",
      "    - 'a == 1'",
      "    - or:",
      "        - 'b == 2'",
      "        - not:",
      "            - 'c == 3'",
      "views:",
      "  - type: table",
      "    filters: 'd == 4'",
      "",
    ].join("\n");
    expect(lintBase(src)).toEqual([]);
  });

  it("reports a missing type, a bad limit and a bad groupBy direction as view-shape", () => {
    const src = [
      "views:",
      "  - name: A",
      "  - type: table",
      "    limit: ten",
      "  - type: table",
      "    groupBy:",
      "      property: status",
      "      direction: UP",
      "",
    ].join("\n");
    const found = lintBase(src);
    expect(found.map((d) => `${d.rule}@${d.line}`)).toEqual(["view-shape@2", "view-shape@4", "view-shape@8"]);
    expect(found.every((d) => d.severity === "error")).toBe(true);
  });

  it("accepts limit 0 and a positive integer but rejects negative and fractional", () => {
    const base = (v: string): string => `views:\n  - type: table\n    limit: ${v}\n`;
    expect(rules(base("0"))).toEqual([]);
    expect(rules(base("25"))).toEqual([]);
    expect(rules(base("-1"))).toEqual(["view-shape"]);
    expect(rules(base("2.5"))).toEqual(["view-shape"]);
  });

  it("checks order and sort directions", () => {
    const src = [
      "views:",
      "  - type: table",
      "    order: file.name",
      "  - type: table",
      "    order: [a]",
      "    sort:",
      "      - property: a",
      "        direction: asc",
      "",
    ].join("\n");
    expect(lintBase(src).map((d) => `${d.rule}@${d.line}`)).toEqual(["view-shape@3", "view-shape@8"]);
  });

  it("suggests views for a misspelled top-level key", () => {
    const found = lintBase("view:\n  - type: table\n");
    expect(found.map((d) => d.rule)).toEqual(["top-level-key"]);
    expect(found[0]?.hint).toContain("views");
    expect(found[0]?.severity).toBe("warning");
  });

  it("reports a plugin view type as info", () => {
    const found = lintBase("views:\n  - type: gallery\n");
    expect(found.map((d) => `${d.rule} ${d.severity}`)).toEqual(["view-type-unknown info"]);
    for (const core of ["table", "cards", "list", "map"]) {
      expect(rules(`views:\n  - type: ${core}\n`)).toEqual([]);
    }
  });

  it("reports an unknown summary but accepts built-in and user-defined ones", () => {
    const src = [
      "summaries:",
      "  spread: 'values.mean()'",
      "views:",
      "  - type: table",
      "    summaries:",
      "      price: Avg",
      "      cost: Average",
      "      other: spread",
      "",
    ].join("\n");
    const found = lintBase(src);
    expect(found.map((d) => d.rule)).toEqual(["summary-unknown"]);
    expect(found[0]?.line).toBe(6);
    expect(found[0]?.hint).toContain("Average");
  });

  it("reports sort as a string and sort outside order, both with the evidence link", () => {
    const issue = "https://github.com/obsidianmd/obsidian-skills/issues/149";
    const sortString = lintBase('views:\n  - type: table\n    sort: "- priority DESC"\n');
    expect(sortString.map((d) => d.rule)).toEqual(["sort-string"]);
    expect(sortString[0]?.docs).toBe(issue);
    const notInOrder = lintBase(
      "views:\n  - type: table\n    order: [file.name]\n    sort:\n      - property: priority\n        direction: DESC\n",
    );
    expect(notInOrder.map((d) => d.rule)).toEqual(["sort-not-in-order"]);
    expect(notInOrder[0]?.docs).toBe(issue);
    expect(notInOrder[0]?.message).toContain("unconfirmed");
  });

  it("does not warn about sort when the view has no order list", () => {
    expect(rules("views:\n  - type: table\n    sort:\n      - property: priority\n        direction: DESC\n")).toEqual([]);
  });

  it("reports YAML syntax errors and nothing else", () => {
    const found = lintBase("filters:\n  and: [a\nviews: x: y\n");
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((d) => d.rule === "yaml-syntax")).toBe(true);
  });

  it("reports a non-mapping document", () => {
    expect(rules("- a\n- b\n")).toEqual(["yaml-syntax"]);
  });

  it("returns nothing for an empty file", () => {
    expect(lintBase("")).toEqual([]);
    expect(lintBase("# only a comment\n")).toEqual([]);
  });

  it("turns rules off with disable", () => {
    const src = "view:\n  - type: gallery\n";
    expect(lintBase(src, { disable: ["top-level-key"] })).toEqual([]);
  });
});
