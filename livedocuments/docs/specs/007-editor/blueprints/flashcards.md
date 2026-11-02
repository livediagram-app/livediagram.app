# Flashcards blueprint

Derived from [Flashcards](../flashcards.md). A card is an article page cut down: it reuses the article's writing
machinery (`Page.flow`, `Tab.articles[flow]`, `ArticleEditor`, the page toolbar) and adds the card's own rules in
small modules beside it. Each rule below names its home.

## Domain and naming

| Term                  | Identifier                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| flashcard (page kind) | `PageKind` `'flashcard'`; `isFlashcardPage`, `newFlashcardPage`, `packages/document/src/page.ts`                |
| card size             | `PageSizeId` `'card'` (540 x 900, `landscapeOnly`), `FLASHCARD_PAGE_SIZE_IDS`, `pageSizesFor('flashcard')`      |
| stack                 | `isFlashcardStack(pages)` (the tab's kind is `flashcard`)                                                       |
| a card's writing      | `newFlashcardFlow`, `packages/document/src/article-flow.ts`                                                     |
| speaking time         | `flashcardWordCount`, `flashcardSpeakingSeconds`, `speakingTimeLabel`, `packages/document/src/flashcards.ts`    |
| text only             | `isFlashcardBlock`, `flashcardBlocks` (writing); `guardFlashcards` (`packages/document/src/flashcard-guard.ts`) |
| split                 | `canSplitFlashcardAt`, `withFlashcardSplit`, `FlashcardSplitRefusal`                                            |
| card added            | `withFlashcardAdded`; `pageAdded(tab, 'flashcard', id, flow)`                                                   |
| card in front         | `PagesModeView.cardStage` (`apps/editor/hooks/editor/usePagesMode.ts`), `cardInFrontOf`, `cardStageOf`          |
| the stage             | `flashcardStage(view)`, `apps/editor/lib/flashcard-stack.ts`: the view narrowed to the card in front            |
| the stack behind      | `stackSheets(rect, behind)` (same module); drawn by `FlashcardStack` (`components/canvas/FlashcardStack.tsx`)   |
| flip                  | `pictureCard(page)`, `flipCard(from, to, forward)`, `apps/editor/lib/flashcard-flip.ts`                         |
| footer                | `FlashcardFooter` (`components/canvas/FlashcardStack.tsx`)                                                      |
| too long              | `FlowLayout.overflowFrom` (`ArticleEditor`), `flashcard-overflow-store.ts`, `FlashcardTooLong`                  |
| palette kind          | `PaletteKind` `'flashcard'` (`apps/editor/lib/palette-kind.ts`)                                                 |

## Constants and configuration

| Constant                     | Value     | Where                | Why                                                                        |
| ---------------------------- | --------- | -------------------- | -------------------------------------------------------------------------- |
| card size                    | 900 x 540 | `PAGE_SIZES.card`    | A 5:3 index card; Narrow margins leave 804 x 420 px, a title and ~15 lines |
| `FLASHCARD_WORDS_PER_MINUTE` | 130       | `flashcards.ts`      | Talks run 120 to 150 wpm                                                   |
| `SPEAKING_STEP_S`            | 5         | `flashcards.ts`      | Under a minute, said to the next 5 s (at most "55 sec")                    |
| `CONTINUED_TITLE_MAX`        | 120       | `flashcards.ts`      | A continued card's title stays a title                                     |
| `FLASHCARD_STACK_MAX`        | 6         | `flashcard-stack.ts` | Enough depth to read "many", little enough to stay a card                  |
| `FLASHCARD_STACK_STEP_Y`     | 10        | `flashcard-stack.ts` | Canvas px each card behind sits lower                                      |
| `FLASHCARD_STACK_INSET_X`    | 14        | `flashcard-stack.ts` | Canvas px each card behind is narrower each side                           |
| `FLASHCARD_FLIP_MS`          | 420       | `flashcard-flip.ts`  | Long enough to read as a turn, inside the 500 ms motion budget             |

## Data and persistence

- `Page.kind: 'flashcard'` with `flow` (its own writing id), `size: 'card'`, `orientation: 'landscape'`. Parsing
  (`parsePageFields`) forces the size and orientation and keeps the flow (its id when unreadable).
- `pagesOf` runs `withOwnCardFlows`: a card whose flow another card already holds takes its own id as its flow.
- The writing is an `ArticleFlow` in `Tab.articles[flow]` exactly as an article's; nothing new is stored. Old documents
  have no cards, so nothing migrates. A document with cards opened by an older editor reads them as infographic pages
  (unknown kind) with an unknown size read as A4: shown, not lost.
- `newFlashcardFlow()`: `{ blocks: [title, paragraph], style: { margins: 'narrow' } }`.

## Behaviour and state

### The model (`packages/document`)

- `pageKindOf` answers `'flashcard'`; `pageLabel` says "Flashcard (5:3)" (the size already names the kind).
- `withPageKindChosen(tab, id, 'flashcard', flow)`: the page becomes `newFlashcardPage(id, flow)` keeping its background
  and name, its writing `newFlashcardFlow()`.
- `pageAdded(tab, 'flashcard', id, flow)` → `withFlashcardAdded` (after the last page, carrying the last page's
  background); `page_limit` at `MAX_PAGES`. `pageAddedLike` reaches it through `pageAdded`.
- `withArticlePageCount` returns the tab unchanged for a card's flow: a card never grows or shrinks.
- `pageResized` / `pageTurned` refuse by the existing rules (`pageSizesFor('flashcard')` is `['card']`; `card` is
  `landscapeOnly`).
- `withFlashcardSplit(tab, pageId, fromBlockId, newPageId, newFlow)`: refuses `unknown_page` (no such card),
  `locked`, `page_limit`, `nothing_to_move` (`canSplitFlashcardAt` false: the block is first, or only the title is
  before it). Otherwise the card keeps the blocks before `fromBlockId`; a new card (same background) right after it
  holds a continued Title (when the card's title has words) and the rest, fresh block ids, the card's style.
- `guardFlashcards(prev, next, nextPages)`: a new element whose centre lands on a card is left out; a changed element
  that lands on a card is put back unless it was on a card before. `blocked` when anything was held back.

### The stack (`usePagesMode`, `flashcard-stack.ts`, `flashcard-flip.ts`)

- `usePagesMode` keeps the card asked for (`{ tabId, id }`, state); `cardInFrontOf(pages, wanted)` resolves it to the
  card in front (the first card when it names none of this tab's), and `cardStageOf` memoises
  `view.cardStage: { pages: [card], stack: { index, count, behind } }`, absent off a stack. `frame(page)` on a card
  pictures the card in front (`pictureCard`), sets the target in front and sets the view at once (never a glide); a
  layout effect on the new card in front runs `flipCard`. The landing frame (`frame(..., lands)`) never flips.
  Snapping (`usePageSnap`) hands its target page to `glideTo(frame, pageId)`, so a swipe or a pan let go toward
  another card flips to it.
- `flashcardStage(view)` (called by `Canvas`, memoised on the view, for the world layers only): `pages` is the card
  alone, `rowPages` the whole row and `cardStack` its place. A page slide presenting (`letterbox`) is left as it is.
  The chrome (navigator, Contents, Map) keeps the whole view.
- `CanvasPages` draws `FlashcardStack` (the `stackSheets` under the sheet) and `FlashcardFooter` on a card, and passes
  the + its card. `ArticleFlows` clips to the shown card already (`pagesClipPath(view.pages)`).
- `flipCard`: reduced motion (`prefers-reduced-motion: reduce`, or the editor's own `.reduce-motion`) does nothing.
  Otherwise the picture (copies of the card's sheet `[data-page-id]` and writing `.article-flow[data-article-flow]`,
  their ids, roles and tour anchors stripped, `inert`, `aria-hidden`) is placed in canvas space over the new card in
  front (`[data-flashcard-flip]`, overflow hidden), so it pans and zooms with the view. Forward: it turns
  `rotateX(0 → 78deg)` about its top edge and fades (`FLASHCARD_FLIP_MS`, ease-in-out, perspective 2400 canvas px).
  Back: it stays still under a picture of the target card, which turns `rotateX(78deg → 0)` and fades in. The pictures
  are removed when the animation ends; a new flip finishes the last at once.

### Text only

- `paletteKindForPage('flashcard')` is `'flashcard'`. `ToolbarPalette` docks the page toolbar for `article` and
  `flashcard`, and hides Search for `flashcard`.
- `PageToolbar` reads the docked article's page kind: on a card no Insert, Comment or Assign Action, and More
  Formatting's style entry reads "Card style".
- `ArticleEditor` `card` prop: slash items filtered to `FLASHCARD_SLASH_KINDS` (style, list, quote, code, divider);
  the paste plugin's image and element intake is off (`onInsert` refused), so a paste keeps its text only.
- The commit guard (`useEditorState`) runs `guardFlashcards` after `guardLockedPagesIn` and announces
  "Flashcards hold text only." at most once every 2.5 s (`announceTextOnly`, `lib/flashcard-guard.ts`).
- `ArticleStyleSection` hides Page Numbers for a card.

### Never flows

- `ArticleEditor` with `card`: `pagesNeeded` is reported as 1; `cut = needed > 1`. When cut, `overflowFrom` is the id of
  the first top-level block whose top lies past the card's text foot (else whose box crosses it), measured in the same
  pass. It publishes `{ flow, overflowFrom }` to `flashcard-overflow-store` (null when it fits) and draws
  `FlashcardTooLong` at the card's foot, with **Split Onto a New Card** when `onSplit` is given (an Editor, unlocked).
- `pageEdits.splitCard(pageId)`: reads `overflowFrom` for the card's flow, `withFlashcardSplit`, commits, `onGoTo(new
card)`, tracks `Tab · Changed · FlashcardSplit`. The page panel's action row shows the split button while the card
  is too long, disabled with its reason (`nothing_to_move`, the page limit).

### Footer and Contents

- `FlashcardFooter`: "Card {n} of {count}" and, when `speakingTimeLabel` is not null, a clock glyph and the label,
  bottom right inside the card (right `margin`, bottom `margin / 2 - 8`), 12 px, the page's ink at 55% (dark page) or
  slate-600 at 80%, `aria-hidden`, `data-gif-omit`. Its time reads `flashcardSpeakingSeconds(flow)`, cached per writing
  object.
- `contentsRows`: kind name "Flashcard", the line adds the card's title and its speaking time.

## Interfaces and contracts

- `PageSizeId` gains `'card'` and `PageKind` gains `'flashcard'`: every `Record<PageKind, …>` names it (labels, events,
  tours, help, Apply to All nouns, size tiles).
- Agents: `change_pages` `add` takes `kind: 'flashcard'`; `write_article` on a stack writes a card (a new one when no
  card is named), dropping zones and page breaks (`flashcardBlocks`). Size `card` is listed in the size enum.
- `FlowLayout` gains `overflowFrom?: string | null`.

## Errors and edge cases

| Case                                                | Handling                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Two cards stored with one flow                      | The second takes its own id as its flow (`withOwnCardFlows`)                        |
| The card in front deleted (here or by someone else) | `cardInFront` falls back to the first card; a local delete flips to the page before |
| A card one paragraph too long                       | Split disabled: "One paragraph fills this card: shorten it to split"                |
| Split at the page limit                             | Disabled, tooltip names the limit; `page_limit` refused                             |
| A card locked                                       | No toolbar, no split; the marker shows without its button                           |
| An element on a card from before the rule           | Stays; may move off; never moved back onto one                                      |
| A flip while one runs                               | The running one is finished at once                                                 |
| No DOM for the front card (not mounted yet)         | No flip drawn; the card changes                                                     |

## Security and trust

Flipping and the footer are views. A Participant's writing on a card passes the room's article gate as an article's
does (no zones, no page breaks are new to it); adding or splitting a card is a page edit, an Editor's
(`pageEdits` exists only for an editor). No new trust boundary.

## Performance and limits

- The footer's speaking time is computed once per writing object (a commit, at most every 600 ms while typing), cached
  in a `WeakMap`; only the card in front draws a footer, so a 100-card stack counts one card per commit.
- Contents counts each card's words while its rows rebuild (on the tab resting), O(text).
- Only the card in front and at most 6 stack sheets are drawn; the other cards' writing stays mounted (as articles'
  does) but clipped.
- The flip clones two nodes once per flip and animates `transform` and `opacity` only (compositor).

## Presentation and UX

Copy: "Flashcards", "Flashcard (5:3)", "Add Another Card", "Card 3 of 10", "45 sec", "Too long for this card",
"Split Onto a New Card", "One paragraph fills this card: shorten it to split", "Flashcards hold text only.",
"Card Style", "Duplicate card", "Move card left", "Move card right", "Delete card".

## Accessibility

- The Too long marker is `role="status"`; its button is a real button with a Tooltip and the pointer cursor.
- The footer is `aria-hidden`; the same place and time are in Contents' rows, which a screen reader reads.
- Reduced motion: no flip.

## Web Experience

No new route or first-load code: the flip and the stack are in the canvas chunk; the card templates' previews are
SVG in the existing preview groups.

## Observability

- `[flashcard] flip` (to, forward), `[flashcard] split` (tabId, pageId, moved blocks),
  `[flashcard] held back` (the guard), `[flashcard] split refused` (reason).

## Testing

| Rule                                         | Test                                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| Parse, size, label, kind, own flows          | `packages/document/src/flashcards.test.ts`                  |
| Speaking time and its label                  | `flashcards.test.ts`                                        |
| Split and its refusals                       | `flashcards.test.ts`                                        |
| Text-only guard                              | `packages/document/src/flashcard-guard.test.ts`             |
| First page choice, add, no growth            | `flashcards.test.ts`                                        |
| The stage and the stack sheets               | `apps/editor/lib/flashcard-stack.test.ts`                   |
| Flip respects reduced motion, overlay clears | `apps/editor/lib/flashcard-flip.test.ts`                    |
| Footer, marker, roles                        | `apps/editor/components/canvas/FlashcardStack.test.tsx`     |
| Palette kind and toolbar cut                 | `apps/editor/lib/palette-kind.test.ts`, `PageToolbar` tests |
| Templates build                              | `packages/templates` template tests                         |

## Assets and external resources

The first page's Flashcards miniature and the template previews are inline SVG drawn here (no external asset).

## Defaults ledger

D91 to D94 in [DEFAULTS.md](DEFAULTS.md).
