import type { ParseError } from "./ast.js";

export type TokenKind = "number" | "string" | "regexp" | "ident" | "op" | "eof";

export interface Token {
  kind: TokenKind;
  /** Source text of the token (for strings: with quotes). */
  text: string;
  /** Decoded value for strings and numbers. */
  value?: string | number;
  start: number;
  end: number;
}

const IDENT_START = /[\p{L}_$]/u;
const IDENT_PART = /[\p{L}\p{N}_$]/u;
const TWO_CHAR_OPS = new Set(["==", "!=", ">=", "<=", "&&", "||"]);
const ONE_CHAR_OPS = new Set(["+", "-", "*", "/", "%", "<", ">", "!", "(", ")", "[", "]", ",", ".", ":"]);

function perr(
  code: ParseError["code"],
  offset: number,
  end: number,
  params: Record<string, string>,
  message: string,
): ParseError {
  return { code, offset, end, params, message };
}

const ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"', "'": "'", "/": "/" };

/** Split an expression into tokens. Returns an error instead of throwing. */
export function tokenize(src: string): { tokens: Token[]; error?: ParseError } {
  const tokens: Token[] = [];
  let i = 0;
  // A "/" starts a regex only where a value is expected, not after a value (division).
  const valueEnded = (): boolean => {
    const t = tokens[tokens.length - 1];
    if (!t) return false;
    if (t.kind === "number" || t.kind === "string" || t.kind === "regexp" || t.kind === "ident") return true;
    return t.kind === "op" && (t.text === ")" || t.text === "]");
  };
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const start = i;
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(src[i + 1] ?? "") && !valueEnded())) {
      while (i < src.length && /[0-9]/.test(src[i]!)) i++;
      if (src[i] === "." && /[0-9]/.test(src[i + 1] ?? "")) {
        i++;
        while (i < src.length && /[0-9]/.test(src[i]!)) i++;
      }
      tokens.push({ kind: "number", text: src.slice(start, i), value: Number(src.slice(start, i)), start, end: i });
      continue;
    }
    if (ch === '"' || ch === "'") {
      let value = "";
      i++;
      let closed = false;
      while (i < src.length) {
        const c = src[i]!;
        if (c === "\\" && i + 1 < src.length) {
          const next = src[i + 1]!;
          value += ESCAPES[next] ?? next;
          i += 2;
          continue;
        }
        if (c === ch) {
          closed = true;
          i++;
          break;
        }
        value += c;
        i++;
      }
      if (!closed) {
        return {
          tokens,
          error: perr("unterminated-string", start, src.length, {}, "The string is not closed."),
        };
      }
      tokens.push({ kind: "string", text: src.slice(start, i), value, start, end: i });
      continue;
    }
    if (ch === "/" && !valueEnded()) {
      i++;
      let closed = false;
      let inClass = false;
      while (i < src.length) {
        const c = src[i]!;
        if (c === "\\") {
          i += 2;
          continue;
        }
        if (c === "[") inClass = true;
        else if (c === "]") inClass = false;
        else if (c === "/" && !inClass) {
          closed = true;
          i++;
          break;
        }
        i++;
      }
      if (!closed) {
        return {
          tokens,
          error: perr("unterminated-regex", start, src.length, {}, "The regular expression is not closed."),
        };
      }
      while (i < src.length && /[a-z]/i.test(src[i]!)) i++;
      tokens.push({ kind: "regexp", text: src.slice(start, i), start, end: i });
      continue;
    }
    if (IDENT_START.test(ch)) {
      i++;
      while (i < src.length && IDENT_PART.test(src[i]!)) i++;
      tokens.push({ kind: "ident", text: src.slice(start, i), start, end: i });
      continue;
    }
    const two = src.slice(i, i + 2);
    if (TWO_CHAR_OPS.has(two)) {
      tokens.push({ kind: "op", text: two, start, end: i + 2 });
      i += 2;
      continue;
    }
    if (ONE_CHAR_OPS.has(ch)) {
      tokens.push({ kind: "op", text: ch, start, end: i + 1 });
      i++;
      continue;
    }
    return {
      tokens,
      error: perr("invalid-char", start, start + 1, { char: ch }, `Unexpected character "${ch}".`),
    };
  }
  tokens.push({ kind: "eof", text: "", start: src.length, end: src.length });
  return { tokens };
}
