import { expect, test } from "bun:test";
import pkg from "../package.json" with { type: "json" };

test("--version prints the package version", async () => {
  const proc = Bun.spawn(["bun", "src/cli.ts", "--version"], { stdout: "pipe" });
  expect((await new Response(proc.stdout).text()).trim()).toBe(pkg.version);
  expect(await proc.exited).toBe(0);
});
