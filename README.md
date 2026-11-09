# keyparity

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/16475/badge)](https://www.bestpractices.dev/projects/16475)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/keyparity/keyparity/badge)](https://scorecard.dev/viewer/?uri=github.com/keyparity/keyparity)

Your code reads `STRIPE_KEY`. Your `.env.example` forgot it, and so did the repo's GitHub Secrets. You find out when the deploy fails at 2 a.m.

keyparity checks that every environment variable your code uses is listed in `.env.example` and set as a GitHub Secret, and flags the ones nobody uses any more. It reads secret **names** only, never values.

## Install

Download the binary for your system from the [latest release](https://github.com/keyparity/keyparity/releases/latest). On an Apple Silicon Mac:

```sh
curl -fsSLo keyparity https://github.com/keyparity/keyparity/releases/download/v0.1.0/keyparity-darwin-arm64
gh attestation verify keyparity --repo keyparity/keyparity
chmod +x keyparity && mv keyparity /usr/local/bin/
```

There are also builds for Intel Macs, Linux (x64 and arm64) and Windows. Each file is listed in `SHA256SUMS` and has a build attestation. Checking secrets needs the [GitHub CLI](https://cli.github.com), signed in.

## Use it

```sh
keyparity audit                    # check this repo against .env.example and its GitHub secrets
keyparity audit --strict           # exit 1 if anything is missing: put this in CI
keyparity generate-template        # print a .env.example built from your code
```

Here's `keyparity audit --skip-secrets` on a small example project:

```
Local missing (1)
  API_KEY  src/index.ts:2  missing from .env.example

Unused (1)
  OLD_FLAG  not referenced

Synced, as far as checked (2)
  DB_URL        src/index.ts:1
  DEPLOY_TOKEN  .github/workflows/deploy.yml:5

2 synced, 0 CI missing, 1 local missing, 1 unused
GitHub secrets weren't checked.
```

It reads env vars from JavaScript and TypeScript (`process.env`, `Bun.env`, `import.meta.env`), Python (`os.environ`, `os.getenv`), Go (`os.Getenv`, `os.LookupEnv`), Rust (`env::var`) and GitHub Actions workflows (`${{ secrets.NAME }}`). Test files and fixtures are skipped unless you pass `--include-tests`. Run `keyparity audit --help` for every flag.

## Contributing

Issues and ideas are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). To work on it locally, you need [Bun](https://bun.sh):

```sh
bun install
bun test
```

## License

[MIT](LICENSE)
