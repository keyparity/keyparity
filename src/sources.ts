import { Glob } from "bun";
import type { Ref } from "./scanner.ts";

// Provided by GitHub Actions in every run, so it's never a secret anyone has to set.
const BUILT_IN = new Set(["GITHUB_TOKEN"]);
const SECRET = /\$\{\{\s*secrets\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/** Secrets a workflow file reads through ${{ secrets.NAME }}. */
export function findWorkflowSecrets(source: string, file: string): Ref[] {
  return [...source.matchAll(SECRET)]
    .filter((m) => !BUILT_IN.has(m[1]!))
    .map((m) => ({ name: m[1]!, file, line: source.slice(0, m.index).split("\n").length }));
}

/** Every secret the repo's workflows read, grouped by name. */
export async function scanWorkflows(root: string): Promise<Map<string, Ref[]>> {
  const found = new Map<string, Ref[]>();
  for await (const file of new Glob(".github/workflows/*.{yml,yaml}").scan({ cwd: root, dot: true })) {
    for (const ref of findWorkflowSecrets(await Bun.file(`${root}/${file}`).text(), file)) {
      found.set(ref.name, [...(found.get(ref.name) ?? []), ref]);
    }
  }
  return found;
}

/** The keys a .env-style template lists, in order. Values are never kept. */
export function parseTemplate(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1])
    .filter((name): name is string => !!name);
}

/** The repo's env template: .env.example, else .env.template, else null. */
export async function readTemplate(root: string): Promise<{ file: string; names: string[] } | null> {
  for (const file of [".env.example", ".env.template"]) {
    const f = Bun.file(`${root}/${file}`);
    if (await f.exists()) return { file, names: parseTemplate(await f.text()) };
  }
  return null;
}
