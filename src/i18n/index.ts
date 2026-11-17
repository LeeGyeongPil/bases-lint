import type { Lang } from "../types.js";
import { en, type MsgKey } from "./en.js";
import { ko } from "./ko.js";

export type { MsgKey };

const CATALOGS: Record<Lang, Record<MsgKey, string>> = { en, ko };

export type Params = Record<string, string | number>;

/** Translate `key` and fill `{name}` placeholders. Unknown placeholders stay as written. */
export function t(lang: Lang, key: MsgKey, params: Params = {}): string {
  const template = CATALOGS[lang][key];
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : whole,
  );
}

/** Pick the singular or plural unit word (`unit.<base>.one|other`). */
export function unit(lang: Lang, base: "problem" | "error" | "warning" | "info" | "file", n: number): string {
  return t(lang, `unit.${base}.${n === 1 ? "one" : "other"}` as MsgKey);
}

export function isLang(value: string): value is Lang {
  return value === "en" || value === "ko";
}

export function langFromLocale(value: string): Lang {
  return value.toLowerCase().startsWith("ko") ? "ko" : "en";
}

/**
 * Decide the message language. Order: `--lang`, then `BASES_LINT_LANG`, then the
 * first non-empty of `LC_ALL`, `LC_MESSAGES`, `LANG`. Anything not starting with
 * "ko" means English.
 */
export function resolveLang(flag: Lang | undefined, env: Record<string, string | undefined>): Lang {
  if (flag) return flag;
  for (const name of ["BASES_LINT_LANG", "LC_ALL", "LC_MESSAGES", "LANG"]) {
    const v = env[name];
    if (v) return langFromLocale(v);
  }
  return "en";
}

export const catalogs = CATALOGS;
