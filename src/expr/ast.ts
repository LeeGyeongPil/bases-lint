/** Expression syntax tree. Offsets are 0-based UTF-16 positions in the expression text. */

interface Base {
  start: number;
  /** Exclusive end offset. */
  end: number;
}

export interface Literal extends Base {
  kind: "literal";
  type: "string" | "number" | "boolean" | "null" | "regexp";
  value?: string | number | boolean;
}

export interface ListLiteral extends Base {
  kind: "list";
  items: Expr[];
}

export interface Identifier extends Base {
  kind: "ident";
  name: string;
}

export interface Member extends Base {
  kind: "member";
  object: Expr;
  name: string;
  nameStart: number;
}

export interface Index extends Base {
  kind: "index";
  object: Expr;
  index: Expr;
}

export interface Call extends Base {
  kind: "call";
  name: string;
  nameStart: number;
  args: Expr[];
}

export interface MethodCall extends Base {
  kind: "method";
  object: Expr;
  name: string;
  nameStart: number;
  args: Expr[];
}

export interface Unary extends Base {
  kind: "unary";
  op: "!" | "-";
  operand: Expr;
}

export interface Binary extends Base {
  kind: "binary";
  op: string;
  opStart: number;
  left: Expr;
  right: Expr;
}

export type Expr = Literal | ListLiteral | Identifier | Member | Index | Call | MethodCall | Unary | Binary;

export interface ParseError {
  /** Offset of the problem in the expression text. */
  offset: number;
  end: number;
  /** Stable code, also the message key suffix. */
  code: "unexpected-token" | "unexpected-end" | "expected-token" | "expected-token-end" | "unterminated-string" | "unterminated-regex" | "invalid-char" | "empty" | "too-deep" | "expected-name";
  params: Record<string, string>;
  /** English message for library users. */
  message: string;
}

/** Visit every node, parents before children. */
export function walk(node: Expr, visit: (n: Expr) => void): void {
  visit(node);
  switch (node.kind) {
    case "list":
      node.items.forEach((n) => walk(n, visit));
      break;
    case "member":
      walk(node.object, visit);
      break;
    case "index":
      walk(node.object, visit);
      walk(node.index, visit);
      break;
    case "call":
      node.args.forEach((n) => walk(n, visit));
      break;
    case "method":
      walk(node.object, visit);
      node.args.forEach((n) => walk(n, visit));
      break;
    case "unary":
      walk(node.operand, visit);
      break;
    case "binary":
      walk(node.left, visit);
      walk(node.right, visit);
      break;
    default:
      break;
  }
}
