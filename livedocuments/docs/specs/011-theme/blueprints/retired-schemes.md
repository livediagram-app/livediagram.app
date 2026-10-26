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
