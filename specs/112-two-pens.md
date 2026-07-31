# 112 — Two pens instead of a pen and a mode

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
([spec/110](110-palette-top-level-categories.md)), one click from the category
picker, so picking the other pen is the same gesture as flipping the toggle
used to be.

## How it works

`PendingDraw` gains a third freehand variant beside `highlighter`:

```ts
{ type: 'freehand'; variant?: 'highlighter' | 'shape-pen' }
```

`useCanvasDrawGesture` reads the armed intent on release —
`pendingDraw?.variant === 'shape-pen'` — rather than a lifted preference, and
passes that to `onCommitFreehand`. The recognition code itself
(`packages/diagram/src/recognise-shape.ts`) is untouched; only what decides to
call it changed.

Each pen gets its own cursor and banner. The shape pen's cursor is the nib
with a dashed square beside it, and its banner reads "Draw a rough shape — it
snaps to the real one", because saying what it will do is the whole difference
between the two tiles.

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
