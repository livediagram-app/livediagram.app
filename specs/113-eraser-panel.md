# 113 — Eraser Panel

Status: **implemented**.

While the **Eraser** tool ([spec/09](09-canvas-and-palette.md)) is active, an **Eraser** panel is present: how it erases, how big it is, what it is allowed to remove, and what it does with a group. The fourth mode panel, after [Avatar](101-avatar-mode.md), [Laser](111-laser-panel.md), and [Spotlight](112-spotlight-panel.md).

## Why

The eraser is the only tool that destroys work, and it has been the bluntest one in the app: press, and whatever is under the exact pixel goes. That fails in both directions.

It is **too precise** when you have sketched over a diagram with the Pencil and want the sketch gone — you trace every stroke back with a one-pixel point. It is **too indiscriminate** when the sketch is over a dense flow: a drag meant for your annotations takes a box, an arrow, and someone's sticky with it, and the only recovery is undo (which takes the lot back, including what you did mean to remove).

A size makes the first case one sweep. A target filter makes the second case impossible. Neither belongs in a settings dialog: you change them for the job in front of you, then move on.

## The settings

Four accordion rows over a live preview of the brush.

- **Mode** — **Sweep** (drag across things to erase them, today's behaviour) or **Tap** (one press, one thing). Tap is for surgical removal on a crowded canvas, where a two-pixel drag currently takes a neighbour with it.
- **Size** — **Point** (the exact pixel, today) / **Small** (18px) / **Medium** (36px) / **Large** (72px) radius. Anything the brush touches goes, hit-tested by sampling a ring of points around the pointer rather than one — the DOM hit test the eraser already uses, called a few more times.
- **Erases** — **Anything** (default), **Drawings only** (freehand + highlighter strokes), or **Arrows only**. "Drawings only" is the one that makes sketching over a diagram safe: sweep the whole thing at Large and the diagram underneath is untouched. "Arrows only" is for rewiring without disturbing the boxes.
- **Groups** — **Just the piece** (today) or **Whole group**: erasing one member of a group takes the group with it. Both are defensible, so it is a choice rather than a guess.

## The brush is visible

While the tool is active with a size above Point, a ring follows the cursor at the brush's true radius, so what will be erased is visible BEFORE the press. An eraser you cannot see the size of is a worse tool than a precise one.

## What it does not change

- **Locked elements, and everything on a locked or hidden layer, are still skipped** ([spec/09](09-canvas-and-palette.md) Locking, [spec/74](74-layers.md)). No setting here can erase them; that is what locking is for.
- **One gesture is still one undo** and one activity-log entry, however much it removes — the existing checkpoint-then-tick pattern is untouched.
- Arrows pinned to an erased element still go with it, as they always have.

## Persistence

Device-local, in `localStorage` (`livediagram:v2:eraser-config`), like the other tool panels. Never sent to the api, never in the synced preferences blob ([spec/20](20-user-preferences.md)).

The **Erases** filter is the one setting with a real "wrong at the wrong moment" risk — someone leaves it on Drawings only, comes back tomorrow, and wonders why the eraser is ignoring a shape. The panel keeps the filter visible in its collapsed header for exactly that reason, and the ring turns amber whenever a filter is on, so a restricted eraser never looks like a broken one.

## Telemetry

Per [spec/22](22-telemetry.md): changing a setting emits `UI·Changed·EraserMode` / `EraserSize` / `EraserTarget` / `EraserGroups`. Erasing itself still reports `Element·Deleted·Eraser`, once per gesture, as before.

## Out of scope

- Erasing PART of a freehand stroke (splitting it where the brush crosses). That is a real feature and a much bigger one: it changes stroke geometry rather than removing elements.
- A "restore what I just erased" brush. Undo already does it, and the second mechanism would have to disagree with undo somewhere.
- Erasing across tabs, or on someone else's screen.
