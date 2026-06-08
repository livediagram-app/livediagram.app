# Canvas and command palette

The live app's canvas is where users actually build diagrams. A floating **command palette** sits on top of the canvas with controls for adding elements.

## Command palette

A small floating panel **initially placed in the top-right corner of the canvas**. The panel has a **`PALETTE` header label** in block caps above the buttons, and below it a row of icon buttons — one per primitive that can be added to the canvas.

### Canvas tools

The first row of the palette holds the canvas-tool toggles:

- **Pan** (default) — drag-on-empty scrolls the canvas.
- **Select** — drag-on-empty draws a marquee for multi-select.
- **Laser**: presenter mode. Pointer-move emits a glowing trail in the local participant's colour that fades over ~1 s. On a mouse, click-drag pans the canvas (same as Pan tool) so the presenter can reposition without switching tools, and the trail keeps capturing during the pan so peers see a sweeping laser. On a touch device the same drag DRAWS the laser instead of panning: touch has no hover, so a finger drag is the only way to point at things and pan-on-drag would pin the laser dot in canvas-coords (the canvas slides under the finger). Touch users pan via the Pan tool, two-finger trackpad, or zoom controls. Other participants see the trail in real time in the sender's colour via the `laser` `RoomOp` (see [spec/11](11-api.md)). Cursor indicators broadcast as `null` while laser is active so peers see only the laser dot, not a stacked cursor + dot.

### Movable

- The header row is a **drag handle** — press it and drag to move the palette anywhere on the canvas. Clicking a button does not start a drag.
- Position survives until the page reloads.

### Collapse to banner

The header has a **collapse button** to the right of the `PALETTE` label. Clicking it hides the body (canvas-tool toggle, shape row, accordions) and leaves the title row visible as a banner in place, so the user always sees the affordance and gets canvas real-estate back. The button's icon flips from a dash (collapse) to a plus (expand) so the same slot is the entry point in both directions.

- **Mobile** (touch viewports below the `sm:` breakpoint, 640 px): the palette does not render at its corner. It opens instead from the **mobile dock** (a top-right button row, see spec/07 "Mobile chrome") as a popover anchored to the Palette button; tapping the button again, or adding a shape / tool, closes the popover. The banner-collapse described here is the desktop mechanism.
- **Desktop** (`sm:` and up): the palette starts expanded. The collapse button toggles to banner mode. There is no outside-tap auto-close on desktop, the user is in control of when to re-open.

On desktop the Palette and Editor (ContextPanel) collapse to a banner in place via the `MovablePanel` `collapsible` prop. On mobile they (and the Explorer) are reached from the top-right mobile dock instead (spec/07 "Mobile chrome"); the old bottom-of-canvas dock button next to the zoom controls is retired. Activity still docks via its own minimise path, see that section.

### Minimal panel layout (desktop opt-in)

Desktop users can opt into the mobile-style dock via the **"Minimal panel layout"** preference (`minimalPanels`, spec/20, Settings → Interface). When on, the floating Explorer / Palette / Editor / AI panels are replaced on desktop by the same top-right button dock and popover behaviour mobile already uses: each button opens its panel as a popover with an arrow pointing at the button, click-outside or a second click closes it, and adding a shape / tool auto-closes the Palette popover. Implemented by the `MovablePanel` `forceDockMode` prop, which extends the existing mobile dock code path to desktop (the dock is `sm:hidden` by default but shown at all widths when `minimalPanels` is set). Defaults off; mobile is always docked regardless of the flag.

## Explorer panel

A second floating panel, pinned to the **top-left** of the canvas by default. Shares the same draggable + minimisable behaviour as the [Command palette](#command-palette) via the shared `MovablePanel` component. Title: `EXPLORER`.

Sections, top to bottom:

- **Current Diagram** — the active diagram's row. Click to rename in place; the row's ellipsis menu surfaces Rename, Duplicate, and Delete for the current diagram (moved here from the editor header).
- **Recent Diagrams** — accordion listing up to the five most-recently-saved diagrams the current participant owns, newest first. Capped + collapsed by default with a count badge.
- **Folders + Unsorted** — accordion holding the nested folder tree per [15-folders.md](15-folders.md). Every folder is itself an accordion (expand to show child folders + direct diagrams). The synthetic **Unsorted** bucket always renders so freshly-created diagrams have an obvious home, even when no user folders exist. Folder rows have their own ellipsis (Rename, Delete, New subfolder, Move-to-folder); diagram rows have a "Move to folder…" sub-action.
- **Sign-in nudge** — a dashed-border card at the bottom of the Explorer body that surfaces the value of accounts (cross-device persistence) where the user is looking at their library. Three states driven by the deployment + session:
  - **Clerk disabled** (self-host without auth): "Diagrams saved to this browser" with the body explaining that sign-in isn't enabled on this deployment and clearing storage wipes everything. No button.
  - **Clerk enabled, signed out**: "Sign in to keep your content" with body "A free account keeps your diagrams and content across sessions and devices." and a primary CTA linking to `/sign-in/`.
  - **Clerk enabled, signed in**: renders nothing. The signed-in user already has the account that syncs everything; the nudge would just be noise.

Diagram rows — in **Recent Diagrams** and inside folders — show a small chain-link glyph (the shared `SharedDiagramIcon`) beside the name when the diagram has an active share link (`shareCode` non-null, carried through from the `/api/diagrams` summary), with a "Has a share link" tooltip, so an owner can tell at a glance which of their diagrams are shared. The glyph is suppressed on the row for the currently-open diagram, whose share state already shows in the Current Diagram section.

On desktop, collapsing the Explorer banner-collapses it in place via the shared `MovablePanel` `collapsible` prop (same as the Palette and Editor's ContextPanel). On mobile the Explorer is instead opened from the top-right mobile dock (spec/07 "Mobile chrome"), so it is no longer hidden on phones; the old bottom-of-canvas dock button is retired. Activity still docks via its own minimise path, see that section.

## Text alignment

Each boxed element carries an optional pair of fields controlling where its label sits inside the box:

- `textAlignX: 'left' | 'center' | 'right'` — horizontal alignment.
- `textAlignY: 'top' | 'middle' | 'bottom'` — vertical alignment.

Defaults:

- **Shape, Text:** `center` / `middle`.
- **Sticky note:** `left` / `top` (natural for multi-line notes).

Selectable from the [Selected Element](#selected-element-section) section of the palette as a **3 × 3 grid** of small icon buttons — each cell represents one combination of horizontal and vertical alignment. The currently active cell is visibly highlighted.

Behaviour per label renderer:

| Renderer           | How alignment is applied                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Scaling (auto-fit) | The SVG `preserveAspectRatio` is set to the matching `x{Min/Mid/Max}Y{Min/Mid/Max} meet` so the text scales into the chosen corner. |
| Fixed-size single  | CSS `align-items` + `text-align` on a flex container.                                                                               |
| Sticky multi-line  | CSS `align-items` for vertical + `text-align` on the inner block.                                                                   |

The label editor (input/textarea) inherits the horizontal alignment so the cursor appears where the committed text will land.

## Colours

Boxed elements carry three optional colour fields:

- `fillColor` — background fill. **Shapes and sticky notes** only.
- `strokeColor` — outline / border colour. **Shapes and sticky notes** only.
- `textColor` — label colour. **All boxed elements** (shape, text, sticky).

All stored as CSS-compatible colour strings (typically `#rrggbb`).

Defaults follow the design system per type:

| Type   | Fill        | Stroke      | Text          |
| ------ | ----------- | ----------- | ------------- |
| Shape  | `brand-50`  | `brand-500` | `brand-800`   |
| Sticky | `amber-100` | `amber-200` | amber-950-ish |
| Text   | transparent | transparent | `slate-800`   |
| Arrow  | n/a         | n/a         | n/a           |

Setting a colour applies to every member of the current selection that supports it (group-aware).

The **Text colour** picker lives inside the **Text** accordion of the Selected Element section; **Background** and **Border** live inside the **Colours** accordion (shown only for shapes/sticky).

Arrows don't expose any colour pickers yet.

Future iterations: stroke width, dash patterns, gradient fills, named theme colours, transparency.

## Aspect ratio lock

Each boxed element can have its **aspect ratio locked**. Stored as `aspectLocked?: boolean` (defaults to `false`).

- Toggled from the **Lock aspect ratio** button in the selection popover.
- When on, corner-resize keeps the width-to-height ratio of the moment the drag started:
  - The candidate width and height are computed from the drag delta.
  - Whichever change is larger (in relative terms) wins; the other is derived from the source ratio.
- The opposite-corner anchor still stays put.
- Move/resize on locked-position elements (the other `locked` flag) is still disabled regardless of aspect lock.
- Format painter does not currently copy aspect-lock state.

### Current Tab section

When **nothing is selected**, the Selected Element section is replaced by a **Current Tab** section. Accordions, top to bottom:

- **Theme** — a 3-column grid of preset themes. Picking a theme writes `theme: ThemeId` onto the tab AND updates the tab's `backgroundColor`, `backgroundPattern`, and `patternColor`. The backdrop follows the **same preserve-customs rule as element colours** (`switchThemeBackdrop` in `apps/live/lib/themes.ts`): each field adopts the new theme's value only when it's unset or still matches the _previous_ theme's value, so a deliberately-chosen pattern (e.g. a hand-picked Graph or Isometric) survives a theme switch instead of being reset to the theme's default grid. From that point on, newly added boxed elements inherit the theme's `elementFill / elementStroke / elementText` colours (sticky notes keep their amber identity regardless). Existing elements are **not** retroactively recoloured — the user can re-apply colours per-element via the Selected Element → Colours accordion. The theme catalogue (`apps/live/lib/themes.ts`) ships **12 default themes** (Brand, Slate, Forest, Sunset, Lavender, Mono, Ocean, Crimson, Midnight, Cream, Rose, Sand) plus **6 extras behind a "Show more themes" toggle** (Olive, Indigo, Pine, Steel, Mocha, Charcoal). The opt-in is descriptor-driven (`extra?: boolean` on each entry), so adding more is one line in the catalogue with no UI plumbing. The same toggle ships in the welcome / template picker's theme grid. The toggle auto-expands when the active themeId is an extra so the user always sees the active swatch.
- **Canvas** — per-tab background controls. Fourteen pattern choices total, laid out in a 4-column grid of equal-width buttons: eight defaults (Grid, Blank, Lines, Graph, Crosshatch, Confetti, Stripes, Diagonal — two full rows) plus six behind a "Show more patterns" toggle (Waves, Bricks, Isometric, Hexagonal, Engineering, Checkerboard). Patterns store as `backgroundPattern?: BackgroundPattern`. When the user pans, the pattern phase tracks the pan offset so the pattern tiles indefinitely. Axis-aligned line grids (Lines, Stripes, Graph, Engineering) are built from tiled `linear-gradient`s with an explicit `background-size` so lines stay crisp and never double; the diagonal grids (Crosshatch, Diagonal, Isometric) and Hexagonal render via inline `data:image/svg+xml` tiles that rasterize once and repeat seamlessly; Checkerboard is a tiled `conic-gradient`. Confetti renders a fixed multi-colour scatter and ignores the pattern colour; the SVG and Waves patterns pick up the active pattern colour. Plus Canvas + Pattern colour pickers and an Opacity slider.
- **Content** — destructive operations on the tab's contents (today: a single "Remove all content" button, disabled when there's nothing to clear).
- **Cleanup** — tidiness operations on the tab's existing content. Today: a single "Auto align" button that snaps every boxed element's position (x / y) and dimensions (width / height) to the nearest 10 px (the canvas's grid unit), so almost-aligned shapes become exactly aligned and minor dimension drift collapses. Aspect-locked shapes (circle, diamond, actor) stay square / proportional by snapping the larger axis and matching the other to it. Free-endpoint arrows snap their endpoints to the same grid; pinned arrow endpoints stay attached to their anchored elements (which themselves get snapped). Width / height never go below `MIN_SIZE`. The operation is one undoable commit and emits an Activity-log entry so the user can revert it like any other edit. Disabled when the tab has no boxed elements.

### Selected Element section

When **any** element is selected, the palette grows a fourth section at the bottom titled `SELECTED ELEMENT`. It hosts per-element controls grouped into **collapsible accordions** so the palette stays compact. Each accordion is **closed by default**; clicking the header toggles it open.

Accordion groups (rendered in this order top-to-bottom, hidden when their gate doesn't apply):

- **Shape** _(shape elements only)_
  - Shape grid (Square, Circle, Diamond, Cylinder, Parallelogram, Hexagon, Document, Stadium, User, Cloud, plus the device frames Web browser, Computer monitor, Laptop, Phone, Tablet) — clicking morphs the selected element into that kind in place, preserving size + colour overrides. Circle and diamond force the bounding box square; the rest preserve free aspect.
  - **Lock aspect ratio** toggle — when on, resize handles enforce the current width:height ratio.
  - **Padding** preset (None / Small / Medium / Large) — distance between the label and the element box, snapped to a preset for round-trip simplicity.
- **Layer**
  - Front — bring to top of the z-order.
  - Back — send to bottom of the z-order.
  - Opacity slider — 0–100% on the element's `opacity` field. Folded into Layer (was a standalone "Appearance" accordion until the merge — single-control accordions weren't worth the extra header).
- **Text** _(boxed elements only)_
  - Text size — `Scale | Small | Medium | Large`. See [Text size](#text-size).
  - Text alignment — 3 × 3 grid. See [Text alignment](#text-alignment).
  - Bold / Italic / Underline / Strikethrough toggles.
- **Colours** _(boxed elements only)_
  - **Text** swatch — colours the element's label. Shown for every boxed kind (shape, text, sticky).
  - **Background** swatch — fill colour. Shapes & sticky notes only.
  - **Border** swatch — outline colour. Shapes & sticky notes only.
  - See [Colours](#colours). Text elements show only the Text swatch; shapes and sticky notes show all three.
- **Pointer** _(arrows only)_
  - **Line thickness** — four snapped presets (Thin / Medium / Thick / Extra-thick → 1 / 2 / 4 / 7 px on the arrow's `strokeWidth`). Snapping is one-way for display so legacy free-number widths still highlight the nearest preset.
  - **Line style** — Straight / Curved / Angled. Drives the geometry (single line / quadratic bezier bowing ¼ of the chord / axis-aligned L-elbow). See [Arrows → Data model](#data-model-2).
  - **Line pattern** — Solid / Dashed / Dotted. Stored as `strokeStyle: BorderStyle` on the arrow (shares the union with the shape Border accordion's pattern row so future style additions, e.g. "long-dash", land on both surfaces with one schema change). The renderer maps to an SVG `strokeDasharray` via the same `BORDER_DASH_ARRAY` lookup the shape outlines use; the selection halo around a selected arrow stays solid for visibility.
  - **Arrowhead type** — Start only / End only / Both / No pointers. Stored as `arrowEnds`.
  - **Arrowhead size** — Small / Medium / Large / Extra-large (4 / 6 / 8.5 / 12 px marker size). Sits **below** Arrowhead type so the user picks whether they want a head before sizing it; hidden entirely when `arrowEnds === 'none'` (nothing to size).
  - **Arrowhead shape** — Filled triangle (default) / Hollow triangle / Open V / Dot / Hollow dot / Filled diamond / Hollow diamond. Stored as `arrowheadShape: ArrowheadShape` on the arrow, independent of size + ends so a UML diagram can pair, e.g., a hollow triangle (inheritance) or diamond (aggregation / composition) with any line weight. The renderer emits one SVG `<marker>` per (shape × size) pair; hollow variants fill white and outline with the line colour, the open V has no fill. Sits below Arrowhead size and hides with it when `arrowEnds === 'none'`. Defaults to the filled triangle so arrows authored before the field render unchanged.

### Arrow labels

Double-clicking the body of a selected arrow opens an inline `<foreignObject>` editor for the arrow's `label?: string`. Enter / blur commits, Escape cancels. The label renders as an SVG `<text>` anchored at the path's midpoint (chord midpoint for straight, t=0.5 of the quadratic bezier for curved, the elbow vertex for angled). Placement chooses one of four cardinal slots around the midpoint (right → below → left → above) and picks the first whose AABB doesn't collide with a neighbouring boxed element; falls back to "right" if every slot collides. Empty label string strips the field on commit so persisted JSON stays clean.

Accordion headers show a chevron that rotates 180° when open. The body slides open/closed via a `grid-template-rows` 0fr↔1fr transition (~200 ms) so motion is smooth and free of layout jumps.

The Selected Element section vanishes when nothing is selected — replaced by the [Current Tab](#current-tab-section) section.

### Undo / Redo

A separate row at the bottom of the palette (separated from the add-buttons by a thin divider) holds two history controls:

- **Undo** (left-curve arrow) — reverts the last change.
- **Redo** (right-curve arrow) — reapplies an undone change.

History is kept to a maximum of **3 steps** in each direction. Older states are dropped.

Undo-able actions: adding/deleting any element, label commits, lock toggle, layer order (bring/send), format-paint apply, duplicate-and-connect, drag-end (move or resize, including arrow-endpoint drags). The snapshot is taken at the **start** of a drag so undo returns to the pre-drag state, not to intermediate frames.

Not in history: selection, edit mode entry, palette position/minimize state, format-painter mode.

The palette is laid out top-to-bottom as: canvas-tool toggle (Pan / Select / Laser) → general shape row (always visible) → **Tools** accordion (collapsed by default) → **Devices** accordion (collapsed by default). Tools and Devices are mutually exclusive: opening one closes the other so the palette stays compact. Shapes are NOT folded behind an accordion because they're the most common entry point on every fresh canvas and tucking them behind a collapsible header buries a click for no payoff.

**Shapes row** (general shapes, always visible):

- **Square** — adds a 120×120 square node to the active tab.
- **Circle** — adds a 120×120 circle node to the active tab.
- **Diamond** — adds a 120×120 diamond (decision-node, UML-style). Rendered as an SVG polygon overlay so the diamond outline matches the element's bounding box.
- **Cylinder** — adds a 100×140 cylinder (taller than wide to match the natural shape).
- **Parallelogram** — adds a 160×100 parallelogram (wider than tall).
- **Hexagon** — adds a 140×120 flat-top hexagon.
- **Document** — adds a 140×110 document shape (slightly wider than tall).
- **Stadium** — adds a 160×64 pill (flowchart Start / End terminator).
- **User** — adds a 90×130 UML actor (stickman + label band below).
- **Cloud** — adds a 180×140 cloud container (networking / architecture).

**Devices** accordion (UI-device frames for wireframing). Each renders as the device's silhouette so users can drop them on the canvas as containers and arrange interface elements inside:

- **Web browser** — adds a 240×160 browser window (tab strip + URL bar + viewport).
- **Computer monitor** — adds a 220×170 desktop monitor with stand.
- **Laptop** — adds a 240×150 laptop (screen + keyboard base).
- **Phone** — adds a 90×170 phone (tall portrait with rounded corners).
- **Tablet** — adds a 140×180 tablet (medium portrait with rounded corners).

**Icons** accordion (curated single-colour glyphs). A search box filters a scrollable grid of line icons (tech / cloud / UI / people: server, database, cloud, user, lock, globe, ...). Clicking one drops an `icon` shape (88×88, aspect-locked) at the viewport centre carrying the chosen `iconId`. Icons are line art tinted by the element's **stroke colour** (Colours accordion), with a constant on-screen line weight (non-scaling stroke) so they stay crisp at any size; the label sits in a band beneath the glyph. The glyph catalogue (id + label + keywords + SVG primitives) lives in `apps/live/lib/icons.ts`; `iconId` is a plain string in the model (not a closed enum), so adding an icon is a one-file change and an unknown id renders a placeholder glyph. The **Shape** accordion (morph grid / aspect / padding) and the **Border** accordion (strength / pattern / radius) are both hidden for a selected icon: an icon is a glyph you pick from the Icons picker, not a box you morph or border. Icons keep the Text accordion and the Colours accordion, but the latter shows only the **stroke** (glyph tint) and **text** (label) swatches — the **fill / background** swatch is hidden because an icon is `fill="none"` line art with no fill to colour. Icons drop at the centre rather than via draw-to-size (a glyph is a fixed-aspect mark, not a box you size by dragging).

**Table** (Tools accordion). Drops a 3×3 `table` element at the viewport centre. The grid divides the element box evenly; double-click a cell to edit its text (Enter / blur commits, Escape cancels, Tab / Shift+Tab walk cells). `cells` is the row-major source of truth (`cells[r][c]`), kept rectangular by the helpers in `packages/diagram/src/table.ts` (addTableRow / removeTableRow / addTableColumn / removeTableColumn / setTableCell). **Row / column edits** happen in-component: when the table is selected, a `⋯` trigger sits inside the top of each column / the left of each row; tapping it (click, not hover) opens a large-button menu — Insert-before / Insert-after / Delete (delete disabled at the last row / column) — that drops INTO the grid, away from the canvas's own resize handles (arrow-anchor dots are suppressed for tables). The **Table accordion** in the selected-element panel toggles `headerRow` and `headerColumn` (combinable; the corner cell is then both — a tinted band + bold text) and carries **header colour** swatches (`headerFill` / `headerTextColor`) so the header band can be coloured independently of the body cells. Reset-to-theme clears the cell fill + header overrides and reapplies the theme grid / text colours. Cell + structural changes commit through `onCommitCells`. **Editing**: a cell edits via a contentEditable flex child that respects the table's horizontal + vertical alignment and inherits the cell font; Enter commits and moves down, Tab / arrow keys navigate cells, and pasting TSV / spreadsheet data fills + grows the grid (`pasteIntoTable`). **Sizing**: drag a column's right / a row's bottom divider to pin its width / height (`colWidths` / `rowHeights`; un-pinned tracks share the rest as `1fr`), double-click a divider to auto-fit. **Styling**: a `zebra` toggle tints alternate rows; single-clicking a cell opens an in-cell toolbar to set that cell's background / text colour / bold (`cellStyles`, a per-cell override grid aligned with `cells`). The `scale` text size tracks the row height. The Colours accordion tints grid lines (stroke), cell background (fill) and text; new tables derive their text colour from the canvas background so they stay readable on dark backdrops. The whole table resizes via the normal element handles; individual **columns** can be pinned to an explicit width by dragging the divider on their right edge (`colWidths`), with un-pinned columns sharing the remaining space as `1fr` tracks. Cell padding follows the element's padding preset (the Text accordion). Per-row pixel sizing is a follow-up.

**Tools** accordion (other element kinds):

- **Text** — adds a free-floating text element (see [Text element](#text-element)).
- **Arrow** — adds a plain straight connector (see [Adding an arrow](#adding-an-arrow)).
- **Sticky note** — adds a sticky-note element (see [Sticky note element](#sticky-note-element)).

Arrows are no longer in the palette — see [Adding an arrow](#adding-an-arrow).

### Placement on add

The **Icon** and **Table** buttons place the new element at the **centre of the visible canvas viewport** (accounting for pan), auto-selected. The draw-capable buttons (shape / text / sticky / image / arrow) instead arm the combined tap-or-drag gesture — see [Adding elements](#adding-elements--tap-to-drop-or-drag-to-draw) — where a tap drops it at the tap point and a drag sizes it.

If a boxed element is currently selected, the new element **inherits its width and height** so the user can chain together similarly-sized nodes quickly. Circles and diamonds are an exception — they're inherently 1:1, so they snap back to a square using the larger inherited dimension to avoid being squashed. This rule lives in `inheritedSizeFor` (`apps/live/lib/canvas.ts`) and applies to both the centre-drop and the tap-to-drop paths (the combined gesture captures the selection at arm-time, since arming clears it).

Consecutive **icon / table** adds land at the same viewport centre and stack on top of each other; the user sees the auto-selection move to the latest, so they can drag it off or undo without trial-and-error. An earlier draft promised a "staggered default position" to spread adds out, but that was never wired up and the simpler centre-then-let-the-user-move-it path shipped instead.

## Arrows

Arrows are a second element kind. They link two points on the canvas.

### Endpoints

Each arrow has a **from** and a **to** endpoint. An endpoint is either:

- **Free** — an `(x, y)` position on the canvas.
- **Pinned** — attached to an **anchor** of a shape. A pinned endpoint follows its shape as the shape moves/resizes.

Anchors are eight discrete points on a shape's bounding box:

- Four **corners** — NW, NE, SW, SE.
- Four **edge midpoints** — N, S, E, W.

No "center" or "anywhere on the edge" anchors — only these eight.

### Adding an arrow

Arrows are created by **dragging from an anchor dot on a selected element**.

- When a boxed element is selected (and not locked, not editing, not in a special mode), small **anchor dots** appear on each of its **four edge midpoints** (N, E, S, W). They are filled brand-coloured circles, distinct from the corner resize handles.
- **Press-and-drag** a dot to start creating an arrow: the `from` endpoint is immediately pinned to that anchor, and the `to` endpoint follows the cursor.
- Release on **another element's anchor** (within snap distance, ~24 px) → that endpoint becomes pinned. Release on **empty canvas** → that endpoint stays free.
- Releasing without any drag movement creates a tiny "stub" arrow at that anchor — delete it via the selection popover if it wasn't intended.

The old palette "Add arrow" button has been removed in favour of this direct, contextual interaction.

Snapping during the drag continues to consider all eight anchors of every shape on the canvas — corners and midpoints — so an arrow drag from a midpoint can still snap to and pin at a corner.

### Manipulating arrows

- **Click an arrow** to select it. Selection treatment: thicker brand-tinted stroke, and visible endpoint handles (small circles at each end).
- **Drag an endpoint handle** to move that endpoint. While dragging:
  - If the cursor is within **~24 px** of any shape's anchor, the endpoint **snaps** to that anchor (becomes pinned).
  - Otherwise the endpoint stays free at the cursor position.
- **Drag the middle control handle** to bend the arrow:
  - **Curved arrows** show a small white square (the `CurveHandle`) on the Bezier control point. Drag it to change the bow direction and magnitude; the stored `curveOffset` is a delta from the chord midpoint so the curve survives endpoint moves (the midpoint shifts with the endpoints, the user's chosen offset stays).
  - **Angled arrows** show the same handle on the elbow vertex. Drag it to move the right-angle bend somewhere other than the default auto-corner. The stored `elbowOffset` is a delta from the auto-elbow (`(to.x, from.y)` or `(from.x, to.y)` depending on the direction heuristic) so the bend survives endpoint moves the same way the curve does.
  - Straight arrows have no middle handle (nothing to bend).
- **Click the empty canvas** deselects.
- The selection popover applies to arrows the same way it does to shapes (lock + delete).

### Cascading delete

When a boxed element is deleted, **any arrow whose endpoint is pinned to it is also deleted** in the same operation (counts as one undo step). Stale arrows pointing to a removed element would have nothing to anchor to; cascading delete keeps the canvas clean and the data model consistent.

Arrows with one pinned endpoint and one free endpoint are deleted in the same way — if the pinned side's element goes, the whole arrow goes. Arrows with both endpoints free are unaffected by other deletions.

### Locking arrows

A locked arrow's endpoint handles are not draggable. Same semantics as a locked shape — accidents prevented, deletion still explicit.

### Data model

Lives in `packages/diagram`:

```ts
type Anchor = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

type Endpoint =
  | { kind: 'free'; x: number; y: number }
  | { kind: 'pinned'; elementId: ElementId; anchor: Anchor };

type ArrowElement = {
  id: ElementId;
  type: 'arrow';
  from: Endpoint;
  to: Endpoint;
  locked?: boolean;
  // Visual overrides. `strokeWidth` controls the line thickness, snapped
  // to one of the four ArrowThickness presets (1 / 2 / 4 / 7 px) for
  // the UI but stored as a raw number so legacy values survive.
  // `arrowheadSize` is independent so users can pair a thin line with
  // a chunky head (or vice versa).
  strokeWidth?: number;
  arrowheadSize?: 'small' | 'medium' | 'large' | 'extra-large';
  // Head SHAPE preset, independent of size + ends. Defaults to the
  // filled triangle; hollow / open / dot / diamond variants exist for
  // UML + architecture notation (inheritance, dependency, aggregation,
  // composition).
  arrowheadShape?:
    | 'triangle'
    | 'triangle-hollow'
    | 'line'
    | 'circle'
    | 'circle-hollow'
    | 'diamond'
    | 'diamond-hollow';
  // Path geometry. 'straight' is a single line; 'curved' renders a
  // quadratic bezier bowing perpendicular to the chord by ¼ of its
  // length; 'angled' draws an axis-aligned L-connector with a single
  // right-angle bend. Pinned-endpoint anchors decide which leg of
  // the elbow runs first so the line leaves the element along its
  // anchor direction.
  arrowStyle?: 'straight' | 'curved' | 'angled';
  // Optional user-dragged overrides for the middle control point.
  // `curveOffset` is consulted only when arrowStyle === 'curved',
  // `elbowOffset` only when arrowStyle === 'angled'. Both are
  // stored as deltas from the auto-position (chord midpoint for
  // the curve control point, auto-elbow corner for the angled
  // bend) so the user's chosen shape survives endpoint moves: the
  // auto-position shifts with the endpoints, the delta stays the
  // same. Setting either back to undefined "resets" the arrow to
  // its default shape. See `arrowPathD` + `angledElbow` in
  // packages/diagram for the geometry.
  curveOffset?: { dx: number; dy: number };
  elbowOffset?: { dx: number; dy: number };
  // Optional label rendered next to the arrow's geometric midpoint.
  // Double-click on the arrow body opens an inline editor for this
  // field. The renderer picks one of four cardinal slots (right →
  // below → left → above of midpoint) so the label dodges nearby
  // boxed elements; falls back to "right" if every slot collides.
  label?: string;
};

type Element = ShapeElement | ArrowElement;
```

### Out of scope (next iterations)

- Multi-point / waypoint paths (just two endpoints for now).
- Multi-point / waypoint paths on angled arrows (one bend only for now).
- Anchors at element centres or anywhere on element edges.

## Shape primitives

Fifteen shape kinds, all rendered as absolutely positioned elements on the canvas. The table below covers the seven general-purpose primitives the spec originally shipped with; three more general shapes (`stadium`, `actor`, `cloud`) and five UI device frames (`browser`, `monitor`, `laptop`, `phone`, `tablet`) landed alongside the wireframe templates and are documented in the [Devices accordion](#main-palette-sections) above. The canonical list lives in `packages/diagram/src/index.ts` `ShapeKind`; the test in `apps/live/lib/templates.test.ts` pins shape coverage indirectly via the template catalogue.

| Kind            | Rendering                                                                                                                        | Aspect lock |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `square`        | Rectangle with slight rounded corners (CSS border + background on the wrapper).                                                  | Free        |
| `circle`        | Square frame with `border-radius: 50%`.                                                                                          | Forced 1:1  |
| `diamond`       | Wrapper carries no visible style; inner `<svg viewBox="0 0 100 100" preserveAspectRatio="none">` draws a four-point polygon.     | Forced 1:1  |
| `cylinder`      | SVG overlay drawing a rectangle body with a curved bottom (`A 50,12` arc) and a top ellipse (`rx=50 ry=12`). Database / storage. | Free        |
| `parallelogram` | SVG overlay drawing `polygon points="20,0 100,0 80,100 0,100"`. Input / output in flowcharts.                                    | Free        |
| `hexagon`       | SVG overlay drawing `polygon points="25,0 75,0 100,50 75,100 25,100 0,50"` (flat-top). Preparation / labelled milestone.         | Free        |
| `document`      | SVG overlay drawing a rectangle with a wavy bottom edge (two cubic curves). Output document in flowcharts.                       | Free        |

Styling: a `brand-500` outline over a faint `brand-50` fill, with a subtle drop shadow. Same colours for every kind — only the geometry differs. Fill / stroke colours can be overridden per element via the Selected Element palette section.

Square and circle render purely via CSS (`border-radius` + `background-color` on the wrapper `div`). Every other kind renders its geometry through an **inner SVG overlay** with `viewBox="0 0 100 100"` and `preserveAspectRatio="none"`, so it stretches with the element's box. The wrapper carries no border or background for those — only the selection ring. Anchor dots and resize handles still attach to the wrapper's bounding box (`n / e / s / w` midpoints), not to the geometry, so on slanted or curved shapes the anchor sits next to the visual edge rather than on it. That's acceptable for now and matches how the diamond already behaves.

## Data model

Shapes are **elements** on a tab, per [05-diagram-structure.md](05-diagram-structure.md). The element type lives in `packages/diagram` and is consumed by the canvas and (later) the store and API code:

```ts
type ShapeKind =
  | 'square'
  | 'circle'
  | 'diamond'
  | 'cylinder'
  | 'parallelogram'
  | 'hexagon'
  | 'document'
  | 'stadium'
  | 'actor'
  | 'cloud'
  // UI device frames (wireframing). See spec/09 "Devices" accordion.
  | 'browser'
  | 'monitor'
  | 'laptop'
  | 'phone'
  | 'tablet'
  // Curated single-colour glyph; the chosen glyph is carried by
  // `iconId`. See spec/09 "Icons" accordion.
  | 'icon';

type Element = {
  id: ElementId;
  type: 'shape'; // discriminator: future 'edge', 'group', etc.
  shape: ShapeKind;
  // Catalogue key when shape === 'icon' (e.g. 'server'); ignored
  // otherwise. A plain string, not a closed enum, so the icon set
  // grows without a model migration (apps/live/lib/icons.ts).
  iconId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
```

## Behavior (first version)

- The palette is always rendered on top of the canvas, regardless of which tab is active.
- Each tab owns its own array of elements. Adding a shape adds it to the **active tab** only.
- Switching tabs swaps the canvas content; each tab's shapes persist while the page is loaded.
- Reloads restore the diagram from the api worker (D1), keyed by the diagram id in the URL. The active tab id is encoded in the URL fragment (`#t=<tabId>`) so refreshing keeps you on the same tab.
- When the active tab has zero elements (and the template picker isn't open), an **empty-state card** is centred on the canvas. It contains, top to bottom: a brand-coloured icon (square + circle, evoking diagram primitives), the tab name in bold, an `EMPTY CANVAS` subtitle, a one-paragraph hint explaining the three ways to start ("Open the palette on the left to add shapes, double-click anywhere to drop text, or connect elements by dragging from their anchor dots"), and a **Browse templates** button that opens the template picker. The card sits on top of any background pattern so it stays legible on coloured / patterned canvases.
- The empty-state card disappears once the active tab has at least one element.

## Templates

A first-run **welcome screen** doubles as the template picker — the "Start a new diagram" modal lets users scaffold a starter diagram and set up their identity in one step. It is also reachable from the empty-state card's **Browse templates** button.

The modal is **multi-step in a single view**: identity at the top, then template selection, then theme selection, with an explicit **Create diagram** button at the bottom that commits all three at once. Users can preview their choices before committing instead of the previous one-click flow.

### Welcome / identity section

At the top of the modal, an inline avatar + name input lets the user adjust their display name. The participant is initialised on page load with a **randomly generated name** (`{adjective} {animal}` from a curated list) and a **random colour** from a 10-colour accessible palette. The name input is pre-populated with the generated name; the user can override it. The colour is shown via the avatar but not editable in the prototype. Clicking Create commits the (possibly edited) name onto the self-participant — the colour stays as assigned. Submitting an empty name reverts to the generated default.

### Templates section

Below the welcome section, a 4-column responsive grid of template cards (2-col on narrow viewports). One card is always selected (defaults to **Blank**). The catalogue (`apps/live/lib/templates.ts`, pinned by `templates.test.ts` so spec drift surfaces as a test failure) ships **8 default templates** plus **12 extras behind a "Show more templates" toggle**:

- **Blank diagram** — drops a **single 220 × 100 square** centred on the visible viewport, pre-labelled `Blank Diagram` at `md` text size, and **auto-selects it** so the user can immediately rename or edit. Generalised rule: a template that produces exactly one element auto-selects that element; multi-element templates leave the selection cleared.
- **Mind map** — a central circle with four labelled branch boxes, each sprouting two leaf cards, all connected by pinned arrows.
- **Org chart** — a leader rectangle with three direct-report rectangles pinned beneath it.
- **Retrospective** — three columns ("Mad", "Sad", "Glad") each with three blank stickies in tinted containers.
- **Flowchart** — Start → Step → Decision → Step → End vertical chain with shape-kind variety (stadium / square / diamond).
- **Kanban** — five lanes (Backlog / To do / In progress / Review / Done) with four ticket cards each. Every card pairs a title block with a priority chip (high / medium / low). Board carries a "Sprint board" title above the columns so the diagram has an anchor and a natural rename target.
- **SWOT** — Strengths / Weaknesses / Opportunities / Threats 2×2 grid in tinted quadrants, with three bullet starters per quadrant and a centre "Subject" pill that names the thing being analysed.
- **Timeline** — horizontal line with five milestone circles, labels alternating above and below.

Extras (behind Show more):

- **Venn diagram** — three semi-transparent outlined circles arranged in a triangle, set labels around the outside, "All" label at the centroid.
- **User journey** — five stage cards in a row with arrows between, each backed by a sticky note for the feeling at that stage.
- **Fishbone** — horizontal spine arrow pointing at an Effect card, four diagonal category branches.
- **Pyramid** — four stacked tiers (Vision → Strategy → Tactics → Operations), peak tier accent-coloured.
- **Mobile wireframe**: phone-frame device shape pre-populated with a stack of UI primitives (status bar, header, content rows, action button) sized for the phone canvas.
- **Laptop wireframe**: laptop-frame device shape with a browser-window header + content rows + sidebar columns laid out for desktop-screen prototyping.
- **Slide deck**: sequence of slide-shaped rectangles arranged for a deck outline (title slide + N content slides).
- **Flywheel**: four labelled stages arranged in a momentum loop with arrows curving from each stage to the next.
- **Logo design**: four logo-design variations on one canvas: icon-left-of-text and icon-above-text layouts, each in a title-only and title-with-tagline pairing.
- **Gantt chart**: a month header row (Jan–Dec) plus six cascading milestone rows, each a full-width track with a right-aligned label and a coloured duration bar stepped further right than the last. A project-planning starter. The six bars carry **distinct intrinsic fills** that survive a theme change: each bar shape sets `themeLockFill` (a per-shape opt-out honoured by all three theme transforms in `apps/live/lib/themes.ts`), so the bars stay individually coloured under every theme instead of collapsing to the theme's single `elementFill` — the same exemption sticky notes get for their amber. The header + track chrome carry no such lock and adopt the theme fill normally.
- **Live card**: a collaborative greeting-card lockup — a left panel with a hero image placeholder and a bold title, and a right panel that is a board of four grouped avatar + message rows. Images are empty placeholders so the template ships no bytes.

The opt-in shape mirrors themes + canvas patterns: `TemplateDescriptor.extra?: boolean` drives the toggle; the picker filters by `(!t.extra || showExtra)`. Auto-expands on revisit when the tab was created from an extra template.

**Per-template canvas backdrop.** Each template ships with the background pattern that best suits its layout, applied on top of the chosen theme (which supplies only the colours) via `templateCanvasOverrides(kind)` in `apps/live/lib/templates.ts` (pinned by `templates.test.ts`). The pattern wins over the theme's default at creation time: alignment-heavy scaffolds (Flowchart, Org chart, SWOT, Gantt, Kanban, both wireframes) get the square **Graph** paper; clean radial / slide layouts (Venn, Flywheel, Pyramid, Slide deck) get a **Blank** canvas so the shapes carry the page; the **Logo design** sheet gets the **Checkerboard** design board; Timeline and User journey get horizontal **Lines**; the sticky-note / freeform boards (Retrospective, Fishbone, Live card) and Mind map pin an explicit dot **Grid** (so they keep it even under a blank-canvas theme). Mind map additionally softens `backgroundOpacity` to `0.8`. The Blank template carries no override and inherits the theme's pattern.

All template elements are inserted via the history hook (commit), so they're undoable in one step. The picker animates in via the global `fly-up-in` keyframe (see [Motion and animations](#motion-and-animations)).

### Theme section

Below the templates, a 6-column responsive grid of theme cards (3-col on narrow viewports) lets the user pick a preset theme — exactly the same `THEMES` catalogue the [palette's Theme accordion](#current-tab-section) uses. Defaults to **Brand**. Confirming with **Create diagram** applies the chosen theme to the new tab (background colour + pattern + pattern colour + theme id), which then affects the default colours of every element added afterwards.

## Comments

Every boxed element can carry a **comment thread**. Stored as `commentThread?: { comments: Comment[]; resolved: boolean }` on the element. Each `Comment` carries the text, `createdAt` ms timestamp, and a denormalised copy of the author's `name` + `color` taken from the current [participant](#welcome--identity-section). Author is recorded at write-time so renaming yourself later doesn't rewrite historical comments.

### Opening the thread

Two entry points open the same `CommentThreadPopover`:

- **Selection popover → Comment button** (speech-bubble icon). Available whenever a single element is selected.
- **Comment badge** on the element itself. Shown only when the thread has unresolved comments (resolved threads hide the badge). The badge sits inside the **BadgeStrip** at the element's top-right — a single rounded card that also hosts the link badge when present. Both badges counter-scale with the canvas zoom so they keep their on-screen size.

The popover is portal-rendered (it escapes the canvas transform), anchored to the right edge of the element, and flips to the left edge if it would overflow the viewport. It closes on outside click and on Escape.

### Inside the popover

- Header: "Comments (n)" + a **Resolve / Resolved** toggle + close button.
- Scrolling list of comments (oldest first). Each row shows the author's circular initial badge (in their colour), their name, a relative timestamp ("3m ago"), and the text. Hovering a row reveals a delete button (disabled when the thread is resolved).
- Reply box at the bottom with a textarea + Comment button. **Cmd/Ctrl + Enter** submits.

### Resolve semantics

`resolved: true` is sticky — the comments are kept, the badge is hidden, and the reply box is hidden. The user can **Resolve** anytime there's at least one comment, and **Unresolve** to bring it back. Posting a new comment on a resolved thread auto-unresolves it.

### Persistence and undo

Comment mutations bypass the [undo/redo history](#undo--redo) (so typing a comment then Ctrl+Z doesn't unexpectedly wipe it). They update the present tab list directly via the history hook's `tick` setter. Deleting the last comment removes the `commentThread` field entirely so the element type stays slim.

## Motion and animations

The editor uses subtle, purposeful motion to feel fluid and modern. All animations are defined as `@keyframes` in `apps/live/app/globals.css` and exposed as Tailwind utility classes via `@theme`:

- **`pop-in`** — `scale(0) → scale(1.06) → scale(1)` over 240 ms with a spring-easing curve. Applied to `BoxedElementView` so newly added shapes / text / stickies pop into existence. Transform-based, so it must only be used on elements that don't carry their own inline `transform` style.
- **`fade-in`** — pure `opacity` 0 → 1 over 180 ms. Used wherever the element already has an inline `transform` (the selection popover, plus buttons, mode banner, portal menus, tab-link picker, tooltips) so the animation doesn't fight positioning.
- **`fly-up-in`** — combined `translateY(16px) scale(0.96) → 0 / 1` over 280 ms. Applied to modal-style surfaces (template picker, empty-state card).
- **`fade-scale-in`** — reserved for surfaces that want a scale entrance without conflicting positioning.

Animations only fire on mount, so they naturally trigger once per element. Switching tabs unmounts the old tab's elements and mounts the new ones, so the destination tab's elements animate in too — a side-effect that makes tab switches feel lively.

## Selection

- **Click a shape** to select it. Selection is visible as a thicker brand-tinted outline plus four corner handles.
- **Click the empty canvas background** (anywhere not on a shape, palette, or popover) to deselect.
- Single-element selection coexists with **multi-select** (the [Marquee box-select](#marquee-box-select) section below) and **group select** (the Group accordion). The single-element popover is suppressed for multi-selections, where the `MultiSelectionToolbar` takes over.
- Clicking the command palette never affects selection.

### Selection popover

When a shape is selected, a small **popover menu** appears next to it with action buttons (icon-only).

- **Position:** above the shape if there is room between the shape and the canvas top edge; otherwise below it. Horizontally centred on the shape.
- **Layout:** small rounded panel with the same styling language as the palette (border, shadow).
- The popover follows the shape during drag/resize — its position is derived from the shape's current bounds.
- Clicking inside the popover never deselects.

Button set (left to right, grouped by a thin divider):

Format + duplication:

- **Format painter** — copies the selected element's formatting onto the next element clicked. Paintbrush icon. See [Format painter](#format-painter). (Shown for boxed elements only — not arrows.)
- **Duplicate** — clones the selected element in place (offset slightly). Arrows are skipped in the duplicate to avoid orphaned endpoints.

Relationships:

- **Link Element** — opens a `TabLinkPicker` listing every other tab in the diagram (and the user's most recent diagrams when available). Picking a tab writes `link: { kind: 'tab', tabId }` onto the element; picking a diagram writes `link: { kind: 'diagram', diagramId }`. The linked target opens on a follow-link click. Hidden when the diagram only has one tab and there are no recent diagrams to offer.
- **Comments** — opens the `CommentThreadPopover` for the element's comment thread. See [Comments](#comments).
- **Group / Ungroup** — Group enters group-mode to extend the selection into a group. Ungroup breaks the current group apart. See [Groups](#groups). (Shown for boxed elements only.)

State + destructive:

- **Lock / Unlock** — toggles the element's locked state. Icon flips between an open and closed padlock.
- **Delete** — removes the selected element from the active tab and clears selection. Trash icon.

Bring to Front, Send to Back, **Lock aspect ratio**, and the colour swatches all live in the palette's [Selected Element](#selected-element-section) accordions — they were in the popover at one point and got moved out so the floating widget stays compact.

For **boxed elements** (shapes, text, sticky notes), a separate **plus button** appears just outside the element's right edge while it's selected — see [Quick add + connect](#quick-add--connect).

## Panning the canvas

The canvas can be **panned** to bring off-screen content into view.

- **Hold Space and drag the empty canvas background** (anywhere that isn't an element, palette, or popover) to pan. Same vocabulary as Figma / Excalidraw; leaves the bare drag gesture free for [marquee box-select](#marquee-box-select).
- Drag offsets the entire canvas content (shapes, arrows, plus buttons, selection popover, dot-grid background) as a unit. The palette and mode banners stay fixed.
- The cursor switches to `grabbing` while a pan is in progress.
- A press-and-release of Space+drag without movement counts as a **click** and deselects, as before.
- Double-click still drops a text element at the click position (now in the panned canvas-coordinate space).

The **Fit-to-screen** control (in the bottom-right `ZoomControls`) centres the viewport on the active tab's content and picks the largest zoom level that fits every element with a small margin. Empty tabs reset to (0, 0) at zoom 1. Same gesture as Figma / Excalidraw's "Zoom to fit". Also fires automatically the first time the active tab gains content (on diagram open and again on each tab switch into a non-empty tab) so a saved tab loads framed rather than at the previous session's pan / zoom.

### Touch (iOS / iPad)

On a touch device, the canvas surface declares `touch-action: none` and `user-select: none` (plus the iOS-specific `-webkit-touch-callout: none` and `-webkit-tap-highlight-color: transparent`). Without those, mobile Safari intercepts a one-finger drag for native scrolling, treats a long-press as the system text-selection callout, and shows a tap highlight ring on every element press. Pointer events are then dispatched normally so the same handlers (pan in Pan mode, marquee in Select mode, move / resize on elements) work from a finger or a stylus the same way they work from a mouse. Pinch-to-zoom is also disabled because the canvas owns its own zoom (wheel / +/- buttons / Fit). A dedicated touch pinch handler can land later; until it does, touch zoom goes through the Zoom controls.

## Marquee box-select

**Press-and-drag the empty canvas background** (without holding Space) to draw a translucent selection rectangle. On release, every boxed element whose bounding box intersects the rectangle is multi-selected. Releasing inside a sub-4-pixel area is treated as a click and deselects.

A multi-selection is mutually exclusive with the single-element selection:

- 0 hits → both cleared.
- 1 hit → single-select that element (popover + accordion still apply).
- 2 + hits → enter **multi-select** mode. The single-element popover is suppressed (a per-element toolbar doesn't make sense for many at once). Each multi-selected element still shows its selection ring via `BoxedElementView`'s `isSelected` prop.

While multi-selected:

- **Press-and-drag any member** moves the whole group in lockstep. The drag handler reads `multiSelectedIds` and pre-populates `startBounds` with every member.
- **Delete / Backspace** removes every multi-selected element and any arrows that reference one of them. Single-element delete falls back to the same logic when there's no multi-selection. The keyboard handler is suppressed while a label is being edited or focus is inside any text input.
- **Plain click on a non-member** adds it to the multi-selection (the marquee mode is "sticky" once active — the user is clearly refining a bundle, not starting over). This applies to arrows as well as boxed elements.
- **Shift-click any element** toggles its membership — adds if absent, removes if present. Folds the current single selection in first so "I had A selected, now also B and C" works without losing A.
- **Click empty canvas** or **switch tabs** clears the multi-selection.

Marquee hits include both boxed elements (shape, text, sticky) and arrows whose endpoint AABB falls inside the rectangle. Duplicating a marquee that contains both carries the connectors across with their endpoints remapped to the duplicated targets.

## Quick add + connect

When a **boxed element** (shape, text, sticky note) is selected and not in edit/paint mode, **two plus buttons** float around its bounding box:

- One on the **right** edge, vertically centred — duplicates to the right with an arrow `e → w`.
- One on the **bottom** edge, horizontally centred — duplicates below with an arrow `s → n`.

Either click:

1. **Duplicates** the element (same size, same content, same locked state — fresh id).
2. Places the duplicate in the chosen direction with a small gap.
3. **Connects** them with a new arrow pinned between the appropriate anchors.
4. Selects the duplicate so the user can keep building outward.

Both plus buttons are hidden while the element is being edited or while format-painter / group mode is active. Not shown for arrows.

## Layer order

Boxed elements paint in **array order** — earlier in the tab's `elements` array means rendered earlier (further back); later means rendered on top. Arrows always render in a single SVG layer on top of all boxed elements (this is a current rendering limitation, not a long-term design).

New elements always land at the **front** of the z-order:

- **Palette adds** (shape / text / sticky / image / arrow / freehand, including the draw-to-size + pencil paths) **append** to `elements`, so the new element lands on **top** of existing content. Surfacing a freshly added element where the user can see and immediately work with it is the expected default; the Layer accordion's **Send to back** covers the rarer case where it should sit behind. (An earlier iteration prepended palette adds to drop them at the back, but landing new content on top matches how every other editor behaves and is what users reach for.)
- **Paste and duplicate** likewise **append**, so the freshly minted copies land at the **front**: the user just copied them, surfacing them on top of the source is the expected behaviour.

The selection popover exposes:

- **Bring to Front** — moves the selected element to the end of the elements array.
- **Send to Back** — moves the selected element to the start.

These apply to any element type (including arrows, where they re-order among arrows).

## Rotation

Any boxed element (shape / text / sticky / image / freehand) can be rotated about its centre. The angle is stored as `rotation?: number` — clockwise **degrees**, normalised into `[0, 360)`; absent or `0` means unrotated. It rides in the element JSON, so copy / paste / duplicate / persistence round-trip it for free.

- **Handle**: a small circular rotate handle sits just **beyond the bottom-right corner** (outside the SE resize handle so the two never overlap), shown whenever the element's resize handles are. Click-drag it to spin the element; the body still drags to move and the corner handles still resize.
- **Pivot**: rotation is about the element's centre (`transform: rotate()` with `transform-origin: center`). Handles + anchors are children of the wrapper, so they rotate with the box. The drag reads the wrapper's bounding-rect centre at grab time and sweeps the pointer angle in screen space (rotation is conformal under the uniform canvas zoom, so screen-space angles equal canvas-space angles — no zoom/pan inversion needed).
- **Snapping**: the angle snaps to the nearest **15°** increment (which covers 0 / 45 / 90 / 180 / …) whenever it lands within ~7° of one, so squaring a shape up is effortless. **Hold Shift** to disable the snap for fine control.
- **Resize while rotated**: the four corner resize handles are **hidden while an element is rotated** (rotation not a multiple of 360°). The resize math runs in canvas-axis space, so dragging a corner of a spun box would make it "swim"; rotating back to 0° restores resize. The rotate handle itself stays available at any angle so a rotation is always reversible.
- **Arrow anchoring is rotation-aware**: `anchorPosition` rotates the anchor point about the element's centre, so an arrow pinned to a rotated shape connects to the visually-rotated edge (and `snapToAnchor` pins to the right face). Auto-rebind (`bestAnchorTowards`) rotates the target direction into the element's local frame before choosing a face, so dragging a rotated, connected shape still re-pins sensibly.
- **Known limitations (current iteration)**: the marquee bounding box is still computed from the element's **unrotated** axis-aligned box, and resize is disabled while rotated (see above). Rotation-aware resize is deferred.
- **Telemetry**: grabbing the rotate handle emits `Element / Rotated / <kind>` (the shape kind, or the element type for text / sticky / image / freehand).

## Text element

A free-floating text element. The text **is** the element — there is no border or fill.

- Added from the **Text** palette button.
- Default content: `"Text"`. Default size: 220 × 64.
- **Drag** to move; **resize** via the same four corner handles as shapes. Text auto-scales to fit the box (same SVG-based fit-to-bounds technique as shape labels).
- **Double-click** to edit content; **Enter** commits, **Escape** cancels.
- A faint dashed outline appears when selected so the bounds are visible.
- All other behaviour (selection, popover, lock, format painter, layer order, plus button) matches shapes.

Data:

```ts
type TextElement = {
  id: ElementId;
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  locked?: boolean;
};
```

## Sticky note element

A yellow sticky-note element for short notes / annotations on the canvas.

- Added from the **Sticky** palette button.
- Default content: empty (placeholder "Note"). Default size: 200 × 200.
- Visual: amber-100 background, amber-200 border, soft drop shadow, slightly rounded corners.
- **Multi-line** text (unlike shapes / text elements). Wraps naturally; long text is clipped (resize to see more).
- **Double-click** to edit. While editing, **Enter** inserts a newline; **Escape** cancels. Commit happens on blur.
- All other behaviour (drag, resize, lock, format painter, layer order, plus button) matches shapes.

Data:

```ts
type StickyElement = {
  id: ElementId;
  type: 'sticky';
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  locked?: boolean;
};
```

## Groups

Boxed elements (shapes, text, sticky) can be **grouped** so they move, delete, lock, and reorder as a unit while remaining individually editable.

### Data model

Each boxed element optionally carries a `groupId: ElementId`. All elements sharing the same `groupId` are members of the same group. Arrows are not grouped.

```ts
type BoxedElement = ... & { groupId?: ElementId };
```

### Creating a group

- The selection popover for a boxed element shows a **Group button** (overlapping squares icon).
- Clicking it enters **group mode** — a status pill appears at the top of the canvas, "Click another element to add to the group", with a **Done** button.
- Group mode is **persistent**: each click on a boxed element extends the group, and the mode stays open so the user can group several elements in one pass. The mode only exits when the user clicks **Done**, presses **Escape**, or clicks an arrow / the empty canvas.
- Each click joins targets into the source's group:
  - If neither is grouped yet, a fresh `groupId` is assigned to both.
  - If the source already has a `groupId`, that id is reused for subsequent targets.
  - If a target was in a different group, that group's members all migrate.
- Clicking the source element itself is a no-op (it's already in the group).

### Group selection

Clicking any group member selects the **whole group** — all members receive the selection treatment. The selection popover's bounds are the **union** of all members' bounds.

### Operations on a group

| Operation                     | Behaviour                                                                                                                                                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Move (drag)                   | All members translate by the same delta.                                                                                                                                                                                                              |
| Resize                        | **Disabled.** Corner handles are hidden — ungroup to resize.                                                                                                                                                                                          |
| Delete                        | Removes all members + cascading arrows pinned to any of them.                                                                                                                                                                                         |
| Lock                          | Toggles `locked` on all members. Direction is determined by the originally selected member's current lock state.                                                                                                                                      |
| Bring to Front / Send to Back | All members move to top / bottom together, preserving relative order.                                                                                                                                                                                 |
| Double-click to edit          | Edits only the clicked member's label.                                                                                                                                                                                                                |
| Quick add + connect           | Duplicates **all group members** together (preserving their relative positions) plus any arrows internal to the group, shifted as a unit. The connector arrow goes from the originally selected member to its duplicate. The copies form a new group. |
| Format painter                | Applies to the clicked target only (group membership ignored).                                                                                                                                                                                        |

### Ungrouping

When the current selection is a group, the popover shows an **Ungroup button** in place of (or alongside) Group. Clicking it clears `groupId` on every member; selection collapses back to the originally selected element.

### Out of scope (next iterations)

- Nested groups.
- Selecting a single member of a group without ungrouping first (alt-click).
- Visible outline around the group's union bounds.
- Group-level resize.

## Format painter

A way to copy an element's **formatting** (size, eventually colour and style) onto another element — same mental model as Word/Figma's format painter.

### Initiating

- The selection popover on a shape includes a **paintbrush icon** button.
- Clicking it puts the editor into **format-painter mode**, with that shape as the **source**.
- A status pill appears at the top of the canvas: "Click an element to apply formatting" with a Cancel button.
- The cursor changes to a copy cursor over elements while the mode is active.

Arrows don't expose this button for now (no formatting to copy yet).

### Applying

- The next **click on any shape** applies the source's formatting and exits the mode.
- Clicking an arrow, the empty canvas, pressing **Escape**, or pressing **Cancel** exits the mode without applying.
- Painter mode is **single-shot** — one click applies, then the mode ends. To paint another target, click the brush again.
- Clicking the source shape itself does nothing useful (it would apply its own formatting); the mode still exits.

### Properties copied

Works between any two **boxed** elements (shape, text, sticky). Today:

- `width`, `height` — the element's size.

Will be added as the feature set grows:

- Fill / stroke colour.
- Border radius / corner style.
- Label font weight, size, colour.

Explicitly **not** copied — these are per-element, not formatting:

- `x`, `y` (position).
- `label` (content).
- `locked` state.
- For shapes, `shape` itself (you don't turn a circle into a square via format painter).

## Text size

Each boxed element carries a `textSize` setting controlling how its label renders. Four values:

| Value     | Behaviour                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `'scale'` | **Default.** Label auto-scales to fit the box (current SVG fit-to-bounds for shapes / text; multi-line wrap at a small default font for sticky). |
| `'sm'`    | Fixed small font.                                                                                                                                |
| `'md'`    | Fixed medium font.                                                                                                                               |
| `'lg'`    | Fixed large font.                                                                                                                                |

Selectable from the [Selected Element](#selected-element-section) section of the palette. When set to a fixed size, content is centered (single-line) or wrapped (sticky). Resizing the element does not change the font — only `scale` reacts to box size.

```ts
type TextSize = 'scale' | 'sm' | 'md' | 'lg';
type BoxedElement = ... & { textSize?: TextSize };  // defaults to 'scale'
```

## Quick text drop

**Double-clicking the empty canvas** (anywhere not on an element, palette, or popover) drops a new **text element** at the click point and **immediately enters edit mode** on it. The text is centred on the cursor position. Press Enter to commit or Escape to cancel — Escape will leave an empty text element in place, which the user can then delete.

## Auto-select on add

Every palette `Add ...` button auto-selects the newly created element. The selection popover, the plus buttons, and (if applicable) the Selected Element palette section appear immediately, ready for the next action.

## Editor header

The editor header carries three things:

- The `livediagram` brand mark (left), accent-coloured from the active tab's theme stroke.
- The **diagram title** (centre). Defaults to `Untitled diagram`. Click to rename in place — the title becomes a text input with the current name pre-selected. **Enter** commits, **Escape** cancels, **blur** commits. Empty value reverts to the previous name. A small **Private** or **Shared** badge sits immediately to the right of the title and surfaces the current sharing state.
- The **Share button** (right). Visible only to the diagram owner — visitors arriving via a share link can't toggle sharing on their host's diagram. Opens the share dialog (manage links, roles).

The diagram title persists via the api worker (`apiSaveDiagramMeta`). Per-tab names live on each `Tab` and are edited from the tab bar (see [Tabs](#tabs)).

Rename and Delete for the **current** diagram live in the Explorer panel's "Current Diagram" row, not in the header — the header stays a thin chrome strip. Other participants render as cursors + selection rings on the canvas itself (see [11-api.md → Durable Object room](11-api.md)), not in the header.

## Tabs

The tab bar sits at the bottom of the editor. Each tab represents one canvas with its own elements and background pattern.

### Selecting & adding

- Click a tab to switch to it. Switching clears element selection, edit mode, and any active picker/group mode, AND **fit-to-screens** the new tab's content on load (so the user lands centred on whatever's there, not wherever the previous tab left the viewport). Subsequent edits on the same tab don't re-fit — the gate is per tab id.
- The **+** button at the right of the bar adds a fresh empty tab and switches to it.

### Tab pill styling

Each tab pill colours itself from its tab's theme:

- Pill text colour uses `getTheme(tab.theme).elementStroke` (falls through to the brand sky for themes that don't override the stroke).
- The active pill additionally tints its background to a 10% alpha of the same accent.
- A small **padlock icon** sits to the left of the name when `tab.locked === true`.
- Per-tab **participant avatars** stack to the right of the name — one circle per remote participant whose `tab-focus` op points at this tab. Lets the user see at a glance who's working where.

### Renaming

A tab can be renamed in two ways:

- **Double-click the active tab's name** → inline input (Enter commits, Escape cancels, blur commits).
- **Tab menu → Rename** (see below).

### Tab menu (ellipsis)

The active tab carries a **`⋯` ellipsis button** to the right of its name. Clicking opens a small floating menu (right-clicking any tab opens the same menu, suppressing the browser's default context menu and switching to that tab first if it isn't active so the menu's actions operate on the tab the user pointed at) with:

- **Rename** — enters inline rename mode.
- **Duplicate** — creates a copy of the tab (same elements, same pattern, name suffixed with " copy") inserted directly after the source, and switches to it.
- **Clear content** — wipes every element from the tab in one undoable commit. Disabled when the tab is already empty or when the tab is locked.
- **Lock / Unlock** — toggles `tab.locked`. While locked, every element on the tab is read-only (matches per-element lock semantics), the palette's Add buttons stop firing, theme / canvas changes are blocked, and the tab pill shows the padlock icon (see above).
- **Add to another diagram** — submenu listing every other diagram the participant owns. Picking one links the tab into that diagram via `POST /api/diagrams/:id/tabs/:tabId/link` (the source tab stays put; both diagrams now share the same `tabs.data` row so edits propagate, see [spec/17](17-tab-diagram-many-to-many.md)).
- **Delete** — removes the tab and falls back to a neighbouring tab. Disabled when only one tab remains.

The menu renders through a **portal** to `document.body` and positions itself from the ellipsis button's bounding rect, so it isn't clipped by the tab bar's horizontal scroll.

### Reordering

Tabs are **draggable** via the native HTML5 drag API. Dragging a tab over another shows a ring around the drop target; releasing reorders the source to the target's position.

## Element links

Any element can carry a **link to another tab**. Clicking the link jumps to that tab.

### Setting a link

- The selection popover's Relationships group has a **Link Element** button (chain icon, between Duplicate and Comments). It's hidden entirely when the diagram only has one tab and there are no recent diagrams to link to.
- Clicking it opens a small **TabLinkPicker** popover above the button (portal-rendered, viewport-clamped) listing every other tab.
- Click a tab name to set the link. Click again on the same tab to keep it, or click another to switch. A **Remove link** action appears at the bottom of the picker when a link is set.

The Link button is brand-tinted when the selected element has a link.

### Visual indicator

A linked boxed element shows a small brand-coloured **link badge** in its top-right corner with a chain icon. The badge:

- Is counter-scaled with `1/zoom` so it stays the same on-screen size at any zoom.
- **On click**, navigates to the linked tab (`setActiveId(tabId)`), clearing selection and edit/mode state — the same effect as picking the tab in the tab bar.
- Stops propagation so it doesn't trigger element select / drag.

Arrows can also carry a link but don't show a visible badge yet (no obvious place to put one); future iteration may put a badge at the arrow's midpoint.

### Data model

```ts
type ElementLink =
  | { kind: 'tab'; tabId: TabId }
  | { kind: 'element'; tabId: TabId; elementId: ElementId };
```

Today only the `'tab'` kind is exposed in the UI. The `'element'` kind is in the model so future iterations can "jump and focus a specific element" without a schema change.

### Group behaviour

Setting or clearing a link applies to **all members of the current selection** (consistent with other per-element ops). Each linked member shows its own badge.

## Tooltips

Every icon button on the palette and selection popover shows a **tooltip** on hover (and focus) with:

- A short **title** in bold.
- A one-sentence **description** explaining what the action does.

Tooltips render in a portal at the top level of the document so they're never clipped by parent overflow. They appear above the target (with a small gap), centered horizontally on the button.

The tooltip is a shared, reusable element used wherever a control needs a richer hover than `aria-label`.

```tsx
<Tooltip title="Add square" description="Drop a new square shape on the canvas.">
  <button>…</button>
</Tooltip>
```

`aria-label` continues to serve screen readers; the tooltip is for sighted users wanting to know what an icon does.

## Labels

A shape can carry an inline **text label**.

- **Double-click a shape** to enter label-edit mode. The shape's centre becomes an editable input.
- With a single element selected, **press Space** for the same effect (keyboard equivalent of the double-click). Multi-selection Space falls through to the canvas pan modifier (see Move) since there's no obvious single label to edit; held Space + drag stays the pan modifier in every selection state.
- **Type-to-edit:** with a single label-bearing element selected (not yet editing), pressing any **printable character** (a letter, digit, or punctuation; Space is excluded so it stays the pan/edit modifier) opens the label editor seeded with that character, **replacing** the existing label. This intentionally wins over the single-key tool / add shortcuts (`R`/`O`/`D`/`T`/`N`/`A`/`I`/`F`, `S`/`P`/`L`) when an element is selected: a user who selects a shape and starts typing expects to edit its text, not to drop a new element. The shortcuts still fire when nothing (or a multi-selection) is selected. Read-only (view-role) sessions never type-to-edit, so viewers keep the tool shortcuts. Non-labelable selections (image, freehand) fall through to the shortcuts unchanged.
- Type to set or change the label.
- Commit with **Enter** or by **clicking outside**. Cancel with **Escape**.
- The label **auto-scales to fit the shape** — text is rendered inside an SVG whose `viewBox` is set to the text's measured bounds, with `preserveAspectRatio="xMidYMid meet"`. The text scales uniformly to fill the shape: bigger shapes get bigger text; longer labels shrink to fit.
- During edit, selection handles and the popover are hidden so they don't get in the way.
- **Locked** shapes can still be labelled — locking protects position, not content.
- Empty labels are valid (nothing is rendered).
- Labels are **single-line** for shapes and text; **multi-line** for sticky notes. Multi-line in other element types is out of scope.
- Label data lives on the element: `label?: string`.

### Edit vs modes

- **Format painter mode blocks double-click edit** — the first click is meant to apply the format. Once it does, paint mode exits and subsequent double-clicks edit normally.
- **Group mode does not block double-click edit** — entering edit immediately exits group mode. This stops users from getting stuck when they forget to click Done.

## Locking

A shape can be **locked** to prevent accidental movement or resizing.

- Toggled from the **Lock button** in the selection popover.
- A locked shape:
  - Can still be **selected** (so the user can unlock it).
  - **Cannot be moved** — dragging the shape body does nothing.
  - **Cannot be resized** — corner handles **are hidden entirely** while locked, so they can't be grabbed.
  - Can still be **deleted** from the popover — deletion is explicit, not an "accident".
  - Can still be **labelled** (double-click) — locking protects position, not content.
- A small **lock indicator** badge sits in the shape's top-left corner whenever it's locked, so the state is visible even when the shape is not selected.
- Locked state lives on the element: `locked?: boolean` (defaults to `false` / `undefined`).

## Move

- **Press-and-drag a shape** to move it.
- The press both selects the shape and starts the move in one gesture; on release, the shape stays at its new position.
- The shape follows the cursor delta from where the drag began. During the drag, **edge-alignment snap** nudges the candidate position so its left / centre-x / right edges line up with any other element's left / centre-x / right edges within `ALIGN_SNAP_THRESHOLD` (6 canvas px); same for top / centre-y / bottom on the Y axis. The smallest available delta on each axis wins; the elements being dragged are excluded as snap targets so a group drag doesn't snap to itself. See `snapToAlignment` in `packages/diagram` for the helper.
- **Equal-spacing (distribution) snap** runs alongside edge-alignment: when the dragged element would sit at an equal distance _between_ two neighbours, or one gap _beyond_ a pair that already share a gap (so three elements end up evenly spread), it snaps so the gaps are exactly equal — fixing the "close but never exact" spacing problem. Each axis only considers neighbours that overlap the dragged element on the perpendicular axis (a horizontal row for X-spacing, a vertical column for Y), and edge-alignment wins an axis when both fall in range. See `distributionSnap` in `packages/diagram`.
- Shapes can be placed anywhere on the canvas, including overlapping each other. No bounds.
- **Keyboard nudging** — with a selection (single or multi), the **arrow keys** move it by **1 px** per press, or **10 px** with **Shift** held. Boxed elements shift their `x`/`y`; free arrow endpoints shift their `from`/`to`; pinned arrow ends follow their anchored element and (when the `autoRebindArrows` preference is on, see [spec/20](20-user-preferences.md)) re-pick their best face via `rebindArrowAnchorsAfterMove`, exactly as a drag-move does. A run of nudges coalesces into a **single undo step**: the first press takes a history checkpoint, subsequent presses `tick` the present without pushing history, and the burst closes after a short idle. Suppressed while editing a label or with focus in a text input; view-role sessions don't nudge. Telemetry: `track('Element', 'Changed', 'Nudge')` once per burst.

## Resize

When a shape is selected, **four corner handles** (NW, NE, SW, SE) appear as small white squares with a brand-600 border.

- **Press-and-drag a handle** to resize the shape.
- The corner opposite the handle stays anchored; the dragged corner follows the cursor.
- **Minimum size is 20×20** to keep shapes pickable.
- Resize uses the four corner handles. Free-form by default; the Shape accordion's **Lock aspect ratio** toggle constrains the W:H ratio while a resize is in progress (Circle and Diamond force the ratio regardless). **Holding Shift during the drag** is the standard one-off constrain modifier (Figma / Photoshop convention): the active drag honours the shape's start ratio without flipping the persistent toggle. Locked shapes stay locked regardless of Shift; the modifier is additive, not a toggle.
- Mid-edge handles (N, S, E, W) are not implemented, corners only.
- **Snap during resize** nudges the active edge to align with neighbour elements' edges / centres AND to match their width or height. Dimension-match means dragging a shape that's 215 px wide near another at 220 px snaps the width to exactly 220, so the user can size siblings to a shared width without pixel-fiddling. Edge-align and dimension-match compete on each axis; the smaller absolute delta wins (so a near-edge alignment beats a near-match dimension when both fall inside the threshold). Degenerate (zero-width / zero-height) elements are excluded as dimension targets. See `snapResizeBounds`.

## Alignment guides

When a move or resize snap lands an element's edge or centre onto a neighbour's, the canvas draws a **faint guide line** along the shared edge / centre line so the user can see _why_ the element snapped where it did. This makes lining shapes up on a busy canvas much easier: the guide visibly connects the dragged element to the neighbour(s) it aligned with.

- **Derivation is post-snap and decoupled from the snap math.** After the snapped bounds are computed (move or single-element resize), `alignmentGuides` in `packages/diagram` re-scans the other elements and reports every candidate line (left / centre-x / right on the X axis, top / centre-y / bottom on the Y axis) that now coincides with a neighbour's line within a tight epsilon (0.5 px). Because it keys off the _already-snapped_ position, a guide only appears when there is a genuine alignment, i.e. exactly when a snap is in effect; free dragging away from everything shows nothing. The dragged elements are excluded as targets so a group drag never guides against itself.
- **One line per coincident axis-line.** A guide is vertical (constant x) when an X-axis line matches, horizontal (constant y) when a Y-axis line matches; more than one of each can show at once (e.g. left edges aligned with one neighbour and centres with another). Guides at the same axis + position are merged.
- **Each guide spans the elements it relates.** The line runs from the minimum to the maximum extent (on the perpendicular axis) across the dragged element plus every neighbour sharing that line, so it bridges the aligned shapes rather than crossing the whole canvas.
- **Theme-suitable + faint.** The guide colour contrasts with the tab's background (dark slate on light themes, light slate on dark themes, via `deriveTextColorForBg`) and renders as a thin, semi-transparent line, so it reads as helper chrome rather than content. It paints on the same fixed overlay layer as the marquee / draw-to-size previews, converting canvas coords to screen coords via the wrapper rect + zoom.
- Guides are transient: they live only for the duration of the drag and clear on release. Multi-element resize doesn't snap (see above), so it shows no guides.
- **Equal-spacing guides** accompany the distribution snap: the matched gap segments render as **pink, tick-capped lines** (distinct from the faint slate alignment lines) so the equal distances read at a glance. They are reported by `distributionSnap` for the axis it drove (only when edge-alignment didn't already claim it), flow through the same per-drag rAF + value-equality bail-out as the alignment guides (`distGuides` / `sameDistGuides`), respect the same `alignmentGuides` opt-out, and clear on release.
- **Opt-out.** The guides are gated on the `alignmentGuides` user preference (defaults to on; see [spec/20](20-user-preferences.md)), toggled from the Settings dialog's Canvas group. Turning it off suppresses the guide lines only; the snap itself is unchanged. The flag is read through a ref during the drag so flipping it takes effect on the next pointer move.
- **Performance.** Guides are recomputed every pointer move, but the state update is coalesced into a single `requestAnimationFrame` (off the synchronous move/`tick` path) and only lands when the guide set actually changes (`sameGuides` / `sameDistGuides` bail-out), so the dominant no-snap frames cost nothing beyond the move itself.

## Adding elements — tap-to-drop or drag-to-draw

Picking a draw-capable element (shape / text / sticky / image / arrow) from the palette arms **one combined add gesture — there is no setting** (the old `drawToAdd` preference is gone). The palette entry stashes an intent (shape kind, text, sticky, image, or arrow); the next pointer gesture on the canvas resolves it:

- **Tap** (pointer travel under 16 canvas-px in both axes) drops the element centred on the tap point, sized to the element that was selected when you picked the palette entry — so consecutive adds keep a consistent size — else the factory default. Circles + diamonds stay square. That size inheritance is shared with the click-to-drop path via `inheritedSizeFor` (`apps/live/lib/canvas.ts`); the selection is captured at arm-time because arming clears it.
- **Drag** sizes the box (shape / text / sticky / image) to the drag's bounding box with a 16 px floor on each axis. **Both corners snap** to nearby objects: the start corner snaps to neighbour edge / centre lines on pointer-down (a 0×0 point snap via `snapToAlignment`), and the moving corner snaps through `snapResizeBounds` (edges + dimensions) as you drag — so a drawn shape can latch onto a neighbour at both ends rather than landing a pixel off. **Hold Shift** to constrain to 1:1 (perfect square / circle).
- The **arrow** intent treats the drag's start / end as `from` / `to` directly (a line, not a box); a tap drops the default-sized horizontal arrow centred on the click. **Both endpoints snap** to nearby element edge / centre lines (a point snap) as you draw, so the arrow can begin / end on a shape's edge or corner; per-end anchor _pinning_ still happens via the arrow drag-handle flow after creation.
- A top-of-canvas `ModeBanner` reads "Tap to drop or drag to draw …" with a Cancel button (Escape cancels too); the matching palette button renders pressed (brand-tinted) until release; the cursor is a custom inline-SVG crosshair with a small shape / tool glyph in the lower-right.
- Picking a palette entry from laser mode auto-switches to pan so the canvas accepts the gesture (laser swallows pointer-down to paint the trail). Image commits open the image picker after placing, matching the old click-to-drop path.

Icons + tables have no draw-to-size (a glyph / fixed grid isn't a box you size by dragging) — they drop straight at the viewport centre via `addBoxed`, which applies the same `inheritedSizeFor` size inheritance.

## Pencil (freehand)

Always-on palette tool (the pencil is gestural by definition — no tap-to-drop branch): clicking the Pencil button, or pressing **F** (Freehand; P is taken by the Pan tool), enters a one-shot freehand-draw mode for the next canvas drag. Drawing produces a new `FreehandElement` (see [spec/05](05-diagram-structure.md)) rendered as an inline SVG path inside its bounding box.

- A `ModeBanner` reads "Drag to draw" with a Cancel action; Escape cancels too. The pencil button on the palette renders pressed while a draw is queued.
- The canvas cursor swaps to a diagonal-pencil glyph that mirrors the palette icon.
- During the drag the canvas samples pointer positions and renders a live preview polyline. Throttled with `requestAnimationFrame` so high-DPI / 120 Hz pointers don't push thousands of samples per second.
- On release, the raw point sequence is run through Ramer-Douglas-Peucker simplification (tolerance scales with viewport zoom so the visible jitter is what gets smoothed, not absolute canvas pixels), then converted to a smooth Catmull-Rom cubic-bezier `d` attribute on commit. The result reads as a hand-drawn curve, not a jagged polyline.
- **Auto-close on near-start release**: if the release point is within ~16 canvas px of the start, the path closes (last segment back to the first point) AND the commit sets `closed: true` so the SVG renderer adds `Z` + a fill. This is the "sketch a custom shape" path. Releasing anywhere else commits an open stroke (no fill).
- A stray click (zero drag distance) does NOT commit an element. The pencil is gestural, not a click-to-drop tool.
- Stroke colour follows the tab's theme (`elementStroke`) so a freehand sketch reads as part of the diagram, not as an annotation layer. Closed paths fill with the theme's `elementFill`. Both colours are overridable per element via the Colours accordion, same as any other boxed element.
- The element is a regular boxed element after commit: drag to move, resize handles, lock / group / format-paint / themes / comments all apply. Points are stored normalised within the bounding box so resize scales the path proportionally.
- Telemetry: `track('Element', 'Added', 'Freehand')` on commit (closed vs open is not split out for now; spec/22's closed vocabulary is by kind only).

### Shape recognition (opt-in)

A sparkle / magic-wand icon button (with a `Tooltip` describing the on / off state) sits in the pencil `ModeBanner` (to the left of Cancel) and toggles **shape recognition**. When on, the commit handler runs the simplified polyline through `recogniseShape` (`packages/diagram/src/recognise-shape.ts`) and, if the score clears the confidence threshold, mints a real shape primitive instead of a `FreehandElement`. The toggle is persisted as a user preference (`recogniseShapes` in spec/20) so flipping it sticks across pencil sessions and across devices for signed-in users; it is deliberately NOT surfaced in the Settings dialog (a per-tool toggle belongs where the tool is, not in global settings).

- Detected kinds: **rectangle / square** (axis-aligned 4-corner outline) → `ShapeElement` with kind `square`; **circle / oval** (closed curve hugging the inscribed ellipse) → `ShapeElement` with kind `circle`; **diamond** (4 corners at bbox edge midpoints) → `ShapeElement` with kind `diamond`; **line** (straight open polyline) → `ArrowElement` with `arrowEnds: 'none'`.
- Heuristics, not template matching: each scorer measures the mean perpendicular distance from every sample to the idealised shape's edges (or to the inscribed-ellipse boundary), so the detector is rotation- and scale-tolerant without per-shape templates.
- Confidence is in [0, 1]; the editor's 0.40 threshold leans hard toward "convert it". Turning the mode on is an explicit opt-in, so the user has already stated they want strokes classified; false positives are one Cmd-Z away and the toggle is one click off, while false negatives (a wobbly square that stayed a sketch when the user wanted a rectangle) are the more frustrating outcome. Previous values: 0.72 (too strict), 0.55 (still too strict per user feedback).
- Telemetry: a recognised commit emits `Element/Added/<Square|Circle|Diamond|Arrow>` (the dashboard reads as if the user had clicked the palette button); the unrecognised fallback emits `Element/Added/Freehand` as before. No new types in spec/22's closed vocabulary.

## Out of scope (next iterations)

Items still genuinely out of scope today (most of the original list has shipped — see the Editor section above):

- **Mid-edge resize handles** — only corner handles drive resize.
- **Rotation** — elements always render axis-aligned.
- **Clipboard copy / paste** — `Duplicate` (in-place clone) is available, but cut/copy/paste against the OS clipboard isn't wired up.
