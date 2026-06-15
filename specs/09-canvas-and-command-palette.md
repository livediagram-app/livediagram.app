# Canvas and command palette

The live app's canvas is where users actually build diagrams. A floating **command palette** sits on top of the canvas with controls for adding elements.

## Command palette

A small floating panel **initially placed in the top-right corner of the canvas**. The panel has a **`PALETTE` header label** in block caps above the buttons, and below it a row of icon buttons — one per primitive that can be added to the canvas.

### Canvas tools

The first row of the palette holds the canvas-tool toggles:

- **Select** (default on desktop) — drag-on-empty draws a marquee for multi-select. Listed first in the palette.
- **Hand** (the pan tool; default on mobile / touch viewports) — drag-on-empty scrolls the canvas. Middle-click also pans from any tool.
- **Laser**: presenter mode. Pointer-move emits a glowing trail in the local participant's colour that fades over ~1 s. On a mouse, click-drag pans the canvas (same as the Hand tool) so the presenter can reposition without switching tools, and the trail keeps capturing during the pan so peers see a sweeping laser. On a touch device the same drag DRAWS the laser instead of panning: touch has no hover, so a finger drag is the only way to point at things and pan-on-drag would pin the laser dot in canvas-coords (the canvas slides under the finger). Touch users pan via the Hand tool, two-finger trackpad, or zoom controls. Other participants see the trail in real time in the sender's colour via the `laser` `RoomOp` (see [spec/11](11-api.md)). Cursor indicators broadcast as `null` while laser is active so peers see only the laser dot, not a stacked cursor + dot.
- **Eraser** (shortcut `E`): deletion mode. A primary-button **press deletes whatever element is under the pointer**, and **holding and dragging deletes everything the drag passes over** — one press-drag is one undo. Hit-testing rides the DOM (`document.elementsFromPoint` + each wrapper's `data-element-id`), so it erases any element kind (shapes, arrows, text, images). Deleting a shape also drops arrows pinned to it, matching the normal delete. **Locked elements** (and everything on a **locked tab**) are protected and skipped (see Locking below). The whole gesture collapses to one undo via a checkpoint at press + un-checkpointed ticks per removal (the same pattern as a drag-move). The canvas shows a custom eraser cursor while the tool is active; holding **Space** still pans. The eraser only mutates for editors — view-role visitors don't get it. Implemented as the `useCanvasEraser` hook, invoked from the Canvas capture-phase pointerdown so it wins over an element's own select/drag.

To the right of Laser sits the **Zen mode** button (a fullscreen / expand icon, shortcut `Z`) — not a canvas tool but an orthogonal focus toggle that hides all chrome. See [spec/26](26-zen-mode.md).

### Movable

- The header row is a **drag handle** — press it and drag to move the palette anywhere on the canvas. Clicking a button does not start a drag.
- Position survives until the page reloads.

### Collapse to banner

The header has a **collapse button** to the right of the `PALETTE` label. Clicking it hides the body (canvas-tool toggle, shape row, accordions) and leaves the title row visible as a banner in place, so the user always sees the affordance and gets canvas real-estate back. The button's icon flips from a dash (collapse) to a plus (expand) so the same slot is the entry point in both directions.

- **Mobile** (touch viewports below the `sm:` breakpoint, 640 px): the palette does not render at its corner. It opens instead from the **mobile dock** (a top-right button row, see spec/07 "Mobile chrome") as a popover anchored to the Palette button; tapping the button again, or adding a shape / tool, closes the popover. The banner-collapse described here is the desktop mechanism.
- **Desktop** (`sm:` and up): the palette starts expanded. The collapse button toggles to banner mode. There is no outside-tap auto-close on desktop, the user is in control of when to re-open.

On desktop the Palette collapses to a banner in place via the `MovablePanel` `collapsible` prop. On mobile it (and the Explorer) is reached from the top-right mobile dock instead (spec/07 "Mobile chrome"); the old bottom-of-canvas dock button next to the zoom controls is retired. Activity still docks via its own minimise path, see that section.

### Minimal panel layout (desktop opt-in)

Desktop users can opt into the mobile-style dock via the **"Minimal panel layout"** preference (`minimalPanels`, spec/20, Settings → Interface). When on, the floating Explorer / Palette / AI panels are replaced on desktop by the same top-right button dock and popover behaviour mobile already uses: each button opens its panel as a popover with an arrow pointing at the button, click-outside or a second click closes it, and adding a shape / tool auto-closes the Palette popover. Implemented by the `MovablePanel` `forceDockMode` prop, which extends the existing mobile dock code path to desktop (the dock is `sm:hidden` by default but shown at all widths when `minimalPanels` is set). Defaults off; mobile is always docked regardless of the flag.

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

On desktop, collapsing the Explorer banner-collapses it in place via the shared `MovablePanel` `collapsible` prop (same as the Palette). On mobile the Explorer is instead opened from the top-right mobile dock (spec/07 "Mobile chrome"), so it is no longer hidden on phones; the old bottom-of-canvas dock button is retired. Activity still docks via its own minimise path, see that section.

## Text alignment

Each boxed element carries an optional pair of fields controlling where its label sits inside the box:

- `textAlignX: 'left' | 'center' | 'right'` — horizontal alignment.
- `textAlignY: 'top' | 'middle' | 'bottom'` — vertical alignment.

Defaults:

- **Shape, Text:** `center` / `middle`.
- **Sticky note:** `left` / `top` (natural for multi-line notes).

Selectable from the element's edit-text toolbar (and the right-click context menu) as a **3 × 3 grid** of small icon buttons — each cell represents one combination of horizontal and vertical alignment. The currently active cell is visibly highlighted.

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

The **Text colour** picker lives in the element's right-click context menu under **Colours**, alongside **Background** and **Border** (shown only for elements that support them).

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

> **Status (superseded):** the floating editor side panel (this Current Tab section + the Selected Element section below) has been **removed**. Every control it hosted now lives in **right-click context menus** — the element/multi-selection menu and the **tab menu** (the ellipsis / tab right-click menu, also opened by right-clicking the empty canvas). The tab menu is now a **single unified menu** at every entry point: the **Canvas** section (Theme / Canvas background / Auto-align) and the **Font** section (the tab's default font + default new-element size, moved out of the Tab Appearance modal, see [spec/28](28-fonts.md)) are folded into the active tab's ellipsis menu too, so the tab and canvas menus are identical rather than separate. (Adding elements is done from the palette + quick-connect, so the menu has no Add section.) (The former desktop footer canvas-menu button has been removed; right-click is the desktop entry point, and a **press-and-hold (long-press) on the empty canvas** opens the same menu on touch devices.) Every context menu shares one width (`w-56`). Plus the **Tab Appearance** modal (Canvas / Theme tabs, see [spec/42](42-canvas-and-theme-dialog.md)). The descriptions below document the controls themselves (still accurate) but no longer their panel home; this section is pending a fuller rewrite.

Tab-level appearance + tools (no longer a panel section): **Theme**, **Canvas** (background) and **Font** live in the **Tab Appearance** modal ([spec/42](42-canvas-and-theme-dialog.md)); **Auto-align** and the **Session** tools live in the canvas / tab context menu; **Remove all content** lives in the tab's context menu. What each does:

- **Theme** — a 3-column grid of preset themes. Picking a theme writes `theme: ThemeId` onto the tab AND updates the tab's `backgroundColor`, `backgroundPattern`, and `patternColor`. The backdrop follows the **same preserve-customs rule as element colours** (`switchThemeBackdrop` in `apps/live/lib/themes.ts`): each field adopts the new theme's value only when it's unset or still matches the _previous_ theme's value, so a deliberately-chosen pattern (e.g. a hand-picked Graph or Isometric) survives a theme switch instead of being reset to the theme's default grid. From that point on, newly added boxed elements inherit the theme's `elementFill / elementStroke / elementText` colours (sticky notes keep their amber identity regardless). Existing elements are **not** retroactively recoloured — the user can re-apply colours per-element via the element's context-menu Colours category. The theme catalogue (`apps/live/lib/themes.ts`) ships **12 default themes** (Basic, Pink, Forest, Sunset, Lavender, Mono, Ocean, Sky, Midnight, Cream, Rose, Sand) plus **14 extras behind a "Show more themes" toggle** (Olive, Indigo, Steel, Mocha, the dark themes Pine, Charcoal, Plum, Abyss, Espresso, and the five multi-colour themes Rainbow, Pastel, Tropical, Autumn, Jewel — see [spec/29](29-multicolour-themes.md)). The opt-in is descriptor-driven (`extra?: boolean` on each entry), so adding more is one line in the catalogue with no UI plumbing; the Tab Appearance modal's Theme tab auto-expands the extras when the active themeId is an extra so the user always sees the active swatch. The **welcome / template picker** instead browses themes the same two-level way it browses templates: an overview of a **Basic** quick-pick card (the un-themed default, pulled out of the grouping, the way Blank is for templates, and selected by default) plus a card per colour-temperament category (Cool / Warm / Dark / Multi-colour — `THEME_CATEGORIES` + `themeCategory` in `apps/live/lib/themes.ts`, each illustrated with a sampler of its swatches + a description), and clicking a category drills into its themes with a `← All themes` back affordance. If the picker opens with a non-Basic theme already selected (e.g. a new tab copying an existing tab's theme), that theme's category is opened on mount so the current selection is visible rather than buried behind a category card. Both the template and theme browsers share `AnimatedHeightBox`, which eases the body height between views (capped, then scrolls) and soft-fades the swapped block. The `extra` flag is retained as catalogue metadata, not used for gating. Most themes paint every element one colour; the **multi-colour** themes carry a palette and tint each branch of the diagram's hierarchy a different hue ([spec/29](29-multicolour-themes.md)). A theme card previews its colour(s) via a shared `ThemeSwatch` — one dot for single-colour themes, a row of stripes for multi-colour ones.
- **Canvas** — per-tab background controls. Fourteen pattern choices total, laid out in a 4-column grid of equal-width buttons: eight defaults (Grid, Blank, Lines, Graph, Crosshatch, Confetti, Stripes, Diagonal — two full rows) plus six behind a "Show more patterns" toggle (Waves, Bricks, Isometric, Hexagonal, Engineering, Checkerboard). Patterns store as `backgroundPattern?: BackgroundPattern`. When the user pans, the pattern phase tracks the pan offset so the pattern tiles indefinitely. Axis-aligned line grids (Lines, Stripes, Graph, Engineering) are built from tiled `linear-gradient`s with an explicit `background-size` so lines stay crisp and never double; the diagonal grids (Crosshatch, Diagonal, Isometric) and Hexagonal render via inline `data:image/svg+xml` tiles that rasterize once and repeat seamlessly; Checkerboard is a tiled `conic-gradient`. Confetti renders a fixed multi-colour scatter and ignores the pattern colour; the SVG and Waves patterns pick up the active pattern colour. Plus Canvas + Pattern colour pickers and an Opacity slider.
- **Content** — destructive operations on the tab's contents (today: a single "Remove all content" button, disabled when there's nothing to clear).
- **Cleanup** — tidiness operations on the tab's existing content. Today: a single "Auto align" button that snaps every boxed element's position (x / y) and dimensions (width / height) to the nearest 10 px (the canvas's grid unit), so almost-aligned shapes become exactly aligned and minor dimension drift collapses. Aspect-locked shapes (circle, diamond, actor) stay square / proportional by snapping the larger axis and matching the other to it. Free-endpoint arrows snap their endpoints to the same grid; pinned arrow endpoints stay attached to their anchored elements (which themselves get snapped). Width / height never go below `MIN_SIZE`. The operation is one undoable commit and emits an Activity-log entry so the user can revert it like any other edit. Disabled when the tab has no boxed elements.

### Selected Element section

> **Status (superseded):** removed along with the editor side panel — these per-element controls now live in the **right-click element context menu** (Layer / Colours / Border / Text / Icon / Image / Link / Table / arrow Line + Pointer / Collaborate categories) and the floating selection toolbar. The control descriptions stay accurate; their panel home does not.

When an element is selected, these per-element controls are available from its **right-click context menu** (and the floating selection toolbar), grouped into **collapsible categories**. Each category is **closed by default**; clicking its header toggles it open.

Control groups (rendered as context-menu categories, hidden when their gate doesn't apply):

- **Shape** _(shape elements only)_
  - Shape grid (Square, Circle, Diamond, Cylinder, Parallelogram, Hexagon, Document, Stadium, User, Cloud, Triangle, Trapezoid, Star, Speech bubble, plus the device frames Web browser, Computer monitor, Laptop, Phone, Tablet, Smartwatch) — clicking morphs the selected element into that kind in place, preserving size + colour overrides. (The Frame container is not a morph target.) Circle and diamond force the bounding box square; the rest preserve free aspect.
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

Double-clicking the body of a selected arrow opens an inline `<foreignObject>` editor for the arrow's `label?: string`. Enter / blur commits, Escape cancels. The label renders as an SVG `<text>` anchored at the path's midpoint (chord midpoint for straight, t=0.5 of the quadratic bezier for curved, the elbow vertex for angled). By default placement chooses one of four cardinal slots around the midpoint (right → below → left → above) and picks the first whose AABB doesn't collide with a neighbouring boxed element; falls back to "right" if every slot collides. The user can **override placement by dragging the label**: when the arrow is selected a dashed box + move-cursor appear on the label, and dragging it slides the label **along the line** and to **either side** of it, staying connected (stored as `labelOffset: { t, offset }`). Empty label string strips the field on commit so persisted JSON stays clean. **Label formatting:** an arrow carries the same label-text fields as boxed elements (`textSize`, `textBold`, `textItalic`, `textUnderline`, `textStrikethrough`, `textColor`, `font`), so once it has a label the arrow's right-click context menu surfaces a **Text** category (size + bold/italic/underline/strikethrough + font) and the **text** colour swatch — alignment + padding are omitted since the label sits at the midpoint. `textColor` falls back to the arrow's stroke colour when unset, so the label matches the line by default; `textSize` defaults to small (12px) to match arrows authored before the fields existed. The fields ride the same `useElementStyle` setters as boxed labels (extended to accept `el.type === 'arrow'`).

Each context-menu category header shows a chevron that rotates 180° when open; the body slides open/closed via a `grid-template-rows` 0fr↔1fr transition (~200 ms) so motion is smooth and free of layout jumps.

### Undo / Redo

A separate row at the bottom of the palette (separated from the add-buttons by a thin divider) holds two history controls:

- **Undo** (left-curve arrow) — reverts the last change.
- **Redo** (right-curve arrow) — reapplies an undone change.

History is kept to a maximum of **3 steps** in each direction. Older states are dropped.

Undo-able actions: adding/deleting any element, label commits, lock toggle, layer order (bring/send), format-paint apply, duplicate-and-connect, drag-end (move or resize, including arrow-endpoint drags). A drag's snapshot is **armed** at the start but only **taken on the first actual movement** (the first `tick` past the engage threshold), so undo returns to the pre-drag state without intermediate frames — and a plain click that merely selects an element, or a press on a locked element / tab that never mutates, leaves the history untouched (it used to push a no-op snapshot and clear the redo stack on every click).

Not in history: selection, edit mode entry, palette position/minimize state, format-painter mode.

**Collaboration + history.** A remote peer's `tab` / `diagram-meta` op merges into the present via `applyRemote`, which keeps the local undo/redo stacks intact (peers autosave ~every 600ms, so the old history-clearing `reset` wiped undo continuously during a shared session). The retained past states predate the peer's change, so undoing far enough can locally drop a collaborator's edit — an accepted limitation of last-write-wins collab without OT/CRDT. Genuine context switches (mount hydration, opening another diagram, loading a tab) still use `reset`, which clears history.

The palette is laid out top-to-bottom as: canvas-tool toggle (Select / Hand / Laser / Eraser, a joined segmented control) → a **category tab bar**. The tabs render as a **joined segmented control** (one bordered group, dividers between, the active tab filled edge-to-edge) so it reads as "pick one"; each tab is an icon above a short text label (a triangle+circle+square cluster for Shapes, a wrench for Tools, a monitor for Devices, a smiley glyph for Icons). The tabs are **Shapes**, **Tools**, **Devices**, **Icons**, with more categories to come. **Changing category is click-only**: clicking a tab expands its panel below, clicking the active tab again collapses it, clicking another switches. One tab is open at a time (mutually exclusive by construction), so the palette stays compact however many categories we add. There is **no hover preview** — hovering a tab never changes the open category (only a deliberate click does), so the panel never shifts underneath the pointer as it crosses the tab row. **Shapes is open by default** — it's the most common entry point on every fresh canvas. This replaced the earlier always-visible shape row plus a stack of one-per-category accordions (Tools / Devices / Icons), which didn't scale as categories grew. Switching categories is **softened**: the panel height eases off the measured content height (so a short category like Tools glides into a tall one like Icons instead of snapping) and the new content fades in. The height transition is gated on only after the first measured frame so the open-by-default panel doesn't animate itself open on load. The tab bar is a reusable, config-driven component (`apps/live/components/PaletteTabBar.tsx`): it owns the active-tab state (and a `defaultOpenId` for the open-by-default tab) and takes a `tabs` array of `{ id, label, description, icon, content }`, so a new category is one more array entry in `CommandPalette.tsx` with no UI plumbing.

**Palette tiles preview the active tab theme.** Picking a theme tints the palette so the tiles look like what they'll drop. The **boxed-shape tiles** — every Shapes tile, every Devices tile, and the Annotation tool — render as **filled mini-previews** in the theme's `elementFill` + `elementStroke`, mirroring how a new boxed element is coloured (`deriveNewBoxedColours`). The **line-art tools** (Text, Pencil, Arrow, Table, User, Frame) and the **Icons** grid **tint** their stroke to the theme's `elementStroke` (matching the on-canvas behaviour where an icon is tinted by the element's stroke colour). Tiles whose colours are fixed regardless of theme stay untinted: the **sticky note** (always amber), the **image** placeholder and **link card** (neutral chrome), and the full-colour **Technology** brand icons. Under the **Basic** theme (`elementStroke` / `elementFill` are `null`) nothing is tinted and the palette keeps its default slate look. The pressed (queued draw-to-size) tile keeps its brand highlight so it still reads as selected. Mechanically: `CanvasChrome` derives a `themeTint` (`{ stroke, fill }`, undefined for Basic) from `getTheme(tabThemeId)` and passes it to `CommandPalette`, which exposes it via `PaletteTintProvider`; `IconButton` consumes the context and applies the stroke as the glyph's `color` (so every `stroke="currentColor"` SVG follows) plus, on `filled` tiles, a `--tile-fill` CSS variable that the `.palette-tile-filled` rule in `globals.css` paints into the otherwise-hollow `fill="none"` paths. Caption text stays on the neutral slate tone so labels keep their contrast on the app's light/dark panel surface (the palette panel does **not** adopt the canvas backdrop). Tiles opt out with `noTint` and into the filled preview with `filled`.

**Shapes tab** (general shapes, open by default):

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
- **Triangle** — adds a 130×120 upward triangle (SVG polygon).
- **Trapezoid** — adds a 160×110 trapezoid (wider at the base; flowchart manual operation).
- **Star** — adds a 130×130 five-pointed star.
- **Speech bubble** — adds a 180×130 callout: a rounded body with a tail dropping from the bottom-left.

The **Tools tab** also carries a **Frame** (`frame`): a 360×260 transparent outlined container with its label in the top-left, drawn around a cluster of elements (a FigJam-style section). Its body is rendered fill-less so the elements inside show through.

**Frames behave as sections**, not decorations:

- **Always renders behind its contents** via the shared `framesFirst` helper (`apps/live/lib/canvas.ts`), which both the canvas render layer and the PNG / SVG exporters route element lists through — so a frame is a backdrop regardless of its array position, with no special-casing at create time. Its contents therefore paint on top and stay individually selectable / draggable; clicking an _element_ inside hits that element (it's above the frame), while clicking _empty space_ inside the frame — or its border / title — grabs the frame itself.
- **Dragging the frame moves everything inside it.** The move set is expanded with every boxed element whose centre lies within the frame at grab time (`withFrameContents` in `apps/live/lib/canvas.ts`); pinned arrows between members follow via the normal post-move anchor rebind. Membership is recomputed on each grab, so an element is "in" the section simply by sitting inside it — there's no explicit parenting to manage.
- **Resizing the frame leaves its contents in place** — only the outline grows / shrinks, so you size the section around the elements rather than scaling them.
- The frame does **not** show the quick-connect **+** buttons (it's a backdrop, not a node to chain from), and it isn't a morph target.

**Devices tab** (UI-device frames for wireframing). Each renders as the device's silhouette so users can drop them on the canvas as containers and arrange interface elements inside:

- **Web browser** — adds a 240×160 browser window (tab strip + URL bar + viewport).
- **Computer monitor** — adds a 220×170 desktop monitor with stand.
- **Laptop** — adds a 240×150 laptop (screen + keyboard base).
- **Phone** — adds a 90×170 phone (tall portrait with rounded corners).
- **Tablet** — adds a 140×180 tablet (medium portrait with rounded corners).
- **Smartwatch** — adds a 110×150 smartwatch (rounded face with straps above + below and a crown button).

**Icons tab** (curated single-colour glyphs). A search box filters a scrollable grid of line icons (tech / cloud / UI / people: server, database, cloud, user, lock, globe, ...). Clicking one drops an `icon` shape (88×88, aspect-locked) at the viewport centre carrying the chosen `iconId`. Icons are line art tinted by the element's **stroke colour** (Colours category in the context menu), with a constant on-screen line weight (non-scaling stroke) so they stay crisp at any size; the label sits in a band beneath the glyph. The glyph catalogue (id + label + keywords + SVG primitives) lives in `apps/live/lib/icons.ts`; `iconId` is a plain string in the model (not a closed enum), so adding an icon is a one-file change and an unknown id renders a placeholder glyph. The **Shape** controls (morph grid / aspect / padding) and the **Border** category (strength / pattern / radius) are both hidden for a selected icon: an icon is a glyph you pick from the Icons picker, not a box you morph or border. Icons keep the Text + Colours categories, but the latter shows only the **stroke** (glyph tint) and **text** (label) swatches — the **fill / background** swatch is hidden because an icon is `fill="none"` line art with no fill to colour. Icons drop at the centre rather than via draw-to-size (a glyph is a fixed-aspect mark, not a box you size by dragging). Above the grid sit **theme chips** (All, Tech, People, Security, Files, Charts, Arrows, Furniture, UI — `ICON_CATEGORIES` in `lib/icons.ts`) that narrow the catalogue (~125 glyphs) to a related set; the search box filters within the selected chip. The **Furniture** category carries top-down floor-plan symbols (bed, sofa, armchair, chair, dining + coffee tables, TV, desk, wardrobe, bathtub, toilet, sink, stove, fridge, plant, door, stairs) for sketching room layouts — same single-weight outline style, drawn as if looking straight down on each piece. The catalogue grows by appending to `ICON_CATALOG` (and the relevant category's id-list) — single-stroke, 0–24 viewBox, Feather / Lucide-flavoured so additions stay visually consistent.

**Technology tab** (full-colour brand icons, [spec/41](41-technology-icons.md)). A separate category from Icons for the AWS / Azure / generic-infrastructure marks used on system-architecture diagrams (S3, Lambda, EC2, Azure Functions, Kubernetes, Postgres, ...). Kept apart from the Icons tab because these are fixed multi-colour brand marks (a brand-coloured tile + white glyph) rather than the stroke-tinted line art — mixing them would break the line-art look. A search box plus a **provider** filter (All / AWS / Azure / Generic) narrow a grid of coloured thumbnails; clicking one drops a **standalone** `icon` shape carrying the chosen id, and dragging one drops it at the pointer (its own `TECH_ICON_DND_MIME`, so it never folds into a shape as an inline icon). The mark reuses the `icon` shape kind — same aspect-lock + label-beneath-glyph layout — but the id resolves in `apps/live/lib/tech-icons.ts` (`isTechIconId`) so it renders coloured rather than tinted, and the Colours category's stroke/fill swatches don't recolour it. The catalogue grows by appending `TechIconDef` entries; an unknown id still falls back to the line-art placeholder.

**Icons inside shapes.** An `iconId` is also meaningful on a NON-`icon` shape (rectangle, circle, …): it renders an inline icon beside that shape's text label, tinted by the shape's stroke colour. Ways to attach one: (1) **drag** an icon tile from the Icons tab onto a shape — the icon tiles are HTML5 drag sources (`ICON_DND_MIME` carries the id), and the drop lands the icon on the side of the text nearest where you released (left / right / above / below), stored as `iconPosition`; (2) **add while a shape is selected** — clicking an icon in the palette while a regular shape is selected sets the icon on that shape (default `iconPosition: 'left'`) instead of creating a standalone icon element; (3) **drag a standalone icon element** already on the canvas onto a shape — on release it folds into the shape (same side-from-drop logic) and the standalone element is removed, in one undo. The icon + label are laid out as a centred flex group whose direction / order follow `iconPosition`; the label keeps its own alignment within its sub-region, and the editor still opens on double-click. Both paths are history-aware (undoable) and blocked for read-only / locked tabs. The dedicated `icon` shape is excluded from this (it already IS a glyph) and keeps its glyph-above-caption layout. **Frames are also excluded** — a frame is a section container, so an icon dropped on a frame (or added while a frame is selected) becomes a **standalone `icon` element** placed inside it, not an inline decoration on the frame. All three fold paths share the `acceptsInlineIcon` predicate (`packages/diagram/src/colors.ts`). While dragging an icon over a shape, a brand ring + a translucent band on the target side preview where it'll land. To **move** an icon: with the shape selected, grab the glyph itself and drag it to another side (a pointer-drag; the live band previews where it'll land), or drag a fresh palette icon onto a different side — both overwrite `iconPosition`. To **remove** it, right-click the shape → "Remove icon".

**Table** (Tools tab). Drops a 3×3 `table` element at the viewport centre. The grid divides the element box evenly; double-click a cell to edit its text (Enter / blur commits, Escape cancels, Tab / Shift+Tab walk cells). `cells` is the row-major source of truth (`cells[r][c]`), kept rectangular by the helpers in `packages/diagram/src/table.ts` (addTableRow / removeTableRow / addTableColumn / removeTableColumn / setTableCell). **Row / column edits** happen in-component: when the table is selected, a `⋯` trigger sits inside the top of each column / the left of each row; tapping it (click, not hover) opens a large-button menu — Insert-before / Insert-after / Delete (delete disabled at the last row / column) — that drops INTO the grid, away from the canvas's own resize handles (arrow-anchor dots are suppressed for tables). The **Table** category in the context menu toggles `headerRow`, `headerColumn` and `zebra` (header row/column combinable; the corner cell is then both — a tinted band + bold text). The `headerFill` / `headerTextColor` fields exist on the model (the header band can be coloured independently of the body cells) but are **not currently surfaced** in the menu — their setters survive in `useElementStyle` pending re-wiring after the editor-panel removal. Reset-to-theme clears the cell fill + header overrides and reapplies the theme grid / text colours. Cell + structural changes commit through `onCommitCells`. **Editing**: a cell edits via a contentEditable flex child that respects the table's horizontal + vertical alignment and inherits the cell font; Enter commits and moves down, Tab / arrow keys navigate cells, and pasting TSV / spreadsheet data fills + grows the grid (`pasteIntoTable`). **Sizing**: drag a column's right / a row's bottom divider to pin its width / height (`colWidths` / `rowHeights`; un-pinned tracks share the rest as `1fr`), double-click a divider to auto-fit. **Styling**: a `zebra` toggle tints alternate rows; single-clicking a cell opens an in-cell toolbar to set that cell's background / text colour / bold (`cellStyles`, a per-cell override grid aligned with `cells`). The `scale` text size tracks the row height. The Colours category tints grid lines (stroke), cell background (fill) and text; new tables derive their text colour from the canvas background so they stay readable on dark backdrops. The whole table resizes via the normal element handles; individual **columns** can be pinned to an explicit width by dragging the divider on their right edge (`colWidths`), with un-pinned columns sharing the remaining space as `1fr` tracks. Cell padding follows the element's padding preset (the Text category). Per-row pixel sizing is a follow-up.

**Tools tab** (other element kinds):

- **Text** — adds a free-floating text element (see [Text element](#text-element)).
- **Arrow** ("Add arrow") — drops / draws a plain straight connector, OR, with a shape selected, arms click-to-connect (see [Adding an arrow](#adding-an-arrow)).
- **Sticky note** — adds a sticky-note element (see [Sticky note element](#sticky-note-element)).
- **Annotation** — drops a note marker (a fixed-size themed circle + note glyph) at the viewport centre: hover to read its note above everything, click to edit it. See [spec/38](38-annotations.md).
- **Link card** — drops a rectangular bookmark; double-click to set its URL (the normal link picker), and the worker unfurls a preview (favicon / title / site / image). See [spec/40](40-link-cards.md).

### Placement on add

The **Icon**, **Table**, and **Annotation** buttons place the new element at the **centre of the visible canvas viewport** (accounting for pan), auto-selected. The draw-capable buttons (shape / text / sticky / image / arrow) instead arm the combined tap-or-drag gesture — see [Adding elements](#adding-elements--tap-to-drop-or-drag-to-draw) — where a tap drops it at the tap point and a drag sizes it.

If a boxed element is currently selected, the new element **inherits its width and height** so the user can chain together similarly-sized nodes quickly. Circles and diamonds are an exception — they're inherently 1:1, so they snap back to a square using the larger inherited dimension to avoid being squashed. **Annotations** are a stronger exception: they're a fixed marker size and never inherit the selection's dimensions (spec/38). This rule lives in `inheritedSizeFor` (`apps/live/lib/canvas.ts`) and applies to both the centre-drop and the tap-to-drop paths (the combined gesture captures the selection at arm-time, since arming clears it).

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

There are three ways to create an arrow:

1. **Drag from an anchor dot on a selected element** (the direct, contextual way):
   - When a boxed element is selected (and not locked, not editing, not in a special mode), small **anchor dots** appear on each of its **four edge midpoints** (N, E, S, W). They are filled brand-coloured circles, distinct from the corner resize handles.
   - **Press-and-drag** a dot to start creating an arrow: the `from` endpoint is immediately pinned to that anchor, and the `to` endpoint follows the cursor. An arrow drawn this way inherits the source shape's stroke colour (so it matches the theme, not black).
   - Release on **another element's anchor** (within snap distance, ~24 px) → that endpoint becomes pinned. Release on **empty canvas** → that endpoint stays free.
   - Releasing without any drag movement creates a tiny "stub" arrow at that anchor.
2. **The palette "Add arrow" button** with nothing selected: drops / draws (draw-to-size) a plain connector with free endpoints — drag the endpoints onto shapes afterwards to pin them.
3. **Click-to-connect**: with a shape **selected**, pick the palette **Add arrow** tool (or press `A`) to arm a connect gesture — a hint banner appears — then **click another shape** and a pinned connector is drawn between the two, anchored on the facing sides (`bestAnchorTowards`) and inheriting the source's stroke. Clicking empty canvas (or the banner) cancels.

Snapping during the drag continues to consider all eight anchors of every shape on the canvas — corners and midpoints — so an arrow drag from a midpoint can still snap to and pin at a corner.

### Manipulating arrows

- **Click an arrow** to select it. Selection treatment: thicker brand-tinted stroke, and visible endpoint handles (small circles at each end).
- **Drag an endpoint handle** to move that endpoint. While dragging:
  - If the cursor is within **~24 px** of any shape's anchor, the endpoint **snaps** to that anchor (becomes pinned). The anchor pin wins over the snaps below.
  - Otherwise the endpoint stays free, with two layers of snapping to make straight / aligned arrows easy (same machinery the move/draw flows use, gated by the same "alignment guides" preference):
    - **45° angle lock** — within ~5° of a 45° increment from the _other_ endpoint, the line locks to that angle (horizontal / vertical / diagonal).
    - **Alignment guides** — when not angle-locked, the free endpoint nudges to line up with nearby boxed elements' edges / centres (via `snapToAlignment`) **and** with the arrow's other endpoint (so a near-straight arrow latches truly horizontal / vertical), drawing the same faint guide lines a boxed-element move shows. The same applies while drawing a new arrow (the draw is just an endpoint drag). Guides clear on release.
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

A locked arrow's endpoint handles are not draggable. Same semantics as a locked shape — it can't be moved or deleted (including via another element's [cascade](#cascading-delete)); unlock it first.

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

Twenty-one shape kinds (plus `icon`), all rendered as absolutely positioned elements on the canvas. The table below covers the seven general-purpose primitives the spec originally shipped with; the rest — general shapes (`stadium`, `actor`, `cloud`, `triangle`, `trapezoid`, `star`, `speech-bubble`), the `frame` container, and six UI device frames (`browser`, `monitor`, `laptop`, `phone`, `tablet`, `smartwatch`) — landed alongside / after the wireframe templates and are documented in the [Devices tab](#main-palette-sections) above. The canonical list lives in `packages/diagram/src/index.ts` `ShapeKind`; the test in `apps/live/lib/templates.test.ts` pins shape coverage indirectly via the template catalogue.

| Kind            | Rendering                                                                                                                        | Aspect lock |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `square`        | Rectangle with slight rounded corners (CSS border + background on the wrapper).                                                  | Free        |
| `circle`        | Square frame with `border-radius: 50%`.                                                                                          | Forced 1:1  |
| `diamond`       | Wrapper carries no visible style; inner `<svg viewBox="0 0 100 100" preserveAspectRatio="none">` draws a four-point polygon.     | Forced 1:1  |
| `cylinder`      | SVG overlay drawing a rectangle body with a curved bottom (`A 50,12` arc) and a top ellipse (`rx=50 ry=12`). Database / storage. | Free        |
| `parallelogram` | SVG overlay drawing `polygon points="20,0 100,0 80,100 0,100"`. Input / output in flowcharts.                                    | Free        |
| `hexagon`       | SVG overlay drawing `polygon points="25,0 75,0 100,50 75,100 25,100 0,50"` (flat-top). Preparation / labelled milestone.         | Free        |
| `document`      | SVG overlay drawing a rectangle with a wavy bottom edge (two cubic curves). Output document in flowcharts.                       | Free        |

Styling: a `brand-500` outline over a faint `brand-50` fill, with a subtle drop shadow. Same colours for every kind — only the geometry differs. Fill / stroke colours can be overridden per element via the element's right-click context menu (Colours category).

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

Below the welcome section, the template cards are a **two-level browse** inside a single **height-capped scroll area** (`max-h-[19rem]`), so the full catalogue stays one tidy bounded block instead of stretching the modal as it grows. The **overview** is a 3-column responsive grid (2-col on narrow viewports) of a **Blank** quick-pick card (start from scratch) followed by one **category card** per category (Diagrams / Planning / Strategy / Design / Technical — `TEMPLATE_CATEGORIES` + `templateCategory` in `apps/live/lib/templates.ts`, rendered in that order, empties skipped). Categories group by intent: **Diagrams** = general structure/relationship diagrams (flowchart, org chart, mind map, Venn, fishbone, pyramid); **Planning** = agile boards, schedules + prioritisation (kanban, Gantt, timeline, retrospective, prioritization matrix); **Strategy** = business/product frameworks (SWOT, flywheel, user journey, comparison table); **Design** = wireframes, slides + visual mock-ups; **Technical** = architecture/ER/sequence. Each category card illustrates itself with a 2×2 collage of its templates' previews, a count, and a one-line description (`TEMPLATE_CATEGORIES[].description`). Clicking a category **drills into** it: the grid swaps to that category's template cards with a `← All templates` back affordance at the top. Swapping between the overview, a category, and search is keyed so the block remounts and **soft-fades** (`animate-fade-in`) rather than snapping. The **search box** on the "Pick a template" line overrides both views — a non-empty query shows **flat results** across the whole catalogue (matching title / description / kind / category label), with a "No templates match …" empty state. Blank is special-cased out of the category grouping (it's a start-from-scratch, not a category template) so it lives only on the overview row. One card is always selected (defaults to **Blank**); the card components live in `apps/live/components/template-picker-cards.tsx` so the same tile renders across overview / detail / search. The catalogue (`apps/live/lib/templates.ts`, pinned by `templates.test.ts` so spec drift surfaces as a test failure) ships **24 templates** (the `extra` flag, 8 default + 16 extra, is retained as catalogue metadata; the picker browses by category rather than gating behind a "Show more" toggle):

- **Blank diagram** — drops a **single 220 × 100 square** centred on the visible viewport, pre-labelled `Blank Diagram` at `md` text size, and **auto-selects it** so the user can immediately rename or edit. Generalised rule: a template that produces exactly one element auto-selects that element; multi-element templates leave the selection cleared.
- **Mind map** — a central circle with four labelled branch boxes, each sprouting two leaf cards, all connected by pinned arrows.
- **Org chart** — a leader rectangle with three direct-report rectangles pinned beneath it.
- **Retrospective** — three columns ("Mad", "Sad", "Glad") each with three blank stickies in tinted containers.
- **Flowchart** — Start → Step → Decision → Step → End vertical chain with shape-kind variety (stadium / square / diamond).
- **Kanban** — five lanes (Backlog / To do / In progress / Review / Done) with four ticket cards each. Every card pairs a title block with a priority chip (high / medium / low). The ticket text uses **per-range rich text** (spec/09's run model): the id (`TICKET-001:`) is a bold lead-in ahead of the plain summary. Board carries a "Sprint board" title above the columns so the diagram has an anchor and a natural rename target.
- **SWOT** — Strengths / Weaknesses / Opportunities / Threats 2×2 grid in tinted quadrants, with three bullet starters per quadrant and a centre "Subject" pill that names the thing being analysed. Each bullet uses **per-range rich text** to tint just its `•` marker to the quadrant's header hue, tying the line back to its quadrant while the body text stays theme-neutral.
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
- **System architecture** _(Technical)_: a request path through a small service topology — Client → API Gateway → Auth / App services → Database + Cache. Each infrastructure node is a full-colour **Technology icon** tile (spec/41) from the vendor-neutral Generic set — Nginx gateway, Docker / Kubernetes services, PostgreSQL database, Redis cache — captioned with its role (icon on top, label beneath). The client is a stroke-tinted `globe` line glyph (there's no brand mark for a browser), so it adopts the theme while the branded tiles keep their fixed colours; pinned arrows wire the flow.
- **ER diagram** _(Technical)_: four entity tables (Users / Orders / Products / OrderItems) in a 2×2 grid, each a bold title grouped with a `Field` / `Type` table, wired by `1 : N` relationship arrows. Reuses the table element + pinned arrows.
- **Sequence diagram** _(Technical)_: four participant headers (User / Web App / API Server / Database) over dashed lifelines, with request / response messages stepping down a login flow; reply messages dash to read as responses. Messages are free arrows (a sequence diagram's geometry is the point).
- **Prioritization matrix** _(Planning)_: a Value vs Effort chart — crossed double-headed axes (the quadrant divider) inside an L-frame of labelled axes (High/Low Value, Low/High Effort) — with a handful of items scattered across the field for the user to drag into the right quadrant. The axes carry the brand accent; the softened graph-paper backdrop reads as a plotting field.

`TemplateDescriptor.extra?: boolean` is retained as catalogue metadata (8 default + 16 extra, pinned by `templates.test.ts`), but the picker no longer gates behind a "Show more" toggle: it browses by category (overview → drill-in, plus flat search) in a height-capped scroll area (see "Templates section" above).

**Per-template canvas backdrop.** Each template ships with the background pattern that best suits its layout, applied on top of the chosen theme (which supplies only the colours) via `templateCanvasOverrides(kind)` in `apps/live/lib/templates.ts` (pinned by `templates.test.ts`). The pattern wins over the theme's default at creation time: alignment-heavy scaffolds (Flowchart, Org chart, SWOT, Gantt, Kanban, both wireframes) get the square **Graph** paper; clean radial layouts (Venn, Flywheel, Pyramid) get a **Blank** canvas so the shapes carry the page; the **Slide deck** gets a **Crosshatch** backdrop so the slide frames read as cards lifted off a textured surface; the **Logo design** sheet gets the **Checkerboard** design board; Timeline and User journey get horizontal **Lines**; the sticky-note / freeform boards (Retrospective, Fishbone, Live card) and Mind map pin an explicit dot **Grid** (so they keep it even under a blank-canvas theme). Mind map and User journey additionally soften `backgroundOpacity` to `0.8` so the pattern recedes behind the content. The Blank template carries no override and inherits the theme's pattern.

When the in-editor (per-tab) picker applies its theme choice, the backdrop fields go through the **same `switchThemeBackdrop` preserve-customs rule as the Theme accordion**: a field adopts the chosen theme's value only when it's unset or still matches the previous theme's default, and is kept when it was deliberately set to something else. In particular, since the picker pre-selects the tab's current theme, confirming a template without changing the theme never resets the backdrop, so the canvas styling a fresh tab inherited from its source tab (see [Tabs → Selecting & adding](#selecting--adding)) survives the template step. The per-template pattern override above still wins at creation time.

All template elements are inserted via the history hook (commit), so they're undoable in one step. The picker animates in via the global `fly-up-in` keyframe (see [Motion and animations](#motion-and-animations)).

### Theme section

Below the templates, the theme picker (see the two-level browse described under [Theme](#current-tab-section)) lets the user pick a preset theme — exactly the same `THEMES` catalogue the palette's Theme accordion uses. Defaults to **Basic** (the `brand` id). Confirming with **Create diagram** applies the chosen theme to the new tab (background colour + pattern + pattern colour + theme id), which then affects the default colours of every element added afterwards.

## Search panel

A global search modal (`apps/live/components/SearchPanel.tsx`; matching logic in `apps/live/lib/search.ts`, unit-tested in `search.test.ts`). Opened from the TabBar footer Search button in the editor and from the sidebar Search row on `/explorer`. Case-insensitive substring matching; the empty query lists everything (browse-first, narrow by typing). Esc and outside-click close; arrows + Enter drive keyboard selection.

Result sections, in order, each capped (8 per section, 12 for elements):

1. **Diagrams** — the owner's diagram names. Picking one opens it.
2. **Shared with you** — diagrams shared with the current owner, matched by name. Rows carry their still-live share code; picking one opens the visitor URL (`/diagram/<id>?s=<code>`), the only path a non-owner can open the diagram on.
3. **Folders** — personal folder names, then **team-library folders** (spec/35) shown with an "in `<team>`" suffix and matched by path or team name; each kind capped separately so neither crowds the other. Picking a personal folder selects it on `/explorer`; picking a team folder deep-links to `/explorer/team?id=<team>&folder=<id>` (the team page reads the param at mount). Team folders are swept lazily, one library fetch per team, the first time search opens (`useTeamFoldersForSearch`).
4. **Teams** — teams the signed-in user belongs to (spec/32), matched by name. Picking one lands on `/explorer/team?id=<id>`. Guests have none; the editor fetches the list lazily the first time search opens so non-searching sessions never pay the request.
5. **Tabs** — the open diagram's tab names (editor only; `/explorer` has no active diagram).
6. **Elements** — the open diagram's element text (editor only). Matches element labels; **tables match by cell text** (tables have no single label), surfacing the matching cell as the row label. Blank-labelled elements are unmatchable. Opening the panel triggers a **load-all-tabs prefetch**: per-tab lazy loading (spec/13) means unvisited tabs are empty placeholders locally, so search pulls every remaining tab's content in one parallel best-effort sweep — without it, element search silently misses tabs the user hasn't opened this session.

Out of scope (deliberate): element text in **other** diagrams (issue #13 — needs a server-side index), comments, notes, element links, the activity log, and participant names.

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
- Single-element selection coexists with **multi-select** (the [Marquee box-select](#marquee-box-select) section below) and **group select** (the Group action in the selection toolbar / context menu). The single-element popover is suppressed for multi-selections, where the `MultiSelectionToolbar` takes over. Its buttons are Duplicate, Group, Lock / Unlock, **Export**, and Delete. The selection's right-click (or toolbar-ellipsis) context menu holds **only** the type-aware formatting categories (Colours / Text / Border for boxed, Line + Pointer for arrows); it does not repeat those toolbar action buttons. **Export** opens the same Export dialog as the tab-level export, but scoped to just the selected elements (a derived tab whose `elements` are the multi-selection); the heading reads "Export selection" and every format (Markdown / PDF / PNG / SVG / File) renders only those elements. Pinned arrow endpoints that reference an element outside the selection keep their reference but render from the origin in the visual exports.
- Clicking the command palette never affects selection.

### Selection popover

When a shape is selected, a small **popover menu** appears next to it with action buttons (icon-only).

- **Position:** above the shape if there is room between the shape and the canvas top edge; otherwise below it. Horizontally centred on the shape.
- **Layout:** small rounded panel with the same styling language as the palette (border, shadow).
- The popover follows the shape during drag/resize — its position is derived from the shape's current bounds.
- Clicking inside the popover never deselects.

The popover surface itself is kept compact: it shows the **Comment** button plus a **More** ("More actions") button that opens the element menu. The fuller action set below is reached via that **More** menu and the element's **right-click context menu** (`EditorContextMenu`) — "Link Element" in particular lives in the right-click menu, not as a primary popover button.

Action set (grouped by a thin divider):

Format + duplication:

- **Format painter** — copies the selected element's formatting onto the next element clicked. Paintbrush icon. See [Format painter](#format-painter). (Shown for boxed elements only — not arrows.)
- **Duplicate** — clones the selected element(s) in place (offset slightly). Arrows in the selection copy too (`duplicateGroupedElements` in `packages/diagram/src/factories.ts`): a free endpoint translates with the offset, a pinned endpoint follows its duplicate when the target was copied or else keeps its original pin (still a real element, so never orphaned); an arrow whose pinned target no longer exists (e.g. a cross-tab paste) is dropped rather than dangled. The same helper backs Cmd-C / Cmd-V (`useClipboard`), so copy-pasting a selection that includes arrows (including free-floating ones) now carries them with their styling + label intact.

Relationships:

- **Link Element** (or **Edit link**) — opens the shared `LinkPickerDialog` (Tab / Diagram / External URL modes, plus Remove). Picking writes `link: { kind: 'tab', tabId }`, `{ kind: 'diagram', diagramId, name }`, or `{ kind: 'url', url }` onto the element; the target opens on a follow-link click. See [Element links](#element-links).
- **Comments** — opens the `CommentThreadPopover` for the element's comment thread. See [Comments](#comments).
- **Group / Ungroup** — Group enters group-mode to extend the selection into a group. Ungroup breaks the current group apart. See [Groups](#groups). (Shown for boxed elements only.)

State + destructive:

- **Lock / Unlock** — toggles the element's locked state. Icon flips between an open and closed padlock.
- **Delete** — removes the selected element from the active tab and clears selection. Trash icon. Disabled when the element (or its tab) is locked.

Bring to Front, Send to Back, **Lock aspect ratio**, and the colour swatches all live in the element's right-click context menu (Layer + Colours categories) — they were in the popover at one point and got moved out so the floating widget stays compact.

For **boxed elements** (shapes, text, sticky notes), a separate **plus button** appears just outside the element's right edge while it's selected — see [Quick add + connect](#quick-add--connect).

## Panning the canvas

The canvas can be **panned** to bring off-screen content into view.

- **Hold Space and drag the empty canvas background** (anywhere that isn't an element, palette, or popover) to pan. Same vocabulary as Figma / Excalidraw; leaves the bare drag gesture free for [marquee box-select](#marquee-box-select).
- Drag offsets the entire canvas content (shapes, arrows, plus buttons, selection popover, dot-grid background) as a unit. The palette and mode banners stay fixed.
- The cursor switches to `grabbing` while a pan is in progress.
- A press-and-release of Space+drag without movement counts as a **click** and deselects, as before.
- Double-click still drops a text element at the click position (now in the panned canvas-coordinate space).

The **Fit-to-screen** control (in the bottom-right `ZoomControls`) centres the viewport on the active tab's content and picks the largest zoom level that fits every element with a small margin. Empty tabs reset to (0, 0) at zoom 1. Same gesture as Figma / Excalidraw's "Zoom to fit". Also fires automatically the first time the active tab gains content (on diagram open and again on each tab switch into a non-empty tab) so a saved tab loads framed rather than at the previous session's pan / zoom.

On **mobile**, adding a new element smoothly brings the **whole** element into view (`scrollIntoView` in `useEditorViewport.ts`, gated to the freshly added + selected element so moves / remote changes don't trigger it). If it already fits the visible band — the canvas minus margins for the selection toolbar above and the tab bar / dock below — it just pans the minimum to pull any off-screen edge in; if it's too big to fit at the current zoom (e.g. a wide table or large image at the 60% mobile zoom), it zooms **out** just enough that the entire element shows (floored at `MIN_FIT_ZOOM`) and centres it. Desktop never auto-scrolls on add.

On desktop the viewport also zooms on **Ctrl- or Cmd-scroll** (mouse wheel) and on a **trackpad pinch**, focused on the cursor (`useCanvasPinchZoom`). The handler runs in the capture phase and only acts while the pointer is over the canvas, so it pre-empts the browser's own page zoom there while leaving Ctrl/Cmd-scroll elsewhere (address bar, DevTools) untouched. A plain wheel with no modifier is left to the browser.

### Touch (iOS / iPad)

On a touch device, the canvas surface declares `touch-action: none` and `user-select: none` (plus the iOS-specific `-webkit-touch-callout: none` and `-webkit-tap-highlight-color: transparent`). Without those, mobile Safari intercepts a one-finger drag for native scrolling, treats a long-press as the system text-selection callout, and shows a tap highlight ring on every element press. Pointer events are then dispatched normally so the same handlers (pan in Hand mode, marquee in Select mode, move / resize on elements) work from a finger or a stylus the same way they work from a mouse. Pinch-to-zoom is also disabled because the canvas owns its own zoom (wheel / +/- buttons / Fit). A dedicated touch pinch handler can land later; until it does, touch zoom goes through the Zoom controls.

## Marquee box-select

**Press-and-drag the empty canvas background** (without holding Space) to draw a translucent selection rectangle. On release, every boxed element whose bounding box is **fully enclosed** by the rectangle is multi-selected (containment, not intersection — you must drag a box right around an element to catch it). Releasing inside a sub-4-pixel area is treated as a click and deselects.

A multi-selection is mutually exclusive with the single-element selection:

- 0 hits → both cleared.
- 1 hit → single-select that element (the selection popover + right-click context menu still apply).
- 2 + hits → enter **multi-select** mode. The single-element popover is suppressed (a per-element toolbar doesn't make sense for many at once). Each multi-selected element still shows its selection ring via `BoxedElementView`'s `isSelected` prop.

While multi-selected:

- **Press-and-drag any member** moves the whole group in lockstep. The drag handler reads `multiSelectedIds` and pre-populates `startBounds` with every member.
- **Delete / Backspace** removes every multi-selected element and any arrows that reference one of them. **Locked members are kept** (and a locked arrow survives its endpoint going); if every member is locked it's a no-op. Single-element delete falls back to the same logic when there's no multi-selection. The keyboard handler is suppressed while a label is being edited or focus is inside any text input.
- **Plain click on a non-member** adds it to the multi-selection (the marquee mode is "sticky" once active — the user is clearly refining a bundle, not starting over). This applies to arrows as well as boxed elements.
- **Shift-click any element** toggles its membership — adds if absent, removes if present. Folds the current single selection in first so "I had A selected, now also B and C" works without losing A.
- **Click empty canvas** or **switch tabs** clears the multi-selection.

Marquee hits include both boxed elements (shape, text, sticky) and arrows whose segment AABB is fully enclosed by the rectangle. Duplicating a marquee that contains both carries the connectors across with their endpoints remapped to the duplicated targets.

## Quick add + connect

When a **boxed element** (shape, text, sticky note) is selected and not in edit/paint mode, **four plus buttons** float around its bounding box — one centred on each edge (right, bottom, left, top).

Each plus is a **click trigger** for a **radial quick-action ring**, not an instant action. **Clicking / tapping** a plus animates a ring of four options in around the button: each option grows **out of the plus** (slides from the plus centre to its slot + scales up), staggered for a fan effect, fanning **outward** from the element so it never overlaps the shape; closing reverses the same motion back into the plus. While open the plus becomes an **×**. The ring closes when the plus (×) is clicked again, when another plus is opened (only one ring is open at a time), or on any pointer-down outside a ring. There is **no hover-to-open** — the trigger is a deliberate click so it doesn't fire while the pointer just passes over the element. The plus no longer performs a one-click duplicate; every action is chosen from the ring. Each option carries a tooltip.

A ring open on the **same side as the selection toolbar** would collide with it (the toolbar sits above the element on desktop, below on mobile), so while a top **or** bottom ring is open the toolbar is forced to the **opposite** side. The element's **rotate handle** is also hidden while any ring is open (its handle above the element would clash with the ring).

All four options act on the **clicked side** (the side's anchor is `e` / `s` / `w` / `n`):

1. **Duplicate** — clones the selected element to that side (same size, content, style, locked state; fresh id) and connects the two with a pinned arrow between the adjacent anchors (`e ↔ w`, `s ↔ n`). This is the former one-click behaviour, now the first ring option.
2. **Arrow** — starts a new arrow pinned at that side's anchor. It begins on **pointer-down** so it's a single press-drag gesture. **Desktop:** press-and-drag the free endpoint to its target (snaps to an element anchor, or drops free on empty canvas) — the existing anchor-drag flow. **Mobile:** the press arms a "pick target" mode; the next tap on an element (or empty canvas) sets the endpoint, and a tap elsewhere cancels.
3. **Pencil** — enters freehand (pencil) draw mode (spec/09 "Pencil"); not a connected element.
4. **Text** — drops a text element to that side and opens it for editing. **No connector arrow** — a caption next to a node isn't a flow edge, so an arrow would be noise.

Placement (for Duplicate) reuses overlap-avoidance stepping (step further in the chosen direction until the new box clears existing elements). The newly added element is selected afterward so the user can keep building outward; the Arrow option selects the new arrow instead. Open ring state is owned by the Canvas (not the individual plus) so the single-open rule and the toolbar dodge can be coordinated.

Each chosen option emits telemetry (the quick-connect buttons previously emitted nothing): Duplicate → `track('Element', 'Duplicated', <kind>)`; Text → `track('Element', 'Added', 'Text')`; Arrow / Pencil fire their existing creation events (`'Arrow'`, freehand on commit).

The plus buttons are hidden while the element is being edited or while format-painter / group mode is active. They are also single-element only: a marquee multi-selection or a multi-member group hides them (there's no one shape to duplicate-and-connect from). Not shown for arrows, tables, annotation markers, or frame sections.

## Layer order

Boxed elements paint in **array order** — earlier in the tab's `elements` array means rendered earlier (further back); later means rendered on top. Arrows always render in a single SVG layer on top of all boxed elements (this is a current rendering limitation, not a long-term design).

New elements always land at the **front** of the z-order:

- **Palette adds** (shape / text / sticky / image / arrow / freehand, including the draw-to-size + pencil paths) **append** to `elements`, so the new element lands on **top** of existing content. Surfacing a freshly added element where the user can see and immediately work with it is the expected default; the context menu's Layer category **Send to Back** covers the rarer case where it should sit behind. (An earlier iteration prepended palette adds to drop them at the back, but landing new content on top matches how every other editor behaves and is what users reach for.)
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

**Face selection (`bestAnchorTowards`)**: when an arrow's pinned end is created (`bestAnchorTowards` at connect / drag-create time) or re-bound as a connected shape moves (`rebindArrowAnchorsAfterMove`, gated by the `autoRebindArrows` preference, see [spec/20](20-user-preferences.md)), the chosen face is the cardinal (n/e/s/w midpoint) that the straight centre-to-centre line **leaves the box through** — a slab / ray-box test, not the midpoint that happens to sit nearest the far centre. This is **aspect-ratio aware**: a short, wide box uses its top/bottom faces for everything but near-horizontal targets, a tall box its sides, so the arrow always exits the side the connector actually crosses. Auto-anchoring stays cardinal-only (matching the manual anchor dots); corners are never auto-chosen. While a connected shape is being **dragged**, the previously-bound face is held through a small dead-band around the box's corner diagonal (hysteresis), so the arrow doesn't flicker between two faces as the pointer crosses the diagonal — it commits to the new face only once the target is decisively past the corner. A sign flip on the same axis (e↔w, n↔s, the target crossing the centre) is never damped.

**Distribution across faces**: when several arrows attach to the **same** element they're spread across its faces rather than stacked on the single geometrically-best one. `rebindArrowAnchorsAfterMove` ranks every re-pinned endpoint (best-first, via `rankAnchorsTowards`) and assigns greedily: the endpoint most **committed** to a contested face (the one whose runner-up face is much worse) keeps it, and the others fall to their next-best free face — so two connectors that both want a shape's north face end up on north + east instead of overlapping. Faces held by pinned arrows not being re-anchored this pass (a mixed free+pinned arrow's pinned end, or an arrow on a shape that didn't move) are **reserved**, so the re-pinned arrows route around them too. **Click-to-connect**, by contrast, does NOT avoid occupied faces: it picks the geometrically-best face on each end and **sharing a start/end point with an existing connector is allowed** — steering off the natural face just to dodge an occupied one produced visibly worse connectors. (The on-move distribution above still spreads arrows that would otherwise stack as a shape is dragged.)

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

Selectable from the element's edit-text toolbar (and the right-click context menu). When set to a fixed size, content is centered and wraps on its newlines (and, for stickies, soft-wraps). Resizing the element does not change the font — only `scale` reacts to box size.

```ts
type TextSize = 'scale' | 'sm' | 'md' | 'lg';
type BoxedElement = ... & { textSize?: TextSize };  // defaults to 'scale'
```

## Rich text labels (per-range formatting)

The Text accordion + Colours swatch above format the **whole** label. On top of that, a label can carry **per-range** formatting — bold / italic / underline / strikethrough / size / colour applied to a **selection** of the text rather than the whole element. Scope: **shape / text / sticky** labels (the in-place editor). Arrow labels + table cells keep whole-element formatting only.

**Editor + toolbar.** Editing a label (double-click, Space, type-to-edit) opens a `contentEditable` editor (`RichTextEditor`, replacing the old `<textarea>`s) with a **floating toolbar** above the element. The toolbar's top row carries Bold / Italic / Underline toggles, an **alignment dropdown** (a 3×3 grid), a colour swatch, and a **⋯ overflow menu**. The overflow menu groups the less-common controls into collapsible **tile-grid categories** (the shared `MenuTile` / `MenuTileGrid`, so it reads the same as the right-click context menus): **Size** (small / medium / large, the 1/2/3-dot glyphs), **Format** (Strikethrough plus bullet / numbered lists), **Font**, and **Padding** (None / Small / Medium / Large). The B/I/U/Strikethrough/size/colour controls apply per-range (the current selection, or, on a collapsed caret, the whole text); alignment + padding are whole-element (they reuse the shared `onSetTextAlign` / `onSetPadding` setters, operating on the editing element). The dropdowns + overflow menu are kept inline (not portalled) so the editor's focus + canvas-propagation guards apply to their menus too. The toolbar counter-scales `1/zoom` so it stays a constant on-screen size, and flips below the element near the top edge. Controls `preventDefault` on mousedown so clicking one never drops the editor's text selection; the native colour input is the one control that takes focus, and the editor re-focuses + restores the selection after the colour applies.

**Runs-as-delta model.** Per-range formatting is stored as `richText?: TextRun[]` on the element — each run is a slice of text plus only the attributes that **differ** from the whole-element `text*` fields:

```ts
type TextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  size?: 'sm' | 'md' | 'lg'; // per-run size; no 'scale'
  color?: string; // hex
};
```

An unset run attribute **inherits** the element field (`run.bold ?? el.textBold`, `run.color ?? el.textColor`, `run.size ?? el.textSize`), so the existing whole-element controls keep working as the base layer untouched, and an explicit per-range override wins over a later whole-element toggle (same precedence as table `cellStyles`). `element.label` is always kept equal to the runs' concatenated plain text, so search, auto-rename, markdown export, and every legacy reader work unchanged. When `richText` is absent (or a single override-free run) the label renders via the legacy whole-element path; applying any per-run override opts the label out of `scale` SVG auto-fit into fixed-px rendering (mixing per-run sizes with whole-element auto-fit is contradictory). The pure runs algebra (`runsPlainText` / `normalizeRuns` / `applyFormatToRange` / `toggleFormatInRange`) lives in `packages/diagram/src/rich-text.ts`; the DOM ↔ offset mapping in `apps/live/components/rich-text-dom.ts`. The field is additive + optional, so it syncs to peers + persists with no backend change, and visual exports (PNG / SVG) render the runs span-by-span on one baseline.

## Quick text drop

**Double-clicking the empty canvas** (anywhere not on an element, palette, or popover) drops a new **text element** at the click point and **immediately enters edit mode** on it. The text is centred on the cursor position. Press Enter to commit or Escape to cancel — Escape will leave an empty text element in place, which the user can then delete.

## Auto-select on add

Every palette `Add ...` button auto-selects the newly created element. The selection popover and the plus buttons appear immediately, and the element's right-click context menu is one click away, ready for the next action.

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
- The **+** button at the right of the bar adds a fresh empty tab and switches to it. The new tab is **seeded from the active tab's visual context**: theme id, canvas backdrop (`backgroundColor`, `backgroundPattern`, `backgroundOpacity`, `patternColor`), font, and default text size all carry over, so a user mid-diagram doesn't land on a brand-default canvas. Each tab stays independently styleable after creation (restyling the new tab never affects the source). The seed survives the new tab's template picker too: picking a template under the unchanged theme keeps the inherited backdrop (see [Per-template canvas backdrop](#templates-section)), and Skip leaves it untouched.

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

The active tab carries a **`⋯` ellipsis button** to the right of its name. Clicking opens a small floating menu (right-clicking any tab opens the same menu, suppressing the browser's default context menu and switching to that tab first if it isn't active so the menu's actions operate on the tab the user pointed at). A **quick-action toolbar** (Rename / Duplicate / Lock / Delete) sits at the top; the verbose actions group into collapsible **Organise** / **Content** / **Session** categories. The same menu — scoped to the active tab — is what the **empty-canvas right-click** and the desktop **footer canvas-menu button** open, except those surfaces also fold in **Canvas** (Change Theme / Change Canvas / Auto-align) and **Add** (Square / Sticky / Pencil / Annotation) categories. (The empty-canvas right-click used to open a separate canvas-only menu; it now shares this one so a right-click manages the tab as well as the canvas.) Actions:

- **Rename** — enters inline rename mode.
- **Duplicate** — creates a copy of the tab (same elements, same pattern, name suffixed with " copy") inserted directly after the source, and switches to it.
- **Clear content** — wipes every element from the tab in one undoable commit. Disabled when the tab is already empty or when the tab is locked.
- **Lock / Unlock** — toggles `tab.locked`. While locked, every element on the tab is read-only (matches per-element lock semantics), the palette's Add buttons stop firing, theme / canvas changes are blocked, **the tab itself can't be deleted** (the Delete row is disabled — unlock first), and the tab pill shows the padlock icon (see above).
- **Add to another diagram** — submenu listing every other diagram the participant owns. Picking one links the tab into that diagram via `POST /api/diagrams/:id/tabs/:tabId/link` (the source tab stays put; both diagrams now share the same `tabs.data` row so edits propagate, see [spec/17](17-tab-diagram-many-to-many.md)).
- **Delete** — removes the tab and falls back to a neighbouring tab. Disabled when only one tab remains.

The menu renders through a **portal** to `document.body` so it isn't clipped by the tab bar's horizontal scroll. It positions itself from the ellipsis button's bounding rect (tab surface) or at the cursor / footer-button point (canvas surface), clamping back on-screen at every viewport edge.

### Reordering

Tabs are **draggable** via the native HTML5 drag API. Dragging a tab over another shows a ring around the drop target; releasing reorders the source to the target's position.

## Element links

Any element can carry a **link**: to another **tab**, another **diagram**, or an **external URL** (`ElementLink` kinds `tab` / `diagram` / `element` / `url`). Clicking the link jumps to the tab, opens the diagram, or opens the URL in a new tab (`noopener`).

### Setting a link

- Right-click an element → **Link Element** (or **Edit link** when one exists) opens the shared **LinkPickerDialog** — a centred modal styled like the import / export dialogs.
- The dialog has three modes: **Tab** (lists every tab), **Diagram** (lists the user's other diagrams), and **External URL** (a text field; a bare host gets `https://` prepended). A **Remove link** action shows when a link is already set.
- The same dialog sets **per-cell table links**: a **Link cell** button in the in-cell toolbar opens it for that cell, storing the link on `cellStyles[r][c].link` (so it rides the cellStyles splice on row / column edits). The dialog and follow behaviour are identical; only the commit target differs (element `link` vs cell style `link`).

The Link button is brand-tinted when the selected element has a link.

### Visual indicator

A linked boxed element shows a small brand-coloured **link badge** in its top-right corner with a chain icon. The badge:

- Is counter-scaled with `1/zoom` so it stays the same on-screen size at any zoom.
- **On click**, follows the link: a tab/element link switches tab (`setActiveId`, clearing selection + edit/mode state), a diagram link opens that diagram, a url link opens the address in a new tab.
- Stops propagation so it doesn't trigger element select / drag.

A **linked table cell** shows the same chain glyph in the cell's top-right corner; clicking it follows the link (in view and edit sessions) without selecting / editing the cell.

Arrows can also carry a link but don't show a visible badge yet (no obvious place to put one); future iteration may put a badge at the arrow's midpoint.

### Data model

```ts
type ElementLink =
  | { kind: 'tab'; tabId: TabId }
  | { kind: 'element'; tabId: TabId; elementId: ElementId };
```

The UI exposes the `'tab'`, `'diagram'`, and `'url'` kinds (via the LinkPickerDialog's Tab / Diagram / External URL modes). The `'element'` kind is in the model so future iterations can "jump and focus a specific element" without a schema change.

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
- **Enter** inserts a newline (labels are multi-line). **Commit** by clicking outside / blurring; **Escape** cancels.
- The label **auto-scales to fit the shape** — text is rendered inside an SVG whose `viewBox` is set to the text's measured bounds, with `preserveAspectRatio="xMidYMid meet"`. The text scales uniformly to fill the shape: bigger shapes get bigger text; longer labels shrink to fit.
- During edit, selection handles and the popover are hidden so they don't get in the way.
- **Locked** shapes can still be labelled — locking protects position, not content.
- Empty labels are valid (nothing is rendered).
- Labels are **multi-line** for shapes, text, and sticky notes: Enter inserts a newline and the renderers (auto-fit SVG `tspan`s / wrapping div) lay the lines out.
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
  - **Cannot be deleted** — the popover's Delete button is disabled while locked, the keyboard Delete / Backspace skips it, and a multi-select Delete keeps locked members while removing the rest. The arrow cascade also leaves a locked arrow in place. Unlock first to delete.
  - Can still be **labelled** (double-click) — locking protects position and existence, not content.
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

When a move, resize, or **draw-to-size** snap lands an element's edge or centre onto a neighbour's, the canvas draws a **faint guide line** along the shared edge / centre line so the user can see _why_ the element snapped where it did. This makes lining shapes up on a busy canvas much easier: the guide visibly connects the (dragged or being-drawn) element to the neighbour(s) it aligned with. The move / resize guides are derived in `useEditorDrag`; the draw-to-size guides are derived in `CanvasChrome` from the in-progress draw box (whose corners are already snapped) and rendered through the same overlay.

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
- **Drag** sizes the box (shape / text / sticky / image) to the drag's bounding box with a 16 px floor on each axis. **Both corners snap** to nearby objects: the start corner snaps to neighbour edge / centre lines (a 0×0 point snap via `snapToAlignment`) and the moving corner snaps through `snapResizeBounds` (edges + dimensions) as you drag — so a drawn shape can latch onto a neighbour at both ends rather than landing a pixel off. The start snap is **previewed before you press**: while the gesture is armed, the hovered pointer snaps to a nearby edge / centre and a brand dot + the guide lines mark where the first corner will land, so it can be placed on an alignment intentionally (rather than only snapping if the raw click happened to fall within the halo). The faint **alignment guides** appear while you size it (see [Alignment guides](#alignment-guides)) so you can see which neighbour edges / centres it latched onto. **Hold Shift** to constrain to 1:1 (perfect square / circle).
- The **text** intent drops straight into typing mode on commit (both the tap and the drag paths): the new text box is selected _and_ editing, so the user can type immediately without a second click. This matches the double-click-to-add-text path. Every other intent lands selected-but-not-editing, with its format popover as the next interaction.
- The **arrow** intent treats the drag's start / end as `from` / `to` directly (a line, not a box); a tap drops the default-sized horizontal arrow centred on the click. **Both endpoints snap** to nearby element edge / centre lines (a point snap) as you draw, so the arrow can begin / end on a shape's edge or corner; per-end anchor _pinning_ still happens via the arrow drag-handle flow after creation.
- A top-of-canvas `ModeBanner` reads "Tap to drop or drag to draw …" with a Cancel button (Escape cancels too); the matching palette button renders pressed (brand-tinted) until release; the cursor is a custom inline-SVG crosshair with a small shape / tool glyph in the lower-right.
- Picking a palette entry from laser mode auto-switches to pan so the canvas accepts the gesture (laser swallows pointer-down to paint the trail). Image commits open the image picker after placing, matching the old click-to-drop path.
- While an intent is armed, a pointer-down **starts the draw even when it lands on top of an existing element** — it does not select / drag that element. The canvas intercepts the press in the capture phase (ahead of each element's own pointer-down), so a new element can be drawn over another. Arming already cleared the selection, so there is no selected element to disturb.

Icons + tables have no draw-to-size (a glyph / fixed grid isn't a box you size by dragging) — they drop straight at the viewport centre via `addBoxed`, which applies the same `inheritedSizeFor` size inheritance.

## Pencil (freehand)

Always-on palette tool (the pencil is gestural by definition — no tap-to-drop branch): clicking the Pencil button, or pressing **F** (Freehand; P is taken by the Hand/pan tool), enters a one-shot freehand-draw mode for the next canvas drag. Drawing produces a new `FreehandElement` (see [spec/05](05-diagram-structure.md)) rendered as an inline SVG path inside its bounding box.

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

A sparkle / magic-wand icon button (with a `Tooltip` describing the on / off state) sits in the pencil `ModeBanner` (to the left of Cancel) and toggles **shape recognition**. When on, the commit handler runs the simplified polyline through `recogniseShape` (`packages/diagram/src/recognise-shape.ts`) and, if the score clears the confidence threshold, mints a real shape primitive instead of a `FreehandElement`. Recognised kinds: rectangle (square), circle, diamond, triangle, 5-pointed star, and line (→ arrow). Trapezoid / speech bubble / frame / the device frames aren't recognised — they're ambiguous or not freehand-drawable, so they stay palette-only. The toggle is persisted as a user preference (`recogniseShapes` in spec/20) so flipping it sticks across pencil sessions and across devices for signed-in users; it is deliberately NOT surfaced in the Settings dialog (a per-tool toggle belongs where the tool is, not in global settings).

- Detected kinds: **rectangle / square** (axis-aligned 4-corner outline) → `ShapeElement` with kind `square`; **circle / oval** (closed curve hugging the inscribed ellipse) → `ShapeElement` with kind `circle`; **diamond** (4 corners at bbox edge midpoints) → `ShapeElement` with kind `diamond`; **line** (straight open polyline) → `ArrowElement` with `arrowEnds: 'none'`.
- Heuristics, not template matching: each scorer measures the mean perpendicular distance from every sample to the idealised shape's edges (or to the inscribed-ellipse boundary), so the detector is rotation- and scale-tolerant without per-shape templates.
- Confidence is in [0, 1]; the editor's 0.40 threshold leans hard toward "convert it". Turning the mode on is an explicit opt-in, so the user has already stated they want strokes classified; false positives are one Cmd-Z away and the toggle is one click off, while false negatives (a wobbly square that stayed a sketch when the user wanted a rectangle) are the more frustrating outcome. Previous values: 0.72 (too strict), 0.55 (still too strict per user feedback).
- Telemetry: a recognised commit emits `Element/Added/<Square|Circle|Diamond|Arrow>` (the dashboard reads as if the user had clicked the palette button); the unrecognised fallback emits `Element/Added/Freehand` as before. No new types in spec/22's closed vocabulary.

## Out of scope (next iterations)

Items still genuinely out of scope today (most of the original list has shipped — see the Editor section above):

- **Mid-edge resize handles** — only corner handles drive resize.
- **Rotation** — elements always render axis-aligned.
- **Clipboard copy / paste** — `Duplicate` (in-place clone) is available, but cut/copy/paste against the OS clipboard isn't wired up.
