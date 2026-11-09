import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findWorkflowSecrets, parseTemplate, readTemplate, scanWorkflows } from "./sources.ts";

test("finds secrets referenced in a workflow, with lines", () => {
  const yml = [
    "jobs:",
    "  deploy:",
    "    steps:",
    "      - run: ./deploy",
    "        env:",
    "          TOKEN: ${{ secrets.DEPLOY_TOKEN }}",
    "          KEY: ${{secrets.SIGNING_KEY}}",
  ].join("\n");
  expect(findWorkflowSecrets(yml, ".github/workflows/deploy.yml")).toEqual([
    { name: "DEPLOY_TOKEN", file: ".github/workflows/deploy.yml", line: 6 },
    { name: "SIGNING_KEY", file: ".github/workflows/deploy.yml", line: 7 },
  ]);
});

test("treats GITHUB_TOKEN as built in, never as a secret to set", () => {
  expect(findWorkflowSecrets("token: ${{ secrets.GITHUB_TOKEN }}", "ci.yml")).toEqual([]);
});

test("parses .env.example keys, ignoring comments, blanks, export and values", () => {
  const text = ["# Database", "DB_URL=postgres://localhost", "", "export API_KEY=", 'QUOTED="a b"', "  SPACED = 1", "not a line"].join("\n");
  expect(parseTemplate(text)).toEqual(["DB_URL", "API_KEY", "QUOTED", "SPACED"]);
});

test("scanWorkflows reads .yml and .yaml under .github/workflows", async () => {
  const root = await mkdtemp(join(tmpdir(), "keyparity-"));
  await mkdir(join(root, ".github/workflows"), { recursive: true });
  await writeFile(join(root, ".github/workflows/a.yml"), "x: ${{ secrets.ONE }}");
  await writeFile(join(root, ".github/workflows/b.yaml"), "x: ${{ secrets.TWO }}\ny: ${{ secrets.ONE }}");
  const found = await scanWorkflows(root);
  expect([...found.keys()].sort()).toEqual(["ONE", "TWO"]);
  expect(found.get("ONE")).toHaveLength(2);
});

test("readTemplate prefers .env.example, falls back to .env.template, and is null without either", async () => {
  const root = await mkdtemp(join(tmpdir(), "keyparity-"));
  expect(await readTemplate(root)).toBeNull();
  await writeFile(join(root, ".env.template"), "FROM_TEMPLATE=");
  expect(await readTemplate(root)).toEqual({ file: ".env.template", names: ["FROM_TEMPLATE"] });
  await writeFile(join(root, ".env.example"), "FROM_EXAMPLE=");
  expect(await readTemplate(root)).toEqual({ file: ".env.example", names: ["FROM_EXAMPLE"] });
});
