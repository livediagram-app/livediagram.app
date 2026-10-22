# Drawing tools

Status: specified

The hand-drawing tools a logo page offers beside the Pen ([Path tool](path-tool.md)): the three
**markers**, shape recognition while a marker draws, how a marker stroke is picked, and the quick
style panel's marker rows. Where they sit in the palette is [Logo pages](../007-editor/logo-pages.md)
"The Logo palette"; the Freehand Pencil, the Shape Pen and the Polygon are
[Two pens instead of a pen and a mode](../008-canvas/two-pens.md) and
[Multi-point line / polygon tool](../008-canvas/polygon-tool.md); the eraser is the canvas's
([Eraser panel](../008-canvas/eraser-panel.md)).

## Markers

- **Three markers**, **Marker 1**, **Marker 2** and **Marker 3**, named by their place, never by a
  colour, because Markers 2 and 3 can be any colour. A logo page's Draw offers them as tiles, and the
  Toolbar strip's Search offers them on any page
  ([Toolbar layout](../007-editor/toolbar-layout.md#search-every-element-type)), each as this
  browser last set it.
- **Marker 1 always draws in the Ink**, the canvas's adaptive ink; its width is adjustable like any
  marker's, so its flyout offers the width only. **Markers 2 and 3** change colour and width; they
  start as **Blue** and **Red**.
- **Widths**, six in all (`WHITEBOARD_PEN_WIDTHS`, the width at medium pressure): **Fine** (1 px),
  **Medium** (1.5 px, the default), **Bold** (2.5 px), **Thick** (4 px), **Heavy** (6 px) and
  **Broad** (9 px). A marker stores its width as the preset's name, not its px, so retuning the px
  never reinterprets a stored choice. Each width is pictured the same wherever it is chosen (the
  flyout and the quick style panel, `PenWidthIcon`): a line in six even steps, not to scale.
- **Picking one:** a press on a marker tile picks it up for one stroke (from the palette) or until
  another tool or Escape puts it down (from Search). A press on the marker already in hand opens
  its **flyout** below the tile: its colour (Markers 2 and 3) and width. A change is the marker's
  everywhere and re-arms it at once.
- **The cursor** is a crosshair with a nib in the marker's colour, the same over anything: a marker
  draws wherever it presses.
- **Ink like Excalidraw's, with pressure.** A stroke is drawn with
  [perfect-freehand](https://github.com/steveruizok/perfect-freehand) (MIT) from its raw samples,
  streamlined, as a filled outline with round ends. A pen (stylus) swells the line as it is pressed
  harder, from under half the width at the lightest touch to about 1.35 times it at the firmest;
  without pressure a stroke keeps the preset width all along. A mouse is streamlined more (0.5)
  than a pen or a finger (0.2); a stroke keeps the streamline it was drawn with.
- **What you draw is what lands.** The stroke being drawn is drawn in the canvas itself, laid out
  exactly as the stroke it becomes, so release moves no pixel; ink the smoothing has settled never
  moves while drawing. The landed stroke stores its samples packed
  ([Stroke points](../006-document/stroke-points.md)).
- **A marker's width is ink on the canvas**, in canvas px, so a stroke zooms like everything else.
- **A tap is a dot**: a press lifted where it went down leaves a round dot as wide as the line.
- **A marker lines up as the pencil does**: its first point snaps to nearby alignments and its
  stroke shows alignment guides as it grows; on a logo page with Show Guides on, its start and end
  land on a shown guide ([Logo pages](../007-editor/logo-pages.md) "Construction guides").
- **Strokes stay open**: a stroke that ends near its start is ink, not a filled shape.
- **Input:** only the pointer that started a stroke draws it; a stroke a second finger turns into a
  pinch, or the browser cancels, is discarded; putting the marker down mid-stroke (Escape) discards
  it.
- The markers are the person's, not the document's: they persist device-locally in `localStorage`
  (`livedesign:v2:whiteboard-pens`).
- A stroke records its marker's colour and width on its `freehand` element (`penColour`,
  `penWidth`), with its samples, a pressure per sample when a pen drew it, and its streamline. The
  Ink records no colour, so it follows the appearance; a stock colour is recorded by name, so it
  adapts to each viewer's canvas; a custom colour as its hex.

### The colour picker

Markers 2 and 3 take their colour from the one colour picker
([Colour picker](../004-interface-design/colour-picker.md)): the **stock colours** in one row,
**Ink** first, then Grey, Red, Orange, Yellow, Green, Teal, Blue, Violet and Pink, each stored by
name and drawn in the version tuned for the canvas it is shown on (at least 4.5:1 against it); then
the document's **Custom Colours** and **Add a custom colour**. A custom colour is one exact hex on
every canvas; one under 3:1 on either canvas shows a warning with a nearby readable version.
Existing strokes stay as drawn: a stroke keeps the colour it was drawn in.

## Selecting

- **A marker stroke is picked by its drawn line**, not its box: a click within 6 screen px of the
  line (either side, at any zoom, `STROKE_HIT_SCREEN_PX`) selects it, and a click elsewhere in its
  box passes through to whatever is beneath. Once selected, its box drags and resizes it as any
  element's, and its line still catches pointers outside the box.
- A path is picked the same way, by its line or its fill ([Path tool](path-tool.md) "Selecting and
  erasing"). Every other element keeps its box.

## Shape recognition

A marker stroke stays as drawn unless someone asks for a shape while drawing it.

- **Alt (Option) flips the stroke being drawn**, while the pen is still down. Pressed on ink, it
  recognises the stroke drawn so far at once, with the Shape Pen's recogniser
  ([Two pens instead of a pen and a mode](../008-canvas/two-pens.md)): the clean shape shows in the
  marker's colour and nearest border weight, unfilled, exactly where it will land, and locks.
  Pressed on a shape, it breaks out: the stroke is ink again, exactly as drawn so far. A stroke
  that reads as no shape stays ink, and the next press tries again. Each press flips; releasing Alt
  changes nothing, and Alt pressed while drawing never moves the focus to the browser's menu.
- **Dragging on reshapes a locked shape**: a line's end nearer the pen follows the pen; a shape's
  corner nearer the pen follows it, the opposite corner stays, and dragging past it flips the box.
  **Shift** makes it perfect: a circle stays a true circle; a diamond, triangle or star as wide as
  it is tall; a rectangle snaps to the nearest of 1:1, 5:3 and 3:5; a line to 45° steps.
- **The same on a touch screen**: when a pen or finger stroke holds still for half a second
  (`RECOGNITION_PREVIEW_DWELL_MS`, within 4 screen px), a **chip** appears just above and before the
  tip (a 44 x 44 px target): **Make shape** on ink that reads as a shape, **Keep drawing** on a
  shape. A tap with the other hand does what Alt does; the stroke carries on. The chip leaves when
  the pen moves on or lifts. A mouse stroke has Alt and shows no chip.
- **Lifting lands what shows**, the shape or the ink, never re-read. A recognised shape keeps its
  marker's colour, by name, the Ink included.
- **Telemetry:** `Draw` · `Toggled` · `RecogniseOnceKey`, `RecogniseOnceChip`, `BreakShapeKey` or
  `BreakShapeChip`.

## The quick style panel

The quick style panel ([Quick style panel](../008-canvas/quick-style-panel.md)) styles marker
strokes in its own rows:

- Selected marker strokes get **Marker colour** (Ink and the eight hued stock colours, adaptive like
  the flyout's, then **More colours**, the full colour picker) and **Marker width** (the six widths,
  in one row). Custom colours live only in that picker: the panel never shows a second row of them.
- With nothing selected and a marker in hand, the panel styles **that marker**: the same settings
  its flyout holds. Every marker shows the same rows, so Marker width stays at the same height
  whichever is in hand; Marker 1's colour row holds its one colour, the Ink.
- A caption above the rows names whose style it is ("Marker 2", "Marker stroke", "3 marker
  strokes"); a mixed selection counts every element styled. Power user mode leaves it out.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

| Event                                    | Category · Action · Type                                   |
| ---------------------------------------- | ---------------------------------------------------------- |
| A marker's colour or width changed       | `Draw` · `Changed` · `PenColour` / `PenWidth`              |
| A stroke flipped between ink and a shape | `Draw` · `Toggled` · `RecogniseOnce…` / `BreakShape…`      |
| A marker stroke landed                   | `Element` · `Added` · `Freehand` (or the recognised shape) |

## Non-goals

- Shape recognition that snaps on its own: a stroke becomes a shape only when asked (Alt or the
  chip).
- A partial (stroke-splitting) eraser: the canvas's eraser removes whole elements.
