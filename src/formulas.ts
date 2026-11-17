import { walk, type Expr } from "./expr/ast.js";

export interface FormulaRef {
  name: string;
  start: number;
  end: number;
}

export interface Cycle {
  /** Formula names along the loop, ending with the first one again: a, b, a. */
  path: string[];
  /** The formula whose expression holds the reported reference. */
  owner: string;
  /** Offsets of the `formula.x` reference inside the owner's expression. */
  start: number;
  end: number;
}

/** Every `formula.name` and `formula["name"]` reference in an expression. */
export function formulaRefs(ast: Expr): FormulaRef[] {
  const refs: FormulaRef[] = [];
  walk(ast, (n) => {
    if (n.kind === "member" && n.object.kind === "ident" && n.object.name === "formula") {
      refs.push({ name: n.name, start: n.object.start, end: n.end });
    } else if (
      n.kind === "index" &&
      n.object.kind === "ident" &&
      n.object.name === "formula" &&
      n.index.kind === "literal" &&
      n.index.type === "string"
    ) {
      refs.push({ name: String(n.index.value), start: n.object.start, end: n.end });
    }
  });
  refs.sort((a, b) => a.start - b.start);
  return refs;
}

/**
 * Find loops in the formula dependency graph. Each loop is reported once, starting
 * from the formula that is defined first, at the reference that leaves it.
 */
export function findCycles(formulas: Map<string, { ast: Expr | null }>): Cycle[] {
  const refsOf = new Map<string, FormulaRef[]>();
  for (const [name, def] of formulas) refsOf.set(name, def.ast ? formulaRefs(def.ast) : []);
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const seen = new Set<string>();
  const cycles: Cycle[] = [];

  const visit = (name: string): void => {
    state.set(name, 1);
    stack.push(name);
    for (const ref of refsOf.get(name) ?? []) {
      if (!formulas.has(ref.name)) continue;
      const s = state.get(ref.name);
      if (s === 1) {
        const loop = stack.slice(stack.indexOf(ref.name));
        const key = [...loop].sort().join("\u0000");
        if (!seen.has(key)) {
          seen.add(key);
          const owner = loop[0]!;
          const next = loop[1] ?? owner;
          const edge = (refsOf.get(owner) ?? []).find((r) => r.name === next) ?? ref;
          cycles.push({ path: [...loop, owner], owner, start: edge.start, end: edge.end });
        }
      } else if (s === undefined) {
        visit(ref.name);
      }
    }
    stack.pop();
    state.set(name, 2);
  };

  for (const name of formulas.keys()) if (!state.has(name)) visit(name);
  return cycles;
}
