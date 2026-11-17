import { LineCounter, parseDocument } from "yaml";
import { parseExpression } from "./expr/parser.js";
import type { Expr } from "./expr/ast.js";
import { checkExpression, type FormulaDef, type Inferred, type Shared } from "./expr/typecheck.js";
import { findCycles } from "./formulas.js";
import { t, type MsgKey } from "./i18n/index.js";
import { RULES, type Finding } from "./rules.js";
import { checkSchema, type ExprSite } from "./schema.js";
import type { Diagnostic, Lang, LintOptions } from "./types.js";
import { scalarText, type ScalarText } from "./yaml-pos.js";

interface ParsedSite {
  site: ExprSite;
  text: ScalarText;
  ast: Expr | null;
}

/**
 * Check one base (the YAML text of a .base file or of a ```base block).
 * Pure: no file system access. Offsets are mapped back to file lines and columns.
 */
export function lintSource(src: string, options: LintOptions = {}): Diagnostic[] {
  const lang = options.lang ?? "en";
  const file = options.file ?? "<input>";
  const lineOffset = options.lineOffset ?? 0;
  const disabled = new Set<string>(options.disable ?? []);

  const lc = new LineCounter();
  const doc = parseDocument(src, { lineCounter: lc, prettyErrors: false });
  const findings: Finding[] = [];

  if (doc.errors.length > 0) {
    for (const err of doc.errors) {
      const [s, e] = err.pos;
      findings.push({
        rule: "yaml-syntax",
        start: s,
        end: Math.max(e, s + 1),
        msg: "yaml-syntax.error",
        params: { detail: err.message.split("\n")[0] ?? err.message },
        hint: "yaml-syntax.hint",
      });
    }
    return finish(findings, lc, lang, file, lineOffset, disabled);
  }

  const schema = checkSchema(doc);
  findings.push(...schema.findings);

  // Parse every expression and keep its offset map.
  const parsed: ParsedSite[] = [];
  for (const site of schema.sites) {
    const text = scalarText(src, site.node);
    if (!text) continue;
    const result = parseExpression(text.text);
    const err = result.errors[0];
    if (err) {
      findings.push({
        rule: "expr-parse",
        start: text.map(err.offset),
        end: text.map(Math.max(err.end, err.offset + 1)),
        msg: ("expr-parse." + err.code) as MsgKey,
        params: err.params,
        hint: "expr-parse.hint",
      });
    }
    parsed.push({ site, text, ast: result.ast });
  }
  parsed.sort((a, b) => a.site.node.range![0] - b.site.node.range![0]);

  const formulas = new Map<string, FormulaDef & { text: ScalarText }>();
  for (const p of parsed) {
    if (p.site.kind === "formula" && p.site.name !== undefined && !formulas.has(p.site.name)) {
      formulas.set(p.site.name, { ast: p.ast, text: p.text });
    }
  }

  for (const cycle of findCycles(formulas)) {
    const owner = formulas.get(cycle.owner)!;
    findings.push({
      rule: "formula-cycle",
      start: owner.text.map(cycle.start),
      end: owner.text.map(cycle.end),
      msg: "formula-cycle.msg",
      params: { path: cycle.path.join(" -> ") },
      hint: "formula-cycle.hint",
    });
  }

  const shared: Shared = {
    ...(options.vault ? { vault: options.vault } : {}),
    formulas,
    formulaTypes: new Map<string, Inferred>(),
    busy: new Set<string>(),
    ...(options.trace ? { trace: options.trace } : {}),
  };
  const seen = new Set<string>();
  for (const p of parsed) {
    if (!p.ast) continue;
    const scope = new Map<string, Inferred>();
    if (p.site.kind === "summary") scope.set("values", { types: ["list"] });
    checkExpression(
      p.ast,
      {
        shared,
        seen,
        report: (f) =>
          findings.push({ ...f, start: p.text.map(f.start), end: p.text.map(Math.max(f.end, f.start + 1)) }),
      },
      scope,
    );
  }

  return finish(findings, lc, lang, file, lineOffset, disabled);
}

function finish(
  findings: Finding[],
  lc: LineCounter,
  lang: Lang,
  file: string,
  lineOffset: number,
  disabled: Set<string>,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const f of findings) {
    if (disabled.has(f.rule)) continue;
    const rule = RULES[f.rule];
    const start = lc.linePos(f.start);
    const end = lc.linePos(Math.max(f.end, f.start));
    // Checkers pass the example notes as `notesList`; the {notes} placeholder
    // becomes a translated sentence, or nothing when there are no examples.
    const render = (key: MsgKey, params: Record<string, string | number> = {}): string => {
      const filled: Record<string, string | number> = { ...params };
      const list = params["notesList"];
      filled["notes"] = list === undefined ? "" : t(lang, "fragment.notes", { list });
      return t(lang, key, filled);
    };
    const d: Diagnostic = {
      file,
      line: start.line + lineOffset,
      column: start.col,
      endLine: end.line + lineOffset,
      endColumn: end.col,
      severity: f.severity ?? rule.severity,
      rule: f.rule,
      message: render(f.msg, f.params),
      docs: rule.docs,
    };
    if (f.hint) d.hint = render(f.hint, f.hintParams);
    out.push(d);
  }
  out.sort((a, b) => a.line - b.line || a.column - b.column || a.rule.localeCompare(b.rule));
  return out;
}
