import type { Scalar } from "yaml";

/**
 * The decoded text of a YAML scalar plus a map from each character of that text
 * back to its offset in the file. This is what lets an error at "character 11 of
 * the expression" be reported at the right line and column of the .base file, even
 * when quotes, escapes or block-scalar indentation shift the characters.
 */
export interface ScalarText {
  text: string;
  /** Source offset of text[i]; `map(text.length)` is the end position. */
  map: (index: number) => number;
}

const SIMPLE_ESCAPES: Record<string, string> = {
  "0": "\0",
  a: "\x07",
  b: "\b",
  t: "\t",
  "\t": "\t",
  n: "\n",
  v: "\v",
  f: "\f",
  r: "\r",
  e: "\x1b",
  " ": " ",
  '"': '"',
  "/": "/",
  "\\": "\\",
  N: "\u0085",
  _: " ",
  L: " ",
  P: " ",
};

function identity(text: string, start: number): ScalarText {
  return { text, map: (i) => start + Math.min(i, text.length) };
}

function fromOffsets(text: string, offsets: number[]): ScalarText {
  return { text, map: (i) => offsets[Math.min(i, offsets.length - 1)]! };
}

/** Decode a plain, single-quoted or double-quoted scalar body, recording offsets. */
function cookFlow(src: string, from: number, to: number, kind: "plain" | "single" | "double"): ScalarText {
  let text = "";
  const offsets: number[] = [];
  const push = (s: string, at: number): void => {
    for (let k = 0; k < s.length; k++) {
      text += s[k];
      offsets.push(at);
    }
  };
  let i = from;
  while (i < to) {
    const c = src[i]!;
    if (c === "\n" || c === "\r") {
      // Line folding: trailing blanks are dropped, one break becomes a space.
      while (text.endsWith(" ") || text.endsWith("\t")) {
        text = text.slice(0, -1);
        offsets.pop();
      }
      const breakAt = i;
      let j = i;
      let breaks = 0;
      while (j < to) {
        if (src[j] === "\r" && src[j + 1] === "\n") {
          j += 2;
          breaks++;
        } else if (src[j] === "\n" || src[j] === "\r") {
          j++;
          breaks++;
        } else if (src[j] === " " || src[j] === "\t") {
          j++;
        } else {
          break;
        }
      }
      if (breaks === 1) push(" ", breakAt);
      else push("\n".repeat(breaks - 1), breakAt);
      i = j;
      continue;
    }
    if (kind === "single" && c === "'" && src[i + 1] === "'") {
      push("'", i);
      i += 2;
      continue;
    }
    if (kind === "double" && c === "\\") {
      const n = src[i + 1] ?? "";
      if (n === "\n" || n === "\r") {
        // Escaped line break: join the lines without a space.
        let j = i + 1;
        if (src[j] === "\r" && src[j + 1] === "\n") j++;
        j++;
        while (j < to && (src[j] === " " || src[j] === "\t")) j++;
        i = j;
        continue;
      }
      if (n === "x" || n === "u" || n === "U") {
        const len = n === "x" ? 2 : n === "u" ? 4 : 8;
        const hex = src.slice(i + 2, i + 2 + len);
        if (/^[0-9a-fA-F]+$/.test(hex) && hex.length === len) {
          push(String.fromCodePoint(parseInt(hex, 16)), i);
          i += 2 + len;
          continue;
        }
      }
      push(SIMPLE_ESCAPES[n] ?? n, i);
      i += 2;
      continue;
    }
    push(c, i);
    i++;
  }
  offsets.push(to);
  return fromOffsets(text, offsets);
}

/** Decode a block scalar (`|` or `>`), recording offsets. */
function cookBlock(src: string, from: number, to: number, folded: boolean): ScalarText | null {
  const headerEnd = src.indexOf("\n", from);
  if (headerEnd === -1 || headerEnd >= to) return null;
  const contentStart = headerEnd + 1;
  // Split the content into lines, remembering where each starts.
  const lines: { start: number; text: string }[] = [];
  let pos = contentStart;
  while (pos < to) {
    let nl = src.indexOf("\n", pos);
    if (nl === -1 || nl > to) nl = to;
    let end = nl;
    if (src[end - 1] === "\r") end--;
    lines.push({ start: pos, text: src.slice(pos, end) });
    pos = nl + 1;
  }
  const first = lines.find((l) => l.text.trim() !== "");
  if (!first) return null;
  const indent = first.text.length - first.text.trimStart().length;
  let text = "";
  const offsets: number[] = [];
  const push = (s: string, at: number): void => {
    for (let k = 0; k < s.length; k++) {
      text += s[k];
      offsets.push(at);
    }
  };
  let pendingBlank = 0;
  let wroteLine = false;
  for (const line of lines) {
    const blank = line.text.trim() === "";
    if (blank) {
      pendingBlank++;
      continue;
    }
    const lead = Math.min(line.text.length - line.text.trimStart().length, indent);
    const moreIndented = line.text.length - line.text.trimStart().length > indent;
    if (wroteLine) {
      const breakAt = line.start - 1;
      if (!folded) push("\n".repeat(pendingBlank + 1), breakAt);
      else if (pendingBlank > 0) push("\n".repeat(pendingBlank), breakAt);
      else if (moreIndented) push("\n", breakAt);
      else push(" ", breakAt);
    }
    pendingBlank = 0;
    for (let k = lead; k < line.text.length; k++) push(line.text[k]!, line.start + k);
    wroteLine = true;
  }
  offsets.push(lines.length > 0 ? lines[lines.length - 1]!.start + lines[lines.length - 1]!.text.length : to);
  return fromOffsets(text, offsets);
}

/** Decoded text and offset map for a scalar node, or null when it has no source range. */
export function scalarText(src: string, node: Scalar): ScalarText | null {
  const range = node.range;
  if (!range) return null;
  const [start, valueEnd] = range;
  const value = node.value;
  if (typeof value !== "string") {
    // Numbers and booleans: the source text is the expression.
    const text = src.slice(start, valueEnd).trim();
    return identity(text, start);
  }
  let cooked: ScalarText | null = null;
  switch (node.type) {
    case "QUOTE_DOUBLE":
      cooked = cookFlow(src, start + 1, valueEnd - 1, "double");
      break;
    case "QUOTE_SINGLE":
      cooked = cookFlow(src, start + 1, valueEnd - 1, "single");
      break;
    case "BLOCK_LITERAL":
      cooked = cookBlock(src, start, valueEnd, false);
      break;
    case "BLOCK_FOLDED":
      cooked = cookBlock(src, start, valueEnd, true);
      break;
    default:
      cooked = cookFlow(src, start, valueEnd, "plain");
      break;
  }
  if (cooked && cooked.text.trimEnd() === value.trimEnd()) {
    const text = cooked.text.trimEnd();
    return { text, map: cooked.map };
  }
  // Fallback when our decoding disagrees with the YAML library: keep the library's
  // value and map by simple offset from the start of the scalar body.
  const quoted = node.type === "QUOTE_DOUBLE" || node.type === "QUOTE_SINGLE";
  return identity(value.trimEnd(), start + (quoted ? 1 : 0));
}
