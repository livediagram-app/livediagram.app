---
name: help-loop
description: One pass over the help centres (livediagram, liveplanner, livedocuments, livedesign) - audits about 20 articles against the code on main, fixing wrong, unclear, missing and retired articles and their figures, onto ONE rolling PR. Run with `/loop 2h /help-loop`.
---

# Help loop: one pass

Work from the repo root (`git rev-parse --show-toplevel`). Use `corepack pnpm` and `gh`. Find the repo once,
`REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)`, and pass `-R "$REPO"` to every `gh` call. For
turbo and the pre-push hook, put a corepack shim on PATH (`corepack enable --install-directory <scratchpad>/bin
pnpm`).

Each product has its own help centre at `<product>/apps/help` (served at `/help`), its catalogue in
`<product>/packages/help-registry/src/index.ts`, and its spec in `<product>/docs/specs/018-help/`. What every help
centre shares (pages, components, the illustration kit in `src/art/`) is `packages/help-site`: read its README
before touching a figure.

This loop may push its own branch and open or update its own PR (an exception to "never open a PR without
permission", for this loop only). Never push to main, merge a PR or deploy. It runs unattended: act on these rules
and never stop to ask (AskUserQuestion). Put decisions in the report.

## 0. Rotation state

The rotation is per-user, in your Claude memory folder for this project: `project_help_loop.md`. Read it first
(create it if missing). It holds, per product, the last category (and last article, if a category was split)
audited; the product the last run did; "Last run" (absolute date and time); the open PR; and a "Known, not fixed"
list so later runs don't re-investigate.

- **Products take turns**: each run audits the next product after the last one, in the order livediagram,
  liveplanner, livedocuments, livedesign.
- **Within a product, categories go in registry order** (the `categories` array), carrying on from where that
  product stopped and wrapping round to start a new round.
- **Batch: about 20 articles per run**, whole categories, at least two small ones. A category bigger than the
  batch is split, recording the last article done. Sub-articles ride with their parent: `find
<product>/apps/help/app/<category> -mindepth 2 -name page.mdx`.
- **Recent changes jump the queue.** List PRs merged since "Last run" (`gh pr list -R "$REPO" --state merged
--search "merged:>=<date>"`). Articles in this run's product that describe a feature those PRs changed go into
  this batch, ahead of the rotation, within the 20.

Update the state at the end of every run, even when nothing was found. A run that found nothing still advances.

## 1. Set up

1. `git fetch -q origin`.
2. Look for the rolling PR: `gh pr list -R "$REPO" --head docs/help-audit --state open --json number,url`.
   - Open PR: work on `docs/help-audit`, `git pull --ff-only`, then `git merge origin/main` (merge, never rebase a
     pushed branch), so the audit reads current code.
   - None (it merged, and the remote branch is gone): create `docs/help-audit` fresh from `origin/main`.
3. Work in a scratchpad worktree (`git worktree add <scratchpad>/help-audit docs/help-audit`), or reuse the one
   `git worktree list` shows if `git status` is clean. Run `corepack pnpm install --frozen-lockfile` in it, or
   tests fail on missing workspace packages. Never `git stash`.
4. Read the product's `docs/specs/018-help/` and `docs/instructions/register-a-help-article.md`.

## 2. Audit

Fan the batch out to up to 5 `Explore` agents, about 4 articles each, in one message. Brief each one to read its
articles and every figure they render, check each claim against the code on `origin/main` (not an open branch:
features on unmerged branches don't count), and report each discrepancy with the article line and the code's
`file:line` as evidence. Then **spot-check every claim yourself before editing**: agents misread toggles and menus.
The usual misreads:

- **Share roles** are the commonest error. Check each against the `can` gates: Participants take part (answer,
  ideas, Q&A, reactions, comments) and Viewers only look, but read-only code paths often cover both.
- A menu section alone in a flyout is promoted to the parent menu, so "Tools, then X" can be wrong.
- Toggles that look one-way often aren't: verify before "fixing" one.

What a run may do:

- **Rewrite** inaccurate content and **clarify** unclear content, in the product's voice and its domain language
  (Title Case for headings and labels, no em dashes).
- **Add** an article for a shipped, user-visible feature that has none.
- **Remove** an article for a feature that's gone: delete it, unregister it, and fix every link to it (help MDX,
  in-app help links, marketing, docs, registry `parentSlug`).
- **Redraw figures** that are wrong or tangled, in the house primitives from `@liveworkspace/help-site` (elbow
  connectors, no crossing lines). A figure the same in every product belongs in `help-site/src/art`, not one app.
- Any add, remove or rename follows `register-a-help-article.md` in the same commit (registry entry, keywords,
  `articleCount`, card icon).

**Bugs the audit finds in the product** (the article is right, the code is wrong): don't fix them here. Add them
to "Known, not fixed" with `file:line` and list them in the PR, so the bug loop or a person can pick them up.

## 3. Gate, commit, push

1. Gate: `corepack pnpm --filter @<product>/help typecheck lint test build` (its tests cover the registry
   too) and `prettier --check` on changed files. Run commands with `set -o pipefail`.
2. Screenshot every changed article and figure, light and dark, desktop and 390px phone: serve the build's
   `out/` with `python3 -m http.server` from a directory holding a `help -> <product>/apps/help/out` symlink
   (the basePath is `/help`), on a port at 3600+.
3. Commit each category separately with explicit pathspecs; the message ends with the Co-Authored-By trailer.
4. Re-check the PR is still open (`gh pr view <n> -R "$REPO" --json state`) right before pushing: if it merged
   mid-run, `git checkout -B docs/help-audit origin/main`, cherry-pick this run's commits, and push with `-u`.
   Push once per run. If the pre-push hook fails only on timing tests that pass alone, `push --no-verify` and say
   so in the PR.
5. No open PR: open a ready-for-review PR (never draft) titled `Help audit`. Either way, write its description
   from a file (`gh pr edit <n> --body-file`): an inline heredoc has blanked a PR body before. Per category, a
   bullet per change (what the article said, what's true, the evidence), the screenshots uploaded to the PR, the
   bugs found but not fixed, and the `🤖 Generated with [Claude Code](https://claude.com/claude-code)` footer.
   Check the image count in the new body before replacing the old one.

Nothing found: no commit, no push. Still update the state. Remove the worktree you created. The PR loop takes over
CI, conflicts and merging; once the PR has merged, the next run starts a new one.

## 4. Report

Two or three lines: the product and categories audited, how many articles changed (with the commits), the PR link,
the bugs found but not fixed, and anything left for a person to decide.
