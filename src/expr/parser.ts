import type { Expr, ParseError } from "./ast.js";
import { tokenize, type Token } from "./lexer.js";

/** Binary operator precedence, JavaScript style. Higher binds tighter. */
const PRECEDENCE: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "==": 3,
  "!=": 3,
  "<": 4,
  ">": 4,
  "<=": 4,
  ">=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "%": 6,
};

const MAX_DEPTH = 200;

class Failure extends Error {
  constructor(readonly error: ParseError) {
    super(error.message);
  }
}

function fail(
  code: ParseError["code"],
  offset: number,
  end: number,
  params: Record<string, string>,
  message: string,
): never {
  throw new Failure({ code, offset, end, params, message });
}

class Parser {
  private pos = 0;
  private depth = 0;
  constructor(
    private readonly tokens: Token[],
    private readonly srcLength: number,
  ) {}

  private peek(): Token {
    return this.tokens[this.pos]!;
  }

  private next(): Token {
    const t = this.tokens[this.pos]!;
    if (t.kind !== "eof") this.pos++;
    return t;
  }

  private isOp(text: string): boolean {
    const t = this.peek();
    return t.kind === "op" && t.text === text;
  }

  private unexpected(t: Token): never {
    if (t.kind === "eof") fail("unexpected-end", this.srcLength, this.srcLength, {}, "The expression ends too early.");
    return fail("unexpected-token", t.start, t.end, { token: t.text }, `Unexpected token "${t.text}".`);
  }

  private expectOp(text: string): Token {
    const t = this.peek();
    if (t.kind === "op" && t.text === text) return this.next();
    if (t.kind === "eof") {
      return fail(
        "expected-token-end",
        this.srcLength,
        this.srcLength,
        { expected: text },
        `Expected "${text}" at the end of the expression.`,
      );
    }
    return fail(
      "expected-token",
      t.start,
      t.end,
      { expected: text, token: t.text },
      `Expected "${text}" but found "${t.text}".`,
    );
  }

  parseAll(): Expr {
    if (this.peek().kind === "eof") fail("empty", 0, 0, {}, "The expression is empty.");
    const e = this.expression(0);
    const t = this.peek();
    if (t.kind !== "eof") this.unexpected(t);
    return e;
  }

  private expression(minPrec: number): Expr {
    // Guard against stack overflow on absurdly nested input such as "((((...".
    if (++this.depth > MAX_DEPTH) {
      const t = this.peek();
      fail("too-deep", t.start, t.end, {}, "The expression is nested too deeply.");
    }
    try {
      return this.expressionBody(minPrec);
    } finally {
      this.depth--;
    }
  }

  private expressionBody(minPrec: number): Expr {
    let left = this.unary();
    for (;;) {
      const t = this.peek();
      if (t.kind !== "op") break;
      const prec = PRECEDENCE[t.text];
      if (prec === undefined || prec <= minPrec) break;
      this.next();
      const right = this.expression(prec);
      left = { kind: "binary", op: t.text, opStart: t.start, left, right, start: left.start, end: right.end };
    }
    return left;
  }

  private unary(): Expr {
    const t = this.peek();
    if (t.kind === "op" && (t.text === "!" || t.text === "-")) {
      this.next();
      const operand = this.unary();
      return { kind: "unary", op: t.text, operand, start: t.start, end: operand.end };
    }
    return this.postfix(this.primary());
  }

  private args(): { args: Expr[]; end: number } {
    const args: Expr[] = [];
    if (!this.isOp(")")) {
      args.push(this.expression(0));
      while (this.isOp(",")) {
        this.next();
        args.push(this.expression(0));
      }
    }
    const close = this.expectOp(")");
    return { args, end: close.end };
  }

  private primary(): Expr {
    const t = this.next();
    switch (t.kind) {
      case "number":
        return { kind: "literal", type: "number", value: t.value as number, start: t.start, end: t.end };
      case "string":
        return { kind: "literal", type: "string", value: t.value as string, start: t.start, end: t.end };
      case "regexp":
        return { kind: "literal", type: "regexp", start: t.start, end: t.end };
      case "ident": {
        if (t.text === "true" || t.text === "false") {
          return { kind: "literal", type: "boolean", value: t.text === "true", start: t.start, end: t.end };
        }
        if (t.text === "null") return { kind: "literal", type: "null", start: t.start, end: t.end };
        if (this.isOp("(")) {
          this.next();
          const { args, end } = this.args();
          return { kind: "call", name: t.text, nameStart: t.start, args, start: t.start, end };
        }
        return { kind: "ident", name: t.text, start: t.start, end: t.end };
      }
      case "op": {
        if (t.text === "(") {
          const inner = this.expression(0);
          const close = this.expectOp(")");
          return { ...inner, start: t.start, end: close.end } as Expr;
        }
        if (t.text === "[") {
          const items: Expr[] = [];
          if (!this.isOp("]")) {
            items.push(this.expression(0));
            while (this.isOp(",")) {
              this.next();
              if (this.isOp("]")) break;
              items.push(this.expression(0));
            }
          }
          const close = this.expectOp("]");
          return { kind: "list", items, start: t.start, end: close.end };
        }
        return this.unexpected(t);
      }
      default:
        return this.unexpected(t);
    }
  }

  private postfix(base: Expr): Expr {
    let e = base;
    for (;;) {
      if (this.isOp(".")) {
        this.next();
        const n = this.peek();
        if (n.kind !== "ident") {
          if (n.kind === "eof") {
            fail("expected-name", this.srcLength, this.srcLength, {}, 'Expected a name after ".".');
          }
          fail("expected-name", n.start, n.end, {}, 'Expected a name after ".".');
        }
        this.next();
        if (this.isOp("(")) {
          this.next();
          const { args, end } = this.args();
          e = { kind: "method", object: e, name: n.text, nameStart: n.start, args, start: e.start, end };
        } else {
          e = { kind: "member", object: e, name: n.text, nameStart: n.start, start: e.start, end: n.end };
        }
      } else if (this.isOp("[")) {
        this.next();
        const index = this.expression(0);
        const close = this.expectOp("]");
        e = { kind: "index", object: e, index, start: e.start, end: close.end };
      } else {
        return e;
      }
    }
  }
}

/**
 * Parse one Bases expression. Never throws for bad input: a syntax error is
 * returned in `errors` and `ast` is null. Only the first error is reported.
 */
export function parseExpression(src: string): { ast: Expr | null; errors: ParseError[] } {
  const lexed = tokenize(src);
  if (lexed.error) return { ast: null, errors: [lexed.error] };
  try {
    return { ast: new Parser(lexed.tokens, src.length).parseAll(), errors: [] };
  } catch (e) {
    if (e instanceof Failure) return { ast: null, errors: [e.error] };
    if (e instanceof RangeError) {
      // Stack overflow on pathological input such as thousands of "!".
      const message = "The expression is nested too deeply.";
      return { ast: null, errors: [{ offset: 0, end: 1, code: "too-deep", params: {}, message }] };
    }
    throw e;
  }
}
