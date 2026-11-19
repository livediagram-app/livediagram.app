# SVG import

An SVG brought into livedesign arrives as **editable shapes**: every drawn element of the file becomes a
[path element](../023-draw-mode/path-tool.md) of cubic Béziers, recoloured, reshaped and combined like anything
drawn with the Pen. livedesign exports SVG everywhere (pages, the Logo Kit); this is the way back in, so a logo,
icon or brand mark a client hands over is a starting point rather than something to trace by hand. Figma, Penpot,
Affinity and Inkscape all open an SVG this way.

Only a file too big to bring in as shapes is still placed as a **picture**, through the
[Import image pipeline](import-image-pipeline.md).

## Where an SVG comes in

Three routes, one importer:

- **Import to Tab**: the dialog offers **SVG** beside JSON. Its panel takes pasted markup or a picked `.svg` file.
  Unlike JSON, an SVG **adds** to the tab rather than replacing it. The format grid's amber warning speaks for JSON
  only (_A JSON import replaces everything on <tab> with the imported content._), and the SVG panel swaps it for a calm
  note: _The shapes land on the page you are on, fitted to it._ When the import leaves something out, the dialog shows the
  import report (below) in place of closing.
- **Drop** an `.svg` file (or any file the browser types `image/svg+xml`) on the canvas.
- **Paste** an SVG file, or SVG markup copied as text (a design tool's "Copy as SVG", a code editor), onto the
  canvas. Text counts as SVG when, after leading whitespace, an XML declaration or comments, it opens with `<svg`.

Drop and paste follow the canvas's existing gates exactly (read-only, a blocked creation layer, embeds), so the share
roles are the paste and drop roles: an Editor may bring an SVG in; a Viewer may not; a Participant may exactly where
they may paste. Import to Tab keeps the tab menu's own gate, and refuses a locked tab as a JSON import does.

## Where the shapes land

- **Selected and fitted to the page.** The shapes land on one page: the page under the drop point; else the page
  someone is on; else the page nearest the middle of the view. The whole import is scaled uniformly (up or down) so its
  drawn box fills the page's safe area (the page less its margin), and centred in it. The drawn box counts each
  stroke's own width (half of it either side of the line), so a stroked icon fills the page with its lines inside the
  margin. Every new path is selected, so the next move (recolour, nudge, combine) takes them all.
- **Bold strokes become filled shapes.** Strokes snap to presets, and the thickest is Extra thick (7 px), so a 24 px
  line icon blown up to fill a logo page could not keep its weight as a stroke. Every stroke that would land wider
  than 7 px is outlined instead: it becomes a filled path in the stroke's colour, the exact area the stroke paints
  (its line caps, line joins and miter limit honoured), within 0.25 px. The icon lands at the full fit with its
  source proportions. Strokes that land at 7 px or less stay strokes, editable as lines. An element with a fill and an
  outlined stroke lands as two paths, its fill below its outline. A stroke too detailed to outline as one path (its
  traced outline would carry more than four points for each node a path may hold) stays a stroke, decided before any
  outlining work, so a very detailed file imports at once rather than stalling.
- **One path per SVG element.** Each `<path>`, `<rect>`, `<circle>`, `<ellipse>`, `<line>`, `<polyline>` and
  `<polygon>` becomes one path element; a `<use>` of one of them inside the file becomes one more.
- **The file's groups.** livedesign has no groups ([Web components are elements; groups are
  gone](../009-elements/web-components-and-no-groups.md)), so the file's `<g>` structure is kept the way the canvas can
  keep it: each group's members stay together and in the file's order in the stacking, and a group's transform,
  opacity and inherited style (fill, stroke, colour) reach every member.
- **One undo step.** The import is one commit, undone with one undo.

## Geometry

- **Everything becomes cubics within 0.25 px** of the source at its landed size. Lines stay straight segments
  (nodes without handles); quadratic curves are raised to cubics exactly; arcs (`A`), circles, ellipses and rounded
  rectangles are split into arc pieces of at most 90 degrees, more where the radius is large, so no piece strays more
  than 0.1 px. Transforms (`matrix`, `translate`, `scale`, `rotate`, `skewX`, `skewY`, nested to any depth, and the
  root's `viewBox`) are applied to the points themselves, which maps cubics exactly.
- **Nodes.** A node whose two handles point straight through it is `aligned` (or `mirrored` when the handles are
  equal), so the Pen edits a smooth curve as smooth; every other node is a `corner`.
- **Several contours** in one element (a letter O, a ring, a cut-out) become one path's subpaths, filled even-odd,
  the same shape Combine produces ([Logo pages](../007-editor/logo-pages.md) "Combine").
- **Nonzero fills match the source.** SVG fills `nonzero` by default; livedesign paths fill even-odd. Where the two
  agree (contours that alternate direction as they nest, as fonts and almost every icon are drawn), the curves are
  kept as they are. Where they differ (overlapping contours drawn the same way, a hole drawn the same way as its
  outline), the element's area is resolved through Combine's boolean engine (`lib/combine`): each contour is added
  where the winding just inside it is nonzero and cut where it is zero, largest first, and the result is a path of
  corner nodes traced within 0.25 px. `fill-rule="evenodd"` is kept as it is.
- **Open and closed.** A filled element is closed (SVG fills an open contour as if closed). An unfilled one is closed
  when every contour ends in `Z`; otherwise it is open, and its closed contours are drawn closed by a final node back
  at their start.

## Style

- **Fill and stroke** come from presentation attributes, the `style` attribute and the file's `<style>` rules
  (simple selectors only: a tag, `.class`, `#id`, comma lists; anything else is ignored), with SVG's inheritance:
  `<style>` beats an attribute, `style` beats both, and an element inherits what it does not set. `currentColor`
  takes the inherited `color`. Colours are read in hex (3, 4, 6 and 8 digits), `rgb()`/`rgba()`, `hsl()`/`hsla()`,
  the CSS named colours and `transparent`, and stored as six-digit hex.
- **Stroke width** is the stroke's landed width snapped to the nearest of the five presets (None, Thin, Medium,
  Thick, Extra thick). A stroke past Extra thick is outlined (above), so no stroke is capped below its source weight.
  A path with no stroke stores None, so the theme's line is never drawn round a filled mark.
- **Line caps and joins** (`stroke-linecap`, `stroke-linejoin`, `stroke-miterlimit`, inherited like the stroke) shape
  an outlined stroke: butt, round and square caps (a zero-length line with a round or square cap paints a dot);
  miter, round and bevel joins, a miter past its limit (SVG's default 4) drawn bevelled, and SVG 2's `miter-clip` and
  `arcs` drawn as miter. A stroke that stays a stroke takes the canvas's own caps and joins.
- **Opacity**: the element's `opacity`, multiplied down its groups, times its `fill-opacity` (its `stroke-opacity`
  when it has no fill), stored as the path's opacity.
- **Gradients take their first stop**: a fill or stroke of `url(#gradient)` takes the gradient's first stop colour
  (following `href` to a gradient that holds the stops). A `url()` to anything else (a pattern) takes its fallback
  colour when the value gives one (`url(#p) red`), and is otherwise left unpainted.
- **Hidden**: `display="none"`, `visibility="hidden"`, an element with neither fill nor stroke, and everything inside
  `<defs>`, `<symbol>` (unless used), `<clipPath>`, `<mask>`, `<pattern>` and `<marker>` draws nothing and lands
  as nothing.

## The import report

What the shapes cannot carry is listed, never silently lost. The report counts, per kind, what it met:

| Kind       | Sentence                                                                          |
| ---------- | --------------------------------------------------------------------------------- |
| Text       | _N text elements were left out. Outline the text before exporting, or retype it._ |
| Gradients  | _N gradient fills use their first colour._                                        |
| Masks      | _N masks were ignored, so what they hid is shown._                                |
| Filters    | _N filters (shadows, blurs) were left out._                                       |
| Clip paths | _N clip paths were ignored, so what they cut is shown in full._                   |
| Pictures   | _N embedded pictures were left out._                                              |
| Patterns   | _N pattern fills were left out._                                                  |

Import to Tab shows it in the dialog's report (the [Import image pipeline](import-image-pipeline.md)'s calm
"Import complete" panel, one line per kind met). Drop and paste show it as one toast: _Brought in 12 shapes._
followed by the sentences.

## Trust and limits

An SVG is an untrusted file. It is **parsed only through `parseInert`**
([Trusted types](../016-platform/trusted-types.md)): the document is inert, nothing in it runs or loads, and nothing
of it is ever inserted into the page. The importer reads geometry and paint from it and builds new elements; it
never copies markup.

- `<script>`, `<foreignObject>`, `<iframe>`, `<image>`, `<audio>`, `<video>` and event attributes are never read.
- A reference (`href`, `xlink:href`, `url()`) is followed only to an element **inside the file** (`#id`); one to
  anything outside (`http:`, `data:`, another file) is dropped.
- A `<use>` is followed at most **8 deep**, and a use that reaches itself stops.
- A file the parser refuses (not well-formed XML, no `<svg>` root) fails calmly: _This file isn't an SVG we can
  read._

**Falls back to a picture** when the file is over **2 MB**, holds over **5,000 elements**, would make a path of over
5,000 nodes, or would take the tab past its element limit. The picture goes through the
[Import image pipeline](import-image-pipeline.md) (rasterised as before), placed as a dropped picture would be, and a
toast says why: _This SVG is too large to bring in as shapes, so it was placed as a picture._ Path data is read by a
left-to-right tokenizer that never backtracks, and every walk is bounded by the element count, so the worst file
the limits admit is read in linear time.

## Observability

One `[svg-import]` line per import: the route (`dialog`, `drop`, `paste`), the outcome (`shapes`, `picture`,
`unreadable`), the elements, paths and nodes made, how many elements were resolved nonzero, how many strokes were
outlined, and the report's counts.

## Non-goals

- Text as editable text (outline it first; the report says so).
- Gradients, masks, filters and clip paths as live effects.
- Editable groups (the editor has none).
- Markers and `stroke-dasharray` patterns beyond solid (an outlined dashed stroke is outlined solid).
- Outlined strokes as editable lines again (outlining is what lets a bold icon fill the page; a stroke that fits the
  presets is never outlined).
