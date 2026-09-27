# Retired colour schemes

A colour scheme leaves the catalogue by being **migrated away on load**, not by lingering as a scheme nobody can pick.
A diagram saved against a retired scheme is rewritten, the moment it is read, into the scheme that replaced it; the
next save persists the rewrite. There is no list of retired schemes that still resolve.

## Charcoal

Charcoal was the neutral dark scheme until it merged into **Default** as Default's dark half
([Live app](../007-editor/live-app.md#appearance-light--dark--system)). Its tabs stored `theme: 'charcoal'`, the
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

## Where it runs

One pure function in `@livediagram/diagram`, `migrateStoredTab`, composes every tab-level migration (this one and the
element migrations: retired groups and docks). Every place a stored tab enters a reader runs it:

- the api worker's tab read (`rowToTab`), which every editor, share-link and MCP read goes through;
- the api worker's thumbnail and live-image render, which parses `tabs.data` directly;
- the offline store's tab load, for diagrams kept only in this browser;
- a file import, since an exported file is a stored tab like any other.

It runs at read time rather than as a D1 migration because the rewrite needs the element model (per-kind colour
fields), which SQL over a JSON blob cannot express safely, and because offline diagrams and files never reach D1.

## Properties

- **Idempotent.** A migrated tab has no Charcoal id and no previous dark-half backdrop, so a second pass changes
  nothing. A tab with nothing to migrate is returned as the same object.
- **Pure.** No I/O, no clock; the same tab always migrates the same way.
- **Lossless for choices.** Only values equal to what the retired scheme wrote are removed.
