# Finish

A **finish** is the drawing style a tab's elements are rendered in: how their lines, corners, fills and lettering
look, independent of their colours. There are four:

| Finish           | Reads as                      | What it changes                                                                                                 |
| ---------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Flexible**     | Today's look (the default)    | Nothing: soft 8 px corners, 2 px lines, a soft default shadow on boxes, a peel under stickies                   |
| **Professional** | Crisp, print-ready            | Square corners, thin lines, Inter lettering, no default shadows, new arrows and mind maps drawn right-angled    |
| **Sketch**       | Drawn by hand on a whiteboard | Wobbly double-stroked outlines, pencil-shaded fills, a handwriting font, arrowheads drawn as two loose strokes  |
| **Marker**       | Drawn in felt-tip marker      | One bold, slightly see-through stroke per edge, darker where strokes cross, fills coloured in, marker lettering |

A finish is a look, never a type: switching it changes no stored geometry, colour or text, and switching back
restores exactly what was there.

## Where a finish comes from

- Every tab has a finish, `Tab.finish`, unset meaning **Flexible**.
- An element may carry its own, `finish` on the element, unset meaning **it follows its tab**.
- The finish an element is drawn in is its own when set, else its tab's, else Flexible. This one resolution
  (`resolveFinish` in `@liveplanner/project`) is read by the canvas and every export, so what is seen and what is
  exported agree.
- Changing a tab's finish restyles every element that follows it; an element with its own finish keeps it.

## What a finish changes

**A finish sets the defaults; what you pick on an element wins.** An explicit corner, border width, shadow, arrow
thickness, arrow style or font on an element is drawn as picked in every finish. A finish changes only what the
element leaves unset, plus how a line is drawn (Sketch, Marker).

### Professional

- **Corners:** an unset corner on a free-corner box draws square (0 px) instead of the kind's default (8 px for a
  shape, 12 px for a mind node, 4 px for an image, 10 px for a video) ([Corner radius](corner-radius.md)). Fixed
  silhouettes (the stadium's pill, the circle, an avatar's circle) keep their shape. The corner a kind is created
  with (a panel's, a card's, a banner's) is a default, not a pick, so it goes square too; a corner changed on the
  element wins.
- **Lines:** an unset border width draws at 1 px (Thin) instead of 2 px; an unset arrow thickness draws at 1 px.
- **Shadows:** the default soft shadow on boxed shapes and the paper peel under stickies are not drawn. An
  element's own shadow ([Element shadows](element-shadows.md)) still draws.
- **Icons:** a line-art icon without its own weight draws Thin (0.75 px) instead of Regular. A weight picked on the
  icon wins. Technology icons and stickers are full-colour art and draw as they are.
- **Lettering:** an element without its own font, on a tab without one, is written in Inter. A font picked on the
  element or the tab wins, except that Professional picked on the element itself (not followed from the tab) is
  more specific than the tab's font and writes it in Inter; the element's own font still wins over both.
- **Arrows:** a freshly drawn arrow whose style was not picked becomes a right-angled connector (Angled) instead of
  taking the draw-time avoidance curve ([Arrow collision avoidance](arrow-collision-avoidance.md)). It is an
  ordinary Angled arrow afterwards; arrows already on the tab keep their style.
- **Faces:** everything an element draws for itself (a Plan card and its column, a panel's rows, a concept
  graphic's bands and rings, a chart's bars, a web component's card, a button, an input, a chip) is squared and
  flattened the same way: every rectangle in it draws with square corners, its shadows and hover lift are not drawn,
  and its 2 px borders draw at 1 px. Circles, discs and true pills (avatars, toggles, status dots) keep their shape,
  since their roundness carries meaning. The canvas and every export agree.
- **Mind maps:** a mind map's connectors that are still in the map's default look (curved, never bowed or bent by
  hand) are drawn right-angled, as a neat bracket off each parent; the bubble flow draws them as straight spokes
  ([The mind node](../009-elements/mind-node.md) "Connectors"). It is drawn, not stored: switching back to
  Flexible or Sketch shows the curves again. A connector given a style, bow or bend of its own keeps it, and one
  given its own Flexible finish keeps its curve.

### Sketch

- **Outlines** of shapes (a Comment Panel's card included), frames, lanes, stickies and tables are drawn as two slightly different hand-drawn
  strokes: straight edges bow and overshoot their corners a little, curves wander. The wobble is seeded by the
  element's id, so an element looks the same on every screen, in every export and after every reload, and only
  changes when its size or kind does.
- **Fills** of shapes keep their solid colour, shaded over with faint diagonal pencil hatching in the outline colour,
  like coloured pencil on paper. The fill never goes away, so a label keeps the contrast it was coloured for on a
  light or a dark canvas. Every box with a body of its own is shaded (cards, panels, records, pages, lanes and
  frames included); stickies, tables and self-painting faces (charts, code blocks, concept graphics) are not, their
  own parts being their drawing.
- **Backdrops** keep a solid fill too: a shape that other elements sit on (another element drawn above it has its
  centre inside the shape, such as a flowchart key's card under its captions) is not shaded, so what sits on it
  stays readable. Only a shape that stands alone is shaded.
- **Lettering:** an element without its own font, on a tab without one, is written in the handwriting font
  (Caveat). A font picked on the element or the tab wins, so a typeface picked in Tab Style shows on a Sketch tab.
  Sketch picked on the element itself is more specific than the tab's font: that element is written by hand even
  on a tab with a typeface (Style → Finish on one heading of a Boardroom slide); its own font still wins. A code block keeps its monospace font.
  The face covers every word on the element, not only its label: a face that writes its own (a progress value, a
  panel's rows, a button, a picker) is lettered in it too, on the canvas and in exports. The same holds for a tab's
  font and Professional's Inter.
- **Arrows** are drawn as hand-drawn lines; a triangle, hollow triangle or line arrowhead is drawn as two loose
  strokes. Circle and diamond heads keep their shapes, because they carry meaning (UML composition, ER
  cardinality).
  Server-rendered PNG previews (the MCP's inline images, the CLI) letter every font in Inter, so there the
  hand-drawn lines carry the look and the lettering does not; browser exports use the real font.
- **Dashes:** a dashed or dotted border or arrow stays dashed or dotted, along the hand-drawn line.
- **Icons and stickers** (line-art icons, technology icons and stickers) keep their own art, drawn through the same
  hand-drawn wobble as the palette's Sketch tiles, so their lines tremble like pencil. The canvas and browser exports
  both draw it (an SVG displacement filter, defined once per export and only when something needs it).
- **Sequence diagrams** draw their participants' boxes and their message lines by hand too, since they are the
  same boxes and arrows the canvas draws ([The sequence diagram](../009-elements/sequence-diagram.md) "Look").
- **Every other face is drawn by hand too.** Whatever an element draws beyond its sketched body is split into two
  layers: charts, legends, progress, rating, checklists, code blocks, concept graphics, Sankey,
  badges, steps, cards, pointer notes, stacks, boundaries, diagram keys, people, web components, Plan boards,
  cards, views and sheets, collaboration panels, buttons, pickers, portals, a tab window's frame, link cards, a video's frame, annotation markers, a table's grid, a lane's gutter, a record's
  rows, a page's fold, a browser's chrome and an inline icon beside a label.
  - Its **ink** (fills, outlines, bars, discs, rules, glyphs) is drawn through the same wobble as icons.
  - Its **words** sit above the ink, crisp, in the element's font. The wobble mangles small figures ("4,000" reads
    "2,0/0"), so words never go through it; under Sketch they are already written by hand.

  The two layers line up exactly, so a face reads and behaves as in any finish: its controls are pressed and typed
  into as before. The ink is a still copy of the face, so a hover or press tint on a face's own control is not
  drawn on a Sketch tab. A face's own animations (a picker's spin) play in the copy in
  step with the live face: each new copy picks up each animation where the live one is, never from the start, so a
  face that keeps changing (a timer's countdown) does not drag its moving parts back. Photos inside a face (an avatar, a link card's preview, a video's poster) are not wobbled,
  and a tab window's content keeps the finish of the tab it shows. Exports draw the same two layers.
  A Plan board, view or sheet that fills its tab or is maximised is drawn over the canvas, outside its element's
  box, and keeps its finish there too: its face is split and wobbled as it is on the canvas.

- **In WebKit** (Safari, and every browser on an iPhone or iPad), which runs a live wobble filter again on every
  repaint (a pan at iPhone resolution took 220-400 ms a frame), the canvas draws no live wobble. Icons and stickers
  keep theirs, drawn once into a still picture and redrawn only when the art changes. A face is not split: it draws
  as it does under Flexible, its lettering in the handwriting font, inside its hand-drawn outline and shading. Other
  browsers and every export are unchanged.
- **Not affected:** freehand pen strokes and highlights (already hand-drawn) and images (photos, not drawings).
- **Selection, hit testing, anchors and snapping** use the element's true geometry, never the wobble, so a
  sketched element is selected, connected and aligned exactly as a Flexible one.

### Marker

Marker reads as a diagram drawn quickly and confidently on a whiteboard or flip chart with felt-tip markers. Where
Sketch is a pencil's wandering double line, Marker is one bold stroke per edge, laid down fast.

- **Outlines** of shapes (a Comment Panel's card included), frames, lanes and tables are drawn as one hand-drawn stroke per edge (never doubled):
  straight edges bow a little and run past their corners as a quick stroke does, curves drift, and a closed curve
  overlaps where it started. The wobble is seeded by the element's id, as Sketch's is, so an element looks the same
  everywhere and only changes when its size or kind does.
- **Ink:** marker ink is slightly see-through, so where two strokes cross (every corner, a circle's overlap, an
  arrowhead meeting its line) the ink is visibly darker, as real marker ink pools. A line on its own stays strong.
- **Line weight:** an unset or Thin border draws at 3 px, a marker's nib, and so does an arrow that is unset or 1 px
  wide: a marker has no fine-liner, and templates set Thin borders on purpose, so without this a template drawn in
  Marker would come out in fine lines. Medium and wider are drawn as picked, in the same ink.
- **Fills** of shapes are coloured in: the fill colour laid down in broad, overlapping back-and-forth marker
  strokes, their ends not quite meeting the outline, with the overlaps showing as faint darker streaks. The strokes
  overlap enough that no gap opens under a label, so a label keeps the contrast it was coloured for. Every box with a
  body of its own is coloured in, cards, panels, records, pages, lanes and frames included, and so is a shape
  something sits on: the streaks are light enough to read over, and one shape left solid beside a coloured one read
  as missed.
- **Shadows:** a marker drawing casts none, so the default soft shadow on boxes is not drawn. An element's own
  shadow still draws.
- **Stickies** stay paper: a sheet with its peel, no outline, its writing in marker (a sticky note on a wall is
  written on with a marker, never outlined), coloured in like any filled body in a deeper shade of its paper.
- **Lettering:** an element without its own font, on a tab without one, is written in Permanent Marker. The same
  precedence as Sketch: a font picked on the element or the tab wins, Marker picked on the element itself wins over
  the tab's font. A code block keeps its monospace font.
- **Arrows** are drawn as one hand-drawn stroke. A line arrowhead is one chevron stroke, a triangle a solid marker
  wedge with rounded corners, and a hollow triangle a closed outline the line stops short of. Circle and diamond
  heads keep their shapes, as under Sketch.
- **Dashes:** a dashed or dotted border or arrow stays dashed or dotted, along the marker line.
- **Icons** without their own weight draw Bold, a marker's line. Technology icons and stickers keep their art.
- **Faces: frames and shapes.** What an element draws for itself is drawn in marker where it is a frame or a shape:
  - A **frame** (a Plan card, a column, a panel, a web component's card, any outlined box inside a face at least
    `MARKER_FACE_FRAME_MIN_PX` on both sides) loses its own border and shadow and is outlined in one marker stroke
    per edge, its fill kept solid behind its words. The face's own box (a panel's, a banner's, a timer's), whichever
    part paints it, is coloured in as a shape's body is.
  - A **shape** (a concept graphic's band, tier, disc, ring or arc, a chart's bar, slice or ring, a Sankey's
    node) is coloured in and outlined in marker in its own colour: the outline in its stroke, or its fill when it
    has none, the colouring in streaks over its solid fill. A ring or arc drawn as a line is one bold marker
    stroke along it.
  - **Small parts** (chips, pills, badges, inputs, buttons, check boxes, glyphs, axes, grid lines, anything under
    the frame size) keep their plain look, so the words in and around them stay easy to read.
  - The marker strokes are seeded by the element's id and the part's place in it, so a face looks the same on
    every screen and in every export.
- **Not affected:** freehand pen strokes and highlights, images, photos inside a face, and a tab window's content (it keeps the
  finish of the tab it shows).
- **Selection, hit testing, anchors and snapping** use the element's true geometry, as under Sketch.

### Every hand-drawn finish

- **Pale lines:** a hand-drawn line too close to its own fill to read (a card's or a page's hairline grey on white,
  under a contrast ratio of 1.8) is drawn in a stronger shade of it, pulled 45% toward black on a light fill and
  toward white on a dark one; a body with no line of its own (a sticky) is coloured in a deeper shade of its fill.
- **Images** stay photos: under Sketch and Marker a hand-drawn line goes round one (a circle round an avatar), in
  its own line colour or the default ink; its picture is never shaded or wobbled.
- **Tables:** under Marker a table's grid is drawn as whole rules, one marker stroke per row and column line. A
  spreadsheet's working grid scrolls, so it keeps its plain lines inside its marker frame.

### Stickers

A sticker's emoji or word is art and is drawn as it is in every finish; its plate (the white die-cut tile, a badge's
coloured pill) follows the finish like any frame: square and flat under Professional, outlined in marker with no
shadow under Marker (a badge's pill coloured in), wobbled with its art under Sketch. Exports agree.

### Polygons

A polygon is a freehand stroke with `straightEdges` (from a template, an import or the MCP; liveplanner has no
Polygon tool): its points are joined by straight segments, not smoothed. It is placed point by point, so it is a drawing like a shape's
outline, not a hand's stroke, and follows its tab's finish as a shape does:

- **Professional:** an unset line draws Thin (1 px).
- **Sketch:** the line is drawn by hand (two wobbly strokes, seeded by the element's id); a closed one keeps its
  solid fill under pencil shading.
- **Marker:** the line is one bold marker stroke, an unset or Thin one at the nib; a closed one is coloured in over
  its solid fill.
- Other freehand strokes (a template's or an import's pen strokes and highlights) are already hand-drawn and stay
  as drawn in every finish.

### Flexible

Draws exactly as liveplanner did before finishes existed.

## Where it is set

- **Element menu, Style section:** a **Finish** category (closed by default, like every menu section) holding a
  full-width option list in the Plan style ([Plan board](../026-plan/plan-board.md) "Option lists"), one row per
  choice with its glyph, name and a short line: **Follow Tab** (As the tab is), **Flexible** (Soft and rounded),
  **Professional** (Square and fine), **Sketch** (Drawn by hand), **Marker** (Bold felt-tip). Follow Tab clears the element's own finish.
  Hovering a tile previews it on the selection; clicking commits it as one undo step. The category shows for
  shapes, arrows, text, stickies and tables, and in the multi-selection menu when the selection holds any of
  them (the commit then sets every one of them).
- **Tab style:** the **Finish** panel (a Fine-tune row of the dialog's home, beside Colours, Text and Canvas, [Canvas + Theme dialog](../011-theme/canvas-and-theme-dialog.md)), and every **Look** sets a finish, with the four finishes as tiles, a
  **Preview** under them showing a small sample diagram (a step, a decision, the arrow between them and a sticky
  note) in the chosen finish on the tab's own background and font. Picking a finish applies to the whole tab at once: every
  element's own finish on the tab is cleared so they all follow it again.
- **New tabs** start Flexible. Duplicated and imported tabs keep their finish.
- **Agents (MCP):** `create_project` and `add_tab` take an optional `finish`; an element's `finish` is an
  ordinary element field agents may set.

## Where it shows

- **The canvas and every export** (SVG, PNG, PDF, thumbnails, the Map, live images) draw each element in its finish.
- **Plan surfaces:** a board, view or sheet, on the canvas, filling its tab or maximised, and a Dashboard tab's page
  (drawn over the canvas, outside any element) take their tab's finish and lettering. One that fills its tab or the
  screen is the page itself: its contents follow the finish, its own background stays plain. Sketch's handwriting is
  lifted to the UI face's x-height on these compact surfaces; Marker's lettering is drawn at its own size (it has no
  true lowercase, so brought down it read too small).
- **The palette** previews the tab's finish on every tile, the sticker picker's included: under Professional the
  glyphs are square and fine, under Sketch they are drawn wobbly and doubled, under Marker they are drawn bold with round ends. Full-colour art (technology icons,
  stickers) keeps its weight under Professional, as on the canvas, and wobbles under Sketch.
  Under Sketch the tiles **fade in** where the other finishes pop in: a glyph drawn through the sketch filter, inside
  a tile scaling up from nothing, could stay rasterised at its early size and show as a blurred square.

## Share roles

| Role            | Finish                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------- |
| **Editor**      | Sets a tab's finish and an element's finish                                               |
| **Participant** | Sees elements in their finish; never changes one (a finish restyles the board, a setting) |
| **Viewer**      | Sees elements in their finish                                                             |

The element menu is not offered to a Participant or Viewer, and the Tab style setters are blocked for
both, so neither control is reachable. A Participant's element ops cannot carry `finish` (it is not in the
Participant's writable fields).

## Telemetry

- `Tab · Changed · Finish` when a tab's finish changes.
- `Element · Changed · Finish` when an element finish is committed.

## Performance

Sketch geometry is computed from an element's kind, size and border, never from its position, so moving an element
does not recompute it; it is memoised per element view. Finding backdrops is one sorted sweep over the tab, run
only when something on it is sketched (0.7 ms for 2,000 elements), and an element view re-renders only when its
own backdrop flag flips. Generating one element's strokes and hatching stays under
0.2 ms at worst-case sizes, so a 500-element sketched tab costs under 100 ms to draw from cold and nothing per
drag frame for unmoved elements ([Canvas performance](canvas-performance.md)).
Marker is held to the same budgets: it computes from the same inputs, is memoised the same way, and draws at most
five paths per body with no filter, so it costs about what Sketch does.

A sketched face costs one still copy of its DOM, taken once it settles (so a zoom, which restyles faces every
frame, copies each once afterwards), and one light wobble filter. On a Sketch tab of 200 charts, copying every face
takes 6-14 ms, a pan costs nothing, and a zoom keeps every task under 50 ms; the icons' heavier two-pass wobble
broke that budget on faces, so faces take one pass. WebKit is the exception: it re-runs a live filter on every
repaint wherever it is layered, so there the wobble is drawn into still pictures (icons and stickers) or left out
(faces), and a Sketch pan costs what a Flexible one does.
