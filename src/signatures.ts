import raw from "./signatures.json" with { type: "json" };
import type { ValueType } from "./types.js";

/** One function or method signature, parsed from the `sig` text in signatures.json. */
export interface Signature {
  name: string;
  sig: string;
  min: number;
  /** `null` means variadic. */
  max: number | null;
  returns: ValueType | "same";
  /** Where the entry comes from when it is not on the current functions page. */
  source?: string;
}

interface RawEntry {
  sig: string;
  returns: string;
  source?: string;
}

function parseSig(name: string, entry: RawEntry): Signature {
  const open = entry.sig.indexOf("(");
  const close = entry.sig.lastIndexOf(")");
  const inner = entry.sig.slice(open + 1, close).trim();
  const params = inner === "" ? [] : inner.split(",").map((p) => p.trim());
  let min = 0;
  let max: number | null = 0;
  for (const p of params) {
    if (p.startsWith("...")) {
      min += 1;
      max = null;
    } else {
      if (!p.endsWith("?")) min += 1;
      if (max !== null) max += 1;
    }
  }
  const sig: Signature = { name, sig: entry.sig, min, max, returns: entry.returns as ValueType | "same" };
  if (entry.source) sig.source = entry.source;
  return sig;
}

function table(entries: Record<string, RawEntry>): Map<string, Signature> {
  return new Map(Object.entries(entries).map(([n, e]) => [n, parseSig(n, e)]));
}

const methodTables = new Map<string, Map<string, Signature>>(
  Object.entries(raw.methods as Record<string, Record<string, RawEntry>>).map(([t, e]) => [t, table(e)]),
);

export const GLOBALS: Map<string, Signature> = table(raw.globals as Record<string, RawEntry>);
export const FIELDS = new Map<string, Map<string, ValueType>>(
  Object.entries(raw.fields as Record<string, Record<string, string>>).map(([t, f]) => [
    t,
    new Map(Object.entries(f) as [string, ValueType][]),
  ]),
);
export const FILE_FIELDS = new Map<string, ValueType>(Object.entries(raw.fileFields) as [string, ValueType][]);
export const META = raw.meta;

/** Methods of one receiver type (not including the universal `any` methods). */
export function methodsOf(type: string): Map<string, Signature> {
  return methodTables.get(type) ?? new Map();
}

export const ANY_METHODS = methodsOf("any");

/** Every table name that holds methods, for coverage checks. */
export function methodTableNames(): string[] {
  return [...methodTables.keys()];
}

/** All method names across all tables (for suggestions). */
export function allMethodNames(): string[] {
  const out = new Set<string>();
  for (const t of methodTables.values()) for (const n of t.keys()) out.add(n);
  for (const t of FIELDS.values()) for (const n of t.keys()) out.add(n);
  return [...out];
}
