# Typing blueprint

How the editor keeps a typed change cheap on a long tab: what renders, what is read again, and how writing that is
not mounted is drawn. Derived from [Article pages](../article-pages.md) "Flowing onto pages".

The readings below were taken in livedocuments, before liveknowledge was forked from it, on a tab of 100 flashcards
(a card was a one-page article, so a "100-card stack" is 100 short articles on one tab; "a flip" was a move between
two of them). liveknowledge has no flashcards. The code the readings measured is the article engine's and is
unchanged here; where a line names a card, read an article.

## Performance and limits

- An article whose writing is not mounted has no `ArticleEditorHandle`: `pageWriting` (exports) and `pageWritingBars` (slide
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
  whole (the kerning between words counted); the measure's `wordByWord` picks which. Table cells (each in the face it is
  drawn in: a header row 650, a bold run 700, else 400) and contents entries (the first line only, the page number's
  width and the leader's start measured too) wrap by `wrapMeasured` as well. Without a measure (node, the API's summaries, the SVG render) every block keeps `wrapEstimated`.
  Measured (#387, a 100-card stack, a heading and a 10 to 60 word body with a bold stretch per card, hyphens and
  number ranges, each line read off a div set as `app/article-pages.css` sets the writing, Playwright Chromium and
  WebKit, the default, serif, modern and friendly styles): lines that differ from the browser's, average glyph 315
  to 340 of 451 to 456 (85 to 92 cards), measured 0 in every style and both engines; measuring the stack 14 to 25 ms.
  Re-measured (Work Tracker 812, 100 cards of 10 to 60 words with hyphens and number ranges, three faces, each line read
  off a div with `white-space: pre-wrap; overflow-wrap: break-word` by a range per character): 0 of 100 cards differ in
  Chromium 156 and WebKit (Playwright), measuring the stack 7 to 10 ms and 4 to 7 ms. Firefox could not be launched on
  the build machine (Playwright's Firefox 157 exits "Could not find profile folder"), so it stays assumed to fit a line
  whole like Blink; re-run the same comparison (`wrapMeasured`'s lines against the div's own) in Firefox
  when one launches.
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
- Measured (#728, the #386 probe: a production `next build` export, Offline, a 100-card stack with two lines a
  card, 390x844 touch at 3x, CPU 4x, 60 keys 120 ms apart then 3 s of settling, five runs each way alternating, on a
  shared machine at a load of 6 to 12): the longest busy stretch, before 27.9 to 29.8 ms (the commit's own render,
  about 18 ms of it React's), after 18.3 to 21.2 ms in four runs and 30.7 ms in one (that run also had three keys
  over 16 ms, the machine's noise). Long tasks over 50 ms: none either way. Components rendered per typing commit:
  431 before (three root renders of about 140), 157 after. A key's own work no longer reads the 100 pages (1.3 ms of
  its 9 ms before), and the 15 to 18 ms garbage collection pauses the profiles showed mid-typing were gone after.
- Chrome skips a typing commit (#828). EditorContext hands its readers a new view-model on every render of the page,
  so every reader rendered on each commit, the chrome among them; the page also rebuilt the header, the tab bar and
  every host element inside SplitViewFrame's render function, so each rendered as a child even without reading the
  context. Now the page publishes each render's view-model to a chrome store after the commit
  (`usePublishEditorChrome`, `app/document/[id]/EditorContext.tsx`, a layout effect), and the chrome reads it a slice
  at a time (`useEditorChrome(select, equal)` over `useStoreSlice`), its handlers reading `useEditorChromeStore().get()`
  when they run:
  - `EditorViewHeader` (memo) and `EditorViewFooter` (`withStableEventProps`) in `editor-view-bars.tsx`: the header
    from slices; the tab bar's `tabs` compared by `sameTabsForBar` (a tab whose only change is its
    `elements` or `articles` is the same tab to the bar).
  - The hosts are made once at module scope in `EditorView.tsx` (`TAB_DIALOGS`, `COLLABORATORS`, `PRESENTATION`,
    `MODALS`, `TOURS`, `START_PANELS`), so the view's render passes them over. `EditorTabDialogs`, `CollaboratorsHost`,
    `EditorModals`, `EditorAnchoredPopovers` and `EditorElementDialogs` read only whether one of theirs is open and
    mount their `Open…` body (which reads EditorContext) only then; `EditorContextMenuHost` reads the menu's mode and
    `isReadOnly`; `EditorStartPanels` reads the tab's id, name, whether it has content and `templateStartShownOf`.
  - The rest of the chrome skips a typing commit too (Work Tracker 907):
    - `CanvasChrome` takes only the canvas props it reads (`CANVAS_CHROME_PROP_KEYS`, `pickCanvasChromeProps`,
      `components/canvas/canvas-chrome-props.ts`; `CanvasChromeProps` is typed from the list, so reading another prop
      fails the typecheck) behind `withStableEventProps`. Its pages view comes without the writing
      (`useChromePagesView`: `articles` left out, the view's actions, `edit` and `arrangement` through
      `useStableObject`), and the writing reaches Contents as a store (`useWritingStore`, a layout effect;
      `usePageContents({ writing })`), so a typing commit renders the Contents list and not the chrome round it. The
      Map took the pages' writing but only shows without pages, so it no longer takes either. The page deck's controls
      (`pageDeckControls` in `useEditorArticles`) call the newest verbs through a ref and change only with the deck,
      the tab and the role.
    - The page sheet's title bar row is its own memoised component (`PageSheetTitleBar.tsx`), apart from the sheet,
      which renders for its page's writing; its stored article style is compared by value
      (`sameArticleValue`), as a typing commit parses the article afresh and the style comes back an equal new object.
    - `KnowledgeToursHost` reads a slice of the chrome store (`useEditorChrome(slice, sameSlice)`,
      `editor-chrome-equal.ts`), its handlers reading `useEditorChromeStore().get()`.
    - `QuickStyleHost` and `EditorFindHost` read their `deps` from the store (`useEditorChromeLatest`), compared by
      `sameDepsButWriting`: the same handlers by name, the same data, the active tab the same but for its writing.
      Find, while open, renders for every change, as its matches read the writing. The hook says `'use no memo'`:
      compiled, the React Compiler kept its first `store.get()` and the Quick Style bar never showed (the
      `quick-style-panel` smoke specs catch it; unit tests run uncompiled).
    - `ModifierHint` is memoised, `LandscapeBarsHandle` sits behind `withStableEventProps`, and the editor's
      `NewVersionPrompt` is made once (`EditorNewVersionPrompt`), asking the store whether edits are unsaved.
  - Still rendering on a typing commit, each reading the document: the canvas (`CanvasView`, its pages and each
    `CanvasPageSheet`, `ArticleFlows`, the element layer) and the Contents list when it shows (its rows read the
    writing), which renders only the row being written in (Work Tracker 945, below).
- Measured (#828, the #728 probe on a production `next build --profile` export, Offline, a 100-card stack of
  three blocks a card, 390x844 touch at 3x, CPU 4x, 60 keys 120 ms apart in bursts of ten, five runs each way
  alternating, 30 typing commits each way, on a shared machine at a load of 6 to 11). Components rendered per typing
  commit (function, class, memo and forwardRef fibers that did work, skipping subtrees React left untouched): 158 to
  162 before, 107 to 111 after. React render time per typing commit (the `actualDuration` of each topmost rendered
  component, summed): median 10.9 ms before (quartiles 8.9 and 11.8), 9.0 ms after (7.9 and 10.6). The rest of the
  time is the page's own hooks (`useEditorState`), `SplitViewFrame`'s render function and the canvas.
- Measured (Work Tracker 907, a dev build, Offline, a 100-card stack of three blocks a card, 30 keys 700 ms apart
  after one warm-up key, components counted as in #828). On a phone (390x844): 105 components per typing commit
  before, every listed chrome component among them (`CanvasChrome` and its 19, the title bar's `PageTitleBar` and
  buttons, both tours, `QuickStyleHost`, `FindHost`, `ModifierHint`, `NewVersionPrompt`, `LandscapeBarsHandle`) in
  30 of 30 commits; 61 after, none of them in any. On a desktop with Contents docked: 1,109 before (its 100 rows,
  about 1,000 components, inside each commit), 61 after; the list now renders in a commit of its own from the writing
  store (about 1,017 components), and the thumbnails' settle render (about 1,006) follows as it did before.
- Measured (Work Tracker 945, jsdom, the shared `ContentsList` alone: a 100-row filmstrip with an Editor's tools and
  each card's speaking time, components whose function ran in the commit, bailed-out subtrees skipped). Its rows are
  memoised (`ContentsRow`, compared by the row's fields), so a typing commit renders the list and the card being
  written in: 2,101 components before, 24 after; a picture's settle the same, 2,101 before, 24 after. In the browser
  that takes the list's own commit (about 1,017 components) and the settle render (about 1,006) to the list and one
  row each. Guarded by `PageContentsList.test.tsx` "ContentsList rows".
