# Contributing to keyparity

Thanks for helping. Here's how to get a change in without surprises.

## Before you start

- **Claim an issue by commenting on it,** so two people don't build the same thing. You'll be assigned.
- **For anything big, open an issue first.** It's cheaper to agree on the shape before the code.

## Pull requests

- Branch from `main`, and keep each PR to one change.
- New behaviour comes with tests, and a bug fix comes with a test that fails without it. Run `bun test` and `bun run typecheck` before you push. CI runs both.
- Sign off every commit with `git commit -s`. That's the [Developer Certificate of Origin](https://developercertificate.org/): you're saying you have the right to contribute the change. CI checks for it.
- If your PR comes from a fork, its CI waits until a maintainer has read the diff and approved the run. That's normal, not a sign anything's wrong.
- If `main` moves on, click **Update branch** on your PR. We won't push to your branch.

## When a pull request goes quiet

If a PR has had no activity for 30 days, a maintainer checks in. At 60 days we either close it or finish it ourselves and credit you. There's no stale bot.
