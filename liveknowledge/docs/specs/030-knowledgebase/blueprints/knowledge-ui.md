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
| `apiSetReviewPeriod(who, id, reviewEvery)`                                            | `PUT knowledge-settings`                                                  | the period as stored                                     |
| `apiPreviewReviewPeriod(who, id, reviewEvery, signal?)`                               | `GET knowledge-settings/preview?reviewEvery=`                             | `{ reviewEvery, reviewDue, reviewDueNow }`               |
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

| Piece                                                 | File                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| a page's state from its fields, the period, the clock | `lib/knowledge/page-trust.ts` (`pageTrust`, `trustMarks`)        |
| the knowledgebase's Review Period, outside React      | `lib/knowledge-settings/knowledge-settings-store.ts`             |
| Page Health and the fields just set, outside React    | `lib/knowledge/page-knowledge-store.ts` (`pageKnowledgeStore`)   |
| who may verify and set the fields                     | `lib/knowledge/knowledge-rights.ts` (`knowledgeRights`)          |
| a refusal in words                                    | `lib/knowledge/knowledge-words.ts` (`knowledgeFailureText`)      |
| the headings of the writing                           | `lib/knowledge/page-headings.ts` (`pageHeadings`)                |
| room in the writing for the meta row and the foot     | `lib/knowledge/page-slots-plugin.ts` (`createPageSlots`)         |
| the store's slices, the people, the actions           | `components/knowledge/usePageKnowledge.ts`                       |
| tick and pill                                         | `components/knowledge/TrustBadge.tsx`                            |
| the meta row                                          | `components/knowledge/PageMetaRow.tsx`, `PageKnowledgeSlots.tsx` |
| the right rail                                        | `PageRail.tsx`, `usePageRailChrome.tsx`, `OnThisPage.tsx`        |
| Page Health                                           | `components/knowledge/PageHealthCard.tsx`                        |

- **Every page's fields ride the tab summaries.** `readDocumentOutline` reads `json_extract(t.data, '$.knowledge')`
  beside each summary, `rowToTabSummary` answers it through `parseKnowledgeFields` as `TabSummary.knowledge` (absent
  for a page with none, and outside a tab-scoped visitor's scope), and `placeholdersFromSummaries` carries it onto
  the placeholder tab. The room's `tab-meta` patch after a Verify or a field change lands on the tab whether its
  body is loaded or not. **So the page tree's ticks come from the tab list: one pass a change, no request a row.**
- **States** are `trustState` over `parseKnowledgeFields(tab.knowledge)`, the knowledgebase's Review Period and the
  editor's shared 30 second clock (`useRelativeNow`): a review that comes due shows within 30 seconds, with nothing
  written. The period is read from `knowledgeSettingsStore` (`useReviewEvery(documentId)` in a component), so the
  tree's tick and Due pill, the meta row, Page Health, the page link's hover card and the Offline search all follow
  a change of it at once, with no request and no page touched ("The Review Period" below).
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
  held and raises a toast in words. The same for owner and Always in Context (`setFields`). What was set
  here shows until the tab's own `knowledge` changes (the room's patch, or a peer's later change).
- **Page Health** is read (`GET pages/<tab>/health`) once per page for the session, when the page opens; concurrent
  asks share one request. A failed read leaves the fields showing from the tab and the reads as a dash.
- **Page Health's rows** are Owner, Last Verified, **Review Due** (the date under the knowledgebase's period, "Not
  Verified" for a page never verified, "No Review Period" under Never), **Review Period** ("Every 90 Days", and for
  an Editor of the whole knowledgebase a pencil beside it: `ReviewPeriodButton`, named "Change Review
  Period", passed to the card as its `periodControl` by `PageRailBody` when `useSettingsOffered()` holds), and the
  two reads. Six rows whatever the period, each of a fixed least height, so
  nothing in the card moves when the period changes.
- **Last Verified** shows the date and who verified, each whole: the value is two blocks (`data-verified-date`,
  `data-verified-by`) in a row that wraps (`Row`'s `wrap`), so at the card's width the name takes a line of its own
  under the date. It was one truncated line ("Nov 20 by Priya N…"). The other rows keep one line.
- **The right rail** is 280 px (`PAGE_RAIL_WIDTH`), docked down the canvas's right from the toolbar's row on a
  window at least `pageRailDockWidth(treeWidth)` wide: 1,280 px (`PAGE_RAIL_MIN_WINDOW`), and never so narrow that
  the page beside it would be scaled down (1,400 px with the page tree open). The right corner stacks and the
  bottom-right cluster stand clear of it (`CanvasChrome`), the page's scroll container ends where it begins, and the
  page's column is centred in the room left ([page surface blueprint](page-surface.md)). The heading being read is
  found as the page scrolls, at most once every 120 ms, outside React. Below that a **Page Info** button under the toolbar's
  row opens the same two sections: a card on a desktop (Escape closes it), the shared `BottomSheet` on a phone.
  Hidden in zen mode, behind the welcome flow and in an embed.
- **On This Page** lists Heading 1 to 3 from the committed blocks (`pageHeadings`, kept per block list). The current
  heading is the last one at or above a line 160 px down the window, found from the headings' boxes when the view
  moves or the headings change, one pass a frame at most. A press brings the heading into view
  (`ArticleEditorHandle.rangeRect`, `scrollIntoView`).
- **Reading time** (`lib/knowledge/reading-time.ts`): `pageWords` counts the committed blocks' words (kept per block
  list, like `pageHeadings`; 100,000 words in well under 200 ms, tested), `readingMinutes` turns them into whole
  minutes at 230 a minute. `PageRailBody` reads both with the headings and passes the minutes to `OnThisPage`.
- **The page tree** shows the tick, or a short amber "Due" pill named "Review Due", at the row's right, and the
  state is part of the row's accessible name ("Release Process, Review Due"). The row menu gains **Verify** and
  **Always in Context** (a checkmark row) after Copy Link. Over budget, the toast says the route's reason from its
  sizes: "This page is 3,000 tokens and 6,000 of 8,000 are in use. Take another page out of Always in Context
  first."
- **Names.** `owner` and `verifiedBy` are account ids. The editor can name the person here and the people of the
  team whose library holds the knowledgebase (the comment mentions' list). Anyone else shows as "Verified" with no
  name, and as "Someone Else" in the owner picker, which offers those same people and Nobody.
- **Reads** need no call of the editor's: opening a page is `GET tabs/<tab>` (`apiLoadTabRevisioned`, from
  `seed-fetched-document.ts` for the first page and `usePerTabLoad` for the rest), which the api counts once a
  person a page a day.

### Under a Review Period of Never

[Verification](../verification.md#under-a-review-period-of-never). `pageTrust(knowledge, every, now)` answers state
`off` under Never (the fields kept, no `reviewAt`), so every editor reader of a page's state meets `off`:
`trustMark('off')` is none (the meta row, the tree, a link's hover card, a search row, Home's search), the meta row's
"Changed since verified" needs a mark, and `PageHealthCard` under `off` draws neither the state panel nor the Last
Verified and Review Due rows. `knowledgeRights` takes `verificationOn` and answers `verify: false` under Never,
which takes Verify out of the meta row, Page Health, the tree's row menu and the score's fixes at once.
`pageHealthFacts` reads an `off` page's fields for the score's own state (it leaves verification out under Never
regardless). Wire states from the api (an Ask source, a search result, a conflict side) arrive as `off` and draw
no badge (`sourceTrust` answers mark `off`, `trustText` an empty string); `answerTrust` answers none when every
source is `off`. AI Knowledge reads `overview.reviewEvery`: `FigureTiles` draws Average Health in Verified's place
and `HealthSection` drops the share, the bar, the legend and Remind the Owners. Tests: `page-trust.test.ts`,
`PageMetaRow.test.tsx`, `PageHealthCard.never.test.tsx`, `knowledge-rights` cases in `page-knowledge.test.ts`,
`source-meta.test.ts`, `AiDashboard.test.tsx`, each for Never and a set period.

### Share roles

| Action                                              | Editor               | Participant          | Viewer |
| --------------------------------------------------- | -------------------- | -------------------- | ------ |
| See the states, the meta row, Page Health, the rail | yes                  | yes                  | yes    |
| Verify, Verify Again                                | yes, with an account | yes, with an account | no     |
| Owner, Always in Context                            | yes                  | yes                  | no     |
| Change the Review Period                            | yes                  | no                   | no     |

`knowledgeRights({ can, isStructureReadOnly, accountUserId, offline })`: `editFields` is `can.editPages` on the
whole knowledgebase (never a link confined to one page) that is not kept Offline; `verify` also needs an account,
since Verify says who vouches. Tests, a role at a time: `page-knowledge.test.ts` "who may verify and change the
fields", `page-knowledge-ui.test.tsx`, `page-knowledge-store-ui.test.tsx`, `PageTree.knowledge.test.tsx`.

### The Review Period (built)

Derived from [Verification](../verification.md) "The Review Period". Modules: `apps/editor/lib/knowledge-settings/`
(pure: the store, the words, the change) and `apps/editor/components/knowledge-settings/`.

| Piece                                                     | File                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| the period a knowledgebase, taken from reads and the room | `lib/knowledge-settings/knowledge-settings-store.ts`                            |
| the words (labels, the count, the toasts)                 | `lib/knowledge-settings/review-period-words.ts`                                 |
| the count without a server, the preview, the one write    | `lib/knowledge-settings/review-period-change.ts`                                |
| who is offered it                                         | `components/knowledge-settings/useSettingsOffered.ts`                           |
| Page Health's Change, and its popover                     | `components/knowledge-settings/ReviewPeriodButton.tsx`, `ReviewPeriodPanel.tsx` |
| the rows, the question, the flow                          | `ReviewPeriodRows.tsx`, `PeriodAskStrip.tsx`, `useReviewPeriodFlow.ts`          |
| the period for a component                                | `components/knowledge-settings/useReviewEvery.ts`                               |

- **Where the period comes from.** `knowledgeSettingsStore.take(documentId, settings)` is called with the document
  read's `knowledgeSettings` (`seed-fetched-document.ts`, cloud or Offline), with the `document-meta` op's when the
  api stored a new one (`room-op-receive.ts`), and with the stored list's on a resync (`useRoomResync.ts`,
  `tabListOf`), so an op lost in a reconnect gap is recovered. Anything unknown reads as every 90 days.
- **The button.** An icon-only pencil, 18 px, in the sidebar foot's bordered look (slate-200 border, white or
  slate-900 ground, the brand wash on hover and while open), named "Change Review Period", beside the period in the
  Review Period row; pointer cursor; a hover card ("Changes it for the whole knowledgebase: every page at once.");
  44 px on a phone. No label, so the period shows in full beside it (owner 2026-11-21): the row (`Row`'s `whole`)
  never truncates its value, the value is set `tracking-tight` with a 3 px gap so "Every 90 Days" keeps the label's
  line in the docked rail even beside its thin scrollbar (220 px), and a longer value ("Every 180 Days") takes a line
  of its own at the right. The panel's code (`ReviewPeriodPanel.tsx`, its rows, the flow and the change) is its own
  chunk: fetched when the pointer or focus reaches the button, and the popover opens once it is in, so its first
  control takes focus.
- **The popover.** `ResponsivePopover`, 360 px, its right edge on the button's (a sheet on a phone). The panel: a
  glyph disc beside the heading **Review Period** (the popover's name) and the line "A verified page comes due for
  review this long after it was last verified."; then a brand-tinted line with the layers glyph, "Applies to every
  page in this knowledgebase."; then five bordered rows (`role="radiogroup"` named by the heading and described by
  the line; each row `role="radio"`, 36 px from `sm` up and 44 px on a phone, one tab stop on the chosen row, arrows
  move between rows, a press picks). The chosen row carries a filled tick as well as its tint. Under the rows a
  strip of fixed least height (`min-h-[6.5rem]`, the question's own height; `aria-live="polite"`,
  `PeriodAskStrip.tsx`) holds one quiet line ("Every page's due date moves at once. No page is rewritten.") or the
  question, its text over Cancel and Apply, so the popover is 480 px tall either way (measured at 1440 by 900).
- **Picking.** The same period: nothing. A longer one, or Never: applied at once. A shorter one
  (`isShorterPeriod`): the strip says it is counting, `GET knowledge-settings/preview` is asked (the request ends
  when another row is picked, on Cancel and when the popover closes), and when the count is more than what is due
  now the strip says "**12 pages will be due for review** with Every 30 Days." with **Apply** and Cancel; when it
  is not more, the period applies at once. A preview that fails, and a knowledgebase kept Offline, count from the
  fields the editor holds of every page (`countDuePages`: one pass, no request).
- **Applying** (`applyPeriod`) is optimistic: the store takes the period, so every state on screen moves; then
  `PUT knowledge-settings` (or, kept Offline, the record's `knowledgeSettings`). A refusal puts the period back
  (unless a newer choice was made since) with a toast in words ("Only an Editor can change the Review Period.
  Nothing was changed."); success is a toast ("Pages are now reviewed every 30 days.") with **Undo**, which applies
  the period it replaced. Home's kept summary of the knowledgebase is marked stale (`markSummaryStale`), so its
  next visit reads the counts and Yours to Review again, past both kept copies.
- **The one way in** is Page Health's pencil. Knowledgebase Settings (a dialog with only this in it), its row in
  the knowledgebase's menu and its command palette entry were removed (owner 2026-11-21). No command replaces it:
  the popover is anchored on the rail's row, which below 1,280 px is folded into Page Info.
- **Who.** `settingsOfferedOf`: `can.editPages` on the whole knowledgebase, not an embed, a workbench or a
  Community visit. A Participant and a Viewer see the period with no pencil; the api
  refuses them too. A knowledgebase kept Offline is its one person's to set.
- **Kept Offline.** `OfflineDocumentRecord.knowledgeSettings`; the sync's create carries it; a cloud knowledgebase
  moved to this browser keeps its period.
- **Telemetry.** `UI·Opened·ReviewPeriod`, `UI·Used·ReviewPeriodChanged` (before the write).
- **Tests.** `lib/knowledge-settings/knowledge-settings.test.ts` (the store, the words, the count, the write and
  its rollback, Home's reread); `components/knowledge-settings/ReviewPeriod.test.tsx` (who sees the pencil, the popover and
  its "every page" line, the rows and their keys, at once or asked, Apply and Cancel, Undo, the refusal, a peer's
  change, Offline, one height, 4.5:1 in light and dark); `page-knowledge-ui.test.tsx` and `page-knowledge-store-ui.test.tsx` (Page Health's rows and
  link, every reader following the store).
- **Not as the spec says.** "One undoable edit" is the toast's Undo: the editor's undo stack holds a page's
  elements and writing, and the period is the document's, so Cmd+Z does not reach it.

### Made by a person or an agent (built)

- **The api.** `page_authors` gains `created_kind`, `created_agent`, `created_via`, `updated_kind`, `updated_agent`,
  `updated_via` (schema step V18, `pageAuthorKindsSchemaStep` in `apps/api/src/knowledge/page-writer.ts`: each `ALTER TABLE ADD COLUMN` asked of
  `PRAGMA table_info` first, as V15 and V16 do; the kinds `NOT NULL DEFAULT 'human'`, since V17 noted people only).
  A write is noted as a `PageWriter` `{ by, kind, agent?, via? }`: `writerOf(ctx, by)` reads the request's token
  (the `X-Liveknowledge-Agent` name the client sends, else its `name`, and `frontDoorOf` for `mcp`, `cli` or `api`); a person's is `{ by, kind: 'human' }`.
- **Where each write is noted.** The tab PUT (a person), `POST documents` seeding pages (a person, or the token),
  `POST pages` (`create_page`, Import), the Pages route (`write_page`, a cover), a changeset and a revert, a version
  restore and copy, each after the write landed (`notePageWrite`, a failure logged and never failing the write).
  Accepting a suggestion notes `{ by: the Editor, kind: 'ai', agent: the suggestion's agent, via: 'suggestion' }`.
- **The read.** Page Health answers `created` and `updated` as `{ by, at, kind, agent?, via? }`
  (`PageAuthorStamp`, `@liveknowledge/api-schema`).
- **The editor.** `PageMakersBadges` (`components/knowledge/PageMakersBadges.tsx`), in `PageMetaRowView` after the
  reading time: two pills of the meta row's own size, neutral (`slate`), each with a `HoverCard` from
  `makerWords(stamp, which, nameOf, now)` (`lib/knowledge/page-makers.ts`). A page without a row draws neither.
- **Tests.** `page-writer.test.ts` (V18 on a room at V17 with rows, every kind of writer), `routes/page-cover.test.ts`
  (every kind stamped through the routes, the suggestion's),
  `knowledge-page-routes.test.ts` (Page Health answers them; an agent's write shows as one),
  `page-makers.test.ts`, `PageMetaRow.test.tsx`, `e2e/signed-in/page-cover.spec.ts` (an agent's write shows AI Edited).

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

## Page links (built)

Derived from [Links and embeds](../links-and-embeds.md) "Page links".

| Piece                                                  | File                                                     |
| ------------------------------------------------------ | -------------------------------------------------------- |
| the mark, and its round trip to `ArticlePageLinkRun`   | `lib/article/article-schema.ts`, `article-convert.ts`    |
| the `[[` trigger, the caret, a press, a pasted address | `lib/knowledge/page-link-plugin.ts`                      |
| what the picker lists, Create Page, the first lines    | `lib/knowledge/page-link-pick.ts`                        |
| every link's current title                             | `lib/knowledge/page-link-titles.ts`                      |
| the picker and the wiring to the editor's store        | `components/knowledge/usePageLinks.tsx`                  |
| the hover card                                         | `components/knowledge/PageLinkHoverCard.tsx`             |
| a subpage made from the writing                        | `addNamedSubpage` (`hooks/persistence/useTabActions.ts`) |

- **The colour.** A live link is the brand's, not the article style's accent: `pageLinkColour` (`lib/knowledge/
page-link-colour.ts`) is brand-700 `#3f6212` on light paper and brand-300 `#bef264` on dark, passed through
  `legibleOn` at 4.5:1 for a paper of any colour, and handed to the writing as `--article-page-link`
  (`articleStyleVars`); `pageLinkCss` paints with it. A link to a page that is gone has no rule, so it keeps the base
  look in `app/article-pages.css`: the writing's ink at 0.65, struck through, a default cursor (4.7:1 on white).
  Tested in `page-link-colour.test.ts`.
- **The model.** A page link is the mark `pageLink` (`attrs.page`, the tab id) over the words stored with it.
  `marksOf` makes it from `pageOfRun(run)` (the page wins over an `href`; the mark excludes `link`), and
  `docToBlocks` writes `page` back onto the run, so `ArticleRun` is not widened and a block nobody typed in reads
  back as the same object. **Before this the editor dropped `page` from every run it read, so the first commit on a
  page stripped the page links an import or an agent had written.**
- **A mark, not an atom,** because the engine counts a block's characters as editor positions (Find's ranges, the
  carets, the holds): a link keeps its stored words in the writing, one position a character.
- **The current title.** The link is drawn as `a.article-page-link[data-page][href="#t=<page>"]`, its stored words
  inside a span that takes no room and is `aria-hidden`. `pageLinkCss(pages)` writes one rule a page of the
  knowledgebase that puts its current title into the link (`::before`) and gives it a live link's look;
  `installPageLinkTitles` keeps them in one `<style>` element, rewritten only when a page's id or name changed. A
  link no rule names keeps the base look: "Deleted Page", struck through, with the default cursor. So a rename
  shows in every link at once, no writing changes, and typing costs nothing. Titles are written as CSS strings
  with `\`, `"` and line breaks escaped (`cssString`).
- **The picker.** `[[` typed in the writing (never pasted, never a peer's) opens it; what is typed after filters it
  (60 characters at most); `]`, a line break or the caret leaving closes it; Escape closes it and leaves the text as
  typed. It is the slash menu's popover (`SlashMenu`, given its own name and empty state) over
  `pagePickItems`: the pages but the one being written, titles starting with the words before titles containing
  them, 8 at most (`PAGE_PICK_MAX`), each with its ancestors as the hint, then **Create Page** at the foot once
  something is typed. Up, Down, Enter and Tab are the picker's while it is open (the plugin is first in the
  writing's list, `leadingPlugins`). The slash menu's **Link to Page** types the `[[` for the person.
- **Create Page** calls `addNamedSubpage(currentPage, title)`: a subpage named as typed, its Title saying so, not
  opened; the link is put in to its id. Refused at a tree limit with the tree's own toast.
- **A pasted address** that is this knowledgebase's own with `#t=<page>` for a page it holds (what Copy Link
  copies) becomes a link (`pageOfPastedUrl`).
- **One thing to the caret.** A caret that lands inside a link moves on to the edge it was heading for
  (`appendTransaction`, a constant check a transaction), and Backspace after a link or Delete before one takes it
  whole. Typing at a link's edge is plain text (`inclusive: false`).
- **A press** opens the page with no reload (`selectPage`), from the DOM `click`, so a reader's view never follows
  the anchor; with a modifier held the link's own address opens it in a new tab. A link to a page that is gone goes
  nowhere.
- **The hover card** shows after 350 ms on a link (`PAGE_LINK_CARD_DWELL_MS`): the page's current title, its tick or
  pill, and its first lines (180 characters, `firstLines`); "Deleted Page" for a page that is gone.

Share roles: `canInsert` is `editable && reshape !== false` (an Editor writing): only then does `[[` open the
picker, a pasted address become a link, or the slash menu offer Link to Page. A Participant and a Viewer follow
links and see the hover card. Tests, a role at a time: `lib/knowledge/page-links.test.ts`,
`components/knowledge/usePageLinks.test.tsx`, `useTabActions.pages.test.tsx` "a subpage made from a page link".

Per keystroke the plugin reads the two characters before the caret (closed), or the text since the `[[` (open,
60 characters at most), and checks whether the caret is inside a link. Not measured in a browser.

### Not built, or not known

- **The hover card reads nothing from the network.** Its first lines come from the page's writing when this editor
  already holds it (a page opened this session); for a page not yet opened it shows the title and the state alone.
  The only route that returns a page's writing is `GET tabs/<tab>`, which counts a read: a hover would count as
  that person's read of the page for the day.
- **The shared `HoverCard` is not what draws it**: that component wraps a React child, and a link is the writing's
  own DOM. The card is its own small surface in the same look, as the ordinary link's card is.
- **Stored words are not refreshed** when a page is renamed: they stay as written at the time of linking (what an
  agent's Markdown read resolves is the knowledge blueprint's `withPageLinkTitles`).
- **A screen reader** hears the title from the rule's generated content; that has not been tried with one.
- **A Content Security Policy that refuses inline `<style>`** would stop the titles (every link would read
  "Deleted Page"); the editor sets none today.
- Markdown export's relative paths and current titles in an agent's read are the knowledge blueprint's "Not built".

## Backlinks (built)

Derived from [Links and embeds](../links-and-embeds.md) "Backlinks". `lib/knowledge/backlinks-store.ts`
(`backlinksStore`, `linkTargetsKey`) and `components/knowledge/LinkedFrom.tsx`, drawn in the writing's foot slot
(`PageKnowledgeSlots`).

- **Linked From** is a small uppercase label, "Linked From 5 Pages" ("1 Page"), over rounded chips, above a
  hairline, after the writing's last block. Each chip is a link to its page (`#t=<page>`; a plain press opens the
  page here) and says the page's title as it is now, from the tab list; a page deleted since the read has no chip.
  The order is the route's (tree order). With none the section is absent: no heading, no empty state.
- **Read** from `GET pages/<tab>/backlinks` every time the page opens; the last answer shows meanwhile, and readers
  are told only when the answer differs, so the section does not blink. It fades in (`animate-fade-in`) below
  everything else on the page, so nothing above it moves.
- **Read again after a saved change of links.** `linkTargetsKey(blocks)` is the page's link targets as one string,
  kept per committed block list; when a commit changes it the page's backlinks are read again `LINKS_SETTLE_MS`
  (3,000) later, by when the autosave has written the link table. The editor's store says nothing when a save
  completes, so the wait stands in for it.
- Every role reads and follows. A knowledgebase kept Offline reads none (there is no link table in the browser).

Measured (`LinkedFrom.test.tsx`, jsdom): a typing commit that changed no link sends no request and renders the
section 0 times; a commit that changed a link sends one request, 3 seconds later.

Not known: a peer's new link to the page being read shows the next time the page opens, not while it is open (no
room message says the link table moved).

## Search (built)

Derived from [Search and Ask](../search-and-ask.md) "Search".

| Piece                                                         | File                                                  |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| marks, one request at a time, the Offline search              | `lib/knowledge/knowledge-search.ts`                   |
| a door's ask, the chord                                       | `lib/knowledge/search-open.ts`                        |
| a page opened at a block                                      | `lib/knowledge/go-to-block.ts`                        |
| the pages opened most recently, per browser                   | `lib/knowledge/recent-pages.ts`                       |
| This Knowledgebase: the group's items for what is typed       | `components/knowledge/useThisKnowledgebaseSearch.tsx` |
| one result's row                                              | `components/knowledge/KnowledgeResultRow.tsx`         |
| the doors: the chord, the field's ask, noting the page opened | `components/knowledge/KnowledgeSearchHost.tsx`        |
| the Search field                                              | `components/knowledge/SearchField.tsx`                |
| the group a host puts first in the panel                      | `components/panels/search-lead-group.ts`              |

- **No dialog of its own** (owner, 2026-11-20). `SearchDialog.tsx` is deleted; its tests' intent is held against
  the panel's first group (`knowledge-search.test.tsx`, `KnowledgeSearchHost.test.tsx`).
- **The doors.** The **Search** field stands at the head of the page tree (under the knowledgebase's name; an icon
  on the collapsed rail; first in a phone's Pages sheet). It and **Cmd or Ctrl K** (a capture listener ahead of the
  editor's own keys) ask through `knowledgeSearch.open()`; `KnowledgeSearchHost` spends the ask by opening the
  editor's universal search panel (`setSearchOpen(true)`, the panel Tools > Search… and Cmd or Ctrl `.` open). In
  the writing, while words are selected, Cmd or Ctrl K stays the link field's.
- **This Knowledgebase is the panel's first group, always.** `SearchPanel` takes a `lead` group
  (`SearchLeadGroup`: a label, items that each draw their own row and say what a press does, and one line for when
  there are none) and tells its host what is typed (`onQueryChange`). It draws that group above its own, and the
  arrow keys walk the lead's rows first, then the rest; Enter or a press closes the panel and runs the row.
  `EditorSearchPanel` holds the typed text and hands `useThisKnowledgebaseSearch(query, { enabled })` 's answer in.
- **It answers on its own.** The hook runs `createSearchRunner` (the room's search route, or `searchLoadedPages`
  for a knowledgebase kept Offline) and sets its own state when the answer lands; the panel's other groups are
  worked out from what is typed, as before, and neither waits for the other. The last results stay listed while
  the next search is on its way.
- **Each row** (`KnowledgeResultRow`): the page's title with the matched words marked, its tick or pill, where it is
  (the page's ancestors, then the passage's headings: `resultPlace`) and, for a passage, the matching lines.
- **The field empty:** the pages opened most recently (`recent-pages.ts`: `liveknowledge:v2:recent-pages` in
  `localStorage`, per knowledgebase, the newest first, 8 a knowledgebase, the 50 most recent knowledgebases; a page
  is noted once as it opens, and the page already first writes nothing). A page that is gone is left out. None yet:
  "Pages you open are listed here."
- **Nothing found:** the group shows "No Pages Match" in one line (`NO_PAGES_MATCH`), and the other groups follow.
  A failure is said in the same line, as an alert.
- **Snippets are text.** `markedParts` splits the server's snippet on U+0002 and U+0003 into text and marked text,
  drawn as `<span>` and `<mark>`; nothing is ever set as HTML.
- **One request at a time.** `createSearchRunner`: each keystroke cancels the pending timer and aborts the request
  in flight, then waits `SEARCH_DEBOUNCE_MS` (150) and sends; an answer for a query that was replaced is dropped.
  Closing the panel stops it.
- **Refusals in words.** Past 200 characters nothing is sent and the group says "A search is at most 200
  characters." (the route's own `query_too_long` reads the same); a 429 says "Too many searches at once. Wait a
  moment and try again."; anything else that the search is not answering.
- **Opening a result** (`goToBlock`): the page opens with no reload; for a passage, its first block is looked for
  every 50 ms (4 s at most, a page not yet opened loads first), brought into view (`rangeRect`, `scrollIntoView`)
  and tinted for 1.6 s (`article-search-hit`, a steady tint with no animation: the motion budget allows none that long).
- **Offline** (`searchLoadedPages`): the same group over the pages this editor holds, with the room's own
  passages (`pagePassages`) and words (`searchTerms`): every word must be in the title or in one passage, titles
  first, 20 at most, the matched words marked the same way. No ranking beyond that order, and a page whose writing
  this browser has not loaded is found by its title alone.
- Every role searches; the group and its doors are given no role.

Measured (`knowledge-search.test.tsx`, `KnowledgeSearchHost.test.tsx`, fake timers): three keystrokes inside
150 ms send one request; a newer search aborts the one in flight, so never two are in flight; a search past 200
characters sends none.

Not known: how the dialog sits over the canvas chrome, and the result rows' look, in a browser.

## Embeds from other apps (built as the platform's live embed)

Derived from [Links and embeds](../links-and-embeds.md) "Embeds from other apps". **Not built as the spec draws
it.** The article engine's zones hold canvas elements, and the platform already has the element this asks for: the
live embed ([live-embeds.md](../../../../../liveworkspace/docs/specs/004-index/live-embeds.md); the Embed element
with `embedProvider: 'live'`, `LiveEmbedView` and `LiveEmbedPicker` in `packages/workbench`). A second card with its
own picture loop would have been a copy of it. What was done, exactly:

- The slash menu gains **Embed** (`article-slash-items.ts`, found by its name and by each app's), an Editor's as
  every slash entry is.
- `ArticleInsert` gains `'embed'`, placed as `{ type: 'video', provider: 'live' }` (`PLACE_INTENT` in
  `hooks/editor/useArticles.ts`); `placeIntentAt` (`useElementCreation.ts`) takes a `video` intent. The element
  lands at the caret and the writing takes it into an object zone, as it takes a chart or a sticky.
- Its face is the platform's: the item's snapshot picture (the platform's preview, `/api/previews/items/<id>`), its
  app's mark, its name, **Open** in a new tab, and, on screen, the item's own read-only frame over the picture. A
  reader who cannot open it sees "You don't have access to <name>." and "Ask its owner to share it with you.", with
  the platform's request for access.
- Choosing the item is the platform's picker (a file of any app, or a pasted share link), opened by a double press
  on the empty embed.

Where it differs from the spec, none of it built:

| Spec                                                           | Built                                                                       |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Embed takes a pasted link to an item                           | Embed places an empty embed; its picker takes a chosen file or a share link |
| the app's logo mark and wordmark                               | the mark alone (the platform's face)                                        |
| a "Live" dot                                                   | none: the item's own frame is what is live                                  |
| the picture re-read when the page opens and every five minutes | the picture is the snapshot kept on the element; the live frame replaces it |
| "You Don't Have Access to This"                                | the platform's words above                                                  |
| a tab of an item                                               | the platform's picker chooses an item                                       |

No test draws the embed in the writing: `embed-insert.test.ts` holds the slash entry, and the element, its face and
its picker are the platform's own tested code. That a `video` element is taken into a zone like the other inserts
has not been seen in a browser.

## Not built

The Ask tab, the AI Knowledge tab, Settings > AI and Home (another change's), over the client above.

## Where this differs from the specs

Each spec's Status line says what is built and points here; their bodies were left as written, because each file
held another change's uncommitted edits while this was made (only the Status line was committed from them).

| Spec says                                                      | Built                                                                                    |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| "The top bar's field" searches                                 | The Search field is at the head of the page tree: the editor has no header bar           |
| The meta row says "Edited <when> by <name>"                    | Not shown: no route says it ("Verification", "Not built, or not known")                  |
| Hovering a link shows its first lines                          | Only for a page this editor has already opened ("Page links", "Not built, or not known") |
| An embed is a card with a picture re-read every five minutes   | The platform's live embed ("Embeds from other apps")                                     |
| Verify: Editor only                                            | An Editor signed in to an account (the route's rule: Verify says who vouches)            |
| Offline knowledgebases search in the browser over the passages | Over the pages this editor holds; a page not loaded is found by its title alone          |

## Still open, across the whole of it

- **Nothing here has been seen in a browser.** Unit and component tests only. In particular: the meta row's and
  Linked From's place and spacing inside the writing, the right rail beside the canvas chrome's own corners and
  cluster, the page framing between the tree and the rail, a page link's title drawn by its CSS rule and the caret
  beside it, the picker's place under the `[[`, and the search panel over the chrome.
- **First-load size was not measured.** The editor now imports `@liveknowledge/knowledge` (trust, passages, the
  search words) on its main path; the package is side-effect free, so only what is imported should be kept, but no
  build was run to confirm it.
- **Cmd or Ctrl K no longer opens the editor's command search** (it keeps Cmd or Ctrl `.`); the shortcuts list
  (`shortcut-sections.ts`) says Search Pages for Cmd K and Search & Commands for Cmd `.`.
- **The command search loads no page.** The fork's `openSearchWithPrefetch` fetched every page with `GET
tabs/<tab>` when the command search opened, which counted a read of every page for that person that day. Its three
  doors (the bottom bar, the canvas menu, Cmd or Ctrl `.`) now only open the panel, which reads the pages this editor
  holds; only opening a page fetches it. The fork's Search Elements (S, and the palette's last button) is removed:
  `ToolbarSearch.tsx` is deleted and S is the Select alias alone. Still loading every page, on purpose: Apply to All
  Tabs, the split view and a whole-knowledgebase export.
