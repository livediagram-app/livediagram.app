# Export fidelity

Status: shipped

## The rule

**An exported image is a picture of the diagram.** Whatever the canvas draws,
every export draws: same sizes, same colours, same marks, in the same places.
A difference between the board and its export is a bug, not a degradation.

That applies to all four surfaces the headless renderer feeds, because they are
all "a picture of the diagram" to whoever is looking at one: the SVG / PNG / PDF
export, the Explorer's preview thumbnails, the public live-image share link
([Live image share link](../013-workspace/live-image-share.md)), and the inline images the MCP server
returns ([MCP server](../015-api/mcp-server.md)).

## Why it kept breaking

There are **three** renderers for the same content: the canvas (React, DOM +
CSS + SVG), the SVG emitters in `packages/diagram/src/svg-render*.ts`, and the
PNG / PDF canvas-2D drawers in `apps/live/lib/export-tab-canvas-draw.ts`. Each
was internally consistent, so each looked right in its own tests, and the
differences between them were invisible until someone laid two pictures side by
side. They were not small:

- **Labels came out about two thirds the size they were drawn at.** The canvas
  and the exporters each kept a font table and they disagreed at every preset
  (the default `md` was 22px on the board and 14px in an export).
- **Twenty-two kinds exported as an empty labelled box.** Charts, progress bars
  and rings, ratings, timeline rails, record rows, a page's masthead, and every
  Behaviour / Collaborate card had no branch in the SVG emitter, so each fell
  through to the generic box. A pie chart exported as a rectangle with the word
  "pie-chart" in the middle of it.
- **A swimlane exported without its gutter and a browser frame without its
  window**, because the export drew the box and stopped.
- **The PNG and the SVG of the same tab disagreed**, because the PNG path only
  rasterises the SVG markup for kinds listed in `boxedNeedsSvgRaster`, and the
  list had not kept up.

## How it is held

**One definition per decision, in `@livediagram/diagram`,** imported by both
sides rather than reimplemented. That is the only mechanism that works: a rule
written down in two places is a rule that drifts. What moved there for this:

| Decision                            | Module                                            |
| ----------------------------------- | ------------------------------------------------- |
| Label font sizes                    | `label-font.ts` (`LABEL_FONT_PX`, `NOTE_FONT_PX`) |
| An arrow caption's size + footprint | `arrow-label.ts`                                  |
| A chart's plot + legend rects       | `chart-frame.ts`                                  |
| A lane's gutter edge + thickness    | `lane-gutter.ts`                                  |

The canvas re-exports each from the module its views already import, so a view
keeps its existing import and there is still only one table.

**`shapeHasBespokeBody`** names the kinds whose body the SVG emitters draw, and
`boxedNeedsSvgRaster` reads it, so the PNG path rasterises exactly the kinds the
canvas-2D drawers cannot draw. Adding a body to a kind wires up both exports.

**A self-painting element gets no box and no label.** `SELF_PAINTING_SHAPES`
already said which kinds draw their own body; the export now honours it, so a
chart is not framed in a rectangle that is not on the board, and a rail does not
print its kind name across itself.

## What an export deliberately does not reproduce

Not everything on a live board is a mark on a picture, and pretending otherwise
would be worse than the gap:

- **Motion.** Every element animation is designed so its resting frame is the
  static element ([Canvas and palette](../008-canvas/canvas-and-palette.md)), which is what a still
  image wants.
- **Placeholders and affordances.** An empty page masthead shows "Title" on the
  canvas because you can click it; an export of an empty field is empty.
- **Live state of a control.** A timer's remaining time, a picker mid-roll, a
  pressed button.
- **The Collaborate paper kit** ([Per-participant responses](../012-collaboration/participant-responses.md)): the
  halftones, ruled paper, card backs and tape that give each card its texture.
  The cards export with their real structure, colours and contents (title,
  status, chips, rows, footer pills) but not their paper.

## Checking it

`packages/diagram/src/export-consistency.test.ts` holds the wiring rather than
pixels: that the exporter reads the canvas font table, that every kind with a
body draws more than a box, that a face's title is not also printed as a centred
label, and that every kind whose body the SVG draws is one the PNG rasterises.

The pixels are checked by eye, which is what found all of this: seed a tab with
a dense grid of one family of elements, screenshot the canvas in focus mode, and
render the same tab's export beside it.
