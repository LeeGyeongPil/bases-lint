import { dirname, relative, resolve, sep } from "node:path";
import { lintSource } from "./lint.js";
import { extractFences, isMarkdown, readText, statPath, walkFolder, type BaseSource } from "./sources.js";
import type { Diagnostic, LintPathsOptions, LintResult, Notice, VaultIndex } from "./types.js";
import { findVaultRoot, indexVault } from "./vault.js";

interface Job {
  /** Absolute path, or undefined for standard input. */
  abs: string | undefined;
  shown: string;
  text?: string;
  /** Folder argument the file was found under (used as the vault when no .obsidian exists). */
  argDir?: string;
}

function display(cwd: string, abs: string): string {
  const rel = relative(cwd, abs).split(sep).join("/");
  return rel === "" ? "." : rel;
}

/**
 * Check files and folders: every `.base` file and every ```base block in `.md`
 * notes. The path `-` reads `options.stdin`. Vault-aware checks use the nearest
 * folder with `.obsidian` (or the folder you passed) unless told otherwise.
 */
export async function lintPaths(paths: string[], options: LintPathsOptions = {}): Promise<LintResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const jobs: Job[] = [];
  const pending: Notice[] = [];
  const seen = new Set<string>();
  for (const p of paths) {
    if (p === "-") {
      const stdin = options.stdin ?? { name: "<stdin>", text: "" };
      jobs.push({ abs: undefined, shown: stdin.name, text: stdin.text });
      continue;
    }
    const abs = resolve(cwd, p);
    const kind = await statPath(abs, p);
    const skipped: Notice[] = [];
    const found = kind === "dir" ? await walkFolder(abs, skipped) : [abs];
    pending.push(...skipped);
    for (const f of found) {
      if (seen.has(f)) continue;
      seen.add(f);
      jobs.push({ abs: f, shown: display(cwd, f), ...(kind === "dir" ? { argDir: abs } : {}) });
    }
  }

  const vaults = new Map<string, VaultIndex>();
  const notices: Notice[] = [...pending];
  const vaultFor = async (root: string | undefined): Promise<VaultIndex | undefined> => {
    if (!root) return undefined;
    let v = vaults.get(root);
    if (!v) {
      v = await indexVault(root);
      vaults.set(root, v);
      notices.push(...v.warnings);
    }
    return v;
  };
  const fixed = options.vaultDir && !options.noVault ? await vaultFor(resolve(cwd, options.vaultDir)) : undefined;

  const diagnostics: Diagnostic[] = [];
  let files = 0;
  for (const job of jobs) {
    const text = job.text ?? (await readText(job.abs!, job.shown));
    let vault: VaultIndex | undefined;
    if (!options.noVault) {
      if (fixed) {
        vault = fixed;
      } else {
        const start = job.abs ? dirname(job.abs) : cwd;
        const root = (await findVaultRoot(start)) ?? job.argDir;
        vault = await vaultFor(root);
      }
    }
    const sources: BaseSource[] = isMarkdown(job.shown) ? extractFences(text) : [{ text, lineOffset: 0 }];
    if (sources.length === 0) continue;
    files++;
    for (const s of sources) {
      diagnostics.push(
        ...lintSource(s.text, {
          file: job.shown,
          lineOffset: s.lineOffset,
          ...(vault ? { vault } : {}),
          ...(options.disable ? { disable: options.disable } : {}),
          ...(options.lang ? { lang: options.lang } : {}),
        }),
      );
    }
  }

  if (files === 0) {
    notices.push({
      code: "no-sources",
      params: { paths: paths.join(" ") },
      message: "No .base files or base blocks were found.",
    });
  }

  const summary = { errors: 0, warnings: 0, infos: 0 };
  for (const d of diagnostics) {
    if (d.severity === "error") summary.errors++;
    else if (d.severity === "warning") summary.warnings++;
    else summary.infos++;
  }
  return { files, diagnostics, summary, vaults: [...vaults.keys()], notices };
}
