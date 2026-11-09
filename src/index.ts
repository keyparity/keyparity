#!/usr/bin/env bun
import { Command } from "commander";
import { isColorSupported } from "picocolors";
import pkg from "../package.json" with { type: "json" };
import { runAudit } from "./audit.ts";
import { render } from "./reporter.ts";
import { scanDir, TEST_GLOBS } from "./scanner.ts";
import { buildTemplate } from "./template.ts";

export const program = new Command()
  .name("keyparity")
  .description(pkg.description)
  .version(pkg.version);

program
  .command("audit")
  .description("Check env vars in code against .env.example and GitHub secrets")
  .option("--path <dir>", "folder to audit", ".")
  .option("--repo <owner/repo>", "repo whose secrets to check (default: the current one)")
  .option("--skip-secrets", "don't check GitHub secrets")
  .option("--ignore <glob...>", "skip files matching these globs")
  .option("--include-tests", "also scan test files and fixtures (skipped by default)")
  .option("--strict", "exit 1 if anything is missing, to fail CI")
  .option("--json", "print JSON instead of a report")
  .action(async (opts: { path: string; repo?: string; skipSecrets?: boolean; ignore?: string[]; includeTests?: boolean; strict?: boolean; json?: boolean }) => {
    try {
      const result = await runAudit({ path: opts.path, repo: opts.repo, skipSecrets: opts.skipSecrets, ignore: opts.ignore, includeTests: opts.includeTests });
      console.log(opts.json ? JSON.stringify(result, null, 2) : render(result, isColorSupported));
      if (opts.strict && result.entries.some((e) => e.status === "ci-missing" || e.status === "local-missing")) {
        process.exitCode = 1;
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exitCode = 2;
    }
  });

program
  .command("generate-template")
  .description("Print a .env.example listing every env var the code reads")
  .option("--path <dir>", "folder to scan", ".")
  .option("--write", "write .env.example in that folder (never overwrites)")
  .action(async (opts: { path: string; write?: boolean }) => {
    const body = buildTemplate([...(await scanDir(opts.path, TEST_GLOBS)).keys()]);
    if (!opts.write) return void process.stdout.write(body);
    const file = Bun.file(`${opts.path}/.env.example`);
    if (await file.exists()) {
      console.error(`${opts.path}/.env.example already exists. keyparity won't overwrite it. Run without --write to see the output.`);
      process.exitCode = 1;
      return;
    }
    await Bun.write(file, body);
    console.log(`Wrote ${opts.path}/.env.example`);
  });

if (import.meta.main) await program.parseAsync();
