import type { Ref } from "./scanner.ts";

export type Status = "synced" | "local-missing" | "ci-missing" | "unused";
export type Entry = { name: string; status: Status; missingFrom: ("template" | "secrets")[]; refs: Ref[] };

/**
 * Sort every name into one status. A name can be missing from both the template and the
 * secrets; missingFrom lists both, and the status is the worse one: ci-missing breaks deploys.
 * A null template or secrets list means that source wasn't checked, so nothing is missing from it.
 */
export function compare(input: {
  code: Map<string, Ref[]>;
  workflows: Map<string, Ref[]>;
  template: string[] | null;
  secrets: string[] | null;
}): Entry[] {
  const { code, workflows, template, secrets } = input;
  const inTemplate = new Set(template ?? []);
  const inSecrets = new Set(secrets ?? []);
  const all = new Set([...code.keys(), ...workflows.keys(), ...inTemplate, ...inSecrets]);

  return [...all].sort().map((name) => {
    const refs = [...(code.get(name) ?? []), ...(workflows.get(name) ?? [])];
    if (refs.length === 0) return { name, status: "unused" as const, missingFrom: [], refs };
    const missingFrom: Entry["missingFrom"] = [];
    // Workflow-only names are CI's business, so they don't belong in a local template.
    if (template && code.has(name) && !inTemplate.has(name)) missingFrom.push("template");
    if (secrets && !inSecrets.has(name)) missingFrom.push("secrets");
    const status: Status = missingFrom.includes("secrets") ? "ci-missing" : missingFrom.length ? "local-missing" : "synced";
    return { name, status, missingFrom, refs };
  });
}
