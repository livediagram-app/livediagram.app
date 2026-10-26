# Export fidelity

Status: shipped

## The rule

**An exported image is a picture of the design.** Whatever the canvas draws,
every export draws: same sizes, same colours, same marks, in the same places.
A difference between the canvas and its export is a bug, not a degradation.

That applies to all four surfaces the headless renderer feeds, because they are
all "a picture of the design" to whoever is looking at one: the SVG / PNG / PDF
export, the Explorer's preview thumbnails, the public live-image share link
([Live image share link](../013-workspace/live-image-share.md)), and the inline images the MCP server
returns ([MCP server](../015-api/mcp-server.md)).

## Why it kept breaking

There are **three** renderers for the same content: the canvas (React, DOM +
CSS + SVG), the SVG emitters in `packages/design/src/svg-render*.ts`, and the
PNG / PDF canvas-2D drawers in `apps/live/lib/export-tab-canvas-draw.ts`. Each
was internally consistent, so each looked right in its own tests, and the
differences between them were invisible until someone laid two pictures side by
side. They were not small:

- **Labels came out about two thirds the size they were drawn at.** The canvas
  and the exporters each kept a font table and they disagreed at every preset
  (the default `md` was 22px on the canvas and 14px in an export).
- **Twenty-two kinds exported as an empty labelled box.** Charts, progress bars
  and rings, ratings, timelines, record rows and the Behaviour faces had no branch in the SVG emitter, so each fell
  through to the generic box. A pie chart exported as a rectangle with the word
  "pie-chart" in the middle of it.
- **A browser frame exported without its window**, because the export drew the box and stopped.
- **The PNG and the SVG of the same tab disagreed**, because the PNG path only
  rasterises the SVG markup for kinds listed in `boxedNeedsSvgRaster`, and the
  list had not kept up.

## How it is held

**One definition per decision, in `@livedesign/design`,** imported by both
sides rather than reimplemented. That is the only mechanism that works: a rule
written down in two places is a rule that drifts. What moved there for this:

| Decision                            | Module                                            |
| ----------------------------------- | ------------------------------------------------- |
| Label font sizes                    | `label-font.ts` (`LABEL_FONT_PX`, `NOTE_FONT_PX`) |
| An arrow caption's size + footprint | `arrow-label.ts`                                  |
| A chart's plot + legend rects       | `chart-frame.ts`                                  |

The canvas re-exports each from the module its views already import, so a view
keeps its existing import and there is still only one table.

**`shapeHasBespokeBody`** names the kinds whose body the SVG emitters draw, and
`boxedNeedsSvgRaster` reads it, so the PNG path rasterises exactly the kinds the
canvas-2D drawers cannot draw. Adding a body to a kind wires up both exports.

**Borders are the element's own.** A shape's export border uses its stroke
width, dash pattern and radius (`svg-render-border.ts`), inset by half the
stroke the way the canvas's CSS border sits inside the box; every silhouette drawn
to its box edge (`strokeInside`: diamond, parallelogram, hexagon, design, cylinder,
cloud) is inset the same way, so its outline never crosses the box edge.

**Every export draws an arrow the same way.** The SVG and the PNG / PDF both
hand `svgArrow` the elements the export draws as its occluders, so a line
breaks only behind a box that is in the picture (never one on a hidden layer
or off the page), and the export's paper (`EXPORT_PAPER` on a page frame, else
the tab's background) as the fill of a hollow head, as the canvas fills it.
The PNG / PDF paints a run of consecutive arrows as one layer; an arrow that
fails to draw (its markup throws, or the browser refuses its layer) is skipped
and logged (`[export] arrow skipped`, with its id), and the rest of the run is
drawn arrow by arrow, so one broken arrow never fails the whole export.

**A self-painting element gets no box and no label.** `SELF_PAINTING_SHAPES`
already said which kinds draw their own body; the export now honours it, so a
chart is not framed in a rectangle that is not on the canvas, and a rail does not
print its kind name across itself.

## What an export deliberately does not reproduce

Not everything on a live canvas is a mark on a picture, and pretending otherwise
would be worse than the gap:

- **Motion.** Every element animation is designed so its resting frame is the
  static element ([Canvas and palette](../008-canvas/canvas-and-palette.md)), which is what a still
  image wants.
- **Placeholders and affordances.** An empty hero title shows "Title" on the
  canvas because you can click it; an export of an empty field is empty.
- **Live state of a control.** A pressed button, a playing embed.
- **Editor chrome.** A hover card, a selection handle, an in-place editor.
- **The progress track on dark paper.** The canvas paints a fixed light
  track; the export keeps the element's fill on dark paper so its percentage
  stays readable.

### Faces export as they look

A box label breaks a word wider than its
line between characters, as the canvas's `break-words` does, in the SVG and the PNG alike, and so does a
table cell's text; an icon caption keeps the word whole. A break falls between characters as a reader sees
them, so an emoji is never cut in half. A formatted label (bold, italic, colour runs) puts a space
only where its text has white space, so part of a word in bold ("**Re**act") exports as one word,
never broken across lines. A code block counts columns as a monospace face draws them, a wide
character (an emoji, a CJK character) taking two, so its lines wrap and clip at the card's edge and
never cut an emoji in half.
The one small
known gap is the Callout body's indent, a few pixels off the canvas's.

## Checking it

`packages/design/src/export-consistency.test.ts` holds the wiring rather than
pixels: that the exporter reads the canvas font table, that every kind with a
body draws more than a box, that a face's title is not also printed as a centred
label, and that every kind whose body the SVG draws is one the PNG rasterises.

The pixels are checked by eye, which is what found all of this: seed a tab with
a dense grid of one family of elements, screenshot the canvas in focus mode, and
render the same tab's export beside it, in both light and dark paper.
`svg-render-fidelity.test.ts` and the per-kind tests pin the marks each face
draws.
