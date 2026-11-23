# Page surface blueprint

Derived from [The page surface](../page-surface.md). Each section says what is built; "Not built" at the foot is
the work left, written so it can be picked up cold, and says what was looked at in a browser.

## The choice: keep the canvas engine, lock it, and scroll it natively

Two ways were open. The engine was read first (`ArticleFlows.tsx`, `article-measure.ts`, `article-view-mount.ts`,
`useArticles`, the zone and margin-note code in `packages/document`, `Canvas.tsx`, `CanvasChrome.tsx`).

- **(b) The writing in normal document flow, outside the canvas, zones drawn by the element engine inside their own
  boxes.** This is what the design means. It was not chosen, because the writing and what is placed in it share one
  coordinate space today and nothing in the engine can draw without it: a zone's elements (pictures, charts,
  drawings, embeds) and every margin note are canvas elements stored at canvas coordinates; the layout pass reads the
  DOM boxes of the zones and notes and the writer of a change moves those elements to them, as a stored write; the
  selection grips, the zone bar, the drop caret, live carets, the element views, drag, resize, snapping and the hit
  tests all convert through the canvas world's transform. Moving the writing out means giving every zone a local
  coordinate space and a second element surface, and re-deriving each of those conversions. That is the rewrite of
  the zone engine, not a change of surface, and it could not be finished properly in one change.
- **(a) Keep the canvas engine underneath and lock it.** Chosen. The view is fixed (the column centred, 100%, no
  pan), and the canvas world is laid inside a real scroll container, so the wheel, the scrollbar, the keys, the
  browser's find, touch scrolling and the browser's own zoom are native. Nothing of the engine's geometry changes:
  it converts points through the world element's own box, which moves with the scroll.

**What (a) cost:** one viewport store with the shared store's shape (`page-viewport-store.ts`), one pure function for
the lock (`page-lock.ts`), a scroll container in `Canvas.tsx`, a sheet that paints nothing
(`PageSurfaceSheet.tsx`), and closing the engine's own ways of moving the view (wheel, pinch, double-tap, the hand
tool, the zoom chords, Fit).

**What (a) gave up, against (b):**

- **A narrow window reflows through a view lens, not a second layout engine.** The page is 856 canvas px wide and
  what is placed in it is stored against that width. A window too narrow for the column draws the page through a
  per-browser lens ("The narrow view") that narrows the page, shows its zones' elements fitted to the column, and
  lowers every change back to the stored page; the engine itself sees one coherent, narrower page. Option (b)'s
  zone-local spaces were not needed for this.
- **The canvas engine still loads with every page**, not only with pages that have a zone. First-load JS is
  unchanged by this choice. Loading it on demand needs (b) as well.
- **Screen readers** read the writing as before (one contenteditable in the canvas's `main`); the document outline
  is no better than the fork's.

## The lock (built)

`apps/editor/lib/page-surface/page-lock.ts`, `components/canvas/usePageSurface.ts`.

- `computePageLock({ width, height, sides, page, margin, phone })` answers the one view a page is shown at. The
  column is the page less its side margins (`856 - 2 * 48 = 760` px: an article's margins default to Narrow,
  `resolveArticleStyle`), centred in the room the side chrome leaves, and never scaled: the zoom is always 1
  (owner 2026-11-21, "render normally without zoom like a news webpage"). A column wider than the room less its side
  room (only for a moment, before the narrow view has narrowed the page) starts at the side room, its overflow
  clipped, never scrolled sideways. The side room is 48 px, 20 px on a phone (`PAGE_SIDE_ROOM`,
  `PAGE_SIDE_ROOM_PHONE`). The page's top stands `PAGE_TOP_ROOM` (24 px) under the top of what scrolls, which itself
  starts under the top row.
- `roomColumnOf(input)` answers the widest column the window allows (the room less twice the side room, whole px),
  which `usePageSurface` writes to the narrow view's store on every relock ("The narrow view").
- The offset is solved for the canvas world's transform, `scale(z) translate(o)` about the surface's centre, so a
  canvas point `p` stands at `z * (p + o) + (size / 2) * (1 - z)`.
- `usePageSurface` (called by `Canvas`) sets the lock in a layout effect and again from a `ResizeObserver` on the
  canvas, on the scroll container and on the side chrome (`[data-contents-sidebar]`, `[data-page-rail="docked"]`),
  and from a `MutationObserver` on the canvas's own children (the side chrome arriving or leaving). It measures the
  scroll container's client box, which is what the world is laid in. **It never runs on a scroll or a keystroke.**
- The stored page is 856 px wide (`CONTINUOUS_PAGE_WIDTH`), so the column is the spec's 760 px wherever the room
  holds it, and the room's own width where it does not (the narrow view).
- **The world's box.** The canvas world is drawn `scale(z) translate(o)` about its own centre, and a transformed
  box is something a scroll container scrolls to. So the world is `WORLD_HEIGHT_CSS` tall (the container less
  `PAGE_TOP_ROOM`), the lock is solved for that height (`worldHeight`), and a continuous page's top stands on the
  canvas's axis (`layOutPages`: `y = rowAnchor.y`, not half a least-height above it). The box's foot is then at
  `z * h + PAGE_TOP_ROOM` at most, never past the container's foot, and a short page does not scroll.
- **The free height.** `relock` also writes `--page-free-height` on the scroll container (`pageFreeHeight`: the
  container's height less `PAGE_TOP_ROOM` and `PAGE_FOOT_ROOM`, over the zoom). `ArticleFlows`' paper, the layer
  that takes a press on the page's blank ground, is `max(stored height, that)` tall on a continuous page.
  Nothing reads it back: the layout pass measures the foot of the last block.

## The store (built)

`apps/editor/lib/page-surface/page-viewport-store.ts`, made by `hooks/canvas/useEditorViewport.ts` in place of the
shared `createViewportStore`.

| Call                     | What it does                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `get()`                  | The view as it stands on screen: the lock, its `offset.y` less `scrollTop / zoom`                       |
| `lock()`                 | The fixed view; `subscribeLock` fires only when it changes                                              |
| `lockTo(view)`           | Sets the lock; the same lock again tells nobody                                                         |
| `setZoom`                | Nothing: the browser's zoom is the page's                                                               |
| `setOffset`, `setView`   | The vertical part becomes `scrollTop = (lock.y - y) * zoom`; the sideways part and the zoom are dropped |
| `attach(el)`, `scroller` | The scroll container (`[data-page-scroller]`), one passive scroll listener                              |
| `followsScroll()`        | Whether an element is selected (the selection store, read when asked)                                   |

- So everything of the engine that moved the view keeps working as a scroll: a caret revealed
  (`scrollIntoView`, `revealCaret`), a search result opened at its passage (`goToBlock`), a find match, a heading
  chosen in On This Page, a page framed as it opens (which lands on its top).
- **A scroll tells no reader** unless `followsScroll()`: then the view's subscribers are told once a frame, which
  only the multi-selection toolbar and the draw guides read. `Canvas` subscribes to the lock alone, so it never
  renders for a scroll.
- `pageViewportOf(store)` answers the page store behind a `ViewportStore`, or null for the shared one (a test) or none.
- **No rest's snap.** Pages mode's snap (`usePageSnap`, which glides the view onto a page once a press lets go or
  the view rests) is off on the page store (`usePagesMode`: `on: !pageViewportOf(viewport)`). The store's view moves
  down the page with the scroll, so a snap framed the page's top and scrolled the reader back up at the next press,
  just after On This Page or a found passage scrolled to what they picked (WI-1372).

## The scroll container (built)

`Canvas.tsx`: `<div data-page-scroller>` inside the canvas's `main`, `absolute inset-0`, `overflow-y: auto`,
`overflow-x: hidden` (a phone too: nothing on a page scrolls sideways), a stable scrollbar gutter, holding the world element. The chrome stays in `main`, outside what
scrolls. `main` and the world no longer set `touch-action: none`, so a finger scrolls natively and a pinch is the
browser's.

- **Extent:** the page's box (`PageSurfaceSheet`, at the page's stored height) plus `PAGE_FOOT_ROOM` (96 px), and
  the writing itself where it is taller than the stored height in this browser.
- **Beside the docked rail:** `[data-canvas-root]:has(> [data-page-rail='docked']) > [data-page-scroller]` ends
  280 px short of the right edge (`globals.css`), so the scrollbar is never under the rail and the rail never over
  the writing. The rail docks only where the page keeps its full width beside it: `pageRailDockWidth(treeWidth)` is
  `max(1280, tree + 280 + 856)`, which is 1,400 px with the page tree open and 1,280 px with its rail.
- **Keys:** inside the writing the browser moves the caret and scrolls it into view. With the focus on the page
  itself (the canvas or the body) `pageScrollOf` (`page-keys.ts`) scrolls on Page Up, Page Down, Space, Home, End and
  the up and down arrows; never while an element is selected, whose keys are the engine's.

## What is painted (built)

- `PageSurfaceSheet` (`components/page-surface/`) stands where the fork's `CanvasPages` stood for a continuous
  page: the page's box with `data-page`, `data-page-id` and `data-page-kind` (the engine finds the page it is on by
  them), no background, border or shadow. It is `z-[1]` and `pointer-events-none`, over the writing's paper, which
  takes a press anywhere on the page: without that the breadcrumb in the top margin could not be pressed at any
  width (found in a browser, 2026-11-20). It draws the breadcrumb in the page's top margin, lined up with the column
  and ending 10 px above the Title, and the room under the foot. A phone and zen draw no breadcrumb.
- The ground is `resolveViewBackdrop` (`lib/view-backdrop.ts`): white in the light theme, slate-900 in the dark
  one, no pattern, whatever the tab stores.
- The writing is not cut off at the page's stored height (`pagesClipPath` answers `none` for continuous pages).
- The Title is 40 px at the Medium size, bold, `-0.02em` (`article-pages.css`).

## What is closed (built)

| Door                               | How                                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| Wheel pan, wheel zoom, touch pinch | `useCanvasPinchZoom` is not called                                                      |
| Double-tap zoom                    | `useDoubleTapZoom`, `useSmallElementDoubleTap` are not called                           |
| Ctrl/Cmd with +, -, 0              | `runModShortcut` leaves them to the browser                                             |
| Fit to Screen, Shift+1             | the command and the key are removed                                                     |
| The zoom cluster                   | `ZenControl` stands in its place: zen's way out, and a Viewer's or Participant's way in |
| The hand tool                      | `useCanvasTool` reads `pan` as Select, on a phone too; H, the command and the menu row  |
| A finger panning the page          | `ArticleFlows` hands `useTouchPagePan` no pan; the phone's frame-on-focus is removed    |
| The minimap                        | already unreachable: it draws only on a tab without pages                               |
| The off-screen content hint        | `Canvas` always answers false                                                           |
| Held Space as a pan                | `useCanvasPanAndMarquee({ spacePan })`: false outside a drawing zone being edited       |
| The middle button's drag           | `middleMousePan` is the drawing zone's alone; `Canvas` drops any other pan              |
| The marquee on bare ground         | `Canvas` `pressGround`: a press deselects and starts no marquee                         |
| The ground's crosshair cursor      | `cursor-default` on the world outside a drawing zone being edited                       |
| Letters that add shapes            | `useEditorKeyboardShortcuts`: the element keys return unless `drawingZoneEditing()`     |
| Select, Laser, Spotlight           | `useCanvasTool` reads every tool but Format as Select; no key, command or dropdown      |

## The footer and the top row (built)

| Piece                                  | File                                                       |
| -------------------------------------- | ---------------------------------------------------------- |
| the three view tabs                    | `components/chrome/KnowledgeViewTabs.tsx`                  |
| the footer                             | `components/chrome/BottomBar.tsx`, `FooterMore.tsx`        |
| the row's shell                        | `components/chrome/KnowledgeTopRow.tsx`                    |
| which row holds Share and the account  | `lib/page-surface/top-row-slot.ts`                         |
| Share, Make a Copy, the account button | `components/chrome/TopRowActions.tsx` (`EditorViewHeader`) |
| whether the page's row is drawn        | `components/chrome/useTopRowShown.ts`                      |
| the fixed tab's shape                  | `packages/workbench` `tab-shape.ts` (`fixedTabShapeClass`) |

- **The tabs** are a `nav` named "Knowledgebase Views" at the footer's left, drawn with the shared tab shape (the
  open tab a card joined to the bar's foot, the others quiet with the inset wash on hover): each a `HoverCard`
  (name and one line) around a link to the view's address with its icon, `aria-current="page"` on the showing one,
  the tab's own focus ring (`data-tab-key`). A plain left press moves in place (`showKnowledgeView`, a history
  entry) and sends `UI·Opened·PagesView`, `AskView` or `InsightsView`; a press with a modifier is the link's.
  No button, no drag, no menu. Not offered (`useKnowledgeViewsOffered`), the `nav` is not drawn.
- **The footer** (`BottomBar`) is a child of the editor's column under the canvas, 48 px and the bottom safe inset:
  the page's scroll container ends above it. Tabs, a spacer, then `ChromeControls`. On a phone (`phone`, the
  editor's `isMobileViewport`) the tabs share the row at 44 px with their short names (`KNOWLEDGE_VIEWS[].short`;
  the link keeps its full name as `aria-label`), `ChromeControls parts="bell"` follows, and `FooterMore` holds
  `ChromeControls parts="rest"`: a button with `aria-expanded` and a `group` named More that opens above it, kept
  mounted while closed (`hidden`), closed by Escape (the focus back on the button) or a press outside.
- **The top row** is `KnowledgeTopRow`: `--knowledge-top-row` tall (`globals.css`: 3rem, 3.5rem under the `phone`
  query), white (`slate-900` dark) with a hairline under it, `leading`, its children, `trailing`, then the slot
  (`data-top-row-actions`, also `data-corner-actions` so the shared account control is redrawn as a button by
  `corner-actions.css`). It offers its slot to `top-row-slot` with a rank: `page` (the canvas chrome's row) or
  `view` (Ask's and Insights' header), and `view` outranks `page`.
- **Share and the account button** are drawn once, by `EditorViewHeader`, as `TopRowActions`: a portal into
  `useTopRowSlot()`. So the account's menu and the Share legend are one instance whichever view shows, and nothing
  is drawn while no row is (zen, an embed).
- **On Pages** `CanvasChrome` draws the row (`useTopRowShown`: the app's chrome, not an embed; not in zen or the
  welcome flow) absolutely along the canvas's top, from the page tree's right edge to the window's, at `--z-panel`.
  Its children are `PageFormattingBar` for an Editor on a desktop; its `trailing` is the Page Info button where the
  rail is not docked (`usePageRailChrome().rowButton`), whose card opens under it; its `leading`, where the menu
  box is not joined to an open page tree (a phone, the tree's rail), is the menu button inline and a phone's Pages
  button. `[data-canvas-root]:has(> [data-knowledge-top-row]) > [data-page-scroller]` starts the scroll container
  under the row, the docked rail and the tree's rail start at the row's foot, and the top corner stacks and the
  top-centre stack start at 68 px.
- **On Ask and Insights** `KnowledgeViewHeader` is the same row: the view's name (`h1`), its one line from
  `lg` up, its buttons, a divider, the slot. The frame ends at the footer's top (measured, `[data-editor-tabbar]`),
  and the footer is the one column child it leaves live.
- **A phone while writing:** the page toolbar's own bar is fixed along the top (`usePageToolbarPlacement`) and sets
  `data-article-toolbar-top` on the root; `globals.css` hides the page row's children under that attribute, so the
  bar has the row to itself. The bar is drawn while the writing has the caret (`ActiveArticle.focused`), or while
  one of its own menus is open, since a menu's field (the link) takes the caret too. Once the writing lets go
  (`useShownArticle`'s `letGo`: the worked-on article, no longer focused) with no menu open, `PageToolbar` draws
  nothing, the attribute goes, and the menu, Pages, Page Info, Share and account buttons return. The article stays
  the worked-on one (a desktop ends it only on a press off its pages, `useOffPagePressClears`), so a tap back in the
  writing brings the bar straight back. On a phone there is nowhere off the page to press, which is why the caret,
  not the active article, decides. Tests: `page-toolbar-presence.test.tsx` (`letGo`), `e2e/phone.spec.ts` (the bar
  has the row while writing, the keyboard put away gives Pages and Share back).

Tests: `KnowledgeViewTabs.test.tsx` (the links, `aria-current`, the press, the history entry, every role, each
case they are not offered in, the footer's order, a phone's More), `KnowledgeTopRow.test.tsx` (the row's order,
the slot's rank, nothing with no row, Make a Copy), `KnowledgeViewHost.test.tsx` (the frame, the live footer).

## The formatting bar (built)

`components/page-surface/PageFormattingBar.tsx`, the left of the page's top row for an Editor on a desktop.

- **In the top row**, not over the writing: the scroll container starts under the row, the page keeps
  `PAGE_TOP_ROOM` (24 px) above itself, and a caret the browser scrolls into view stops 24 px under the top
  (`scrollMargin` on the writing's view, `article-view-mount.ts`).
- **Its controls are the page toolbar's own.** The bar holds the slot the fork's strip held
  (`lib/article/article-dock.ts`), and `PageToolbar` renders into it: block style, Bold, Italic, Underline, Colour,
  Link, Lists, Alignment, More Formatting, Insert, Table (while the caret is in one), Comment, Assign Action. Then
  the bar's own Undo and Redo. Each has a hover card with its name and one line (`Button`'s `description`,
  `page-toolbar-menus.tsx`), a pointer cursor and a focus ring.
- **A drawing's tools** (`components/palette/ToolbarPalette.tsx`, `lib/page-surface/drawing-zone-store.ts`).
  `PageFormattingBar` takes them as `drawing`: the page toolbar's slot stays mounted and `hidden` (so the toolbar
  never falls back to its floating card), the strip stands in its place, Undo and Redo stay. The strip is the
  category bar alone over the palette's Design kind, filtered to `DRAWING_CATEGORIES` (Shapes, Write, Concepts,
  Icons): no Selection mode dropdown, no Library, no card of its own, in the row's flow.
- **When they show:** `drawingZoneEditing` or a shape still to be drawn (`pendingDraw`). `ArticleFlows` says a
  drawing is edited while its zone bar is for a drawing zone, which follows the pointer and the selection and so
  lets go the moment the pointer leaves for the tools. The store therefore holds: after the writing says the edit
  ended, it stays edited until the next `pointerdown` outside `[data-toolbar-palette]`, or `keydown` where a key
  types (the writing, a field), and ends at once when the writing's "ended" comes within `ELSEWHERE_ANSWER_MS`
  (400 ms) of such a press or key. The page closing resets it.
- **Undo and Redo** left the bottom-right cluster for an Editor on a desktop, while a drawing is edited too; a
  phone and a Participant keep them there.
- **A phone** has no bar here. Its writing bar is the page toolbar's own, fixed along the top of the screen while
  the caret is in the writing (`usePageToolbarPlacement`); the top row's own buttons step aside for it ("The footer
  and the top row").
- **Narrow:** where the row has less room than the controls need (about 1,024 px with the tree open) the slot
  scrolls sideways, and each edge with more past it fades into the row's ground and holds a round chevron that
  pages by 70% of the row (**More Formatting Controls** at the right, **Earlier Formatting Controls** at the left),
  as the tab strip's scroll buttons do. `useScrollEdges` (`components/page-surface/`) reads the slot's scroll box
  once a frame after a scroll, and when the slot or what it holds resizes or is swapped; never on a keystroke. A
  chevron with nothing past it is out of the tab order and hidden from assistive technology.
- **Renders:** the bar's props are the history's two flags, which a keystroke does not change; the page toolbar inside it renders on a selection change, as it did in the strip.

## The slash menu (built)

| Piece                                       | File (under `apps/editor`)                                           |
| ------------------------------------------- | -------------------------------------------------------------------- |
| The entries, their groups, lines and keys   | `lib/article/article-slash-items.ts` (`SLASH_ITEMS`, `SLASH_GROUPS`) |
| Matching one name: its rank and bold marks  | `lib/article/slash-match.ts` (`matchSlash`)                          |
| Sections, Recent, the flat list, Tab's jump | `lib/article/slash-menu-model.ts` (`slashModel`, `groupJump`)        |
| Recent, kept in this browser                | `lib/article/slash-recent.ts` (`liveknowledge:v2:slash-recent`)      |
| Where the popover sits                      | `components/canvas/article/slash-menu-place.ts`                      |
| The tiles' glyphs                           | `components/canvas/article/slash-menu-icons.tsx`                     |
| The preview of each entry                   | `components/canvas/article/SlashPreview.tsx`                         |
| The popover and the phone's sheet           | `components/canvas/article/SlashMenu.tsx`                            |
| The keys while it is open                   | `lib/article/article-slash.ts` (`SlashKey`), `article-view-mount.ts` |

- **Matching.** Bands, best first: the name starts with the query, a word of it does, the name holds it, its letters
  in order with gaps (contiguous runs and word starts preferred), a keyword. Within a band the name the query covers
  more of ranks first (at most 10 points, never past a band's step); equals keep the catalogue's order. Groups keep
  their entries together, ordered by each group's best match.
- **Recent.** Each pick adds 1 to an entry's weight after halving it per day since its last pick; the three heaviest
  head the menu while nothing is typed, the entry still in its own group below. Twelve entries are kept at most.
  Storage refused or garbled reads as no picks. It is read once as the menu opens, never per key.
- **The writing's look.** `articleLookOf` copies the writing's `--article-*` variables onto the menu, so the heading
  tiles and the preview use the knowledgebase's fonts and colours.
- **The page picker** (`usePageLinks.tsx`) draws its pages with `SlashMenu` too, `modelOf(sectionsOfItems(items))`
  with no preview and no key hints.
- **Cost, measured** (signed-in build, Chromium, Apple silicon, keydown to the menu in the DOM, 15 opens): median
  3.7 ms, worst 34 ms (the first open, loading the icon modules). Typing with the menu closed: median 0.4 ms, worst
  1.0 ms over 30 keys; nothing on the typing path changed (the plugin's closed state is one read). Filtering: 1,000
  queries over the catalogue inside a 400 ms CPU budget (`slash-menu-model.test.ts`); 20 full renders inside 1,500
  ms (`SlashMenu.test.tsx`).

## What a page no longer has (built)

- **Stored fields.** `withoutPageLooks` (`packages/document/src/page-looks.ts`) runs in `migrateStoredTab`, which
  every stored tab passes on its way in (the api's tab read, a version restored, the offline store's load, a file
  import) and every incoming one (`migrateIncomingTab`: an api write, a peer's op). It removes an article page's
  `background` and `locked`, the tab's `locked`, and each article's `style`, and answers the same tab when it holds
  none. So nothing downstream draws or honours one, and the next save writes the tab without them. A page of
  another kind (a slide a JSON import still carries) keeps its own.
- **Paper.** A tab whose pages are one article's paper sheets (a Word import, a livedocuments file, an agent's or
  a script's write, an older stored tab) reads as that article on one continuous page: `withArticleContinuous`
  (`packages/document/src/continuous-article.ts`) runs in `migrateStoredTab` after `withoutPageLooks`, keeps the
  first sheet's id, drops the other sheets (the writing is whole in its flow) and sizes the page with
  `withArticleHeightEstimated`; the editor's first layout settles the real height. A tab of several articles, or
  with a slide among its pages, is left as it is. `continuous-article.test.ts`.
- **Templates** carry no article style (`articleTabOverrides`): a template is its writing.
- **The controls.** A knowledgebase page draws `PageSurfaceSheet`, which has no title bar, so Style, Text,
  Background, Lock and the page panel behind them are not drawn. Also removed: the Theme & Canvas brush in the
  bottom-right cluster, the Open Theme and Open Canvas Options commands, Article Style in the bar's More menu, and
  Lock Page in the page's menu.
- **Settings.** The rows for what liveknowledge does not have are gone from
  `components/dialogs/settings/settings-catalogue.ts`: Middle-Mouse Pan, the Map's three rows and the four Pages
  tours rows, with the mirror liveworkspace.app's settings page reads
  (`packages/settings/src/catalogues/liveknowledge.ts`, regenerated). A stored preference of theirs is kept and
  read by nothing here. `settings-catalogue.test.ts` holds that none of them is offered.
- **Not removed:** the help centre's articles on them (see "Not built").

## Knowledgebase Style (built)

Spec "Knowledgebase Style". The style is one value on the document, drawn with when a page is shown, and stored in
no tab.

| Piece                                                          | File                                                                                                                             |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| the model, parser, write, article style                        | `packages/document/src/knowledge-style.ts`                                                                                       |
| a tab's own style dropped on read                              | `packages/document/src/page-looks.ts` (`RETIRED_TAB_STYLE_KEYS`)                                                                 |
| the wire                                                       | `packages/api-schema` `knowledge.ts` (`KnowledgeStyleWire`), `LiveDoc`, `document-meta`                                          |
| the column and its travel                                      | `apps/api` `document-schema.ts` (V16), `document-content.ts`, `document-file.ts`, `document-snapshots.ts`                        |
| the metadata write                                             | `apps/api` `routes/knowledge-style-write.ts`, called by `routes/documents.ts`                                                    |
| the editor's store                                             | `apps/editor/lib/knowledge-style/knowledge-style-store.ts`                                                                       |
| the change, its save and its undo step                         | `editor-state/useEditorKnowledgeStyle.ts`, `lib/knowledge-style/style-change.ts`, `style-history.ts`                             |
| who is offered it                                              | `lib/knowledge-style/style-offered.ts`, `components/knowledge-style/useStyleOffered.ts`                                          |
| the theme's accent                                             | `packages/document/src/knowledge-accent.ts` (shared with the public site)                                                        |
| the writing and chrome accents, the light ground, a styled tab | `packages/document/src/knowledge-style-view.ts`                                                                                  |
| the dark ground (and the accents again)                        | `lib/knowledge-style/knowledge-accent.ts`                                                                                        |
| the Explorer's preview                                         | `apps/api` `thumbnail.ts` (`drawDocument`), called by `document-room/document-room-doors.ts` `exportImage`                       |
| looks, the Mashup                                              | `lib/knowledge-style/knowledge-looks.ts`                                                                                         |
| a card's page of writing                                       | `lib/knowledge-style/look-page-preview.ts`                                                                                       |
| drawings in the theme                                          | `lib/knowledge-style/styled-elements.ts`                                                                                         |
| a tab as the exports draw it                                   | `packages/document/src/knowledge-style-view.ts` (`tabInKnowledgeStyle`), `lib/export-as-seen.ts`                                 |
| the dialog and its panels                                      | `components/knowledge-style/` (`KnowledgeStyleDialog`, `knowledge-style-profile`, `KnowledgeTextPanel`, `KnowledgeColoursPanel`) |
| the shared dialog's optional parts                             | `packages/workbench` `tab-style-profile.ts` (`title`, `finishFilter`, `renderPanel`, `panelValues`, `textFont`)                  |

- **Model.** `KnowledgeStyle` is `{ theme, headingFont, bodyFont, textSize, lineSpacing, headingStyle, accent? }`:
  a built-in theme id (`brand` is the product's own), two typeface ids, `small | medium | large`, `compact |
comfortable | relaxed`, `plain | ruled`, and a hex when one was picked. `DEFAULT_KNOWLEDGE_STYLE` is brand, Inter,
  medium, comfortable, plain. `parseKnowledgeStyle` never throws and defaults each field it cannot use;
  `knowledgeStyleWrite(stored, write)` is strict and names the field it refuses (`accent: null` clears);
  `storedKnowledgeStyle` is null for the default. `knowledgeArticleStyle(style)` is the `ArticleStyle` every flow is
  drawn with (Narrow margins, the accent in the headings, `single | onehalf | double` for the spacing, `headings`
  rules for ruled), the same object for the same style.
- **Storage.** `document.knowledge_style` (JSON, NULL for the default), read with the document's row into
  `DocumentMeta.knowledgeStyle` and so into every document read. It travels as `knowledgeSettings` does: a create
  (`POST /api/documents`, read forgivingly), a copy of the whole knowledgebase (never of one page), the file
  envelope (`document.knowledgeStyle`, absent for the default), a snapshot's revert, and the Offline record
  (`OfflineDocumentRecord.knowledgeStyle`, `offlineSaveKnowledgeStyle`) through its sync.
- **The write.** `PUT /api/documents/<id>` with `knowledgeStyle` (any of its fields), behind the route's edit gate.
  A field it cannot take is 400 `invalid_knowledge_style` with `field` and `message`, before anything of the save
  is written. A style that differs writes the one row and is relayed, awaited, as a `document-meta` op with
  `knowledgeStyle`. The room deletes `knowledgeStyle` from any session's own `document-meta`
  (`document-room-frames.ts`), so only the api's relay carries one.
- **The editor.** The store holds the style per knowledgebase and tells its readers only when it changes
  (`take` from the document's read, the room's op and a resync; `set` from a change here). `useEditorKnowledgeStyle`
  binds `changeKnowledgeStyle` for an Editor of the whole knowledgebase (`styleOfferedOf`) and for no one else: a
  change pushes a checkpoint on the tab history (the tabs as they are), records the style before and after against
  that step's depth and branch (`createStyleHistory`), shows it from the store and saves it
  (`apiSaveKnowledgeStyle`); a refused save puts back what was there and says so. `useEditorHistory`'s
  `beforeUndo` and `beforeRedo` move the style with the step.
- **Drawing.** `usePagesMode` reads the style and hands the view `articleStyle` and the theme's accent;
  `ArticleFlows` passes it as every flow's `styleOverride`. `EditorCanvasHost` draws the active page's elements
  through `elementsInTheme` (each unset colour the theme's, cached per element) and the theme's view map.
  `useThemeColours` and `useColourPalette` offer the theme's palette. Nothing subscribes for a page that is not
  mounted, and no tab is committed.
- **The accent.** In `@liveknowledge/document`, one copy for the editor, the public site and the api: the theme's
  accent in `knowledge-accent.ts`, the writing and chrome accents in `knowledge-style-view.ts`, all re-exported by
  the editor's `knowledge-accent.ts`. `knowledgeThemeAccent`: `LIME_ACCENT` (`#4d7c0f`, brand-600) for `brand`; otherwise `writingAccentOf` the theme's light half: a multi-colour theme's first branch whose hue is
  outside 330 to 65 degrees (`isWarmAccent`: red through amber, the hues of errors and Review Due), else its first
  branch, else the theme's own stroke. `knowledgeWritingAccent` is the picked accent, else that.
  `articleStyleVars` holds it to 4.5:1 on the page. `knowledgeChromeAccent` is what the chrome's ramp is spun from
  (`useEditorAccent`): null for `brand`, else the accent deepened 4% a step until white reads on it and its 700
  step reads on its 50 step at 4.5:1. `knowledgeLightGround(theme)` is the light appearance's ground:
  `KNOWLEDGE_LIGHT_GROUND` (`#ffffff`) for `brand`, else `knowledgeGroundWash(chromeAccent)` (white mixed 94% with
  the accent), which `useEditorAccent` paints `--color-white` with. `knowledgeDarkGround` (editor only, it reads
  the workbench ramp) is the dark appearance's ground under a theme: `#131b26` (the shared dark palette's
  slate-900) for `brand`, the ramp's slate-900 otherwise; `globals.css` paints the canvas root with
  `var(--color-slate-900)` in dark.
- **The chrome's edges.** `globals.css` defines `--lk-chrome-edge` and `--lk-chrome-side` on the root, mixed in
  oklab from the ground (`--color-white` in light, `--color-slate-900` in dark, both already the look's when a
  theme tints them), and paints with them, unlayered so they outrank the utilities: the right edge and the surface
  of `[data-contents-sidebar]` and `[data-page-tree-over]`, the foot of `[data-knowledge-top-row]`, the left edge
  of `[data-page-rail]` and the top of `[data-editor-tabbar]`. `chrome-edges-css.test.ts` holds the rules and
  works the mixes out for every look in both appearances (an edge at 1.3:1 or more on the ground, the sidebar
  visibly off it).
- **The dialog.** `KnowledgeStyleDialog` renders the shared `TabStyleDialog` with `knowledgeStyleProfile(style)`:
  `title` Knowledgebase Style, `finishFilter: false`, the looks from `KNOWLEDGE_LOOKS` (the platform's, each cut to
  a theme and a font) with `lookPagePreview` as the card, panels `['font', 'theme']` drawn by `renderPanel`, and
  `panelValues` for the two rows, and `textFont` (the heading font) for the Text row's "Aa". The shared carousel
  sets each card's name in its look's `font`. No tour binding runs (`NO_TOUR`). Its open state is the editor's existing
  `canvasThemeTab`; `EditorModals` draws it only while `useStyleOffered()`. The Fine-tune panels are
  `sm:min-h-[23.375rem]`, which makes all three views 562 px tall at 1440 x 900 (measured).
- **Exports.** `tabAsSeen` first takes the tab through `tabInKnowledgeStyle(tab, knowledgeStyleStore.openStyle())`
  (the theme, the body font, each flow's article style, unset element colours), so the PDF, Word and image exports
  and the print read the knowledgebase's style where they read `tab.theme` and `flow.style`; the other pages of a
  whole export are mapped the same way in `EditorTabDialogs`. Markdown carries no style. Each flow's style carries
  `accent: knowledgeWritingAccent(style)`, so the shared renderer, which otherwise falls back to the theme's raw
  stroke (`pagesWithWriting`), draws the accent the page shows.
- **The preview** (spec "The preview follows the style"). The export door (`exportImage`) reads the document's
  head and hands `meta.knowledgeStyle` to `drawDocument` as `DrawSubject.knowledgeStyle` (absent:
  `DEFAULT_KNOWLEDGE_STYLE`). `renderTabBodyToSvg` settles the stored tab (`migrateStoredTab`), then draws
  `tabOnKnowledgeGround(tabInKnowledgeStyle(tab, style), style)`: every page with no fill of its own (every page,
  `page-looks` drops them) gets a solid fill of `knowledgeLightGround(style.theme)`, read through `pagesOf` so a
  tab with no page list grounds its one page; `brand` returns the tab unchanged (white paper). A Community link's
  drawing is redacted after styling. Fonts are the article style's `resolveFontStack` stacks (`'Lora', ui-serif,
Georgia, serif`) behind the renderer's Google Fonts `@import`, which an `<img>` never loads, so the stack's
  generic family draws. The preview ignores `appearance` (always the light half). Staleness: the style write
  (`setKnowledgeStyle`) and the metadata write's rename set `saved_at`, the room notes the write (`noteWrite`), the
  outbox pushes the summary with `updatedAt = saved_at`, and the door's version is `saved_at`, so a held preview is
  stale after a style change. Measured: 0.25 to 0.31 ms of CPU per drawing of a five-block page, styled or not.
- **Agents.** `parsePagesRequest` refuses `look` and `accent` by name (`STYLE_IS_THE_KNOWLEDGEBASES`);
  `ArticleWrite` and the CLI's `article set` carry neither.
- **Telemetry.** `Tab` `Changed` `Look` | `SeasonalLook` | `Mashup` | `Text` | `Colours`, and `UI` `Opened`
  `ThemePicker`.

Tests: `knowledge-style.test.ts` (document: the parser, the write, the article style, the retired tab keys),
`knowledge-style-view.test.ts` (document: each accent, the warm hues, the chrome accent, the light ground, the
styled tab and its accent, the grounded pages), `knowledge-style-write.test.ts` (api: every role, each refusal, one
row written, the relay, the travel, the export door's version moving with a style change and the new ground drawn),
`thumbnail.test.ts` "a drawing in the Knowledgebase Style" (api: the Everyday and Steel looks' ground, accent and
typeface in the SVG, a picked accent, a document with no style), `lib/knowledge-style/knowledge-style.test.ts` (the
store, the undo placement, the offer per role, the looks, the cards, the drawings, the dark ground), `knowledge-style-contrast.test.ts` (every theme, light and dark: the tree's
selected row, the Verified pill, the formatting bar's active state, solid fills, the footer's tabs, the writing's
accent and page links at 4.5:1; Review Due untouched), `useEditorKnowledgeStyle.test.tsx` (no page rewritten,
saved or laid out; one undo step; a Participant and a Viewer never change it), `KnowledgeStyleDialog.test.tsx`.

## The knowledgebase's menu (built)

Spec [Knowledgebases and pages](../knowledgebases-and-pages.md) "The knowledgebase's menu".
`components/knowledge-menu/`: `useKnowledgebaseMenu` builds the rows from the hooks that decide each feature
(`useStyleOffered`, `useDescribeToAddPages`, `useAskSession().rights.manageAi`);
`KnowledgebaseMenu` is the name's button and the shared `PortalMenu` with `MenuHeader` and `MenuActionRow`.
`PageTreeSidebar` and `PageTreeSheet` take it as `menu`, a render prop handed the shown name and how a rename
starts in place, from their hosts in `usePageTreeChrome`, where the editor's store is.

A name typed at the open menu ("Typing a new name renames"): `typedNameKey(prev, key, labels)` (`typed-rename.ts`, pure)
reads each key against the rows' labels and answers `search` (the letters still spell a row's start, a letter typed
again counting as itself, as `typeaheadIndex` does; the text carries on), `rename` with the text typed so far, or null
(a named key, a shortcut, a space with nothing typed). The search restarts after `MENU_TYPEAHEAD_RESET_MS` (D49, the
menu's own). `KnowledgebaseMenu` runs it in a capture-phase `onKeyDownCapture` on a `display: contents` wrapper round
the `PortalMenu`, so it sees each key before `useMenu`'s listener on the menu, and on the button's `onKeyDown` while
open; a `rename` prevents the key, closes the menu, tells `onChosen('rename')` and calls `onRename(text)`, only where
the rows hold Rename. `KnowledgebaseHead.onRename(typed?)` sets the head's `HeadRename` (`{ typed }`), and the shared
`NameEditor`'s `typed` opens the field on those letters with the caret after them instead of selecting the old name
(an IME's composing keys are skipped). Tests: `KnowledgebaseMenu.test.tsx` (the rows in order, each row's action, the
keys, every role, a typed name), `typed-rename.test.ts`, `PageTreeSidebar.test.tsx` (the field carries on from the
typed letters, in the sidebar and the sheet), `e2e/knowledgebase-rename.spec.ts` (a two-word name typed right after
the knowledgebase is made, and Rename from the row, each saved and kept through a reload).

## The cover

Derived from [The page surface](../page-surface.md) "The cover".

### Domain and naming

| Term                 | Identifier                                                                                                                                                                                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a cover              | `TabCover` (`packages/document/src/page-cover.ts`): `{ imageId, focus?, credit? }`, `{ gradient: CoverGradientId }` or `{ motion, colouring, speed? }`; `coverKindOf` says `image`, `gradient` or `animated`                                                                                              |
| reading one          | `parseTabCover(v)`: a picture through the platform's `parsePageCover(v, isPageImageId)` (a liveplanner form's cover reads through it too), a gradient by `COVER_GRADIENT_IDS`, a motion by `PAGE_MOTIONS` and `COVER_COLOURINGS`                                                                          |
| painting one         | `coverFill(cover, theme)`: the theme row's gradient (`themeBackgroundPresets`) or `motionFill(theme, motion, colouring, speed)`, from `coverThemeOf(style)` (`page-cover-state.ts`: the writing accent, `knowledgeWritingAccent`, and the theme's next branches), memoised per style by `useCoverTheme()` |
| where a picture sits | `focus` (0 to 100, `COVER_FOCUS_CENTRE` 50 when absent), drawn by `coverObjectPosition(focus)`                                                                                                                                                                                                            |
| the page's cover     | `Tab.cover`, settled on every read by `withSettledCover` (`packages/document/src/page-cover.ts`)                                                                                                                                                                                                          |
| the choices          | `COVER_GRADIENT_IDS` (14 `theme-*`), `COVER_MOTIONS` (`PAGE_MOTIONS`), `COVER_COLOURINGS` (`PAGE_MOTION_COLOURINGS`); the menu reuses `AnimatedBackgroundChoices` (`components/canvas/page-background-animated.tsx`, `customColours={false}`), mapped back by `animatedCoverOf`                           |
| an agent's cover     | `parseAgentCover(raw)` (`packages/edit-operations/src/pages/cover.ts`): strict, refusing `invalid_cover`                                                                                                                                                                                                  |
| the band             | `PageCoverBand` (`apps/editor/components/page-cover/`), with `CoverControls`, `CoverMenu`, `AddCoverButton`, `useCoverReposition`, and `CoverMotion` (the slide's `PageMotionLayer`, paused by `data-cover-paused` from an IntersectionObserver and `visibilitychange`; `app/motion-page.css`)            |
| who may add one      | `useCoverAddable()` (`page-cover-state.ts`, `coverAddable(s)`): a writer (not read-only, not participating), whether the page is read or edited; the meta row's Add Cover and Add Icon (`PageMetaRow`), shown to nobody else                                                                              |
| who may change it    | `useCoverEditable()` (`page-cover-state.ts`): a writer, in edit mode where the store has one (`pageEditing.editing`): the band's controls and the icon's own button. `AddCoverButton` hands a motion's menu on to the band's Change Cover (`takeCoverMenuHandoff`) only while this holds                  |
| no tooltip           | `AddCoverButton`, `AddIconButton`, `AddLabelButton`, `VerifyPageButton`, `PageApprovalMeta`'s Request Approval, `SuggestedEditsPill` and `PageMakersBadges` carry no `HoverCard` or `Tooltip` (owner 2026-11-23); `PageMetaRow.test.tsx` holds it                                                         |
| the band's height    | `COVER_HEIGHT` 220, `COVER_HEIGHT_PHONE` 140, `coverHeightOf` (`lib/page-surface/page-lock.ts`): the lock's `cover` input moves the page down, `usePageSurface` writes `--page-cover-height`, `--page-cover-left` and `--page-cover-right` on the scroller                                                |

### Behaviour and state

- **Stored and synced as tab meta.** An Editor's change is the editor's own tab change (`useSetPageCover()`, one `commitTabs`, outside the draft lens), so it
  is sent as a `tab-meta` patch (`cover`, or `clear: ['cover']`) and saved by the whole-tab save, as a rename is.
  The room relays a `tab-meta` op only from an edit-role session (`room-op-gate.ts`) and the tab PUT is an edit
  gate's, so a Participant's or a Viewer's cover never lands. Offline, the same change is saved in this browser.
- **An agent's cover** rides the Pages route (`POST tabs/<tab>/pages`, and `PUT pages/<tab>` behind `write_page`):
  `PagesRequest` takes `cover` beside `article`, or alone. `submitPages` sets or removes `next.cover` and
  `pagesRoomOps` sends it as `tab-meta`, so open editors follow. A cover alone skips the verified-page refusal.
- **The lock** takes the band: `computePageLock({ ..., cover, topMargin })` puts the page's top
  `PAGE_TOP_ROOM + coverHeight` under the top of what scrolls, less the tuck (`PAGE_TOP_ROOM + topMargin -
COVER_TITLE_GAP`, the page's own top margin from `articleTopMarginPx`, never its side margin), so the Title stands
  `COVER_TITLE_GAP` under the band; `pageFreeHeight` takes the band off, so a short page's paper does not grow.
  `usePageSurface` writes `--page-cover-left` (the tree's inset) on the scroll container with the lock, so the band
  starts where the column's room starts and follows the tree without a render.
- **States of the band:** `idle` (hover or focus shows the controls), `menu` (the cover menu open), `reposition`
  (dragging; `focus` held in the hook, not stored), and back to `idle` on Save Position (one tab change) or Cancel.
- **Remove** is one tab change; the toast's Undo puts the cover that was removed back (another tab change).

### Interfaces and contracts

- `write_page` `cover` (`AgentCover`): `{ kind: 'image', imageId, focus?: integer 0..100 } | { kind: 'gradient',
preset: CoverGradientId } | { kind: 'animated', preset: PageMotion, colouring?: colouring id ('deep'), speed?:
0.25..3 } | null`. Refusals: `invalid_cover` with a message naming the field ("cover.focus is a whole number from 0
  ...", "cover.preset is one of theme-dawn, ...", "cover.colouring is one of deep, ...", "cover.speed is from 0.25
  to 3", "cover.imageId names a picture from upload_image or list_images.", "Send cover as { "kind": ... } or
  null."). The api answers the same codes on `POST tabs/<tab>/pages`.
- `GET pages/<tab>` (`KnowledgePageRead`) answers the same `cover` (`agentCoverOf`), and `read_page` passes it on.

### Data and persistence

- `Tab.cover` is in the tab's JSON body; no schema step. A cover's picture is an image reference:
  `imageRefIds(elements, pages, cover)` (`@liveworkspace/api-kit/image-refs`, and its JSON twin
  `imageRefIdsFromData`) counts it, so the reference index, the media service's grants and a copy keep it. The
  editor's Offline conversion (`offline-images.ts` `tabImageIds`, `rewriteImageIds`) embeds and re-homes it.
- The editor's export image list (`export-tab-images.ts`) leaves it out (the exports are the writing).

### Errors and edge cases

- A stored cover that is not one (a hand-edited body, an old client) is read as what of it is valid, or none.
- A picture that will not fetch leaves the tint; `[page] cover picture unavailable` is logged once per id.
- A cover set while the page is unsaved (a new page) rides its first save.
- A tab-meta patch from a peer carrying an invalid cover is drawn through `parseTabCover`, so it draws nothing; a cover
  stored as colours (a gradient's `fill`) is none.
- A Knowledgebase Style change recolours every gradient and animated cover with nothing written: the band reads the
  style (`useOpenKnowledgeStyle`) and paints `coverFill` (`page-cover.test.tsx` "recolours an existing gradient
  cover when the Knowledgebase Style changes").

### Performance and limits

- No cover: `PageCoverBand` renders `null`; the lock's `top` is `PAGE_TOP_ROOM` as before.
- A picture: one fetch per page open (`useImageSources`, its display copy at `displayEdge()`: 4,096 px, 2,048 on touch), `decoding="async"`; the
  band subscribes to the tab's `cover` alone, so a keystroke or a scroll renders it 0 times
  (`page-cover.test.tsx` "renders the band no more for a change that is not its cover").
- No layout shift: the band's height comes from `Tab.cover` being set, known with the tab, not from the picture.

### Presentation and UX, Accessibility

- The band: `role="img"` with `aria-label="Page cover"` (the credit read when there is one). The controls are
  buttons in a group shown on hover and on `:focus-within`, each with a `Tooltip`. Reposition: the band takes
  `tabIndex=0`, `aria-roledescription="Cover position"`, `aria-valuenow`, arrows by 5, Enter, Escape.
- Motion: the picture's fade and the controls' fade are 150 ms (`motion-budget.test.ts`), none with reduced motion.

### Testing

| Rule                                                      | Test                                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A cover read forgivingly, patched, positioned             | `../packages/page-background/src/cover.test.ts`                                              |
| A tab's cover settled on read                             | `packages/document/src/page-cover.test.ts`                                                   |
| A cover's picture is a reference                          | `../packages/api-kit/src/image-refs.test.ts`                                                 |
| An agent's cover: set, clear, refused; a Viewer's refused | `packages/edit-operations/src/pages/cover.test.ts`, `apps/api/src/routes/page-cover.test.ts` |
| `read_page` and `write_page` carry it                     | `apps/mcp/src/knowledge-tools.test.ts`                                                       |
| The lock with a band                                      | `lib/page-surface/page-lock.test.ts`                                                         |
| The band, its controls by role, reposition, Remove's Undo | `components/page-cover/*.test.tsx`                                                           |
| Add Cover in the meta row, by role                        | `components/knowledge/PageMetaRow.test.tsx`                                                  |
| Add a cover, reposition it, remove it                     | `e2e/signed-in/page-cover.spec.ts`                                                           |

## Performance and limits

- **A scroll:** one passive listener that reads `scrollTop` and writes two numbers. No React render, no layout pass
  of the article (`page-viewport-store.test.ts` "tells no reader of a scroll while nothing is followed":
  50 scroll events, 0 notifications, 0 frames asked for). On This Page looks for the heading being read at most once
  every 120 ms while scrolling and renders only when that heading changes.
- **Typing:** unchanged. The lock reads the page's corner, width and margin, none of which a keystroke changes.
- **Not measured:** the browser's own layout and paint of a 100,000 character page while it scrolls. It was never
  profiled on the canvas either (continuous-page blueprint, "Not measured"), and needs a browser.

## Testing

| Rule                                                                    | Test                                                                                                                                                    |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The column: centred, 100% at every width, side room, 320 px to 3,840 px | `page-lock.test.ts`                                                                                                                                     |
| The narrow view: drawn narrow, lowered to the stored page, no loop      | `page-view-lens.test.ts`, `page-view-store.test.ts`, `page-view-lens.perf.test.ts`                                                                      |
| The view is locked; a move is a scroll; a scroll tells nobody           | `page-viewport-store.test.ts`, `useEditorViewport.test.tsx`                                                                                             |
| The page's scroll keys                                                  | `page-keys.test.ts`                                                                                                                                     |
| The ground follows the appearance alone                                 | `view-backdrop.test.ts`                                                                                                                                 |
| No zoom chords, no Hand, no Fit                                         | `useEditorKeyboardShortcuts.test.ts`, `editor-commands*.test.ts`                                                                                        |
| The bar: the slot, Undo and Redo, no canvas tool                        | `PageFormattingBar.test.tsx`                                                                                                                            |
| A short page does not scroll; the free height                           | `page-lock.test.ts` "the world's box inside the scroll container"                                                                                       |
| The breadcrumb is over the paper and pressable                          | `PageSurfaceSheet.test.tsx`                                                                                                                             |
| A drawing's tools: four categories, no Selection mode, no Library       | `ToolbarPalette.test.tsx`, `CategoryBar.test.tsx`                                                                                                       |
| The tools stay while reached for and used                               | `drawing-zone-store.test.ts`                                                                                                                            |
| Space is the page's; no tool keys or commands                           | `useCanvasPanAndMarquee.test.tsx`, `useEditorKeyboardShortcuts.test.ts`, `editor-commands.test.ts`, `shortcut-sections.test.ts`                         |
| A stored background, style or lock is dropped as a tab is read          | `page-looks.test.ts`, `tab-row.test.ts`                                                                                                                 |
| Templates carry no style; no Open Theme command                         | `article-templates.test.ts`, `editor-commands.test.ts`                                                                                                  |
| The slash menu: groups, matching, Recent, keys, placement, sheet        | `slash-menu-model.test.ts`, `slash-recent.test.ts`, `article-slash.test.ts`, `slash-menu-place.test.ts`, `SlashMenu.test.tsx`, `e2e/slash-menu.spec.ts` |

Not covered by a test: `usePageSurface` (it reads layout boxes jsdom does not lay out), the scroll container's
extent, the rail's inset, and everything a browser would show.

## Not built

Written so each can be picked up cold.

### Knowledgebase Style (spec "Knowledgebase Style")

Built: see "Knowledgebase Style (built)" above. What is left of it:

- **Checked in a browser at 1440 x 900 and 390 x 844, light and dark** (Everyday, Boardroom, Midnight, Spectrum,
  the seasonal Fireside, a Mashup, the Text and Colours panels, the menu, the footer under a theme that is not
  lime). Not checked: a second person's editor redrawing live from the room's op (the api's relay and the editor's
  receive are each tested, not the two together in a browser), and the exports' output files.
- **A multi-colour theme colours the writing in one branch.** Rainbow, Pastel and Tropical give every heading the
  same accent. Headings taking the palette by level needs a variable a level in `article-pages.css` and the
  palette handed to `articleStyleVars`, which takes one accent today.
- **A drawing made before a style change keeps what was picked.** Elements are stored without theme colours and
  drawn in the theme, so they follow. A colour written into an element under another theme (an imported
  livedocuments tab) is a picked colour and stays.
- **The tab style setters are still in the editor's state** (`setTheme`, `setTabFont`, `setTabFinish`,
  `applyTabLook`, `applyStyleToAllTabs`, `setNewPageBackground` in `editor-state/useEditorStyle.ts` and
  `hooks/canvas/useTabCanvas.ts`, with `lib/tab-looks.ts`, `lib/look-mashup.ts`, `lib/look-preview.ts`,
  `lib/finish-preview.ts`, `lib/tab-theme-apply.ts` and their tests). Nothing calls them from the surface any more;
  a tab they wrote to would have the write dropped on its next read. Removing them is a change to
  `EditorContextValue` and its equality lists.
- **The CLI and the MCP have no verb for the style.** It is read and set over REST (`GET` and `PUT
/api/documents/<id>`). A `document style` verb and an MCP tool are the follow-up.
- **Help:** the help centre's Tab Style, Finish and New Page Background articles are still in liveknowledge's scope
  (`lib/help-articles.ts` `changingTheBackground`, `choosingAFinish`; `packages/help-registry`). The dialog links
  `changingTheme` (the home and Colours) and `choosingFonts` (Text), whose words are a tab's.

### Smaller gaps

- **Help:** the Keyboard list in Settings follows what is bound now (`shortcut-sections.ts`); the help centre's
  articles on zoom, the hand tool, the Selection mode, the Library, the page panel and the page lock are not yet
  retired from liveknowledge's scope (`lib/help-articles.ts`, `packages/help-registry`).
- **Optical alignment:** the meta row's "Verified by" pill is centred (`TrustBadge`: even padding with
  `optical-edges`; its contents measured 0.05 px off centre in a browser, from 0.63). The optical audit
  (`e2e/signed-in/knowledge-audit.spec.ts`) passes on Pages, Ask, Insights and Home in light and dark, the
  footer's view tabs included, with no known failure.
- **A drawing's tools on a phone** show in the row (`CanvasChrome`), unchecked in a browser.
- **A phone keyboard put away without a blur.** The row comes back when the writing loses the caret. iOS blurs the
  writing as its keyboard is put away; an Android keyboard closed by its Back gesture can leave the caret in the
  writing, and the bar keeps the row until the next press outside the writing. Checked in Chromium's phone emulation
  (390 x 844, touch), not on a real Android phone.
- **The e2e specs** follow this surface: `menu-keyboard` holds the knowledgebase's menu by keyboard (it has no zoom
  menu), `motion-budget` tours the menu and Knowledgebase Style and opens the search panel from Cmd or Ctrl K,
  `smoke`'s phone test holds the top row on screen in one row, `page-tree`'s breadcrumb test runs at 1,280 px,
  `chrome-drift` is deleted (no corner chrome), `knowledge-audit` has no known failures, and `knowledge-session.ts`
  opens a view from the footer's `nav` "Knowledgebase Views". The perf probe reaches the foot of the writing by its
  key and needs no change. `appearance` reads the page's ground as it is now (white, and the theme's slate-900 in
  dark) and `settings-memory` opens Settings from the phone footer's More. `search.spec.ts` drives the editor's search
  panel (its This Knowledgebase group).

## The narrow view (built)

`apps/editor/lib/page-surface/page-view-lens.ts`, `page-view-store.ts`; drawn in
`app/document/[id]/editor-state/useEditorCollaboration.ts`, lowered in `useEditorDocument.ts`, measured in
`hooks/editor/useArticles.ts`.

**What is shared, and so never differs per browser:** the page's width (`CONTINUOUS_PAGE_WIDTH`), its height
(`Page.fit.height`, written by the writer of a change from a full-width layout), every zone's `at`, width and height,
and the canvas positions of a zone's elements and of the margin notes. A narrow browser must write none of them, or
a desktop reader would get a page too tall and pictures at a phone's width, and two windows of different widths
would write over each other.

**The store** (`page-view-store.ts`, one per window, a plain subscribable module store like
`drawing-zone-store.ts`): the room's column (`setPageRoomColumn`, written by `usePageSurface` on each relock; a value
already held tells nobody) and, per tab, the narrow layout this browser measured: the page's height, each zone's `at`
and each margin note's corner. Never synced, never stored, gone with the window.

**The lens** (`pageViewLens(tab, view)`, pure, cached in a `WeakMap` by tab and view as `lens.ts` is): the tab itself
when the room holds the page's column. Otherwise the continuous page is `room + 2 * margin` wide and as tall as the
narrow layout measured (the stored height until it has); each zone is scaled by `min(1, column / zone width)`, stands
at its narrow `at` (until measured: its stored `at`, kept inside the column) and its elements are drawn through the
transform from the stored zone box to the narrow one (position and size; text keeps its size); margin notes stand at their
narrow corners. The drawn `activeTab` is `pageViewLens(editLens or readLens(pageTab))`, so the article engine,
the grips, drag, resize, snapping and hit tests all work in one coherent, narrower page: nothing in the engine knows
the lens is there.

**Lowering** (`lowerPageView(real, lens, mapped)`, composed inside `throughPageLens` with the edit lens: lift edit,
lift view, map, lower view, lower edit): the page keeps its stored `fit`; each zone keeps its stored `at`, and its
width and height unless the change resized it (then the new size over the zone's scale); each element the lens
moved goes back through the inverse transform, the stored element itself when it comes back unchanged; margin notes
the same. Writing typed through it lowers as it is (the edit lens then sends it to the draft). When nothing but
layout changed, the real tab itself comes back, and `lowerTabs` returns the real array, so a narrow layout can never
start a commit and render loop.

**Measuring:** `useArticles`' `onLayout`, when the drawn tab is a narrow lens, puts the layout's height, zone places
and note corners into the store and writes nothing to the tabs (no height, no zone settle, no note settle, no absent
writer's growth). The store's change redraws the lens; the next layout measures the same and changes nothing.

**Costs:** the lens is worked out once per stored tab and view (a keystroke's commit, a store change), never on a
scroll or a plain re-render: two `layOutPages` of one page, one pass over the blocks and one over the elements per
zone (`page-view-lens.perf.test.ts` holds a 2,000 block, 500 element page inside its budget).

**Left as it is:**

- An element added to the writing while narrow (a picture inserted on a phone) is stored at the narrow size it was
  made at; the next full-width layout fits its zone to the column as any zone is fitted.
- A drawing shown smaller keeps its text at its own size (a text size is a preset, not a number to scale), so a
  label in a drawing scaled far down can overrun its shape on a phone. Drawing in a zone on a phone is in narrow
  coordinates, lowered through the inverse transform.
- A layout measured just before the window widened past the column could reach `onLayout` once the drawn tab is
  the real one again; its height is then this browser's full-width layout's on the next pass.
