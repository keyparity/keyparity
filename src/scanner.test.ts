import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findRefs, scanDir } from "./scanner.ts";

const names = (source: string, file = "a.ts") => findRefs(source, file).map((r) => r.name);

test("finds process.env dot access", () => {
  expect(names("const k = process.env.API_KEY;")).toEqual(["API_KEY"]);
});

test("finds process.env bracket access with any quote", () => {
  expect(names(`process.env["DB_URL"]; process.env['REDIS_URL']; process.env[\`SMTP_HOST\`]`)).toEqual([
    "DB_URL",
    "REDIS_URL",
    "SMTP_HOST",
  ]);
});

test("finds Bun.env and import.meta.env", () => {
  expect(names(`Bun.env.PORT; Bun.env["HOST"]; import.meta.env.VITE_API`)).toEqual(["PORT", "HOST", "VITE_API"]);
});

test("ignores bare process.env, lowercase names and dynamic keys", () => {
  expect(names(`console.log(process.env); process.env.npm_config_cache; process.env[name]`)).toEqual([]);
});

test("reports the line of each reference", () => {
  const refs = findRefs("// start\nconst a = process.env.A;\n\nconst b = process.env.B;", "x.js");
  expect(refs).toEqual([
    { name: "A", file: "x.js", line: 2 },
    { name: "B", file: "x.js", line: 4 },
  ]);
});

test("only scans JS and TS files for these patterns", () => {
  expect(names("process.env.API_KEY", "notes.md")).toEqual([]);
  for (const ext of ["js", "mjs", "cjs", "ts", "tsx", "jsx"]) {
    expect(names("process.env.API_KEY", `a.${ext}`)).toEqual(["API_KEY"]);
  }
});

test("scanDir groups references by name and skips node_modules, dist and .git", async () => {
  const root = await mkdtemp(join(tmpdir(), "keyparity-"));
  await mkdir(join(root, "src"));
  await mkdir(join(root, "node_modules/pkg"), { recursive: true });
  await mkdir(join(root, "dist"));
  await writeFile(join(root, "src/a.ts"), "process.env.API_KEY\nprocess.env.DB_URL");
  await writeFile(join(root, "src/b.js"), "process.env.API_KEY");
  await writeFile(join(root, "node_modules/pkg/index.js"), "process.env.SHOULD_NOT_APPEAR");
  await writeFile(join(root, "dist/out.js"), "process.env.ALSO_NOT");

  const found = await scanDir(root);
  expect([...found.keys()].sort()).toEqual(["API_KEY", "DB_URL"]);
  expect(found.get("API_KEY")?.map((r) => r.file).sort()).toEqual(["src/a.ts", "src/b.js"]);
});
