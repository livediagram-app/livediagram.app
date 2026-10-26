# Retired colour schemes

A colour scheme leaves the catalogue by leaving `THEMES` (`packages/project/src/themes-data.ts`), never by lingering
as a scheme nobody can pick. liveplanner's plans have only ever been stored against the current catalogue, so it has no
scheme to migrate: there is no Charcoal, no previous Default half and no Autumn or Jewel to rewrite. What it does have
is the rule for a theme id it does not know, and one read-time path every stored tab goes through.

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

## Where it runs

One pure function in `@liveplanner/project`, `migrateStoredTab` (`stored-tab.ts`), settles a stored tab on the way in:
its own fields (`settleTabFields`), a retired background pattern (`migrateRetiredPattern`: Isometric becomes
Crosshatch, [Canvas and palette](../008-canvas/canvas-and-palette.md#retired-features)), the stored-element steps
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

- `packages/project/src/stored-tab.test.ts` and `retired-patterns.test.ts`: the steps, idempotence, identity when
  nothing changes.
- `apps/editor/lib/themes.test.ts`: a stray id resolves to Default; `apps/api/src/thumbnail.test.ts`: the render runs
  the read path; `apps/editor/lib/import-merge.test.ts`: a file is a stored tab.
