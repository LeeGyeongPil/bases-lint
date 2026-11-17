# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-11-17

### Fixed

- Property names in view `order`, `sort`, `groupBy` and `summaries` are now checked (`file.*`, `formula.*`, vault properties); misspelled names were silently accepted.

## [0.1.0] - 2026-11-17

### Added

- `bases-lint` command: checks `.base` files, `base` code blocks in notes and folders without opening Obsidian.
- 18 rules for YAML, view and filter structure, expression syntax, function and method names, argument counts, types, formula references and loops, vault properties, and settings that Obsidian silently ignores.
- Vault-aware checks: property types read from note frontmatter (`.obsidian/types.json` wins), example notes in messages.
- Exact line and column for plain, quoted, escaped and block-scalar expressions, and for blocks inside notes.
- Output as text (code frame), JSON and SARIF 2.1.0; exit codes 0, 1, 2; `--strict`, `--exit-zero`, `--disable`, standard input.
- English and Korean messages (`--lang`, `BASES_LINT_LANG`, `LC_ALL`, `LC_MESSAGES`, `LANG`).
- Library API: `lintBase`, `lintPaths`, `indexVault`, `parseExpression`.
