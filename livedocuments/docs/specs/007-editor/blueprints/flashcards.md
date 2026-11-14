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

| Constant                     | Value     | Where                | Why                                                                           |
| ---------------------------- | --------- | -------------------- | ----------------------------------------------------------------------------- |
| card size                    | 900 x 540 | `PAGE_SIZES.card`    | A 5:3 index card; Narrow margins leave 804 x 420 px, a title and ~15 lines    |
| `FLASHCARD_WORDS_PER_MINUTE` | 130       | `flashcards.ts`      | Talks run 120 to 150 wpm                                                      |
| `SPEAKING_STEP_S`            | 5         | `flashcards.ts`      | Under a minute, said to the next 5 s (at most "55 sec")                       |
| `CONTINUED_TITLE_MAX`        | 120       | `flashcards.ts`      | A continued card's title stays a title                                        |
| `FLASHCARD_STACK_MAX`        | 6         | `flashcard-stack.ts` | Enough depth to read "many", little enough to stay a card                     |
| `FLASHCARD_STACK_STEP_Y`     | 10        | `flashcard-stack.ts` | Px each note card behind sits lower (presenter's straight stack)              |
| `FLASHCARD_STACK_INSET_X`    | 14        | `flashcard-stack.ts` | Px each note card behind is narrower each side (presenter's straight stack)   |
| `FLASHCARD_FAN`              | 6 steps   | `flashcard-stack.ts` | Each depth's turn (degrees) and nudge (canvas px) in the canvas's fan         |
| `FLASHCARD_MOUNT_SPAN`       | 1         | `flashcard-stack.ts` | Cards each side of the card in front whose writing stays mounted; 1 to 3      |
| `FLASHCARD_FLIP_MS`          | 240       | `flashcard-flip.ts`  | A quick lift-away that reads at a glance; the presenter's note cards share it |

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
  `rotateX(0 → 14deg) translateY(0 → -3%) scale(1 → 0.985)` and fades (`FLASHCARD_FLIP_MS`, `cubic-bezier(0.2, 0, 0, 1)`,
  perspective 2400 canvas px). Back: the same picture sinks instead (`rotateX(-10deg) translateY(2%)`) and fades; the
  real card now in front is never pictured, so its writing shows throughout. The pictures
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
- Only the card in front and at most 6 stack sheets are drawn. Only the writing of the cards within
  `FLASHCARD_MOUNT_SPAN` of the card in front is mounted (`cardFlowsToMount`, `flashcard-stack.ts`, read by
  `ArticleFlows`), plus the active article and a pending focus request's, so a flip forward pictures the card
  leaving and a flip back the card arriving, and an editor never unmounts under the caret (its unmount flushes it
  anyway). An unmounted card has no `ArticleEditorHandle`: `pageWriting` (exports) and `pageWritingBars` (slide
  thumbnails, Contents, the Map) fall back to `estimateArticle`'s ops for its page (`estimatedPageOps`,
  `lib/article/article-estimate-cache.ts`, cached per writing object and flow), the bars drawn one per estimated line;
  in the browser the estimate takes a measure (`canvasTextMeasure`, `lib/article/canvas-text-measure.ts`: an
  `OffscreenCanvas` (else a page canvas) 2D context's `measureText` in the block's CSS font, widths kept per font and
  text up to `MEASURE_CACHE_MAX` (20,000), the store and the cache key's `measureGeneration` moved on at each
  `document.fonts` `loadingdone`), and `estimateArticle`'s paragraphs, lists, headings and code wrap by
  `wrapMeasured` (`packages/document/src/article-layout-measured.ts`): breaks at spaces and after a hyphen inside a
  word (not one starting or ending it), a word wider than the line broken at the last character that fits, the
  title's -0.01em tracking counted, each style stretch (bold, italic) measured in its own face, a line fitting while
  its width is within `FIT_SLACK_PX` (0.01) of the room. WebKit (`fitsWordByWord`: `AppleWebKit/` without `Chrome/`
  or `Chromium/`, so every iOS browser) adds a line's words up one by one, Blink and Gecko measure the candidate line
  whole (the kerning between words counted); the measure's `wordByWord` picks which. Tables and contents entries keep
  `wrapEstimated`. Without a measure (node, the API's summaries, the SVG render) every block keeps `wrapEstimated`.
  Measured (#387, a 100-card stack, a heading and a 10 to 60 word body with a bold stretch per card, hyphens and
  number ranges, each line read off a div set as `app/article-pages.css` sets the writing, Playwright Chromium and
  WebKit, the default, serif, modern and friendly styles): lines that differ from the browser's, average glyph 315
  to 340 of 451 to 456 (85 to 92 cards), measured 0 in every style and both engines; measuring the stack 14 to 25 ms.
  Tests: `packages/document/src/article-layout-measured.test.ts`, `apps/editor/lib/article/canvas-text-measure.test.ts`.
  Find's block pages put an unmounted one-page card's blocks on its page.
- Measured (#234, a 100-card stack with two lines a card, 390x844 touch, CPU 4x, the dev build): before, 100
  editors mounted, 9,407 event listeners, opening ran 1,073 ms of long tasks (worst 340 ms) and typing's p95 frame
  was 17.8 ms; after, 2 to 3 editors, 1,354 listeners, opening 521 to 528 ms of long tasks (worst 195 ms) and
  typing's p95 7.6 to 8 ms. Flips and panning held a 16.7 ms frame median both ways.
- Typing settles nothing for the rest of the stack (#386): a card's writing holds no zone, so the article intake
  (`useArticleIntake`, [article-pages blueprint](article-pages.md) "Zones", steps 5 and 6) neither fits zones nor
  ticks after a typing commit (`intakeHasWork`, `lib/article/intake-has-work.ts`). Before, each commit's settle laid
  all 100 pages out once per card (`withZonesFitted` called `layOutPages(pagesOf(tab))` per flow, 10,000 page parses)
  inside a `tickTabs` updater, then rendered the editor a second time: one long task per commit.
- Measured on a production build (#386, a static `next build` export with the same stack, 390x844 touch at 3x, CPU
  4x, 60 keys 120 ms apart then 3 s of settling, three runs each way): long tasks over 50 ms while typing, before
  1 in every run (54, 56 and 54 ms; the profile's longest busy stretch 63 to 65 ms, a third of it the intake's
  updater), after 0 in every run (longest busy stretch 42 ms, the commit's own render). Keys slower than 16 ms: 2 to 5
  of 60 both ways, worst 24 ms. The 120 ms task #1247 saw was this settle on the dev build, where React's development
  checks roughly double it. The rest of #1247's readings, production, before and after alike: 2 editors mounted,
  874 event listeners at rest, opening 377 to 400 ms of long tasks (worst 221 to 231 ms), panning frame median
  16.7 ms (p95 16.7 to 16.8 ms), a flip by swipe 239 to 248 ms (median frame 16.7 ms, p95 33 ms).
- `apps/editor/hooks/editor/useArticleIntake.typing.test.ts` keeps it: a 100-card typing commit ticks nothing, and a
  settle over cards that do hold zones grows with the stack (10 to 100 cards under 30x CPU; the old per-card layout
  read about 60x).
- A typing commit renders the editor once and reads only the card that changed (#728). Before, a commit rendered
  the editor root three times: the commit, then the autosave's `'saving'`, then `'saved'` with its time, though
  nothing draws either any more; `useEditorPersistence` (`app/document/[id]/editor-persistence.ts`) now holds the
  status and the time in refs and raises a failed save's toast as the status is set. Each commit also read all 100
  cards' writing again (`articlesOf`) and every keystroke's lock check read all 100 pages (`articleLocked` through
  `pagesOf`); now `pagesOf` keeps its pages per stored `pages` array (frozen, so a caller cannot change them for the
  next), `articlesOf` keeps each article's reading per stored article object (an unchanged card keeps its object),
  and `hasZoneBlock` and `articleNoteIds` answer per article's `blocks`. A closed context menu reads only its state
  (`EditorContextMenuHost`), not the 150 values its open menu needs. The page's starting tabs are made once.
- Measured (#728, the #386 probe: a production `next build` export, This Browser, a 100-card stack with two lines a
  card, 390x844 touch at 3x, CPU 4x, 60 keys 120 ms apart then 3 s of settling, five runs each way alternating, on a
  shared machine at a load of 6 to 12): the longest busy stretch, before 27.9 to 29.8 ms (the commit's own render,
  about 18 ms of it React's), after 18.3 to 21.2 ms in four runs and 30.7 ms in one (that run also had three keys
  over 16 ms, the machine's noise). Long tasks over 50 ms: none either way. Components rendered per typing commit:
  431 before (three root renders of about 140), 157 after. A key's own work no longer reads the 100 pages (1.3 ms of
  its 9 ms before), and the 15 to 18 ms garbage collection pauses the profiles showed mid-typing were gone after.
- The flip clones two nodes once per flip and animates `transform` and `opacity` only (compositor).

## Presentation and UX

Copy: "Flashcards", "Flashcard (5:3)", "Add Card", "Card 3 of 10", "45 sec", "Too long for this card",
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

| Rule                                          | Test                                                        |
| --------------------------------------------- | ----------------------------------------------------------- |
| Parse, size, label, kind, own flows           | `packages/document/src/flashcards.test.ts`                  |
| Speaking time and its label                   | `flashcards.test.ts`                                        |
| Split and its refusals                        | `flashcards.test.ts`                                        |
| Text-only guard                               | `packages/document/src/flashcard-guard.test.ts`             |
| First page choice, add, no growth             | `flashcards.test.ts`                                        |
| The stage and the stack sheets                | `apps/editor/lib/flashcard-stack.test.ts`                   |
| Flip respects reduced motion, overlay clears  | `apps/editor/lib/flashcard-flip.test.ts`                    |
| Footer, marker, roles                         | `apps/editor/components/canvas/FlashcardStack.test.tsx`     |
| Palette kind and toolbar cut                  | `apps/editor/lib/palette-kind.test.ts`, `PageToolbar` tests |
| Templates build                               | `packages/templates` template tests                         |
| Typing on a stack ticks no settle, linear     | `apps/editor/hooks/editor/useArticleIntake.typing.test.ts`  |
| A save renders nothing                        | `apps/editor/app/document/[id]/editor-persistence.test.tsx` |
| Pages and writing read once per stored object | `packages/document/src/read-caches.test.ts`                 |
| When the intake has work                      | `apps/editor/lib/article/intake-has-work.test.ts`           |
| Zone-less writing fitted at once, one layout  | `packages/document/src/article-intake.test.ts`              |

## Assets and external resources

The first page's Flashcards miniature and the template previews are inline SVG drawn here (no external asset).

## Defaults ledger

D91 to D94 in [DEFAULTS.md](DEFAULTS.md).
