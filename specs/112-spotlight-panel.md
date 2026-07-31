# 112 — Spotlight Panel

Status: **implemented**.

While the **Spotlight** tool ([spec/09](09-canvas-and-palette.md)) is active, a **Spotlight** panel is present: the light's size, how dark the shroud is, how soft its edge is, and its shape. The third of the mode panels, after [Avatar](101-avatar-mode.md) and [Laser](111-laser-panel.md).

## Why

Spotlight has exactly two controls today — left-click grows the light, right-click shrinks it — and no way at all to change the two things that decide whether it works in the room you are in: how dark the surround goes, and how big a shape it is lighting.

The defaults suit a dense diagram on a laptop. They are wrong for a projector in daylight (needs a much darker shroud to read at all), wrong for a wide swimlane you want to walk along (a circle lights three lanes and a lot of nothing), and wrong for a screen-share where a hard-edged pool of light looks like a bug rather than an effect. None of that is a permanent preference — it changes with the room, which is why it belongs in a panel that exists only while the tool does.

## Where it lives

A normal floating panel ([spec/63](63-panel-docking.md)) with the same treatment as the Laser Panel: Palette width, homed **top-right under the Palette**, joining and leaving the corner stack with the mode rather than sitting there, and reachable from its own dock button in the minimal / mobile layout. Spotlight itself is desktop-only (it relies on hover and on left/right-click), so in practice the panel is too.

## The settings

Four accordion rows over a **live preview** — a miniature of the shroud with the light in it, drawn from the same recipe the canvas uses, so the effect of "Blackout with a crisp edge" is visible before you inflict it on the room.

- **Size** — Small / Medium / Large (110 / 170 / 280px radius). Clicking on the canvas still grows and shrinks freely; when the radius has been nudged off a preset the row reads **Custom**, so the panel never lies about what the light is doing.
- **Dim** — how dark the surround goes: Soft / Normal / Dark / Blackout (60% / 82% / 92% / 98.5% shroud). Blackout is for a projector, where anything less reads as "slightly grey" and defeats the tool.
- **Edge** — **Soft** (a 60px feathered rim, today's look) or **Crisp** (12px, a defined pool of light). Crisp reads as deliberate on a screen-share; soft reads as lighting.
- **Shape** — **Circle**, or **Wide**: an ellipse about twice as wide as it is tall, for lighting a swimlane, a table row, or a line of boxes without dragging half the diagram into the dark.

## Persistence

Device-local, in `localStorage` (`livediagram:v2:spotlight-config`), like the laser pen and the avatar costume: it depends on your screen and the room, not on the diagram. Never sent to the api, never folded into the synced preferences blob ([spec/20](20-user-preferences.md)).

The RADIUS deliberately stays where it always was — session state on `useSpotlight`, not persisted — because it is the one value the canvas itself changes on every click, and restoring a radius somebody clicked their way to three weeks ago is not a kindness.

## Still local, still not broadcast

Spotlight remains a **view aid for the person using it** ([spec/09](09-canvas-and-palette.md)): peers see the full canvas, unshrouded. So unlike the laser pen, none of this travels — there is nothing on the wire, and the panel says so in a line at the bottom.

## Telemetry

Per [spec/22](22-telemetry.md): changing a setting emits `UI·Changed·SpotlightSize` / `SpotlightDim` / `SpotlightEdge` / `SpotlightShape`, each a preset token.

## Out of scope

- Broadcasting the shroud to the room ("presenter mode" proper). A real one needs consent and an escape hatch for every viewer, which is its own spec.
- A custom shroud colour or tint.
- Locking the light in place, or following the selection rather than the cursor. Both are reasonable, both change what the tool IS rather than how it looks.
