# Retired colour schemes

A colour scheme leaves the catalogue by being **migrated away on load**, not by lingering as a scheme nobody can pick.
A document saved against a retired scheme is rewritten, the moment it is read, into the scheme that replaced it; the
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
([Editor modes](../007-editor/editor-modes.md)). A Default tab whose stored backdrop is white with that grid
(or no stored grid colour) is rewritten to the current light half on load, so it keeps following the viewer. A white
canvas with another grid colour, or on another scheme, was a choice and is left alone.

## Autumn and Jewel

Autumn and Jewel left the catalogue ([Light and dark halves](light-and-dark.md#retired-autumn-and-jewel)). On load a tab
on Autumn becomes Tropical and a tab on Jewel becomes Rainbow: `theme` is rewritten, and every element colour field
still holding the retired theme's value for that role (its fill, outline, text, or a palette branch's) takes the new
theme's value for the same role, field by field (a fill to a fill, an outline or an arrowhead to an outline, text to
text). Only the fields a theme paints on that kind change (`themeColourFields`), so a sticky note and a retired diagram
kind keep every colour they stored. A colour the user picked is kept. The backdrop follows the same rule: a canvas or
pattern colour still equal to the retired theme's becomes the new theme's.

## UML

UML left this product's catalogue (owner, 2026-11-12, Work Item 696): its colour per shape kind is a diagram notation,
which livediagram keeps. Its definition stays in the shared catalogue data (`@liveworkspace/element-model/themes-data`)
for livediagram, and this product's `THEMES` (`packages/document/src/themes-data.ts`, bound to the
shared `@liveworkspace/element-model/retired-uml`) leaves it out, so no theme picker,
Mashup or agent schema offers it.

On load a tab on UML becomes **Mono**, the scheme nearest UML's colours (CIEDE2000, light half): the same white canvas,
blank pattern, pattern colour and text; a white element fill for UML's `#f8fafc` (1.6, too close for an eye to tell
apart); and a darker outline, slate 900 `#0f172a` for slate 700 `#334155` (13.5). In the dark half every role is within
2.1. Steel keeps UML's outline but greys the canvas and fill (3.2 and 4.9) and darkens the pattern colour (18.6), and
Rainbow and Sand paint new elements a palette or a warm grey. The rewrite is the one Autumn and Jewel take, role by role
(`bindRetiredThemes`, `@liveworkspace/element-model/retired-themes`): `theme` becomes `mono`, and each element colour
field and the backdrop still holding UML's value for its role (in either half) takes Mono's for the same role; a colour
someone picked is kept. livehuddle's retired diagram kinds keep every colour they stored, a theme's included
([Not in livehuddle](../002-project-scope/not-in-livehuddle.md)), so only the base colours change. UML is frozen as it left (`UML_AS_RETIRED`, in the same shared module), so a later change to
livediagram's UML never changes this migration.

## Custom themes

There are no custom themes (a person's own saved schemes). A tab that stores `theme: 'custom:<uuid>'`, and a `.livehuddle.json` file exported then carries the same id. On load such
a tab becomes a Default tab:

- `theme` becomes Default (`brand`).
- The backdrop becomes Default's: canvas `#fbfaf7`, a `#cbd5e1` grid, no pattern opacity, so it follows each viewer's
  appearance like any untouched Default canvas.
- Element colours are **kept**. With the definition gone nothing can tell a colour the theme painted from one somebody
  picked, so every one reads as picked, which is also how the tab already looked.

Only the tab's own fields change, so the check costs the same whatever the tab holds: one prefix test on `theme`, and
one shallow copy of the tab when it matches.

## Where it runs

One pure function in `@livehuddle/document`, `migrateStoredTab`, composes every tab-level migration (this one and the
element migrations: retired groups and docks). Every place a stored tab enters a reader runs it:

- the api worker's tab read (`rowToTab`), which every editor, share-link and API read goes through;
- the api worker's thumbnail and live-image render, which parses `tabs.data` directly;
- the offline store's tab load, for documents kept only in this browser;
- a file import, since an exported file is a stored tab like any other;
- a tab arriving from outside (an api write, a realtime peer), through `migrateIncomingTab`, before validation.

It runs at read time rather than as a storage migration because the rewrite needs the element model (per-kind colour
fields), which SQL over a JSON blob cannot express safely, and because offline documents and files never reach the server.

## Properties

- **Idempotent.** A migrated tab has no Charcoal, Autumn, Jewel, UML or `custom:` id and no previous dark- or light-half backdrop, so a second pass
  changes nothing. A tab with nothing to migrate is returned as the same object.
- **Pure.** No I/O, no clock; the same tab always migrates the same way.
- **Lossless for choices.** Only values equal to what the retired scheme wrote are removed.
