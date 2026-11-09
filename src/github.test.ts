import { expect, test } from "bun:test";
import { listSecrets, type Run } from "./github.ts";

const ok = (stdout: string): Run => async () => ({ code: 0, stdout, stderr: "" });
const fail = (stderr: string): Run => async () => ({ code: 1, stdout: "", stderr });

test("returns secret names from gh secret list", async () => {
  expect(await listSecrets({}, ok('[{"name":"API_KEY"},{"name":"DB_URL"}]'))).toEqual(["API_KEY", "DB_URL"]);
});

test("asks gh for names only, for the given repo", async () => {
  let args: string[] = [];
  await listSecrets({ repo: "acme/app" }, async (a) => ((args = a), { code: 0, stdout: "[]", stderr: "" }));
  expect(args).toEqual(["secret", "list", "--json", "name", "--repo", "acme/app"]);
  expect(args.join(" ")).not.toContain("value");
});

test("says how to sign in when gh isn't authenticated", async () => {
  await expect(listSecrets({}, fail("To get started with GitHub CLI, please run:  gh auth login"))).rejects.toThrow(
    /gh auth login/,
  );
});

test("says what's wrong when the repo can't be read", async () => {
  await expect(listSecrets({ repo: "acme/app" }, fail("HTTP 404: Not Found"))).rejects.toThrow(/acme\/app/);
});

test("says to install gh when it isn't there", async () => {
  const missing: Run = async () => {
    throw Object.assign(new Error("spawn gh ENOENT"), { code: "ENOENT" });
  };
  await expect(listSecrets({}, missing)).rejects.toThrow(/cli\.github\.com/);
});
