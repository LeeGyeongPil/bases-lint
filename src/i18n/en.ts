/** English message catalog. `ko.ts` must define exactly the same keys. */
export const en = {
  // ---- rule messages ----
  "yaml-syntax.error": "YAML syntax error: {detail}",
  "yaml-syntax.root": "The top level of a base must be a mapping (key: value).",
  "yaml-syntax.hint": "Fix the YAML structure. Quote expressions that contain ':' or '#'.",

  "top-level-key.msg": 'Unknown top-level key "{key}".',
  "top-level-key.hint": "Valid keys: filters, formulas, properties, summaries, views.",

  "view-shape.views-not-list": '"views" must be a list of views.',
  "view-shape.view-not-map": 'Each view must be a mapping with at least a "type".',
  "view-shape.type-missing": 'The view has no "type".',
  "view-shape.type-not-string": '"type" must be a text value such as table or cards.',
  "view-shape.limit": '"limit" must be a whole number of 0 or more (found {value}).',
  "view-shape.order": '"order" must be a list of property names.',
  "view-shape.direction": '"direction" must be ASC or DESC (found {value}).',
  "view-shape.groupby": '"groupBy" must be a mapping with "property" and "direction".',
  "view-shape.sort-entry": 'Each "sort" entry must be a mapping with "property" and "direction".',
  "view-shape.hint.views": 'Write "views:" followed by a list, for example "- type: table".',
  "view-shape.hint.view": 'Start each view with "- type: table" and indent its other keys under it.',
  "view-shape.hint.type": 'Add a line such as "type: table".',
  "view-shape.hint.limit": 'Use a number, for example "limit: 10".',
  "view-shape.hint.order": 'Write "order: [file.name, status]" or a "- name" list.',
  "view-shape.hint.direction": 'Use "direction: ASC" or "direction: DESC".',
  "view-shape.hint.groupby": 'Write "groupBy:" with "property: status" and "direction: ASC" under it.',
  "view-shape.hint.sort-entry": 'Write "- property: priority" and "  direction: DESC" for each entry.',

  "view-type-unknown.msg":
    'View type "{type}" is not a core Bases view (table, cards, list, map); it may come from a plugin.',
  "view-type-unknown.hint": "Ignore this if the plugin is installed, or turn the rule off with --disable view-type-unknown.",

  "filter-shape.key": 'Filter key "{key}" is not and, or or not.',
  "filter-shape.multi": "A filter object must have exactly one key (and, or or not); found {count}.",
  "filter-shape.not-list": '"{key}" must contain a list of filters.',
  "filter-shape.item": "A filter must be a text expression or an and/or/not object.",
  "filter-shape.hint.key": 'Use lowercase "and", "or" or "not".',
  "filter-shape.hint.multi": "Put each key in its own list item so every object has one key.",
  "filter-shape.hint.not-list": 'Write each filter as a "- " list item under "{key}:".',
  "filter-shape.hint.item": "Quote the expression, for example - 'status != \"done\"'.",

  "expr-parse.unexpected-token": 'Unexpected token "{token}".',
  "expr-parse.unexpected-end": "The expression ends too early.",
  "expr-parse.expected-token": 'Expected "{expected}" but found "{token}".',
  "expr-parse.expected-token-end": 'Expected "{expected}" at the end of the expression.',
  "expr-parse.unterminated-string": "The string is not closed.",
  "expr-parse.unterminated-regex": "The regular expression is not closed.",
  "expr-parse.invalid-char": 'Unexpected character "{char}".',
  "expr-parse.too-deep": "The expression is nested too deeply.",
  "expr-parse.empty": "The expression is empty.",
  "expr-parse.expected-name": 'Expected a name after ".".',
  "expr-parse.hint": "Check brackets, quotes and operators in this expression.",

  "unknown-function.msg": 'Unknown function "{name}()".',
  "unknown-function.hint": "Global functions: {list}.",

  "unknown-method.msg": 'Unknown method or field "{name}" for {types}.',
  "unknown-method.msg-any": 'Unknown method or field "{name}".',
  "unknown-method.hint":
    "Check the spelling. A plugin may add methods this table does not know; turn the rule off with --disable unknown-method.",

  "wrong-arity.exact": '"{name}()" takes exactly {min} argument(s) but got {count}.',
  "wrong-arity.range": '"{name}()" takes {min} to {max} arguments but got {count}.',
  "wrong-arity.min": '"{name}()" takes at least {min} argument(s) but got {count}.',
  "wrong-arity.hint": "Signature: {sig}",

  "type-mismatch.access-error": '"{what}" is not available on {types}; it exists on {owners}.{notes}',
  "type-mismatch.access-warning":
    '"{what}" is not available when the value is {types}; it exists on {owners}.{notes}',
  "type-mismatch.op-error": 'Operator "{op}" cannot be applied to {types}.{notes}',
  "type-mismatch.op-warning": 'Operator "{op}" fails when the value is {types}.{notes}',
  "type-mismatch.hint-access": "Convert the value first, or use a {owners} method.",
  "type-mismatch.method-as-field": '"{name}" is a method, not a field; it needs parentheses.{notes}',
  "type-mismatch.hint-call": 'Call it as "{name}()".',
  "type-mismatch.hint-op": "Convert with number(...), or make the property the same type in every note.",

  "formula-undefined.msg": 'Formula "{name}" is not defined under "formulas".',
  "formula-undefined.hint": 'Add "{name}" under "formulas:" or fix the name.',

  "formula-cycle.msg": "Formulas refer to each other in a loop: {path}.",
  "formula-cycle.hint": "Break the loop: a formula must not depend on itself, directly or through others.",

  "unknown-property.note": 'Property "{name}" is not found in any note of the vault ({count} notes read).',
  "unknown-property.file": '"file.{name}" is not a file field.',
  "unknown-property.hint-note": "Check the property name or add it to a note's frontmatter. Use --no-vault to skip this check.",
  "unknown-property.hint-file": "File fields: {list}.",

  "mixed-type.msg": 'Property "{name}" has different types in different notes: {types}.{notes}',
  "mixed-type.hint": "Use one type for the property in every note and declare it in .obsidian/types.json.",

  "empty-list-item.msg": 'List property "{name}" has an empty item in some notes.{notes}',
  "empty-list-item.hint": 'Delete the empty "-" line in those notes; Obsidian can fail to evaluate filters on it.',

  "sort-string.msg":
    '"sort" is a text value. Obsidian expects a list of property and direction pairs and ignores this form.',
  "sort-string.hint": 'Write "sort:" then "- property: priority" and "  direction: DESC" on the next lines.',

  "sort-not-in-order.msg":
    'Sort property "{name}" is not in this view\'s "order". It may be silently ignored (reported, unconfirmed).',
  "sort-not-in-order.hint": 'Add "{name}" to "order", or turn the rule off with --disable sort-not-in-order.',

  "summary-unknown.msg": 'Summary "{name}" is neither a built-in summary nor defined under "summaries".',
  "summary-unknown.hint": "Built-in summaries: {list}.",

  // ---- shared fragments ----
  "hint.suggest": 'Did you mean "{suggestion}"?',
  "fragment.notes": " Example notes: {list}.",

  // ---- report ----
  "report.vault": "Vault: {path}",
  "report.summary":
    "{total} {problemUnit} ({errors} {errorUnit}, {warnings} {warningUnit}){infos} in {files} {fileUnit}",
  "report.infos": ", {infos} {infoUnit}",
  "report.hint": "hint: {hint}",
  "report.docs": "docs: {url}",
  "severity.error": "error",
  "severity.warning": "warning",
  "severity.info": "info",
  "unit.problem.one": "problem",
  "unit.problem.other": "problems",
  "unit.error.one": "error",
  "unit.error.other": "errors",
  "unit.warning.one": "warning",
  "unit.warning.other": "warnings",
  "unit.info.one": "info",
  "unit.info.other": "infos",
  "unit.file.one": "file",
  "unit.file.other": "files",
  "report.notice": "note: {detail}",
  "notice.types-json-unreadable": "Could not read {path}: {detail}",
  "notice.folder-unreadable": "Skipped a folder that cannot be read: {path} ({detail})",
  "notice.no-sources": "No .base files or base blocks were found under: {paths}. Check the path.",

  // ---- command line ----
  "cli.help": `bases-lint {version} - check Obsidian Bases files before you open them

Usage:
  bases-lint [options] <path...>
  cat draft.base | bases-lint - [options]

Paths can be .base files, notes (.md) with \`\`\`base blocks, or folders. Use - for standard input.

Options:
  --format <text|json|sarif>  Output format (default text)
  --lang <en|ko>              Message language (default: BASES_LINT_LANG, then LANG)
  --vault <dir>               Vault folder for property checks (default: nearest folder with .obsidian)
  --no-vault                  Skip checks that need the vault
  --disable <rule>            Turn a rule off (repeatable)
  --strict                    Exit 1 on warnings too
  --exit-zero                 Always exit 0 unless the command line is wrong
  --stdin-filename <name>     Name shown for standard input (default <stdin>)
  --rules                     List the rules and exit
  -h, --help                  Show this help
  -v, --version               Show the version

Exit codes: 0 no errors, 1 errors (or warnings with --strict), 2 bad command line or unreadable path.

Rules: {rules}`,
  "cli.no-paths": "No paths given. Try: bases-lint . (or bases-lint --help)",
  "cli.unknown-option": "Unknown option {option}. Run bases-lint --help to see the options.",
  "cli.missing-value": "Option {option} needs a value. Run bases-lint --help to see the options.",
  "cli.bad-option": "Invalid command line. Run bases-lint --help to see the options.",
  "cli.bad-lang": 'Unsupported language "{value}". Use en or ko.',
  "cli.bad-format": 'Unsupported format "{value}". Use text, json or sarif.',
  "cli.bad-rule": 'Unknown rule "{value}". Rules: {rules}.',
  "cli.path-missing": "Path not found: {path}",
  "cli.path-unreadable": "Cannot read {path}: {detail}",
  "cli.vault-missing": "Vault folder not found: {path}. Pass an existing folder to --vault.",
  "cli.vault-conflict": "--vault and --no-vault cannot be used together.",
  "cli.stdin-empty": "Nothing was piped to standard input.",
  "cli.rules-title": "Rules (default severity):",
} as const;

export type MsgKey = keyof typeof en;
