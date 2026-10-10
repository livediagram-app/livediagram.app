# Export fidelity

Status: shipped

## The rule

**An exported image is a picture of the document.** Whatever the canvas draws,
every export draws: same sizes, same colours, same marks, in the same places.
A difference between the canvas and its export is a bug, not a degradation.

That applies to all four surfaces the headless renderer feeds, because they are
all "a picture of the document" to whoever is looking at one: the SVG / PNG / PDF
export, the Explorer's preview thumbnails, the public live-image share link
([Live image share link](../013-workspace/live-image-share.md)), and the inline images the MCP server
returns ([MCP server](../015-api/mcp-server.md)).

## Why it kept breaking

There are **three** renderers for the same content: the canvas (React, DOM +
CSS + SVG), the SVG emitters in `packages/document/src/svg-render*.ts`, and the
PNG / PDF canvas-2D drawers in `apps/live/lib/export-tab-canvas-draw.ts`. Each
was internally consistent, so each looked right in its own tests, and the
differences between them were invisible until someone laid two pictures side by
side. They were not small:

- **Labels came out about two thirds the size they were drawn at.** The canvas
  and the exporters each kept a font table and they disagreed at every preset
  (the default `md` was 22px on the canvas and 14px in an export).
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

**One definition per decision, in `@livediagram/document`,** imported by both
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

**Borders are the element's own.** A shape's export border uses its stroke
width, dash pattern and radius (`svg-render-border.ts`), inset by half the
stroke the way the canvas's CSS border sits inside the box; every silhouette drawn
to its box edge (`strokeInside`: diamond, parallelogram, hexagon, document, cylinder,
cloud) is inset the same way, so its outline never crosses the box edge. A self-painting
kind keeps the wrapper's 4px corners (the Reveal cover).

**The Collaborate cards share one kit.** Every card is laid out in the canvas
panel's design units (`collabCard`: 16/14 padding, a 24px header row, the body
10px under it), takes its accent from the element's stroke exactly as
`CollabAccentScope` does (`collabAccent`: the accent, the ink that reads on
it, and the accent as text mixed 40% toward the text colour on a card of the
same tone), and draws its controls from the shared parts
(`svg-render-collab-parts.ts`: the dashed accent bar, the composer, accent
chips, count boxes, the 16-unit glyphs). The done green is `COLLAB_DONE_COLOR`.
Cards whose rows reflow (Q&A board, Idea box, Comment panel, Action panel,
Agenda, Roll call) lay out at the element's own size rather than scaling.

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
- **Placeholders and affordances.** An empty page masthead shows "Title" on the
  canvas because you can click it; an export of an empty field is empty.
- **Live state of a control.** A timer's remaining time, a picker mid-roll, a
  pressed button.
- **Who is in the room.** An export has no presence, so a Done check has
  nobody to wait on: it draws the people who marked themselves done, not a
  waiting list.
- **Editor chrome.** The `…` settings menu in a card's header, the Start
  button on a timer, a hover card. A card's title therefore sits where the
  header puts it without the menu beside it.
- **The progress track on dark paper.** The canvas paints a fixed light
  track; the export keeps the element's fill on dark paper so its percentage
  stays readable.

### The behaviour cards export as they look

The Behaviour and Collaborate cards moved onto one modern look (flat, lit by
the tab theme's accent, [Participant responses](../012-collaboration/participant-responses.md)), and their exports
carry its **marks**, not just their text: the Temperature check's five faces,
the Estimate card's face-up cards and its scale chooser while it has no scale,
the Roll call's people as initial discs on their own colour (it stores their
names and colours; a Done check or an Estimate stores only an opaque key per
answer, so their people export as neutral discs), the Decision
record's status badge with its glyph, and the soft accent glows behind the
Reveal zone and the Idea box. What stays out is motion (a bob, a sweep, a
flip) and live clocks, as above.

The cards export their **controls** too, at rest: the Agenda's progress bar,
step markers and the current step's minutes; the Q&A board and Idea box
composers, accent bars and "Most wanted" rows; the Estimate card's pick cards,
face-down room cards and Reveal / New Round footer; the Temperature check's
bars and meter; the Comment panel's grouped bubbles, Resolve chip and composer;
the Action panel's rings, checks and Add Action bar; the Roll call's avatar
stack, time chip and Take again bar; the Q&A board's folded "Discussed · N"
drawer whenever a note is done (a board whose every note is done shows the
drawer, never "No notes yet").

**Nothing runs off a card.** A Collaborate card's title takes one line in the
room its aside leaves and ends in an ellipsis (`fitLine`), as the canvas's
header truncates it; a word wider than a wrapped line is cut the same way; a
Roll call chip's name is cut to its chip; and a Decision record's drivers wrap
(up to three lines each), with the ones that do not fit above the date counted
in a "+N more" line rather than dropped. The Behaviour faces draw what the canvas
draws: a timer Session button is the idle dial (ticks, "TIMER", its length); a
Mode button is a keycap with its glyph chip over the label, or "Switch to" and
the mode's name (`SELECTION_MODE_LABEL`) when it has none; a Portal is its
bloom, mouth and lit rim (dim when unpaired); a Reaction pad is its soft wash,
the emoji on its glowing spot and the label chip; a Reveal cover carries the
lock disc and the gesture chip; a Picker shows its reel window; a chair prints
its label under the seat. A Page draws its masthead inside the border, starts
its body label under the rule, and turns back its bottom-right corner over the
paper. A box label breaks a word wider than its line between characters, as
the canvas's `break-words` does; an icon caption keeps the word whole.

The Mode button's glyph is shared data: the nine selection-mode glyphs live in
`@livediagram/icons/mode-glyphs` (`MODE_GLYPHS`), which the editor's palette and
button face render through `<Prims>` and the export through `iconPrimsMarkup`,
so the chip carries the same drawing in both. A glyph with a filled dot or a
heavier stroke says so on the primitive (`StyledPrim`), and the export converts
the canvas's on-screen stroke weight into the glyph's units. The one small
known gap is the Callout body's indent, a few pixels off the canvas's.

## Checking it

`packages/document/src/export-consistency.test.ts` holds the wiring rather than
pixels: that the exporter reads the canvas font table, that every kind with a
body draws more than a box, that a face's title is not also printed as a centred
label, and that every kind whose body the SVG draws is one the PNG rasterises.

The pixels are checked by eye, which is what found all of this: seed a tab with
a dense grid of one family of elements, screenshot the canvas in focus mode, and
render the same tab's export beside it, in both light and dark paper.
`svg-render-fidelity.test.ts` and the per-card tests pin the marks each face
draws.
