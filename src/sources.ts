import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { BasesLintUsageError, type Notice } from "./types.js";
import { SKIP_DIRS } from "./vault.js";

/** One YAML text to check, with its position inside the file. */
export interface BaseSource {
  text: string;
  /** Number of file lines before the first line of `text`. */
  lineOffset: number;
}

const OPEN_FENCE = /^( {0,3})(`{3,}|~{3,})[ \t]*base[ \t]*$/;

/** The ```base fenced blocks of a markdown note, with their line offsets. */
export function extractFences(markdown: string): BaseSource[] {
  const lines = markdown.split("\n");
  const out: BaseSource[] = [];
  let i = 0;
  while (i < lines.length) {
    const open = OPEN_FENCE.exec(lines[i]!.replace(/\r$/, ""));
    if (!open) {
      i++;
      continue;
    }
    const fence = open[2]!;
    const body: string[] = [];
    let j = i + 1;
    while (j < lines.length) {
      const l = lines[j]!.replace(/\r$/, "");
      const trimmed = l.trim();
      if (trimmed.length >= fence.length && trimmed === fence[0]!.repeat(trimmed.length)) break;
      body.push(l);
      j++;
    }
    out.push({ text: body.join("\n"), lineOffset: i + 1 });
    i = j + 1;
  }
  return out;
}

export function isMarkdown(path: string): boolean {
  return path.toLowerCase().endsWith(".md");
}

/** `.base` files and notes under a folder, sorted for stable output. */
export async function walkFolder(dir: string, notices: Notice[] = []): Promise<string[]> {
  const out: string[] = [];
  async function visit(d: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch (e) {
      const detail = (e as Error).message;
      // The folder the user named must be readable; unreadable subfolders are skipped with a note.
      if (d === dir) {
        throw new BasesLintUsageError(`Cannot read ${d}: ${detail}`, "path-unreadable", { path: d, detail });
      }
      notices.push({ code: "folder-unreadable", params: { path: d, detail }, message: `Skipped ${d}: ${detail}` });
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) await visit(join(d, e.name));
      } else if (e.isFile() && (e.name.endsWith(".base") || e.name.toLowerCase().endsWith(".md"))) {
        out.push(join(d, e.name));
      }
    }
  }
  await visit(dir);
  return out;
}

export async function statPath(path: string, shown: string): Promise<"file" | "dir"> {
  try {
    const s = await stat(path);
    return s.isDirectory() ? "dir" : "file";
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      throw new BasesLintUsageError(`Path not found: ${shown}`, "path-missing", { path: shown });
    }
    throw new BasesLintUsageError(`Cannot read ${shown}: ${(e as Error).message}`, "path-unreadable", {
      path: shown,
      detail: (e as Error).message,
    });
  }
}

export async function readText(path: string, shown: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (e) {
    throw new BasesLintUsageError(`Cannot read ${shown}: ${(e as Error).message}`, "path-unreadable", {
      path: shown,
      detail: (e as Error).message,
    });
  }
}
