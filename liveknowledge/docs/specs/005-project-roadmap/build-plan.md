# Build plan

Status: **in progress**, local only (branch `liveknowledge/v1`). Nothing is pushed or deployed until the owner says.

liveknowledge is built as livedocuments, livedesign and livehuddle were: forked in-tree, renamed, cut down, then made
its own. Specs first at every step.

| #   | Step                                                                                                    | State   |
| --- | ------------------------------------------------------------------------------------------------------- | ------- |
| 1   | Fork `livedocuments/` at main `16e160edf2` into `liveknowledge/`, renamed, on the 36xx ports            | done    |
| 2   | Platform registration ([Platform registration](../016-platform/platform-registration.md))               | started |
| 3   | Cut down to the article engine ([Not in liveknowledge](../002-project-scope/not-in-liveknowledge.md))   |         |
| 4   | The wiki noun and the continuous page ([Wikis and pages](../030-wiki/wikis-and-pages.md))               |         |
| 5   | The page tree                                                                                           |         |
| 6   | Page links, backlinks, embeds ([Links and embeds](../030-wiki/links-and-embeds.md))                     |         |
| 7   | Verification ([Verification](../030-wiki/verification.md))                                              |         |
| 8   | Search ([Search and Ask](../030-wiki/search-and-ask.md))                                                |         |
| 9   | Ask, on the team's own key                                                                              |         |
| 10  | AI Knowledge ([AI Knowledge](../030-wiki/ai-knowledge.md))                                              |         |
| 11  | Wiki Home ([Wiki Home](../030-wiki/wiki-home.md))                                                       |         |
| 12  | Wiki import ([Wiki import](../020-import-export/wiki-import.md))                                        |         |
| 13  | The MCP server and CLI in pages ([Wiki for agents](../024-agents/wiki-for-agents.md))                   |         |
| 14  | Brand, the marketing site and help                                                                      |         |
| 15  | Measure, bound and test: share-role tests, E2E smoke, typing and indexing budgets                       |         |
| 16  | Fold the specs back to the code; list the owner-only steps                                              |         |

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
