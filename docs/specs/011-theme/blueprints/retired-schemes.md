# Retired schemes: blueprint

Derived from [Retired colour schemes](../retired-schemes.md), with Default's dark half from
[Canvas and palette, Default scheme, dark half](../../008-canvas/canvas-and-palette.md#default-scheme-dark-half). The
spec decides; this file adds engineering precision. Defaults are ledgered in [DEFAULTS.md](DEFAULTS.md) as `Dn`.

Scope, by file:

| File                                                | Role                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/document/src/retired-schemes.ts`          | Frozen retired colours; `retiredSchemeOf`; `migrateRetiredScheme`        |
| `packages/document/src/stored-tab.ts`               | `migrateStoredTab`: retired scheme + stored-element migrations, one call |
| `packages/document/src/themes-data.ts`, `themes.ts` | `LEGACY_THEMES` and the `'charcoal'` `ThemeId` are removed               |
| `apps/live/lib/themes.ts`, `themes-taxonomy.ts`     | Drop the legacy lookup and Charcoal's taxonomy rows                      |
| `apps/api/src/tab-row.ts`                           | `rowToTab` runs `migrateStoredTab`                                       |
| `apps/api/src/thumbnail.ts`                         | `renderTabDataToSvg` runs `migrateStoredTab` on the parsed body          |
| `apps/live/lib/offline/offline-store.ts`            | `offlineLoadTab` runs `migrateStoredTab`                                 |
| `apps/live/lib/import-merge.ts`                     | `mergeImportedTab` runs `migrateStoredTab` on the imported tab first     |

## Domain and naming

| Term                       | Identifier                                                | Meaning                                                   |
| -------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| Retired scheme             | `RetiredScheme` (`'charcoal' \| 'previous-default-dark'`) | Why a tab needs migrating                                 |
| Charcoal's colours         | `CHARCOAL` (frozen record)                                | The id and every colour Charcoal wrote, as shipped        |
| Previous Default dark half | `PREVIOUS_DEFAULT_DARK`                                   | `{ backgroundColor: '#2b2b33', patternColor: '#636373' }` |
| Detection                  | `retiredSchemeOf(tab)`                                    | Which retired scheme a tab is on, or `null`               |
| Scheme migration           | `migrateRetiredScheme(tab)`                               | The rewrite for one tab                                   |
| Stored-tab migration       | `migrateStoredTab(tab)`                                   | Every tab-level migration on the way in                   |

Banned: "legacy theme" (the concept of a resolvable retired scheme is gone), "upgrade" for this rewrite.

## Behaviour and state

`retiredSchemeOf(tab)`:

1. `tab.theme === 'charcoal'` → `'charcoal'`.
2. Else if the tab is on Default (`theme` undefined or `'brand'`) and `backgroundColor === '#2b2b33'` and
   `patternColor === '#636373'` → `'previous-default-dark'`.
3. Else `null`.

`migrateRetiredScheme(tab)`:

- `null` → return `tab` (same object).
- `'charcoal'` → `theme: 'brand'`; elements through `stripCharcoalColours`; then fall into the backdrop rule.
- Backdrop rule (both cases): if the stored backdrop is exactly `PREVIOUS_DEFAULT_DARK`, set it to
  `DEFAULT_SCHEME_DARK`'s `backgroundColor` / `patternColor`. Pattern kind, opacity and scale untouched.

`stripCharcoalColours(el)`, per element:

- For each `{ element, theme }` field in `themeColourFields(el)` (the one table the theme transforms share): delete
  `el[element]` when it equals `CHARCOAL[theme]`.
- Tables additionally: delete `fillColor` when it equals `CHARCOAL.backgroundColor` (the cell fill new tables bake),
  and `textColor` when it equals `CHARCOAL.elementText`.
- Return the same element when nothing was deleted; the array is the same when no element changed.

Invariants:

- **I1 (idempotent):** `migrateRetiredScheme(migrateRetiredScheme(t))` deep-equals `migrateRetiredScheme(t)`, and
  `retiredSchemeOf` of any migrated tab is `null`.
- **I2 (choices kept):** a field whose value differs from Charcoal's for that field survives.
- **I3 (identity):** a tab with nothing to migrate is returned as the same object (callers rely on it to skip work).
- **I4:** `migrateStoredTab` = `migrateRetiredScheme`, then `migrateStoredElements` on the elements.

## Interfaces and contracts

```ts
export type RetiredScheme = 'charcoal' | 'previous-default-dark';
export function retiredSchemeOf(
  tab: Pick<Tab, 'theme' | 'backgroundColor' | 'patternColor'>,
): RetiredScheme | null;
export function migrateRetiredScheme<
  T extends Pick<Tab, 'theme' | 'backgroundColor' | 'patternColor' | 'elements'>,
>(tab: T): T;
export function migrateStoredTab<
  T extends Pick<Tab, 'theme' | 'backgroundColor' | 'patternColor' | 'elements'>,
>(tab: T): T;
```

The generic keeps the api's `Omit<Tab, 'id' | 'name'>` body and the DTO shapes intact. Input is untrusted stored
JSON: a non-array `elements` passes through unchanged (the api already guards with `Array.isArray`), and non-string
colour values never equal a Charcoal hex, so they are kept.

## Data and persistence

| Field                                             | Class  | Migration                              |
| ------------------------------------------------- | ------ | -------------------------------------- |
| `Tab.theme`                                       | Stored | `'charcoal'` → `'brand'`               |
| `Tab.backgroundColor` / `patternColor`            | Stored | Previous dark half → current dark half |
| Element `fillColor` / `strokeColor` / `textColor` | Stored | Charcoal's baked values removed        |

Read-time only (D7). The rewrite persists with the tab's next save; an unsaved tab is migrated again on every read,
which I1 makes harmless. D1 is untouched; snapshots and change-log rows keep what they recorded.

## Errors and edge cases

| Case                                            | Handling                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| Charcoal tab with a recoloured canvas           | `theme` → `brand`; the custom backdrop stays (hand-picked)       |
| Charcoal tab, one element user-coloured         | That field kept (I2)                                             |
| Default tab, only one backdrop colour matches   | Not migrated (already a hand-picked canvas)                      |
| Custom / other scheme with `#2b2b33` canvas     | Not migrated (not on Default)                                    |
| Sticky, image, link card, video                 | Untouched (no theme fields)                                      |
| Accent-bar web component                        | Only its stroke is a theme field, so only a Charcoal stroke goes |
| Element `themeLockFill`                         | Fill is not a theme field for it, so its fill is kept            |
| Missing `elements`                              | Passed through                                                   |
| Realtime peer on an old build pushes `charcoal` | Next read migrates again (I1)                                    |

## Security and trust

Stored tab JSON is untrusted. The migration only deletes fields or writes constants; it never copies a stored value
into a new place, never grows the payload, and cannot throw on malformed input (non-object elements are returned
as-is).

## Performance and limits

One pass over `elements` only when `retiredSchemeOf` is `'charcoal'`; O(1) otherwise. A tab holds at most a few
thousand elements; the pass is well under a millisecond in the worker's CPU budget.

## Observability

`migrateRetiredScheme` logs `console.info('[tab-migrate] retired-scheme', { from, stripped })` when it rewrites,
where `stripped` counts removed fields, following the theme package's `[tag]` convention (D8). Nothing is logged for
a tab with nothing to migrate.

## Testing

| Rule                                                   | Test                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| Detection (three branches)                             | `packages/document/src/retired-schemes.test.ts`, "retiredSchemeOf" |
| Charcoal → Default, baked colours removed              | `retired-schemes.test.ts`, "a Charcoal tab"                        |
| Choices kept (I2), untouched kinds, table cell fill    | `retired-schemes.test.ts`                                          |
| Previous dark half → current; single-colour match kept | `retired-schemes.test.ts`, "Default's previous dark half"          |
| Idempotent (I1), same object (I3)                      | `retired-schemes.test.ts`                                          |
| Composition (I4)                                       | `packages/document/src/stored-tab.test.ts`                         |
| Charcoal no longer resolves or is offered              | `packages/document/src/default-scheme.test.ts`                     |
| api read path                                          | `apps/api/src/tab-row.test.ts`                                     |
| Thumbnail path                                         | `apps/api/src/thumbnail.test.ts`                                   |
| Offline read path                                      | `apps/live/lib/offline/offline-store.test.ts`                      |
| Import path                                            | `apps/live/lib/import-merge.test.ts`                               |

## Constants and configuration

| Constant                | Value                                                                             | Provenance                       |
| ----------------------- | --------------------------------------------------------------------------------- | -------------------------------- |
| `CHARCOAL`              | bg `#2b2b33`, pattern `#636373`, fill `#2c2c33`, stroke `#a1a1aa`, text `#e4e4e7` | As shipped; frozen               |
| `PREVIOUS_DEFAULT_DARK` | bg `#2b2b33`, pattern `#636373`                                                   | Default's dark half before Steel |

These are data about the past and never change.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows D7 and D8.
