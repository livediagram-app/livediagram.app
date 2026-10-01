# Two pens instead of a pen and a mode

Status: shipped

## What

The Pencil splits into two palette tiles in the **Draw** category:

- **Freehand** (`P`) — the stroke is kept exactly as you drew it.
- **Shape Pen** (`6`) — a rough circle, square, triangle or line converts to
  the real shape on release.

The **"recognise shapes" toggle in the pen's mode banner is gone**, along with
the `recogniseShapes` user preference that backed it.

## Why

Recognition was a persisted, invisible mode. Whether the next stroke would
convert depended on a toggle you set at some point in the past, possibly on
another device, and the only way to check was to arm the pencil and read the
banner. Two strokes drawn a minute apart could behave differently with nothing
on screen to explain it.

Making it two tools puts the answer where the decision is: the tile you clicked
IS the setting. Nothing is remembered, so nothing can surprise you.

It also costs nothing in reach. Both live in the Draw category
([Palette top-level categories and bands](../010-palette/palette-top-level-categories.md)), one click from the category
picker, so picking the other pen is the same gesture as flipping the toggle
used to be.

## How it works

`PendingDraw` gains a third freehand variant beside `highlighter`:

```ts
{ type: 'freehand'; variant?: 'highlighter' | 'shape-pen' }
```

The pens draw through the whiteboard pen's live stroke (`inkPenOf` maps each to a one-shot pen;
see "Ink" below), and the commit reads the armed intent (`variant === 'shape-pen'`) rather than a
lifted preference. The recognition code itself
(`packages/document/src/recognise-shape.ts`) is untouched; only what decides to
call it changed.

Each pen gets its own cursor and banner. The shape pen's cursor is the nib
with a dashed square beside it, and its banner reads "Draw a rough shape — it
snaps to the real one", because saying what it will do is the whole difference
between the two tiles.

## Ink

Both pens draw the whiteboard's pen ink ([Whiteboard](../023-whiteboard/whiteboard.md) "Pens"),
through the same live stroke pipeline as the markers: raw samples, a pressure per sample from a
stylus, the pointer's streamline, the perfect-freehand outline, drawn in the canvas layer as it will
land, so release moves no pixel. They differ from a whiteboard pen only in what is already a
diagram's:

- **One stroke, then put down**, as before: the stroke lands selected. Shift held as the pen lifts
  keeps the pen for another stroke, as for a diagram tab's markers.
- **The tab's ink:** no colour of their own, so they draw in the theme's element stroke (recorded on
  the stroke, as the pencil always did) or, with none, the canvas's default freehand colour. Width
  2 canvas px (`DIAGRAM_PEN_WIDTH`), the default border's weight.
- **Strokes stay open**, as on a board: a loop is ink, not a filled shape. Close-to-fill went with
  the old pencil; a filled shape is the Shape Pen's or the palette's.
- **No guides or start snap**: a pen draws where it presses.
- **Palm rejection**: once a stylus has been used, a single finger pans instead of drawing
  ([Whiteboard](../023-whiteboard/whiteboard.md) "Touch and pen input").
- **The pen cursor** (the dock's Cursor setting: crosshair and nib, or a dot as wide as the stroke)
  in the tab's ink.
- **The Shape Pen previews while you hold still**: half a second with the pen pressed and still
  swaps the stroke for the shape it reads as; dragging on reshapes it, Shift makes it perfect, Alt
  flips recognition for that stroke, and on touch the chip does what Alt does (all as on a board,
  "Shape recognition"). What lands is a **diagram shape**: themed and filled like any new shape,
  connected to a nearby arrow when it is a line, so the outline preview gains its fill on release.

The highlighter keeps its own recipe and the per-frame sample buffer.

## Why `6` and not `S`

`S` is still the legacy Select alias (pre-`V`), and taking it would break
muscle memory for a shortcut people already have. `6` is the one gap in the
numeric tool row and sits beside the pencil's `7`.

## Removed

- `RecogniseShapesToggle` (in `TopCenterChrome`)
- `onToggleRecogniseShapes` and its `usePreferenceHandlers` entry
- the `recogniseShapes` / `onToggleRecogniseShapes` Canvas props
- the `UI·Toggled·RecogniseShapesOn/Off` telemetry pair

`recogniseShapes` stays in the `UserPreferences` type as an accepted-but-ignored
field: it is already persisted in D1 for existing users, and dropping it from
the type would make a stored preference fail to parse rather than simply do
nothing.
