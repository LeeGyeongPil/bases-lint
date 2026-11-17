import type { Diagnostic, LintSummary } from "../types.js";
import { VERSION } from "../version.js";

/** Stable JSON output. Keys and rule IDs never change with the language. */
export function renderJson(
  diagnostics: Diagnostic[],
  info: { files: number; summary: LintSummary; vaults: string[] },
): string {
  return (
    JSON.stringify(
      {
        tool: "bases-lint",
        version: VERSION,
        files: info.files,
        vaults: info.vaults,
        summary: info.summary,
        diagnostics,
      },
      null,
      2,
    ) + "\n"
  );
}
