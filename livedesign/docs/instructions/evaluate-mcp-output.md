# Evaluate MCP output

How to measure, and raise, the quality of what an AI assistant makes through the livedesign MCP server
([MCP server](../specs/015-api/mcp-server.md)). A **benchmark** runs real headless Claude sessions with the connector
mounted and nothing else, on several models, several times each, then scores every run mechanically: what the
transcript shows (calls, refusals, retries) and yes/no **checks** on what was made, read back through the tools. A
finding earns a fix only when it recurs; the same benchmark then shows whether the fix worked and broke nothing else.

The kit lives in `apps/mcp/eval/`:

- `bench/tasks/*.mjs`: the task bank, one file per area (`D` diagrams, `P` plan, `S` sheets, `I` pages, `F`
  workshop, `W` draw, `Q` forms). Each task is a prompt as a user would type it, its checks, an optional `after`
  (an edit, run as a second turn of the same session), an optional `setup` (what the prompt takes for granted,
  made in the run's empty library) and an optional `gallery` (pictures from `bench/fixtures/` the user has uploaded,
  seeded into the run's image gallery before the round starts, under the names the prompt's user would have). Ids are stable: rounds compare on the ids they share.
- `apps/mcp/eval/bench/checks.mjs`: the readers checks are written with (boxes, arrows, cards, card types, sheet cells, forms,
  pages, the reply), each answering yes or no, with a reason on a no.
- `apps/mcp/eval/bench/run.mjs`: runs a round. `apps/mcp/eval/bench/score.mjs`: scores one, offline. `apps/mcp/eval/bench/summary.mjs`: the report.
- `mcp-call.mjs`: calls one tool by hand, to replay a call from a transcript.
- `token.env`, `tokens.env` and `runs/` are gitignored.

## Set up

1. Work in a worktree on a branch cut from a fresh `origin/main`, never in the main checkout.
2. Give the worktree's api its local state: copy main's `apps/api/.wrangler/state` and `apps/api/.dev.vars`, then
   `corepack pnpm exec wrangler d1 migrations apply DB --local --persist-to .wrangler/state` from `apps/api`.
3. Start the MCP and the api in ONE wrangler session, so the MCP's service binding reaches this branch's api, from
   `apps/mcp`:
   `nohup corepack pnpm exec wrangler dev -c wrangler.toml -c ../api/wrangler.toml --port 8798 --inspector-port 9398 --persist-to ../api/.wrangler/state > <scratchpad>/mcp.log 2>&1 &`
4. Wait for `Ready on http://localhost:8798` in the log before any run.
5. Check `claude --version` answers and the CLI is signed in: the benchmark runs on the signed-in account's usage.

## Run a round

6. Run from `apps/mcp/eval`: `node bench/run.mjs --round <name> --tasks all --models haiku,sonnet,opus --repeat 2
--concurrency 6`. `--tasks` takes `all`, an area (`forms`) or ids (`Q1,Q4`), mixed. A whole-bank round of 258 runs
   takes about an hour.
7. Each run gets a token minted into local D1 for a throwaway owner, so it starts in an empty library and never sees
   another run's documents ("our Bugs board" finds its own). The tokens are kept in `runs/<round>/tokens.json` so a
   run's library can be read again.
8. Each run is `claude -p` from an empty temp directory outside the repo, with `--strict-mcp-config`, `--tools ""`,
   `--setting-sources ""`, a short chat-app system prompt (with a fixed date) and `ENABLE_TOOL_SEARCH=false`, so the
   assistant sees every tool schema up front, as a connector in a chat app does, and nothing of the repo.
9. A run that stops halfway is resumed by running the same command again: finished runs (with a snapshot) are skipped.
10. Do not edit code under the running server while a round runs: wrangler reloads mid-call and skews the result.
11. Score it: `node bench/score.mjs --round <name> [--compare <earlier round>]` writes `results.json` and
    `summary.md`: each model's pass rate, calls, errors, retries, deprecated calls, time and cost; each task's pass
    rate per model; the checks failing in two or more runs; the tool errors in two or more runs; deprecated tools
    called; and, with `--compare`, what moved.

## Write a task

12. A new task's prompt is what a user would type, never a hint at the tools.
13. Each check states one requirement the prompt makes, as a yes or no on what was made (the snapshot), or on what was
    said (the reply). Never score taste: a check that needs an opinion is not a check.
14. Ground new checks in a real run: run the task once (`--tasks <id> --models sonnet --repeat 1`), read its
    `.snapshot.json`, then write the checks against the shapes it holds.
15. When a check fails, read the run before believing it: in the first pilot 7 of 7 failures were the check's own bug
    (a field name, a page line it could not parse, a miscount in the prompt's own arithmetic).
16. Cross-test the bank after changing checks: run each task's checks on every other task's snapshot. A check that
    passes on unrelated output (or on none) is vacuous: make it require the thing it is about.
17. A task that needs something to exist first (a board to fill, a document to edit) makes it in `setup`, and answers
    the ids of what it made so the snapshot reads them too.

## Act on the findings

18. Start from the two recurring tables. A tool error in two or more runs is a finding; one run is noise until it
    happens again.
19. Read the run's transcript (`runs/<round>/<task>-<model>-<n>.jsonl`) around the error, and replay the call with
    `mcp-call.mjs` before changing anything.
20. Sort each finding into one of four:
    - a misleading or missing tool description (an undocumented field, a default nobody could guess): fix the
      description, as facts, never as a recipe for one task;
    - a schema that invites the mistake (a name agents keep guessing, two ways to say one thing): fix the schema;
    - an error that does not say how to recover: make it name the fix (what is valid, which tool does it);
    - a product bug or a missing capability: fix it in the shared package, with a test, or name it in the PR.
21. A weaker model shows a description gap first: a Haiku-only failure is still a finding.
22. Write the spec delta before the code, as for any change; specs name what the MCP now does.
23. Commit and push each batch of fixes as it turns green; run the full gate only before the PR.
24. Restart the server after every change a round should see: kill the wrangler PID
    (`pgrep -f "wrangler dev -c wrangler.toml"`) and relaunch step 3.
25. Rerun the tasks the fix touched, then the whole bank, and compare with `--compare`: keep a fix only when its
    numbers improve and no other task drops.

## Look at the pictures

26. Checks judge content and structure, not looks. For layout and polish, open the renders: a run's `read_document`
    with `image: true` in its transcript, or render a snapshot's tab again with `mcp-call.mjs`.
27. When judging looks, a subagent may stand in for the user with `brief.md`; record what it saw as defects with
    element ids, never as a score, and change the product only where two runs agree.

## Ship

28. Render the PR images through the tools, so they show what an assistant now gets: for a before and after pair,
    replay the first round's call (its args are in the transcript) on the branch's server as the after.
29. Push the images to an orphan `pr-assets/<PR number>` branch (`git hash-object -w`, `git mktree`,
    `git commit-tree`, push with `--no-verify`) and link the raw URLs pinned to that commit. Do not fetch a raw URL
    before the push lands: GitHub caches the 404 for a few minutes.
30. Put the round's model table and the `--compare` table in the PR, and in its Notes what still fails and why.
31. Fold what this round taught back into this file: a new gotcha, a step that was missed, a task worth keeping.

## Gotchas

- A run started inside the repo loads the project's auto-memory and CLAUDE.md into the assistant under test (the
  init line's `memory_paths` names it). Runs start in a temp directory outside the repo for that reason; keep it so.
- `--bare` would strip that context too, but it needs an API key and never reads the CLI's sign-in: use the flags in
  step 8 instead.
- A tool result can carry its JSON and then a lint as separate text parts; read the first part that parses, not the
  joined text (`resultJson` in `apps/mcp/eval/bench/mcp-client.mjs`).
- `read_document` with `format: "json"` puts the elements under `tab.elements`, not at the top.
- A token minted into an earlier session's D1 copy is refused after copying main's state again ("the token is not
  accepted"); `run.mjs` mints its own into the copy each round.
- A check written from one model's output can quietly fit that model: the cross-test (step 16) and a second model's
  runs are what show a check is about the prompt.
- The per-token limits count api requests (reads 120 a minute), and every run has its own token, so runs do not
  share a limit; a run that still hits one has made a tool read too much. Count the requests one call makes before
  blaming the assistant's pace.
- Links point at livedesign.app when the local server has no public host set; a check on a link compares its code,
  never its host.
- A form's response lands through `try_form`: a check reads the "Preview: ..." card with `list_items` (or the row
  with `read_sheet`) to see each answer where `read_form`'s `goesTo` and `column` say it goes. On a published form a
  preview counts as a response, so a check on the response count allows for it. Judge a try from its own result
  (`call.result`: `made`, `where`, `title`), never from the final snapshot: models check the card, then delete it as
  the tool suggests, so a snapshot check fails a run that did everything right (Q6 and Q7, 2026-10-16).
- A lint finding that names a template's own design (its colours, its shape) invites the agent to undo it. Check
  `templates.test.ts` stays clean after a lint change, and lint a fresh template of each kind the round touched.
- Measure a new layout pass at 2,000 boxes and 2,000 arrows before the PR: a per-arrow scan of the tab looked free on
  a fourteen-box diagram and took 1.8 s there.
- When a fix moves where a row's members sit (stores under services), replay every past input of that shape from the
  rounds' transcripts and compare box geometry before and after: only the inputs the fix was for should move.
- The gallery seeding runs wrangler commands that block Node's event loop; seeded while runs were talking to the
  server, it made their requests time out ("fetch failed"). `run.mjs` seeds every gallery before the first run starts.
- The local dev server now and then drops a request ("Error: Network connection lost"); the bench client retries a
  request twice before the error stands. One such drop in a transcript is the server, not the tools.
- To measure a change before and after, run the before half on a detached worktree of the last commit started on the
  same `--persist-to` state, then the after half on the branch: a wrangler session reloads edits under it, so the
  branch's own server is never the "before".
- Timing tests fail under load while a round and the coverage gate share the machine; rerun them alone before
  treating them as real.
