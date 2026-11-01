# Fill tool

Status: shipped

The **Fill tool** is a paint bucket for whiteboards: pick a colour, click a finished shape, and it
fills in that colour. It fills what is already closed (a shape, a closed path) and one thing a
whiteboard draws a lot: a marker loop whose ends meet, which it turns into a filled shape that keeps
its ink as the outline.

## Why

A whiteboard sketch is mostly ink. Colouring a region in meant redrawing it as a shape, or selecting
it and finding Background in the quick style panel, which a marker stroke never offers. A bucket
is the tool every drawing program has for this: one press on the region you mean.

## Where it lives

- **Dock:** in the Drawing tools group, after the Path tool and before the Eraser, its own run
  with the Eraser (the two tools that act on what is already drawn): **Select | Markers | Text,
  Path tool | Fill, Eraser** ([Draw mode](draw-mode.md) "What a whiteboard shows"). Labelled
  **Fill**, a paint bucket icon with a swatch of its colour under it, key **F** (on the button and
  in `aria-keyshortcuts`).
- **Key F** picks it from anywhere on a whiteboard (not while typing). On a diagram tab F stays the
  Frame.
- Picking it puts any marker, shape, Path tool or eraser down, like every dock tool, and it stays
  in hand until another tool, Escape or a mode switch puts it down, as the eraser does: a bucket is
  pressed many times in a row.
- **Whiteboards only**, like the pens: leaving Draw mode puts it down.

## Its colour

- **Pressed while in hand**, the Fill button opens its flyout, **Fill**, below the dock (above
  a bottom dock), as a pen's does. It holds the one colour picker
  ([Colour picker](../004-interface-design/colour-picker.md)), as every colour choice does: **No
  fill** first (it clears a fill), the theme's fills as the quick style panel's Background row shows
  them (a custom swatch included), the **soft** standard colours drawn for the board, Custom colours
  from the document, and **+** for any other. A pick changes the bucket at once: the next press fills
  in it.
- The colour is a plain colour (`#rrggbb`) or No fill, written onto what it fills as a picked
  Background colour is: a shape loses its swatch binding and colour preset, as it does when its
  Background is picked from the panel's picker.
- **Device-local** (`livediagram:v2:whiteboard-fill`), never on the document. Until one is picked
  the bucket pours the theme's **first fill**, so it follows the board's look.
- The dock button shows the colour in hand as a small bar under its bucket (No fill shows the
  no-colour chip's slash), so which colour will pour is never hidden.

## What a press fills

A press with the bucket looks at what is drawn under the pointer, **top first**, and does the first
of these that applies:

1. **A closed element: its fill is set.** A shape that takes a Background in the quick style panel
   (every shape kind with a fill, not a chart or a Sankey), a closed path, and a stroke that is
   already closed (a filled marker loop, a closed pencil sketch, a polygon). It counts as under the
   pointer **inside its drawn outline**, following its rotation (an ellipse by its curve, a closed
   path by its curve, holes in a combined path excluded), whether or not it shows a fill now. A
   press that would write the colour it already has changes nothing.
2. **A marker loop: it becomes a filled shape.** A single marker stroke whose **ends meet** (below),
   with the press inside the loop. The stroke is closed and filled, keeping everything else:
   its id, ink (colour, width, pressure, streamline), layer, place in the stacking order, comments,
   note, link and animation. Where its ends did not quite touch, its first point is added at its end,
   so the ink itself closes the outline and the fill never shows an edge without ink. The fill is
   drawn **under** the ink, along the stroke's centre line, so the ink stays the outline exactly as
   drawn.
3. **Anything else: nothing changes**, and a small hint says why (an info toast, at most one at a
   time):
   - on the bare board or open ink: "Click inside a closed shape, or a loop whose ends meet, to fill
     it."
   - on something locked: "That's locked, so its fill stays."

What a press looks past, on its way down: open ink (a marker stroke whose ends do not meet, a
highlight), lines and arrows, text boxes, and a shape or path whose outline the press is outside.
What stops it: a sticky note, an image or any other element that fills its box (a table, an embed, a
chart), which is not something a bucket fills. Elements on a hidden or locked layer are not there
for the bucket.

### When ends meet

A marker stroke's ends meet when all of these hold (`STROKE_LOOP_*`, shared with livedesign in
`@liveworkspace/model-core/stroke-loop`):

- it has at least **4 points** (a tap or a dash is not a loop);
- the gap between its first and last points is at most the **largest** of 16 canvas px, three times
  its pen width, and 15% of its box's longer side, so a big loop forgives a bigger gap than a small
  one and a thick marker a bigger gap than a fine one; the rule reads canvas px, so it is the same
  at every zoom and for every collaborator;
- the loop it makes, closed across that gap, is **round enough to hold something**: its area is at
  least a tenth of what a circle of the same length holds (a long thin 10:1 oval still is), so a line
  drawn out and back over itself (ends meeting, nothing inside) is not a loop.

## After a fill

- **A filled loop is a closed stroke.** The bucket fills it again in another colour, or clears it
  with No fill (it stays closed). No fill on an open loop changes nothing: there is no fill to clear. It is picked by its drawn line and, while it shows a fill, by
  its fill too, as a filled path is ([Draw mode](draw-mode.md) "Selecting"); the Stroke eraser
  touches it on its line or its fill; a Partial erase cuts it open, and its pieces are open,
  unfilled strokes again.
- Its ink still restyles from the quick style panel's Marker rows. The panel offers no Background
  row for a marker stroke: the bucket is how its fill changes.
- **One press is one edit**: one undo step, and it reaches every collaborator at once, as every
  change does.

## Input

- **A press is a click or a tap**: the fill happens on release, where the press went down, when
  the pointer moved less than 6 screen px. A drag, a second finger (a pinch) or a cancelled pointer
  fills nothing; a pinch still zooms, and the middle button, Space or the scroll wheel still pan, as with every Draw tool.
- The bucket is not an inking tool: a finger presses with it even after a pen has been used on the
  device (the rule that a finger pans once a pen is seen covers the pens, the Path tool and the
  eraser, [Draw mode](draw-mode.md) "Touch and pen input").
- **Cursor:** a crosshair at the tip with a small bucket beside it, the same anchor as every draw
  cursor, over anything: the bucket presses wherever it is.
- **Touch:** the button is at least 40 x 40 px and the picker is the one every colour choice uses;
  on a phone the dock scrolls as it always does.

## Share roles

| Role        | The Fill tool                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Editor      | Picks it, sets its colour and fills.                                                                                                             |
| Participant | Never: its palette on a whiteboard is its own (Sticky, Text, Image) and the dock's tools are not among it; F does nothing. A fill it sends anyway is not kept: the room keeps the stored fill and closed flag of anything but its own sticky. |
| Viewer      | Never: a Viewer has no dock and no keys but V, H, Z and Escape.                                                                                 |

The editor gates the fill on the session's `can.recolour` for the element it would change, so a
session that may not recolour it changes nothing.

## Export

A filled loop draws its fill under its ink in the SVG and PNG exports, the PDF, thumbnails and
previews, from the same function the canvas draws with. The Excalidraw export writes it as a closed
`freedraw` with its fill as the background, as it writes any closed stroke.

## Accessibility

- The dock button is a toggle named **Fill** with its key; its flyout is named **Fill** and holds the picker named **Fill colour**: each
  swatch named by its colour word ("No fill" for none), the one in hand
  marked.
- The hint is a polite toast. Filling is pointer-only, like drawing: on the keyboard, the quick
  style panel's Background row sets a selected shape's fill.

## Performance

A press is one walk down the elements, top first, that skips everything whose box does not hold the
point before it reads any geometry; only the few under the pointer decode their points. The loop
test is linear in a stroke's points. On a board of 5,000 marker strokes a press stays under 8 ms of
CPU (a budget test keeps it there).

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

| Event                                 | Action     | Type                          |
| ------------------------------------- | ---------- | ----------------------------- |
| The Fill tool picked                  | `Selected` | `Draw` · `Fill`               |
| Its colour changed                    | `Changed`  | `Draw` · `FillColour`         |
| A closed element filled               | `Changed`  | `Element` · `FillBucket`      |
| A marker loop closed and filled       | `Changed`  | `Element` · `FillLoop`        |
| A press that filled nothing           | `Changed`  | `Draw` · `FillMissed`         |

Never a colour or an element's content.

## Non-goals

- Filling a region bounded by several strokes or shapes, as a paint program floods pixels (it has
  to work out regions from vector ink; the answer on Work Tracker #9 chose closed elements and single
  loops).
- A gradient, pattern or image fill from the bucket.
- The bucket on a diagram tab: the quick style panel's Background already sets a fill there.
