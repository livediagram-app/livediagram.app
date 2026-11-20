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

## Verification (built)

Derived from [Verification](../verification.md). Modules: `apps/editor/lib/knowledge/` (pure and the store) and
`apps/editor/components/knowledge/`.

| Piece                                              | File                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| a page's state from its fields and the clock       | `lib/knowledge/page-trust.ts` (`pageTrust`, `trustMarks`)        |
| Page Health and the fields just set, outside React | `lib/knowledge/page-knowledge-store.ts` (`pageKnowledgeStore`)   |
| who may verify and set the fields                  | `lib/knowledge/knowledge-rights.ts` (`knowledgeRights`)          |
| a refusal in words                                 | `lib/knowledge/knowledge-words.ts` (`knowledgeFailureText`)      |
| the headings of the writing                        | `lib/knowledge/page-headings.ts` (`pageHeadings`)                |
| room in the writing for the meta row and the foot  | `lib/knowledge/page-slots-plugin.ts` (`createPageSlots`)         |
| the store's slices, the people, the actions        | `components/knowledge/usePageKnowledge.ts`                       |
| tick and pill                                      | `components/knowledge/TrustBadge.tsx`                            |
| the meta row                                       | `components/knowledge/PageMetaRow.tsx`, `PageKnowledgeSlots.tsx` |
| the right rail                                     | `PageRail.tsx`, `usePageRailChrome.tsx`, `OnThisPage.tsx`        |
| Page Health                                        | `components/knowledge/PageHealthCard.tsx`                        |

- **Every page's fields ride the tab summaries.** `readDocumentOutline` reads `json_extract(t.data, '$.knowledge')`
  beside each summary, `rowToTabSummary` answers it through `parseKnowledgeFields` as `TabSummary.knowledge` (absent
  for a page with none, and outside a tab-scoped visitor's scope), and `placeholdersFromSummaries` carries it onto
  the placeholder tab. The room's `tab-meta` patch after a Verify or a field change lands on the tab whether its
  body is loaded or not. **So the page tree's ticks come from the tab list: one pass a change, no request a row.**
- **States** are `trustState` over `parseKnowledgeFields(tab.knowledge)` and the editor's shared 30 second clock
  (`useRelativeNow`): a review that comes due shows within 30 seconds, with nothing written.
- **The meta row** is drawn inside the writing, under the Title block: `createPageSlots()` makes two host elements
  per article (`meta`, `foot`) and a ProseMirror plugin that places each as a widget decoration (constant work a
  transaction: the first block's size and the document's); `ArticleEditor` hands the plugin to `mountArticleView`
  (`extraPlugins`) and `PageKnowledgeSlots` portals `PageMetaRow` into the host. The row is 28 px tall at least
  whatever it holds, so the writing does not move when Page Health arrives. It holds: the tick with "Verified by
  <name>" or the amber Review Due pill (nothing for Never Verified), "Review due <date>" ("Review was due" once
  passed), "Changed since verified" (from Page Health), and for whoever may verify a button: "Verify", or "Verify
  Again" once verified.
- **Verify** (`pageKnowledgeStore.verify`) is optimistic: the fields `verified(fields, person, now)` would give show
  at once in the meta row, the rail and the tree; the server's answer replaces them; a refusal puts back what was
  held and raises a toast in words. The same for owner, interval and Always in Context (`setFields`). What was set
  here shows until the tab's own `knowledge` changes (the room's patch, or a peer's later change).
- **Page Health** is read (`GET pages/<tab>/health`) once per page for the session, when the page opens; concurrent
  asks share one request. A failed read leaves the fields showing from the tab and the reads as a dash.
- **The right rail** is 280 px (`PAGE_RAIL_WIDTH`), docked down the canvas's right from the toolbar's row on a
  window at least 1,280 px wide (`PAGE_RAIL_MIN_WINDOW`): the right corner stacks and the bottom-right cluster stand
  clear of it (`CanvasChrome`), and the page framing centres the page between the tree and the rail
  (`sideChromeInsets` reads `[data-page-rail="docked"]`). Below that a **Page Info** button under the toolbar's
  row opens the same two sections: a card on a desktop (Escape closes it), the shared `BottomSheet` on a phone.
  Hidden in zen mode, behind the welcome flow and in an embed.
- **On This Page** lists Heading 1 to 3 from the committed blocks (`pageHeadings`, kept per block list). The current
  heading is the last one at or above a line 160 px down the window, found from the headings' boxes when the view
  moves or the headings change, one pass a frame at most. A press brings the heading into view
  (`ArticleEditorHandle.rangeRect`, `scrollIntoView`).
- **The page tree** shows the tick, or a short amber "Due" pill named "Review Due", at the row's right, and the
  state is part of the row's accessible name ("Release Process, Review Due"). The row menu gains **Verify** and
  **Always in Context** (a checkmark row) after Copy Link. Over budget, the toast says the route's reason from its
  sizes: "This page is 3,000 tokens and 6,000 of 8,000 are in use. Take another page out of Always in Context
  first."
- **Names.** `owner` and `verifiedBy` are account ids. The editor can name the person here and the people of the
  team whose library holds the knowledgebase (the comment mentions' list). Anyone else shows as "Verified" with no
  name, and as "Someone Else" in the owner picker, which offers those same people and No Owner.
- **Reads** need no call of the editor's: opening a page is `GET tabs/<tab>` (`apiLoadTabRevisioned`, from
  `seed-fetched-document.ts` for the first page and `usePerTabLoad` for the rest), which the api counts once a
  person a page a day.

### Share roles

| Action                                              | Editor               | Participant | Viewer |
| --------------------------------------------------- | -------------------- | ----------- | ------ |
| See the states, the meta row, Page Health, the rail | yes                  | yes         | yes    |
| Verify, Verify Again                                | yes, with an account | no          | no     |
| Owner, review interval, Always in Context           | yes                  | no          | no     |

`knowledgeRights({ can, isStructureReadOnly, accountUserId, offline })`: `editFields` is `can.editPages` on the
whole knowledgebase (never a link confined to one page) that is not kept Offline; `verify` also needs an account,
since Verify says who vouches. Tests, a role at a time: `page-knowledge.test.ts` "who may verify and change the
fields", `page-knowledge-ui.test.tsx`, `page-knowledge-store-ui.test.tsx`, `PageTree.knowledge.test.tsx`.

### Measured

`page-knowledge-store-ui.test.tsx`, in jsdom: a typing commit (a new tab object and block list, the same headings
and fields) renders the meta row 0 times and the rail 0 times and sends no request; a commit that adds a heading
renders the rail and not the meta row; Page Health is requested once per page open. The slots plugin keeps the
same decoration set across a transaction that changed no document (`page-slots-plugin.test.ts`).

### Not built, or not known

- **"Edited <when> by <name>".** `PageMetaRowView` takes `edited` and draws it, but no route says when a page's
  writing was last edited or by whom: `tabs.updated_at` also moves on a Verify, a rename and a move, and a version's
  author is null for an idle save. Nothing is passed, so the row shows no "Edited".
- **A knowledgebase kept Offline** has no Verify and no field changes (the fields are written only by the routes),
  and no Page Health reads; the states still show from the tab.
- **The checkmark row is not a `menuitemcheckbox`**: the shared `MenuActionRow` has no checked state, so a screen
  reader hears "Always in Context" without whether it is on.
- **The meta row scales with the page's zoom**, as the title does, and takes the editor's theme colours, not the
  page's own paper colour: on a page given a dark background in a light theme its grey text is low contrast.
- **PDF export** draws the page as laid out, so the meta row's room shows as a gap under the title.
- The team's people are refused as owners when they reach the knowledgebase only through the team
  (`owner_no_access`, the api's known gap); the toast says the owner must be able to open the knowledgebase.

## Not built

The Ask tab, the AI Knowledge tab, Settings > AI and Home (another change's), over the client above.

## Where this differs from the specs

- **The spec files were not edited with this work**: each held another change's uncommitted edits while it was
  written, and a commit of the file would have taken those with it. What differs is recorded here until they can be.
