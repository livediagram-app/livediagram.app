# Build plan

Status: **in progress**, local only (branch `liveknowledge/v1`). Nothing is pushed or deployed until the owner says.

liveknowledge is built as livedocuments, livedesign and livehuddle were: forked in-tree, renamed, cut down, then made
its own. Specs first at every step.

| #   | Step                                                                                                                          | State           |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1   | Fork `livedocuments/` at main `16e160edf2` into `liveknowledge/`, renamed, on the 36xx ports                                  | done            |
| 2   | Platform registration ([Platform registration](../016-platform/platform-registration.md))                                     | done, see below |
| 3   | Cut down to the article engine ([Not in liveknowledge](../002-project-scope/not-in-liveknowledge.md))                         | started         |
| 4   | The knowledgebase noun and the continuous page ([Knowledgebases and pages](../030-knowledgebase/knowledgebases-and-pages.md)) | started         |
| 5   | The page tree                                                                                                                 | started         |
| 6   | Page links, backlinks, embeds ([Links and embeds](../030-knowledgebase/links-and-embeds.md))                                  |                 |
| 7   | Verification ([Verification](../030-knowledgebase/verification.md))                                                           |                 |
| 8   | Search ([Search and Ask](../030-knowledgebase/search-and-ask.md))                                                             |                 |
| 9   | Ask, on built-in AI or the team's own key                                                                                     |                 |
| 10  | AI Knowledge ([AI Knowledge](../030-knowledgebase/ai-knowledge.md))                                                           |                 |
| 11  | Knowledgebase Home ([Knowledgebase Home](../030-knowledgebase/knowledgebase-home.md))                                         |                 |
| 12  | Knowledgebase import ([Knowledgebase import](../020-import-export/knowledgebase-import.md))                                   | built           |
| 13  | The MCP server and CLI in pages ([Knowledgebase for agents](../024-agents/knowledgebase-for-agents.md))                       |                 |
| 14  | Brand, the marketing site and help                                                                                            |                 |
| 15  | Measure, bound and test: share-role tests, E2E smoke, typing and indexing budgets                                             |                 |
| 16  | Fold the specs back to the code; list the owner-only steps                                                                    |                 |

## Where steps 2 and 3 stand

- **Step 2** registered liveknowledge in every platform list. Left for later steps: the help centre has only the
  smallest registration (livedocuments' articles with the name swapped; a full edition comes with step 14), and the CI
  group is held (`held: true` in `.github/scripts/ci-plan.mjs`) until the owner's steps are done, so nothing deploys.
  It needed two D1 migrations on the platform's own databases, because their CHECK constraints name the apps:
  accounts `0024_liveknowledge.sql` and the index's `0026_items_liveknowledge.sql`. Neither has been applied anywhere;
  the index one must be rehearsed on a production export by the owner first.
- **Step 3** deleted flashcards and the animated GIF export. Slides and infographics proved too entangled with the Word
  export and the document model to delete quickly, so step 4 makes them unreachable (no way to make or present one)
  and their dead code is deleted afterwards ([Not in liveknowledge](../002-project-scope/not-in-liveknowledge.md)
  "Unreachable, to delete").

Step 3 changed shape: slides and infographics proved too entangled with the article engine to delete in one step, so
they were made unreachable first and their code is deleted later
([Not in liveknowledge](../002-project-scope/not-in-liveknowledge.md) "Unreachable, to delete").

## Rules for every step

- Each step removes or adds its code, tests, help articles and specs together, so the specs never describe what the
  product does not have.
- Every step leaves `corepack pnpm --filter "@liveknowledge/*" typecheck` and the touched suites green.
- Code two products need moves to `packages/` instead of being copied again (root AGENTS.md).
- Performance is measured where a cheap measure exists and bounded in the same step (the specs' "Bounds" lines).

## Owner only, before anything deploys

Registering `liveknowledge.app` and its zone, the accounts client, the telemetry, drive, community and data-export
keys, the MCP's KV namespaces, the `AI_KEY_SECRET` secret, and Google's Drive MIME type. The full list is in
[Platform registration](../016-platform/platform-registration.md).
