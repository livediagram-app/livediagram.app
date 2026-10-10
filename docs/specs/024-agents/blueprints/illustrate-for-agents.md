# Illustrate for agents: blueprint

Derived from [Illustrate for agents](../illustrate-for-agents.md). Every rule there maps to a module, a
function and a test here; nothing here adds design.

## Domain and naming

| Spec term         | Identifier                                                                                                                                                                                    | Where                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| page change       | `PageChange` (union on `op`: `add`, `set`, `layout`, `move`, `duplicate`, `delete`)                                                                                                           | `packages/api-schema/src/illustrate.ts`                                                 |
| article write     | `ArticleWrite` `{ article?, new?, markdown, mode?, size?, orientation?, look?, accent?, pageNumbers? }`                                                                                       | `packages/api-schema/src/illustrate.ts`                                                 |
| page ref          | `PageRef = string \| number` (id, place, or name)                                                                                                                                             | `packages/api-schema/src/illustrate.ts`                                                 |
| page summary      | `PageSummary` `{ place, id, name, kind, size, orientation, rect, background?, locked?, flow?, elements }`                                                                                     | `packages/api-schema/src/illustrate.ts`                                                 |
| article summary   | `ArticleSummary` `{ flow, title, pages: number[], blocks, words, look }`                                                                                                                      | `packages/api-schema/src/illustrate.ts`                                                 |
| refusal           | `IllustrateRefusal` `{ code: IllustrateRefusalCode, message, change? }`                                                                                                                       | `packages/api-schema/src/illustrate.ts`                                                 |
| the engine        | `applyPageChanges(tab, changes, ctx)`, `applyArticleWrite(tab, write, ctx)`                                                                                                                   | `packages/edit-operations/src/illustrate/`                                              |
| pure page edits   | `pageAdded`, `pageRenamed`, `pageResized`, `pageTurned`, `pageBackgroundSet`, `pageLockSet`, `pageLaidOut`, `pageMovedTo`, `pageDuplicated`, `pageRemoved`; `pagesSharing`, `pageLockRefuses` | `packages/document/src/illustrate-edits.ts`                                             |
| Markdown in / out | `articleFromMarkdown(text, current?)`, `articleToMarkdown(flow)`, `articleWordCount`, `articleTitleOf`, `ARTICLE_MARKDOWN_MAX`                                                                | `packages/document/src/article-markdown-io.ts`                                          |
| paste reading     | `parseMarkdownBlocks`, `parseInline`, `looksLikeMarkdown`, `plainTextBlocks` (moved)                                                                                                          | `packages/document/src/article-markdown.ts`                                             |
| layout build      | `buildPageLayout(layout, page)` (moved)                                                                                                                                                       | `packages/templates/src/page-layout-build.ts`                                           |
| page paint        | `withBackgroundPatch`, `sameFill`, `PAGE_GRADIENT_ANGLE` (moved)                                                                                                                              | `packages/document/src/illustrate-page-paint.ts`                                        |
| summaries         | `pageSummaries`, `articleSummaries`, `describeBackground`                                                                                                                                     | `packages/api-schema/src/illustrate-summary.ts`                                         |
| article frames    | `tabArticleOps(before, after, { agent })`, `ARTICLE_FRAME_CHARS` (moved)                                                                                                                      | `packages/api-schema/src/article-frames.ts`                                             |
| submit            | `submitIllustrate`, `illustrateRoomOps`                                                                                                                                                       | `apps/api/src/changesets/illustrate.ts`                                                 |
| relay             | `relayIllustrate`                                                                                                                                                                             | `apps/api/src/room-client.ts`                                                           |
| grow marks        | `markArticleGrow`, `isArticleGrowPending`, `clearArticleGrow`; `shouldGrowForAbsentWriter`                                                                                                    | `apps/live/lib/article/article-grow-store.ts`, `packages/document/src/article-pages.ts` |
| icon check        | `isIconId`, `iconsLike`                                                                                                                                                                       | `packages/icons/src/search.ts`                                                          |
| route             | `handleTabIllustrate`                                                                                                                                                                         | `apps/api/src/routes/tab-illustrate-route.ts`                                           |
| verbs             | `changePages`, `writeArticle`, `readArticle`, `illustrateTabOf`                                                                                                                               | `packages/agent-verbs/src/illustrate/illustrate-calls.ts`                               |
| MCP tools         | `change_pages`, `write_article` (`mcpChangePages`, `mcpWriteArticle`)                                                                                                                         | `packages/agent-verbs/src/mcp/illustrate-schema.ts`, `apps/mcp/src/illustrate-tools.ts` |
| CLI verbs         | `page.ls`, `page.set`, `article.get`, `article.set` (`illustrateVerbs`)                                                                                                                       | `packages/agent-verbs/src/verbs/illustrate.ts`                                          |
| view              | `pages` in `TAB_VIEW_NAMES`, rendered by `pagesView`                                                                                                                                          | `packages/document-views/src/pages.ts`                                                  |

Banned synonyms: "document" for an article, "slide deck" for a tab of slides (it is a tab of slide pages),
"template" for a layout.

## Behaviour and state

### Moves out of the editor (no behaviour change)

1. The paste reading of Markdown now lives in `packages/document/src/article-markdown.ts` (+ test), exported from
   the package index; the editor's `article-paste.ts` imports it from `@livediagram/document`. It gains Markdown's
   backslash escapes (`\*` is a literal `*`), so what `articleToMarkdown` escapes reads back as written.
2. `buildPageLayout` now lives in `packages/templates/src/page-layout-build.ts`; the editor's callers import it
   from `@livediagram/templates`.
3. `withBackgroundPatch`, `sameFill` and `PAGE_GRADIENT_ANGLE` now live in
   `packages/document/src/illustrate-page-paint.ts`; the editor's paint module re-exports them and keeps only what
   draws.
4. The tab transforms inside `apps/live/hooks/editor/illustrate-page-edits.ts` became pure functions in
   `packages/document/src/illustrate-edits.ts`. Each takes the tab and answers `{ tab } | { refused: PageEditRefusal }`
   (`PageEditRefusal = 'locked' | 'no_orientation' | 'size_not_offered' | 'pattern_not_offered' | 'page_limit' |
'last_page' | 'unknown_page'`); the hook keeps telemetry, toasts, `onGoTo`, `claimArticleLayout` and debug
   logs, and calls them inside `commitTab`. The lock rule (`refusedLocked` with `shared`) and `sharing` move with
   them. Existing editor tests stay green unchanged; new unit tests cover each function.

### The engine (`packages/edit-operations/src/illustrate/`)

`page-changes.ts` `applyPageChanges(tab, changes, { themeId, newId })`:

1. Refuse `tab.locked` → `tab_locked`; `tabKindOf(tab) === 'event-storming'` → `tab_kind`.
2. `switched = opensInOf(tab) !== 'illustrate'`; if so `tab = withEditorModeSwitched(tab, 'illustrate')`.
3. For each change `i` in order, against the current `tab`:
   - resolve `page` (`resolvePage`: id, then integer place 1..n, then name by `nameKey`) else `page_unknown` listing
     `1 Cover (slide), 2 (slide)`;
   - `add`: `kind === 'article'` → `article_by_write`; if the only page is unchosen and empty
     (`offersPageKindChoice`) → `withPageKindChosen`, else `pageAdded(tab, kind, newId(), newFlowId())`; then
     `name`, `size`, `orientation`, `background` through `pageRenamed`, `pageResized`, `pageTurned`,
     `pageBackgroundSet`, `at` through `pageMovedTo`, `layout` through `pageLaidOut`. Line:
     `Added page 3 (slide, Slide (16:9)) from layout Title Slide: name "Cover".`;
   - `set`: `locked: false` first (so an unlock-and-edit works), then name, size, orientation and background
     through their edits, then `locked: true`. Line: `Set page 2: size A3, background #0f172a`;
   - `layout`: id checked against `layoutCatalogueFor(kind).layouts` else `layout_unknown` naming them; then
     `pageLaidOut(tab, pageId, buildPageLayout(id, laidOutPage))`, exactly as the page panel places it. Line: `Laid out page 1 as Title (replaced 4 elements)`;
   - `move`: `to` clamped to 1..units; `pageMovedTo`. Line: `Moved page 4 to 1`;
   - `duplicate`: `pageDuplicated`. Line: `Duplicated page 2 as page 3`;
   - `delete`: `pageRemoved`; refused `last_page` when one unit is left. Line: `Deleted page 2 and 4 elements on it`
     (an article: `Deleted article "Brief" (3 pages)`);
   - a `refused` from a pure edit maps to its code (`unknown_page` → `page_unknown`, `locked` → `page_locked`,
     the rest the same name) and stops: `{ refusal: { code, message, change: i } }`, nothing to write.
4. Answer `{ tab, lines, switched }`; the route adds the summaries (`pageSummaries`, `articleSummaries`).

`article-write.ts` `applyArticleWrite(tab, write, { page?, flow? })` (ids injectable for tests):

1. Tab refusals as above; switch into Illustrate as above.
2. `markdown.length > ARTICLE_MARKDOWN_MAX` → `article_too_large`, refused by the request reader, pointing at
   `append`.
3. Resolve the article: `new` → new; `article` → flow id, else title by `nameKey` among `articlesOf(tab)` →
   `article_unknown` listing titles; absent → the only one, none → new, several → `article_ambiguous`.
4. New: `offersPageKindChoice` → `withPageKindChosen(tab, onlyPage, 'article', flow)`, else
   `pageAdded(tab, 'article', id, flow)` (the editor's paper rule), then `size` and `orientation` in turn (`size`/`orientation` when given and in `pageSizesFor('article')`, else
   `size_not_offered`). Refuse at `MAX_ILLUSTRATE_PAGES` → `page_limit`.
5. Any page of the flow locked → `page_locked`.
6. Parse: `articleFromMarkdown(markdown, current)` → `{ blocks, keptZones, droppedZones }`, or `unknownZone`
   (`zone_unknown`), or `tooLong` (a paragraph past `MAX_ARTICLE_BLOCK_TEXT`: `article_too_large`, never cut).
   Fresh ids never meet the article's own, so `append` concatenates after the current blocks (a new article's
   placeholder Title and paragraph give way) and keeps every zone and note.
7. No blocks left → one empty paragraph. Blocks past `MAX_ARTICLE_BLOCKS` → `article_too_large`.
8. Dropped zones: their elements removed (`withZoneContentsRemoved`); notes whose text is gone (`articleNoteIds`
   before and after): their markers removed (`withNoteMarkersRemoved`).
9. Style: `look`, `accent` (`isArticleHex` else `invalid_value`), `pageNumbers` merged into `style`.
10. `withArticleFlow(tab, flow, { blocks, style })`. Answer `{ tab, flow, created, lines, switched }`.

### Markdown in and out (`article-markdown-io.ts`)

- `articleFromMarkdown`: strip a leading front matter (`/^---\n([\s\S]*?)\n---\n/`), read `title:` and `subtitle:`
  (trimmed, quotes removed); split the body on lines matching `/^\[zone ([^\]\s]{1,64})\]$/` and
  `/^\\pagebreak$/`, parse each text stretch with `parseMarkdownBlocks`, put a `pageBreak` block or the current
  zone block (by id, else `unknownZone`) between them, never inside a code fence; prepend `title` and `subtitle`
  paragraph blocks. A paragraph (lines with no blank between) past `MAX_ARTICLE_BLOCK_TEXT` answers `tooLong`.
  Fresh block ids from `nextArticleBlockId`, never one of `current`'s; a kept zone keeps its id.
- `articleToMarkdown`: front matter from the first `title` / `subtitle` blocks, then each block: paragraph by style
  (`#`, `##`, `###`, `>`, body), list by level (two spaces a level, `-`, `1.`, `- [ ]` / `- [x]`), code fenced,
  divider `---`, page break `\pagebreak`, zone `[zone <id>]`; runs: `**b**`, `*i*`, `~~s~~`, `` `code` ``,
  `[text](href)`, emphasis kept inside a run's own spaces; Markdown's characters escaped with a backslash, and a
  block's text that would open a heading, quote, list or divider escaped at the line start; a line break inside a
  block prints as a space; underline, colour, highlight, sup and sub print as plain text (lossy). A numbered
  list counts as the editor does: a bullet or to-do at a level restarts that level.
- Round trip: `articleFromMarkdown(articleToMarkdown(f))` keeps every block's type, style, list, level, checked
  and text for an article without the lossy marks.

### The editor grows an article for an absent writer

- `RoomOp` `article` gains `agent?: true`, set by the api relay only.
- `apps/live/lib/article/article-grow-store.ts` holds the marks (tab and flow). `room-op-apply.ts` marks a flow on
  an incoming `article` op with `agent: true`; `useArticles` marks every flow of the active tab as it loads.
- `useArticles` `onLayout` with `!layout.local` calls `growForAbsentWriter`: a marked flow, once web fonts are
  loaded (`document.fonts.status`), clears its mark and, when the pure decision says so, ticks
  `withArticlePageCount(t, flow, pagesNeeded)` (grow only) and logs `[article] grown for an absent writer`.
- The pure decision is `shouldGrowForAbsentWriter({ local, pending, needed, have, locked })` in
  `packages/document/src/article-pages.ts`.

## Interfaces and contracts

### Route

`POST /api/documents/:id/tabs/:tabId/illustrate`, JSON body, one of:

```ts
{ pages: PageChange[] }                // 1..50
{ article: ArticleWrite }
```

`PageChange` (strict, unknown keys refused `invalid_value`):

```ts
| { op: 'add'; kind: 'infographic' | 'slide' | 'logo' | 'article'; size?: PageSizeId; orientation?: PageOrientation;
    name?: string; background?: PageBackgroundInput; layout?: string; at?: number }
| { op: 'set'; page: PageRef; name?: string; size?: PageSizeId; orientation?: PageOrientation;
    background?: PageBackgroundInput; locked?: boolean }
| { op: 'layout'; page: PageRef; layout: string }
| { op: 'move'; page: PageRef; to: number }
| { op: 'duplicate'; page: PageRef }
| { op: 'delete'; page: PageRef }
PageBackgroundInput = { color?: string; gradient?: [string, string]; angle?: number;
                        pattern?: 'dots' | 'grid' | 'lines' | 'none'; paper?: true }
```

Answer `200`:

```ts
{ tab: { id, rev }, switched: boolean, lines: string[], pages: PageSummary[], articles: ArticleSummary[],
  article?: ArticleSummary & { created: boolean }, changesetId: string | null }
```

Refusals: `400 { error, message, change? }` for every engine code and `invalid_body`, `403` gate, `404` document or
tab, `409 tab_busy`, `413 tab_too_large`.

`IllustrateRefusalCode`: `invalid_body`, `invalid_value`, `tab_locked`, `tab_kind`, `page_unknown`,
`article_by_write`, `size_not_offered`, `no_orientation`, `pattern_not_offered`, `layout_unknown`, `page_locked`,
`page_limit`, `last_page`, `article_unknown`, `article_ambiguous`, `zone_unknown`, `article_too_large`.

### MCP

- `change_pages` `{ documentId, tabId?, changes: PageChange[] (1..50) }`, behaviour `destructive`, output
  `{ documentId, tabId, switched, lines, pages, articles, rev, url }`; a refusal is a tool error, `Change n: …`
  counting from 1.
- `write_article` `{ documentId, tabId?, article?, new?, markdown, mode?, size?, orientation?, look?, accent?,
pageNumbers? }`, behaviour `destructive`, output as `change_pages` plus `article` (with `created`). Fields not
  given are not sent.
- Which tab, before the route (`illustrateTabOf`): the one named, else the first in Illustrate mode, else the first
  tab when it is empty, else `tab_needed` saying to name a tab or `add_tab` with `blank-illustration`.
- Every input and output property `.describe()`d; layout ids described by kind in `change_pages`'s `layout`
  description, generated from `layoutCatalogueFor`.
- `read_document` `view` enum gains `pages`.
- The server instructions (`packages/agent-verbs/src/mcp/schema.ts`) gain a paragraph: what Illustrate tabs hold,
  which tool makes what (a document or brief → an article, a deck → slides, a logo → a logo page), how a document
  for pages starts (`create_document` with template `blank-illustration`), and that a layout's sample text is
  found in the `pages` view and replaced with `update_document`.

### CLI

- `page ls <doc> [--tab]` → the `pages` view.
- `page set <doc> [--tab] --changes <file|->` (a JSON list, or one change) or flags for one change (`--add slide
--layout slide-title`, `--page 2 --name Cover`, `--page 2 --delete`, `--move`, `--duplicate`, `--size`,
  `--orientation`).
- `article get <doc> [--tab] [--article]` → Markdown on stdout.
- `article set <doc> <file|-> [--tab] [--article] [--new] [--append] [--size] [--orientation] [--look]
[--accent] [--page-numbers]`.
- `page` and `article` are named-only resources in the top-level help (its 500-token budget).

## Data and persistence

- Stored fields touched: `Tab.opensIn`, `Tab.pages`, `Tab.articles`, `Tab.elements`. No new field, no migration.
- One write per call: `writeChangeset` when the elements changed (its batch writes the whole next tab, pages and
  articles included, and records and relays the element ops), else `upsertTabAtRev`. The tab passes
  `withServerRules` first, as a changeset's does.
- Revision: read `stored.rev`, write at it; on `isTabRevStale` re-read and re-apply once; a second stale →
  `409 tab_busy`.

## Errors and edge cases

| Case                                                          | Handling                                                               |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Diagram tab                                                   | switched, `switched: true`, line "Switched the tab to Illustrate"      |
| Fresh tab whose only page is unchosen and empty               | first `add` / new article takes that page                              |
| `add` article                                                 | `article_by_write`                                                     |
| Size not offered / `fit`                                      | `size_not_offered` with the kind's sizes                               |
| Turn a slide or logo                                          | `no_orientation`                                                       |
| Pattern on a logo page                                        | `pattern_not_offered`                                                  |
| Layout of another kind                                        | `layout_unknown` with the kind's layouts                               |
| Delete the only unit                                          | `last_page`                                                            |
| 101st page                                                    | `page_limit`                                                           |
| Locked page / any locked page of an article                   | `page_locked`                                                          |
| Page place out of range, name not found                       | `page_unknown` with the pages                                          |
| Two articles, none named                                      | `article_ambiguous` with titles                                        |
| `[zone x]` not in the article                                 | `zone_unknown`                                                         |
| Markdown over 400,000 chars / > 5,000 blocks / block > 20,000 | `article_too_large` naming which                                       |
| Empty Markdown on replace                                     | the article keeps one empty paragraph (an article never has no blocks) |
| Tab bytes over `MAX_TAB_BYTES` after the edit                 | `413 tab_too_large`                                                    |
| Revision moved twice                                          | `409 tab_busy`                                                         |
| Relay fails                                                   | logged `[illustrate-agent] relay-missed`, the write stands             |
| No tab named, no Illustrate tab, first tab not empty          | `tab_needed` (verbs), saying how to get one                            |
| An `iconId` that names no icon (any edit operation)           | `invalid_value` "is not an icon", hint: icons like it (`iconsLike`)    |

## Security and trust

- Gate: `requireOwner` then `gateEdit(ctx, id, ownerId, teamId, tabId)`, which refuses read-only tokens and
  tab-scoped grants for other tabs. View links never reach it.
- Every string is length-capped before use: page name `PAGE_NAME_MAX`, flow and page refs 64, layout ids 64,
  Markdown `ARTICLE_MARKDOWN_MAX`. Hex colours `isArticleHex`. Links only http, https, mailto (`isSafeArticleHref`,
  already in the paste reading).
- The room relays without reading; receivers parse with `illustratePagesOf` and `parseArticleOps` as for an editor.
- No new secret, no new binding.

## Performance and limits

- Engine cost per change is linear in elements times log pages: a change that moves pages walks every element once
  and finds its page by halving the row (`rowPageAt` in `withIllustratePages`); a change that moves no page (name,
  lock, paint) skips the walk. Measured: 50 changes (25 moves, 25 renames) on a 99-page tab with 2,000 elements take
  29 to 57 ms on a loaded machine (load average 50), down from 180 to 310 ms with the linear page scan. A test holds
  it at 2,000 ms (CI headroom).
- Markdown parse is a single pass of line regexes with no backtracking across lines; the inline pattern is
  bounded per line. Measured: 400,000 characters (4,654 blocks) read in 77 to 346 ms on a loaded machine (load average 50), most of it the editor's own inline reading (`parseInline`, ~20 µs a paragraph); a test holds it at 1,000 ms. A paragraph past `MAX_ARTICLE_BLOCK_TEXT` is refused before it is read (`tooLong`), never cut.
- `articleToMarkdown` is linear in runs.
- The route does one D1 read and one batch write (two of each on a stale retry), and at most three room calls.
- Room frames: an article's ops ride in frames of 200,000 characters as the editor's (`tabArticleOps`).
- The `pages` view respects the read budget (8,000 tokens by default on the MCP).

## Observability

- `[illustrate-agent] applied` `{ documentId, tabId, kind: 'pages' | 'article', changes, rev, switched }`.
- `[illustrate-agent] refused` `{ documentId, tabId, code, change }`.
- `[illustrate-agent] stale-retry` `{ documentId, tabId }`; `[illustrate-agent] busy`.
- `[illustrate-agent] relay-missed` `{ documentId, tabId, op }`.
- Editor: `[article] grown for an absent writer` `{ tabId, flow, from, to }`.

## Testing

| Spec rule                                       | Test                                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| Request read strictly, each refusal by name     | `packages/edit-operations/src/illustrate/parse.test.ts`                                 |
| Which tab, switch, event storming, locked tab   | `packages/edit-operations/src/illustrate/page-changes.test.ts` "which tab"              |
| Naming a page (id, place, name, order)          | `page-changes.test.ts` "naming a page", `summary.test.ts`                               |
| Each change and each refusal, the fresh tab     | `page-changes.test.ts`                                                                  |
| Pure edits match the editor                     | `packages/document/src/illustrate-edits.test.ts`, the editor's own page-edit tests      |
| Article resolution, new, append, style, limits  | `packages/edit-operations/src/illustrate/article-write.test.ts`                         |
| Front matter, zones, page breaks, escapes, trip | `packages/document/src/article-markdown-io.test.ts`                                     |
| Grow for an absent writer                       | `packages/document/src/article-pages.test.ts`, `room-op-apply.test.ts` (the agent mark) |
| Route gate, write, changeset, relay, refusals   | `apps/api/src/routes/tab-illustrate-route.test.ts`                                      |
| The `pages` view and header                     | `packages/document-views/src/pages.test.ts`, `render-view.test.ts`                      |
| Tools, parity, output schema                    | `apps/mcp/src/illustrate-tools.test.ts`, `verb-parity.test.ts`, `output-schema.test.ts` |
| Which tab (verbs), CLI verbs                    | `packages/agent-verbs/src/verbs/illustrate.test.ts`                                     |
| Icon ids                                        | `packages/edit-operations/src/fields.test.ts`, `packages/icons/src/search.test.ts`      |
| Performance                                     | `page-changes.test.ts` "worst case", `article-markdown-io.test.ts` "worst case"         |

Not unit tested: the route's stale retry and `tab_busy` (they follow the changeset submit's own, tested there).

## Constants and configuration

| Constant               | Value   | Provenance                                                          | Safe range   |
| ---------------------- | ------- | ------------------------------------------------------------------- | ------------ |
| `PAGE_CHANGES_MAX`     | 50      | Matches `change_items` and `change_sheet`                           | 1 to 100     |
| `ARTICLE_MARKDOWN_MAX` | 400,000 | 5,000 blocks of ~80 characters; well inside `MAX_TAB_BYTES` 1.99 MB | 100k to 1.5M |
| `ILLUSTRATE_REF_MAX`   | 64      | `isArticleId`'s cap                                                 | fixed        |
| `PAGE_GRADIENT_ANGLE`  | 160     | The page panel's gradients (moved to packages/document)             | 0 to 359     |

## Defaults ledger

Rows IA1 to IA6 in [DEFAULTS.md](DEFAULTS.md).
