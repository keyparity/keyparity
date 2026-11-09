import { expect, test } from "bun:test";
import type { Ref } from "./scanner.ts";
import { compare } from "./validator.ts";

const refs = (...names: string[]) => new Map<string, Ref[]>(names.map((n) => [n, [{ name: n, file: "a.ts", line: 1 }]]));
const statusOf = (r: ReturnType<typeof compare>, name: string) => r.find((e) => e.name === name)?.status;

test("synced: used in code, listed in the template, set as a secret", () => {
  const r = compare({ code: refs("API_KEY"), workflows: refs(), template: ["API_KEY"], secrets: ["API_KEY"] });
  expect(r).toEqual([{ name: "API_KEY", status: "synced", missingFrom: [], refs: [{ name: "API_KEY", file: "a.ts", line: 1 }] }]);
});

test("local missing: used in code, not in the template", () => {
  const r = compare({ code: refs("DB_URL"), workflows: refs(), template: [], secrets: ["DB_URL"] });
  expect(statusOf(r, "DB_URL")).toBe("local-missing");
});

test("CI missing: used by code or workflows, not a secret, and it outranks local missing", () => {
  const r = compare({ code: refs("A"), workflows: refs("DEPLOY_TOKEN"), template: [], secrets: [] });
  expect(statusOf(r, "DEPLOY_TOKEN")).toBe("ci-missing");
  expect(r.find((e) => e.name === "A")).toMatchObject({ status: "ci-missing", missingFrom: ["template", "secrets"] });
});

test("a name only workflows use doesn't need to be in the template", () => {
  const r = compare({ code: refs(), workflows: refs("NPM_TOKEN"), template: [], secrets: ["NPM_TOKEN"] });
  expect(statusOf(r, "NPM_TOKEN")).toBe("synced");
});

test("unused: a secret or template key nothing references", () => {
  const r = compare({ code: refs(), workflows: refs(), template: ["OLD_KEY"], secrets: ["STALE_SECRET"] });
  expect(statusOf(r, "OLD_KEY")).toBe("unused");
  expect(statusOf(r, "STALE_SECRET")).toBe("unused");
});

test("a check with no source is skipped, not counted as missing", () => {
  const r = compare({ code: refs("API_KEY"), workflows: refs(), template: null, secrets: null });
  expect(statusOf(r, "API_KEY")).toBe("synced");
});

test("results are sorted by name, and each name appears once", () => {
  const r = compare({ code: refs("B", "A"), workflows: refs("A"), template: ["A", "B", "C"], secrets: ["A", "B"] });
  expect(r.map((e) => e.name)).toEqual(["A", "B", "C"]);
});
