# Retired colour schemes

A colour scheme leaves the catalogue by leaving `THEMES` (`packages/project/src/themes-data.ts`), never by lingering
as a scheme nobody can pick. liveplanner's plans have only ever been stored against the current catalogue, so it has one
scheme to migrate, UML (below): there is no Charcoal, no previous Default half and no Autumn or Jewel to rewrite. It
also has the rule for a theme id it does not know, and one read-time path every stored tab goes through.

## An id that names nothing

- `resolveTheme(id)` (`apps/editor/lib/themes.ts`) answers `undefined` for an id outside `THEMES`, so a caller that
  must tell "unknown" from "Default" can; `getTheme` and `getBuiltInTheme` (`packages/project/src/themes.ts`) fall back to
  Default, so such a tab draws as Default.
- The telemetry type is the catalogue label; an id with no entry is title-cased, still a preset token
  (`theme-telemetry-label.ts`).

## Custom themes

liveplanner has no custom themes: no builder, no library, no `custom_themes` table and no routes. A `custom:<uuid>` id
is never written. Should one arrive (a file exported from elsewhere), it resolves as any unknown id does, to Default,
and telemetry reports it as Default, never its id.

## UML

UML left this product's catalogue (owner, 2026-11-12, Work Item 696): its colour per shape kind is a diagram notation,
which livediagram keeps. Its definition stays in the shared catalogue data (`@liveworkspace/element-model/themes-data`)
for livediagram, and this product's `THEMES` (`packages/project/src/themes-data.ts`, bound to the
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

## Where it runs

One pure function in `@liveplanner/project`, `migrateStoredTab` (`stored-tab.ts`), settles a stored tab on the way in:
its own fields (`settleTabFields`), a retired background pattern (`migrateRetiredPattern`: Isometric becomes
Crosshatch, [Canvas and palette](../008-canvas/canvas-and-palette.md#retired-features)), a retired theme
(`migrateRetiredTheme`, `retired-themes.ts`: UML becomes Mono, above), the stored-element steps
(`migrateStoredElements`), then diagram keys and stacks. Every place a stored tab enters a reader runs it:

- the api worker's tab read (`rowToTab`), which every editor, share-link and MCP read goes through;
- the api worker's thumbnail and live-image render, which parses `tabs.data` directly (`thumbnail.ts`);
- the offline store's tab load, for projects kept only in this browser;
- a file import (`import-merge.ts`), since an exported file is a stored tab like any other.

`migrateIncomingTab` and `migrateIncomingElements` run the same steps on untrusted input (an api write, a realtime
peer, a paste) before validation; input that makes a step throw is handed back as it came, for validation to refuse.

It runs at read time rather than as a storage migration because the rewrite needs the element model, which a query
over a JSON blob cannot express safely, and because offline projects and files never reach the api's storage.

## Properties

- **Idempotent.** A settled tab settles to itself, and a tab with nothing to change is returned as the same object.
- **Pure.** No I/O, no clock; the same tab always settles the same way.

## Testing

- `packages/project/src/stored-tab.test.ts`, `retired-patterns.test.ts` and `retired-themes.test.ts`: the steps, idempotence, identity when
  nothing changes.
- `apps/editor/lib/themes.test.ts`: a stray id resolves to Default; `apps/api/src/thumbnail.test.ts`: the render runs
  the read path; `apps/editor/lib/import-merge.test.ts`: a file is a stored tab.
