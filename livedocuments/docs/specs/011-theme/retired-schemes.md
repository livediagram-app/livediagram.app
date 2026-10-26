# Colour schemes outside the catalogue

The built-in catalogue (`THEMES`) is the whole set of colour schemes a tab can name. A scheme leaves it by being
**removed from it**: there is no list of retired schemes that still resolve, and nothing rewrites a tab saved against
an id the catalogue does not hold. Only built-in themes exist: there is no theme builder, no saved-theme list and no
`/api/custom-themes`.

## An id the catalogue does not hold

A tab's `theme` is resolved by `getBuiltInTheme` in `@livedocuments/document`: an id the catalogue does not hold (such
as `charcoal`, `autumn`, `jewel` or a `custom:<uuid>` id) resolves to **Default** in the viewer's half, exactly as a
tab with no `theme` does ([Light and dark halves](light-and-dark.md)). The tab's stored colours are drawn as they are;
nothing is rewritten on read or on save.

## Where a stored tab is settled

`migrateStoredTab` (`packages/document/src/stored-tab.ts`) is the one call every stored-tab entry point runs: the api
worker's tab read (`rowToTab`), the thumbnail render, the offline store's tab load and a file import. It settles tab
fields and element fields that are malformed or written in an older shape; it has no step for colour schemes.
