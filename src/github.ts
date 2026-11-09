/** Runs gh with these arguments. Swapped out in tests, so they never touch GitHub. */
export type Run = (args: string[]) => Promise<{ code: number; stdout: string; stderr: string }>;

const runGh: Run = async (args) => {
  const proc = Bun.spawn(["gh", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, stdout, stderr };
};

/**
 * The names of a repo's GitHub Actions secrets. Only names: GitHub never returns secret values
 * through this call, and keyparity never asks for them.
 */
export async function listSecrets(opts: { repo?: string }, run: Run = runGh): Promise<string[]> {
  const args = ["secret", "list", "--json", "name", ...(opts.repo ? ["--repo", opts.repo] : [])];
  let result;
  try {
    result = await run(args);
  } catch (err) {
    if ((err as { code?: string }).code === "ENOENT") {
      throw new Error("keyparity reads secret names through the GitHub CLI, and it isn't installed. Get it at https://cli.github.com");
    }
    throw err;
  }
  if (result.code !== 0) {
    if (/gh auth login/.test(result.stderr)) {
      throw new Error("The GitHub CLI isn't signed in. Run: gh auth login");
    }
    const where = opts.repo ?? "this repo";
    throw new Error(`Couldn't list the secrets of ${where}. Check that you can see the repo's secrets in its settings. gh said: ${result.stderr.trim()}`);
  }
  return (JSON.parse(result.stdout) as { name: string }[]).map((s) => s.name);
}
