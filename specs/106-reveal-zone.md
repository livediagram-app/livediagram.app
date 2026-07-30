# 106 — Reveal zone

Status: **implemented**.

A panel that **covers part of the canvas until someone clicks it**. Quiz answers, a retro column nobody should read before they have written their own, an estimate you don't want anchored by the first number on the board.

## Why

A diagram is a shared surface, so everything on it is visible to everyone the moment it exists. That is usually the point, and occasionally exactly wrong: the value of an answer, an estimate, or a set of retro notes depends on people not seeing it too early.

The alternatives all fail in the same way. Hiding a layer hides it from everyone including the author; moving content off-screen is a race against panning; a second tab breaks the flow of the board. A cover you click is the smallest thing that works, and it reads as intentional — "there is something here, and it is not for you yet".

## The element

- A **shape kind**, `reveal`: a frosted panel, drawn ON TOP of whatever it overlaps. It hides nothing structurally — the elements underneath are untouched, unmoved, and still theirs to edit once uncovered.
- It carries its own **label** ("Answers", "Estimates"), so a cover says what it is covering.
- **`ShapeElement.revealed`** is the SHARED state, and it is off by default.

## Two ways to uncover

Deliberately two, because the two cases are different:

1. **Double-click (or double-tap) it — for yourself.** Local, ephemeral, never written to the diagram: the cover goes and a small **Hide** pill appears in its corner so you can put it back. Nobody else's board changes. This is the quiz case: everyone reveals when they are ready.

   **Two presses, not one**, and the face says which ("Double-click to reveal", "Double-tap" on a touch device). A cover exists to stay closed, and on a board where people are dragging things around a stray single click would undo its whole purpose. The Hide pill is a single click: putting the cover back by accident costs nothing. The double press is detected from two clicks in a 450ms window rather than the DOM's `dblclick`, so a tap and a click behave identically — `dblclick` competes with double-tap-to-zoom on touch.

2. **Menu → Reveal for everyone.** Writes `revealed: true`, so it syncs, persists, and undoes like any other change. This is the facilitator case: the estimates come off together. **Hide for everyone** puts it back.

A locally-revealed cover that is then revealed for everyone stays revealed; a local reveal is forgotten on reload, which is the right default for something whose whole job is to be closed to begin with.

## What it is not

- **Not a permission.** Anything underneath is in the document, so it is in the export, in the API response, and visible to anyone who moves the cover aside. A reveal zone hides content from a reader's eye, not from a determined reader — the tooltip says as much, and this spec is the honest record of it. Real secrets do not belong on a shared canvas.
- Not a layer. Layers ([spec/74](74-layers.md)) hide content for the person who toggles them, permanently and for editing too; a cover is about timing, not workspace.

## Telemetry

Per [spec/22](22-telemetry.md): adding one emits `Element·Added·Reveal`; revealing for everyone emits `Element·Changed·Reveal`. A local click is not tracked — it is reading, and the event would fire on every glance.

## Out of scope

- A password on a cover, or per-person reveal rules. See "not a permission".
- Auto-reveal on a timer. Tempting next to [spec/105](105-session-button.md)'s timer button, but a cover that opens itself while someone is mid-thought is a worse default than a facilitator clicking it.
- Blurring the pixels underneath rather than covering them. Prettier, and it would make the "not a permission" line a lie by implying the content isn't there.
