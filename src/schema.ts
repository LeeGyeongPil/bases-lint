import { isMap, isScalar, isSeq, type Document, type Node, type Pair, type Scalar, type YAMLMap } from "yaml";
import type { Finding } from "./rules.js";
import { suggest } from "./suggest.js";

/** One expression written as a YAML string. */
export interface ExprSite {
  node: Scalar;
  kind: "filter" | "formula" | "summary" | "property";
  /** Formula or summary name. */
  name?: string;
}

export interface SchemaResult {
  findings: Finding[];
  sites: ExprSite[];
}

export const TOP_LEVEL_KEYS = ["filters", "formulas", "properties", "summaries", "views"];
export const CORE_VIEW_TYPES = ["table", "cards", "list", "map"];
export const BUILTIN_SUMMARIES = [
  "Average",
  "Min",
  "Max",
  "Sum",
  "Range",
  "Median",
  "Stddev",
  "Earliest",
  "Latest",
  "Checked",
  "Unchecked",
  "Empty",
  "Filled",
  "Unique",
];
const FILTER_KEYS = ["and", "or", "not"];

function range(node: Node | null | undefined): [number, number] {
  const r = node?.range;
  return r ? [r[0], r[1]] : [0, 0];
}

function keyName(pair: Pair): string | undefined {
  return isScalar(pair.key) && typeof pair.key.value === "string" ? pair.key.value : undefined;
}

function shown(node: unknown): string {
  return isScalar(node) ? String(node.value) : "(not a single value)";
}

/**
 * Check the shape of a parsed base document (top-level keys, views, filters, sort,
 * summaries) and collect every expression string for the expression checkers.
 * Offsets in the findings are positions in the file text.
 */
export function checkSchema(doc: Document.Parsed): SchemaResult {
  const findings: Finding[] = [];
  const sites: ExprSite[] = [];
  const root = doc.contents;
  if (root === null || root === undefined) return { findings, sites };
  if (!isMap(root)) {
    const [s, e] = range(root);
    findings.push({ rule: "yaml-syntax", start: s, end: Math.max(e, s + 1), msg: "yaml-syntax.root", hint: "yaml-syntax.hint" });
    return { findings, sites };
  }

  const topSummaries = new Set<string>();
  for (const pair of root.items) {
    if (keyName(pair) === "summaries" && isMap(pair.value)) {
      for (const p of pair.value.items) {
        const n = keyName(p);
        if (n) topSummaries.add(n);
      }
    }
  }

  const addSite = (node: Node | null | undefined, kind: ExprSite["kind"], name?: string): void => {
    if (isScalar(node) && node.value !== null && node.value !== undefined) {
      sites.push({ node, kind, ...(name ? { name } : {}) });
    }
  };

  function walkFilter(node: unknown): void {
    if (node === null || node === undefined) return;
    if (isScalar(node)) {
      if (node.value === null) return;
      if (typeof node.value === "string") {
        addSite(node, "filter");
      } else {
        const [s, e] = range(node);
        findings.push({ rule: "filter-shape", start: s, end: e, msg: "filter-shape.item", hint: "filter-shape.hint.item" });
      }
      return;
    }
    if (isMap(node)) {
      filterObject(node);
      return;
    }
    const [s, e] = range(node as Node);
    findings.push({ rule: "filter-shape", start: s, end: e, msg: "filter-shape.item", hint: "filter-shape.hint.item" });
  }

  function filterObject(map: YAMLMap): void {
    if (map.items.length > 1) {
      const second = map.items[1]!.key as Node;
      const [s, e] = range(second);
      findings.push({
        rule: "filter-shape",
        start: s,
        end: e,
        msg: "filter-shape.multi",
        params: { count: map.items.length },
        hint: "filter-shape.hint.multi",
      });
    }
    for (const pair of map.items) {
      const key = keyName(pair);
      const [ks, ke] = range(pair.key as Node);
      if (key === undefined || !FILTER_KEYS.includes(key)) {
        const near = key === undefined ? undefined : suggest(key, FILTER_KEYS);
        findings.push({
          rule: "filter-shape",
          start: ks,
          end: ke,
          msg: "filter-shape.key",
          params: { key: key ?? "?" },
          ...(near
            ? { hint: "hint.suggest" as const, hintParams: { suggestion: near } }
            : { hint: "filter-shape.hint.key" as const }),
        });
        continue;
      }
      if (!isSeq(pair.value)) {
        const [vs, ve] = pair.value ? range(pair.value as Node) : [ke, ke + 1];
        findings.push({
          rule: "filter-shape",
          start: vs,
          end: Math.max(ve, vs + 1),
          msg: "filter-shape.not-list",
          params: { key },
          hint: "filter-shape.hint.not-list",
          hintParams: { key },
        });
        continue;
      }
      for (const item of pair.value.items) walkFilter(item);
    }
  }

  function checkDirection(value: unknown): void {
    if (value === null || value === undefined) return;
    if (!isScalar(value) || (value.value !== "ASC" && value.value !== "DESC")) {
      const [s, e] = range(value as Node);
      findings.push({
        rule: "view-shape",
        start: s,
        end: e,
        msg: "view-shape.direction",
        params: { value: shown(value) },
        hint: "view-shape.hint.direction",
      });
    }
  }

  function checkView(view: unknown): void {
    if (!isMap(view)) {
      const [s, e] = range(view as Node);
      findings.push({ rule: "view-shape", start: s, end: Math.max(e, s + 1), msg: "view-shape.view-not-map", hint: "view-shape.hint.view" });
      return;
    }
    const get = (name: string): Pair | undefined => view.items.find((p) => keyName(p) === name);
    const typePair = get("type");
    if (!typePair) {
      const first = view.items[0]?.key as Node | undefined;
      const [s] = range(view);
      const e = first ? range(first)[1] : s + 1;
      findings.push({ rule: "view-shape", start: s, end: e, msg: "view-shape.type-missing", hint: "view-shape.hint.type" });
    } else if (!isScalar(typePair.value) || typeof typePair.value.value !== "string") {
      const [s, e] = range(typePair.value as Node);
      findings.push({ rule: "view-shape", start: s, end: Math.max(e, s + 1), msg: "view-shape.type-not-string", hint: "view-shape.hint.type" });
    } else if (!CORE_VIEW_TYPES.includes(typePair.value.value)) {
      const [s, e] = range(typePair.value);
      findings.push({
        rule: "view-type-unknown",
        start: s,
        end: e,
        msg: "view-type-unknown.msg",
        params: { type: typePair.value.value },
        hint: "view-type-unknown.hint",
      });
    }

    const limit = get("limit")?.value;
    if (limit !== undefined && limit !== null) {
      const ok = isScalar(limit) && typeof limit.value === "number" && Number.isInteger(limit.value) && limit.value >= 0;
      if (!ok && !(isScalar(limit) && limit.value === null)) {
        const [s, e] = range(limit as Node);
        findings.push({
          rule: "view-shape",
          start: s,
          end: e,
          msg: "view-shape.limit",
          params: { value: shown(limit) },
          hint: "view-shape.hint.limit",
        });
      }
    }

    const order = get("order")?.value;
    const orderNames: string[] = [];
    let orderIsList = false;
    if (isSeq(order)) {
      orderIsList = true;
      for (const it of order.items) {
        if (isScalar(it) && typeof it.value === "string") {
          orderNames.push(it.value);
          addSite(it, "property");
        }
      }
    } else if (order !== undefined && order !== null && !(isScalar(order) && order.value === null)) {
      const [s, e] = range(order as Node);
      findings.push({ rule: "view-shape", start: s, end: e, msg: "view-shape.order", hint: "view-shape.hint.order" });
    }

    const groupBy = get("groupBy")?.value;
    if (groupBy !== undefined && groupBy !== null) {
      if (!isMap(groupBy)) {
        const [s, e] = range(groupBy as Node);
        findings.push({ rule: "view-shape", start: s, end: e, msg: "view-shape.groupby", hint: "view-shape.hint.groupby" });
      } else {
        const dir = groupBy.items.find((p) => keyName(p) === "direction");
        if (dir) checkDirection(dir.value);
        const gp = groupBy.items.find((p) => keyName(p) === "property");
        if (gp) addSite(gp.value as Node, "property");
      }
    }

    walkFilter(get("filters")?.value);

    const sort = get("sort")?.value;
    if (isScalar(sort) && sort.value !== null) {
      const [s, e] = range(sort);
      findings.push({ rule: "sort-string", start: s, end: e, msg: "sort-string.msg", hint: "sort-string.hint" });
    } else if (isSeq(sort)) {
      for (const entry of sort.items) {
        if (!isMap(entry)) {
          const [s, e] = range(entry as Node);
          findings.push({ rule: "view-shape", start: s, end: Math.max(e, s + 1), msg: "view-shape.sort-entry", hint: "view-shape.hint.sort-entry" });
          continue;
        }
        const prop = entry.items.find((p) => keyName(p) === "property");
        const dir = entry.items.find((p) => keyName(p) === "direction");
        if (!prop || !isScalar(prop.value) || typeof prop.value.value !== "string") {
          const [s, e] = range(entry);
          findings.push({ rule: "view-shape", start: s, end: Math.max(e, s + 1), msg: "view-shape.sort-entry", hint: "view-shape.hint.sort-entry" });
        } else if (orderIsList && !orderNames.includes(prop.value.value)) {
          const [s, e] = range(prop.value);
          findings.push({
            rule: "sort-not-in-order",
            start: s,
            end: e,
            msg: "sort-not-in-order.msg",
            params: { name: prop.value.value },
            hint: "sort-not-in-order.hint",
            hintParams: { name: prop.value.value },
          });
        }
        if (dir) checkDirection(dir.value);
        if (prop && isScalar(prop.value) && typeof prop.value.value === "string") addSite(prop.value, "property");
      }
    } else if (sort !== undefined && sort !== null) {
      const [s, e] = range(sort as Node);
      findings.push({ rule: "view-shape", start: s, end: Math.max(e, s + 1), msg: "view-shape.sort-entry", hint: "view-shape.hint.sort-entry" });
    }

    const summaries = get("summaries")?.value;
    if (isMap(summaries)) {
      for (const p of summaries.items) {
        if (isScalar(p.key) && typeof p.key.value === "string") addSite(p.key, "property");
        if (!isScalar(p.value) || typeof p.value.value !== "string") continue;
        const name = p.value.value;
        if (BUILTIN_SUMMARIES.includes(name) || topSummaries.has(name)) continue;
        const near = suggest(name, [...BUILTIN_SUMMARIES, ...topSummaries]);
        const [s, e] = range(p.value);
        findings.push({
          rule: "summary-unknown",
          start: s,
          end: e,
          msg: "summary-unknown.msg",
          params: { name },
          ...(near
            ? { hint: "hint.suggest" as const, hintParams: { suggestion: near } }
            : { hint: "summary-unknown.hint" as const, hintParams: { list: BUILTIN_SUMMARIES.join(", ") } }),
        });
      }
    }
  }

  for (const pair of root.items) {
    const key = keyName(pair);
    if (key === undefined) continue;
    if (!TOP_LEVEL_KEYS.includes(key)) {
      const near = suggest(key, TOP_LEVEL_KEYS);
      const [s, e] = range(pair.key as Node);
      findings.push({
        rule: "top-level-key",
        start: s,
        end: e,
        msg: "top-level-key.msg",
        params: { key },
        ...(near
          ? { hint: "hint.suggest" as const, hintParams: { suggestion: near } }
          : { hint: "top-level-key.hint" as const }),
      });
      continue;
    }
    switch (key) {
      case "filters":
        walkFilter(pair.value);
        break;
      case "formulas":
        if (isMap(pair.value)) {
          for (const p of pair.value.items) {
            const name = keyName(p);
            if (name !== undefined) addSite(p.value as Node, "formula", name);
          }
        }
        break;
      case "summaries":
        if (isMap(pair.value)) {
          for (const p of pair.value.items) {
            const name = keyName(p);
            if (name !== undefined) addSite(p.value as Node, "summary", name);
          }
        }
        break;
      case "views": {
        const v = pair.value;
        if (isSeq(v)) {
          v.items.forEach((item) => checkView(item));
        } else if (v !== null && !(isScalar(v) && v.value === null)) {
          const [s, e] = range(v as Node);
          findings.push({ rule: "view-shape", start: s, end: Math.max(e, s + 1), msg: "view-shape.views-not-list", hint: "view-shape.hint.views" });
        }
        break;
      }
      default:
        break;
    }
  }
  return { findings, sites };
}
