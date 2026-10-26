---
name: marketing-loop
description: One pass over livediagram's marketing app (livediagram/apps/marketing in the liveworkspace monorepo) - rotates two actions per run (bugs, unused code, missing features, comparisons + FAQ) onto a rolling PR, working each one deeply. Run with `/loop 1h /marketing-loop`.
---

# Marketing loop: one pass

Work from the repo root (`git rev-parse --show-toplevel`). Use `corepack pnpm` and `gh`. Find the repo once, `REPO=$(gh repo view --json nameWithOwner
-q .nameWithOwner)`, and pass `-R "$REPO"` to every `gh` call.
**Paths below are livediagram's** (`apps/marketing`, `docs/specs/...`, `packages/templates`): in the monorepo they
sit under `livediagram/`. The marketing pages every product shares live in the root's `packages/marketing-site`,
and the comparison pages in `packages/comparisons` (read the root AGENTS.md: shared code stays there, not in one
product).
This loop may push its own branch and open or update its own PR (an exception to "never open a PR without permission", for this loop only). Never push to main.

This loop runs unattended. Act on these rules and never stop to ask (AskUserQuestion). Put decisions in the report.

## 0. Rotation state

The rotation is per-user, in your Claude memory folder for this project: `project_marketing_loop.md`.
Read it first (create it if missing). Do the **two** actions after "Last action" in this order, wrapping round
(e.g. last was features: do comparisons-faq, then bugs). Set "Last action" to the second one:

1. **bugs**
2. **cleanup**
3. **features**
4. **comparisons-faq**

Update "Last action", "Last run" (absolute date + time) and "Open PR" at the end of every run, even when nothing
was found. A run that found nothing still advances the rotation.

**Scope per run: substantial, not small** (bigger passes since 2026-10-10). Each action aims to fix
everything it finds in its area, not one item: a run that lands only a one-line copy tweak has stopped short. Target
several meaningful fixes or additions per action (copy across all affected pages, new cards/FAQ entries, tests that
guard the class of bug). If an action finds genuinely nothing, say so and put the time into the other action.
Commit each action separately so the PR history stays readable.

## 1. Set up

1. `git fetch -q origin`.
2. Look for the rolling PR: `gh pr list -R "$REPO" --head marketing/audit --state open --json number,url,headRefName`.
   - Open PR: work on `marketing/audit`, `git pull --ff-only` (the PR loop pushes to it too), then
     `git merge origin/main` (merge, never rebase a pushed branch).
   - None: create `marketing/audit` fresh from `origin/main` (delete any stale local branch of that name first).
3. Work in a scratchpad worktree (`git worktree add <scratchpad>/marketing-audit marketing/audit`), or reuse the
   one `git worktree list` already shows (check `git status` is clean). Never `git stash` (shared across worktrees).
   Remove a worktree you created when the run ends.
4. Read `docs/specs/019-marketing/` (README, `marketing-site.md`, `landing-funnel.md`) and
   `packages/comparisons/README.md` (the comparison pages' spec) before changing anything. The spec wins over the
   code; a deliberate change to marketing behaviour updates the spec first (AGENTS.md).

## 2. Do this run's actions

Scope is the whole marketing app: `apps/marketing/{app,components,lib,public}` and the shared packages it renders
from (`@livediagram/templates`, `template-previews`, `icons`, `ui`, `@liveworkspace/comparisons`,
`@liveworkspace/marketing-site`) where the bug is in marketing's use of them.

### bugs

- Run `corepack pnpm --filter @livediagram/marketing typecheck lint test` and fix anything red.
- Build it (`corepack pnpm --filter @livediagram/marketing build`) and fix build or licence-verify failures.
- Check every internal link and redirect resolves: `public/_redirects`, `sitemap.ts`, links to `/help/...`,
  `/community`, `/new`, `/alternatives/<slug>`, `/features/<slug>`. A link to a help article must match
  `packages/help-registry`.
- Serve `out/` (or `next dev` on a free port at 3600+, so the dev servers already running keep their ports) and look at the
  landing page, a feature page, an alternatives page and the FAQ at desktop and phone width. Use a scratchpad
  Playwright script for the phone (`isMobile`, `hasTouch`, 390x844; resizing the Chrome window doesn't change its
  viewport). Look for broken layout, horizontal scroll, dark-mode contrast, console errors, broken images,
  animations ignoring reduced motion.
- Fix the root cause, and add a test that would have caught it where that is cheap.

### cleanup

- Find unused exports, components, CSS classes, keyframes, images in `public/` and test-only helpers in
  `apps/marketing`. Run `npx -y knip@5 --reporter json` (default, `--production`, `--include-entry-exports`),
  then confirm each hit with `git grep` across `*.ts`, `*.tsx`, `*.mdx` and `*.css`. False positives to expect:
  Next convention files (`page.tsx`, `layout.tsx`, `opengraph-image.tsx`, `twitter-image.tsx`, `apple-icon.tsx`,
  `sitemap.ts`, `robots.ts`, `manifest.ts`), `dynamic(() => import(...))`, `.mdx` consumers and dynamically built
  class names.
- Also fold duplicated code into an existing helper or a `packages/` module (AGENTS.md reuse rule), and split a
  marketing file past ~400 lines on a cohesive seam.
- Remove only what is confirmed unused; prove it with typecheck + tests + build.

### features

Full sweep, every time it is this action's turn:

1. List what the product has: `docs/specs/005-project-roadmap/prototype-scope.md` ("Where we are now"), the
   spec categories in `docs/specs/README.md`, the template catalogue in `packages/templates`, and the PRs merged
   to main since "Last features sweep" in the state file (`gh pr list -R "$REPO" --state merged --search
"merged:>=<date>"`).
2. List what marketing says: `lib/landing-content.tsx`, the feature category pages (`app/features/[slug]`),
   `lib/alternatives.ts` (our column), `lib/faq-content.tsx`, the template gallery, the hero scenes.
3. For each shipped, user-visible feature that marketing does not mention, or describes wrongly (renamed,
   retired, behaves differently), add or correct the copy in the section it belongs to. Prefer extending an
   existing section's bullets or a feature page over adding a new section. Never mention something that has
   not shipped to main, and never invent a paid tier (AGENTS.md: everything is free).
4. Use the domain language (Mode, Kind, Template) from `docs/specs/003-system-architecture/domain-language.md`
   and Title Case for headings and labels.
5. Record the sweep date in the state file ("Last features sweep").

### comparisons-faq

Comparisons compete on the competitor's own ground: say where livediagram is the better pick for what they do,
and where they are, never "they aren't a diagram tool".

1. **Our side**: for every competitor in `lib/alternatives.ts`, check that each livediagram claim is true
   on main today and that features we have shipped since are in the table/rows.
2. **Their side**: web-search each competitor's current pricing, free tier limits and the features the page
   names. Correct anything stale. Put the source URL for each competitor fact you change in the commit message
   body. Do not add new competitors (not authorised); note candidates in the report instead.
3. **FAQ** (`lib/faq-content.tsx`): every answer is still true; add questions for gaps a new visitor would
   ask about recently shipped features (self-hosting, AI/MCP, offline, collaboration, privacy, imports,
   exports, templates). Keep answers short and link to the help article where one exists.
4. Keep `packages/comparisons/README.md` true to what the pages now say.

## 3. Gate, commit, push

1. Gate: `corepack pnpm --filter @livediagram/marketing typecheck lint test build`, plus typecheck/tests of any
   other workspace touched, `prettier --check` on changed files, and `pnpm format:check` across the repo.
   Run commands with `set -o pipefail`.
2. Any new code ships with tests (check patch coverage with `vitest --coverage`).
3. Performance check: note any bundle/image/animation cost the change adds, measured.
4. Commit with explicit pathspecs (the auto-committer races the index), message ends with the Co-Authored-By
   trailer. No em dashes anywhere.
5. Before pushing, re-check the PR is still open (`gh pr view <n> -R "$REPO" --json state`): the PR loop can
   squash-merge it mid-run. If it merged, `git checkout -B marketing/audit origin/main`, cherry-pick this run's
   commits, push with `--force-with-lease`, and open a new PR (step 6). Push `marketing/audit` once per run. If
   the pre-push hook fails on a known flake, `push --no-verify` and say so in the PR.
6. No open PR yet: open a normal, ready-for-review PR (never draft) titled `Marketing audit` with a changelog
   description (Fixed / Added / Changed / Removed bullets), before-and-after screenshots of every visual change
   uploaded to the PR, and the `🤖 Generated with [Claude Code](https://claude.com/claude-code)` footer. PR open
   already: append this run's bullets to its description and add screenshots for what changed.

Nothing found: no commit, no push, no PR. Still update the state file.

The PR loop takes over CI, conflicts, comments and merging. Once the PR has merged, the next run starts a new one.

## 4. Report

Two or three lines: the actions run, what changed (with the commit), the PR link, and anything left for a person to decide.
