import { t, unit } from "../i18n/index.js";
import { REPO_URL } from "../rules.js";
import type { Diagnostic, Lang, LintSummary } from "../types.js";

export interface TextOptions {
  lang: Lang;
  /** Vault folders (display paths) that were used, shown on the first lines. */
  vaults: string[];
  /** Returns the lines of a checked file, to draw the code frame. */
  linesOf: (file: string) => string[] | undefined;
  files: number;
  summary: LintSummary;
}

/** True when the docs link is evidence (an issue or forum post), not the generic rules page. */
function isEvidence(url: string): boolean {
  return !url.startsWith(REPO_URL);
}

export function summaryLine(lang: Lang, files: number, s: LintSummary): string {
  const total = s.errors + s.warnings + s.infos;
  const infos = s.infos > 0 ? t(lang, "report.infos", { infos: s.infos, infoUnit: unit(lang, "info", s.infos) }) : "";
  return t(lang, "report.summary", {
    total,
    problemUnit: unit(lang, "problem", total),
    errors: s.errors,
    errorUnit: unit(lang, "error", s.errors),
    warnings: s.warnings,
    warningUnit: unit(lang, "warning", s.warnings),
    infos,
    files,
    fileUnit: unit(lang, "file", files),
  });
}

const FRAME_WIDTH = 120;

/** Cut a long source line to about FRAME_WIDTH columns around the caret, marking cuts with "...". */
function clipLine(line: string, column: number): { text: string; column: number } {
  if (line.length <= FRAME_WIDTH) return { text: line, column };
  const start = Math.max(0, Math.min(column - 1 - 40, line.length - FRAME_WIDTH));
  const end = Math.min(line.length, start + FRAME_WIDTH);
  const left = start > 0 ? "..." : "";
  const right = end < line.length ? "..." : "";
  return { text: left + line.slice(start, end) + right, column: column - start + left.length };
}

/** Human-readable report: one block per problem with a code frame and a fix hint. */
export function renderText(diagnostics: Diagnostic[], o: TextOptions): string {
  const out: string[] = [];
  for (const v of o.vaults) out.push(t(o.lang, "report.vault", { path: v }));
  if (o.vaults.length > 0) out.push("");
  for (const d of diagnostics) {
    out.push(`${d.file}:${d.line}:${d.column} ${t(o.lang, `severity.${d.severity}`)} ${d.rule} ${d.message}`);
    const line = o.linesOf(d.file)?.[d.line - 1];
    if (line !== undefined) {
      const gutter = String(d.line).padStart(String(d.line).length + 2);
      const blank = " ".repeat(gutter.length);
      const width =
        d.endLine === d.line ? Math.max(1, Math.min(d.endColumn - d.column, line.length - d.column + 1)) : 1;
      const shown = clipLine(line, d.column);
      out.push(`${gutter} | ${shown.text}`);
      out.push(`${blank} | ${" ".repeat(Math.max(0, shown.column - 1))}${"^".repeat(Math.min(width, FRAME_WIDTH))}`);
    }
    if (d.hint) out.push("  " + t(o.lang, "report.hint", { hint: d.hint }));
    if (d.docs && isEvidence(d.docs)) out.push("  " + t(o.lang, "report.docs", { url: d.docs }));
    out.push("");
  }
  out.push(summaryLine(o.lang, o.files, o.summary));
  return out.join("\n") + "\n";
}
