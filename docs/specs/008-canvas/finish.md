# Finish

A **finish** is the drawing style a tab's elements are rendered in: how their lines, corners, fills and lettering
look, independent of their colours. There are three:

| Finish           | Reads as                      | What it changes                                                                                                |
| ---------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Flexible**     | Today's look (the default)    | Nothing: soft 8 px corners, 2 px lines, a soft default shadow on boxes, a peel under stickies                  |
| **Professional** | Crisp, print-ready            | Square corners, thin lines, Inter lettering, no default shadows, new arrows drawn right-angled                 |
| **Sketch**       | Drawn by hand on a whiteboard | Wobbly double-stroked outlines, pencil-shaded fills, a handwriting font, arrowheads drawn as two loose strokes |

A finish is a look, never a type: switching it changes no stored geometry, colour or text, and switching back
restores exactly what was there.

## Where a finish comes from

- Every tab has a finish, `Tab.finish`, unset meaning **Flexible**.
- An element may carry its own, `finish` on the element, unset meaning **it follows its tab**.
- The finish an element is drawn in is its own when set, else its tab's, else Flexible. This one resolution
  (`resolveFinish` in `@livediagram/document`) is read by the canvas and every export, so what is seen and what is
  exported agree.
- Changing a tab's finish restyles every element that follows it; an element with its own finish keeps it.

## What a finish changes

**A finish sets the defaults; what you pick on an element wins.** An explicit corner, border width, shadow, arrow
thickness, arrow style or font on an element is drawn as picked in every finish. A finish changes only what the
element leaves unset, plus how a line is drawn (Sketch).

### Professional

- **Corners:** an unset corner on a free-corner box draws square (0 px) instead of the kind's default (8 px for a
  shape, 12 px for a mind node) ([Corner radius](corner-radius.md)). Fixed silhouettes (the stadium's pill, the
  circle) keep their shape.
- **Lines:** an unset border width draws at 1 px (Thin) instead of 2 px; an unset arrow thickness draws at 1 px.
- **Shadows:** the default soft shadow on boxed shapes and the paper peel under stickies are not drawn. An
  element's own shadow ([Element shadows](element-shadows.md)) still draws.
- **Icons:** a line-art icon without its own weight draws Thin (0.75 px) instead of Regular. A weight picked on the
  icon wins. Technology icons and stickers are full-colour art and draw as they are.
- **Lettering:** an element without its own font, on a tab without one, is written in Inter. A font picked on the
  element or the tab wins.
- **Arrows:** a freshly drawn arrow whose style was not picked becomes a right-angled connector (Angled) instead of
  taking the draw-time avoidance curve ([Arrow collision avoidance](arrow-collision-avoidance.md)). It is an
  ordinary Angled arrow afterwards; arrows already on the tab keep their style.

### Sketch

- **Outlines** of shapes, frames, lanes, stickies and tables are drawn as two slightly different hand-drawn
  strokes: straight edges bow and overshoot their corners a little, curves wander. The wobble is seeded by the
  element's id, so an element looks the same on every screen, in every export and after every reload, and only
  changes when its size or kind does.
- **Fills** of shapes keep their solid colour, shaded over with faint diagonal pencil hatching in the outline colour,
  like coloured pencil on paper. The fill never goes away, so a label keeps the contrast it was coloured for on a
  light or a dark canvas. Stickies, frames, lanes, tables, charts and code blocks take no shading: a note or a
  container with lines behind its writing is harder to read.
- **Backdrops** keep a solid fill too: a shape that other elements sit on (another element drawn above it has its
  centre inside the shape, such as a flowchart key's card under its captions) is not shaded, so what sits on it
  stays readable. Only a shape that stands alone is shaded.
- **Lettering:** an element without its own font, on a tab without one, is written in the handwriting font
  (Caveat). A font picked on the element or the tab wins, so a typeface picked in Tab Style shows on a Sketch tab. A code block keeps its monospace font.
- **Arrows** are drawn as hand-drawn lines; a triangle, hollow triangle or line arrowhead is drawn as two loose
  strokes. Circle and diamond heads keep their shapes, because they carry meaning (UML composition, ER
  cardinality).
  Server-rendered PNG previews (the MCP's inline images, the CLI) letter every font in Inter, so there the
  hand-drawn lines carry the look and the lettering does not; browser exports use the real font.
- **Dashes:** a dashed or dotted border or arrow stays dashed or dotted, along the hand-drawn line.
- **Icons and stickers** (line-art icons, technology icons and stickers) keep their own art, drawn through the same
  hand-drawn wobble as the palette's Sketch tiles, so their lines tremble like pencil. The canvas and browser exports
  both draw it (an SVG displacement filter, defined once per export and only when something needs it).
- **Not affected:** freehand strokes (already hand-drawn), images, and the faces of self-painting elements
  (charts, checklists, progress, code) other than their lettering.
- **Selection, hit testing, anchors and snapping** use the element's true geometry, never the wobble, so a
  sketched element is selected, connected and aligned exactly as a Flexible one.

### Flexible

Draws exactly as livediagram did before finishes existed.

## Where it is set

- **Element menu, Style section:** a **Finish** category (closed by default, like every menu section) holding a
  full-width option list in the Plan style ([Plan board](../026-plan/plan-board.md) "Option lists"), one row per
  choice with its glyph, name and a short line: **Follow Tab** (As the tab is), **Flexible** (Soft and rounded),
  **Professional** (Square and fine), **Sketch** (Drawn by hand). Follow Tab clears the element's own finish.
  Hovering a tile previews it on the selection; clicking commits it as one undo step. The category shows for
  shapes, arrows, text, stickies and tables, and in the multi-selection menu when the selection holds any of
  them (the commit then sets every one of them).
- **Tab style:** the **Finish** panel (a Fine-tune row of the dialog's home, beside Colours, Text and Canvas, [Canvas + Theme dialog](../011-theme/canvas-and-theme-dialog.md)), and every **Look** sets a finish, with the three finishes as tiles, a
  **Preview** under them showing a small sample diagram (a step, a decision, the arrow between them and a sticky
  note) in the chosen finish on the tab's own background and font. Picking a finish applies to the whole tab at once: every
  element's own finish on the tab is cleared so they all follow it again.
- **New tabs** start Flexible. Duplicated and imported tabs keep their finish.
- **Agents (MCP):** `create_document` and `add_tab` take an optional `finish`; an element's `finish` is an
  ordinary element field agents may set.

## Where it shows

- **The canvas and every export** (SVG, PNG, PDF, thumbnails, the Map, live images) draw each element in its finish.
- **The palette** previews the tab's finish on the tiles that place elements with one (shapes, text, stickies,
  arrows, tables): under Professional the glyphs are square and fine, under Sketch they are drawn wobbly and
  doubled. Icons, media, tools and self-painting faces keep their glyphs, as their elements keep their looks.

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
