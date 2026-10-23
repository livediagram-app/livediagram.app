# Retired colour schemes

A colour scheme leaves the catalogue by being **removed from it**. There is no list of retired schemes that still
resolve, and nothing rewrites a tab saved against one: livedocuments started with no stored documents, so no tab holds
a scheme that has since gone.

## What has left

- **Charcoal**, the neutral dark scheme, merged into **Default** as Default's dark half
  ([Editor app](../007-editor/editor-app.md#appearance-light--dark--system)).
- **Default's dark half** is the blue-slate `#0d121a` with a `#1c2735` grid
  ([Canvas and palette](../008-canvas/canvas-and-palette.md#default-scheme-dark-half)).
- **Default's light half** is the off-white `#fbfaf7` with a `#cbd5e1` grid.
- **Autumn and Jewel** left the catalogue, being too close to other multi-colour themes
  ([Light and dark halves](light-and-dark.md#retired-autumn-and-jewel)).
- **Custom themes**, the ones a person built and saved to their account (`custom:<uuid>` ids), were removed: only
  built-in themes exist, and there is no builder, no saved-theme list and no `/api/custom-themes`. A tab that still
  names a `custom:` id resolves as any other id the catalogue does not hold (below).

## An id the catalogue does not hold

A tab's `theme` is resolved by `getBuiltInTheme` in `@livedocuments/document`: an id the catalogue (`THEMES`) does
not hold, a retired one included, resolves to **Default** in the viewer's half, exactly as a tab with no `theme` does.
The tab's stored colours are drawn as they are; nothing is rewritten on read or on save.

## Where a stored tab is settled

`migrateStoredTab` (`packages/document/src/stored-tab.ts`) is the one call every stored-tab entry point runs: the api
worker's tab read (`rowToTab`), the thumbnail render, the offline store's tab load and a file import. It settles tab
fields and element fields that are malformed or written in an older shape; it has no step for colour schemes.
