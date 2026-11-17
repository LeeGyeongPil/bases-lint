export { lintSource as lintBase } from "./lint.js";
export { lintPaths } from "./files.js";
export { indexVault } from "./vault.js";
export { parseExpression } from "./expr/parser.js";
export type { Expr, ParseError } from "./expr/ast.js";
export { RULES } from "./rules.js";
export { BasesLintUsageError, RULE_IDS } from "./types.js";
export type {
  Diagnostic,
  Severity,
  RuleId,
  VaultIndex,
  PropertyInfo,
  ValueType,
  Lang,
  LintOptions,
  LintPathsOptions,
  LintResult,
  LintSummary,
  Notice,
} from "./types.js";
