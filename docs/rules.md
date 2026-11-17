# Rules

Every diagnostic carries a rule ID, a line and column in the file, a one-line fix hint and a link to this page (or to the evidence for the rule). Turn a rule off with `--disable <rule>`.

How severity is chosen: **error** when the problem is certain (the base cannot work), **warning** when it depends on some notes, on Obsidian versions or on unconfirmed reports, **info** when it may be intended.

Facts about the expression language come from the public Obsidian help pages (checked 2026-11-17):
<https://obsidian.md/help/bases/syntax> and <https://obsidian.md/help/bases/functions>. There is no official grammar, so the parser is conservative and the function table lives in [`src/signatures.json`](../src/signatures.json) with its sources and check date.

| Rule | Default | Catches |
|---|---|---|
| [`yaml-syntax`](#yaml-syntax) | error | YAML that does not parse |
| [`top-level-key`](#top-level-key) | warning | Unknown top-level key |
| [`view-shape`](#view-shape) | error | A view that is not shaped like Obsidian expects |
| [`view-type-unknown`](#view-type-unknown) | info | A view type outside table, cards, list, map |
| [`filter-shape`](#filter-shape) | error | A filter that is not text or an and/or/not object |
| [`expr-parse`](#expr-parse) | error | Syntax error inside an expression |
| [`unknown-function`](#unknown-function) | error | A global function that does not exist |
| [`unknown-method`](#unknown-method) | warning | A method or field no type has |
| [`wrong-arity`](#wrong-arity) | error | Wrong number of arguments |
| [`type-mismatch`](#type-mismatch) | error / warning | A method or operator the value's type cannot use |
| [`formula-undefined`](#formula-undefined) | error | `formula.x` with no `x` under `formulas` |
| [`formula-cycle`](#formula-cycle) | error | Formulas that depend on each other in a loop |
| [`unknown-property`](#unknown-property) | warning (error for `file.*`) | A property no note has, or a `file` field that does not exist |
| [`mixed-type`](#mixed-type) | warning | A property whose type differs between notes |
| [`empty-list-item`](#empty-list-item) | warning | A list property with an empty item in some notes |
| [`sort-string`](#sort-string) | warning | `sort` written as one text value |
| [`sort-not-in-order`](#sort-not-in-order) | warning | Sorting by a property that is not in `order` |
| [`summary-unknown`](#summary-unknown) | warning | A summary that is neither built in nor defined |

## yaml-syntax

The file is not valid YAML, or its top level is not a mapping. When this fires, no other rule runs on the file, because the structure cannot be trusted.

Fix: correct the YAML. Quote expressions that contain `:` or `#`.

## top-level-key

A key other than `filters`, `formulas`, `properties`, `summaries`, `views`. A close spelling gets a suggestion, for example `view` gives `views`.

## view-shape

- `views` is not a list, or an item is not a mapping.
- A view has no `type` (or it is not text).
- `limit` is not a whole number of 0 or more.
- `order` is not a list.
- `groupBy` is not a mapping, or a `direction` (in `groupBy` or in a `sort` entry) is not exactly `ASC` or `DESC`.
- A `sort` entry has no `property`.

## view-type-unknown

The view `type` is not one of the core types. Plugins add view types, so this is only information.

## filter-shape

A filter is either one text expression or an object with exactly one key: `and`, `or` or `not`, holding a list of filters. This rule reports other keys (for example `AND`), a value that is not a list, an object with more than one key, and list items that are neither text nor an object.

```yaml
filters:
  and:
    - file.inFolder("notes")
    - or:
        - 'status == "open"'
        - 'status == "waiting"'
```

## expr-parse

Syntax error inside a filter, formula or summary expression. The position is the exact column in the file, also for single-quoted (`''`), double-quoted (escapes) and block (`|`, `>`) strings. Only the first error of an expression is reported.

## unknown-function

A global function that is not in the function table (`escapeHTML date duration file html if image icon link list max min now number today random`). A close name gets a suggestion, for example `tody()` gives `today()`.

## unknown-method

A method or field that no type has, for example `tags.containz(...)`. It is a warning because plugins or newer Obsidian versions can add methods that the table does not know yet. Three list methods (`mean`, `median`, `stddev`) come from the 1.10.3 release notes but are missing from the current functions page; they are accepted and marked `source: changelog` in the table.

When the value's type is known the message names it (`Unknown method or field "containz" for list.`); without a vault, or for a property no note has, it reads `Unknown method or field "containz".`

## wrong-arity

Too few or too many arguments for a function or method. The hint shows the signature.

## type-mismatch

A method, field or operator that exists but not for this value's type, for example `.lower()` on a number or `"x" * 2`.

- **error**: no possible type of the value can do it.
- **warning**: only some possible types fail, for example a property that is text in one note and a list in another. The message names the failing type and example notes.
- A method name used without parentheses, such as `file.name.lower` or `x.isTruthy`, is reported as "a method, not a field" with the hint to call it as `lower()`.

Types come from literals, function results, formula results and (with a vault) from the notes' frontmatter.

## formula-undefined

`formula.x` where `formulas` has no `x`, in expressions and in view settings (`order`, `sort`, `groupBy`, `summaries`). A close name gets a suggestion.

## formula-cycle

Formulas that refer to each other, directly or through others. The loop is reported once, as `a -> b -> a`, at the first reference in the loop.

## unknown-property

- A property name that no note in the vault has, in expressions and in view settings (`order`, `sort`, `groupBy`, `summaries`) (needs a vault; `tags`, `aliases` and `cssclasses` always count as known). Warning, with a suggestion for close names.
- A `file.<name>` that is not a file field (`backlinks basename ctime embeds ext file folder links mtime name path properties size tags`). Error, with a suggestion.

## mixed-type

A property used in an expression has different types in different notes (for example text in one note, a list in another). Obsidian only fails per row, so the problem is invisible until the wrong note exists. Reported once per file and property, at the first use, with example notes. A type declared in `.obsidian/types.json` wins over what the notes look like, so declaring the type silences this rule.

Types are read from frontmatter: text, number, true/false, list, object; a `YYYY-MM-DD` (optionally with time) string counts as a date.

## empty-list-item

A list property that is used in the file has an empty item (`-` with no value) in some notes. Evidence: <https://forum.obsidian.md/t/bases-tags-property-crashes-with-cannot-read-properties-of-null-reading-charat-when-frontmatter-contains-empty-list-entries/114014>.

## sort-string

`sort` written as text, for example `sort: "- priority DESC"`. Obsidian expects a list of `property` and `direction` pairs and ignores this form. Evidence: <https://github.com/obsidianmd/obsidian-skills/issues/149>.

```yaml
sort:
  - property: priority
    direction: DESC
```

## sort-not-in-order

A `sort` property that is not in the view's `order` list. It is reported that Obsidian silently ignores such a sort, but the maintainers could not confirm it, so this is a warning (message says "reported, unconfirmed"). Evidence: <https://github.com/obsidianmd/obsidian-skills/issues/149>. Only checked when the view has an `order` list.

## summary-unknown

A view `summaries` value that is not a built-in summary (`Average Min Max Sum Range Median Stddev Earliest Latest Checked Unchecked Empty Filled Unique`) and not defined under the top-level `summaries`.
