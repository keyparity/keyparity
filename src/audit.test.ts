import { expect, test } from "bun:test";
import { join } from "node:path";
import { runAudit } from "./audit.ts";
import { render } from "./reporter.ts";

const app = join(import.meta.dir, "../test/fixtures/app");
const cli = (...args: string[]) =>
  Bun.spawn(["bun", join(import.meta.dir, "index.ts"), ...args], { stdout: "pipe", stderr: "pipe", env: { ...process.env, NO_COLOR: "1" } });

test("runAudit combines code, workflows, the template and secrets", async () => {
  const result = await runAudit({ path: app }, { listSecrets: async () => ["DB_URL", "STALE"] });
  const status = Object.fromEntries(result.entries.map((e) => [e.name, e.status]));
  expect(status).toEqual({
    API_KEY: "ci-missing", // in code, missing from the template and the secrets
    DB_URL: "synced",
    DEPLOY_TOKEN: "ci-missing", // a workflow needs it, no secret set
    OLD_FLAG: "unused",
    STALE: "unused",
  });
  expect(result.template).toBe(".env.example");
  expect(result.secretsChecked).toBe(true);
});

test("render groups by status, worst first, with a reference and counts", async () => {
  const result = await runAudit({ path: app }, { listSecrets: async () => ["DB_URL"] });
  const out = render(result, false);
  expect(out.indexOf("CI missing")).toBeLessThan(out.indexOf("Synced"));
  expect(out).toContain("API_KEY");
  expect(out).toContain("src/index.ts:2");
  expect(out).toContain("missing from .env.example and GitHub secrets");
  expect(out).toMatch(/1 synced, 2 CI missing, 0 local missing, 1 unused/);
});

test("render never prints a secret value, only names", async () => {
  const result = await runAudit({ path: app }, { listSecrets: async () => ["DB_URL"] });
  expect(render(result, false)).not.toContain("=");
});

test("CLI: --json prints machine-readable entries", async () => {
  const proc = cli("audit", "--path", app, "--skip-secrets", "--json");
  const out = JSON.parse(await new Response(proc.stdout).text());
  expect(await proc.exited).toBe(0);
  expect(out.secretsChecked).toBe(false);
  expect(out.entries.find((e: { name: string }) => e.name === "API_KEY").status).toBe("local-missing");
});

test("CLI: --strict exits 1 when anything is missing, 0 otherwise", async () => {
  const strict = cli("audit", "--path", app, "--skip-secrets", "--strict");
  await new Response(strict.stdout).text();
  expect(await strict.exited).toBe(1);
  const relaxed = cli("audit", "--path", app, "--skip-secrets");
  await new Response(relaxed.stdout).text();
  expect(await relaxed.exited).toBe(0);
});

test("CLI: output has no color codes when NO_COLOR is set", async () => {
  const proc = cli("audit", "--path", app, "--skip-secrets");
  expect(await new Response(proc.stdout).text()).not.toContain("\u001b[");
});

test("without the GitHub check, the synced heading doesn't claim more than it checked", async () => {
  const result = await runAudit({ path: app, skipSecrets: true }, { listSecrets: async () => [] });
  expect(render(result, false)).toContain("Synced, as far as checked");
});
