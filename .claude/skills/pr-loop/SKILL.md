---
name: pr-loop
description: One pass over your open PRs on the liveworkspace monorepo (every product) - fix red CI, act on comments, resolve conflicts, merge what is ready. Run on a timer with `/loop 30m /pr-loop`.
---

# PR loop: one pass

Work from the repo root (`git rev-parse --show-toplevel`). Every product is in this one repo; read its AGENTS.md
and docs/ci.md. Use `corepack pnpm` and `gh`. Find the repo once per pass, `REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)`, and pass
`-R "$REPO"` to every `gh` call, so the loop keeps working when the repo moves or is renamed.

Until livediagram moves back into its own repo (docs/migration.md), `livediagram-app/livediagram.app` may still
hold open PRs. If `$REPO` is a different repo, don't work them here: list them in the report
(`gh pr list -R livediagram-app/livediagram.app --state open`) to decide.

This loop runs unattended. Act on these rules and never stop to ask (AskUserQuestion): a question nobody answers
stalls every later pass. Write judgement calls and open decisions into the report instead.

## 1. Collect

1. `git fetch -q origin`.
2. List open PRs: `gh pr list -R "$REPO" --author "$(gh api user -q .login)" --state open --json number,title,headRefName,labels`.
   (`--author @me` has returned an empty list, so look the login up.)
3. For each PR, gather in one go:
   - checks: `gh pr checks <n> -R "$REPO" --json name,bucket,link` (with `--json` it exits 0 even when red);
   - state: `gh pr view <n> -R "$REPO" --json state,mergeable,mergeStateStatus,comments,reviews`;
   - unresolved review threads: `gh api graphql` on `pullRequest(number:n){reviewThreads(first:50){nodes{isResolved
comments(first:5){nodes{body path}}}}}`, with the owner and name split from `$REPO`.
   - `mergeable: UNKNOWN` just means GitHub has not computed it yet: re-query once, else defer to next pass.

If nothing needs doing on any PR, stop: no commits, no comments, a one-line "nothing to do" reply.

**Red with no log is not a code failure.** If a run's jobs have no steps and no runner (`gh api
repos/$REPO/actions/runs/<id>/jobs --jq '.jobs[]|"\(.name) \(.steps|length)"'` shows 0 steps), Actions didn't
start it: usually spent minutes or a billing hold. Don't push fixes or reruns for it. Say once in the report that
CI isn't running, and carry on with conflicts and comments.

**"Keep going till they are clear" does not end at an empty queue.** Other sessions open PRs all the time
(2026-10-15: I reported the backlog clear and stopped, and six new PRs sat red for hours). When asked to clear a
backlog, keep re-listing open PRs (a Monitor polling `gh pr list` every few minutes, or `/loop`) until you're told to stop.

## Velocity first: CI is the bottleneck

Every push to a PR restarts its full CI run, and runs queue behind each other. Spending CI on the wrong PR stalls
the whole backlog (2026-10-14: merging main into ~10 PRs at once clogged CI, nothing merged, and the open count
went from 12 to 19). Minutes are finite too: 27 PRs used up the org's Actions minutes on 2026-10-26. So:

- **Merge before you fix.** Each pass, first merge every PR that is already green + `CLEAN` (section 3). Main does
  not require branches to be up to date: `CLEAN` is enough. Do not hold a ready PR back for a nicer order.
- **Never merge main into a PR pre-emptively.** Only push to a branch that is `CONFLICTING` or red for a reason
  you must fix. "Behind main" is not a reason.
- **Work from the front of the queue.** Fix the PR closest to merging (fewest pending checks, smallest fix) first,
  one at a time, and let it land before touching the next. Updating a PR far down the list is wasted CI: it will
  need another update by the time it reaches the front.
- **Never push to a PR whose CI is mid-run** unless a check on it has already failed.
- **A red caused by a test since fixed on main**: merge main into that one PR when you get to it, not into every
  PR that shows the same red.
- **Batch fixes into one push per PR per pass.** Gate everything locally first, then push once.

## 2. Work each PR that needs it

Work in the PR branch's existing worktree if `git worktree list` shows one and `git status --porcelain
--untracked-files=no` is empty, otherwise create a fresh worktree in the scratchpad. A worktree with uncommitted
edits means another session is working that branch right now: do not merge or push there; leave the PR to that
session (message it via ListAgents/SendMessage) and move to the next PR. A clean worktree with a commit in the
last hour is probably owned too: message the sessions first and wait for the answer before merging there (#671/#673:
I started a merge in a clean worktree, and its owner came back mid-merge). Never `git stash` (the stash is shared
across worktrees). Remove the worktrees you created when the pass ends.

Order per PR:

1. **Conflicts** - `git merge origin/main` (merge, do not rebase a pushed branch). Resolve by keeping both sides'
   intent. Watch for **D1 migration number clashes** in each `<product>/apps/api/migrations/` and
   `liveworkspace/apps/*/migrations/`: renumber the PR's migration
   past main's highest and update every reference (blueprints, specs). The same goes for **ledger numbers** (a
   blueprint `DEFAULTS.md` row `D<n>` both sides added): renumber the PR's rows past main's and every `(D<n>)`
   reference in its blueprints.
   - **After every merge, check no file was emptied**: `for f in $(git diff --name-only <pre> HEAD); do [ $(git
show HEAD:$f | wc -c) -lt 5 ] && echo $f; done` (#644 shipped two 0-byte blueprints). In a resolve script,
     read a file into a variable before opening it for writing: `open(p,'w').write(f(open(p).read()))`
     truncates first and writes back empty.
   - **Stage only the conflicted files** (`git add <path>...`), never `git add -A`: PR worktrees belong to other
     sessions and hold their untracked scratch files (a merge commit on #658 swept in two `scratch-*.mjs`).
   - **Stacked PR whose parent was squash-merged** (the branch holds the parent's head: `git merge-base
--is-ancestor origin/<parent> HEAD`): `git merge <squash>^`, then `git merge -s ours <squash>`, then `git
merge origin/main`. Verify `git diff origin/main HEAD` equals `git diff origin/<parent> origin/<child>`.
2. **Red CI** - read the failing job log (`gh run view <id> -R "$REPO" --log-failed`), fix the cause, never skip
   a test.
3. **Comments** - act on unresolved review threads, bot findings and **comments from whoever runs the loop** (theirs are tasks to build, on every PR whatever its labels). Skip an item only when a later commit already covers it;
   say so in the summary.
4. **Gate before pushing**: typecheck + tests of the touched workspaces, `prettier --check` on changed files.
   Follow AGENTS.md (specs first, docs kept current, no em dashes).
5. Commit with the Co-Authored-By trailer and push to the PR branch. The pre-push hook (docs/ci.md "Before a push") runs CI's
   checks for the push; if it fails only on flakes, `push --no-verify` and mention it. It skips itself while
   another push's checks run on the machine.

`not-ready` and `do-not-merge` PRs still get steps 1-5; the labels only block merging.

6. **Watch it through to mergeable.** A push is not the end: arm a Monitor (`timeout_ms: 1800000`) on the pushed
   PRs running `.claude/skills/pr-loop/watch-prs.sh <pr>...`. It polls every ~60s and prints one line per PR the
   moment any check fails (RED, even with others still running), when every check has passed (GREEN), or when it
   goes CONFLICTING/MERGED. Never wait for a whole run before reading a red check. On the event:
   - red check: read the log and fix it (steps 2-5), then re-arm. A smoke/e2e failure unrelated to the diff:
     `gh run rerun <id> -R "$REPO" --failed` once, then re-arm; if it fails again, fix it.
   - conflict: step 1, then re-arm.
   - green and `MERGEABLE`/`CLEAN`: merge it (section 3) if no label blocks it, otherwise report it ready.
   - CodeQL threads close on rescan; if one stays open after a green rescan, check the alert is gone and say so.
     If the Monitor times out with checks still running, re-arm once. Keep going until each PR is mergeable or
     blocked only on a person (a label or a decision).

## 3. Merge

Merge a PR only when all hold: CI fully green, `mergeable: MERGEABLE` / `mergeStateStatus: CLEAN`,
no unresolved threads or unaddressed comments, and no `not-ready` or `do-not-merge` label.
Use `gh pr merge <n> -R "$REPO" --squash` (auto-merge is off on the repo). Merge at most what is ready now; a PR
you just pushed to waits for its CI. Check `gh pr view <n> -R "$REPO" --json state` right before any push or
merge: people merge green PRs mid-loop too.

**Order when several are ready: least conflict first.** Each merge moves main, and every other open PR (ready or
not) then has to absorb it. So before merging:

1. Get each open PR's files: `gh pr diff <n> -R "$REPO" --name-only`. For every ready PR, count the files it
   shares with the other open PRs (all of them, not only the ready ones), weighting hot spots (lockfiles,
   `*/apps/api/migrations/`, shared indexes like `packages/help-registry`, large editor files) higher.
2. Merge first the ready PRs that overlap nothing: they cost no one a conflict.
3. Among overlapping ones, merge the **smaller** diff first, so the bigger branch absorbs a small change rather
   than several small branches each absorbing a big one. Two PRs adding a D1 migration: merge the lower-numbered
   one first and renumber the other at once.
4. After each merge, re-query `mergeable` on the rest before merging the next (a squash can turn the next one
   CONFLICTING). Anything that went CONFLICTING goes back to section 2, step 1, and is watched again (step 6).

Say the order you used, and why, in the report.

## 4. Report

Short summary per PR touched: what was wrong, what you did, the pushed commit, and anything left for a person
(decisions, PRs blocked on a label, CI not running).
