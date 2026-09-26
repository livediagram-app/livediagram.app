# Multi-colour themes: blueprint

Derived from [Multi-colour (rainbow) themes](../multicolour-themes.md), with the api rule from
[Custom themes](../custom-themes.md). The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                              | Role                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `packages/diagram/src/hierarchy.ts`               | The branch walk: `assignBranches`, `branchOfArrow`, `ROOT_BRANCH` |
| `packages/diagram/src/theme-graph.ts`             | The four wrappers and the per-element branch resolution           |
| `packages/diagram/src/themes-data.ts`             | The five built-in multi-colour themes                             |
| `packages/diagram/src/colors.ts`                  | `contrastRatio`, the WCAG contrast helper (D3)                    |
| `apps/api/src/routes/custom-themes.ts`            | The empty-palette rejection                                       |
| `apps/live/components/primitives/ThemeSwatch.tsx` | The card preview                                                  |

## Domain and naming

One term, one identifier. The left column is the only spelling used in code, tests and logs.

| Term             | Identifier                                     | Meaning                                                  |
| ---------------- | ---------------------------------------------- | -------------------------------------------------------- |
| Palette          | `ThemeDefinition.palette: ThemePaletteEntry[]` | Ordered branch colours                                   |
| Palette entry    | `ThemePaletteEntry`                            | One `{ fill, stroke, text }` triple                      |
| Trunk colour     | `ThemeDefinition.rootColor`                    | Colour of roots, rootless and new elements               |
| Branch index     | `number`, `0..n-1`                             | Which palette entry a limb takes, before wrapping        |
| Trunk            | `ROOT_BRANCH` (`-1`)                           | The sentinel branch index for the trunk colour           |
| Branch map       | `Map<ElementId, number>`                       | Result of `assignBranches`                               |
| Hierarchy edge   | (internal)                                     | A pinned arrow between two distinct boxed elements       |
| Root             | (internal)                                     | Boxed element with an outgoing edge and no incoming edge |
| Loose element    | (internal)                                     | Boxed element that no hierarchy edge touches             |
| Rootless element | (internal)                                     | Element in the graph that no root reaches                |
| Palette theme    | `theme.palette !== undefined`                  | A multi-colour theme                                     |

Banned synonyms: "rainbow theme" outside user-facing labels, "colour group", "hue index". Also "lane",
which is an element kind ([Lane](../../009-elements/lane.md)).

## Behaviour and state

The walk holds no state between calls. It is a pure function of the element list.

### `assignBranches(elements)`

1. **Boxed set.** Collect the ids of every element for which `isBoxed(el)` holds.
2. **Edges.** For each arrow, in document order, add the edge `from.elementId → to.elementId`
   only if all of these hold. Otherwise skip the arrow.
   - Both endpoints have `kind === 'pinned'`.
   - The two ids differ (a self-loop adds nothing).
   - Both ids are in the boxed set.
3. **Graph sets.** `children` maps a parent to its children in edge order. `hasParent` holds every
   child. `inGraph` holds both ends of every edge.
4. **Roots.** Walk the elements in document order. A boxed element in `inGraph` but not in
   `hasParent` is a root:
   - It gets `ROOT_BRANCH` and is marked visited.
   - Each of its children that isn't yet visited seeds the next branch index. The whole reachable
     subtree is painted with that index, and then the counter increments.
5. **Paint.** Walk the subtree depth first with an explicit stack, never recursion (D4). An already
   visited node is skipped, so a shared or diamond descendant keeps the first index that reached it.
6. **Loose.** Walk the elements again in document order. A boxed element not in `inGraph` and not
   yet in the map takes the next index from the same counter. It's shared with step 4, so hues may
   repeat, as the spec accepts.
7. **Rootless.** Every id in `inGraph` still missing from the map gets `ROOT_BRANCH`.

Invariants, each asserted by a test:

- **I1:** every boxed element has exactly one entry, and no arrow has one.
- **I2:** every value lies in `[ROOT_BRANCH, count)`, where `count` is the number of indices issued.
- **I3:** the result is deterministic for the same input.
- **I4:** no input within `MAX_ELEMENTS_PER_TAB` throws.

### `branchOfArrow(arrow, branches)`

The arrow takes the `to` element's branch when that end is pinned and in the map. Failing that, it
takes the `from` element's branch on the same terms. Otherwise it takes `ROOT_BRANCH`.

### Resolving a colour (`branchEntryFor`)

- If the index is `ROOT_BRANCH`, use `rootColor`. When `rootColor` is absent, build it from
  `elementFill` / `elementStroke` / `elementText`, and replace any null field with the matching
  `TRUNK_FALLBACK` field.
- If the palette is empty, use the trunk colour and warn (O2).
- Otherwise use `palette[((i % len) + len) % len]`.

### Wrappers

`recolourElementsForTheme`, `switchThemeElements`, `resetThemeElementsToTheme` and
`resetArrowsToTheme` each compute the branch map once per call, and only for a palette theme. For a
single-colour theme they fall through to the per-element helpers.

`switchThemeElements` builds one map and shares it when both `prev` and `next` are palette themes
(D6). The map depends only on `elements`, so sharing it is exact.

New elements: `deriveNewBoxedColours` (in `apps/live/lib/themes.ts`) gives a palette theme's new
element the trunk colour, and never runs the walk.

## Interfaces and contracts

Unchanged signatures:

```ts
export const ROOT_BRANCH = -1;
export function assignBranches(elements: Element[]): Map<ElementId, number>;
export function branchOfArrow(
  arrow: Extract<Element, { type: 'arrow' }>,
  branches: Map<ElementId, number>,
): number;
export function recolourElementsForTheme(elements: Element[], theme: ThemeDefinition): Element[];
export function switchThemeElements(
  elements: Element[],
  prev: ThemeDefinition,
  next: ThemeDefinition,
): Element[];
export function resetThemeElementsToTheme(elements: Element[], theme: ThemeDefinition): Element[];
export function resetArrowsToTheme(elements: Element[], theme: ThemeDefinition): Element[];
```

New, in `packages/diagram/src/colors.ts` (D3):

```ts
// WCAG 2.2 contrast ratio of two #rrggbb colours, in [1, 21]; order-independent.
export function contrastRatio(a: string, b: string): number;
```

The helper returns `NaN` when either argument isn't `#rrggbb`, reusing `hexToRgb`, which returns
null. A `NaN` fails every `>=` comparison, so the contrast test cannot pass on a malformed colour.

The api's `POST` and `PUT /api/custom-themes` both check every incoming `definition`:

| Condition                                                              | Response | Body                               |
| ---------------------------------------------------------------------- | -------- | ---------------------------------- |
| `Array.isArray(definition.palette) && definition.palette.length === 0` | 400      | `badRequest('empty palette')` (D5) |
| `palette` absent                                                       | continue |                                    |
| `palette` non-empty                                                    | continue |                                    |

The check sits beside `themeTooLarge`, in a `themeInvalid(definition)` helper that both handlers
call before any database write.

## Data and persistence

- **Static data.** The `palette` and `rootColor` of built-in themes live in
  `packages/diagram/src/themes-data.ts` and ship in the bundle.
- **Persisted.** The `palette` and `rootColor` of a custom theme live in `custom_themes.definition`
  (D1, JSON text).
- **Never persisted.** The branch map is derived on every apply and never stored. An element stores
  only the resolved colours the wrapper wrote.
- **No migration.** The rejection applies on write only. A row already holding `palette: []` stays
  readable and renders in the trunk colour with a warning (E5).

## Errors and edge cases

| #   | Case                                       | Handling                                                                            |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| E1  | Arrow with a free endpoint                 | Not an edge                                                                         |
| E2  | Arrow pinned to another arrow, or dangling | Not an edge                                                                         |
| E3  | Self-loop                                  | Not an edge                                                                         |
| E4  | Loop with no root                          | Every node gets the trunk colour (step 7)                                           |
| E5  | Empty palette at render                    | Trunk colour for every element, O2 warning                                          |
| E6  | Empty palette at the api                   | 400 `empty palette`, no write                                                       |
| E7  | Palette theme without `rootColor`          | Element colours, then `TRUNK_FALLBACK` per null field                               |
| E8  | Chain of `MAX_ELEMENTS_PER_TAB` elements   | Iterative walk, no throw (I4)                                                       |
| E9  | More branches than palette entries         | Index wraps modulo the palette length                                               |
| E10 | Loose element after a wrap                 | Shares a limb's hue, which is accepted                                              |
| E11 | Shared or diamond descendant               | Keeps the first index that reached it                                               |
| E12 | Unknown or deleted theme id                | Out of this blueprint: `getTheme` falls back ([Custom themes](../custom-themes.md)) |

## Security and trust

- **Trust boundary.** A custom palette arrives only through the api. A caller can be a guest, a
  signed-in user, an API token or MCP.
- **Size.** `MAX_THEME_DEF_BYTES` (256 KiB) caps the definition, and with it the palette length.
  Rendering reads at most one entry per element, so a long palette costs nothing extra.
- **Content.** Colour strings aren't validated as colours. That gap belongs to
  [Custom themes](../custom-themes.md) and is out of this blueprint's scope. A non-colour string
  reaches only SVG/CSS colour attributes, which ignore invalid values.

## Performance and limits

- **Walk cost.** `O(n + e)` time and `O(n)` memory, where `n ≤ MAX_ELEMENTS_PER_TAB` (10,000).
  Measured on the recursive walk: 7.8 ms for a 10,000-element chain.
- **Why the walk is iterative.** The recursive walk overflows V8's default stack at a chain between
  8,000 and 9,000 elements (node 24), inside the tab limit. Browsers differ, so an explicit stack is
  the only safe choice (D4).
- **Calls per apply.** One branch map per wrapper call. A theme switch runs `switchThemeElements`
  and `resetArrowsToTheme`, so it builds two maps. That is acceptable at 10,000 elements.

## Web experience

- **INP.** Applying a theme is one interaction. The two walks plus the per-element repaint stay
  well inside the 200 ms INP budget at the tab limit.
- **LCP and CLS.** Unaffected: the swatch has a fixed box height per size.

## Presentation and UX

`ThemeSwatch` draws a three-node miniature diagram:

- A palette theme's nodes take `palette[0]`, `palette[1 % len]` and `palette[2 % len]`.
- A single-colour theme's nodes all take its element colours.
- An empty palette falls through to the single-colour rendering.

There is no loading state and no error state: the swatch is computed synchronously from the theme.

## Accessibility

- **Contrast.** Every built-in palette entry and `rootColor` keeps `contrastRatio(text, fill) ≥
MIN_TEXT_CONTRAST`. Measured today, the lowest is 6.38.
- **Swatch.** It is `aria-hidden`, and the card's visible text names the theme.
- **Not covered.** Custom palettes aren't contrast-checked. The spec scopes the rule to built-ins.

## Observability

Each fingerprint is a fixed prefix plus `key=value` pairs.

| #   | Where                                     | Level          | Fingerprint                                                   |
| --- | ----------------------------------------- | -------------- | ------------------------------------------------------------- |
| O1  | Each wrapper, palette theme only (D1, D2) | `console.info` | `[theme-graph] <op> theme=<id> elements=<n> branches=<count>` |
| O2  | `branchEntryFor`, empty palette (D2)      | `console.warn` | `[theme-graph] empty palette theme=<id>, painting trunk`      |
| O3  | api, rejected write                       | `console.warn` | `[custom-themes] rejected id=<id> reason=empty-palette`       |

- `<op>` is one of `recolour`, `switch`, `reset`, `reset-arrows`.
- `assignBranches` never logs.
- O2 fires at most once per wrapper call.

## Testing

Each spec rule maps to one test, and every test is deterministic.

| Rule                                                     | Test                                                            | File                                        |
| -------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------- |
| Box-to-box edges only (E1–E3)                            | free endpoint; arrow-to-arrow and dangling pins; self-loop      | `hierarchy.test.ts`                         |
| Roots seed branches in document order                    | root with three children                                        | `hierarchy.test.ts` (exists)                |
| Subtree shares one index                                 | deep subtree                                                    | `hierarchy.test.ts` (exists)                |
| Diamond keeps first index (E11)                          | two parents                                                     | `hierarchy.test.ts` (exists)                |
| Loose elements continue the counter (E10)                | root + 2 branches + loose ⇒ index 2                             | `hierarchy.test.ts`                         |
| Rootless loop is trunk (E4)                              | A→B→C→A                                                         | `hierarchy.test.ts`                         |
| Depth limit (E8, I4)                                     | chain of `MAX_ELEMENTS_PER_TAB`, no throw, every node branch 0  | `hierarchy.test.ts`                         |
| Invariants I1–I3                                         | mixed fixture: arrows absent; range; two runs equal             | `hierarchy.test.ts`                         |
| Arrow colour follows `to`, then `from`, then trunk       | three cases                                                     | `hierarchy.test.ts` (exists)                |
| `rootColor` fallback (E7)                                | palette theme without `rootColor`; one null field               | `theme-graph.test.ts` (new)                 |
| Empty palette paints trunk + O2 (E5)                     | spy `console.warn`                                              | `theme-graph.test.ts`                       |
| Wrap modulo (E9)                                         | 7 branches on a 6-entry palette                                 | `theme-graph.test.ts`                       |
| Switch shares one map (D6)                               | `switchThemeElements` result equals two-map result              | `theme-graph.test.ts`                       |
| O1 logged once per palette call, never for single-colour | spy `console.info`                                              | `theme-graph.test.ts`                       |
| `contrastRatio`                                          | black/white = 21; equal = 1; order-independent; malformed = NaN | `colors.test.ts`                            |
| Built-in contrast ≥ 4.5                                  | every palette entry + `rootColor` of every built-in             | `themes-data.test.ts` (new)                 |
| api rejects empty palette (E6) + O3                      | POST and PUT, 400, no write                                     | `apps/api/src/routes/custom-themes.test.ts` |
| Five built-ins, 26 total                                 | counts                                                          | `apps/live/lib/themes.test.ts` (exists)     |

## Constants and configuration

| Name                   | Value                                                     | Provenance                                             | Safe range            | Home                     |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------ | --------------------- | ------------------------ |
| `ROOT_BRANCH`          | `-1`                                                      | Sentinel outside the index range                       | any negative          | `hierarchy.ts`           |
| `MIN_TEXT_CONTRAST`    | `4.5`                                                     | WCAG 2.2 SC 1.4.3, normal text                         | `[4.5, 21]`           | `colors.ts`              |
| `TRUNK_FALLBACK`       | `{ fill: '#f1f5f9', stroke: '#475569', text: '#0f172a' }` | Tailwind slate-100/600/900, the current inline literal | any triple at ≥ 4.5:1 | `theme-graph.ts`         |
| `MAX_ELEMENTS_PER_TAB` | `10_000`                                                  | Existing tab limit                                     | unchanged             | `validate.ts`            |
| `MAX_THEME_DEF_BYTES`  | `256 * 1024`                                              | Existing api limit                                     | unchanged             | `apps/api/src/limits.ts` |
