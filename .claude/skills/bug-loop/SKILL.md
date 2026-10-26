---
name: bug-loop
description: One hourly pass over the liveworkspace monorepo that finds and fixes obvious bugs in several areas at once, all appended to ONE rolling PR. Run with `/loop 1h /bug-loop`.
---

# Bug loop: one pass

Work from the repo root (`git rev-parse --show-toplevel`). Use `corepack pnpm` and `gh` (on Tom's Mac it's
`/opt/homebrew/bin/gh`, not on PATH). Find the repo once, `REPO=$(gh repo view --json nameWithOwner -q
.nameWithOwner)`, and pass `-R "$REPO"` to every `gh` call. For turbo, put a corepack shim on PATH
(`corepack enable --install-directory <scratchpad>/bin pnpm`).

The owner authorised this loop (2026-10-25) to push its own `bugs/*` branches. **All fixes go into ONE rolling PR** (`bugs/sweep-<date>`): never open a PR per area or per run. Every PR and every push to one runs the full CI matrix; 27 PRs used up the org's Actions minutes on 2026-10-26. Never push
to `main`, never merge a PR, never deploy. The goal is to clear the remaining obvious bugs overnight, so a run
fixes **many** bugs, never one: each area's agent aims for every obvious bug it can find and prove.

This loop runs unattended. Act on these rules and never stop to ask (AskUserQuestion). Put decisions in the report.

## 0. State

The run history is per-user, in your Claude memory folder for this project: `project_bug_loop.md`. Read it
first, create it if missing. It holds "Last areas", "Last run" (absolute date and time), the open loop PRs, and
a "Known, not fixed" list (bugs found but left, with why) so later runs don't re-investigate them.

Areas, in rotation. Each run takes the **next three** after "Last areas", wrapping round:

1. **platform**: liveworkspace/apps/* (site, accounts, index, drive, telemetry, status, media, community
   service) and the Explorer.
2. **livediagram**: livediagram/ (editor, api, router, marketing, help, community, mcp).
3. **liveplanner**: liveplanner/.
4. **livedocuments**: livedocuments/.
5. **livedesign**: livedesign/.
6. **packages**: packages/* (shared UI, workbench, explorer, settings-ui, account-menu, model-core, sites).

## 1. Look after the rolling PR first

For each open PR whose head starts with `bugs/` (`gh pr list -R "$REPO" --state open --json
number,headRefName,mergeable`):

- red CI (`gh pr checks <n> -R "$REPO"`): fix it on that branch. A run whose jobs have no steps and no runner
  means Actions didn't start it (spent minutes or a billing hold): don't push for it, just note it in the report;
- conflicts with main: `git merge origin/main` on the branch (never rebase a pushed branch), resolve;
- review comments: act on them.

Do this with one agent for all of them, in parallel with step 2. It commits but doesn't push: its changes go out
in the run's single push (step 3).

## 2. Hunt and fix: one agent per area, three in parallel

`git fetch -q origin`. Spawn one background `general-purpose` agent per area, each with
`isolation: "worktree"`, all in one message. Brief each one with the following.

**Brief:**

- Branch `bugs/<area>-<YYYYMMDD-HHMM>` from `origin/main`. Read AGENTS.md, README.md, docs/structure.md and
  the area's AGENTS.md and specs.
- **Find bugs, broadly.** Aim for 5–15 real, provable fixes; stop at what is obvious and safe. Sources:
  - typecheck, oxlint and vitest failures in the area's packages (`--maxWorkers=2`, one package at a time);
  - CI on main: `gh run list -R "$REPO" --branch main --limit 10` and the failing jobs' logs;
  - stale generated files their own "up to date" tests flag (regenerate with the package's script);
  - code that contradicts its spec (the spec wins, unless the spec is clearly the stale side; then say so);
  - the owner's running local apps on ports 3000–3499, **read-only**: load the area's main pages at
    desktop and 390px phone width (a scratchpad Playwright script with `isMobile`, `hasTouch`, 390x844;
    resizing the Chrome window doesn't change its viewport), and look for console errors, failed requests,
    404 links, horizontal scroll, broken dark mode and clipped menus;
  - error handling gaps, wrong copy, dead links and broken redirects you find while reading.
- **Skip** anything that is a product decision, a redesign, or a feature request. Note it under "Known, not
  fixed" in the report instead.
- **Each fix:** fix the root cause, add a cheap test that would have caught it, and keep the spec true.
  A change to intended behaviour updates the spec first. Commit fixes in small logical commits, each message
  ending with the Co-Authored-By trailer. Don't commit pnpm-lock.yaml unless required.
- **Gate:** typecheck, oxlint, `prettier --check` on changed files and vitest for every touched package.
- **Performance** (owner's global rule before any push): read the touched code paths for cost (hot paths,
  re-renders, N+1, bundle size), measure what is cheap, and fix it in the same change.
- **Push the branch, open no PR** (CI runs only on PRs and main, so a plain branch push costs no minutes).
  Screenshot every visual change before and after into the scratchpad.
- **Report:** the branch name, then a PR-style section for the coordinator to paste into the rolling PR: one calm
  paragraph of context, then a bullet per bug (symptom, cause, fix), a Performance section with what you measured,
  and the absolute paths of the screenshots. Then the "Known, not fixed" items and any test that was already red
  on main and that you left. No fixes found: no branch, and say so.

**Hard rules for every agent (copy them in verbatim):**

- NEVER pkill, killall or kill by name; stop only PIDs you started. Don't stop, restart or bind the owner's
  dev servers (ports 3000–3499), or Wrangler workers named liveworkspace-_, live_-api, live*-mcp or
  live*-router-local. Wrangler's registry is machine-wide. Your own servers go on 3600+.
- Don't touch .dev.vars or .env files. Don't touch the main checkout's working tree (the repo root the loop
  was started from): other sessions keep uncommitted work there. Never `git stash`.
- Never push to main, open or merge a PR, or deploy. Don't apply remote D1 migrations.
- Before fixing, check `git worktree list` and the open PRs (`gh pr list -R "$REPO" --state open`). Leave alone
  code another open branch or agent is changing.
- One package's tests at a time, `--maxWorkers=2`: three agents share this machine.

## 3. Wrap up

When the agents report:

- Merge their area branches into the rolling branch in a scratchpad worktree, run typecheck and lint over the
  touched packages, and push it **once** per run. Open the rolling PR (ready, never draft) if none is open, and
  add each area's section to its description, with the screenshots uploaded to it. End the description with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Clean up: remove the agents' worktrees and your own (`git worktree remove`), and delete the pushed area branches
  once merged into the rolling branch (`git push origin --delete bugs/<area>-...`, plus the local branch).
- Update the state file: "Last areas", "Last run", open loop PRs, and merge their "Known, not fixed" lists.
- Send the owner a short summary per area: the PR link, how many bugs were fixed and the notable ones, and
  anything that needs their decision.

Keep the coordinator's own context light: read the agents' reports, not their transcripts.
