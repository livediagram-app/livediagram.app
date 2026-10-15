# Evaluate MCP output

How to measure, and raise, the quality of what an AI assistant makes through the livediagram MCP server
([MCP server](../specs/015-api/mcp-server.md)). Subagents stand in for Claude with the connector installed, build what
a user asked for through the tools alone, look at the server's own preview, and score it against template quality.
Each finding becomes a fix in the product, the tools or their descriptions, and the round runs again.

The kit lives in `apps/mcp/eval/`: `mcp-call.mjs` (the JSON-RPC helper), `brief.md` (the rules every evaluator
follows) and `scenarios.md` (the scenario bank, ids stable across runs). `token.env` and `runs/` are gitignored.

## Set up

1. Work in a worktree on a branch cut from a fresh `origin/main`, never in the main checkout.
2. Give the worktree's api its local state: copy main's `apps/api/.wrangler/state` and `apps/api/.dev.vars`, then
   `corepack pnpm exec wrangler d1 migrations apply DB --local --persist-to .wrangler/state` from `apps/api`.
3. Start the MCP and the api in ONE wrangler session, so the MCP's service binding reaches this branch's api, from
   `apps/mcp`:
   `nohup corepack pnpm exec wrangler dev -c wrangler.toml -c ../api/wrangler.toml --port 8798 --inspector-port 9398 --persist-to ../api/.wrangler/state > <scratchpad>/mcp.log 2>&1 &`
4. Wait for `Ready on http://localhost:8798` in the log before any call.
5. Make an API token: sign in to the local editor, open **Settings**, **Account**, **API Tokens**, create one with
   write access, and save it as `TOKEN=lvd_…` in `apps/mcp/eval/token.env`. Evaluation documents land in that account's library.
6. Check the helper reaches the server: `node apps/mcp/eval/mcp-call.mjs tools` prints one line per tool.

## Run a round

7. Pick the scenarios for the mode under work from `scenarios.md`. A mode with none gets new ids (`D`, `P`, `S`, `I`,
   `F`, `W` so far): one easy, one or two medium, one hard, and one edit of an earlier result. Each prompt is what a
   user would type, never a hint at the tools.
8. Give each evaluator two to four scenarios, so a round of a dozen runs as four agents in parallel. An edit
   scenario goes to the agent that built the document it edits.
9. Launch each as a background `general-purpose` subagent with this prompt, a fresh `runs/<round>-<letter>` per agent:

   > Read the brief at `<kit>/brief.md` and follow it exactly, except: return your report as your final message (do
   > not try to write the report file). EVAL=`<kit>`. Use EVAL_LOG=$EVAL/runs/`<run>`/calls.jsonl
   > EVAL_IMG_DIR=$EVAL/runs/`<run>`/shots. Write any scratch files only inside $EVAL/runs/`<run>`/. If the server at 127.0.0.1:8798 refuses connections, wait a minute and
   > retry; say so in the report. Fulfil scenarios `<ids>` from $EVAL/scenarios.md, each as its own new document,
   > as the user typed it. Score each result 1-5 against template quality, as the brief describes, and list
   > concrete defects with the element ids and what you saw in the preview.

10. When a known fix sits on another unmerged branch (a preview font, an emoji glyph), add to the prompt that the
    agent notes those defects separately and gives a second score as if they were fixed. The first score stays the
    one recorded.
11. Do not edit code under the running server while a round runs: wrangler reloads mid-call and skews the result.
    Draft docs or tests elsewhere in the meantime.
12. Record every score in the plan's scores table as reports arrive, one column per round.

## Act on the findings

13. Open the final images yourself; a score without a look at the picture is not trusted.
14. Sort each defect into one of four:
    - a product bug (the face, the render, the engine): fix it in the shared package, with a test;
    - a gap in what the tools say (an undocumented field, a default nobody could guess): fix the tool description or
      the element format, as facts, never as a recipe for one scenario;
    - a missing starting point that every agent rebuilds by hand (a board kind no template covers): add a template;
    - the agent's own choice (a label it made too long): leave it, unless every run repeats it.
15. Write the spec delta before the code, as for any change; specs name what the MCP now does.
16. A lint finding agents call noise is a finding: either the lint is wrong, or the template that trips it is.
17. Commit and push each batch of fixes as it turns green; run the full gate only before the PR.
18. Restart the server after every change that a round should see: kill the wrangler PID
    (`pgrep -f "wrangler dev -c wrangler.toml"`) and relaunch step 3. Wrangler does not reliably reload config,
    templates or package changes on its own.
19. Run the next round with the same prompts and new run folders. The phase is done when every scenario scores 4 or
    more on two runs, or what holds one back is named in the PR as a product feature still to build.

## Ship

20. Render the PR images through the tools, so they show what an assistant now gets: `read_document` with
    `image:true`, or `create_document` from a template.
21. Push the images to an orphan `pr-assets/<PR number>` branch (`git hash-object -w`, `git mktree`,
    `git commit-tree`, push with `--no-verify`) and link the raw URLs pinned to that commit. Do not fetch a raw URL
    before the push lands: GitHub caches the 404 for a few minutes.
22. In the PR's Notes, list what still holds a scenario below 4 and why.
23. Fold what this round taught back into this file: a new gotcha, a step that was missed, a scenario worth keeping.

## Gotchas

- A token saved in an earlier session's scratchpad belongs to that session's D1 copy: after copying main's state, the
  api refuses it ("the token is not accepted"). Mint one into the copy instead: insert an `api_tokens` row (id,
  `owner_id` of the account that holds the other local tokens, `token_hash` the sha256 hex of `lvd_<base64url of 32
random bytes>`, `created_at` and `expires_at` in ms, `read_only` 0) with `wrangler d1 execute DB --local
--persist-to .wrangler/state`, and save the plain token in `token.env`.
- Scores swing a point between runs of one scenario, mostly on whether the evaluator hand-fixes the first render
  (re-anchoring, a replace) or keeps it. Judge a fix by the pictures and by measures on the evaluator's own input
  (the graph is in `calls.jsonl`), not by one score; re-lay out that input against the old and new code to compare.

- Subagents cannot write files in this harness; they return the report as their final message.
- Evaluators running side by side share a scratchpad: one picked up another session's stale `d14.json` and created
  the wrong document. Keep each evaluator's scratch files in its own run folder (the prompt above says so).
- Two evaluators can disagree on taste (stage frames stretched to one width were "empty"; left their own width,
  "ragged"). Change the product only where two runs agree, or the scores swing between the two.
- Grade the scenarios a round of fixes touched, then run all fourteen now and then: a layout fix for one scenario
  shifts others (R7 caught D9 dropping from 4 to 3).
- The preview is the server's own render (`renderElementsToSvg` through resvg), not the editor. A defect only the
  preview shows is still a defect: it is what the assistant sees and what it judges its work by.
- A template's sample people and numbers read as real to an evaluator; an agent leaves them in unless told what is
  sample content.
- Timing tests fail under load while a round and the coverage gate share the machine; rerun them alone before
  treating them as real.
