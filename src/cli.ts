#!/usr/bin/env node
import { readFileSync, realpathSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { lintPaths } from "./files.js";
import { isLang, resolveLang, t, type MsgKey } from "./i18n/index.js";
import { renderJson } from "./report/json.js";
import { renderSarif } from "./report/sarif.js";
import { renderText } from "./report/text.js";
import { RULES, isRuleId } from "./rules.js";
import { BasesLintUsageError, RULE_IDS, type Lang, type RuleId } from "./types.js";
import { VERSION } from "./version.js";

/** Where the command reads and writes. Tests pass fakes; the real entry uses the process. */
export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  readStdin: () => Promise<string>;
  env: Record<string, string | undefined>;
  cwd: string;
}

const FORMATS = ["text", "json", "sarif"];

/** The valid `--lang` value on the command line, if any (read before parseArgs can fail). */
function argvLang(argv: string[]): Lang | undefined {
  for (let i = argv.length - 1; i >= 0; i--) {
    const a = argv[i]!;
    const v = a === "--lang" ? argv[i + 1] : a.startsWith("--lang=") ? a.slice(7) : undefined;
    if (v !== undefined && isLang(v)) return v;
  }
  return undefined;
}

/**
 * Run the command and return the exit code: 0 no errors, 1 errors (or warnings with
 * `--strict`), 2 bad command line or unreadable path.
 */
export async function main(argv: string[], io: CliIo): Promise<number> {
  const envLang = resolveLang(argvLang(argv), io.env);
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        format: { type: "string" },
        lang: { type: "string" },
        vault: { type: "string" },
        "no-vault": { type: "boolean" },
        disable: { type: "string", multiple: true },
        strict: { type: "boolean" },
        "exit-zero": { type: "boolean" },
        "stdin-filename": { type: "string" },
        rules: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    const option = (e as Error).message.match(/'([^']+)'/)?.[1]?.split(" ")[0] ?? "";
    if (code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") io.stderr(t(envLang, "cli.unknown-option", { option }) + "\n");
    else if (code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE") io.stderr(t(envLang, "cli.missing-value", { option }) + "\n");
    else io.stderr(t(envLang, "cli.bad-option") + "\n");
    return 2;
  }
  const { values, positionals } = parsed;

  let flagLang: Lang | undefined;
  if (values.lang !== undefined) {
    if (!isLang(values.lang)) {
      io.stderr(t(envLang, "cli.bad-lang", { value: values.lang }) + "\n");
      return 2;
    }
    flagLang = values.lang;
  }
  const lang = resolveLang(flagLang, io.env);
  const fail = (key: MsgKey, params: Record<string, string> = {}): number => {
    io.stderr(t(lang, key, params) + "\n");
    return 2;
  };

  if (values.version) {
    io.stdout(VERSION + "\n");
    return 0;
  }
  if (values.help) {
    io.stdout(t(lang, "cli.help", { version: VERSION, rules: RULE_IDS.join(", ") }) + "\n");
    return 0;
  }
  if (values.rules) {
    const width = Math.max(...RULE_IDS.map((r) => r.length));
    const lines = RULE_IDS.map((r) => `  ${r.padEnd(width)}  ${RULES[r].severity}`);
    io.stdout([t(lang, "cli.rules-title"), ...lines].join("\n") + "\n");
    return 0;
  }

  const format = values.format ?? "text";
  if (!FORMATS.includes(format)) return fail("cli.bad-format", { value: format });
  const disable: RuleId[] = [];
  for (const r of values.disable ?? []) {
    if (!isRuleId(r)) return fail("cli.bad-rule", { value: r, rules: RULE_IDS.join(", ") });
    disable.push(r);
  }
  if (values.vault !== undefined && values["no-vault"]) return fail("cli.vault-conflict");
  if (positionals.length === 0) return fail("cli.no-paths");

  const stdinName = values["stdin-filename"] ?? "<stdin>";
  let stdin: { name: string; text: string } | undefined;
  if (positionals.includes("-")) {
    const text = await io.readStdin();
    if (text.trim() === "") return fail("cli.stdin-empty");
    stdin = { name: stdinName, text };
  }

  let result;
  try {
    result = await lintPaths(positionals, {
      cwd: io.cwd,
      lang,
      disable,
      ...(values.vault !== undefined ? { vaultDir: values.vault } : {}),
      ...(values["no-vault"] ? { noVault: true } : {}),
      ...(stdin ? { stdin } : {}),
    });
  } catch (e) {
    if (e instanceof BasesLintUsageError) {
      switch (e.code) {
        case "path-missing":
          return fail("cli.path-missing", e.params);
        case "path-unreadable":
          return fail("cli.path-unreadable", e.params);
        case "vault-missing":
          return fail("cli.vault-missing", e.params);
        default:
          io.stderr(e.message + "\n");
          return 2;
      }
    }
    throw e;
  }

  for (const n of result.notices) {
    const detail = t(lang, `notice.${n.code}` as MsgKey, n.params);
    io.stderr(t(lang, "report.notice", { detail }) + "\n");
  }

  if (format === "json") {
    io.stdout(renderJson(result.diagnostics, { files: result.files, summary: result.summary, vaults: result.vaults }));
  } else if (format === "sarif") {
    io.stdout(renderSarif(result.diagnostics));
  } else {
    const cache = new Map<string, string[] | undefined>();
    const linesOf = (file: string): string[] | undefined => {
      if (cache.has(file)) return cache.get(file);
      let lines: string[] | undefined;
      if (stdin && file === stdin.name) {
        lines = stdin.text.split("\n").map((l) => l.replace(/\r$/, ""));
      } else {
        try {
          lines = readFileSync(resolve(io.cwd, file), "utf8")
            .split("\n")
            .map((l) => l.replace(/\r$/, ""));
        } catch {
          lines = undefined;
        }
      }
      cache.set(file, lines);
      return lines;
    };
    const shownVaults = result.vaults.map((v) => {
      const rel = relative(io.cwd, v).split(sep).join("/");
      return rel === "" ? "." : rel;
    });
    io.stdout(
      renderText(result.diagnostics, {
        lang,
        vaults: shownVaults,
        linesOf,
        files: result.files,
        summary: result.summary,
      }),
    );
  }

  if (values["exit-zero"]) return 0;
  const { errors, warnings } = result.summary;
  if (errors > 0) return 1;
  if (values.strict && warnings > 0) return 1;
  return 0;
}

async function readAllStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

// Run only when this file is the program being executed (not when imported by tests).
const entry = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (entry === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2), {
    stdout: (s) => void process.stdout.write(s),
    stderr: (s) => void process.stderr.write(s),
    readStdin: readAllStdin,
    env: process.env,
    cwd: process.cwd(),
  }).then(
    (code) => {
      process.exitCode = code;
    },
    (err: unknown) => {
      process.stderr.write(`bases-lint: unexpected error: ${(err as Error).stack ?? String(err)}\n`);
      process.exitCode = 2;
    },
  );
}
