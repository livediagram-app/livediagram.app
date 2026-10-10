# Laser Panel

Status: **implemented**.

While the **Laser** tool ([Canvas and palette](canvas-and-palette.md)) is active, a **Laser** panel is present: the pen's settings — width, colour, trail length, and effect. The same relationship the [Avatar Panel](avatar-mode.md) has with Avatar mode.

## Why

The laser is the presenting tool, and presenting is where one size fits nobody. A hairline red beam is right for pointing at a line of code on a shared screen; a fat glowing stroke is right for a projector in a bright room; a slow-fading trail is right when you are drawing a shape in the air ("this whole cluster here") rather than pointing at a spot.

None of that is worth a settings dialog, and none of it should be a permanent preference buried in Settings either — you change it for the room you are in. A panel that exists only while the tool does puts the controls exactly where the intent is.

## Where it lives

A normal corner panel ([Panel corner docking](../007-editor/panel-docking.md)): draggable, dockable to any corner, the standard panel width, homed **top-right**. Like the Poll / Vote / Avatar panels it exists only while its mode does, so it joins and leaves the corner stack rather than sitting there. It docks in its corner on a desktop and a phone alike. View-role visitors get it — the laser is theirs too.

## The settings

Four, each a single-open accordion row with its current value in the collapsed header, over a live **preview stroke** that draws with the current settings.

- **Width** — Fine / Medium / Bold (2 / 3.5 / 6 canvas px). Constant on screen at any zoom, like the trail itself.
- **Colour** — a row opening the one [colour picker](../004-interface-design/colour-picker.md) in a popover beside it (the picker is wider than the panel): **Your colour** first (the default: the participant colour that already ties your cursor, your name chip, and your avatar's shirt together), then the strong standard colours, stored by name and drawn in their version for the canvas, then Custom colours and **Add a custom colour** (four coloured dots) for a custom colour. A presenter on a dark canvas needs a laser that reads against it, which their identity colour cannot promise. A pen saved with an earlier colour reads Cyan as Teal and White as Ink.
- **Trail** — how long a sample lives before it fades out: Quick (400ms) / Normal (1s, today's behaviour) / Long (2.5s). Long is what turns the laser from a pointer into something you can draw a shape with.
- **Effect** — **Beam** (the plain line + head dot), **Glow** (a soft wide halo under the stroke, for projectors), **Comet** (the stroke tapers from head to tail, so the direction of travel reads), **Spark** (a dotted trail rather than a continuous line).

## Everyone sees your pen

The look **travels with the trail**. Each `laser` op carries a compact `look` (width / colour / trail / effect tokens), and receivers keep the latest one per participant — so a presenter's bold amber comet looks the same on every screen, which is the entire point of a shared pointer.

It rides the existing op rather than a second one: the alternative (a separate look packet) needs ordering against the samples it describes, and the tokens cost a couple of dozen bytes on a packet that is already throttled to ~30 Hz. Receivers parse it **field by field with fallbacks**, like the avatar costume, so an unrecognised token from a newer client costs that one field rather than the whole trail.

## Persistence

Device-local, in `localStorage` (`livediagram:v2:laser-config`), like the avatar costume and the panel placements: which pen suits you depends on your screen and the room you present in, not on the document. It is never sent to the api and never folded into the synced preferences blob ([User preferences](../007-editor/user-preferences.md)).

## Telemetry

Per [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md): changing a setting emits `UI·Changed·LaserWidth` / `LaserColour` / `LaserTrail` / `LaserEffect`. The event names only which setting changed, never the colour itself.

## Out of scope

- Persisting a pen per document or per team. It is a personal, per-device ergonomic choice.
- A laser that leaves permanent marks. That is the Pencil ([Canvas and palette](canvas-and-palette.md)) — the laser's whole nature is that it fades.
- Pointer sounds, click-to-ping, or a "laser cursor" for peers who aren't presenting.
