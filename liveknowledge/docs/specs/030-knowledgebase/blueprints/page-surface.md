# Page surface blueprint

Derived from [The page surface](../page-surface.md). **Nothing here is verified in a browser.** Each section says
what is built; "Not built" at the foot is the work left, written so it can be picked up cold.

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

- **The column does not reflow on a narrow window; it scales.** The page is 820 canvas px wide and what is placed in
  it is stored against that width, so a window too narrow for the column shows the whole page smaller (a 390 px
  phone shows the 724 px column at 48%), as the fork's phones already did. Nothing scrolls sideways, and at 856 px
  of room and wider the writing is at 100%. A column that re-wraps at any width needs (b): per-browser layout with
  zone and note positions derived on screen instead of stored.
- **The canvas engine still loads with every page**, not only with pages that have a zone. First-load JS is
  unchanged by this choice. Loading it on demand needs (b) as well.
- **Screen readers** read the writing as before (one contenteditable in the canvas's `main`); the document outline
  is no better than the fork's.

## The lock (built)

`apps/editor/lib/page-surface/page-lock.ts`, `components/canvas/usePageSurface.ts`.

- `computePageLock({ width, height, sides, page, margin, phone })` answers the one view a page is shown at. The
  column is the page less its side margins (`820 - 2 * 48 = 724` px: an article's margins now default to Narrow,
  `resolveArticleStyle`), centred in the room the side chrome leaves. Zoom is `min(1, (room - 2 * side room) /
column)`, never above 1 and never under `PAGE_MIN_SCALE`; the side room is 48 px, 20 px on a phone. The page's top
  stands `PAGE_TOP_ROOM` (24 px) under the top of what scrolls, which itself starts under the top row.
- The offset is solved for the canvas world's transform, `scale(z) translate(o)` about the surface's centre, so a
  canvas point `p` stands at `z * (p + o) + (size / 2) * (1 - z)`.
- `usePageSurface` (called by `Canvas`) sets the lock in a layout effect and again from a `ResizeObserver` on the
  canvas, on the scroll container and on the side chrome (`[data-contents-sidebar]`, `[data-page-rail="docked"]`),
  and from a `MutationObserver` on the canvas's own children (the side chrome arriving or leaving). It measures the
  scroll container's client box, which is what the world is laid in. **It never runs on a scroll or a keystroke.**
- The spec's 760 px is the most the column may be; the built column is 724 px, because the stored page is 820 px
  wide and its own 48 px margins are the side room. Making it 760 px means a stored width of 856 px
  (`CONTINUOUS_PAGE_WIDTH`), which is a model change and is not made here.

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
- `pageViewportOf(store)` answers the page store behind a `ViewportStore`, or null for the shared one (a test).

## The scroll container (built)

`Canvas.tsx`: `<div data-page-scroller>` inside the canvas's `main`, `absolute inset-0`, `overflow-y: auto`,
`overflow-x: hidden`, a stable scrollbar gutter, holding the world element. The chrome stays in `main`, outside what
scrolls. `main` and the world no longer set `touch-action: none`, so a finger scrolls natively and a pinch is the
browser's.

- **Extent:** the page's box (`PageSurfaceSheet`, at the page's stored height) plus `PAGE_FOOT_ROOM` (96 px), and
  the writing itself where it is taller than the stored height in this browser.
- **Beside the docked rail:** `[data-canvas-root]:has(> [data-page-rail='docked']) > [data-page-scroller]` ends
  280 px short of the right edge (`globals.css`), so the scrollbar is never under the rail and the rail never over
  the writing. The rail docks only where the page keeps its full width beside it: `pageRailDockWidth(treeWidth)` is
  `max(1280, tree + 280 + 820)`, which is 1,364 px with the page tree open and 1,280 px with its rail.
- **Keys:** inside the writing the browser moves the caret and scrolls it into view. With the focus on the page
  itself (the canvas or the body) `pageScrollOf` (`page-keys.ts`) scrolls on Page Up, Page Down, Space, Home, End and
  the up and down arrows; never while an element is selected, whose keys are the engine's.

## What is painted (built)

- `PageSurfaceSheet` (`components/page-surface/`) stands where the fork's `CanvasPages` stood for a continuous
  page: the page's box with `data-page`, `data-page-id` and `data-page-kind` (the engine finds the page it is on by
  them), no background, border or shadow. It draws the breadcrumb in the page's top margin, lined up with the column
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
  entry) and sends `UI·Opened·PagesView`, `AskView` or `AiKnowledgeView`; a press with a modifier is the link's.
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
  `view` (Ask's and AI Knowledge's header), and `view` outranks `page`.
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
- **On Ask and AI Knowledge** `KnowledgeViewHeader` is the same row: the view's name (`h1`), its one line from
  `lg` up, its buttons, a divider, the slot. The frame ends at the footer's top (measured, `[data-editor-tabbar]`),
  and the footer is the one column child it leaves live.
- **A phone while writing:** the page toolbar's own bar is fixed along the top (`usePageToolbarPlacement`) and sets
  `data-article-toolbar-top` on the root; `globals.css` hides the page row's children under that attribute, so the
  bar has the row to itself and the menu, Pages, Page Info, Share and account buttons return when the caret leaves.

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
- **No canvas tool.** The fork's strip (`ToolbarPalette`: Selection mode, the palette, the Library) is not drawn
  for a page. It shows only while a drawing zone is being edited (`lib/page-surface/drawing-zone-store.ts`, set by
  `ArticleFlows` from the zone its zone bar is for), in the formatting bar's place, as that drawing's tools. It is
  still the whole strip then, Library included: a strip of the drawing tools alone is not built.
- **Undo and Redo** left the bottom-right cluster for an Editor on a desktop; a phone and a Participant keep them
  there.
- **A phone** has no bar here. Its writing bar is the page toolbar's own, fixed along the top of the screen while
  the caret is in the writing (`usePageToolbarPlacement`); the top row's own buttons step aside for it ("The footer
  and the top row").
- **Narrow:** where the row has less room than the controls need (about 1,024 px with the tree open) the slot
  scrolls sideways; there is no mark that more controls follow.
- **Renders:** the bar's props are the history's two flags, which a keystroke does not change; the page toolbar inside it renders on a selection change, as it did in the strip.

## What a page no longer has (built)

- **Stored fields.** `withoutPageLooks` (`packages/document/src/page-looks.ts`) runs in `migrateStoredTab`, which
  every stored tab passes on its way in (the api's tab read, a version restored, the offline store's load, a file
  import) and every incoming one (`migrateIncomingTab`: an api write, a peer's op). It removes an article page's
  `background` and `locked`, the tab's `locked`, and each article's `style`, and answers the same tab when it holds
  none. So nothing downstream draws or honours one, and the next save writes the tab without them. A page of
  another kind (a slide a JSON import still carries) keeps its own.
- **Templates** carry no article style (`articleTabOverrides`): a template is its writing.
- **The controls.** A knowledgebase page draws `PageSurfaceSheet`, which has no title bar, so Style, Text,
  Background, Lock and the page panel behind them are not drawn. Also removed: the Theme & Canvas brush in the
  bottom-right cluster, the Open Theme and Open Canvas Options commands, Article Style in the bar's More menu, and
  Lock Page in the page's menu.
- **Not removed, and unreachable or inert:** the Map, Middle-Mouse Pan and the Pages tours' rows in Settings (their
  catalogue is mirrored by liveworkspace.app's settings page and pinned by twenty tests; taking the rows out is its
  own change), the help centre's articles on them, and `write_article`'s `look` and `accent`, which are still
  accepted, stored and then dropped on the next read.

## Performance and limits

- **A scroll:** one passive listener that reads `scrollTop` and writes two numbers. No React render, no layout pass
  of the article (`page-viewport-store.test.ts` "tells no reader of a scroll while nothing is followed":
  50 scroll events, 0 notifications, 0 frames asked for). On This Page looks for the heading being read at most once
  every 120 ms while scrolling and renders only when that heading changes.
- **Typing:** unchanged. The lock reads the page's corner, width and margin, none of which a keystroke changes.
- **Not measured:** the browser's own layout and paint of a 100,000 character page while it scrolls. It was never
  profiled on the canvas either (continuous-page blueprint, "Not measured"), and needs a browser.

## Testing

| Rule                                                                  | Test                                                             |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| The column: centred, 100% on a desktop, side room, 320 px to 3,840 px | `page-lock.test.ts`                                              |
| The view is locked; a move is a scroll; a scroll tells nobody         | `page-viewport-store.test.ts`, `useEditorViewport.test.tsx`      |
| The page's scroll keys                                                | `page-keys.test.ts`                                              |
| The ground follows the appearance alone                               | `view-backdrop.test.ts`                                          |
| No zoom chords, no Hand, no Fit                                       | `useEditorKeyboardShortcuts.test.ts`, `editor-commands*.test.ts` |
| The bar: the slot, Undo and Redo, no canvas tool                      | `PageFormattingBar.test.tsx`                                     |
| A stored background, style or lock is dropped as a tab is read        | `page-looks.test.ts`, `tab-row.test.ts`                          |
| Templates carry no style; no Open Theme command                       | `article-templates.test.ts`, `editor-commands.test.ts`           |

Not covered by a test: `usePageSurface` (it reads layout boxes jsdom does not lay out), the scroll container's
extent, the rail's inset, and everything a browser would show.

## Not built

One part of the spec is not started. It is written so it can be picked up cold.

### Knowledgebase Style (spec "Knowledgebase Style")

Nothing is built: no `knowledgeStyle`, no dialog. Today every page is drawn in the Clean look at the Medium size
with the theme's accent, because a page's own style is dropped as it is read (`page-looks.ts`) and nothing takes
its place.

1. **Model** (`packages/document`): `KnowledgeStyle = { look: ArticleLookId; accent: string; textSize:
ArticleTextSize }`, `parseKnowledgeStyle(v)` keeping what is valid (a look of `ARTICLE_LOOKS`, a hex accent, a
   size of `ARTICLE_TEXT_SIZE_PX`), `DEFAULT_KNOWLEDGE_STYLE` (Clean, the brand lime, Medium), and
   `knowledgeArticleStyle(style): ArticleStyle` (the look's fields, the accent, the size, Narrow margins).
2. **Storage and sync:** a field of the document's metadata, beside the name. It rides the path the page tree's
   `parent` rides ([page tree blueprint](page-tree.md) "Storage and sync"): the metadata save
   (`useAutosave.ts`, `PUT /api/documents/:id`), the room's `document-meta` op (`packages/api-schema`
   `room-messages.ts`, relayed from an Editor only by `gateClientOp`), a resync, copies, snapshots and versions,
   export and the Drive file. No page is rewritten: the style is not in any tab.
3. **Drawing:** `ArticleFlows` already takes a `styleOverride` per flow and `CanvasPages`' sheet read
   `articleStyle`; hand every flow `knowledgeArticleStyle(knowledgeStyle)` there and in `Canvas`
   (`pageMargin`, `articleTopMarginPx`), so only mounted pages re-lay out. `articleStyleVars` keeps
   `--article-page-link` on the brand whatever the accent; the Verified pill and the chrome never read the accent.
   The Notebook look's ruled lines were a page background and are not drawn.
4. **The dialog:** Knowledgebase Settings > Style from the knowledgebase's menu in the sidebar's head (the shared
   `Dialog`, centred, steady height): five look tiles each a small drawn sample, an accent row (the brand lime
   first, five more checked at 4.5:1 on white and on slate-900 with the repo's contrast helpers, through the shared
   colour picker's swatch skin), text size as a segmented control. Each pick is one undo-able edit, applied live.
   Editor only: a Participant and a Viewer are not offered the menu row, and the room refuses the op.
5. **Exports:** the PDF, Word and Markdown exporters read `flow.style`; hand them
   `knowledgeArticleStyle(knowledgeStyle)`.
6. **Agents:** `write_article`'s `look` and `accent` should be refused by name (`parsePagesRequest`).

### Smaller gaps

- **A column that re-wraps on a narrow window** (see the choice above).
- **A column exactly 760 px wide:** it is 724 px.
- **An empty page is still 1,120 px tall** (`CONTINUOUS_PAGE_MIN_HEIGHT`), so a page with one line scrolls a
  little on a short window. Lowering it moves where a page sits (`layOutPages`) and is a model change.
- **An article kept in a paper size** (a tab exported from livedocuments and imported as JSON) still draws the
  fork's sheets, locked to its first page.
- **Held Space and the middle mouse button** still drag the page up and down (the engine's pan, now a scroll), and
  a drag on the bare ground still draws the engine's marquee.
