import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { parse } from "yaml";
import { BasesLintUsageError, type Notice, type PropertyInfo, type ValueType, type VaultIndex } from "./types.js";

/** Folders that never hold notes worth reading. */
export const SKIP_DIRS = new Set([".obsidian", ".trash", ".git", "node_modules"]);

const MAX_NOTE_BYTES = 5 * 1024 * 1024;
const MAX_EXAMPLES = 3;
const DATE_STRING = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** `.obsidian/types.json` property types mapped to value types. */
const DECLARED: Record<string, ValueType> = {
  text: "string",
  multitext: "list",
  tags: "list",
  aliases: "list",
  number: "number",
  checkbox: "boolean",
  date: "date",
  datetime: "date",
};

/** Properties Obsidian provides in every vault even when no note sets them. */
export const BUILTIN_PROPERTIES: Record<string, ValueType> = {
  tags: "list",
  aliases: "list",
  cssclasses: "list",
};

/** Walk up from `startDir` and return the first folder that contains `.obsidian`. */
export async function findVaultRoot(startDir: string): Promise<string | undefined> {
  let dir = resolve(startDir);
  for (;;) {
    try {
      if ((await stat(join(dir, ".obsidian"))).isDirectory()) return dir;
    } catch {
      // keep walking up
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** The YAML text between the opening and closing `---` lines, or undefined. */
export function frontmatterText(text: string): string | undefined {
  const lines = text.split("\n");
  if (lines[0]?.replace(/\r$/, "").trimEnd() !== "---") return undefined;
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i]!.replace(/\r$/, "").trimEnd();
    if (l === "---" || l === "...") return lines.slice(1, i).join("\n");
  }
  return undefined;
}

function kindOf(value: unknown): ValueType | undefined {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) return "list";
  switch (typeof value) {
    case "string":
      return DATE_STRING.test(value) ? "date" : "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "object";
  }
}

async function listNotes(root: string): Promise<string[]> {
  const out: string[] = [];
  async function visit(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) await visit(join(dir, e.name));
      } else if (e.isFile() && e.name.endsWith(".md")) {
        out.push(join(dir, e.name));
      }
    }
  }
  await visit(root);
  return out;
}

function unreadable(path: string, detail: string): Notice {
  return { code: "types-json-unreadable", params: { path, detail }, message: `Could not read ${path}: ${detail}` };
}

async function readDeclared(root: string, warnings: Notice[]): Promise<Record<string, ValueType>> {
  const file = join(root, ".obsidian", "types.json");
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
      warnings.push(unreadable(file, (e as Error).message));
    }
    return {};
  }
  try {
    const data = JSON.parse(raw) as { types?: Record<string, unknown> };
    const types = data.types;
    if (!types || typeof types !== "object") throw new Error('no "types" object');
    const out: Record<string, ValueType> = {};
    for (const [name, kind] of Object.entries(types)) {
      const mapped = typeof kind === "string" && Object.hasOwn(DECLARED, kind) ? DECLARED[kind] : undefined;
      if (mapped) out[name] = mapped;
    }
    return out;
  } catch (e) {
    warnings.push(unreadable(file, (e as Error).message));
    return {};
  }
}

function addExample(info: PropertyInfo, type: ValueType, note: string): void {
  const list = (info.examples[type] ??= []);
  if (list.length < MAX_EXAMPLES && !list.includes(note)) list.push(note);
}

/**
 * Read the frontmatter of every note under `dir` and record which value types each
 * property has, with example notes. `.obsidian/types.json`, when present, wins.
 */
export async function indexVault(dir: string): Promise<VaultIndex> {
  const root = resolve(dir);
  try {
    if (!(await stat(root)).isDirectory()) throw new Error("not a directory");
  } catch {
    throw new BasesLintUsageError(
      `Vault folder not found: ${dir}. Pass an existing folder to --vault.`,
      "vault-missing",
      { path: dir },
    );
  }
  const warnings: Notice[] = [];
  const declared = await readDeclared(root, warnings);
  const properties: Record<string, PropertyInfo> = Object.create(null) as Record<string, PropertyInfo>;
  const info = (name: string): PropertyInfo => (properties[name] ??= { types: [], examples: {}, emptyItemNotes: [] });
  let notes = 0;
  for (const file of await listNotes(root)) {
    let text: string;
    try {
      if ((await stat(file)).size > MAX_NOTE_BYTES) continue;
      text = await readFile(file, "utf8");
    } catch {
      continue;
    }
    const fm = frontmatterText(text);
    if (fm === undefined) continue;
    let data: unknown;
    try {
      data = parse(fm, { logLevel: "silent" });
    } catch {
      continue;
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) continue;
    notes++;
    const notePath = relative(root, file).split(sep).join("/");
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const p = info(key);
      const kind = kindOf(value);
      if (!kind) continue;
      if (!p.types.includes(kind)) p.types.push(kind);
      addExample(p, kind, notePath);
      if (Array.isArray(value) && value.some((v) => v === null) && p.emptyItemNotes.length < MAX_EXAMPLES) {
        p.emptyItemNotes.push(notePath);
      }
    }
  }
  for (const [name, type] of Object.entries(declared)) {
    const p = info(name);
    p.declared = type;
    p.types = [type];
  }
  return { root, notes, properties, warnings };
}
