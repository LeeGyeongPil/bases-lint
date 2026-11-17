import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { main, type CliIo } from "../src/cli.js";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const FIXTURES = join(ROOT, "test", "fixtures");
export const VAULT = join(FIXTURES, "vault");

export interface CliRun {
  code: number;
  out: string;
  err: string;
}

/** Run the CLI in-process with fake streams. */
export async function runCli(
  args: string[],
  opts: { env?: Record<string, string | undefined>; stdin?: string; cwd?: string } = {},
): Promise<CliRun> {
  let out = "";
  let err = "";
  const io: CliIo = {
    stdout: (s) => {
      out += s;
    },
    stderr: (s) => {
      err += s;
    },
    readStdin: async () => opts.stdin ?? "",
    // An explicit empty env keeps the host's LANG from changing test results.
    env: opts.env ?? {},
    cwd: opts.cwd ?? ROOT,
  };
  const code = await main(args, io);
  return { code, out, err };
}

const created: string[] = [];

/** Write a throwaway vault (path -> content) into the system temp folder. */
export async function makeVault(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "bases-lint-test-"));
  created.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
  }
  return dir;
}

export async function cleanupVaults(): Promise<void> {
  for (const d of created.splice(0)) await rm(d, { recursive: true, force: true });
}
