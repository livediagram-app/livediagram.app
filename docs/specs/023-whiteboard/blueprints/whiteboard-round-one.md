# Whiteboard, round one: blueprint

Derived from [Whiteboard](../whiteboard.md), with [Event storming](../../021-event-storming/event-storming.md)
as the tab-kind precedent, [Highlighter](../../008-canvas/highlighter.md) for the held-tool pattern,
[Eraser panel](../../008-canvas/eraser-panel.md) for the erase gesture and
[Two pens instead of a pen and a mode](../../008-canvas/two-pens.md) for recognition. The spec decides;
this file adds engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                       | Role                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/document/src/tab-kind.ts`                        | `TabKind` gains `'whiteboard'`; `tabKindOf` reads it                     |
| `packages/document/src/whiteboard.ts`                      | Tokens, backgrounds, `isWhiteboardTab`, `inkWhiteboardElement`           |
| `packages/document/src/whiteboard-stroke.ts`               | Stroke geometry: `strokeTouchesBrush`, `eraseStrokePart`                 |
| `packages/document/src/svg-render-shapes.ts`               | `svgFreehandShape` honours `penWidth` on every stroke                    |
| `packages/api-schema` + `apps/api/src/openapi`             | `TabKind` enum regenerated; `Whiteboard` telemetry category              |
| `packages/templates/src/templates.ts`                      | `'whiteboard'` kind, descriptor, category, pattern, overrides            |
| `packages/templates/src/build-template.ts`                 | Whiteboard builds no elements                                            |
| `packages/template-previews/src/template-preview-5.tsx`    | Whiteboard preview tile                                                  |
| `apps/live/lib/whiteboard-prefs.ts`                        | Pens, widths, colours, recognition, eraser mode; parse / load / save     |
| `apps/live/lib/whiteboard-tool.ts`                         | Active-tool derivation, pen intent, shapes, pointer routing              |
| `apps/live/lib/pen-seen.ts`                                | Session-scoped "a pen has been used" flag                                |
| `apps/live/lib/whiteboard-ink.ts`                          | `createInkProjector`: the ink projection over a list, cached per element |
| `apps/live/lib/whiteboard-erase.ts`                        | `strokesTouched`, `partialEraseStep`: one pure eraser step               |
| `apps/live/lib/draw-mode.ts`                               | `PendingDraw` whiteboard pen variant and arrow `ends`; `isHeldPenIntent` |
| `apps/live/lib/draw-commit.ts`                             | `buildDrawnArrow` takes `ends` and `unpainted`                           |
| `apps/live/hooks/canvas/commit-freehand.ts`                | The whiteboard pen commit                                                |
| `apps/live/hooks/canvas/useCanvasEraser.ts`                | Whiteboard Stroke and Partial erase                                      |
| `apps/live/hooks/canvas/useWhiteboard.ts`                  | The dock's state and actions                                             |
| `apps/live/components/canvas/whiteboard/*`                 | `WhiteboardDock`, `WhiteboardFlyout`, dock icons                         |
| `apps/telemetry/app/*`                                     | `Whiteboard` colour, description, sentences and the Whiteboards stack    |
| `apps/live/components/canvas/boxed-element-overlays.tsx`   | `FreehandSvg` honours `penWidth` on every stroke                         |
| `apps/live/lib/style-presets.ts`                           | A border width clears a stroke's `penWidth`                              |
| `apps/live/lib/themes.ts`                                  | `resolveTabBackdrop` paints the board on a whiteboard                    |
| `apps/live/components/canvas/EditorCanvasHost.tsx`         | Ink projection; whiteboard props                                         |
| `apps/live/components/canvas/CanvasChrome.tsx` and friends | Hidden chrome; the dock's mount                                          |
| `apps/live/hooks/canvas/useCanvasSurfaceGestures.ts`       | Pen versus touch; the eraser frame                                       |
| `apps/live/components/canvas/useCanvasDrawGesture.ts`      | A pinch discards a whiteboard stroke                                     |
| `apps/live/components/palette/TemplatePicker*.tsx`         | Whiteboard quick-pick; no theme step                                     |
| `apps/help/app/canvas/whiteboards/page.mdx`                | Help article, registered in `packages/help-registry`                     |

## Domain and naming

| Term             | Identifier                                     | Meaning                                                  |
| ---------------- | ---------------------------------------------- | -------------------------------------------------------- |
| Whiteboard       | `kind: 'whiteboard'`, `isWhiteboardTab(tab)`   | A tab presented for freehand whiteboarding               |
| Board            | `WHITEBOARD_BOARD[appearance]`                 | The canvas colour of a whiteboard                        |
| Ink              | `WHITEBOARD_INK[appearance]`                   | The colour of every unpainted element on a whiteboard    |
| Pattern          | `WHITEBOARD_PATTERN[appearance]`               | The colour of the dots and grid lines                    |
| Background       | `WhiteboardBackground` (`plain/dots/grid`)     | A board's pattern, stored as `backgroundPattern`         |
| Pen              | `WhiteboardPen`                                | A preset: id, colour (`null` = Ink), width in px         |
| Pen width        | `WhiteboardPenWidth` (`fine/medium/bold`)      | 2, 4, 8 px, recorded as `penWidth`                       |
| Pen intent       | `PendingDraw` freehand `variant: 'whiteboard'` | The held pen, with its colour, width and recognition     |
| Dock             | `WhiteboardDock`                               | The floating bottom-centre toolbar                       |
| Dock tool        | `WhiteboardTool`                               | `select/pen/highlighter/eraser/sticky/text/shape`        |
| Flyout           | `WhiteboardFlyout`                             | A dock button's settings, opened above the dock          |
| Eraser mode      | `WhiteboardEraserMode` (`stroke/partial`)      | Whole-stroke or part-of-stroke erase                     |
| Ink projection   | `inkWhiteboardElement(el, ink)`                | Display-only colours for unpainted elements              |
| Pen seen         | `markPenSeen()`, `penSeen()`                   | A `pen` pointer has been used in this page session       |
| Whiteboard prefs | `WhiteboardPrefs`                              | Pens, active pen, recognition, eraser mode; device-local |

Banned synonyms: "canvas kind" for tab kind, "marker" for a whiteboard pen (the highlighter is the
marker), "rubber", "eraser size" on a whiteboard, "theme" for the whiteboard look.

## Behaviour and state

### Kind

- `TabKind = 'diagram' | 'event-storming' | 'whiteboard'`. `tabKindOf(tab)` returns `'whiteboard'`
  exactly when `tab.kind === 'whiteboard'`. `stampTabKind` is unchanged: a whiteboard always carries
  its kind explicitly, set by `templateCanvasOverrides('whiteboard')`.
- `isWhiteboardTab(tab)` is `tabKindOf(tab) === 'whiteboard'`.

### Creation

- `templateCanvasOverrides('whiteboard')` returns `{ kind: 'whiteboard', backgroundPattern: 'blank' }`.
  `buildTemplate('whiteboard', …)` returns `[]`. Category: `design` (nominal, like Blank: the picker
  shows it only as a quick-pick) (D1).
- Quick Start overview: `Blank`, then `Whiteboard`, then the category cards.
- `onTemplateCommit('whiteboard')`: welcome wizard sets `themeId = 'brand'` and goes to the settings
  step; the in-editor templates flow calls `onPick('whiteboard', name, 'brand', …)` at once.
- `chooseTemplate` tracks `Whiteboard / Created / NewTab` when `kind === 'whiteboard'` in the
  `templates` mode; the /new route tracks `Whiteboard / Created / Template`.

### Dock state

- `WhiteboardPrefs = { pens: WhiteboardPen[4], activePenId, recognise: boolean, eraserMode }`,
  defaults `DEFAULT_WHITEBOARD_PREFS` (pens Ink, Red, Blue, Green at Medium; `activePenId: 'ink'`;
  `recognise: false`; `eraserMode: 'stroke'`).
- `activeWhiteboardTool(canvasTool, pendingDraw)`:
  - `canvasTool === 'eraser'` → `eraser`; `canvasTool === 'highlighter'` → `highlighter`;
  - `pendingDraw` freehand `variant: 'whiteboard'` → `pen`;
  - `pendingDraw.type` `sticky` → `sticky`, `text` → `text`, `shape` or `arrow` → `shape`;
  - otherwise `select`.
- Transitions (the dock's actions, `useWhiteboard`):
  - **Select**: `setCanvasTool('select')`, `cancelDraw()`.
  - **Pen p**: when `p` is already the active pen and the tool is `pen`, toggle its flyout; else set
    `activePenId = p`, leave eraser / highlighter (`setCanvasTool('select')`), arm
    `whiteboardPenIntent(p, recognise)`, track `Whiteboard / Selected / penTelemetryType(p)`.
  - **Highlighter**: when active, toggle its flyout; else `selectCanvasTool('highlighter')`.
  - **Eraser**: when active, toggle its flyout; else `cancelDraw()`, `selectCanvasTool('eraser')`.
  - **Sticky / Text**: `setCanvasTool('select')`, arm `{ type: 'sticky' }` / `{ type: 'text' }`
    (one-shot: after placing, the tool reads `select`). Both open for typing on drop
    (`opensForTyping(intent, whiteboard)` in `draw-mode.ts`).
  - **Shapes**: toggle the shapes flyout; picking a shape arms its intent (one-shot) and closes it.
  - **Recognition**: flip `recognise`, re-arm the pen intent when a pen is held, track
    `RecognitionOn` / `RecognitionOff`.
  - **Undo / Redo**: `onUndo` / `onRedo`, disabled by `canUndo` / `canRedo`.
  - **More**: toggle the More flyout; picking a background writes `backgroundPattern` through the
    ordinary tab-canvas setter (undoable, synced) and tracks `Background<Name>`.
- Changing a pen's colour or width updates `pens[p]` and re-arms the intent when `p` is held.
- **Entering a whiteboard tab** (a new active tab, or the open tab turning into a whiteboard through
  Quick Start; editable, no intent armed, tool `select` or `pan`) arms the active pen (D2). The hook
  keys this on the pair of tab id and kind.
- **Leaving a whiteboard tab** cancels a whiteboard pen intent.
- Only one flyout is open at a time; it closes on Escape (focus returns to its dock button), on an
  outside press, on a tool change and on a tab switch.

### Pen commit (`makeCommitFreehand`, `variant: 'whiteboard'`)

1. Simplify as today (RDP, tolerance `1.2 / zoom`); fewer than 2 points: keep the pen armed, commit
   nothing.
2. `recognise` and `recogniseShape(simplified)` with confidence >= 0.4:
   - `line` → arrow, `arrowEnds: 'none'`, `strokeColor` = pen colour when set, `strokeWidth` =
     `nearestBorderStroke(width)`, no `strokeColor` for Ink.
   - a shape kind → shape at the bbox, `fillColor: 'transparent'`, `strokeColor` = pen colour when
     set, `strokeWidth` = `nearestBorderStroke(width)`; track as the Shape Pen does.
3. Otherwise a freehand element: `closed: false` always, `penWidth: width`, `strokeColor` = pen
   colour when set (Ink records none). Track `Element / Added / Freehand`.
4. The pen stays armed; nothing is selected.

`nearestBorderStroke(px)`: the `BorderStroke` whose `BORDER_STROKE_PX` is nearest, ties to the
thicker (2 → `medium`, 4 → `thick`, 8 → `extra-thick`).

### Ink projection

`inkWhiteboardElement(el, ink)` returns `el` itself when nothing is unpainted, else a copy with:

| Element                                     | Filled in                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `freehand`, `pen !== 'highlighter'`         | `strokeColor ?? ink`, `fillColor ?? 'transparent'`                     |
| `text`                                      | `textColor ?? ink`                                                     |
| `shape` of `square/circle/triangle/diamond` | `strokeColor ?? ink`, `fillColor ?? 'transparent'`, `textColor ?? ink` |
| `arrow`                                     | `strokeColor ?? ink`                                                   |
| anything else                               | unchanged                                                              |

The canvas host maps the displayed elements through it with a per-object cache
(`WeakMap<Element, Element>` per ink), so an unchanged element keeps its identity between renders.

### Eraser on a whiteboard

- Brush radius in screen px: `WHITEBOARD_ERASER_RADIUS_PX = { stroke: 10, partial: 16 }`; canvas
  radius = screen radius / zoom. The eraser ring shows it.
- The gesture carries a canvas frame captured on press: `{ left, top, zoom }` of the transformed
  wrapper, so a client point maps with `pointerToCanvas`.
- Each pointer sample erases along the segment from the previous sample to this one (a capsule), so a
  fast swipe cannot skip a stroke.
- **Stroke**: a `freehand` is touched when `strokeTouchesBrush(el, a, b, r)`; any other element when
  the DOM hit test (centre plus rings, as the Eraser panel's `eraserSamplePoints`) finds it. Touched
  elements are removed whole, arrows pinned to them cascade, as today.
- **Partial**: only `freehand` elements; each touched one is replaced by `eraseStrokePart(...)`
  inside the functional `tick`, so consecutive samples compose on the live list.
- Both: one `markCheckpoint` on the first change, one activity entry on release, locked elements and
  inert layers skipped.

### Stroke geometry (`whiteboard-stroke.ts`)

- `freehandAbsolutePoints(el)`: `x + nx * width`, `y + ny * height`, rotated about the centre by
  `rotation` degrees clockwise when set.
- Ink half-width: `penWidth ?? BORDER_STROKE_PX[strokeWidth ?? DEFAULT_BORDER_STROKE]` (highlighter:
  `penWidth ?? 14`), halved.
- `strokeTouchesBrush(el, a, b, r)`: true when any polyline segment lies within `r + halfWidth` of
  segment `ab` (segment-to-segment distance); a bbox reject first.
- `eraseStrokePart(el, a, b, r, mintId)`:
  1. Densify the polyline so no segment exceeds `max(r / 2, 1)`.
  2. Mark each point inside when its distance to `ab` <= `r + halfWidth`.
  3. None inside → `null` (untouched). All inside → `[]`.
  4. Split into runs of outside points; at each inside/outside boundary insert the crossing point,
     found by bisection (12 steps) on the segment. A closed stroke's first and last runs join.
  5. Drop runs with fewer than 2 points or a length under 1 canvas px.
  6. Each run → `createFreehand(points, false)` with a fresh id, carrying `strokeColor`,
     `strokeWidth`, `strokeStyle`, `penWidth`, `pen`, `layerId`, `opacity`, `fillColor`, `locked`
     false. The longest run also carries `label`, `link`, `note`, `commentThread` and `action` (D3).

### Pen versus touch

- `whiteboardPointerRoute({ pointerType, penSeen, inking })` → `'ink' | 'pan'`: `'pan'` only for
  `pointerType === 'touch' && penSeen && inking`; else `'ink'`. `inking` is true for a held pen, the
  highlighter and the eraser (D4).
- Any `pointerdown` with `pointerType === 'pen'` on a whiteboard calls `markPenSeen()`. The flag is a
  module variable: it resets on reload.
- A `'pan'` route starts the ordinary canvas pan and stops the press there.
- A whiteboard stroke during which `isPinchingRef` became true is discarded on release.

### Hidden chrome

Gated on `whiteboard = isWhiteboardTab(activeTab)`:

- `panelEls.palette`, `ToolbarPalette`, `QuickStylePanel`, the Theme & canvas brush,
  `ThemeModeBanner`, `EmptyCanvasBanner`, the tool panels (`eraser`, `highlighter`, `format`), the
  mobile dock's buttons for those panels: not rendered.
- The Explorer menu button leaves the strip for its corner on a phone (`menuInStrip` false).
- The draw-mode banner does not show for a held pen (`isHeldPenIntent`).
- The dock renders when `whiteboard && !readOnly && !chromeHidden`.

## Interfaces and contracts

```ts
// packages/document
export type TabKind = 'diagram' | 'event-storming' | 'whiteboard';
export function isWhiteboardTab(tab: { kind?: string } | undefined): boolean;
export const WHITEBOARD_BOARD: Readonly<Record<Appearance, string>>;
export const WHITEBOARD_INK: Readonly<Record<Appearance, string>>;
export const WHITEBOARD_PATTERN: Readonly<Record<Appearance, string>>;
export type WhiteboardBackground = 'plain' | 'dots' | 'grid';
export const WHITEBOARD_BACKGROUNDS: readonly {
  id: WhiteboardBackground;
  label: string;
  pattern: BackgroundPattern;
}[];
export function whiteboardBackgroundOf(
  pattern: BackgroundPattern | undefined,
): WhiteboardBackground;
export function inkWhiteboardElement<T extends Element>(el: T, ink: string): T;
export function strokeTouchesBrush(el: FreehandElement, a: Point, b: Point, r: number): boolean;
export function eraseStrokePart(
  el: FreehandElement,
  a: Point,
  b: Point,
  r: number,
  mintId: () => string,
): FreehandElement[] | null;
export function nearestBorderStroke(px: number): BorderStroke;

// apps/live
export type WhiteboardPenId = 'ink' | 'red' | 'blue' | 'green';
export type WhiteboardPen = { id: WhiteboardPenId; colour: string | null; width: number };
export type WhiteboardEraserMode = 'stroke' | 'partial';
export type WhiteboardPrefs = {
  pens: WhiteboardPen[];
  activePenId: WhiteboardPenId;
  recognise: boolean;
  eraserMode: WhiteboardEraserMode;
};
export function parseWhiteboardPrefs(raw: unknown): WhiteboardPrefs;
export function loadWhiteboardPrefs(): WhiteboardPrefs;
export function saveWhiteboardPrefs(prefs: WhiteboardPrefs): void;
export type WhiteboardTool =
  'select' | 'pen' | 'highlighter' | 'eraser' | 'sticky' | 'text' | 'shape';
export function activeWhiteboardTool(
  canvasTool: CanvasTool,
  pendingDraw: PendingDraw | null,
): WhiteboardTool;
export function whiteboardPenIntent(pen: WhiteboardPen, recognise: boolean): PendingDraw;
export function whiteboardPointerRoute(i: {
  pointerType: string;
  penSeen: boolean;
  inking: boolean;
}): 'ink' | 'pan';
```

`PendingDraw` gains `{ type: 'freehand'; variant: 'whiteboard'; colour: string | null; width: number; recognise: boolean }`
and `{ type: 'arrow'; ends?: ArrowEnds }`.

Parsing rejects: a non-object or unparseable prefs value → defaults; a pen whose id is unknown →
dropped and refilled from defaults; a colour that is not in `WHITEBOARD_PEN_COLOURS` → the pen's
default colour; a width not in `WHITEBOARD_PEN_WIDTHS` → Medium; an unknown `activePenId` or
`eraserMode` → default; `recognise` not a boolean → `false`.

## Data and persistence

| Field                         | Where                                           | Class        | Travels |
| ----------------------------- | ----------------------------------------------- | ------------ | ------- |
| `Tab.kind = 'whiteboard'`     | tab body (D1, IndexedDB)                        | document     | yes     |
| `Tab.backgroundPattern`       | tab body                                        | document     | yes     |
| `FreehandElement.penWidth`    | element                                         | document     | yes     |
| `FreehandElement.strokeColor` | element (coloured pens)                         | document     | yes     |
| `WhiteboardPrefs`             | `localStorage` `livediagram:v2:whiteboard-pens` | device-local | never   |
| pen seen                      | module memory                                   | session      | never   |

No migration: `kind` is an existing optional string field; `penWidth` already exists and validates
1 to 100. Older readers show a whiteboard as an ordinary tab with the same elements.

## Errors and edge cases

- A whiteboard opened by a build without the kind: ordinary tab, elements intact (no fork).
- An unpainted stroke exported or opened on a diagram tab (paste): ordinary default colours.
- Pen armed while the tab becomes locked or read-only: commits refuse as today (`editsBlocked`).
- Tab switch mid-stroke: the gesture commits to the tab it started on via the functional commit, as today.
- Partial erase that removes everything: the element is removed. A 1-point remnant is dropped.
- Rotated stroke under Partial: rotation baked into the pieces, which carry no rotation.
- Storage unavailable: prefs fall back to defaults (`readLocalStorageSafe`), nothing throws.
- Narrow viewport: the dock scrolls horizontally; flyouts clamp to the viewport.

## Security and trust

Nothing crosses a trust boundary that did not before: prefs are local, the tab fields ride existing
validated saves (`validate.ts` bounds `penWidth`). Colours written by a pen come from a fixed list.

## Performance and limits

- Ink projection: O(n) per render of the element array, allocation only for changed or unpainted
  objects on first sight (cache).
- Eraser: per pointer sample, O(strokes) bbox rejects plus O(points) for the survivors; Partial
  densifies only touched strokes. A 2,000-stroke board stays within a frame on the samples tried.
- Dock: 14 fixed-size buttons, no measurement, no layout effect.

## Presentation and UX

- Dock: bottom centre, `bottom-4` from 1500 px wide, lifted above the bottom-right cluster below it; buttons
  44 × 44 px; rounded panel with the editor's panel surface tokens; separators between groups
  (select | pens | highlighter, eraser | sticky, text, shapes | recognition | undo, redo | more).
- Pen buttons: a filled nib in the pen's colour (Ink shows the ink colour), a thickness bar below
  scaled to its width.
- Flyouts sit above their button, never move the dock; clamp to the viewport horizontally (12 px
  margin, measured from layout width before paint, since the pop-in starts at `scale(0)`), placed
  with the `translate` property because the pop-in animation owns `transform`.
- Dock buttons and flyout options carry the house `Tooltip` (their accessible name).
- Copy: toolbar label "Whiteboard tools"; buttons "Select", "Ink pen", "Red pen", "Blue pen",
  "Green pen", "Highlighter", "Eraser", "Sticky note", "Text", "Shapes", "Shape recognition",
  "Undo", "Redo", "More"; pen flyout "Colour", "Width" with "Fine", "Medium", "Bold"; eraser flyout
  "Stroke", "Partial" with hints "Remove whole strokes" / "Erase part of a stroke"; More flyout
  "Background" with "Plain", "Dots", "Grid"; Quick Start card "Whiteboard", "A plain board to draw on
  with pens, stickies and shapes."

## Accessibility

- `role="toolbar"`, `aria-label="Whiteboard tools"`, `aria-orientation="horizontal"`; roving
  tabindex: one tab stop, ArrowLeft / ArrowRight move (wrapping), Home / End jump.
- Tool buttons carry `aria-pressed`; a pen's name includes colour and width ("Red pen, medium");
  flyout openers carry `aria-expanded` and `aria-controls`.
- A flyout is a `role="group"` labelled by its title; opening moves focus to its selected control;
  Escape closes it and returns focus to the opener.
- Contrast: ink on board >= 4.5:1 per appearance, pen colours >= 3:1 on both boards (tests).
- Reduced motion: the dock and flyout animations use the app's `.reduce-motion` / media-query rule.

## Web Experience

- Zero layout shift: the dock is `position: absolute` over the canvas, fixed button sizes, flyouts
  absolutely positioned above it; nothing in the page flow changes when a tool or flyout toggles.
- INP: dock handlers set state only; erase work is per sample and bbox-filtered.
- LCP: no new asset on first paint; the dock renders with the canvas.

## Observability

- Telemetry per the spec's table (`Whiteboard` category); `Created` / `Import` is reserved for the
  Microsoft Whiteboard import and not yet emitted. The dashboard charts the four pairs in a
  Whiteboards stack headed by Whiteboards Created.
- Parse fallbacks log once: `console.warn('[whiteboard] prefs reset: <reason>')`.
- Discarded pinch strokes: `console.debug('[whiteboard] stroke discarded: pinch')`.

## Testing

| Rule                                                | Test                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Kind reads and stamps                               | `packages/document/src/tab-kind.test.ts`                                                 |
| Tokens meet contrast                                | `packages/document/src/whiteboard.test.ts`                                               |
| Ink projection table                                | `packages/document/src/whiteboard.test.ts`                                               |
| Stroke touch and partial split                      | `packages/document/src/whiteboard-stroke.test.ts`                                        |
| `penWidth` honoured on every stroke                 | `svg-render-shapes` test                                                                 |
| Template kind, overrides, builder                   | `packages/templates` tests                                                               |
| Prefs parse / defaults / pen colours contrast       | `apps/live/lib/whiteboard-prefs.test.ts`                                                 |
| Tool derivation, pen intent, pointer route, shapes  | `apps/live/lib/whiteboard-tool.test.ts`                                                  |
| Pen commit (open, colour, width, held, recognition) | `apps/live/hooks/canvas/commit-freehand.test.ts`                                         |
| Border width clears `penWidth`                      | `apps/live/lib/style-presets.test.ts`                                                    |
| Backdrop on a whiteboard                            | `apps/live/lib/default-scheme.test.ts`                                                   |
| Dock a11y, keyboard, flyouts                        | `apps/live/components/canvas/whiteboard/WhiteboardDock.test.tsx`                         |
| Dock state, entering, telemetry                     | `apps/live/hooks/canvas/useWhiteboard.test.tsx`                                          |
| Ink projection cache                                | `apps/live/lib/whiteboard-ink.test.ts`                                                   |
| Eraser steps                                        | `apps/live/lib/whiteboard-erase.test.ts`                                                 |
| Pen versus touch on the canvas                      | `apps/live/hooks/canvas/useCanvasSurfaceGestures.whiteboard.test.tsx`                    |
| A pinch discards a whiteboard stroke                | `apps/live/components/canvas/useCanvasDrawGesture.test.tsx`                              |
| Line / arrow heads, no colour                       | `apps/live/lib/draw-commit.test.ts`                                                      |
| No theme step for a whiteboard                      | `apps/live/components/palette/template-picker-wizard.test.tsx`                           |
| Sticky and text open for typing                     | `apps/live/lib/draw-mode.test.ts`                                                        |
| Telemetry vocabulary and dashboard                  | `apps/live/lib/telemetry-coverage.test.ts`, `apps/telemetry/app/metric-emitters.test.ts` |
| End to end                                          | playwright-cli walkthrough, light / dark, desktop / narrow                               |

## Constants and configuration

| Constant                          | Value                            | Provenance           | Safe range      |
| --------------------------------- | -------------------------------- | -------------------- | --------------- |
| `WHITEBOARD_BOARD.light / dark`   | `#fbfaf7` / `#1f2724`            | spec starting values | contrast >= 4.5 |
| `WHITEBOARD_INK.light / dark`     | `#1c1917` / `#ece8dc`            | spec starting values | contrast >= 4.5 |
| `WHITEBOARD_PATTERN.light / dark` | `#d6d3cb` / `#3a4540`            | D5                   | faint, visible  |
| `WHITEBOARD_PEN_WIDTHS`           | 2, 4, 8 px                       | spec                 | 1 to 100        |
| `WHITEBOARD_ERASER_RADIUS_PX`     | stroke 10, partial 16            | D6                   | 4 to 48         |
| Partial densify step              | `max(r / 2, 1)` canvas px        | D7                   |                 |
| Crossing bisection steps          | 12                               | D7                   | 8 to 20         |
| Recognition threshold             | 0.4                              | Shape Pen            |                 |
| Storage key                       | `livediagram:v2:whiteboard-pens` | spec                 |                 |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md).
