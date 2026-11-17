import { RULES, REPO_URL } from "../rules.js";
import { RULE_IDS, type Diagnostic, type Severity } from "../types.js";
import { VERSION } from "../version.js";

const LEVEL: Record<Severity, "error" | "warning" | "note"> = {
  error: "error",
  warning: "warning",
  info: "note",
};

/** SARIF 2.1.0 output, accepted by GitHub code scanning. */
export function renderSarif(diagnostics: Diagnostic[]): string {
  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "bases-lint",
            version: VERSION,
            informationUri: REPO_URL,
            rules: RULE_IDS.map((id) => ({
              id,
              helpUri: RULES[id].docs,
              defaultConfiguration: { level: LEVEL[RULES[id].severity] },
              shortDescription: { text: id },
            })),
          },
        },
        results: diagnostics.map((d) => ({
          ruleId: d.rule,
          level: LEVEL[d.severity],
          message: { text: d.hint ? `${d.message} ${d.hint}` : d.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: d.file },
                region: {
                  startLine: d.line,
                  startColumn: d.column,
                  endLine: d.endLine,
                  endColumn: d.endColumn,
                },
              },
            },
          ],
        })),
      },
    ],
  };
  return JSON.stringify(sarif, null, 2) + "\n";
}
