# Retired colour schemes

**Status: removed from liveplanner (2026-10-24).** liveplanner's plans have only ever been stored in the current shapes (each plan in its own Durable Object since 2026-10-23, with nothing carried over), so the read-time migrations this describes had nothing to read and are gone from `packages/project` (`stored-tab.ts` and `stored-elements.ts` no longer call them). It records what livediagram retired.

A colour scheme leaves the catalogue by being **migrated away on load**, not by lingering as a scheme nobody can pick.
A project saved against a retired scheme is rewritten, the moment it is read, into the scheme that replaced it; the
next save persists the rewrite. There is no list of retired schemes that still resolve.

## Charcoal

Charcoal was the neutral dark scheme until it merged into **Default** as Default's dark half
([Editor app](../007-editor/editor-app.md#appearance-light--dark--system)). Its tabs stored `theme: 'charcoal'`, the
backdrop `#2b2b33` with a `#636373` grid, and baked colours on their elements: fill `#2c2c33`, stroke `#a1a1aa`, text
`#e4e4e7` (arrows: stroke `#a1a1aa`).

On load, a Charcoal tab becomes a Default tab that follows each viewer's appearance:

- `theme` becomes Default (`brand`).
- Every element colour field that still holds Charcoal's baked value for that field is **removed**, so the element
  takes the canvas's ink (a dark viewer sees the dark ink, a light viewer the light ink). The fields are the ones a
  scheme writes (fill, stroke and text on shapes; fill and stroke on sketches and annotations; text on text
  elements; stroke and text on tables; stroke on arrows). A table's cell fill baked to Charcoal's backdrop is
  removed too.
- A colour the user picked (any other value) is **kept**: it was a choice, and a choice outranks a migration.
- Element kinds a scheme never paints (sticky notes, images, link cards, videos) are untouched.
- The backdrop is handled by the Default dark-half rule below, so an untouched Charcoal canvas follows the viewer
  too, and a canvas the user recoloured keeps its colour.

## Default's previous dark half

Default's dark half changed from `#2b2b33` / `#636373` to the blue-slate `#0d121a` / `#1c2735`
([Canvas and palette](../008-canvas/canvas-and-palette.md#default-scheme-dark-half)). A Default tab whose stored backdrop
is exactly the previous dark half (both colours) is rewritten to the current dark half on load, so it keeps being
recognised as "still on the scheme" and follows the viewer. A tab with only one of the two colours matching was
already a hand-picked canvas and is left alone.

## Default's previous light half

Default's light half changed from white `#ffffff` to the off-white `#fbfaf7`, keeping its `#cbd5e1` grid
([Editor modes](../007-editor/editor-modes.md#one-look)). A Default tab whose stored backdrop is white with that grid
(or no stored grid colour) is rewritten to the current light half on load, so it keeps following the viewer. A white
canvas with another grid colour, or on another scheme, was a choice and is left alone.

## Autumn and Jewel

Autumn and Jewel left the catalogue ([Light and dark halves](light-and-dark.md#retired-autumn-and-jewel)). On load a tab
on Autumn becomes Tropical and a tab on Jewel becomes Rainbow: `theme` is rewritten, and every element colour field
still holding the retired theme's value for that role (its fill, outline, text, or a palette branch's) takes the new
theme's value for the same role. A colour the user picked is kept. The backdrop follows the same rule: a canvas or
pattern colour still equal to the retired theme's becomes the new theme's.

## Custom themes

People could once build and save their own themes. They are gone, and nothing of them is kept: the `custom_themes`
table, its routes, the builder and the Themes library were deleted, not exported. A tab saved on one still names it as
`custom:<uuid>`, and so can a file exported while they were here. On read the tab moves to Default (`dropCustomTheme`
in packages/project/src/retired-custom-themes.ts): `theme` becomes Default and the canvas takes Default's backdrop
and grid. Element colours are kept as they are: with the theme's definition gone nothing can tell a colour it painted
from one somebody picked, so each reads as picked, which is how it already looked. Swatch overrides stored for a
`custom:` id are dropped as the preferences are read, and telemetry never reports one as a theme.

## Where it runs

One pure function in `@liveplanner/project`, `migrateStoredTab`, composes every tab-level migration (this one and the
element migrations: retired groups and docks). Every place a stored tab enters a reader runs it:

- the api worker's tab read (`rowToTab`), which every editor, share-link and MCP read goes through;
- the api worker's thumbnail and live-image render, which parses `tabs.data` directly;
- the offline store's tab load, for projects kept only in this browser;
- a file import, since an exported file is a stored tab like any other.

It runs at read time rather than as a SQL migration because the rewrite needs the element model (per-kind colour
fields), which SQL over a JSON blob cannot express safely, and because offline projects and files never reach the api's storage.

## Properties

- **Idempotent.** A migrated tab has no Charcoal id and no previous dark- or light-half backdrop, so a second pass
  changes nothing. A tab with nothing to migrate is returned as the same object.
- **Pure.** No I/O, no clock; the same tab always migrates the same way.
- **Lossless for choices.** Only values equal to what the retired scheme wrote are removed.
