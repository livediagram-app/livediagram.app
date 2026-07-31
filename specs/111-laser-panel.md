# 111 — Laser Panel

Status: **implemented**.

While the **Laser** tool ([spec/09](09-canvas-and-palette.md)) is active, a **Laser** panel is present: the pen's settings — width, colour, trail length, and effect. The same relationship the [Avatar Panel](101-avatar-mode.md) has with Avatar mode.

## Why

The laser is the presenting tool, and presenting is where one size fits nobody. A hairline red beam is right for pointing at a line of code on a shared screen; a fat glowing stroke is right for a projector in a bright room; a slow-fading trail is right when you are drawing a shape in the air ("this whole cluster here") rather than pointing at a spot.

None of that is worth a settings dialog, and none of it should be a permanent preference buried in Settings either — you change it for the room you are in. A panel that exists only while the tool does puts the controls exactly where the intent is.

## Where it lives

A normal floating panel ([spec/63](63-panel-docking.md)): draggable, dockable to any corner, **the same width as the Palette**, homed **top-right under the Palette** where the tool picker that opened it lives. Like the Poll / Vote / Avatar panels it exists only while its mode does, so it joins and leaves the corner stack rather than sitting there. In the **minimal panel layout and on mobile** it is one of the dock buttons, opening as a popover under its own button. View-role visitors get it — the laser is theirs too.

## The settings

Four, each a single-open accordion row with its current value in the collapsed header, over a live **preview stroke** that draws with the current settings.

- **Width** — Fine / Medium / Bold (2 / 3.5 / 6 canvas px). Constant on screen at any zoom, like the trail itself.
- **Colour** — **Your colour** (the default: the participant colour that already ties your cursor, your name chip, and your avatar's shirt together) plus a small fixed palette (red, orange, yellow, green, cyan, blue, violet, white). A presenter on a dark diagram needs a laser that reads against it, which their identity colour cannot promise.
- **Trail** — how long a sample lives before it fades out: Quick (400ms) / Normal (1s, today's behaviour) / Long (2.5s). Long is what turns the laser from a pointer into something you can draw a shape with.
- **Effect** — **Beam** (the plain line + head dot), **Glow** (a soft wide halo under the stroke, for projectors), **Comet** (the stroke tapers from head to tail, so the direction of travel reads), **Spark** (a dotted trail rather than a continuous line).

## Everyone sees your pen

The look **travels with the trail**. Each `laser` op carries a compact `look` (width / colour / trail / effect tokens), and receivers keep the latest one per participant — so a presenter's bold amber comet looks the same on every screen, which is the entire point of a shared pointer.

It rides the existing op rather than a second one: the alternative (a separate look packet) needs ordering against the samples it describes, and the tokens cost a couple of dozen bytes on a packet that is already throttled to ~30 Hz. Receivers parse it **field by field with fallbacks**, like the avatar costume, so an unrecognised token from a newer client costs that one field rather than the whole trail.

## Persistence

Device-local, in `localStorage` (`livediagram:v2:laser-config`), like the avatar costume and the panel layout: which pen suits you depends on your screen and the room you present in, not on the diagram. It is never sent to the api and never folded into the synced preferences blob ([spec/20](20-user-preferences.md)).

## Telemetry

Per [spec/22](22-telemetry.md): changing a setting emits `UI·Changed·LaserWidth` / `LaserColour` / `LaserTrail` / `LaserEffect`. The colour VALUE is a preset token, never a hex the user typed — there is no custom colour here, deliberately: it would be one more thing to get wrong mid-presentation.

## Out of scope

- A custom colour picker. The eight presets plus "your colour" cover the need; the panel is meant to be usable while someone is talking.
- Persisting a pen per diagram or per team. It is a personal, per-device ergonomic choice.
- A laser that leaves permanent marks. That is the Pencil ([spec/09](09-canvas-and-palette.md)) — the laser's whole nature is that it fades.
- Pointer sounds, click-to-ping, or a "laser cursor" for peers who aren't presenting.
