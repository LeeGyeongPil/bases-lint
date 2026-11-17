import type { MsgKey } from "./i18n/index.js";
import type { Params } from "./i18n/index.js";
import { RULE_IDS, type RuleId, type Severity } from "./types.js";

export const REPO_URL = "https://github.com/LeeGyeongPil/bases-lint";
const ISSUE_149 = "https://github.com/obsidianmd/obsidian-skills/issues/149";
const FORUM_114014 =
  "https://forum.obsidian.md/t/bases-tags-property-crashes-with-cannot-read-properties-of-null-reading-charat-when-frontmatter-contains-empty-list-entries/114014";

export interface RuleInfo {
  id: RuleId;
  /** Default severity; a finding can override it (for example type-mismatch). */
  severity: Severity;
  /** Evidence or documentation link put into each diagnostic. */
  docs: string;
  /** Every message key the rule can use (checked against both catalogs). */
  messages: MsgKey[];
  hints: MsgKey[];
}

const doc = (id: RuleId): string => `${REPO_URL}/blob/main/docs/rules.md#${id}`;

export const RULES: Record<RuleId, RuleInfo> = {
  "yaml-syntax": {
    id: "yaml-syntax",
    severity: "error",
    docs: doc("yaml-syntax"),
    messages: ["yaml-syntax.error", "yaml-syntax.root"],
    hints: ["yaml-syntax.hint"],
  },
  "top-level-key": {
    id: "top-level-key",
    severity: "warning",
    docs: doc("top-level-key"),
    messages: ["top-level-key.msg"],
    hints: ["top-level-key.hint", "hint.suggest"],
  },
  "view-shape": {
    id: "view-shape",
    severity: "error",
    docs: doc("view-shape"),
    messages: [
      "view-shape.views-not-list",
      "view-shape.view-not-map",
      "view-shape.type-missing",
      "view-shape.type-not-string",
      "view-shape.limit",
      "view-shape.order",
      "view-shape.direction",
      "view-shape.groupby",
      "view-shape.sort-entry",
    ],
    hints: [
      "view-shape.hint.views",
      "view-shape.hint.view",
      "view-shape.hint.type",
      "view-shape.hint.limit",
      "view-shape.hint.order",
      "view-shape.hint.direction",
      "view-shape.hint.groupby",
      "view-shape.hint.sort-entry",
    ],
  },
  "view-type-unknown": {
    id: "view-type-unknown",
    severity: "info",
    docs: doc("view-type-unknown"),
    messages: ["view-type-unknown.msg"],
    hints: ["view-type-unknown.hint"],
  },
  "filter-shape": {
    id: "filter-shape",
    severity: "error",
    docs: doc("filter-shape"),
    messages: ["filter-shape.key", "filter-shape.multi", "filter-shape.not-list", "filter-shape.item"],
    hints: [
      "filter-shape.hint.key",
      "filter-shape.hint.multi",
      "filter-shape.hint.not-list",
      "filter-shape.hint.item",
      "hint.suggest",
    ],
  },
  "expr-parse": {
    id: "expr-parse",
    severity: "error",
    docs: doc("expr-parse"),
    messages: [
      "expr-parse.unexpected-token",
      "expr-parse.unexpected-end",
      "expr-parse.expected-token",
      "expr-parse.expected-token-end",
      "expr-parse.unterminated-string",
      "expr-parse.unterminated-regex",
      "expr-parse.invalid-char",
      "expr-parse.empty",
      "expr-parse.expected-name",
    ],
    hints: ["expr-parse.hint"],
  },
  "unknown-function": {
    id: "unknown-function",
    severity: "error",
    docs: doc("unknown-function"),
    messages: ["unknown-function.msg"],
    hints: ["unknown-function.hint", "hint.suggest"],
  },
  "unknown-method": {
    id: "unknown-method",
    severity: "warning",
    docs: doc("unknown-method"),
    messages: ["unknown-method.msg", "unknown-method.msg-any"],
    hints: ["unknown-method.hint", "hint.suggest"],
  },
  "wrong-arity": {
    id: "wrong-arity",
    severity: "error",
    docs: doc("wrong-arity"),
    messages: ["wrong-arity.exact", "wrong-arity.range", "wrong-arity.min"],
    hints: ["wrong-arity.hint"],
  },
  "type-mismatch": {
    id: "type-mismatch",
    severity: "error",
    docs: doc("type-mismatch"),
    messages: [
      "type-mismatch.access-error",
      "type-mismatch.access-warning",
      "type-mismatch.op-error",
      "type-mismatch.op-warning",
      "type-mismatch.method-as-field",
    ],
    hints: ["type-mismatch.hint-access", "type-mismatch.hint-op", "type-mismatch.hint-call"],
  },
  "formula-undefined": {
    id: "formula-undefined",
    severity: "error",
    docs: doc("formula-undefined"),
    messages: ["formula-undefined.msg"],
    hints: ["formula-undefined.hint", "hint.suggest"],
  },
  "formula-cycle": {
    id: "formula-cycle",
    severity: "error",
    docs: doc("formula-cycle"),
    messages: ["formula-cycle.msg"],
    hints: ["formula-cycle.hint"],
  },
  "unknown-property": {
    id: "unknown-property",
    severity: "warning",
    docs: doc("unknown-property"),
    messages: ["unknown-property.note", "unknown-property.file"],
    hints: ["unknown-property.hint-note", "unknown-property.hint-file", "hint.suggest"],
  },
  "mixed-type": {
    id: "mixed-type",
    severity: "warning",
    docs: doc("mixed-type"),
    messages: ["mixed-type.msg"],
    hints: ["mixed-type.hint"],
  },
  "empty-list-item": {
    id: "empty-list-item",
    severity: "warning",
    docs: FORUM_114014,
    messages: ["empty-list-item.msg"],
    hints: ["empty-list-item.hint"],
  },
  "sort-string": {
    id: "sort-string",
    severity: "warning",
    docs: ISSUE_149,
    messages: ["sort-string.msg"],
    hints: ["sort-string.hint"],
  },
  "sort-not-in-order": {
    id: "sort-not-in-order",
    severity: "warning",
    docs: ISSUE_149,
    messages: ["sort-not-in-order.msg"],
    hints: ["sort-not-in-order.hint"],
  },
  "summary-unknown": {
    id: "summary-unknown",
    severity: "warning",
    docs: doc("summary-unknown"),
    messages: ["summary-unknown.msg"],
    hints: ["summary-unknown.hint", "hint.suggest"],
  },
};

export function isRuleId(value: string): value is RuleId {
  return (RULE_IDS as readonly string[]).includes(value);
}

/**
 * A problem found by a checker, positioned by offsets in some text. The lint
 * pipeline turns offsets into file line and column and the message keys into text.
 */
export interface Finding {
  rule: RuleId;
  /** Overrides the rule's default severity. */
  severity?: Severity;
  start: number;
  end: number;
  msg: MsgKey;
  params?: Params;
  hint?: MsgKey;
  hintParams?: Params;
}
