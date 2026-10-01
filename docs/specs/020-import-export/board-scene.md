# Board scene

A **board scene** is the one source-neutral picture of a board that every
"bring a board from another tool" path reduces to: Excalidraw copied to the
clipboard ([Excalidraw import & export](excalidraw-import-export.md)), an
Excalidraw file, and a Microsoft Whiteboard board
([Microsoft Whiteboard import](whiteboard-import.md)). A parser turns its
source into a scene; **one landing** turns the scene into livediagram
elements. No parser emits livediagram elements itself, so the rules below hold
for every source alike, and anything a source needs that the whiteboard lacks
is a change here, never a parser-local workaround.

Content that lands on a whiteboard looks and behaves as if it had been drawn
there: marker strokes with pressure, ink and stock colours that follow light
and dark boards, text boxes that hug their text, stickies, shapes, lines,
arrows, images and frames. See [Whiteboard](../023-whiteboard/whiteboard.md)
"Imported and pasted content".

## Where it lives

`apps/live/lib/board-scene/`, a folder of small pure modules (no DOM, no
React), consumed only by the live editor:

- `scene.ts`: the scene's types, the contract every parser codes against.
- `land.ts`: `landBoardScene(scene, options)`, the landing.
- One module per concern beside it (colours, widths, text, per-kind landing,
  placement, report), each unit-tested in Node.

The editor wiring (paste, the Import dialog's commit paths, the paste notice)
lives in hooks and components, see "In the editor" below.

## What a scene is

- **Items**, back to front: `ink` (a freehand stroke: points with optional
  pressure), `polyline` (a line or polygon through points, optionally curved,
  closed, filled, with heads), `shape` (rectangle, ellipse, diamond, triangle,
  with an optional label), `connector` (an arrow between points, optionally
  bound to other items at either end, with heads and a label), `text`,
  `sticky`, `image` (naming an asset) and `frame`. Every item carries a `key`
  unique in its scene, an optional rotation (degrees, clockwise), lock and link.
- **Assets**: the bytes of each image, as a `data:` URL or raw bytes with a
  MIME type, keyed for the items that name them.
- **Notes**: what the parser could not bring across as it was, each a rule (a
  short user-facing sentence) and a count, marked **degraded** (it arrived, with
  a documented loss) or **skipped** (it did not arrive).
- **Source**, an optional **title**, what appearance the author worked on
  (`authoredOn`), and an optional **background** (appearance, pattern, colour).
- **Coordinates** are canvas px; a `widthPx` is the line's drawn width at
  medium pressure in canvas px; a `fontPx` is the rendered font size in canvas
  px. A parser converts its source's units to these.
- **Colours are light-reference**: a colour is what the author's line looks
  like on a light board. Excalidraw stores light-mode colours always (its dark
  mode inverts the canvas when drawing); a parser whose source records colours
  as seen on a dark board converts them. `'ink'` names the board's own ink
  outright.

## Profiles

The landing has two profiles, chosen by the tab the scene lands on:

- **Whiteboard**: whiteboard-native marks, the rules below.
- **Diagram**: the Excalidraw file mapping (size buckets, freedraw as a pencil
  freehand, multi-point lines as straight-edged freehands). Colours: near-black
  ink (the ink rule under Colours) lands as the **theme's ink** (no colour of its
  own, so it follows the tab's theme), every other colour as its **exact hex**,
  never a stock name; fills stay exact.

## Colours

Each scene colour resolves to one of three things, in this order:

1. **Ink**: a near-black, near-neutral colour (OKLCH lightness at most
   `INK_MAX_LIGHTNESS`, chroma at most `INK_MAX_CHROMA`), or `'ink'` itself.
   It lands **unset**, so the board's own ink shows: dark on the light board,
   light on the dark one. Excalidraw's `#1e1e1e` is ink.
2. **A stock colour**: a clearly coloured line colour (chroma at least
   `STOCK_MIN_CHROMA`, lightness inside `STOCK_LIGHTNESS_RANGE`) whose OKLCH
   hue lies within `STOCK_HUE_TOLERANCE_DEG` of a stock colour's hue (the
   nearest one wins). It lands **by name** (Blue, Red, Orange, Green, Teal,
   Violet, Pink), so it is drawn in the version tuned for each viewer's board.
   Excalidraw's blue, green, red and orange are stock colours.
3. **Its hex**: anything else keeps its exact `#rrggbb`, a custom colour, the
   same on both boards (Excalidraw's grey `#868e96`, pastels, browns).

- A colour's `alpha` multiplies into the element's opacity; a colour with no
  alpha is opaque.
- **Fills**: no fill, or a fill with alpha 0, lands unfilled. A **sticky's**
  fill lands as the nearest sticky preset's paper (OKLab distance) with that
  preset's readable ink for its text, so a note keeps its note colours. Every
  other fill keeps its hex: fills are washes, never adaptive ink.
- **Text on a fill keeps its exact colour.** A label on a filled shape, and a
  sticky note's own text colour, lands as its hex, never as ink or a stock
  name: the fill is the same on both boards, so text that adapted (black ink
  turning light on the dark board) would vanish into it.
- Where a kind has no named field for a role, a stock colour lands as its
  light-board version's hex.

## Widths

- **Ink** takes the nearest marker width (Fine, Medium, Bold), nearest by ratio.
- **Shapes and frames** take the nearest border width
  (`nearestBorderStroke`); a shape with no stroke has no border.
- **Lines, paths and arrows** take the nearest border width, an arrow stored as
  that preset's px.
- Dashed and dotted lines stay dashed and dotted; ink has no dash and lands
  solid (degraded: "Dashed pen strokes drawn solid").

## Text

- A **text item** lands as a whiteboard text box: its width per the source
  (an auto-sized source text widens with its words, `autoWidth`), its height
  hugging its lines once laid out in our fonts (see "In the editor").
- **Font size** survives exactly: the nearest size preset (Small, Medium,
  Large) by ratio, times a text scale for the rest, within the text box's
  scale limits. Labels of shapes, stickies and arrows take the nearest preset.
- **Families**: hand-drawn fonts land in Caveat, code fonts in Roboto Mono,
  serif in Lora; sans-serif takes the board's own font.
- Alignment, bold, italic, underline and strikethrough land as they are.

## Kinds

| Scene item | Whiteboard profile                                                                                                                                                                                                       | Diagram profile                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| ink        | A marker stroke: its points, pressures when every point has one, its streamline (none when the source gives none), colour, width; a closed stroke returns to its start; a highlighter stroke lands as a highlighter mark | A pencil freehand, closed when it ends where it started |
| polyline   | With heads: an arrow. Two points: a line (an arrow with no heads). Three or more: a path, corners or (curved) smooth nodes, closed with its fill                                                                         | Two points: a line; more: a straight-edged freehand     |
| shape      | A shape (rectangle, ellipse, diamond, triangle; rounded corners kept), its border and fill, its label                                                                                                                    | The same shape, ink as the theme's, other colours exact |
| connector  | An arrow: each end pinned to the item it is bound to (the nearest anchor) when that item landed as a box, else free; its heads, label; bends as a curve                                                                  | The same                                                |
| text       | A text box that hugs its text                                                                                                                                                                                            | A text element                                          |
| sticky     | A sticky note in the nearest sticky preset, with its text                                                                                                                                                                | A sticky note, its fill verbatim                        |
| image      | An image placeholder, filled through the [Import image pipeline](import-image-pipeline.md); a cropped image covers its box                                                                                               | The same                                                |
| frame      | A frame titled with its name, in the palette frame's title look (top right, padded); unnamed, "Frame"                                                                                                                    | The same                                                |

- **Heads**: arrow (an open V), triangle, hollow triangle, circle, hollow
  circle, diamond, hollow diamond; a bar lands as an open V (degraded: "Bar
  arrowheads drawn as open arrowheads"). An arrow with two different heads uses
  its end's (degraded: "Arrows with two different heads use one").
- **Bends**: an arrow through more than two points is drawn as a smooth curve
  through them; a sharp-cornered one says so (degraded: "Bent arrows drawn as
  curves").
- **Multicolour ink** lands in the one colour its parser picked as
  representative (its stroke colour, the stops kept on the item; the parser
  reports it in its own words, e.g. "Rainbow ink drawn in pink"); when the
  parser picked none (the ink), in its first stop (degraded: "Multicolour ink
  drawn in one colour").
- **Filled ink** lands without its fill (degraded: "Filled pen strokes drawn
  without their fill").
- **Very long strokes** (more points than a stroke or path holds) are sampled
  evenly along their length, both ends kept (degraded: "Very long strokes were
  simplified").
- **Rotation** carries over on every boxed kind and on strokes and paths; an
  arrow's points are turned by it instead.
- **Links** are kept when they are web or email addresses (http, https,
  mailto); any other link is dropped (degraded: "Links that aren't web
  addresses were dropped"), so a pasted board can never carry a script link.
- **Locks** are kept.
- **Z-order** is the scene's order: back to front, arrows among the rest.
- **Ids** are minted fresh per landing, with a map from item keys, so bindings
  follow and nothing collides with what is already on the board.

## Placement

- **At a point** (a paste or a drop): the scene's bounds are centred on the
  point: where a file is dropped, or the canvas menu's Paste was opened, else
  the pointer when it is over the canvas, else the viewport's centre.
- **At the origin** (an import filling a tab): the scene's coordinates are the
  tab's, unchanged; the editor then frames the tab.

## The tab

A landing also says what the tab it fills should be: on the whiteboard
profile, `kind: 'whiteboard'`, its background pattern from the scene
(Plain, Dots, Grid), else the new-board default (Grid), and its name from the
scene's title, else "Whiteboard"; on the diagram profile, the scene's
background colour, when it has one.

## The report

Every landing returns a report: counts per landed kind, and every **degraded**
and **skipped** rule with its count, the parser's notes and the landing's
together (same rule, counts added). Images add the
[Import image pipeline](import-image-pipeline.md)'s own counts. Nothing is
lost silently: each item lands, or lands with a degraded rule, or is counted
under a skipped rule.

| Kind      | Counted as   |
| --------- | ------------ |
| ink       | pen strokes  |
| polyline  | lines        |
| shape     | shapes       |
| connector | arrows       |
| text      | text boxes   |
| sticky    | sticky notes |
| image     | images       |
| frame     | frames       |

## Limits and rejections

- A scene with more items than the tab has room for (`MAX_ELEMENTS_PER_TAB`
  less what the tab already holds) is refused whole, `too-many-elements`:
  "This board has more than the 10,000 elements a tab can hold." Nothing lands.
- An item with no usable geometry (no points, a non-finite coordinate, a
  zero-sized box) is skipped and counted ("Elements without a size were
  skipped"), never thrown.
- The landing never throws; it returns `{ ok: false, rejection }` or the
  landed result.
- Size caps on the raw input (the clipboard's 4 MB) are the parsers', checked
  before parsing.

## In the editor

- **Paste or drop** (insert at a point): one undo step; the images go through
  the [Import image pipeline](import-image-pipeline.md) first (insert mode: the
  board is not replaced), then the elements land at once, **selected**, with
  their text boxes hugging their text in our fonts. While images upload, the
  paste notice says "Pasting images 3 of 12…". A paste whose tab is left while
  its images upload belongs to that tab, so it does not land on another.
- **Import a board** (the Import dialog): replace the active tab (the
  Excalidraw card, one undo step), or make each board **its own new document**
  with one whiteboard tab (the Microsoft Whiteboard card), named after the board
  and dated as it (the scene's `createdAt` / `modifiedAt`; a date that cannot
  be read is left out, so the document is dated today, and the report says so:
  "Board dates that couldn't be read were set to today"). An untitled board is
  named "Whiteboard, 14 Aug 2020" after its created date, or "Whiteboard"
  without one. Images and the report are combined across the boards; a board
  that cannot land is listed with its reason. Each new document counts as
  `Document · Created · Cloud` (or `Offline`) and `Whiteboard · Created ·
Import`; the open document is not touched.
- **The paste notice**: after a paste that degraded, skipped or left an image
  as a placeholder, a small non-blocking notice (`role="status"`) says so; a
  lossless paste shows nothing. It has **its own slot just above the
  whiteboard dock**, so it never covers the dock at any width; with no dock it
  takes the slot a dock would have (above the bottom-right controls' line).
  It floats, so showing it moves nothing. Copy:
  - Heading: "Pasted from Excalidraw with some changes" (the source's name).
  - One line per rule, the count first: "2 · Groups were dropped".
  - Image placeholders as the image pipeline words them.
  - A refused paste (too big for the tab) says "Couldn't paste from Excalidraw"
    and the rejection's sentence.
  - A Close button ("Close", Escape when focused). It stays until closed,
    replaced by the next paste's, or the tab changes: it never times out under
    the reader.

## Observability

- `[board-scene] landed` once per landing: source, profile, placement kind,
  item count, landed counts, degraded and skipped rules with counts.
- `[board-scene] rejected` with the rejection name and the item count.
- `[board-scene] skipped` once per skipped rule with its count.

## Non-goals

- Groups (livediagram has none; a parser drops them and says so).
- Rough (sketchy) rendering and hatched or cross-hatched fills.
- Keeping a landed board in sync with its source.
