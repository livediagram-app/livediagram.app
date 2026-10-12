# Finish

A **finish** is the drawing style a tab's elements are rendered in: how their lines, corners, fills and lettering
look, independent of their colours. There are three:

| Finish           | Reads as                      | What it changes                                                                                          |
| ---------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Flexible**     | Today's look (the default)    | Nothing: soft 8 px corners, 2 px lines, a soft default shadow on boxes, a peel under stickies            |
| **Professional** | Crisp, print-ready            | Sharper corners, thinner lines, no default shadows, no draw-time arrow curves                            |
| **Sketch**       | Drawn by hand on a whiteboard | Wobbly double-stroked outlines, hatched fills, a handwriting font, arrowheads drawn as two loose strokes |

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

- **Corners:** an unset corner on a free-corner box draws at 2 px instead of the kind's default (8 px for a shape,
  12 px for a mind node), still capped at a quarter of the shorter side
  ([Corner radius](corner-radius.md)).
- **Lines:** an unset border width draws at 1 px (Thin) instead of 2 px; an unset arrow thickness draws at 1 px.
- **Shadows:** the default soft shadow on boxed shapes and the paper peel under stickies are not drawn. An
  element's own shadow ([Element shadows](element-shadows.md)) still draws.
- **Arrows:** a freshly drawn arrow on a Professional element's tab gets no draw-time avoidance curve
  ([Arrow collision avoidance](arrow-collision-avoidance.md)); it stays straight and breaks behind the boxes it
  crosses as usual ([Arrows pass behind](arrow-route-behind.md)).

### Sketch

- **Outlines** of shapes, frames, lanes, stickies and tables are drawn as two slightly different hand-drawn
  strokes: straight edges bow and overshoot their corners a little, curves wander. The wobble is seeded by the
  element's id, so an element looks the same on every screen, in every export and after every reload, and only
  changes when its size or kind does.
- **Fills** of shapes are drawn as diagonal pencil hatching in the fill colour instead of a solid fill. Stickies,
  frames, lanes, tables, charts and code blocks keep their solid fills: hatching a note or a container makes the
  writing on it hard to read.
- **Lettering:** an element without its own font is written in the handwriting font (Caveat), whatever font the
  tab has. An element's own font wins. A code block keeps its monospace font.
- **Arrows** are drawn as hand-drawn lines; a triangle, hollow triangle or line arrowhead is drawn as two loose
  strokes. Circle and diamond heads keep their shapes, because they carry meaning (UML composition, ER
  cardinality).
  Server-rendered PNG previews (the MCP's inline images, the CLI) letter every font in Inter, so there the
  hand-drawn lines carry the look and the lettering does not; browser exports use the real font.
- **Dashes:** a dashed or dotted border or arrow stays dashed or dotted, along the hand-drawn line.
- **Not affected:** freehand strokes (already hand-drawn), images, icons, and the faces of self-painting elements
  (charts, checklists, progress, code) other than their lettering.
- **Selection, hit testing, anchors and snapping** use the element's true geometry, never the wobble, so a
  sketched element is selected, connected and aligned exactly as a Flexible one.

### Flexible

Draws exactly as livediagram did before finishes existed.

## Where it is set

- **Element menu, Style section:** a **Finish** category (closed by default, like every menu section) with four
  tiles: **Follow Tab**, **Flexible**, **Professional**, **Sketch**. Follow Tab clears the element's own finish.
  Hovering a tile previews it on the selection; clicking commits it as one undo step. The category shows for
  shapes, arrows, text, stickies and tables, and in the multi-selection menu when the selection holds any of
  them (the commit then sets every one of them).
- **Tab look and feel:** a **Finish** tab beside Canvas, Theme and Font, with the three finishes as tiles and an
  **Apply to All Elements** action that clears every element's own finish on the tab so they all follow it again.
- **New tabs** start Flexible. Duplicated and imported tabs keep their finish.
- **Agents (MCP):** `create_document` and `add_tab` take an optional `finish`; an element's `finish` is an
  ordinary element field agents may set.

## Share roles

| Role            | Finish                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------- |
| **Editor**      | Sets a tab's finish and an element's finish                                               |
| **Participant** | Sees elements in their finish; never changes one (a finish restyles the board, a setting) |
| **Viewer**      | Sees elements in their finish                                                             |

The element menu is not offered to a Participant or Viewer, and the Tab look and feel setters are blocked for
both, so neither control is reachable. A Participant's element ops cannot carry `finish` (it is not in the
Participant's writable fields).

## Telemetry

- `Tab · Changed · Finish` when a tab's finish changes; `Tab · Changed · FinishToAll` for Apply to All Elements.
- `Element · Changed · Finish` when an element finish is committed.

## Performance

Sketch geometry is computed from an element's kind, size and border, never from its position, so moving an element
does not recompute it; it is memoised per element view. Generating one element's strokes and hatching stays under
0.2 ms at worst-case sizes, so a 500-element sketched tab costs under 100 ms to draw from cold and nothing per
drag frame for unmoved elements ([Canvas performance](canvas-performance.md)).
