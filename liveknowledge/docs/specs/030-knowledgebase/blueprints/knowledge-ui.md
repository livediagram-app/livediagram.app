# Knowledge UI blueprint

Derived from [Links and embeds](../links-and-embeds.md), [Verification](../verification.md) and
[Search and Ask](../search-and-ask.md) "Search": what the editor shows of a page's knowledge, over the routes the
[knowledge package blueprint](knowledge-package.md) wires. Each section says what is built; "Not built" at the foot
is the work left. **Nothing here is verified in a browser.**

## The client (built)

`apps/editor/lib/api/knowledge.ts` and `knowledge-ask.ts`, exported through the `lib/api-client.ts` barrel. Every
call goes through the editor's request funnel (`apiFetch`, `apiHeaders`, `expectOk` of `lib/api/core.ts`): identity,
the share code, the index's grant, the release signal and the failure report are the funnel's. The caller is
`KnowledgeCaller` (`{ ownerId, shareCode }`).

| Function                                                                              | Route                                                                     | Answers                                                  |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| `apiSearchKnowledge(who, id, query, signal?)`                                         | `GET search?q=`                                                           | `KnowledgeSearchResult[]`                                |
| `apiKnowledgeSummary(who, id, signal?)`                                               | `GET summary`                                                             | `KnowledgeSummaryResponse`                               |
| `apiPageBacklinks(who, id, tab, signal?)`                                             | `GET pages/<tab>/backlinks`                                               | `KnowledgeBacklink[]`                                    |
| `apiPageHealth(who, id, tab, signal?)`                                                | `GET pages/<tab>/health`                                                  | `PageHealthResponse`                                     |
| `apiVerifyPage(who, id, tab)`                                                         | `POST pages/<tab>/verify`                                                 | `PageKnowledge`                                          |
| `apiSetPageKnowledge(who, id, tab, patch)`                                            | `PUT pages/<tab>/knowledge`                                               | `PageKnowledge`; throws `ContextBudgetError`             |
| `apiKnowledgeAi`, `apiSetKnowledgeAiKey`, `apiRemoveKnowledgeAiKey`, `...AiModel`     | `GET ai`, `PUT`/`DELETE ai/key`...                                        | `KnowledgeAiSettings`                                    |
| `apiAskKnowledge(who, id, request, { onDelta, signal })`                              | `POST ask`                                                                | the `done` event, or an `error` event; never a rejection |
| `apiKnowledgeOverview(who, id, signal?)`                                              | `GET knowledge`                                                           | `KnowledgeOverviewResponse`                              |
| `apiReportKnowledgeGap`, `apiDismissKnowledgeQuestion`, `apiDismissKnowledgeConflict` | `POST questions`, `DELETE questions/<key>`, `POST conflicts/<id>/dismiss` | the key; nothing                                         |

- **Refusals** are an `ApiError` with the route's `code` (`query_too_long`, `rate_limited`, `owner_no_access`,
  `tab_busy`, `forbidden`, `ask_unavailable`, ...). The ones the interface words itself are not reported as faults
  (`EXPECTED`). `context_budget` (409) is a `ContextBudgetError` carrying `tokens`, `used` and `budget`, read off a
  copy of the response because the shared error keeps only the code.
- **Timeouts:** every read and write carries `knowledgeSignal(signal?)`: `KNOWLEDGE_TIMEOUT_MS` (15,000), joined to
  the caller's signal with `AbortSignal.any`, so a search's abort and the bound are one signal. Ask carries the
  caller's signal alone: an answer streams for as long as the model writes.
- **The Ask stream:** `readAskEvents(body)` reads server-sent events by `data:` lines (several lines an event, CRLF
  or LF, comments and other fields ignored, a character cut across two chunks decoded whole) and yields only values
  that are an `AskEvent`. `apiAskKnowledge` hands each `delta` to `onDelta` and answers the `done` or `error` event.
  A refusal before the stream (JSON with `error` and `message`) becomes an `error` event in the server's words; no
  network is kind `network`; a stream that ends with neither is `ASK_CUT_SHORT`. It rejects only when aborted.
- **Tests:** `lib/api/knowledge.test.ts`, 19 tests over a fake `fetch`.

## Not built

The Ask tab, the AI Knowledge tab, Settings > AI and Home (another change's), over the client above.

## Where this differs from the specs

- **The spec files were not edited with this work**: each held another change's uncommitted edits while it was
  written, and a commit of the file would have taken those with it. What differs is recorded here until they can be.
