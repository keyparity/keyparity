import { Glob } from "bun";

/** One place in the code that reads an environment variable. */
export type Ref = { name: string; file: string; line: number };

// Env var names by convention: upper case, digits and underscores, not starting with a digit.
const NAME = "([A-Z_][A-Z0-9_]*)";
const KEY = `\\[\\s*["'\`]${NAME}["'\`]\\s*\\]`;

const JS = [
  new RegExp(`\\bprocess\\.env\\.${NAME}\\b`, "g"),
  new RegExp(`\\bprocess\\.env${KEY}`, "g"),
  new RegExp(`\\bBun\\.env\\.${NAME}\\b`, "g"),
  new RegExp(`\\bBun\\.env${KEY}`, "g"),
  new RegExp(`\\bimport\\.meta\\.env\\.${NAME}\\b`, "g"),
];

const PATTERNS: Record<string, RegExp[]> = {
  js: JS, mjs: JS, cjs: JS, jsx: JS, ts: JS, tsx: JS,
};

const SKIP = ["node_modules", "dist", ".git"];

/** Every env var reference in one file's source, in order of position. */
export function findRefs(source: string, file: string): Ref[] {
  const patterns = PATTERNS[file.split(".").pop() ?? ""];
  if (!patterns) return [];
  const hits: { name: string; index: number }[] = [];
  for (const pattern of patterns) {
    for (const m of source.matchAll(pattern)) hits.push({ name: m[1]!, index: m.index });
  }
  return hits
    .sort((a, b) => a.index - b.index)
    .map(({ name, index }) => ({ name, file, line: source.slice(0, index).split("\n").length }));
}

/** Every env var reference under root, grouped by name. File paths are relative to root. */
export async function scanDir(root: string): Promise<Map<string, Ref[]>> {
  const found = new Map<string, Ref[]>();
  const glob = new Glob(`**/*.{${Object.keys(PATTERNS).join(",")}}`);
  for await (const file of glob.scan({ cwd: root, dot: false })) {
    if (file.split("/").some((part) => SKIP.includes(part))) continue;
    for (const ref of findRefs(await Bun.file(`${root}/${file}`).text(), file)) {
      found.set(ref.name, [...(found.get(ref.name) ?? []), ref]);
    }
  }
  return found;
}
