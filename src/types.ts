/** Shared public types. */

export type Lang = "en" | "ko";
export type Severity = "error" | "warning" | "info";

export const RULE_IDS = [
  "yaml-syntax",
  "top-level-key",
  "view-shape",
  "view-type-unknown",
  "filter-shape",
  "expr-parse",
  "unknown-function",
  "unknown-method",
  "wrong-arity",
  "type-mismatch",
  "formula-undefined",
  "formula-cycle",
  "unknown-property",
  "mixed-type",
  "empty-list-item",
  "sort-string",
  "sort-not-in-order",
  "summary-unknown",
] as const;

export type RuleId = (typeof RULE_IDS)[number];

export interface Diagnostic {
  /** Display path of the checked file (or the `--stdin-filename`). */
  file: string;
  /** 1-based line of the problem start, in the file (not the embedded block). */
  line: number;
  /** 1-based column of the problem start. */
  column: number;
  endLine: number;
  endColumn: number;
  severity: Severity;
  rule: RuleId;
  message: string;
  /** One-line fix suggestion. */
  hint?: string;
  /** Link to the documentation or evidence for the rule. */
  docs?: string;
}

export type ValueType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "duration"
  | "list"
  | "link"
  | "file"
  | "object"
  | "regexp"
  | "null"
  | "any";

export interface PropertyInfo {
  /** Observed (or declared) value types, in first-seen order. */
  types: ValueType[];
  /** Up to three example note paths per type. */
  examples: Partial<Record<ValueType, string[]>>;
  /** Notes where this list property has an empty item (`- ` with no value). */
  emptyItemNotes: string[];
  /** Type declared in `.obsidian/types.json`, if any. */
  declared?: ValueType;
}

export interface VaultIndex {
  root: string;
  /** Number of notes whose frontmatter was read. */
  notes: number;
  properties: Record<string, PropertyInfo>;
  /** Non-fatal problems found while indexing (for example an unreadable types.json). */
  warnings: Notice[];
}

export interface LintOptions {
  /** Vault index used for property-aware checks. Omit to skip them. */
  vault?: VaultIndex;
  /** Rule IDs to turn off. */
  disable?: readonly RuleId[];
  /** Message language. Default `en`. */
  lang?: Lang;
  /** Display path put into each diagnostic. Default `<input>`. */
  file?: string;
  /** Number of file lines before the first YAML line (used for fenced blocks). Default 0. */
  lineOffset?: number;
  /** @internal Called with `table.name` for each signature entry that was resolved. */
  trace?: (entry: string) => void;
}

export interface LintSummary {
  errors: number;
  warnings: number;
  infos: number;
}

export interface LintResult {
  files: number;
  diagnostics: Diagnostic[];
  summary: LintSummary;
  /** Vault roots that were indexed and used. */
  vaults: string[];
  /** Non-fatal notes (for example an unreadable `.obsidian/types.json`). */
  notices: Notice[];
}

/** A non-fatal note. `message` is English; the CLI translates by `code`. */
export interface Notice {
  code: "types-json-unreadable" | "folder-unreadable" | "no-sources";
  params: Record<string, string>;
  message: string;
}

export interface LintPathsOptions {
  /** Use this folder as the vault for every file. */
  vaultDir?: string;
  /** Skip vault-aware checks. */
  noVault?: boolean;
  disable?: readonly RuleId[];
  lang?: Lang;
  /** Base for relative paths and for display. Default `process.cwd()`. */
  cwd?: string;
  /** Content for the path `-` (standard input). */
  stdin?: { name: string; text: string };
}

/** Thrown for bad arguments or unreadable paths (the CLI exits with code 2). */
export class BasesLintUsageError extends Error {
  constructor(
    message: string,
    /** Machine-readable reason; the CLI turns it into a translated message. */
    readonly code: "path-missing" | "path-unreadable" | "vault-missing" | "other" = "other",
    readonly params: Record<string, string> = {},
  ) {
    super(message);
    this.name = "BasesLintUsageError";
  }
}
