# Find and replace blueprint

Derived from [Find and replace](../find-and-replace.md). A pure engine in `apps/editor/lib/find/` (gather, match,
replace), a store the highlights read, one hook that drives it (`useFindReplace`), the bar, and two highlight
painters: a ProseMirror plugin in the writing and a ring overlay on the canvas. Nothing new is stored or synced.

## Domain and naming

| Term            | Identifier                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Find bar        | `FindBar` (`apps/editor/components/find/FindBar.tsx`), mounted by `FindHost` (`components/find/FindHost.tsx`)                              |
| query, options  | `query: string`, `FindOptions = { matchCase: boolean; wholeWord: boolean }` (`lib/find/find-text.ts`)                                      |
| searched text   | `FindTarget` (`lib/find/find-targets.ts`): `{ key, pageId, text, held, ref }`                                                              |
| where a text is | `FindRef`: `block` (flow, blockId), `field` (element id, `label`/`pageTitle`/`pageSubtitle`/`code`), `cell` (id, r, c), `item` (id, index) |
| match           | `FindMatch = { target: number; start: number; end: number }` (`lib/find/find-matches.ts`)                                                  |
| current match   | `FindView.index` from `useFindReplace` (`apps/editor/hooks/editor/useFindReplace.ts`)                                                      |
| held match      | `FindTarget.held: 'role' \| 'locked' \| null`                                                                                              |
| replace scope   | `EditorCapabilities.replace: ReplaceScope` = `'any' \| 'text' \| false` (`lib/editor-capabilities.ts`)                                     |
| highlights      | `find-highlight-store.ts` (`lib/find/`): `publishFindHighlights`, `getFindHighlights`, `useFindElementMarks`                               |
| writing painter | `findHighlightPlugin(flow)` (`lib/article/article-find-plugin.ts`)                                                                         |
| element painter | `FindHighlightOverlay` (`components/find/FindHighlightOverlay.tsx`)                                                                        |

## Constants and configuration

| Constant           | Value | Where                  | Why                                                                       |
| ------------------ | ----- | ---------------------- | ------------------------------------------------------------------------- |
| `FIND_QUERY_MAX`   | 500   | `find-text.ts`         | A sentence or two; the field's `maxLength`                                |
| `FIND_MATCHES_MAX` | 5000  | `find-matches.ts`      | More than anyone steps through; bounds the highlight work                 |
| `FIND_DEBOUNCE_MS` | 150   | `useFindReplace.ts`    | Under the 200 ms a pause reads as "done typing", over a fast typist's gap |
| `FIND_SEED_MAX`    | 200   | `useFindReplace.ts`    | The longest selection taken as the query on opening                       |
| ring outset        | 4 px  | `FindHighlightOverlay` | As an agent's focus ring, clear of the element's own selection ring       |

## Behaviour and state

### Gathering (`findTargets(tab, pages, { scope, blockPage })`)

- One walk over `pagesOf(tab)` laid out (`pages`, the row): `buildElementIndex(elements)` once, each element placed by
  `rowPageAt(pages, elementAnchorPoint(el, index))` (the rule `pageTexts` uses; both read it from
  `elementsByPage`, `apps/editor/lib/elements-by-page.ts`). An element on no page is skipped.
- Per page in row order: the blocks of `tab.articles[page.flow]` whose page is this one (`blockPage(flow, blockId)`,
  read from the mounted editor's `blocksByPage()`; absent, every block is its flow's first page's), in block order,
  `paragraph` and `list` text = runs joined, `code` = its text; other blocks skipped. Then the page's elements sorted
  by anchor (y, then x), each giving, in order: `label`, `pageTitle`, `pageSubtitle`, `code` (strings, non-empty),
  each cell row by row (`cells`), each checklist item's `text` (`checklistItems`).
- `held`: `'locked'` when `tab.locked`, the element is locked or on a locked layer (`isLayerLocked`), the page is
  locked (`page.locked`), or the article has a locked page (`articleLocked`); else `'role'` when `scope` is `false`,
  or `'text'` and the field is not the element kind's (`participantTextFields(type)`: `cells` for a cell,
  `checklistItems` for an item; a block is always writable); else `null`.
- `key`: `b:<flow>:<blockId>`, `f:<id>:<field>`, `c:<id>:<r>:<c>`, `i:<id>:<index>`, stable across edits.

### Matching (`findInText`, `findMatches`)

- `findInText(text, query, opts, limit)`: Knuth-Morris-Pratt over UTF-16 code units, both sides folded by `foldUnit`
  (unchanged with Match Case; else the unit's `toLowerCase()` when that is one unit, else the unit itself), so a match
  has the query's length and offsets map 1:1 into the text. O(text + query) whatever the input. Whole Word rejects a
  match whose neighbours are word units (`isWordUnit`: one-character test of letters, marks, digits, underscore); a
  rejected start continues the scan, an accepted one resets it past the match (no overlaps).
- `findMatches(targets, query, opts)`: every target in order, stopping at `FIND_MATCHES_MAX` (`capped: true`).
- An empty query, or one longer than `FIND_QUERY_MAX` (trimmed by the field), finds nothing.

### The current match (`useFindReplace`)

- State: `open`, `replaceOpen`, `query`, `by`, `opts`, the committed `search` (query and options as last searched,
  `FIND_DEBOUNCE_MS` after typing stops, Enter searching at once; its `seq`, and `from`, the page in view as it
  began), and `hand`, the match in hand by `key`, `start` and the search's `seq`. `index` is derived from them in
  render (`useMemo`), never set from an effect.
- Recomputed in two steps (`useMemo`): the targets when the tab changes (`activeTab` identity, the pages, the scope),
  the matches when the targets or `search` change, so typing re-runs matching alone.
- On a new `search` (`search.seq` bumped: the query or options searched, or the bar opened): `index` = the first match whose page is `search.from` (`pageInView` as it began) or after it in row
  order, else 0, and an effect `goTo`s it once per `seq`. Once a step or a Replace sets `hand`, and on a tab change: the match with the same `key` and `start`, else the first
  after that place, else wrap to 0.
- `step(±1)`: `(index ± 1) mod n`, then `goTo`.
- `goTo(match)`: the match's canvas rect, for a block `handle.rangeRect(blockId, start, end)` (null when no editor is
  mounted), for an element `elementBounds`. Its page (`rowPageAt` of the rect's centre, else the target's page): when it
  is not the page in view, `pagesMode.focusPage(page)` (frames it; turns a flashcard); else `scrollIntoView(rect)`.
- Shortcuts: one `keydown` listener on `window` while the document is open. Cmd/Ctrl+F (no Alt) when no modal is open
  (`anyModalOpen`), nothing presents, not an embed, and the target is not a typing target (`isTypingTarget`) or is
  inside the writing (`.article-flow`) or the bar itself: `preventDefault`, open (focus and select the field, seeded
  from a writing selection of one line up to `FIND_SEED_MAX`). Cmd/Ctrl+Shift+H, same conditions: open with
  `replaceOpen = can.replace !== false`. Every other case is left to the browser.
- The search panel's `find` and `find-replace` commands (`lib/editor-commands.ts`, view-safe; `find-replace` only
  with `CommandContext.canReplace`) call `FindView.openBar(withReplace)`, the chords' own open.
- Close: `open = false`, highlights cleared, focus to the canvas (`canvasMainRef`). Query, options and `replaceOpen`
  are kept in the hook's state for the next opening.

### Replacing (`replaceInTab(tab, targets, matches, by, refit)`)

- Pure: groups the matches by target; skips held targets; for each changed target writes the new text through its
  ref: a block's runs by `replaceInRuns` (each range's new text takes the attributes of the run its start falls in;
  `normaliseRuns`), a code block's text; an element field (`label` with `richText` also rewritten by `replaceInRuns`
  over `TextRun`s and `normalizeRuns`, keeping `label === runsPlainText(richText)`), a cell, an item. `refit(el)` is
  applied to every changed element (the hook passes the text-hug refit: `hugsText` → `hugTextSize`). Answers
  `{ tab, count, held }`; the same tab object when nothing changed.
- Replace: `flushWriting(tab)` (every mounted handle's `flush`), then the handler decides from the tab it sees
  (`replaceOneIn(seen, key, match)`: the match with the same key and start, only when the query is still found
  there) and commits `t => t === seen ? out.tab : replaceOneIn(t, ...)` (worked out again on a tab changed since, as
  by the flush), so its toast, telemetry and next match never read a value the updater writes
  (`commit-updater-flags.test.ts`); then `hand` moves past the new words.
- Replace All: `flushWriting(tab)`, then `replaceAllIn(seen)` (every match found again from the tab, uncapped) and one
  `commitActiveTab` the same way: one history step. A Participant's commit passes `participant.guardCommit`
  (`participantTabChange`), which every replaceable change satisfies by construction.
- Toast: `Replaced N matches.` (`1 match`), or `Replaced N matches. M matches in text you can't edit were left as they
are.` when any held (`1 match ... was left as it is.`).

### Highlights (`find-highlight-store.ts`)

- `publishFindHighlights({ flows, elements })` after every recompute and step: `flows: Map<flow,
{ blockId, from, to, mark }[]>`, `elements: Map<id, mark>` where `mark` is `'match' | 'current' | 'held'`
  (`'held'` only while the Replace row is open; an element takes its strongest mark). `clearFindHighlights()` on close.
- `findHighlightPlugin(flow)`: plugin state is a `DecorationSet`; `init` and a transaction carrying its meta rebuild it
  from the store (block offsets by one `doc.forEach`; positions `offset + 1 + from`, skipped past the node's content);
  any other doc change maps it. Its `view()` subscribes to the store and dispatches the meta (`addToHistory: false`).
  Classes `find-match`, `find-match-current`, `find-match-held` (`app/article-pages.css`).
- `FindHighlightOverlay` (canvas space, in `CanvasElementsLayer` beside the agent focus rings): reads the element marks
  through `useSyncExternalStore`, draws a ring per marked element (`elementBounds`).
- `ArticleEditorHandle.rangeRect(blockId, from, to)`: the canvas rect from `coordsAtPos` of both ends (the first
  line's when they fall on two lines).

## Interfaces and contracts

- `findInText(text: string, query: string, opts: FindOptions, limit?: number): number[]` (match starts).
- `findTargets(tab: Tab, pages: readonly LaidOutPage[], o: { scope: ReplaceScope; blockPage?: (flow: string, blockId: string) => string | undefined }): FindTarget[]`.
- `findMatches(targets, query, opts): { matches: FindMatch[]; capped: boolean }`.
- `replaceInTab(tab, targets, matches, by, refit?): { tab: Tab; count: number; held: number }`.
- `replaceInRuns<R extends { text: string }>(runs: readonly R[], ranges: readonly [number, number][], by: string): R[]`
  (ranges sorted, non-overlapping, inside the text; the caller normalises).

## Errors and edge cases

| Case                                       | Handling                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| Query longer than 500                      | The field's `maxLength` stops it                                                        |
| Tab changes under the bar                  | Searched again; current kept by key and start, else the next                            |
| Replace on a match edited away since       | Not found again in the update: nothing changes, the bar searches again                  |
| A held current match                       | Replace disabled with the reason; Replace All passes it                                 |
| Participant's change refused by its guard  | The guard's notice shows; nothing lands (never expected: held targets are skipped)      |
| Article editor not mounted (a card behind) | Its blocks are on its first page; `goTo` frames that page                               |
| Writing typed but not committed            | Flushed before any replace, so it is searched and never lost                            |
| Replace With empty                         | Deletes the matches; an emptied text box stays (no element is removed)                  |
| More than 5,000 matches                    | Count "5,000+", Replace All still swaps every replaceable match (found again, uncapped) |

## Security and trust

- No query reaches a `RegExp`; matching is a hand scan. The replacement is plain text set into text fields: never
  HTML, never a link (runs keep their existing `href`).
- The server rule is unchanged: a Participant's replace arrives as element text patches and article writing, applied by
  `applyParticipantOp` and `applyParticipantArticleOps`; a Viewer's session sends no edit.

## Performance and limits

- Gather: one pass over blocks and elements, O(total text). Match: O(total text + query) per search. Both run only
  while the bar is open, 150 ms after typing stops. Measured in `find-performance.test.ts`: a 100-page article (30
  paragraphs and 10 stickies a page, about 300,000 characters): gather plus search 38 ms CPU cold, 2 to 3 ms gather
  and 4 to 13 ms search warm, a whole-word miss 7 ms, Replace All of 4,000 matches 15 ms (budgets 80, 40 and 120 ms
  through `cpuBudgetMs`); the worst case (`'a'.repeat(200_000)` against `'a'.repeat(499) + 'b'`) under 60 ms.
- `blocksByPage` is read once per recompute per mounted article (one layout read of each block).
- Decorations rebuilt only on a store change; mapped otherwise.

## Presentation and UX

- The bar's look and copy are the spec's ("The bar"). `TOOLBAR_CARD` surface, `TOOLBAR_CONTROL_REST` /
  `TOOLBAR_CONTROL_PRESSED` controls (36 px, 44 px on touch), `TOOLBAR_DIVIDER`; the shared `Tooltip` and `Button`.
- `FindHost` places it `fixed` over the canvas column (its rect read through a `ResizeObserver`), `top` the column's
  top plus `toolbarTopClearancePx(1)`. Desktop: 16 px from the column's right, `min(420px, 100vw - 32px)` wide.
  Phone: 8 px from each side. Lazy-loaded on first open; the error area is the search panel's (`Search`).

## Accessibility

- `role="search"`, `aria-label="Find in Tab"`; the count `aria-live="polite"`; toggles `aria-pressed`; the chevron
  `aria-expanded` and `aria-controls` the Replace row; every icon button has an `aria-label` and a Tooltip.
- Highlights are colour plus shape (ring dashed vs solid, outline on the current tint); hidden from assistive
  technology (the count speaks).
- Motion: none (the view's glide already honours reduced motion).

## Observability

- `debugLog('[find] searched', { targets, matches })`, `[find] replaced` (`count`, `held`).

## Testing

| Rule                                                                    | Test                                                             |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Case, whole word, no overlaps, linear worst case                        | `lib/find/find-text.test.ts`                                     |
| Order, fields searched, held by lock and role                           | `lib/find/find-targets.test.ts`                                  |
| Replace keeps formatting, label and richText agree, one tab             | `lib/find/find-replace.test.ts`                                  |
| Roles: Editor anything, Participant text (guard passes), Viewer nothing | `lib/find/find-roles.test.ts`, `lib/editor-capabilities.test.ts` |
| 100-page article budget                                                 | `lib/find/find-performance.test.ts`                              |
| Bar: count, steps, toggles, Replace row by role, Escape                 | `components/find/FindBar.test.tsx`                               |
| Writing highlights                                                      | `lib/article/article-find-plugin.test.ts`                        |
| Cmd+F where the browser keeps it                                        | `hooks/editor/find-shortcut.test.ts`                             |
| Hook end to end: debounce, steps, Replace, Replace All, each role       | `hooks/editor/useFindReplace.test.tsx`                           |
| Shortcut list                                                           | `components/dialogs/shortcut-sections.test.ts`                   |

## Defaults ledger

See `DEFAULTS.md` D95 to D98.
