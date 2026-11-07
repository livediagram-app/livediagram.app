---
name: pr-loop
description: One pass over your open PRs and Dependabot's on the liveworkspace monorepo (every product) - fix red CI, act on comments, resolve conflicts, merge what is ready. Run with `/loop /pr-loop` in a session of its own: a watcher wakes it the minute a PR changes.
---

# PR loop: one pass

Work from the repo root (`git rev-parse --show-toplevel`). Every product is in this one repo; read its AGENTS.md
and docs/ci.md. Use `corepack pnpm` and `gh`. Find the repo once per pass, `REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)`, and pass
`-R "$REPO"` to every `gh` call, so the loop keeps working when the repo moves or is renamed.

This loop runs unattended. Act on these rules and never stop to ask (AskUserQuestion): a question nobody answers
stalls every later pass. Write judgement calls and open decisions into the report instead.

**Give the loop a session of its own** and take no other work in it (deploy watching, side tasks, chat). Every
turn of the loop carries the whole session's context, so other work there makes every pass and every wake-up cost
more (2026-11: other work was 25 to 42% of the loop sessions' tokens, at ~240k tokens a turn). For the same
reason the loop orchestrates and helper agents do the fixing (section 2).

## 1. Collect

1. `git fetch -q origin`.
2. `.claude/skills/pr-loop/prs.py digest`: one GraphQL call, one line per open PR of yours or Dependabot's, PRs
   needing work first. Each line starts with what the PR needs:
   - `CONFLICT`, `RED` (failing checks named), `COMMENTS` (unresolved threads, or comments and reviews newer than
     the head commit): work it (section 2).
   - `MERGE` (green, `CLEAN`, no blocking label): merge it (section 3).
   - `CHECK`: green but GitHub won't call it `CLEAN`; look at why (`gh pr view <n> --json mergeStateStatus`).
   - `WAIT-CI` (checks running) or `WAIT-PERSON` (green behind `not-ready`/`do-not-merge`): nothing to do.
     `UNKNOWN` mergeability counts as WAIT-CI; GitHub works it out by the next pass.

   A line ending `new` differs from the last digest. Report a `WAIT-PERSON` or `WAIT-CI` PR only when its line is
   `new`: one that waits on a person was already reported, and repeating it every pass is noise.

If every line is `WAIT-*` without `new`, stop: a one-line "nothing to do" reply, then section 5.

**Red with no log is not a code failure.** If a run's jobs have no steps and no runner (`gh api
repos/$REPO/actions/runs/<id>/jobs --jq '.jobs[]|"\(.name) \(.steps|length)"'` shows 0 steps), Actions didn't
start it: usually spent minutes or a billing hold. Don't push fixes or reruns for it. Say once in the report that
CI isn't running, and carry on with conflicts and comments.

## Velocity first: CI is the bottleneck

Every push to a PR restarts its full CI run, and runs queue behind each other. Merging main into ~10 PRs at once
once clogged CI so badly that nothing merged and the open count rose from 12 to 19, and minutes are finite (27 PRs
used up the org's Actions minutes). So:

- **Merge before you fix.** Each pass, first merge every `MERGE` PR (section 3). Main does not require branches to
  be up to date: `CLEAN` is enough. Do not hold a ready PR back for a nicer order.
- **Never merge main into a PR pre-emptively.** Only push to a branch that is `CONFLICTING` or red for a reason
  you must fix. "Behind main" is not a reason.
- **Work from the front of the queue.** When more PRs need work than there are helper slots (section 2), start
  with the ones closest to merging (fewest pending checks, smallest fix). A PR far down the list will need another
  update by the time it reaches the front.
- **Never push to a PR whose CI is mid-run** unless a check on it has already failed.
- **A red caused by a test since fixed on main**: merge main into that one PR when you get to it, not into every
  PR that shows the same red.
- **Batch fixes into one push per PR per pass.** Gate everything locally first, then push once.

## 2. Work each PR that needs it: helper agents, up to 3 at once

The loop doesn't fix PRs in its own context. For each `CONFLICT`, `RED` or `COMMENTS` PR, start a helper with the
Agent tool (`run_in_background: true`), at most 3 running at once; a PR beyond that waits for a free slot, front
of the queue first. Never start a second helper on a PR that already has one. Each helper's report wakes the loop:
read it, report it, and start the next one.

**Ownership first (the loop checks, before starting a helper).** A PR whose branch has a worktree (`git worktree
list`) with uncommitted edits (`git status --porcelain --untracked-files=no`) is being worked by another session
right now: leave it to that session (message it via ListAgents/SendMessage) and move on. A clean worktree with a
commit in the last hour is probably owned too: message the sessions and wait for the answer before working it
(#671/#673: a merge started in a clean worktree, and its owner came back mid-merge).

**The helper's brief** names the PR, its digest line and the job (conflict, red check, comments), and tells it:

- Read this skill's steps 1-5 below and follow them; do not merge (the loop merges, in order).
- Work in a fresh worktree of the PR branch in its scratchpad (link the repo's `node_modules` into it so the
  pre-push hook runs), and remove it when done. Never `git stash` (the stash is shared across worktrees).
- Never kill dev servers or other processes it did not start (no `pkill`), and leave other sessions' worktrees
  alone.
- Report back: what was wrong, what it changed, the pushed commit, and anything left for a person.

Steps for the helper, per PR:

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
   a test. A smoke/e2e failure unrelated to the diff: `gh run rerun <id> -R "$REPO" --failed` once; if it fails
   again, fix it.
3. **Comments** - act on unresolved review threads, bot findings and **comments from whoever runs the loop** (theirs are tasks to build, on every PR whatever its labels). Skip an item only when a later commit already covers it;
   say so in the summary. CodeQL threads close on rescan; if one stays open after a green rescan, check the alert
   is gone and say so.
4. **Gate before pushing**: typecheck + tests of the touched workspaces, `prettier --check` on changed files.
   Follow AGENTS.md (specs first, docs kept current, no em dashes).
5. Commit with the Co-Authored-By trailer and push to the PR branch, after checking
   `gh pr view <n> -R "$REPO" --json state` is `OPEN` (people merge PRs mid-loop). The pre-push hook (docs/ci.md
   "Before a push") runs CI's checks for the push; if it fails only on flakes, `push --no-verify` and mention it.
   It skips itself while another push's checks run on the machine.

`not-ready` and `do-not-merge` PRs still get steps 1-5; the labels only block merging. Never remove a
`not-ready` label from a PR whose description has an unticked **Before merging** Owner step: only the owner
clears those.

6. **Watch it through to mergeable: one watcher for every PR (the loop, not a helper).** At the end of every pass
   and after handling its lines, make sure the watcher runs: if `.claude/skills/pr-loop/prs.py running` exits 1,
   start `.claude/skills/pr-loop/prs.py watch` as a **background Bash command** (`run_in_background`), never a
   Monitor and never one per PR. It watches every open PR of yours and Dependabot's, including ones other sessions open later,
   with one `gh` call a minute. It exits at the first change worth acting on, printing one line per PR that went
   RED (a check failed, even with others still running), GREEN (every check passed), CONFLICTING, or COMMENTED (a
   new comment or review). That exit is what wakes the loop, so a red check or a new comment gets picked up within
   about a minute, and the loop is not woken while CI just runs (Monitors expire every 30 minutes and woke the
   loop each time; one per push piled up). It saves what it saw under `.git`, so a PR that changes while the
   loop is busy is reported by the next watcher. Only one runs per clone; it exits after 4 hours with `TIMEOUT`
   (start it again). On its lines: RED, CONFLICTING or COMMENTED starts a helper (above); GREEN with
   `MERGEABLE`/`CLEAN` is merged (section 3) unless a label blocks it. Keep going until each PR is mergeable or
   blocked only on a person (a label or a decision).

## 3. Merge (the loop, never a helper)

Merge a PR only when all hold: CI fully green, `mergeable: MERGEABLE` / `mergeStateStatus: CLEAN`,
no unresolved threads or unaddressed comments, and no `not-ready` or `do-not-merge` label: a `MERGE` line in the
digest. Use `gh pr merge <n> -R "$REPO" --squash` (auto-merge is off on the repo). Merge at most what is ready
now; a PR just pushed to waits for its CI. Check `gh pr view <n> -R "$REPO" --json state` right before merging:
people merge green PRs mid-loop too.

**Order when two or more are ready at once: least conflict first.** Each merge moves main, and every other open
PR (ready or not) then has to absorb it. So before merging:

1. Get each open PR's files: `gh pr diff <n> -R "$REPO" --name-only`. For every ready PR, count the files it
   shares with the other open PRs (all of them, not only the ready ones), weighting hot spots (lockfiles,
   `*/apps/api/migrations/`, shared indexes like `packages/help-registry`, large editor files) higher.
2. Merge first the ready PRs that overlap nothing: they cost no one a conflict.
3. Among overlapping ones, merge the **smaller** diff first, so the bigger branch absorbs a small change rather
   than several small branches each absorbing a big one. Two PRs adding a D1 migration: merge the lower-numbered
   one first and renumber the other at once.
4. After each merge, re-run the digest before merging the next (a squash can turn the next one `CONFLICT`).

Say the order you used, and why, in the report.

## 4. Report

Short summary per PR touched: what was wrong, what you or a helper did, the pushed commit, and anything left for a
person (decisions, PRs blocked on a label, CI not running). PRs that only wait are reported once (section 1).

## 5. Pace the next pass

Run without an interval (`/loop /pr-loop`). The watcher (section 2, step 6) wakes the loop the minute a PR goes
red, green, conflicting or gets a comment, and helpers wake it when they finish, so the timed pass is only a
fallback that restarts a watcher that died: end every pass with ScheduleWakeup at **60 minutes**, passing the same
prompt (`/pr-loop`) and a `reason` naming the count, e.g. "7 open PRs, 2 mid-run, watcher running". Started with a
fixed interval (`/loop 30m /pr-loop`), keep that interval and skip this section.
