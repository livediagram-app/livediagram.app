# Canvas and command palette

The live app's canvas is where users actually build diagrams. A floating **command palette** sits on top of the canvas with controls for adding elements.

## Command palette

A small floating panel **initially placed in the top-right corner of the canvas**. The panel has a **`PALETTE` header label** in block caps above the buttons, and below it a row of icon buttons — one per primitive that can be added to the canvas.

### Movable

- The header row is a **drag handle** — press it and drag to move the palette anywhere on the canvas. Clicking a button does not start a drag.
- Position survives until the page reloads.

### Minimizable

- The header has a **minimize button** to the right of the `PALETTE` label.
- When minimized, the panel collapses into a **square dock button at the bottom of the canvas**, rendered inside the same flex cluster as ZoomControls + HistoryControls (sitting immediately to the left of the zoom card). Multiple minimised panels stack left-to-right in the dock: the Explorer's dock button sits to the left of the Palette's, then Zoom, then History.
- Clicking the dock button restores the panel to its last position (or the default top-right if it hasn't been moved).

## Explorer panel

A second floating panel, pinned to the **top-left** of the canvas by default. Shares the same draggable + minimisable behaviour as the [Command palette](#command-palette) via the shared `MovablePanel` component. Title: `EXPLORER`.

The Explorer is intended to list every diagram in the user's account. Until auth lands, it shows a sign-up nudge — a dashed-border card with "Sign in to save your diagrams" copy and a disabled **Sign in (coming soon)** button. The empty state is a deliberate prompt: it surfaces the value of accounts (persistence) right where users will naturally look for their diagram list later.

When minimised, the Explorer collapses into a dock button (folder icon) in the bottom dock, left of the Palette's dock button.

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

- **Theme** — a 3-column grid of preset themes. Picking a theme writes `theme: ThemeId` onto the tab AND replaces the tab's `backgroundColor`, `backgroundPattern`, and `patternColor` with the theme's values. From that point on, newly added boxed elements inherit the theme's `elementFill / elementStroke / elementText` colours (sticky notes keep their amber identity regardless). Existing elements are **not** retroactively recoloured — the user can re-apply colours per-element via the Selected Element → Colours accordion. The theme catalogue (`apps/live/lib/themes.ts`) ships with: **Brand** (default sky-blue + white), **Slate** (cool grey), **Forest** (greens on a mint backdrop), **Sunset** (warm orange), **Lavender** (purple), **Mono** (black & white). Adding a new theme is just one entry in the catalogue.
- **Background** — per-tab background controls. Six pattern choices (Grid, Blank, Lines, Graph, Crosshatch, Confetti) plus Canvas + Pattern colour pickers. Patterns store as `backgroundPattern?: BackgroundPattern`. When the user pans, the grid/lines/graph/crosshatch pattern phase tracks the pan offset so the pattern tiles indefinitely. Confetti renders a fixed multi-colour scatter and ignores the pattern colour.
- **Content** — destructive operations on the tab's contents (today: a single "Remove all content" button, disabled when there's nothing to clear).

### Selected Element section

When **any** element is selected, the palette grows a fourth section at the bottom titled `SELECTED ELEMENT`. It hosts per-element controls grouped into **collapsible accordions** so the palette stays compact. Each accordion is **closed by default**; clicking the header toggles it open.

Accordion groups:

- **Layer**
  - Front — bring to top of the z-order.
  - Back — send to bottom of the z-order.
- **Text** _(boxed elements only)_
  - Text size — `Scale | Small | Medium | Large`. See [Text size](#text-size).
  - Text alignment — 3 × 3 grid. See [Text alignment](#text-alignment).
- **Colours** _(boxed elements only)_
  - **Text** swatch — colours the element's label. Shown for every boxed kind (shape, text, sticky).
  - **Background** swatch — fill colour. Shapes & sticky notes only.
  - **Border** swatch — outline colour. Shapes & sticky notes only.
  - See [Colours](#colours). Text elements show only the Text swatch; shapes and sticky notes show all three.

Accordion headers show a chevron that rotates 180° when open. The body slides open/closed via a `grid-template-rows` 0fr↔1fr transition (~200 ms) so motion is smooth and free of layout jumps.

The Selected Element section vanishes when nothing is selected — replaced by the [Current Tab](#current-tab-section) section.

### Undo / Redo

A separate row at the bottom of the palette (separated from the add-buttons by a thin divider) holds two history controls:

- **Undo** (left-curve arrow) — reverts the last change.
- **Redo** (right-curve arrow) — reapplies an undone change.

History is kept to a maximum of **3 steps** in each direction. Older states are dropped.

Undo-able actions: adding/deleting any element, label commits, lock toggle, layer order (bring/send), format-paint apply, duplicate-and-connect, drag-end (move or resize, including arrow-endpoint drags). The snapshot is taken at the **start** of a drag so undo returns to the pre-drag state, not to intermediate frames.

Not in history: selection, edit mode entry, palette position/minimize state, format-painter mode.

For the initial version, the palette has these buttons:

- **Square** — adds a 120×120 square node to the active tab.
- **Circle** — adds a 120×120 circle node to the active tab.
- **Diamond** — adds a 120×120 diamond (decision-node, UML-style). Rendered as an SVG polygon overlay so the diamond outline matches the element's bounding box.
- **Cylinder** — adds a 100×140 cylinder (taller than wide to match the natural shape).
- **Parallelogram** — adds a 160×100 parallelogram (wider than tall).
- **Hexagon** — adds a 140×120 flat-top hexagon.
- **Document** — adds a 140×110 document shape (slightly wider than tall).
- **Text** — adds a free-floating text element (see [Text element](#text-element)).
- **Sticky note** — adds a sticky-note element (see [Sticky note element](#sticky-note-element)).

Arrows are no longer in the palette — see [Adding an arrow](#adding-an-arrow).

### Placement on add

Every `Add ...` button places the new element at the **centre of the visible canvas viewport**, accounting for any pan offset. The element is also auto-selected.

If a boxed element is currently selected, the new element **inherits its width and height** so the user can chain together similarly-sized nodes quickly. Circles and diamonds are an exception — they're inherently 1:1, so they snap back to a square using the larger inherited dimension to avoid being squashed.

Clicking a button places the new element on the active tab's canvas. For the first version, new elements are placed at a **staggered default position** (each shape offset slightly from the last) so multiple clicks don't stack on top of each other.

The name "command palette" is forward-looking — it will grow into a richer set of controls (more shapes, connectors, text, search). For now, two buttons.

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
  // to one of the four ArrowThickness presets (1 / 2 / 3.5 / 5 px) for
  // the UI but stored as a raw number so legacy values survive.
  // `arrowheadSize` is independent so users can pair a thin line with
  // a chunky head (or vice versa).
  strokeWidth?: number;
  arrowheadSize?: 'small' | 'medium' | 'large' | 'extra-large';
  // Path geometry. 'straight' is a single line; 'curved' renders a
  // quadratic bezier bowing perpendicular to the chord by ¼ of its
  // length; 'angled' draws an axis-aligned L-connector with a single
  // right-angle bend. Pinned-endpoint anchors decide which leg of
  // the elbow runs first so the line leaves the element along its
  // anchor direction.
  arrowStyle?: 'straight' | 'curved' | 'angled';
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

Seven shape kinds, all rendered as absolutely positioned elements on the canvas:

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
  | 'document';

type Element = {
  id: ElementId;
  type: 'shape'; // discriminator — future: 'edge', 'group', ...
  shape: ShapeKind;
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

Below the welcome section, a 4-column responsive grid of template cards (2-col on narrow viewports). One card is always selected (defaults to **Blank**). The card's compact layout — small preview thumbnail + title + 2-line description — lets the grid show all four options at once without scrolling. Options:

- **Blank diagram** — drops a **single 220 × 100 square** centred on the visible viewport, pre-labelled `Blank Diagram` at `md` text size, and **auto-selects it** so the user can immediately rename or edit. The user starts with one editable rectangle they can rename or grow from, rather than a fully empty canvas. (A truly empty canvas is psychologically intimidating; this gives users an anchor element to immediately interact with.) Generalised rule: a template that produces exactly one element auto-selects that element; multi-element templates leave the selection cleared.
- **Mind map** — a central circle with four labelled branch circles connected by pinned arrows.
- **Org chart** — a `CEO` rectangle with three direct-report rectangles pinned beneath it.
- **Retrospective** — three columns ("What went well", "What didn't go well", "Action items") each with three blank stickies.

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
- Only one shape can be selected at a time — multi-select is out of scope for now.
- Clicking the command palette never affects selection.

### Selection popover

When a shape is selected, a small **popover menu** appears next to it with action buttons (icon-only).

- **Position:** above the shape if there is room between the shape and the canvas top edge; otherwise below it. Horizontally centred on the shape.
- **Layout:** small rounded panel with the same styling language as the palette (border, shadow).
- The popover follows the shape during drag/resize — its position is derived from the shape's current bounds.
- Clicking inside the popover never deselects.

Initial button set (left to right):

- **Format painter** — copies the selected element's formatting onto the next element clicked. Paintbrush icon. See [Format painter](#format-painter). (Shown for boxed elements only — not arrows.)
- **Group / Ungroup** — Group enters group-mode to extend the selection into a group. Ungroup breaks the current group apart. See [Groups](#groups). (Shown for boxed elements only.)
- **Lock aspect ratio** — toggles `aspectLocked` on the selected element. Off by default. When on, corner-resize scales width and height together (whichever dimension the user pulls more wins; the other is derived from the source aspect ratio). See [Aspect ratio lock](#aspect-ratio-lock).
- **Lock / Unlock** — toggles the element's locked state. Icon flips between an open and closed padlock.
- **Delete** — removes the selected element from the active tab and clears selection. Trash icon.

Bring to Front and Send to Back **used to live here**; they're now in the palette's [Selected Element](#selected-element-section) section.

For **boxed elements** (shapes, text, sticky notes), a separate **plus button** appears just outside the element's right edge while it's selected — see [Quick add + connect](#quick-add--connect).

More buttons (rename label, change colour, duplicate, link, send to back, …) will be added here over time without changing the popover's positioning rules.

## Panning the canvas

The canvas can be **panned** to bring off-screen content into view.

- **Hold Space and drag the empty canvas background** (anywhere that isn't an element, palette, or popover) to pan. Same vocabulary as Figma / Excalidraw; leaves the bare drag gesture free for [marquee box-select](#marquee-box-select).
- Drag offsets the entire canvas content (shapes, arrows, plus buttons, selection popover, dot-grid background) as a unit. The palette and mode banners stay fixed.
- The cursor switches to `grabbing` while a pan is in progress.
- A press-and-release of Space+drag without movement counts as a **click** and deselects, as before.
- Double-click still drops a text element at the click position (now in the panned canvas-coordinate space).

There is no pan reset / "centre on content" control yet — that's a future addition.

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

The selection popover exposes:

- **Bring to Front** — moves the selected element to the end of the elements array.
- **Send to Back** — moves the selected element to the start.

These apply to any element type (including arrows, where they re-order among arrows).

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

- Click a tab to switch to it. Switching clears element selection, edit mode, and any active picker/group mode.
- The **+** button at the right of the bar adds a fresh empty tab and switches to it.

### Renaming

A tab can be renamed in two ways:

- **Double-click the active tab's name** → inline input (Enter commits, Escape cancels, blur commits).
- **Tab menu → Rename** (see below).

### Tab menu (ellipsis)

The active tab carries a **`⋯` ellipsis button** to the right of its name. Clicking opens a small floating menu with:

- **Rename** — enters inline rename mode.
- **Duplicate** — creates a copy of the tab (same elements, same pattern, name suffixed with " copy") inserted directly after the source, and switches to it.
- **Delete** — removes the tab and falls back to a neighbouring tab. Disabled when only one tab remains.

The menu renders through a **portal** to `document.body` and positions itself from the ellipsis button's bounding rect, so it isn't clipped by the tab bar's horizontal scroll.

### Reordering

Tabs are **draggable** via the native HTML5 drag API. Dragging a tab over another shows a ring around the drop target; releasing reorders the source to the target's position.

## Element links

Any element can carry a **link to another tab**. Clicking the link jumps to that tab.

### Setting a link

- The selection popover has a **Link** button (chain icon) between Duplicate and Lock-aspect.
- Clicking it opens a small **TabLinkPicker** popover above the button (portal-rendered, viewport-clamped) listing every tab except the current one.
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
- The shape follows the cursor delta from where the drag began (no snapping yet).
- Shapes can be placed anywhere on the canvas, including overlapping each other. No bounds.

## Resize

When a shape is selected, **four corner handles** (NW, NE, SW, SE) appear as small white squares with a brand-600 border.

- **Press-and-drag a handle** to resize the shape.
- The corner opposite the handle stays anchored; the dragged corner follows the cursor.
- **Minimum size is 20×20** to keep shapes pickable.
- Resize is free-form — aspect ratio is not preserved (shift-to-constrain is out of scope for now).
- Mid-edge handles (N, S, E, W) are out of scope for now.

## Out of scope (next iterations)

- Mid-edge resize handles, aspect-ratio constraint.
- Rotation.
- Connectors / edges between shapes.
- Zoom and pan.
- Snapping / aligning to a grid or other shapes.
- Keyboard nudging, copy/paste, undo/redo.
- Re-styling shapes (colour, stroke, label).
- Saving canvas state across reloads.
