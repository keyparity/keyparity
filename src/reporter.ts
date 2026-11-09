import { createColors } from "picocolors";
import type { AuditResult } from "./audit.ts";
import type { Status } from "./validator.ts";

// Worst first: a missing secret breaks a deploy, an unused one only clutters.
const GROUPS: { status: Status; title: string; color: "red" | "yellow" | "dim" | "green" }[] = [
  { status: "ci-missing", title: "CI missing", color: "red" },
  { status: "local-missing", title: "Local missing", color: "yellow" },
  { status: "unused", title: "Unused", color: "dim" },
  { status: "synced", title: "Synced", color: "green" },
];

/** The audit as a readable report. Names only: there are no values to print. */
export function render(result: AuditResult, color: boolean): string {
  const c = createColors(color);
  const template = result.template ?? ".env.example";
  const where = { template, secrets: "GitHub secrets" } as const;
  const lines: string[] = [];
  for (const g of GROUPS) {
    const entries = result.entries.filter((e) => e.status === g.status);
    if (entries.length === 0) continue;
    // Without the GitHub check, "synced" only means the checks that ran found nothing missing.
    const title = g.status === "synced" && !result.secretsChecked ? "Synced, as far as checked" : g.title;
    lines.push(c.bold(c[g.color](`${title} (${entries.length})`)));
    const width = Math.max(...entries.map((e) => e.name.length));
    for (const e of entries) {
      const first = e.refs[0];
      const at = first ? `${first.file}:${first.line}${e.refs.length > 1 ? ` +${e.refs.length - 1}` : ""}` : "not referenced";
      const why = e.missingFrom.length ? `  missing from ${e.missingFrom.map((m) => where[m]).join(" and ")}` : "";
      lines.push(`  ${e.name.padEnd(width)}  ${c.dim(at)}${why}`);
    }
    lines.push("");
  }
  const count = (s: Status) => result.entries.filter((e) => e.status === s).length;
  lines.push(`${count("synced")} synced, ${count("ci-missing")} CI missing, ${count("local-missing")} local missing, ${count("unused")} unused`);
  if (!result.template) lines.push(c.dim("No .env.example or .env.template found, so the local check was skipped."));
  if (!result.secretsChecked) lines.push(c.dim("GitHub secrets weren't checked."));
  return lines.join("\n");
}
