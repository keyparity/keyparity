import { readdir, readFile } from "node:fs/promises";
import picomatch from "picomatch";

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

// A quoted literal name. A name built at run time (an f-string, concatenation) never matches.
const ARG = `\\(\\s*["']${NAME}["']`;

const PY = [
  new RegExp(`\\bos\\.environ${KEY}`, "g"),
  new RegExp(`\\bos\\.environ\\.get${ARG}`, "g"),
  new RegExp(`\\bos\\.getenv${ARG}`, "g"),
];
const GO = [new RegExp(`\\bos\\.(?:Getenv|LookupEnv)\\(\\s*"${NAME}"`, "g")];
const RUST = [new RegExp(`\\benv::var(?:_os)?\\(\\s*"${NAME}"`, "g")];

const PATTERNS: Record<string, RegExp[]> = {
  js: JS, mjs: JS, cjs: JS, jsx: JS, ts: JS, tsx: JS,
  py: PY, go: GO, rs: RUST,
};

const SKIP = ["node_modules", "dist", ".git"];

/** Test files and fixtures mention env var names as data, not as config the app reads. */
export const TEST_GLOBS = ["**/*.test.*", "**/*.spec.*", "**/__tests__/**", "**/fixtures/**", "**/testdata/**"];

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
export async function scanDir(root: string, ignore: string[] = TEST_GLOBS): Promise<Map<string, Ref[]>> {
  const skipped = picomatch(ignore.length ? ignore : ["!**"]);
  const found = new Map<string, Ref[]>();
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !PATTERNS[entry.name.split(".").pop() ?? ""]) continue;
    const file = `${entry.parentPath}/${entry.name}`.slice(root.length).replace(/^[/\\]+/, "").replaceAll("\\", "/");
    // Hidden folders, like .git, are skipped too.
    if (file.split("/").some((part) => SKIP.includes(part) || part.startsWith(".")) || skipped(file)) continue;
    for (const ref of findRefs(await readFile(`${root}/${file}`, "utf8"), file)) {
      found.set(ref.name, [...(found.get(ref.name) ?? []), ref]);
    }
  }
  return found;
}
