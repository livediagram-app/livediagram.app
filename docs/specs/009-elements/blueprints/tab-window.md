# The tab window blueprint

Derived from [The tab window](../tab-window.md). Implementation detail only; the spec owns every decision.

## Domain and naming

| Term                    | Identifier                                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab window              | `ShapeElement` with `shape: 'tab-window'` (`ShapeKind`, `packages/document/src/shape-kind.ts`)                                                                 |
| The tab it shows        | `ShapeElement.windowTabId` (a tab id of the same document)                                                                                                     |
| A tab a window may show | `tabWindowMayShow(tab, ownTabId)`, `tabWindowOffers(tabs, ownTabId)` (`packages/document/src/tab-window.ts`)                                                   |
| A drawing in an export  | `TabWindowDrawing`, `TabWindowArt`, `ResolveTabWindow`, `svgTabWindow`, `prefixSvgIds` (`tab-window.ts`)                                                       |
| The window's state      | `TabWindowState`, `tabWindowState` (`apps/live/components/canvas/tab-window/TabWindowFace.tsx`)                                                                |
| The windows' context    | `TabWindowContext`, `TabWindowContextValue`, `useTabWindows`, `useTabWindowContextValue` (`tab-window-context.ts`)                                             |
| The canvas face         | `TabWindowFace`, `TabWindowDrawing`, `TabWindowPicker`, `TabWindowTabList` (`components/canvas/tab-window/`)                                                   |
| The menu section        | `TabWindowMenuSection` (`components/palette/TabWindowMenuSection.tsx`)                                                                                         |
| Exporting windows       | `useTabWindowExport`, `tabWindowTargets`, `tabWindowArts` (`components/dialogs/useTabWindowExport.ts`); `ImageExportOpts.resolveTabWindow`, `tabWindowFontIds` |

## Behaviour and state

- **May show**: not `ownTabId`, not `isPlanTabKind(tab.kind)`, and `opensInOf(tab) !== 'plan'`. Offers keep tab-bar
  order.
- **State** (`tabWindowState(windowTabId, tab, status)`): no `windowTabId` → `unchosen`; no tab with that id among the
  person's tabs → `unavailable`; status `failed` → `failed`; `loading` → `loading`; no elements → `empty`; else
  `drawing`. A name is the tab's, or "Untitled tab".
- **Status** (`useTabWindowContextValue`): the canvas's own tab or one in `loadedTabIds` → `loaded`; a tab being
  retried → `loading`; a tab in the failed set or the editor's `loadErrors` → `failed`; else `loading`. `request(id)`
  fetches a `loading` tab through `loadTabs([id])` once (an in-flight set); a fetch resolving with the id among its
  failures adds it to the failed set, else removes it. `retry(id)` removes it from the failed set, marks it retrying
  until that fetch settles, and fetches again. Nothing re-asks on a timer.
- **Settling** (`usePerTabLoad.loadAllTabs(only?)`): every fetch under way, visit-time or sweep, is recorded with how
  it ends (`'loaded' | 'failed' | 'cancelled'`). A requested tab already being fetched is waited for, not fetched
  again; its `failed` end is reported among the failures; a `cancelled` end (its visit moved on) is followed to the
  fetch that replaced it, up to `TAB_FETCH_FOLLOW_MAX` (3) times. So the promise settles once every requested tab
  has. A sweep's success also clears that tab from `tabLoadErrors`.
- **Choosing**: the face's `choose(elementId, tabId)` commits `windowTabId` on that element (`commitElements`, one
  undo step); the menu's Shows commits through `ops.commit(..., 'TabWindowTab')` on the selection.
- **Opening**: `open(tabId)` (face) and the menu's Open row call `useSelectTab()`.
- **Drawing**: `TabWindowDrawing` → `useTabSvg(tab)` (deferred, the export renderer, appearance, photos, cards) →
  inline `<svg width=100% height=100% viewBox="0 0 w h" preserveAspectRatio="xMidYMid meet">` wrapping the markup with
  `prefixSvgIds(markup, 'tw-<elementId>-')`, on a div painted `svg.background`, `pointer-events: none`.
- **Motion**: `TabWindowDrawing` passes `windowMotion` (`tab-window-motion.ts`) to `useTabSvg`, which hands
  `renderTabToSvg` an `SvgMotion` for the shown tab's surface. A boxed element that plays (`windowBoxedMotion`:
  `WINDOW_SHAPE_PLAYS` through `wrapperShapeAnimation`, else `WINDOW_BODY_PLAYS` through `setAnimationClass`) is wrapped
  in `<g class="lvd-svg-motion <set class>" style="--lvd-anim-*">`; an arrow's flow (`windowArrowLine`, from
  `FLOW_PATH_CLASS` / `FLOW_PATH_DASH`) reaches `svgArrow`'s `lineMotion` as the line's class, dash, path length and
  `--lvd-flow-*`. `:where(.lvd-svg-motion)` sets `transform-box: fill-box` and a centre origin (zero specificity, so a
  set's own origin wins). After each redraw `pinLoops` sets every infinite animation's `startTime` to 0.
  `useHoldOffscreen` toggles `data-held` on the frame from an `IntersectionObserver`, and
  `[data-tab-window-drawing][data-held] *` pauses every animation. File exports never pass `motion`.
- **Nesting**: the tab's drawing is rendered without a window resolver (canvas) or with a names-only resolver (export),
  so a window inside it is `svgTabWindow` without a drawing: its named frame.

## Interfaces and contracts

- `svgBoxed(el, { resolveTabWindow })` → `<g opacity rotate filter>${svgTabWindow(el, resolveTabWindow?.(el), el.strokeColor, surface)}</g>`.
  The kind is in `shapeHasBespokeBody`, so the PNG/PDF canvas rasterises it through its SVG, and `drawsStandardLabel`
  is false.
- `svgTabWindow`: with a drawing, a `clipPath` (`tw-<id>-clip`, rounded `TAB_WINDOW_RADIUS` clamped to half the box),
  the tab paper rect, a nested `<svg x y width height viewBox="0 0 w h" preserveAspectRatio="xMidYMid meet">` of the
  prefixed markup, then the edge; without one, `TAB_WINDOW_EMPTY[surface].fill`, the name centred at
  `max(10, min(16, h / 6))` px in `TAB_WINDOW_EMPTY[surface].ink`, then the edge. Edge: `el.strokeColor ?? TAB_WINDOW_HAIRLINE`, 1 px.
- `prefixSvgIds(markup, prefix)`: every `id="x"`, `url(#x)` and `href="#x"` whose x is an id in the markup becomes
  prefixed; references to ids not in the markup are left alone.
- `useTabWindowExport({ tab, tabs, loadTabs, imageContext, active, items })`: targets are `tabWindowTargets(tab)`
  (distinct `windowTabId`s in element order, not the tab itself); when `active` and there are targets it awaits
  `loadTabs` of the targets a window may show (`tabWindowMayShow`; none fetched for a Plan tab), then `loadTabImages` for each target tab; `ready` once both settle (photos only with an
  `imageContext`). It returns `resolveTabWindow` (from `tabWindowArts`) and `tabWindowFontIds`
  (`exportFontIds` of each target). `tabWindowArts` skips a tab `tabWindowMayShow` refuses or that is missing, gives an
  empty tab its name only, and otherwise renders `renderTabToSvg(tabAsSeen(t), { pattern: false, images,
resolveTabWindow: names, items })` sized by `svgFrameOf`.
- The export dialog passes `resolveTabWindow` and `tabWindowFontIds` into the preview and the download, adds them to
  the embedded font ids, and holds the panel `busy` until `ready`.

## Data and persistence

- `windowTabId?: string`, validated `isNonEmptyStr` (`validate-shape.ts`); a missing tab id is legal. Listed in
  `element-fields.ts` and `element-format.ts` (`'tab-window': ['windowTabId']`), so the REST API and MCP take it.
- Copy, paste and duplicate keep `windowTabId` as is (a tab id, not an element id). No migration: a new kind.

## Errors and edge cases

| Case                                            | Handling                                                                                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No tab chosen                                   | `unchosen`; Editor: Choose a Tab                                                                                                                                 |
| Tab deleted, or out of the share link's scope   | `unavailable` (the tab is not among `tabs`); never fetched                                                                                                       |
| Fetch failed                                    | `failed` with Retry                                                                                                                                              |
| Tab empty                                       | `empty`                                                                                                                                                          |
| A window set to its own tab (by the API)        | Never offered; the canvas draws its own tab (status `loaded`), the window inside as its named frame; an export skips it (`tabWindowTargets`) and draws the frame |
| A Plan tab chosen through the API               | The canvas draws it as any tab; exports skip it (`tabWindowMayShow`) and draw the named frame.                                                                   |
| Nested windows                                  | Named frame, never recursion                                                                                                                                     |
| No editor context (thumbnails, other renderers) | `useTabWindows()` is null → `unchosen` look, no controls                                                                                                         |

## Security and trust

- A window reads only `tabs` (the tabs this session sees) and fetches through the editor's own per-tab load, which
  skips tabs outside the session's scope: an unshared tab is `unavailable`, never drawn or fetched.
- The drawing is the export renderer's own escaped markup; tab names are escaped (`xmlEscape`, React text).
- Choosing is gated on `can.level === 'edit'` and the tab unlocked; opening on seeing the tab.

## Performance and limits

- `useTabSvg` renders at a deferred priority and memoises on the tab object, its photos, appearance and cards: an
  unchanged tab is never re-rendered. The drawing and the picker are `next/dynamic` chunks: the renderer and the menu
  load only once a window draws or its list opens.
- The inline SVG's node count is the shown tab's.
- The frame is `contain: strict`, so a moving element repaints inside the window and never lays out the canvas.
  Measured (six moving elements, Chromium, 1280x800): about 58 ms of main-thread work a second in the window, against
  about 47 ms for the same six on their own canvas; 115 ms before containment. Off screen: about 0.2 ms a second.
- An export renders each target tab once (`tabWindowArts`), however many windows show it.

## Presentation and UX

- Words and buttons scale with the window: `scale = clamp(element.height / 220, 1, 2.4)`; title 14 px, buttons 12 px
  type, the Open chip 28 px tall, inset 8 px, all times `scale`.
- Open: top-right, white 90% chip, hidden until the window is hovered (`group-hover`) or selected, shown on focus.
- Fill control off (`supportsFillColor` false); stroke on. No label (`isSelfDrawingShape`, `UNTYPED_SHAPES`).

## Accessibility

- Choose a Tab, Retry and Open are buttons with names ("Open Flow"); the list is `OptionRows` (`menuitemradio` in the
  menu), keyboard-navigable, the shown tab checked. The drawing is `aria-hidden`.

## Observability

- `Element · Changed · TabWindowTab`, `UI · Used · TabWindowOpen`, `Element · Added · TabWindow`
  (`elementTelemetryType` maps the kind); charted in the telemetry catalogue (`TAB_WINDOW_USE`).

## Testing

| Rule                                                            | Test                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| May show, offers, ids prefixed, export frame and fill           | `packages/document/src/tab-window.test.ts`                                                        |
| States, Choose a Tab, Open, Retry, unavailable                  | `apps/live/components/canvas/tab-window/TabWindowFace.test.tsx`                                   |
| Status, one fetch per tab, retry, choose, open, gate            | `apps/live/components/canvas/tab-window/tab-window-context.test.tsx`                              |
| Export targets, arts, nesting, drawing in the tab SVG           | `apps/live/components/dialogs/useTabWindowExport.test.ts`                                         |
| What plays in a window, its classes and style, stills elsewhere | `apps/live/components/canvas/tab-window/tab-window-motion.test.ts`                                |
| Palette tile in Pages mode's Media only, not a whiteboard shape | `palette-tile-defs.test.tsx`, `toolbar-strip-tiles.test.ts`, `whiteboard-shape-catalogue.test.ts` |

## Constants and configuration

| Constant               | Value                                                   | Why                                                                               |
| ---------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `TAB_WINDOW_SIZE`      | 640 x 360                                               | 16:9, a slide's own shape                                                         |
| `TAB_WINDOW_RADIUS`    | 12                                                      | The editor's card corners                                                         |
| `TAB_WINDOW_HAIRLINE`  | `#cbd5e1`                                               | slate-300, the frame on any paper                                                 |
| `TAB_WINDOW_EMPTY`     | light `#f8fafc` / `#64748b`; dark `#1e293b` / `#94a3b8` | slate grounds and ink for each paper                                              |
| `TAB_FETCH_FOLLOW_MAX` | 3 (`usePerTabLoad`; safe 1 to 5)                        | A cancelled fetch's replacements followed before leaving the tab to its own visit |
