# Logo pages blueprint

Derived from [Logo pages](../logo-pages.md). The Illustrate page machinery it extends is in
[Illustrate pages](illustrate-pages.md); this blueprint names only what the logo kind adds or
changes.

## Domain and naming

| Spec term            | Identifier                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| logo page            | `IllustratePage` with `kind: 'logo'`; `PageKind` member `'logo'`                                         |
| artboard             | `PageSizeId` `'logo'`; `LOGO_SIDE` (1024)                                                                |
| safe area            | `pageMargin(page)` for the `'logo'` size (`LOGO_SAFE_FRACTION`)                                          |
| construction guides  | `LogoGuides` (geometry, `logoGuides(rect)`); views `LogoGuidesSvg`, `LogoPageGuides`                     |
| guide part, strength | `LogoGuidePart`, `LogoGuideStrength` (`apps/live/lib/logo-guide-prefs.ts`)                               |
| keyline              | `LogoGuides.keylineCircle`, `.innerCircle`, `.keylineSquare`                                             |
| mirror               | `LogoToolsView.mirrorOn(pageId)`, `mirrorSettings(pageId)`; `MirrorSettings`; `withMirrorTwins`          |
| twin                 | what `twinFor(el, pages, use)` returns                                                                   |
| Mirror Copy          | command id `mirror-copy`; `mirrorCopies`; `LogoToolsView.mirrorCopy`                                     |
| wordmark type        | `TextElement.letterSpacing`, `.fontWeight`, `.textCase`, `.textArc`; `hasWordmarkType(el)`               |
| combine              | `CombineOp` (`'unite' \| 'subtract' \| 'intersect' \| 'exclude'`); `combineElements`; `useCombineShapes` |
| combinable           | `isCombinable(el)`; `combinableSelection(...)`                                                           |
| contour              | `PathElement.nodes` (the first) and each of `PathElement.subpaths`; `pathContours(el)`                   |
| logo kit             | `exportLogoKit`; `LOGO_KIT_PNG_SIZES`; `encodeIco`; Export dialog format `'logo-kit'` (`LogoKitPanel`)   |
| guide preferences    | `UserPreferences.logoGuides` (absent is on), `.logoGuidesHidden`, `.logoGuideStrength`                   |

No synonyms: the UI says **Logo**, **Guides**, **Mirror**, **Combine** (Unite, Subtract, Intersect,
Exclude), **Wordmark**, **Logo Kit**.

## Constants and configuration

| Constant                        | Value                                         | Where                                                      | Provenance / safe range                                         |
| ------------------------------- | --------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| `LOGO_SIDE`                     | 1024                                          | `packages/document/src/illustrate-page.ts`                 | The largest common app-icon master; 512 to 2048                 |
| `LOGO_SAFE_FRACTION`            | 0.1                                           | `packages/document/src/illustrate-page.ts`                 | Spec; 0.05 to 0.15                                              |
| `LOGO_KEYLINE_CIRCLE`           | 0.8 (diameter / side)                         | `packages/document/src/logo-page.ts`                       | Inscribed in the safe area                                      |
| `LOGO_INNER_CIRCLE`             | 0.5                                           | `packages/document/src/logo-page.ts`                       | Spec                                                            |
| `LOGO_KEYLINE_SQUARE`           | 0.64                                          | `packages/document/src/logo-page.ts`                       | Spec (Material's 18/24 of the 20/24 live area, rounded)         |
| `LOGO_GRID_DIVISIONS`           | 8                                             | `packages/document/src/logo-page.ts`                       | Spec                                                            |
| `LOGO_GUIDE_ALPHA`              | faint .2/.08, medium .35/.15, strong .6/.3    | `apps/live/lib/logo-guide-prefs.ts`                        | Guides / grid opacity per strength                              |
| `MIRROR_AXIS_TOLERANCE`         | 0.01 (of the artboard's width)                | `packages/document/src/element-mirror.ts`                  | Spec; 0.005 to 0.03                                             |
| `LETTER_SPACING_MIN` / `_MAX`   | -0.2 / 1 (em)                                 | `packages/document/src/wordmark.ts`                        | Spec                                                            |
| `TEXT_ARC_MAX`                  | 360 (degrees, either sign)                    | `packages/document/src/wordmark.ts`                        | Spec                                                            |
| `FONT_WEIGHTS`                  | 400, 500, 700                                 | `packages/document/src/wordmark.ts`                        | The weights `fonts.ts` loads for every catalogue font           |
| `ARC_ASCENT` / `ARC_DESCENT`    | 0.8 / 0.25 (em)                               | `packages/document/src/wordmark.ts`                        | Room kept for glyphs above / below the arc's baseline           |
| `COMBINE_TOLERANCE_PX`          | 0.25                                          | `apps/live/lib/combine/outline.ts`                         | Spec ("a quarter of a pixel")                                   |
| `COMBINE_MERGE_PX`              | 0.05                                          | `apps/live/lib/combine/simplify.ts`                        | Collinear merge distance; well under a device pixel             |
| `COMBINE_MAX_INPUT_POINTS`      | 50,000                                        | `apps/live/lib/combine/combine.ts`                         | Refused above as Too detailed; measured runs stay under 4 ms    |
| `MAX_PATH_NODES`                | 5,000 (existing; now across all contours)     | `packages/document/src/validate.ts`                        | Existing                                                        |
| `LOGO_KIT_PNG_SIZES`            | 16, 32, 48, 64, 128, 180, 192, 256, 512, 1024 | `apps/live/lib/export-logo-kit.ts`                         | Spec                                                            |
| `LOGO_ICO_SIZES`                | 16, 32, 48                                    | `apps/live/lib/export-logo-kit.ts`                         | Spec                                                            |
| `BUTTON_ROOM` / `LABELLED_ROOM` | 28 px / 72 px                                 | `apps/live/components/canvas/LogoTitleBar.tsx`             | Title-bar room a control takes, icon-only / named               |
| `SNAP_POINTS_NEAR_PX`           | 64 px                                         | `apps/live/components/canvas/GuideSnapPoints.tsx`          | Screen px round the pointer within which a guide crossing shows |
| `RADIAL_COPIES`                 | 3, 4, 5, 6, 8                                 | `packages/document/src/element-symmetry.ts`                | A radial mirror's choices of copies                             |
| `DEFAULT_MIRROR`                | Vertical, 6 copies, merge on                  | `packages/document/src/element-symmetry.ts`                | Mirror settings before any are chosen                           |
| `THUMB_W`                       | 120 px                                        | `apps/live/components/canvas/infographic-layout-thumb.tsx` | Two layout tiles to a row (user request, every kind)            |

## Data and persistence

- `IllustratePage.kind: 'logo'`, stored. `parsePage` reads a logo page as `{ id, orientation:
'portrait', size: 'logo', background (fill only), name, kind: 'logo' }`: any other stored size, a
  pattern and a flow are dropped. A non-logo page stored with `size: 'logo'` is read as A4
  (`PAGE_SIZES.logo.logoOnly`).
- `PageSizeId` gains `'logo'` (1024 x 1024, labelled `1024 x 1024`, `logoOnly`);
  `pageSizesFor('logo')` is `['logo']`; no other kind offers it.
- `TextElement` gains, all optional and absent on every existing element: `letterSpacing` (em,
  -0.2..1), `fontWeight` (400 | 500 | 700), `textCase` (`'upper' | 'lower'`), `textArc` (degrees,
  -360..360). Listed in `element-fields.ts`; validated in `validate.ts` (`TEXT_FIELD_CHECKS`), an out
  of range value refused with its rule. The controls clamp before writing (`clampLetterSpacing`,
  `clampTextArc`) and store 0 as absent.
- `PathElement` gains `subpaths?: PathNode[][]`: further closed contours, only with `closed: true`,
  3 or more nodes each, all contours within `MAX_PATH_NODES`; refused as `subpaths` otherwise.
  Present means even-odd fill (no stored rule).
- `UserPreferences.logoGuides?: boolean` (absent on), `logoGuidesHidden?: string[]` (parts hidden;
  none is absent; unknown ids ignored), `logoGuideStrength?: 'faint' | 'medium' | 'strong'` (absent
  is medium). Synced like every preference.
- Session only, never stored: the mirrored pages (none at open).
- Per page, in this browser (`lib/logo-page-guides.ts`, local storage key
  `livediagram:v2:logo-page-guides`, `{ [pageId]: boolean }`, the latest `LOGO_PAGE_GUIDES_MAX`
  = 200): a page's own Show Guides; absent follows `logoGuides`. Not a synced preference: the
  api caps preferences at 4 KB.
- Migration: none. Older readers see `kind: 'logo'` as infographic and the artboard as A4; they
  ignore `subpaths` (first contour drawn) and the wordmark fields (flat text).

## Behaviour and state

### Page model (`packages/document`)

- `illustrate-page.ts`: `PageKind`, `PAGE_SIZES.logo`, `LOGO_PAGE_SIZE_IDS`, `pageSizesFor`,
  `parsePage` logo branch, `pageKindOf`, `newLogoPage(id)`, `PAGE_KIND_LABEL.logo = 'Logo'`,
  `pageMargin` (`LOGO_SAFE_FRACTION` for the logo size). The label reads `1024 x 1024 · Logo`.
- `article-pages.ts` `withPageKindChosen(tab, pageId, 'logo', flow)`: the only page becomes
  `newLogoPage(id)` keeping its name and fill.
- `logo-page.ts`: `logoGuides(rect)` (centre, diagonals, safe area, keyline and inner circles, keyline
  square, the grid's 14 inner lines); `logoPageSnapBoxes(pages)` (boxes `logo-inner:<id>`,
  `logo-keyline:<id>`); `logoPageAt(pages, point)`.

### Page edits (`apps/live/hooks/editor/illustrate-page-edits.ts`)

- `KIND_CHOSEN_EVENT.logo = 'PageKindLogo'`, `KIND_ADDED_EVENT.logo = 'LogoPageAdded'`.
- `addPage('logo')` appends `newLogoPage(id)`; the infographic model skips logo pages.
- `setSize` refuses any size on a logo page and `'logo'` on any other; `setOrientation` refuses;
  `setBackground` refuses a pattern on a logo page.
- `removePage` (every kind, user request): before the commit, `onGoTo` the page before the deleted
  one (its unit's last page), or the next unit's first page when the first goes; `useIllustratePages`
  frames it with a glide once it is in the row (`frame(page, false, true)`).

### Kind UI

- `page-kind-cards.tsx`: the Logo card and `LogoMiniature`; `AddPagePopover` and `FirstPageChoice`
  lay the cards out two by two (Up / Down step a row, `KIND_COLUMNS`). The first-page card and the
  in-page layout card are solid (`bg-white`, `dark:bg-slate-900`); the layout card's list scrolls
  past 380 px.
- `IllustratePagePanel.tsx`: a logo page has the Background and Layouts tabs (`pagePanelTabs`
  drops Page: one size, no orientation); Pattern is hidden for logo.
- `IllustratePages.tsx`: a logo page's title bar holds, before the cog, `LogoTitleBar pageId`
  (Beside the cog, below), its room reserved by `logoTitleBarRoom`; an
  empty logo page draws its guides first in the page's own box (under its cards); the layout card
  shows on an empty logo page.

### The Logo palette

- Merged and combined pen strokes: `combine.ts` `styleOf` gives a freehand without a `strokeColor`
  its `penColour` (else `INK_PEN_COLOUR`) and `strokeWidth: 'none'`; `resolveStockColours` fills a
  closed path with no outline from its `penColour` per surface.
- `PALETTE_CATEGORIES` gains `logo` (Common band, `LogoTabIcon`, a pen nib); the Illustrate layout
  lists it after Popular with `tiles: ['logo:pen', 'tools:pencil', 'tools:text', 'shapes:square', 'shapes:circle',
'shapes:diamond']` and `logoOnly: true`.
  `paletteCategoriesFor(mode, { esBoard, logoPages })` drops a `logoOnly` entry unless
  `logoPages`. `CommandPaletteProps.logoPages` (and the Toolbar strip's) is
  `illustratePages.pages.some(kind === 'logo')`, passed by `useCanvasChromePanels` and
  `CanvasChrome`.
- `logo:pen` (section `logo`, `ShapePenIcon`): action `{ type: 'path' }`, handled by
  `PaletteTileActions.beginPath`, threaded from `useShapeDrawing.beginPath` (`beginDraw({ type:
'path' })`) through `useEditorState`, `EditorCanvasHost`, `onBeginPath` and
  `usePaletteCatalogue`.
- Markers: `useLogoMarkerTiles(logoPages)` (`components/palette/PaletteLogoTab.tsx`) appends
  `markerTiles` of the live dock model's pens (else `loadWhiteboardPrefs`) to the category, each
  action `once: true`; `tileHandler` calls `beginMarker(penId, true)`, so the strip's markers arm
  for one stroke. The intent's `once` makes `commit-freehand` put the pen down after its stroke and select it.
- The strip's marker tiles: `PaletteTile` hands a marker tile to `MarkerPaletteTile`
  (`components/palette/MarkerPaletteTile.tsx`): not held, the tile's action; held
  (`tileActive`), toggles `WhiteboardFlyout` (`placement: 'below'`, `scope:
[data-marker-tile="marker-tile-<tile id>"]`) with `PenFlyoutBody`, its `updatePen` wrapped to
  re-arm the marker.
- The category's tab body is `PaletteLogoTab`: the non-marker tiles as `PaletteToolRows`, then
  **Markers**, each a `MarkerRow` over `PaletteToolRow` (now exported, with `onPress`, `anchor`
  and `expanded`): not held, `beginDraw({ ...whiteboardPenIntent(pen, recognise), once: true })`
  from the model's pen; held (`markerArmed`), toggles Draw mode's `WhiteboardFlyout`
  (`placement: 'below'`, `scope: [data-palette-logo]`, opener `data-dock-item`
  `logo-marker-<id>`) with `PenFlyoutBody`, its `updatePen` wrapped to re-arm with the patch.
- Alignment off a whiteboard: `isFreePenIntent(intent, whiteboard)` (`lib/draw-mode.ts`).
  `useCanvasDrawGesture({ whiteboard })` starts a marker's stroke at `snapDrawStart` and shows the
  pre-press dot unless free; `Canvas` passes the live stroke's points as `penPoints` off a
  whiteboard, and `computeDrawGuides({ whiteboard })` guides off their box.
- `useLogoPaletteSwitch(pages, active)` (`hooks/canvas/useLogoPaletteSwitch.ts`), called by
  `IllustratePages` (an editor, not bare), returns `pageShown(page)`, which `IllustratePages`'
  `goToPage` (the page label and the `PageNavigator`) calls after `focusPage`. It keeps the page
  someone was last on (a press off every page keeps it) and, when that changes, asks
  (`requestPaletteCategory`, in a zero timeout, after React renders; a timeout so a background
  tab answers) for `'logo'` on a logo page, else `'popular'`: on `pageShown` and a capture-phase
  `pointerdown` on a sheet. A logo page id not seen before asks for `'logo'`. On the first render
  with pages, the page under the canvas centre (`[data-canvas-a11y-root]`), else the first, asks
  for `'logo'` only (again after `LOGO_PALETTE_OPEN_RETRY_MS`, 400, for a palette that mounts
  later); any other page asks nothing.

### Beside the cog (`apps/live/components/canvas/LogoTitleBar.tsx`)

- Before the cog, cog-sized (`h-6 w-6`) `Tooltip` buttons: Tidy Up (`lucideWandSparkles`; a
  `TidyUpButton` re-rendered by `useSelectionOf`, mounted only with the editor context and a
  selection store, `useHasSelectionStore`), Mirror (`MirrorAxisGlyph` of the page's axis) and
  Guides (`lucideGrid3x3`), each `aria-pressed` while on. Both are `TitlePopoverButton`s
  (`components/canvas/TitlePopoverButton.tsx`: the button, then an `AnchoredPopover` of 248 px
  named after it). Guides is `LogoGuidesButton` (`components/canvas/LogoGuidesPopover.tsx`)
  holding `LogoGuidesSettings`: the Show Guides `SwitchRow` for the page, then the part tiles and
  the Strength `SegmentedRadio` (`components/primitives/SegmentedRadio.tsx`), dimmed while off.
  Mirror is `LogoMirrorButton` (`components/canvas/LogoMirrorPopover.tsx`) holding
  `LogoMirrorSettings`: the Mirror While Drawing `SwitchRow` (`setMirror`), the Axis radio tiles
  (`MIRROR_AXES`, each with its `MirrorAxisGlyph`), the Copies `SegmentedRadio` (`RADIAL_COPIES`)
  while Radial, and the Merge Into One `SwitchRow` with its line, all via `setMirrorSettings`,
  dimmed while off. Mirror and Guides show their names beside the icon unless
  `useIsMobileViewport()`. `logoTitleBarRoom(true, !mobile)` (28 px for Tidy Up, 72 px each
  named or 28 px each icon-only) is reserved from the label.
- Layout tiles: `LayoutThumb` hands a logo page's tile to `LogoLayoutThumb`
  (`components/canvas/logo-layout-thumb.tsx`) when `EditorContext` has an `activeTab` (else the
  wireframe): `logoLayoutSvg(tab, page, layout)` = `renderTabToSvg({ ...tab, elements:
buildPageLayout(layout, page) }, { page })`, memoised on the layout, the page's rect and
  background, the tab's theme and font, and `useIconCatalogs()`; set as the markup of a div of the
  tile's width and the page's aspect. Measured 0.04 ms a layout.
- The in-page card is `EMPTY_PAGE_LAYOUTS_WIDE_WIDTH` (560) with `LayoutBrowser wide` (four
  columns, tiles `WIDE_THUMB_W` 104 px) when `page.rect.width * zoom` holds it and
  `LAYOUT_CARD_MARGIN` either side, else `EMPTY_PAGE_LAYOUTS_WIDTH` (340, two columns).
- Start From Scratch: `EmptyPageLayouts` renders `DashedAddButton` (`components/primitives/
DashedAddButton.tsx`, shared with `AddCardTypeButton`) labelled **Start From Scratch** on a logo page,
  calling `onBlank`: `IllustratePages` tracks `UI · Closed · EmptyPageLayoutsBlank` and calls
  `edit.startBlank(pageId)`, which sets `IllustratePage.startedBlank: true` (refused on a locked
  page); `showsLayoutCard` skips a page with it. Hide stays the session-only `layoutsHidden`.

### Guide snapping

- `logoGuideSnapTargets(guides, shows)` then `snapToGuideTargets(targets, p, radius)`
  (`packages/document/src/logo-guide-snap.ts`; `snapToLogoGuides` does both for one-off use): the
  shown guides as segments (rect edges for Safe Area and Square) and circles; the nearest pairwise
  crossing within `radius` wins, else the nearest point on a segment or circle; null beyond.
- `logoGuideSnapper(pages, { on, parts })` (`apps/live/lib/logo-guide-snapping.ts`): null while the
  guides are off; else `(p, zoom)` snapping on the logo page under `p` within
  `LOGO_GUIDE_SNAP_PX / zoom` (8). `useLogoEditor` builds it, composes it into `view.logo.snapPoint`
  and keeps it in a ref for its commit.
- Pen: `Canvas` passes `snapPoint` to `usePathTool` and on to `usePathDrawGesture`, which snaps
  the press (not with the edit pointer held) and the hover cursor.
- Strokes: `drawCommit` maps through `snapNewStrokes(before, next, snap, getZoom())` before
  `withMirrorTwins`: each newly added open, unrotated freehand has its first and last points
  snapped, the shift easing over 8 samples, repacked with `packFreehandPoints` (pressures kept).

### Where a drawing can start (`apps/live/components/canvas/GuideSnapPoints.tsx`)

- Mounted by `LogoCanvasOverlays` (`components/canvas/LogoCanvasOverlays.tsx`, `Canvas`'s one
  mount for a logo page's canvas-layer overlays: `LogoPageGuides`, `GuideSnapPoints` and the two
  live twins) for an editor in Illustrate. While
  `drawsOntoGuides(pendingDraw)` (the Path tool, or a freehand intent that is not the highlighter
  or the shape pen) and `logo.snapPoint` exists, it follows the pointer (window `pointermove`, one
  update a frame) in canvas px; over a logo page with `guidesOn`, it draws the page's
  `logoGuideSnapTargets` crossings within `SNAP_POINTS_NEAR_PX` (64 screen px) of the pointer
  (2.5 screen px dots, cyan at 55%) and a 6 screen px ring at `snapPoint(cursor, zoom)`; nothing
  when neither, or while the page's `[data-empty-page-layouts="<page id>"]` card is in the DOM.
- A marker's live twins: `MirroredDraft at={penStroke.points[0]}` takes `pageMirrorMaps` (every
  map of the mirrored page under the start, no on-axis tolerance), since the canvas does not
  re-render as the live stroke grows.

### Tidy Up

- `tidyUpStroke(el, snap?)` (`apps/live/lib/stroke-tidy.ts`): freehand (not highlighter, unrotated,
  3+ points) or an open path whose nodes are all handle-less corners; each line through
  `simplifyLine` (`lib/simplify-line.ts`, shared with `mirror-merge`) at `max(2, 0.05 * diagonal)`;
  a single line whose ends meet within twice that closes (its last corner dropped); each corner
  through `guides.point` and pinned where it snapped (`logoTidyGuides(guidedPages, parts, zoom)` in
  `lib/logo-guide-snapping.ts`: `TIDY_GUIDE_PX` = 16 screen px, the prepared targets, `x`/`y` the
  nearest vertical / horizontal guide line); `squareUp(pts, closed, pinned)`: every segment within 12 degrees of level unions its
  corners' y, of upright their x (union-find, the closing segment of a closed shape included),
  each group settling to a pinned member's value, else the mean moved onto `guides.x`/`guides.y`
  when within reach; a closed result is `fillColor: 'transparent'` unless the source was a filled
  closed pencil stroke; `lineStyle` names Ink for a marker with no colour; `dropInline`; `pathOfContours` with `lineStyle` (marker `penWidth` to the
  nearest `BORDER_STROKE_PX`).
- `useTidyUpStrokes` (`hooks/canvas/useTidyUpStrokes.ts`): `canTidyUp` and `tidyUpSelected`
  (one commit, ids kept, locked skipped), `Element · Changed · StrokesTidiedUp`; composed by
  `useLogoEditor` and returned by `useEditorState`.

### Mirror's live twins and merge

- `symmetryMapsFor(pages, box)` (`packages/document/src/element-symmetry.ts`) is the one rule for
  which maps a box repeats under, used by `symmetryTwins` and by the live twins.
- Live twins (`components/canvas/MirrorReflection.tsx`): `SymmetryCopies` renders its children once
  per `SymmetryMap`, each in a div transformed by `matrix(a, b, c, d, e, f)` from the origin.
  `CanvasDrawPreview` (given `mirrorPages`, `MirroredPage[]`) renders its pencil, polygon and box
  drafts again inside fixed `SymmetryCopies`, the maps from `draftMirrorMaps` over the draft's box
  (`drawnDragBox`, or `pointsBox`) carried to screen px by `toScreen(m, origin, zoom)`
  (`e' = ox − (a·ox + c·oy) + zoom·e`, likewise `f'`). `LogoCanvasOverlays` renders
  `MirroredPathDraft` after the path draft: the `PathDraftLayer` without anchors, handles or ring.
- Merge (`apps/live/lib/mirror-merge.ts`, `mergeWithTwins(el, twins)`), run by `withTwinsAdded`
  for each newly added element with twins while its page's `mirror.merge`: open lines (open paths,
  or open non-highlighter strokes, markers included, simplified to corners within 0.75 px) become
  `pathOfContours({ id, type: 'path', closed: false, ...stroke style })` of all; combinable
  elements become `combineElementsNow([el, ...twins], 'unite', el.id)`; otherwise null and the
  twins are appended. `combineElementsNow` returns null until the engine has loaded;
  `setMirror(true)` and a settings change with merge on call `preloadCombineEngine()`.
- `PathElement.subpaths` may now be open contours on an open path (two nodes or more each).

### Logo tools (`apps/live/hooks/editor/useLogoTools.ts`)

- `useLogoTools({ mirrorRef, prefs, applyPrefs, activeTab, pages, currentSelectionIds, commit,
setSelectedId, setMultiSelectedIds, readOnly })` returns the `LogoToolsView`:
  `guidesOn(pageId)`, `setGuides(pageId, on)` (`withLogoPageGuides`), `guideParts`,
  `setGuidePart`, `guideStrength`, `setGuideStrength`, `mirrorOn(pageId)`, `setMirror(pageId,
on)` (which also calls `preloadCombineEngine()` when turned on), `mirrorPages`
  (`ReadonlyMap<pageId, MirrorSettings>`, mirrored into `mirrorRef`), `mirrorSettings(pageId)` (the
  page's own, else the last chosen, else `DEFAULT_MIRROR`), `setMirrorSettings(pageId, patch)`
  (tracks `LogoMirrorAxis<Axis>` / `LogoMirrorCopies<n>` / `LogoMirrorMerge<On|Off>`; stores the
  page's settings and the last chosen; applies at once while on; an axis also turns the page on),
  `canMirrorCopy`, `mirrorCopy`. `mirroredLogoPages(pages, tools)` gives the mirrored pages with
  their settings (`withMirrorSettings`; null for none), what `LogoCanvasOverlays` and `CanvasChrome` hand the live twins; `useLogoEditor` keeps the
  guided pages (`guidesOn`) for the snapper and `logoPageSnapBoxes`.
  The panel's part tiles and Strength send the same telemetry as the Settings rows.
- `mirrorRef` (a `ReadonlySet<string>`) is assigned (`useAssignRef`) the mirrored pages, empty
  when read-only. Switches track before changing.
- `mirrorCopies(elements, ids, pages)`: `duplicateElements` of the eligible selected elements (fresh
  ids, no comments or actions), each reflected by `twinFor(copy, pages, 'copy')`; `mirrorCopy`
  appends them in one commit and selects them.
- `useLogoEditor` (`apps/live/hooks/editor/useLogoEditor.ts`) is the editor's one call for logo
  pages: the mirror-aware `drawCommit`, the tools (with a stable `applyPrefs`), Combine, the pages' view with `logo` composed in, and the snap boxes.

### Guides and snapping

- `LogoGuidesSvg({ page, tools })`: one SVG at the canvas origin, overflowing to the page, drawing
  the shown parts at `LOGO_GUIDE_ALPHA[strength]` in `#06b6d4` with a non-scaling 1 px stroke; the
  vertical centre line solid at 1.5 px while mirror is on.
- `LogoPageGuides({ view, bare })` (mounted after the elements in `Canvas.tsx`) draws the guides of
  logo pages **with content**; `IllustratePages` draws an empty logo page's inside its own box.
  `showsLogoGuides(view, bare)`: not bare (zen, presenting, isometric), an editor, Show Guides on.
- `useLogoEditor` appends `logoPageSnapBoxes(pages)` to the page snap boxes while Show Guides is on.

### Mirror (`packages/document/src/element-symmetry.ts`, `element-mirror.ts`, `apps/live/lib/mirror-commit.ts`)

- `MirrorSettings { axis: 'vertical' | 'horizontal' | 'both' | 'radial'; copies; merge }`,
  `DEFAULT_MIRROR` (vertical, 6, merge), `MIRROR_AXES`, `RADIAL_COPIES` (3, 4, 5, 6, 8);
  `MirroredPage = LaidOutPage & { mirror }`, `withMirrorSettings(pages, map)` (logo pages only),
  `mirroredPageAt(pages, point)`.
- `symmetryMaps(rect, settings)`: `SymmetryMap`s about the page centre `(cx, cy)`, the identity
  left out: vertical `[reflectV(cx)]` (`turn: r → −r`); horizontal `[reflectH(cy)]`
  (`turn: r → 180 − r`); both `[reflectV, reflectH, turnAbout(180)]`; radial
  `turnAbout(k·360/n)` for `k = 1 … n − 1` (`turn: r → r + deg`, clockwise on screen).
- `mapElement(el, m)`: a freehand's canvas points (its rotation applied first, then dropped)
  mapped, re-boxed and re-encoded with their pressures; a path's world anchors and handles mapped
  and rebuilt by `pathOfContours` (rotation dropped); anything else keeps its size, its centre
  mapped and its rotation `m.turn(r)` normalised to `[0, 360)` (0 dropped).
- `symmetryMapsFor(pages, box)`: the maps of the mirrored page under the box's centre, less any
  moving that centre by no more than `2 · MIRROR_AXIS_TOLERANCE` of the page width.
  `symmetryTwins(el, pages)`: for a stroke, path or shape only. `mirrorAxisLines(rect, settings)`:
  the lines `LogoPageGuides` draws solid (a faint centre line under a solid one is skipped).
- Mirror Copy keeps `twinFor(el, pages, 'copy')` and `mirrorElement` (the vertical reflection).
- `withMirrorTwins(commit, mirrorRef, pagesRef)`: the commit the draw tools add through
  (`useShapeDrawing` and `usePathCommits` get `useLogoEditor`'s `drawCommit`). On the pages mirror
  is on for (`withMirrorSettings`, only those handed to `withTwinsAdded`), every element the commit
  adds (an id not there before) gets its twins in the same commit, merged or with fresh ids;
  `Element · Created · MirrorTwin` once per twinned commit.

### Wordmark type (`packages/document/src/wordmark.ts`, `svg-render-wordmark.ts`)

- `hasWordmarkType`, `wordmarkDisplayText`, `resolvedFontWeight` (`fontWeight ?? (textBold ? 700 :
400)`), `clampLetterSpacing`, `clampTextArc`, `arcText` (line breaks as spaces), `arcGeometry(box,
arcDeg, fontPx)`: under 180 degrees an arc whose chord spans the box width less padding, its band
  centred; from 180 a circle centred in the box of radius `min(w, h) / 2 − (ARC_ASCENT or
ARC_DESCENT) × fontPx` (floored at fontPx), centred on the top (up) or the bottom (down), drawn as
  two half arcs.
- Canvas: `labelTextStyleCss` handles `letterSpacing`, `weight`, `lowercase`; `wordmarkTextStyle(el)`
  feeds the display label (`element-labels.tsx`, `ScalingLabel`, `RichLabel`) and the live editor
  (`RichTextEditor`), so editing never shifts. `textArc` renders `WordmarkArcLabel` (SVG `textPath`,
  font size `labelFontPx(textSize) × textScale`); the editor shows the text flat.
- Export: `svgBoxed` routes wordmark text to `svgWordmarkLabel`: flat through `svgWrappedLabel` or
  `svgRichWrappedLabel` with `WordmarkAttrs` (letter-spacing in px, the weight for non-bold runs),
  the case applied to the string, wrapping measured with `trackedMeasure`; arched as a `<path>` and a
  `<textPath>` in a translated group, with its underline or strikethrough. Rich text wraps counting
  its tracking (`wrapExportRuns`' `trackingPx`), measured on the label's base size
  (`WordmarkAttrs.basePx`) as the canvas does. `boxedNeedsSvgRaster` is true for wordmark text.
- Controls: `WordmarkSection` in the Text flyout (`ElementAppearanceSections`), offered when
  `wordmarkOffered` (the host: a text whose centre is on a logo page). `applyWordmarkToEl(el, patch)`
  (`style-presets.ts`); `previewWordmark` / `commitWordmark` in `useStylePreview`, the telemetry type
  named by the patch's field. Sliders (the shared `MenuSliderRow`) preview while moving and commit
  once on release, comparing with where the drag began (the preview has already written the live
  element).
  The Bold toggle (`withTextStyle`) clears `fontWeight`.

### Combine (`apps/live/lib/combine/`, `packages/document/src/shape-area.ts`)

- `shapeAreaContours(el, tolerance)`: the area out to the box's edge; square and stadium as rounded
  rings, a circle as an ellipse, table kinds by their filled parts (`partLines` with
  `outlineSegments(r, tolerance)`); devices and the actor have none (`hasShapeArea`).
- `isCombinable`: a shape with an area (not self-painting), a closed path, a closed freehand or a pen
  stroke (not a highlighter). `elementRings(el)`: canvas rings, rotation applied; a path's contours
  sampled with the adaptive curve count.
- `combineElements(ordered, op, newId)`: refuses fewer than two or any non-combinable
  (`not-combinable`) and inputs over `COMBINE_MAX_INPUT_POINTS` (`too-detailed`); loads
  `polygon-clipping` on first use (reading its default export); resolves each element's own area
  first (a path's contours by `xor`, other pieces by `union`); runs the op; `multiPolygonToPath`
  simplifies the rings (`simplifyRing`), refuses an empty result (`empty`) or one over
  `MAX_PATH_NODES` (`too-detailed`), and builds the path: box from the bounds, corner nodes
  normalised, the first contour as `nodes`, the rest as `subpaths`, the bottom element's style
  (`styleOf`: a freehand's stroke colour as the fill, with no line). Engine failures are `failed`.
- `useCombineShapes`: `combinableSelection(elements, ids, pages)` (two or more, unlocked, combinable,
  centres on one logo page) gates `canCombine`; `combineSelected(op)`, once the engine answers, gives up if any input changed
  meanwhile (by identity, against the latest tab), else commits the path in the bottom-most input's
  place, drops the inputs and the arrows pinned to them, and selects the path; it toasts on failure.
- Offered by `MultiSelectionToolbar` (`CombineMenuButton`, sharing `toolbar-buttons.ts`), the multi-selection menu
  (`MultiPlacementSections`) and the command palette (`combine-<op>`).
- A compound path: `pathElementD` draws every contour, `fill-rule: evenodd` on the canvas (`PathSvg`)
  and in export (`svgPathElementShape`); `pathTouchesBrush` hits even-odd; `usePathTool` treats it as
  not editable and toasts once on an edit attempt; the toolbar offers no Edit points.

### Export

- `pageExportFrame(page, { transparentPaper })` leaves out a logo page's plain paper
  (`transparent: true`); `renderTabToCanvas` then skips the white fill. `exportPages` passes it for
  PNG and SVG; PDF never does.
- `export-logo-kit.ts`: `exportLogoKit(tab, page, opts)` (the SVG through `exportTabAsSvg` so fonts
  embed; one raster at 1024 px; each PNG by `downscale`, halving then one high-quality draw;
  `favicon.ico` by `encodeIco`; zipped by `writeZip`); `logoKitFileNames`; `logoKitFileName(document,
page, count)`.
- `ExportTabDialog`: the `'logo-kit'` card while the tab has a logo page; `LogoKitPanel` owns the rest (a page picker when several, a checkerboard preview, Download .zip,
  busy and error) from the images the dialog loaded; `Document · Exported · LogoKit`.

### Layouts (`packages/templates/src/logo-layouts*.ts`, `logo-layout-kit.ts`)

- Twenty-five builders over the safe area: lockups (7), wordmarks (6), emblems (6), marks (6), on
  the shared kit (`word`, `tagline`, `rule`, `icon`, `stacked`, `arched`).
  `layoutCatalogueFor('logo')`; `pageLayoutById` searches the logo catalogue last.
- Thumbnails (`infographic-layout-thumb.tsx`, every kind): circles as ellipses, diamonds, hexagons,
  triangles, stars and stadiums by their outline, an unfilled shape as its line, arched text along
  its arc, and wordmark text as a bar sized to its words.

## Interfaces and contracts

- `newLogoPage(id: string): IllustratePage`.
- `logoGuides(rect: PageRect): LogoGuides`; `logoPageSnapBoxes(pages): ShapeElement[]`;
  `logoPageAt(pages, point): LaidOutPage | undefined`.
- `mirrorElement<T extends BoxedElement>(el: T, axisX: number): T`; `twinFor(el, pages, use)`.
- `arcGeometry(box, arcDeg: number, fontPx: number): { d: string; length: number }`.
- `shapeAreaContours(el: ShapeElement, tolerance?): Point[][] | null`.
- `combineElements(els, op, newId): Promise<CombineResult>`.
- `encodeIco(images: readonly { size: number; png: Uint8Array }[]): Uint8Array`.
- `exportLogoKit(tab, page, opts?): Promise<Blob>`.
- Validation as in Data and persistence; OpenAPI regenerated (`pnpm --filter @livediagram/api
gen:openapi`).

## Errors and edge cases

| Case                                                  | Handling                                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| Stored logo page with another size, a pattern, a flow | Read as the artboard, pattern and flow dropped                                    |
| Non-logo page stored with `size: 'logo'`              | Read as A4                                                                        |
| Combine result empty                                  | `empty`, toast "Nothing left: these shapes don't overlap."                        |
| Combine inputs or result too detailed                 | `too-detailed`, toast "That combination is too detailed to keep as one shape."    |
| `polygon-clipping` fails to load or throws            | `failed`, error toast "Couldn't combine the shapes. Try again."; `[combine]` warn |
| A combined input deleted by someone meanwhile         | The commit leaves the elements as they are                                        |
| Element straddling two pages                          | Its centre decides the page                                                       |
| Arc text longer than its arc                          | Runs on along the circle (`textPath`)                                             |
| Wordmark on an empty label                            | Nothing drawn                                                                     |
| Mirror Copy of a locked element                       | The copy is unlocked                                                              |
| Edit points asked of a combined path                  | Not entered; toast "Combined shapes edit as a whole."                             |
| Logo kit export fails                                 | `[logo-kit]` warn; the dialog shows the error                                     |

## Security and trust

- No new endpoints. The new fields pass the shared validator with bounded ranges; `subpaths` sits
  within the existing `MAX_PATH_NODES`.
- Wordmark text and arc ids go through `xmlEscape` in exports.
- `polygon-clipping` runs on the client, on the person's own selection.

## Performance and limits

Measured (vitest on this branch):

- Combine: two 1024 px discs united 3.4 ms; a star less a disc 0.6 ms; twelve discs united 3.3 ms.
  The engine is its own chunk, 8.7 KB gzipped, referenced by no page's HTML (loaded on first
  Combine).
- Guide snapping: a page's targets (249 crossings with every part shown) prepared once in 0.64 ms
  and kept per snapper; a snap then 11 µs, so the Pen's per-frame hover snap is negligible.
  Guard: `logo-guide-snap.test.ts` runs 1000 prepared snaps under 500 ms (unprepared: about 1.75 s).
- Guides: geometry under 0.01 ms; one SVG per logo page. Snapping: two extra boxes per logo page.
- Kit: one 1024 px raster, smaller sizes by canvas downscale.
- Guard: `combine.test.ts` unites two maximally detailed discs under 500 ms.

## Presentation and UX

- Copy: card **Logo** "A square artboard for a logo, with guides and drawing tools."; tabs **Page**,
  **Layouts**, **Logo**; sections **Guides** (Show Guides, the six part tiles, **Strength**) and
  **Drawing** (Mirror Copy, "Reflects the selection across the centre line."); Mirror popover:
  **Mirror While Drawing**, **Axis** (Vertical, Horizontal, Both, Radial), **Copies**, **Merge Into
  One** ("Each drawing and its copies become one element." / "Each copy is its own element."); Wordmark: **Tracking**, **Weight** (Regular, Medium, Bold),
  **Case** (As Typed, Capitals, Lower Case), **Arc** with **Flat**; Combine: **Unite**, **Subtract**,
  **Intersect**, **Exclude**; commands `Unite Shapes`, `Subtract Shapes`, `Intersect Shapes`,
  `Exclude Shapes`, `Mirror Copy`; Export card **Logo Kit** ("An SVG, PNGs from 16 to 1024 px and a
  favicon.ico, in one .zip."), subtitle "Download a logo page as an SVG, PNGs and a favicon.",
  button **Download .zip**.
- Settings: Editor, then **Illustrate**: Logo Guides, Guide Strength, and Logo Centre Lines,
  Diagonals, Safe Area, Circles, Square and Grid, each "Also in a logo page's panel".

## Accessibility

- Switches are `role="switch"`; part tiles `aria-pressed`; Strength and the kind grid are radio
  groups; sliders are labelled with value text ("90 degrees").
- The toolbar, Combine and Mirror controls are named buttons with shared tooltips; the two
  toolbars are `role="toolbar"` with names; the page options' visible labels are `aria-hidden`
  beside their `aria-label`. Hidden toolbars take no pointer.
- Guides are `aria-hidden`. Only the toolbars' opacity fades, never under reduced motion.

## Web Experience

- Nothing new on the load path but the logo layouts (data in the templates package) and the small
  components; the engine is lazy.
  Chrome sits outside the document flow, so no layout shift.

## Observability

- `[combine]` warnings: `load failed`, `op failed` (op, element and point counts), `too detailed`.
- `[logo-kit]` warnings on a failed raster or export; `[illustrate-page]` debug logs on refusals.
- Telemetry as the spec lists; dashboard charts Logo Tools Used, Mirrored Drawings, Logo Mirror
  Switched, Logo Mirror Set Up, the Settings rows, and the existing Other Panels Opened and Exports.

## Testing

| Spec rule                                         | Test                                                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Logo page parsed, artboard, no pattern, label     | `packages/document/src/illustrate-page-logo.test.ts`                                                              |
| Guide geometry, snap boxes, page under a point    | `packages/document/src/logo-page.test.ts`                                                                         |
| Mirror rules                                      | `packages/document/src/element-mirror.test.ts`, `element-symmetry.test.ts`, `apps/live/lib/mirror-commit.test.ts` |
| Mirror popover and per-page settings              | `apps/live/components/canvas/LogoMirrorPopover.test.tsx`, `apps/live/hooks/editor/useLogoTools.pages.test.tsx`    |
| Mirror Copy                                       | `apps/live/hooks/editor/useLogoTools.test.ts`                                                                     |
| Wordmark fields, clamps, arc geometry, validation | `packages/document/src/wordmark.test.ts`                                                                          |
| Wordmark in export                                | `packages/document/src/svg-render-wordmark.test.ts`                                                               |
| Combined paths: draw, hit, validate               | `packages/document/src/path-contours.test.ts`                                                                     |
| Page edits, the delete glide                      | `apps/live/hooks/editor/illustrate-page-edits.test.ts`                                                            |
| Logo layouts fit the safe area                    | `apps/live/lib/logo-layouts.test.ts`                                                                              |
| Combine ops, style, empty, too detailed, budget   | `apps/live/lib/combine/combine.test.ts`, `apps/live/hooks/canvas/useCombineShapes.test.ts`                        |
| Wordmark controls and patch                       | `apps/live/components/palette/WordmarkSection.test.tsx`, `apps/live/lib/style-presets-wordmark.test.ts`           |
| Bold clears the weight                            | `apps/live/hooks/canvas/useTextStyleSetters-bold.test.ts`                                                         |
| Guides popover                                    | `apps/live/components/canvas/LogoGuidesPopover.test.tsx`                                                          |
| Guide preferences                                 | `apps/live/lib/logo-guide-prefs.test.ts`                                                                          |
| Transparency, kit names, ICO                      | `apps/live/lib/export-logo.test.ts`, `apps/live/lib/ico-writer.test.ts`                                           |
| Commands                                          | `apps/live/lib/editor-commands.test.ts`                                                                           |

## Assets and external resources

- `polygon-clipping@0.15.7` (MIT), from npm, a dependency of `apps/live`, listed on /licences by the
  build-time collector.
- Icons in layouts come from the existing line-art catalogue; no new images or fonts.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows D66 to D74 for `logo-pages`.
