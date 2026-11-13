# Schemes outside the catalogue: blueprint

Derived from [Colour schemes outside the catalogue](../retired-schemes.md). The spec decides; this file adds engineering
precision.

Scope, by file:

| File                                   | Role                                                                  |
| -------------------------------------- | --------------------------------------------------------------------- |
| `packages/document/src/themes-data.ts` | `THEMES`: the catalogue; a scheme outside it is simply absent         |
| `packages/document/src/themes.ts`      | `getBuiltInTheme(id, appearance)`: an unknown id resolves to Default  |
| `packages/document/src/stored-tab.ts`  | `migrateStoredTab`: the stored-tab settle, with no colour-scheme step |

## Domain and naming

| Term       | Identifier                    | Meaning                                          |
| ---------- | ----------------------------- | ------------------------------------------------ |
| Catalogue  | `THEMES`                      | Every built-in scheme a tab can name             |
| Default    | `DEFAULT_SCHEME_ID` (`brand`) | The scheme an absent or unknown id resolves to   |
| Unknown id | (none)                        | An id not in `THEMES`; nothing in code names one |

Banned: "legacy theme" (no scheme outside the catalogue resolves), "migration" for a scheme (none runs).

## Behaviour and state

`getBuiltInTheme(id, appearance = 'light')`:

1. `id` undefined or `DEFAULT_SCHEME_ID` → Default's half for `appearance`.
2. Else the `THEMES` entry with that id, in `appearance`'s half.
3. Else Default's half for `appearance`.

So `'charcoal'`, `'autumn'` or `'jewel'` reads as Default. The tab's stored backdrop and element colours are drawn as
stored; nothing is rewritten.

## Data and persistence

Nothing is stored or rewritten for an unknown id. `Tab.theme` keeps whatever id it was saved with.

## Testing

| Rule                                            | Test                                           |
| ----------------------------------------------- | ---------------------------------------------- |
| Charcoal is not offered and resolves to Default | `packages/document/src/default-scheme.test.ts` |
| The stored-tab settle                           | `packages/document/src/stored-tab.test.ts`     |

## Retired UML

Derived from [Retired colour schemes, UML](../retired-schemes.md#uml). Scope, by file:

| File                                                | Role                                                                                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `packages/element-model/src/retired-themes.ts`      | `bindRetiredThemes(retired, deps?)`, the role-by-role rewrite; `UML_AS_RETIRED`, frozen                                          |
| `packages/element-model/src/retired-uml.ts`         | `RETIRED_THEME_IDS` (`uml`), `THEMES` (the shared catalogue less UML), `RETIRED_THEMES` (`uml` to `mono`), `migrateRetiredTheme` |
| `packages/document/src/themes-data.ts`, `themes.ts` | Re-export `THEMES` (and `RETIRED_THEME_IDS`) from `retired-uml` over the shared modules                                          |
| `packages/document/src/retired-themes.ts`           | `packages/document/src/retired-themes.ts` re-exports `migrateRetiredTheme` and `RETIRED_THEMES`                                  |
| `packages/document/src/stored-tab.ts`               | `migrateStoredTab` runs `migrateRetiredTheme` on every read                                                                      |
| `apps/editor/lib/tab-looks.ts`                      | Textbook and Schematic wear `mono`; Textbook sits before Spectrum, Whiteboard after it                                           |
| `../packages/workbench/src/lib/themes-taxonomy.ts`                | `THEME_DESCRIPTIONS` is `Record<Exclude<ThemeId, 'uml'>, string>`: UML has no blurb                                              |

Behaviour, `migrateRetiredTheme(tab)`:

1. `tab.theme` is not an own key of the retired table: return `tab` (the same object).
2. Otherwise `theme` becomes the replacement (`mono`). `backgroundColor` maps through the canvas map and
   `patternColor` through the pattern map; a value with no entry is kept.
3. Each element that is an object: every field `colourFields(el)` names (fill, outline, text, by its role), and an
   arrow's `arrowheadColor` as an outline, is looked up lower-cased in its role's map and replaced when found. An
   element with nothing replaced is returned as the same object.
4. A role's map pairs UML's slots in that role (its own colour, six palette branches, the root) in UML as written, its
   light half and its dark half, index by index, with Mono's slots in the same role as written; the first claim of a
   colour wins. Built once per theme and role, then cached.

Invariants: a migrated tab is on Mono, which nothing retired, so a second pass returns it as the same object; a colour
UML did not paint in that role is kept (a picked colour, and a colour UML gave one shape kind, `shapeColors`, which is
not a slot).

Edge cases: a non-array `elements` and a non-object element pass through; a non-string colour is kept; a tab that
names UML before a read moves it (a live change from an editor opened before the release): the shared `getBuiltInTheme` resolves it from the shared catalogue data (livediagram's UML), so it draws as UML did until the next read; the editor's `resolveTheme` finds nothing and paints Default.

Performance: O(1) for a tab on any other theme; one pass over the elements for a tab on UML, five maps of at most 24
entries per retired theme, built once per Worker or page.

Observability: `console.info('[tab-migrate] retired-theme', { from, to, recoloured })` when a tab is rewritten.

Constants: `UML_AS_RETIRED`, canvas `#ffffff`, pattern `blank` in `#e2e8f0`, fill `#f8fafc`, outline `#334155`, text
`#0f172a`, as shipped on 2026-11-12; data about the past, never changed.

Testing:

| Rule                                                         | Test                                                                        |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Role-by-role rewrite, halves, arrowheads, kept colours, deps | `packages/element-model/src/retired-themes.test.ts`                         |
| The catalogue less UML, every retired id migrated            | `packages/element-model/src/retired-uml.test.ts`                            |
| UML gone here, a stored tab moves to Mono on read            | `packages/document/src/retired-themes.test.ts`                              |
| No look wears UML; Textbook and Schematic draw in Mono       | `apps/editor/lib/tab-looks.test.ts`, `apps/editor/lib/look-preview.test.ts` |
| The editor resolves no theme from `uml`                      | `apps/editor/lib/themes.test.ts`                                            |
