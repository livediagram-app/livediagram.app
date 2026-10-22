# Pages for agents: blueprint

Derived from [Pages for agents](../pages-for-agents.md). Every rule there maps to a module, a
function and a test here; nothing here adds design.

## Domain and naming

| Spec term       | Identifier                                                                                                                                                                                    | Where                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| page change     | `PageChange` (union on `op`: `add`, `set`, `layout`, `move`, `duplicate`, `delete`, `apply_background_to_all`)                                                                                | `packages/api-schema/src/pages.ts`                                            |
| page ref        | `PageRef = string \| number` (id, place, or name)                                                                                                                                             | `packages/api-schema/src/pages.ts`                                            |
| page summary    | `PageSummary` `{ place, id, name, kind, size, orientation, rect, background?, locked?, elements }`                                                                                            | `packages/api-schema/src/pages.ts`                                            |
| refusal         | `PagesRefusal` `{ code: PagesRefusalCode, message, change? }`                                                                                                                                 | `packages/api-schema/src/pages.ts`                                            |
| the engine      | `applyPageChanges(tab, changes, ctx)`                                                                                                                                                         | `packages/edit-operations/src/pages/`                                         |
| pure page edits | `pageAdded`, `pageRenamed`, `pageResized`, `pageTurned`, `pageBackgroundSet`, `pageLockSet`, `pageLaidOut`, `pageMovedTo`, `pageDuplicated`, `pageRemoved`; `pagesSharing`, `pageLockRefuses` | `packages/document/src/pages-edits.ts`                                        |
| layout build    | `buildPageLayout(layout, page)` (moved)                                                                                                                                                       | `packages/templates/src/page-layout-build.ts`                                 |
| page paint      | `withBackgroundPatch`, `sameFill`, `PAGE_GRADIENT_ANGLE` (moved)                                                                                                                              | `packages/document/src/page-paint.ts`                                         |
| summaries       | `pageSummaries`, `describeBackground`                                                                                                                                                         | `packages/api-schema/src/pages-summary.ts`                                    |
| submit          | `submitPages`, `pagesRoomOps`                                                                                                                                                                 | `apps/api/src/changesets/pages.ts`                                            |
| relay           | `relayPages`                                                                                                                                                                                  | `apps/api/src/room-client.ts`                                                 |
| icon check      | `isIconId`, `iconsLike`                                                                                                                                                                       | `packages/icons/src/search.ts`                                                |
| route           | `handleTabPages`                                                                                                                                                                              | `apps/api/src/routes/tab-pages-route.ts`                                      |
| verbs           | `changePages`, `pagesTabOf`                                                                                                                                                                   | `packages/agent-verbs/src/pages/pages-calls.ts`                               |
| MCP tools       | `change_pages` (`mcpChangePages`)                                                                                                                                                             | `packages/agent-verbs/src/mcp/pages-schema.ts`, `apps/mcp/src/pages-tools.ts` |
| CLI verbs       | `page.ls`, `page.set` (`pagesVerbs`)                                                                                                                                                          | `packages/agent-verbs/src/verbs/pages.ts`                                     |
| view            | `pages` in `TAB_VIEW_NAMES`, rendered by `pagesView`                                                                                                                                          | `packages/document-views/src/pages.ts`                                        |

Banned synonyms: "slide deck" for a tab of pages (it is a tab of pages; the deck presents them),
"template" for a layout.

## Behaviour and state

### Moves out of the editor (no behaviour change)

1. `buildPageLayout` now lives in `packages/templates/src/page-layout-build.ts`; the editor's callers import it
   from `@livedesign/templates`.
2. `withBackgroundPatch`, `sameFill` and `PAGE_GRADIENT_ANGLE` now live in
   `packages/document/src/page-paint.ts`; the editor's paint module re-exports them and keeps only what
   draws.
3. The tab transforms inside `apps/live/hooks/editor/page-edits.ts` became pure functions in
   `packages/document/src/pages-edits.ts`. Each takes the tab and answers `{ tab } | { refused: PageEditRefusal }`
   (`PageEditRefusal = 'locked' | 'no_orientation' | 'size_not_offered' | 'pattern_not_offered' | 'page_limit' |
'last_page' | 'unknown_page'`); the hook keeps telemetry, toasts, `onGoTo` and debug
   logs, and calls them inside `commitTab`. The lock rule (`refusedLocked` with `shared`) and `sharing` move with
   them. Existing editor tests stay green unchanged; new unit tests cover each function.

### The engine (`packages/edit-operations/src/pages/`)

`page-changes.ts` `applyPageChanges(tab, changes, { themeId, newId })`:

2. `switched = opensInOf(tab) !== 'pages'`; if so `tab = withEditorModeSwitched(tab, 'pages')`.
3. For each change `i` in order, against the current `tab`:
   - resolve `page` (`resolvePage`: id, then integer place 1..n, then name by `nameKey`) else `page_unknown` listing
     `1 Cover (infographic), 2 (infographic)`;
   - `add`: if the only page is unchosen and empty
     (`offersPageKindChoice`) → `withPageKindChosen`; else if the only page is of `kind`, unnamed and empty → that
     page; else `pageAdded(tab, kind, newId(), device)`; then
     `name`, `size`, `orientation`, `background` through `pageRenamed`, `pageResized`, `pageTurned`,
     `pageBackgroundSet`, `at` through `pageMovedTo`, `layout` through `pageLaidOut`. Line:
     `Added page 3 (infographic, A4) from layout Report Cover: name "Cover".`;
   - `set`: `locked: false` first (so an unlock-and-edit works), then name, size, orientation and background
     through their edits, then `locked: true`. Line: `Set page 2: size A3, background #0f172a`;
   - `layout`: id checked against `layoutCatalogueFor(kind).layouts` else `layout_unknown` naming them; then
     `pageLaidOut(tab, pageId, buildPageLayout(id, laidOutPage))`, exactly as the page panel places it. Line: `Laid out page 1 as Report Cover (replaced 4 elements)`;
   - `move`: `to` clamped to 1..units; `pageMovedTo`. Line: `Moved page 4 to 1`;
   - `duplicate`: `pageDuplicated`. Line: `Duplicated page 2 as page 3`;
   - `apply_background_to_all`: `pageBackgroundSpread` (no ink memory, as `set`); refused `no_other_pages` with
     no other page of the kind. Line: `Gave 34 other infographic pages the background of page 1` plus `; 2 locked kept
their own` when it skipped any;
   - `delete`: a page an earlier `add` in this call took as its blank (the first two `add` branches; kept in
     `tookBlank`, page id to that change's 1-based number) deletes nothing. Line: `Page 1 was the empty first page,
which change 1 made the page it added; nothing deleted.`; otherwise `pageRemoved`; refused `last_page` when one
     unit is left. Line: `Deleted page 2 and 4 elements on it`;
   - a `refused` from a pure edit maps to its code (`unknown_page` → `page_unknown`, `locked` → `page_locked`,
     the rest the same name) and stops: `{ refusal: { code, message, change: i } }`, nothing to write.
4. Answer `{ tab, lines, switched }`; the route adds the summaries (`pageSummaries`).

## Interfaces and contracts

### Route

`POST /api/documents/:id/tabs/:tabId/pages`, JSON body:

```ts
{ pages: PageChange[] }                // 1..50
```

`PageChange` (strict, unknown keys refused `invalid_value`):

```ts
| { op: 'add'; kind: 'infographic' | 'logo' | 'wireframe'; size?: PageSizeId; orientation?: PageOrientation;
    name?: string; background?: PageBackgroundInput; layout?: string; at?: number }
| { op: 'set'; page: PageRef; name?: string; size?: PageSizeId; orientation?: PageOrientation;
    background?: PageBackgroundInput; locked?: boolean }
| { op: 'layout'; page: PageRef; layout: string }
| { op: 'move'; page: PageRef; to: number }
| { op: 'duplicate'; page: PageRef }
| { op: 'delete'; page: PageRef }
| { op: 'apply_background_to_all'; page: PageRef }
PageBackgroundInput = { color?: string; gradient?: [string, string]; angle?: number;
                        pattern?: 'dots' | 'grid' | 'lines' | 'none'; paper?: true }
```

Answer `200`:

```ts
{ tab: { id, rev }, switched: boolean, lines: string[], pages: PageSummary[], changesetId: string | null }
```

Refusals: `400 { error, message, change? }` for every engine code and `invalid_body`, `403` gate, `404` document or
tab, `409 tab_busy`, `413 tab_too_large`.

`PagesRefusalCode`: `invalid_body`, `invalid_value`, `tab_locked`, `tab_kind`, `page_unknown`,
`size_not_offered`, `no_orientation`, `pattern_not_offered`, `no_other_pages`, `layout_unknown`, `page_locked`,
`page_limit`, `last_page`.

### MCP

- `change_pages` `{ documentId, tabId?, changes: PageChange[] (1..50) }`, behaviour `destructive`, output
  `{ documentId, tabId, switched, lines, pages, rev, url }`; a refusal is a tool error, `Change n: …`
  counting from 1.
- Which tab, before the route (`pagesTabOf`): the one named, else the first in Pages mode, else the first
  tab when it is empty, else `tab_needed` saying to name a tab or `add_tab` with `blank-illustration`.
- Every input and output property `.describe()`d; layout ids described by kind in `change_pages`'s `layout`
  description, generated from `layoutCatalogueFor`.
- `read_document` `view` enum gains `pages`.
- The server instructions (`packages/agent-verbs/src/mcp/schema.ts`) gain a paragraph: what Pages tabs hold,
  which page makes what (a poster → an infographic page, a logo → a logo page, a screen → a wireframe page), how a document
  for pages starts (`create_document` with template `blank-illustration`), and that a layout's sample text is
  found in the `pages` view and replaced with `update_document`.

### CLI

- `page ls <doc> [--tab]` → the `pages` view.
- `page set <doc> [--tab] --changes <file|->` (a JSON list, or one change) or flags for one change (`--add infographic
--layout report-cover`, `--page 2 --name Cover`, `--page 2 --delete`, `--move`, `--duplicate`, `--background-to-all`, `--size`,
  `--orientation`).
- `page` is a named-only resource in the top-level help (its 500-token budget).

## Data and persistence

- Stored fields touched: `Tab.opensIn`, `Tab.pages`, `Tab.elements`. No new field, no migration.
- One write per call: `writeChangeset` when the elements changed (its batch writes the whole next tab, pages
  included, and records and relays the element ops), else `upsertTabAtRev`. The tab passes
  `withServerRules` first, as a changeset's does.
- Revision: read `stored.rev`, write at it; on `isTabRevStale` re-read and re-apply once; a second stale →
  `409 tab_busy`.

## Errors and edge cases

| Case                                                          | Handling                                                             |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| Diagram tab                                                   | switched, `switched: true`, line "Switched the tab to Pages"         |
| Fresh tab whose only page is unchosen and empty               | first `add` takes that page                                          |
| Only page already of the kind added, unnamed and empty        | first `add` of that kind takes that page (its fields and layout set) |
| Size not offered / `fit`                                      | `size_not_offered` with the kind's sizes                             |
| Turn a logo page                                              | `no_orientation`                                                     |
| Pattern on a logo page                                        | `pattern_not_offered`                                                |
| `apply_background_to_all` with no other page of the kind      | `no_other_pages`                                                     |
| Layout of another kind                                        | `layout_unknown` with the kind's layouts                             |
| Delete, in the same call, the page an `add` took as its blank | nothing deleted, line says the empty page became the added one       |
| Delete the only unit                                          | `last_page`                                                          |
| 101st page                                                    | `page_limit`                                                         |
| Locked page                                                   | `page_locked`                                                        |
| Page place out of range, name not found                       | `page_unknown` with the pages                                        |
| Tab bytes over `MAX_TAB_BYTES` after the edit                 | `413 tab_too_large`                                                  |
| Revision moved twice                                          | `409 tab_busy`                                                       |
| Relay fails                                                   | logged `[pages-agent] relay-missed`, the write stands                |
| No tab named, no Pages tab, first tab not empty               | `tab_needed` (verbs), saying how to get one                          |
| An `iconId` that names no icon (any edit operation)           | `invalid_value` "is not an icon", hint: icons like it (`iconsLike`)  |

## Security and trust

- Gate: `requireOwner` then `gateEdit(ctx, id, ownerId, teamId, tabId)`, which refuses read-only tokens and
  tab-scoped grants for other tabs. View links never reach it.
- Every string is length-capped before use: page name `PAGE_NAME_MAX`, page refs 64 (`PAGES_REF_MAX`), layout ids 64.
- The room relays without reading; receivers parse with `pagesOf` as for an editor.
- No new secret, no new binding.

## Performance and limits

- Engine cost per change is linear in elements times log pages: a change that moves pages walks every element once
  and finds its page by halving the row (`rowPageAt` in `withPages`); a change that moves no page (name,
  lock, paint) skips the walk. Measured: 50 changes (25 moves, 25 renames) on a 99-page tab with 2,000 elements take
  29 to 57 ms on a loaded machine (load average 50), down from 180 to 310 ms with the linear page scan. A test holds
  it at 2,000 ms (CI headroom).
- The route does one D1 read and one batch write (two of each on a stale retry), and at most three room calls.
- The `pages` view respects the read budget (8,000 tokens by default on the MCP).

## Observability

- `[pages-agent] applied` `{ documentId, tabId, changes, rev, switched }`.
- `[pages-agent] refused` `{ documentId, tabId, code, change }`.
- `[pages-agent] stale-retry` `{ documentId, tabId }`; `[pages-agent] busy`.
- `[pages-agent] relay-missed` `{ documentId, tabId, op }`.

## Testing

| Spec rule                                     | Test                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------- |
| Request read strictly, each refusal by name   | `packages/edit-operations/src/pages/parse.test.ts`                                 |
| Which tab, switch, locked tab                 | `packages/edit-operations/src/pages/page-changes.test.ts` "which tab"              |
| Naming a page (id, place, name, order)        | `page-changes.test.ts` "naming a page", `summary.test.ts`                          |
| Each change and each refusal, the fresh tab   | `page-changes.test.ts`                                                             |
| Pure edits match the editor                   | `packages/document/src/pages-edits.test.ts`, the editor's own page-edit tests      |
| Route gate, write, changeset, relay, refusals | `apps/api/src/routes/tab-pages-route.test.ts`                                      |
| The `pages` view and header                   | `packages/document-views/src/pages.test.ts`, `render-view.test.ts`                 |
| Tools, parity, output schema                  | `apps/mcp/src/pages-tools.test.ts`, `verb-parity.test.ts`, `output-schema.test.ts` |
| Which tab (verbs), CLI verbs                  | `packages/agent-verbs/src/verbs/pages.test.ts`                                     |
| Icon ids                                      | `packages/edit-operations/src/fields.test.ts`, `packages/icons/src/search.test.ts` |
| Performance                                   | `page-changes.test.ts` "worst case"                                                |

Not unit tested: the route's stale retry and `tab_busy` (they follow the changeset submit's own, tested there).

## Constants and configuration

| Constant              | Value | Provenance                                              | Safe range |
| --------------------- | ----- | ------------------------------------------------------- | ---------- |
| `PAGE_CHANGES_MAX`    | 50    | Matches `change_items` and `change_sheet`               | 1 to 100   |
| `PAGES_REF_MAX`       | 64    | The longest page ref or layout id taken                 | fixed      |
| `PAGE_GRADIENT_ANGLE` | 160   | The page panel's gradients (moved to packages/document) | 0 to 359   |

## Defaults ledger

Rows IA1 to IA3 and IA5 in [DEFAULTS.md](DEFAULTS.md).
