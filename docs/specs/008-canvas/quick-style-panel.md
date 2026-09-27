# Quick style panel

Status: **implemented**.

While one or more shapes and / or arrows are selected, a small panel on the right edge of the canvas
offers the handful of style choices people reach for most: stroke colour, background, stroke width,
stroke style, text alignment and icon alignment, plus a Clear styles action. What you choose there
(or in the context menu) is remembered for the next shape of the same kind you draw.

## Why

Styling a shape through the context menu is complete but slow: right-click, open a category, find
the row, pick, close. For the five or six choices made on almost every diagram, that round trip is
most of the work. A surface that is already open when something is selected turns each of them into
one click.

The second half is memory. A diagram usually has a notation: decisions are amber diamonds, services
are blue boxes, async calls are dashed arrows. Today every new shape arrives in the theme default and
has to be restyled by hand, the same way, every time. Remembering the last style per kind lets the
notation carry itself.

## What it is not

A right-hand **Editor panel** once held every per-element setting. It was removed: it duplicated the
context menu, grew with every feature, and covered the canvas it was meant to serve. Per-element
formatting lives in the right-click context menus ([Live app](../007-editor/live-app.md),
[Canvas and palette](canvas-and-palette.md)).

The quick style panel is deliberately not that panel coming back:

- **The context menu stays the complete home of every setting.** Everything the panel offers is also
  in the menu. The panel never gets a setting the menu does not have.
- **The panel holds only the most-used choices, in their most-used values.** A row offers three
  options (seven for colours), not the full set; the rest stay one right-click away.
- **A new row must earn its place** by being among the most-used style choices across kinds, and
  must fit the row rhythm below. A setting that is used on one kind, or rarely, belongs in the menu.

The boundary keeps the panel small enough to leave open without covering the diagram, which is the
only reason it can be always-there rather than on-demand.

## Where it sits

- **Right edge, vertically centred** in the canvas area, in every desktop panel layout (Floating,
  Minimal, Toolbar, [Toolbar layout](../007-editor/toolbar-layout.md)).
- **Never over the Palette.** The panel is placed after the Palette and the other floating chrome
  (panels, dock popovers, the Toolbar strip and its More popover, the bottom-right cluster), by
  trying fixed candidate spots in order and taking the first that overlaps none of them:
  1. the right edge, centred;
  2. the right edge, just below an obstacle on that edge, the highest spot first;
  3. the right edge, just above an obstacle on that edge, the lowest spot first;
  4. directly left of the obstacles on the right edge, centred;
  5. the left edge, centred.

  If none is clear, the first is used. The order is fixed so the panel always lands in the same
  place for the same chrome, and the right edge is preferred because that is where people look for
  it. Placement is recomputed when the chrome moves or resizes, never on a timer.

- **Not on phones.** A phone's canvas has no spare edge, and the context menu covers the same
  choices. The panel shows from the `sm` breakpoint up.
- **It stands down** while an element or multi-selection context menu is open (two style surfaces at
  once repeat each other, and the menu may open at the right edge), in zen mode, in embeds, while
  presenting, and when edits are blocked (a view-only visitor or a locked tab).

## Sections

Top to bottom, each a small title over one row of option buttons:

| Section        | Applies to       | Options                            |
| -------------- | ---------------- | ---------------------------------- |
| Stroke         | Shapes + arrows  | 7 colours                          |
| Background     | Shapes           | 7 colours                          |
| Stroke width   | Shapes + arrows  | Thin / Medium / Thick              |
| Stroke style   | Shapes           | Solid / Dashed / Dotted            |
|                | Arrows           | Solid / Dashed / Flowing           |
| Text alignment | Shapes           | Left / Centre / Right (horizontal) |
| Icon alignment | Shapes with icon | Before / Above / After the label   |
| Actions        | Shapes + arrows  | Clear styles                       |

- **Flowing** is a dashed line with the marching-dashes flow animation (`strokeStyle: 'dashed'`,
  `flow: 'dashes'`). So the plain arrow and the animated dashed arrow are each one click, the two
  arrow looks people build most. Solid and Dashed clear any flow.
- **Icon alignment** shows only when a selected shape carries an inline icon. Before / Above / After
  map to `iconPosition` left / above / right. "Below" stays in the context menu: it is the rarest
  arrangement, and a fourth option would break the row rhythm.
- **Text alignment** is the horizontal axis only. Vertical alignment is the less-used half and stays
  in the menu's 3×3 grid.
- A section shows when at least one selected element supports it (a background for a shape that has
  one, a border for a shape that draws one, a label slot for alignment). Sticky notes, text, tables,
  images and other non-shape elements are not styled by the panel; a selection holding only those
  shows no panel.

### Option counts and rhythm

Colours offer seven; every other row offers three. Rows pair calmly, 7 and 7, then 3, 3, 3, 3, so the
panel reads as two blocks of equal rows rather than an irregular 3-4-5-3-4 sequence the eye has to
re-measure at every line. Three is the natural size of each row:

- **Width** drops "none" (removing the border is a different decision from how heavy it is) and
  "extra thick" (rare).
- **Style** drops the niche dash variants (dash-dot, long dash, dash-dot-dot).
- **Horizontal text alignment** is naturally three.
- **Icon alignment** drops "below", the rarest arrangement; a lone row of four would break the rhythm.

A future row may use four or five options only in pairs of equal length.

## Colours

The seven colours are **theme-relative**:

- **First, the theme default**: the colour the theme gives a new shape (or the unpainted ink, on the
  Default scheme, which paints nothing). Picking it writes the theme's own value, exactly like the
  context menu's reset to theme.
- **Then six from the theme's own palette.** A multi-colour theme has six branch colours, and they are
  used as they are: branch strokes for the Stroke row, the matching branch fills for Background. A
  single-accent theme has one hue, so it is spun into six: red, orange, yellow, green, blue and violet,
  each in the accent's own saturation and lightness (clamped so a grey accent still yields colour and
  a near-black one still yields visible strokes). That keeps every row genuinely on-theme (a Sand
  diagram's green is a muted green) while still offering six distinct colours, and it puts the six in
  the same order a multi-colour palette runs, so slot 4 means green everywhere.
- **Backgrounds keep labels readable.** A derived background is a wash of its hue (over white on
  light paper, over the theme's fill on dark paper), thinned until the theme's label colour reads at
  4.5:1 on it. A derived stroke is stepped darker (or lighter, on dark paper) until it reads at 3:1
  against the canvas.
- **Colours follow the theme**, the way [Style presets](../010-palette/style-presets.md) do. Picking
  one of the six stores its **slot** beside the colour (`strokeSwatch` / `fillSwatch`, 1 to 6). A
  theme change re-derives a bound colour from the new theme's same slot, so a shape on "green" stays
  green in the new theme's tone. Arrows, which otherwise always snap back to the theme stroke on a
  theme change, keep a bound colour the same way. The binding is dropped the moment the colour is set
  any other way (the context menu's pickers, a preset, reset to theme), because the slot no longer
  describes it.
- Every swatch is named by a colour word ("Theme default", "Green", "Deep orange"), never a hex, for
  its tooltip and its accessible name.

## Multi-selection

The panel styles every selected shape and arrow at once, including mixed kinds: select three
arrows, two rectangles and a circle, press green, and all six turn green.

- A section shows when **at least one** selected element supports it, and a choice applies only to
  the elements that do.
- An option is **highlighted** when every supporting element has that value. When they disagree,
  nothing is highlighted: a mixed row claiming one value would be a lie.
- **Stroke style on a mixed selection** of shapes and arrows offers the shape row (Solid / Dashed /
  Dotted): each of those means something for both kinds (arrows draw dotted lines too), whereas
  Flowing means nothing for a shape. Flowing is offered when every style-supporting element is an
  arrow.
- **One undo step** per choice, however many elements it touched.
- Locked elements are left alone; a selection of only locked elements shows no panel.

## Style memory

Changing a quick-style field, through the panel **or** the context menu, remembers it for the next
element of the same kind you draw.

- **Per kind.** Colours, width, style, text alignment and icon alignment are remembered per element
  kind: a circle's carry to the next circle, not to a square. A diagram's notation is per kind (a
  diamond is a decision, a cylinder a store), so remembering across kinds would restyle shapes that
  mean something else. One rule for every field is also the one people can predict.
- **Arrows separately.** Arrows have their own memory, one bucket for all arrows: an arrow has no
  kinds.
- **Field by field.** Each field is remembered on its own, as the last value chosen for it on that
  kind. Choosing a background never carries a width you did not choose.
- **The label colour travels with the background.** A context-menu preset can pair a dark background
  with a white label; carrying the background without its label would land unreadable text on the
  next shape. So the label colour is remembered too, and a preset's binding with it, so a remembered
  preset look follows the theme like the preset does.
- **Theme defaults are not memories.** Setting a field back to the theme default forgets it, so a
  remembered "default" never pins one theme's colour onto a tab with another.
- **User-drawn elements only**: a shape placed from the palette (tap, drag-to-size, drag and drop), a
  shape recognised by the Shape Pen, an arrow drawn with the arrow tool, by click-to-connect, from a
  quick-connect plus, or chained with Shift. Paste, duplicate (including quick-connect Duplicate and
  Shift-drag), a forked arrow branch (it takes its trunk's look), templates, import, the MCP server
  and AI never read memory: they carry styles of their own, and applying memory to them would
  silently restyle content the user did not draw.
- **Per diagram, on this device.** Memory is kept in the browser (`localStorage`), keyed by diagram. It
  is not synced, not in the diagram, and not part of [User preferences](../007-editor/user-preferences.md):
  it is a working habit for one diagram's notation, like the panel layout is a habit for one screen.

## Clear styles

The Actions section's first button. It resets the selected elements' quick-style fields to the
diagram theme's default (stroke, background and label colour, width, style, text alignment, icon
alignment; on an arrow its stroke colour, width, style and flow) **and** forgets the memory of every
kind it touched, so the next shape of those kinds is the default again. A one-off style stays a
one-off: without the second half, clearing a shape would leave its style waiting in memory for the
next one. One undo step.

## The Actions section

Actions is the home for **quick actions** that prove, through telemetry or strong feedback, to be used
a lot and to fit better here than in the context menu because the panel is faster to reach. It grows
slowly and deliberately: an action joins only with that evidence, and only if it acts on the style of
the selection. Clear styles is the first action, because every restyle needs a way back.

## Accessibility

WCAG 2.2 AA.

- Each row is a **radio group** named by its section title; each option is a radio with its own
  accessible name. The arrow keys move between options and choose, per the radio-group pattern;
  Tab moves between rows.
- Every icon-only option has an accessible name and a **Tooltip** that repeats it (the name after a
  1 s hover, at once on keyboard focus, see
  [Tooltips, hover cards and popovers](../004-interface-design/README.md)).
- Focus is always visible. Options are at least 24 px targets.
- **Section titles are separate from the names**: a row's accessible name does not depend on its
  visible title, so hiding the titles (a Minimal chrome option in Power user mode may do this) is a
  clean toggle.
- **No layout shift.** Showing, hiding or re-placing the panel moves nothing else; it floats above
  the canvas.
- **Reduced motion**: the panel fades in within the `micro` budget ([Motion](../004-interface-design/motion.md)),
  and not at all under reduce motion.
- **Dark and light** both render correctly. The light look of every existing surface is unchanged.

## Telemetry

Per [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md), each panel choice emits
`Element·Changed` with its own token, distinct from the context menu's, so panel use can be read
against menu use (which is the evidence the Actions section asks for): `QuickStroke`,
`QuickBackground`, `QuickStrokeWidth`, `QuickStrokeStyle`, `QuickTextAlign`, `QuickIconAlign`, and
`QuickClearStyles`.

## Out of scope

- **Icon pinned to an edge.** A mode where the icon hugs the shape's left, top or right edge while the
  text aligns independently is attractive for cards. It needs an inscribed box per curved and slanted
  outline (circle, diamond, hexagon, cloud) so the icon stays inside the silhouette, which is real
  geometry work per kind. Today the icon and label form one group that text alignment moves together
  (`shape-inline-icon-layout.tsx`); pinning waits until that geometry exists.
- **Phones.** See above.
- **Styling non-shape elements** (stickies, text, tables). They have their own looks and their own menus.
- **Custom colours in the panel.** The OS picker, pipette and custom swatches stay in the context menu.

## Help

[Quick Style Panel](/help/canvas/quick-style-panel/) (Canvas).
