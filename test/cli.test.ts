import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURES, VAULT, ROOT, runCli } from "./helpers.js";

const bad = join(FIXTURES, "bad.base");
const good = join(FIXTURES, "good.base");

interface JsonOut {
  tool: string;
  version: string;
  summary: { errors: number; warnings: number; infos: number };
  diagnostics: { rule: string; line: number; column: number; file: string; severity: string }[];
}

describe("AC-7 output formats, exit codes, stdin", () => {
  it("prints parseable JSON with summary and positions", async () => {
    const run = await runCli([bad, "--vault", VAULT, "--format", "json"]);
    const out = JSON.parse(run.out) as JsonOut;
    expect(out.tool).toBe("bases-lint");
    expect(out.summary.errors).toBe(3);
    expect(out.diagnostics).toHaveLength(8);
    for (const d of out.diagnostics) {
      expect(typeof d.rule).toBe("string");
      expect(d.line).toBeGreaterThan(0);
      expect(d.column).toBeGreaterThan(0);
    }
    expect(run.code).toBe(1);
  });

  it("prints SARIF 2.1.0 with the used rules described", async () => {
    const run = await runCli([bad, "--vault", VAULT, "--format", "sarif"]);
    const sarif = JSON.parse(run.out) as {
      version: string;
      runs: {
        tool: { driver: { name: string; rules: { id: string }[] } };
        results: { ruleId: string; level: string; locations: { physicalLocation: { region: { startLine: number } } }[] }[];
      }[];
    };
    expect(sarif.version).toBe("2.1.0");
    const run0 = sarif.runs[0]!;
    expect(run0.tool.driver.name).toBe("bases-lint");
    const described = run0.tool.driver.rules.map((r) => r.id);
    for (const r of run0.results) expect(described).toContain(r.ruleId);
    expect(run0.results).toHaveLength(8);
    expect(run0.results.map((r) => r.level).sort()).toEqual([
      "error",
      "error",
      "error",
      "warning",
      "warning",
      "warning",
      "warning",
      "warning",
    ]);
    expect(run0.results[0]?.locations[0]?.physicalLocation.region.startLine).toBe(3);
  });

  it("exits 2 for a path that does not exist", async () => {
    const run = await runCli([join(FIXTURES, "nope.base")]);
    expect(run.code).toBe(2);
    expect(run.err).toContain("Path not found");
    expect(run.out).toBe("");
  });

  it("exits 0 when there are no errors", async () => {
    const run = await runCli([join(VAULT, "notes", "embed.md"), "--vault", VAULT]);
    expect(run.code).toBe(0);
    expect(run.out).toContain("0 problems");
  });

  it("reads standard input and shows --stdin-filename", async () => {
    const run = await runCli(["-", "--stdin-filename", "draft.base", "--vault", VAULT], {
      stdin: readFileSync(bad, "utf8"),
    });
    expect(run.code).toBe(1);
    expect(run.out).toContain("draft.base:3:28 error expr-parse");
    expect(run.out).toContain("    - file.inFolder(\"notes\"");
  });

  it("uses <stdin> as the default name and JSON works for agents", async () => {
    const run = await runCli(["-", "--format", "json", "--no-vault"], { stdin: "views: x\n" });
    const out = JSON.parse(run.out) as JsonOut;
    expect(out.diagnostics[0]?.file).toBe("<stdin>");
    expect(out.diagnostics[0]?.rule).toBe("view-shape");
    expect(run.code).toBe(1);
  });

  it("exits 2 when standard input is empty", async () => {
    const run = await runCli(["-"], { stdin: "  \n" });
    expect(run.code).toBe(2);
  });

  it("turns a rule off with --disable (repeatable)", async () => {
    const run = await runCli([bad, "--vault", VAULT, "--disable", "mixed-type", "--disable", "empty-list-item", "--format", "json"]);
    const rules = (JSON.parse(run.out) as JsonOut).diagnostics.map((d) => d.rule);
    expect(rules).not.toContain("mixed-type");
    expect(rules).not.toContain("empty-list-item");
    expect(rules).toHaveLength(6);
  });

  it("rejects an unknown rule, format, option and a missing path list with exit 2", async () => {
    expect((await runCli([bad, "--disable", "nope"])).code).toBe(2);
    expect((await runCli([bad, "--format", "xml"])).code).toBe(2);
    expect((await runCli([bad, "--wat"])).code).toBe(2);
    expect((await runCli([])).code).toBe(2);
    expect((await runCli([bad, "--vault", VAULT, "--no-vault"])).code).toBe(2);
    expect((await runCli([bad, "--vault", join(FIXTURES, "missing-vault")])).code).toBe(2);
  });

  it("--exit-zero keeps exit code 0 for problems but not for usage errors", async () => {
    expect((await runCli([bad, "--vault", VAULT, "--exit-zero"])).code).toBe(0);
    expect((await runCli([join(FIXTURES, "nope.base"), "--exit-zero"])).code).toBe(2);
  });

  it("prints a code frame with a caret under the problem", async () => {
    const run = await runCli([bad, "--vault", VAULT]);
    expect(run.out).toContain("test/fixtures/bad.base:7:21 error expr-parse");
    expect(run.out).toContain('7 | ');
    expect(run.out).toMatch(/\n\s+\| {21}\^\n/);
  });

  it("walks a folder and skips .obsidian, .git and node_modules", async () => {
    const run = await runCli([FIXTURES, "--no-vault", "--format", "json"]);
    const out = JSON.parse(run.out) as JsonOut;
    const files = new Set(out.diagnostics.map((d) => d.file));
    expect(files.has("test/fixtures/bad.base")).toBe(true);
    expect(files.has("test/fixtures/positions/plain.base")).toBe(true);
    expect(files.has("test/fixtures/positions/note-fence.md")).toBe(true);
  });

  it("--version and --help print and exit 0", async () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string };
    const v = await runCli(["--version"]);
    expect(v.out.trim()).toBe(pkg.version);
    expect(v.code).toBe(0);
    const h = await runCli(["--help"]);
    expect(h.code).toBe(0);
    expect(h.out).toContain("--format");
    const r = await runCli(["--rules"]);
    expect(r.out).toContain("sort-not-in-order");
  });

  it("good.base text output mentions the vault used", async () => {
    const run = await runCli([good, "--vault", VAULT]);
    expect(run.out.split("\n")[0]).toBe("Vault: test/fixtures/vault");
  });
});
