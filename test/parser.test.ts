import { describe, expect, it } from "vitest";
import { parseExpression } from "../src/expr/parser.js";
import { scalarText } from "../src/yaml-pos.js";
import { extractFences } from "../src/sources.js";
import { editDistance, suggest } from "../src/suggest.js";
import { parseDocument, isScalar } from "yaml";

const ok = (src: string): string => {
  const r = parseExpression(src);
  expect(r.errors, src).toEqual([]);
  return r.ast!.kind;
};

describe("expression parser", () => {
  it("parses literals, lists, regexes, calls, members, methods and indexes", () => {
    expect(ok("1")).toBe("literal");
    expect(ok("1.5")).toBe("literal");
    expect(ok('"a\\"b"')).toBe("literal");
    expect(ok("'a'")).toBe("literal");
    expect(ok("true")).toBe("literal");
    expect(ok("null")).toBe("literal");
    expect(ok("[1, 2, 3,]")).toBe("list");
    expect(ok("/a\\/b[/]c/gi")).toBe("literal");
    expect(ok("now()")).toBe("call");
    expect(ok("file.name")).toBe("member");
    expect(ok("file.name.lower()")).toBe("method");
    expect(ok('note["my prop"]')).toBe("index");
    expect(ok("(1 + 2) * 3")).toBe("binary");
    expect(ok("!a")).toBe("unary");
    expect(ok("-a.b()")).toBe("unary");
    expect(ok("상태 == '완료'")).toBe("binary");
  });

  it("gives * higher precedence than + and && higher than ||", () => {
    const a = parseExpression("1 + 2 * 3").ast!;
    expect(a.kind === "binary" && a.op === "+" && a.right.kind === "binary" && a.right.op === "*").toBe(true);
    const b = parseExpression("a || b && c").ast!;
    expect(b.kind === "binary" && b.op === "||" && b.right.kind === "binary" && b.right.op === "&&").toBe(true);
    const c = parseExpression("1 - 2 - 3").ast!;
    expect(c.kind === "binary" && c.left.kind === "binary").toBe(true);
  });

  it("treats / as division after a value and as a regex otherwise", () => {
    expect(parseExpression("a / b / c").errors).toEqual([]);
    expect(parseExpression("(a) / 2").errors).toEqual([]);
    expect(parseExpression('"x".replace(/a/g, "b")').errors).toEqual([]);
  });

  it("reports errors with exact offsets and codes", () => {
    const cases: [string, number, string][] = [
      ["", 0, "empty"],
      ["a +", 3, "unexpected-end"],
      ["a * * 2", 4, "unexpected-token"],
      ['f("x"', 5, "expected-token-end"],
      ["f(1 2)", 4, "expected-token"],
      ['"abc', 0, "unterminated-string"],
      ["/abc", 0, "unterminated-regex"],
      ["a # b", 2, "invalid-char"],
      ["a.", 2, "expected-name"],
      ["a b", 2, "unexpected-token"],
      [")", 0, "unexpected-token"],
    ];
    for (const [src, offset, code] of cases) {
      const e = parseExpression(src).errors[0];
      expect(e?.code, src).toBe(code);
      expect(e?.offset, src).toBe(offset);
    }
  });

  it("returns an error instead of overflowing the stack on deeply nested input", () => {
    const deep = "(".repeat(5000) + "1" + ")".repeat(5000);
    const r = parseExpression(deep);
    expect(r.ast).toBeNull();
    expect(r.errors[0]?.code).toBe("too-deep");
    expect(parseExpression("(".repeat(50) + "1" + ")".repeat(50)).errors).toEqual([]);
  });

  it("records start and end offsets on nodes", () => {
    const ast = parseExpression("ab + cd.ef()").ast!;
    expect(ast.start).toBe(0);
    expect(ast.end).toBe(12);
    if (ast.kind !== "binary") throw new Error("expected binary");
    expect(ast.opStart).toBe(3);
    expect(ast.right.kind === "method" && ast.right.nameStart).toBe(8);
  });
});

describe("YAML scalar offsets", () => {
  const textOf = (yaml: string): ReturnType<typeof scalarText> => {
    const doc = parseDocument(yaml);
    const node = (doc.contents as { items: { value: unknown }[] }).items[0]!.value;
    if (!isScalar(node)) throw new Error("not a scalar");
    return scalarText(yaml, node);
  };

  it("maps single-quoted '' escapes", () => {
    const yaml = "a: 'x''y == 1'";
    const s = textOf(yaml)!;
    expect(s.text).toBe("x'y == 1");
    expect(s.map(0)).toBe(yaml.indexOf("x"));
    expect(s.map(1)).toBe(yaml.indexOf("''"));
    expect(s.map(2)).toBe(yaml.indexOf("y"));
    expect(s.map(s.text.length)).toBe(yaml.length - 1);
  });

  it("maps double-quoted escapes including unicode escapes", () => {
    const yaml = 'a: "p\\u00e9\\tq\\\\r"';
    const s = textOf(yaml)!;
    expect(s.text).toBe("pé\tq\\r");
    expect(s.map(1)).toBe(yaml.indexOf("\\u"));
    expect(s.map(2)).toBe(yaml.indexOf("\\t"));
    expect(s.map(3)).toBe(yaml.indexOf("q"));
    expect(s.map(4)).toBe(yaml.indexOf("\\\\"));
    expect(s.map(5)).toBe(yaml.indexOf("r"));
  });

  it("maps a literal block scalar line by line", () => {
    const yaml = "a: |\n  one\n    two\n";
    const s = textOf(yaml)!;
    expect(s.text).toBe("one\n  two");
    expect(s.map(0)).toBe(yaml.indexOf("one"));
    expect(s.map(s.text.indexOf("two"))).toBe(yaml.indexOf("two"));
  });

  it("maps a folded block scalar", () => {
    const yaml = "a: >\n  one\n  two\n";
    const s = textOf(yaml)!;
    expect(s.text).toBe("one two");
    expect(s.map(4)).toBe(yaml.indexOf("two"));
  });

  it("maps a multi-line plain scalar", () => {
    const yaml = "a: one\n  two\n";
    const s = textOf(yaml)!;
    expect(s.text).toBe("one two");
    expect(s.map(4)).toBe(yaml.indexOf("two"));
  });

  it("uses the source text for numbers and booleans", () => {
    const s = textOf("a: 42\n")!;
    expect(s.text).toBe("42");
  });
});

describe("markdown fences", () => {
  it("extracts base blocks with line offsets and ignores other blocks", () => {
    const md = ["# t", "```js", "x", "```", "", "```base", "views: []", "```", "~~~base", "a: 1", "~~~", ""].join("\n");
    const blocks = extractFences(md);
    expect(blocks).toEqual([
      { text: "views: []", lineOffset: 6 },
      { text: "a: 1", lineOffset: 9 },
    ]);
  });

  it("takes an unclosed block to the end of the file", () => {
    expect(extractFences("```base\nviews: []\n")).toEqual([{ text: "views: []\n", lineOffset: 1 }]);
  });
});

describe("suggestions", () => {
  it("counts a swap of neighbours as one edit", () => {
    expect(editDistance("nmae", "name")).toBe(1);
    expect(editDistance("", "abc")).toBe(3);
  });

  it("suggests only close names", () => {
    expect(suggest("statsu", ["status", "priority"])).toBe("status");
    expect(suggest("zzzzzz", ["status", "priority"])).toBeUndefined();
    expect(suggest("AND", ["and", "or", "not"])).toBe("and");
  });
});
