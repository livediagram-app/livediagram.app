# Colour schemes outside the catalogue

The built-in catalogue (`THEMES`) is the whole set of colour schemes a tab can name. A scheme leaves it by being
**removed from it**: there is no list of retired schemes that still resolve, and nothing rewrites a tab saved against
an id the catalogue does not hold, with one exception: UML, retired while livediagram keeps it, moves a tab onto Mono
on read (below). Only built-in themes exist: there is no theme builder, no saved-theme list and no
`/api/custom-themes`.

## An id the catalogue does not hold

A tab's `theme` is resolved by `getBuiltInTheme` in `@livedocuments/document`: an id the catalogue does not hold (such
as `charcoal`, `autumn`, `jewel` or a `custom:<uuid>` id) resolves to **Default** in the viewer's half, exactly as a
tab with no `theme` does ([Light and dark halves](light-and-dark.md)). The tab's stored colours are drawn as they are;
nothing is rewritten on read or on save.

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
Rainbow and Sand paint new elements a palette or a warm grey. The rewrite is the one livediagram gives its retired Autumn and Jewel, role by role
(`bindRetiredThemes`, `@liveworkspace/element-model/retired-themes`): `theme` becomes `mono`, and each element colour
field and the backdrop still holding UML's value for its role (in either half) takes Mono's for the same role; a colour
someone picked is kept. A colour UML gave one shape kind (a decision diamond's amber, a datastore cylinder's purple) is
kept too, read as one someone picked: Mono has no colour per kind to map it to, and keeping it keeps the tab
looking as it did. UML is frozen as it left (`UML_AS_RETIRED`, in the same shared module), so a later change to
livediagram's UML never changes this migration.

## Where a stored tab is settled

`migrateStoredTab` (`packages/document/src/stored-tab.ts`) is the one call every stored-tab entry point runs: the api
worker's tab read (`rowToTab`), the thumbnail render, the offline store's tab load and a file import. It settles tab
fields and element fields that are malformed or written in an older shape, and moves a tab off UML onto Mono
(`migrateRetiredTheme`, `retired-themes.ts`, above); it has no other step for colour schemes.
