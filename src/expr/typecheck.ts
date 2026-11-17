import type { Finding } from "../rules.js";
import {
  ANY_METHODS,
  FIELDS,
  FILE_FIELDS,
  GLOBALS,
  allMethodNames,
  methodsOf,
  type Signature,
} from "../signatures.js";
import { suggest } from "../suggest.js";
import { BUILTIN_PROPERTIES } from "../vault.js";
import type { ValueType, VaultIndex } from "../types.js";
import type { Expr, Identifier, Member } from "./ast.js";

/** A type guess for a value: a set of possible types plus example notes per type. */
export interface Inferred {
  types: ValueType[];
  examples?: Partial<Record<ValueType, string[]>>;
}

export const ANY: Inferred = { types: ["any"] };
const just = (t: ValueType): Inferred => ({ types: [t] });

export function union(a: Inferred, b: Inferred): Inferred {
  if (a.types.includes("any") || b.types.includes("any")) return ANY;
  return { types: [...new Set([...a.types, ...b.types])] };
}

export interface FormulaDef {
  ast: Expr | null;
}

/** State shared by all expressions of one file. */
export interface Shared {
  vault?: VaultIndex;
  formulas: Map<string, FormulaDef>;
  formulaTypes: Map<string, Inferred>;
  busy: Set<string>;
  trace?: (entry: string) => void;
}

export interface Env {
  shared: Shared;
  report: (f: Finding) => void;
  /** Keys of one-per-file diagnostics already reported (mixed-type, empty-list-item). */
  seen: Set<string>;
}

type Scope = ReadonlyMap<string, Inferred>;
const EMPTY_SCOPE: Scope = new Map();

const hasOwn = (o: object, k: string): boolean => Object.hasOwn(o, k);

/** Names of the callback variables inside filter(), map() and reduce(). */
const LAMBDA_METHODS: Record<string, string[]> = {
  filter: ["value", "index"],
  map: ["value", "index"],
  reduce: ["value", "index", "acc"],
};

const concrete = (i: Inferred): ValueType[] => i.types.filter((t) => t !== "any" && t !== "null");
const isOpaque = (i: Inferred): boolean => i.types.includes("any") || concrete(i).length === 0;

function noteList(inferred: Inferred, types: ValueType[]): string[] {
  const out: string[] = [];
  for (const t of types) for (const n of inferred.examples?.[t] ?? []) if (!out.includes(n)) out.push(n);
  return out.slice(0, 3);
}

function notesParam(inferred: Inferred[], types: ValueType[]): { notes: string; noteList: string[] } {
  const list: string[] = [];
  for (const i of inferred) for (const n of noteList(i, types)) if (!list.includes(n)) list.push(n);
  return { notes: "", noteList: list.slice(0, 3) };
}

/**
 * The `notes` message parameter is a pre-translated fragment. The checker has no
 * language, so it passes the raw list under `notesList` and the pipeline expands it.
 */
function withNotes(params: Record<string, string | number>, list: string[]): Record<string, string | number> {
  return list.length > 0 ? { ...params, notesList: list.join(", ") } : params;
}

export function checkExpression(ast: Expr, env: Env, scope: Scope = EMPTY_SCOPE): Inferred {
  return infer(ast, env, scope);
}

function trace(env: Env, entry: string): void {
  env.shared.trace?.(entry);
}

function infer(node: Expr, env: Env, scope: Scope): Inferred {
  switch (node.kind) {
    case "literal":
      return just(node.type);
    case "list":
      node.items.forEach((n) => infer(n, env, scope));
      return just("list");
    case "ident":
      return inferIdent(node, env, scope);
    case "member":
      return inferMember(node, env, scope);
    case "index": {
      const key = node.index;
      if (key.kind === "literal" && key.type === "string" && node.object.kind === "ident") {
        const o = node.object;
        if (!scope.has(o.name) && (o.name === "file" || o.name === "note" || o.name === "formula")) {
          const synthetic: Member = {
            kind: "member",
            object: o,
            name: String(key.value),
            nameStart: key.start,
            start: node.start,
            end: node.end,
          };
          return inferMember(synthetic, env, scope);
        }
      }
      infer(node.object, env, scope);
      infer(node.index, env, scope);
      return ANY;
    }
    case "call":
      return inferCall(node, env, scope);
    case "method":
      return inferMethod(node, env, scope);
    case "unary": {
      const operand = infer(node.operand, env, scope);
      if (node.op === "!") return just("boolean");
      checkUnaryMinus(node.start, node.end, operand, env);
      return operand;
    }
    case "binary": {
      const left = infer(node.left, env, scope);
      const right = infer(node.right, env, scope);
      switch (node.op) {
        case "||":
        case "&&":
        case "==":
        case "!=":
        case "<":
        case ">":
        case "<=":
        case ">=":
          return just("boolean");
        default:
          return arithmetic(node.op, node.opStart, left, right, env);
      }
    }
  }
}

// ---- identifiers and properties ----

function inferIdent(node: Identifier, env: Env, scope: Scope): Inferred {
  const local = scope.get(node.name);
  if (local) return local;
  switch (node.name) {
    case "file":
      return just("file");
    case "note":
    case "formula":
      return just("object");
    case "this":
      return ANY;
    default:
      return propertyRef(node.name, node.start, node.end, env);
  }
}

function propertyRef(name: string, start: number, end: number, env: Env): Inferred {
  const vault = env.shared.vault;
  if (!vault || vault.notes === 0) return ANY;
  const info = hasOwn(vault.properties, name) ? vault.properties[name] : undefined;
  if (!info) {
    const builtin = hasOwn(BUILTIN_PROPERTIES, name) ? BUILTIN_PROPERTIES[name] : undefined;
    if (builtin) return just(builtin);
    const near = suggest(name, [...Object.keys(vault.properties), ...Object.keys(BUILTIN_PROPERTIES)]);
    env.report({
      rule: "unknown-property",
      start,
      end,
      msg: "unknown-property.note",
      params: { name, count: vault.notes },
      ...(near
        ? { hint: "hint.suggest" as const, hintParams: { suggestion: near } }
        : { hint: "unknown-property.hint-note" as const }),
    });
    return ANY;
  }
  if (info.emptyItemNotes.length > 0 && !env.seen.has(`empty:${name}`)) {
    env.seen.add(`empty:${name}`);
    env.report({
      rule: "empty-list-item",
      start,
      end,
      msg: "empty-list-item.msg",
      params: withNotes({ name }, info.emptyItemNotes),
      hint: "empty-list-item.hint",
    });
  }
  if (info.types.length > 1 && !env.seen.has(`mixed:${name}`)) {
    env.seen.add(`mixed:${name}`);
    const list: string[] = [];
    for (const t of info.types) for (const n of (info.examples[t] ?? []).slice(0, 1)) list.push(n);
    env.report({
      rule: "mixed-type",
      start,
      end,
      msg: "mixed-type.msg",
      params: withNotes({ name, types: info.types.join(", ") }, list),
      hint: "mixed-type.hint",
    });
  }
  if (info.types.length === 0) return ANY;
  return { types: info.types, examples: info.examples };
}

function formulaRef(name: string, start: number, end: number, env: Env): Inferred {
  const shared = env.shared;
  if (!shared.formulas.has(name)) {
    const near = suggest(name, shared.formulas.keys());
    env.report({
      rule: "formula-undefined",
      start,
      end,
      msg: "formula-undefined.msg",
      params: { name },
      ...(near
        ? { hint: "hint.suggest" as const, hintParams: { suggestion: `formula.${near}` } }
        : { hint: "formula-undefined.hint" as const, hintParams: { name } }),
    });
    return ANY;
  }
  return formulaType(name, shared, env);
}

/** Type of a formula, inferred once without reporting (its own site reports). */
function formulaType(name: string, shared: Shared, env: Env): Inferred {
  const cached = shared.formulaTypes.get(name);
  if (cached) return cached;
  if (shared.busy.has(name)) return ANY;
  const ast = shared.formulas.get(name)?.ast;
  if (!ast) return ANY;
  shared.busy.add(name);
  const silent: Env = { shared: { ...shared, trace: undefined }, report: () => undefined, seen: new Set() };
  let result: Inferred;
  try {
    result = infer(ast, silent, EMPTY_SCOPE);
  } finally {
    shared.busy.delete(name);
  }
  void env;
  shared.formulaTypes.set(name, result);
  return result;
}

// ---- members (fields) ----

function inferMember(node: Member, env: Env, scope: Scope): Inferred {
  const obj = node.object;
  if (obj.kind === "ident" && !scope.has(obj.name)) {
    switch (obj.name) {
      case "file":
        return fileField(node, env);
      case "note":
        return propertyRef(node.name, obj.start, node.end, env);
      case "formula":
        return formulaRef(node.name, obj.start, node.end, env);
      case "this":
        return ANY;
      default:
        break;
    }
  }
  const recv = infer(obj, env, scope);
  return fieldOf(recv, node, env);
}

function fileField(node: Member, env: Env): Inferred {
  const type = FILE_FIELDS.get(node.name);
  if (type) {
    trace(env, `fileFields.${node.name}`);
    return just(type);
  }
  const all = [...FILE_FIELDS.keys()];
  const near = suggest(node.name, all);
  env.report({
    rule: "unknown-property",
    severity: "error",
    start: node.nameStart,
    end: node.nameStart + node.name.length,
    msg: "unknown-property.file",
    params: { name: node.name },
    ...(near
      ? { hint: "hint.suggest" as const, hintParams: { suggestion: `file.${near}` } }
      : { hint: "unknown-property.hint-file" as const, hintParams: { list: all.join(", ") } }),
  });
  return ANY;
}

/** Table names where `name` is a known field or method (for "it exists on ..." messages). */
function ownersOf(name: string, kind: "field" | "method"): string[] {
  const owners: string[] = [];
  if (kind === "field") {
    for (const [t, f] of FIELDS) if (f.has(name)) owners.push(t);
  } else {
    for (const t of ["string", "number", "list", "date", "file", "link", "object", "regexp"]) {
      if (methodsOf(t).has(name)) owners.push(t);
    }
  }
  return owners;
}

function fieldOf(recv: Inferred, node: Member, env: Env): Inferred {
  const name = node.name;
  const start = node.nameStart;
  const end = start + name.length;
  const fieldOwners = ownersOf(name, "field");
  const isMethodName = ownersOf(name, "method").length > 0 || ANY_METHODS.has(name);
  if (isOpaque(recv)) {
    // Unknown receiver: objects may hold any key, so a field access is never an error.
    if (fieldOwners.length === 1) return just(FIELDS.get(fieldOwners[0]!)!.get(name)!);
    return ANY;
  }
  const types = concrete(recv);
  const found: Inferred[] = [];
  const missing: ValueType[] = [];
  for (const t of types) {
    if (t === "object") {
      found.push(ANY);
      continue;
    }
    const table = t === "file" ? new Map(FILE_FIELDS) : FIELDS.get(t);
    const ft = table?.get(name);
    if (ft) {
      trace(env, t === "file" ? `fileFields.${name}` : `fields.${t}.${name}`);
      found.push(just(ft));
    } else {
      missing.push(t);
    }
  }
  if (missing.length === 0) return found.reduce(union, found[0]!);
  const known = fieldOwners.length > 0 || isMethodName;
  if (!known && found.length === 0) {
    reportUnknownMember(name, start, end, types, env);
    return ANY;
  }
  const all = found.length === 0;
  const { noteList: notes } = notesParam([recv], missing);
  // 필드가 아니라 메서드 이름을 괄호 없이 쓴 경우(file.name.lower, x.isTruthy):
  // "어느 형식에 있다"가 아니라 "괄호를 붙여 호출하라"고 알려 준다.
  // (모든 형식에 있는 isTruthy 같은 메서드는 owners 가 비어 문구가 깨지던 경로다.)
  const calledWrong = fieldOwners.length === 0 && (ANY_METHODS.has(name) || missing.some((t) => methodsOf(t).has(name)));
  if (calledWrong) {
    env.report({
      rule: "type-mismatch",
      severity: all ? "error" : "warning",
      start,
      end,
      msg: "type-mismatch.method-as-field",
      params: withNotes({ name }, notes),
      hint: "type-mismatch.hint-call",
      hintParams: { name },
    });
    return found.length > 0 ? found.reduce(union, found[0]!) : ANY;
  }
  // 여기까지 오면 owners 는 비어 있지 않다(필드 주인이 있거나, 다른 형식의 메서드다).
  const owners = (fieldOwners.length > 0 ? fieldOwners : ownersOf(name, "method")).join(", ");
  env.report({
    rule: "type-mismatch",
    severity: all ? "error" : "warning",
    start,
    end,
    msg: all ? "type-mismatch.access-error" : "type-mismatch.access-warning",
    params: withNotes({ what: `.${name}`, types: missing.join(", "), owners }, notes),
    hint: "type-mismatch.hint-access",
    hintParams: { owners },
  });
  return found.length > 0 ? found.reduce(union, found[0]!) : ANY;
}

function reportUnknownMember(name: string, start: number, end: number, types: ValueType[], env: Env): void {
  const near = suggest(name, candidatesFor(types));
  // 값의 형식을 모르면(볼트 없음, 어느 노트에도 없는 속성) {types} 가 비므로
  // 형식 이름 없는 문구를 따로 쓴다("for ." 처럼 빈칸이 남지 않게).
  env.report({
    rule: "unknown-method",
    start,
    end,
    msg: types.length > 0 ? "unknown-method.msg" : "unknown-method.msg-any",
    params: types.length > 0 ? { name, types: types.join(", ") } : { name },
    ...(near
      ? { hint: "hint.suggest" as const, hintParams: { suggestion: near } }
      : { hint: "unknown-method.hint" as const }),
  });
}

function candidatesFor(types: ValueType[]): string[] {
  if (types.length === 0) return allMethodNames();
  const out = new Set<string>(ANY_METHODS.keys());
  for (const t of types) {
    for (const n of methodsOf(t).keys()) out.add(n);
    for (const n of FIELDS.get(t)?.keys() ?? []) out.add(n);
    if (t === "file") for (const n of FILE_FIELDS.keys()) out.add(n);
  }
  return [...out];
}

// ---- calls ----

function arityMessage(
  name: string,
  min: number,
  max: number | null,
  count: number,
): { msg: Finding["msg"]; params: Record<string, string | number> } {
  if (max === null) return { msg: "wrong-arity.min", params: { name, min, count } };
  if (min === max) return { msg: "wrong-arity.exact", params: { name, min, count } };
  return { msg: "wrong-arity.range", params: { name, min, max, count } };
}

function checkArity(
  name: string,
  sigs: Signature[],
  count: number,
  start: number,
  end: number,
  env: Env,
): void {
  const min = Math.min(...sigs.map((s) => s.min));
  const maxes = sigs.map((s) => s.max);
  const max = maxes.includes(null) ? null : Math.max(...(maxes as number[]));
  if (count >= min && (max === null || count <= max)) return;
  const { msg, params } = arityMessage(name, min, max, count);
  env.report({
    rule: "wrong-arity",
    start,
    end,
    msg,
    params,
    hint: "wrong-arity.hint",
    hintParams: { sig: sigs.map((s) => s.sig).join(" | ") },
  });
}

function inferCall(node: Extract<Expr, { kind: "call" }>, env: Env, scope: Scope): Inferred {
  const args = node.args.map((a) => infer(a, env, scope));
  const sig = GLOBALS.get(node.name);
  const nameEnd = node.nameStart + node.name.length;
  if (!sig) {
    const near = suggest(node.name, GLOBALS.keys());
    env.report({
      rule: "unknown-function",
      start: node.nameStart,
      end: nameEnd,
      msg: "unknown-function.msg",
      params: { name: node.name },
      ...(near
        ? { hint: "hint.suggest" as const, hintParams: { suggestion: `${near}()` } }
        : { hint: "unknown-function.hint" as const, hintParams: { list: [...GLOBALS.keys()].join(", ") } }),
    });
    return ANY;
  }
  trace(env, `globals.${node.name}`);
  checkArity(node.name, [sig], node.args.length, node.nameStart, nameEnd, env);
  if (node.name === "if") {
    const a = args[1];
    const b = args[2];
    if (a && b) return union(a, b);
    return ANY;
  }
  return sig.returns === "same" ? ANY : just(sig.returns);
}

function inferMethod(node: Extract<Expr, { kind: "method" }>, env: Env, scope: Scope): Inferred {
  const recv = infer(node.object, env, scope);
  const name = node.name;
  const start = node.nameStart;
  const end = start + name.length;
  const lambda = hasOwn(LAMBDA_METHODS, name) ? LAMBDA_METHODS[name] : undefined;
  const argScope: Scope = lambda ? new Map([...scope, ...lambda.map((n): [string, Inferred] => [n, ANY])]) : scope;
  node.args.forEach((a) => infer(a, env, argScope));

  const types = concrete(recv);
  const opaque = isOpaque(recv);
  const tablesToSearch = opaque ? ["string", "number", "list", "date", "file", "link", "object", "regexp"] : types;

  const found: { type: ValueType | "any"; sig: Signature }[] = [];
  const missing: ValueType[] = [];
  const anySig = ANY_METHODS.get(name);
  if (anySig) {
    found.push({ type: "any", sig: anySig });
  } else {
    for (const t of tablesToSearch) {
      const s = methodsOf(t).get(name);
      if (s) found.push({ type: t as ValueType, sig: s });
      else missing.push(t as ValueType);
    }
  }

  const owners = ownersOf(name, "method");
  if (found.length === 0) {
    if (owners.length === 0) {
      // Not a method of any type we know: probably a typo or a plugin method.
      reportUnknownMember(name, start, end, opaque ? [] : types, env);
    } else {
      // Exists, but on other types than this value can have: certain failure.
      const { noteList: notes } = notesParam([recv], missing);
      env.report({
        rule: "type-mismatch",
        severity: "error",
        start,
        end,
        msg: "type-mismatch.access-error",
        params: withNotes({ what: `${name}()`, types: missing.join(", "), owners: owners.join(", ") }, notes),
        hint: "type-mismatch.hint-access",
        hintParams: { owners: owners.join(", ") },
      });
    }
    return ANY;
  }
  if (!opaque && missing.length > 0) {
    // Fails for some of the possible types only (for example in some notes).
    const { noteList: notes } = notesParam([recv], missing);
    env.report({
      rule: "type-mismatch",
      severity: "warning",
      start,
      end,
      msg: "type-mismatch.access-warning",
      params: withNotes({ what: `${name}()`, types: missing.join(", "), owners: owners.join(", ") }, notes),
      hint: "type-mismatch.hint-access",
      hintParams: { owners: owners.join(", ") },
    });
  }
  const usable = found;
  for (const f of usable) trace(env, `methods.${f.type}.${name}`);
  const sigs = [...new Map(usable.map((f) => [f.sig.sig, f.sig])).values()];
  checkArity(name, sigs, node.args.length, start, end, env);

  const returns = usable.map((f) => {
    const r = f.sig.returns;
    if (r === "same") return f.type === "any" ? ANY : just(f.type);
    return just(r);
  });
  return returns.length === 0 ? ANY : returns.reduce(union, returns[0]!);
}

// ---- operators ----

function pairResult(op: string, l: ValueType, r: ValueType): ValueType | null {
  if (l === "any" || r === "any" || l === "null" || r === "null") return "any";
  switch (op) {
    case "+":
      if (l === "date" && r === "string") return "date";
      if (l === "string" || r === "string") return "string";
      if (l === "number" && r === "number") return "number";
      if (l === "date" && (r === "duration" || r === "number")) return "date";
      if (l === "duration" && r === "date") return "date";
      if (l === "duration" && (r === "duration" || r === "number")) return "duration";
      return null;
    case "-":
      if (l === "number" && r === "number") return "number";
      if (l === "date" && r === "date") return "duration";
      if (l === "date" && (r === "duration" || r === "string" || r === "number")) return "date";
      if (l === "duration" && r === "duration") return "duration";
      return null;
    case "*":
      if (l === "number" && r === "number") return "number";
      if ((l === "duration" && r === "number") || (l === "number" && r === "duration")) return "duration";
      return null;
    case "/":
      if (l === "number" && r === "number") return "number";
      if (l === "duration" && r === "number") return "duration";
      if (l === "duration" && r === "duration") return "number";
      return null;
    case "%":
      return l === "number" && r === "number" ? "number" : null;
    default:
      return "any";
  }
}

function arithmetic(op: string, opStart: number, left: Inferred, right: Inferred, env: Env): Inferred {
  const results: ValueType[] = [];
  const bad = new Set<ValueType>();
  let good = 0;
  let total = 0;
  for (const l of left.types) {
    for (const r of right.types) {
      total++;
      const res = pairResult(op, l, r);
      if (res === null) {
        // Blame the operand that cannot do arithmetic at all, otherwise both.
        const lOk = pairResult(op, l, "number") !== null || pairResult(op, l, "duration") !== null;
        if (!lOk) bad.add(l);
        else bad.add(r);
      } else {
        good++;
        if (!results.includes(res)) results.push(res);
      }
    }
  }
  if (bad.size > 0) {
    const all = good === 0;
    const types = [...bad];
    const { noteList: notes } = notesParam([left, right], types);
    env.report({
      rule: "type-mismatch",
      severity: all ? "error" : "warning",
      start: opStart,
      end: opStart + op.length,
      msg: all ? "type-mismatch.op-error" : "type-mismatch.op-warning",
      params: withNotes({ op, types: types.join(", ") }, notes),
      hint: "type-mismatch.hint-op",
    });
  }
  void total;
  return results.length === 0 ? ANY : results.includes("any") ? ANY : { types: results };
}

function checkUnaryMinus(start: number, end: number, operand: Inferred, env: Env): void {
  const bad = concrete(operand).filter((t) => t !== "number" && t !== "duration");
  if (bad.length === 0 || isOpaque(operand)) return;
  const all = bad.length === concrete(operand).length;
  const { noteList: notes } = notesParam([operand], bad);
  env.report({
    rule: "type-mismatch",
    severity: all ? "error" : "warning",
    start,
    end: start + 1,
    msg: all ? "type-mismatch.op-error" : "type-mismatch.op-warning",
    params: withNotes({ op: "-", types: bad.join(", ") }, notes),
    hint: "type-mismatch.hint-op",
  });
  void end;
}

/**
 * Check a property name written outside an expression (view order, sort, groupBy,
 * summaries keys). `start`/`end` are offsets of the name; only unknown-property and
 * formula-undefined are reported here.
 */
export function checkPropertyName(name: string, start: number, end: number, shared: Shared, report: (f: Finding) => void): void {
  const env: Env = {
    shared: { ...shared, trace: undefined },
    seen: new Set(),
    report: (f) => {
      if (f.rule === "unknown-property" || f.rule === "formula-undefined") report(f);
    },
  };
  const dot = name.indexOf(".");
  const prefix = dot < 0 ? "" : name.slice(0, dot);
  const rest = dot < 0 ? name : name.slice(dot + 1);
  if (name === "this" || prefix === "this") return;
  if (prefix === "file") {
    if (!FILE_FIELDS.has(rest)) {
      const all = [...FILE_FIELDS.keys()];
      const near = suggest(rest, all);
      report({
        rule: "unknown-property",
        severity: "error",
        start: start + dot + 1,
        end: start + dot + 1 + rest.length,
        msg: "unknown-property.file",
        params: { name: rest },
        ...(near
          ? { hint: "hint.suggest" as const, hintParams: { suggestion: `file.${near}` } }
          : { hint: "unknown-property.hint-file" as const, hintParams: { list: all.join(", ") } }),
      });
    }
    return;
  }
  if (prefix === "formula") {
    formulaRef(rest, start, end, env);
    return;
  }
  if (name === "file" || name === "formula" || name === "note") return;
  propertyRef(prefix === "note" ? rest : name, start, end, env);
}
