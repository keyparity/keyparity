import { listSecrets as ghListSecrets } from "./github.ts";
import { scanDir, TEST_GLOBS } from "./scanner.ts";
import { readTemplate, scanWorkflows } from "./sources.ts";
import { compare, type Entry } from "./validator.ts";

export type AuditResult = { entries: Entry[]; template: string | null; secretsChecked: boolean };

/** Gather every source for one folder and compare them. Secrets are skipped when asked. */
export async function runAudit(
  opts: { path: string; repo?: string; skipSecrets?: boolean; ignore?: string[]; includeTests?: boolean },
  deps: { listSecrets: (o: { repo?: string }) => Promise<string[]> } = { listSecrets: ghListSecrets },
): Promise<AuditResult> {
  const [code, workflows, template] = await Promise.all([scanDir(opts.path, [...(opts.includeTests ? [] : TEST_GLOBS), ...(opts.ignore ?? [])]), scanWorkflows(opts.path), readTemplate(opts.path)]);
  const secrets = opts.skipSecrets ? null : await deps.listSecrets({ repo: opts.repo });
  return {
    entries: compare({ code, workflows, template: template?.names ?? null, secrets }),
    template: template?.file ?? null,
    secretsChecked: secrets !== null,
  };
}
