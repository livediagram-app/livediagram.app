# Multi-colour (rainbow) themes

Most themes in the catalogue ([Canvas and palette](../008-canvas/canvas-and-palette.md), `packages/design/src/themes-data.ts`) paint every element one colour: a single fill / stroke / text triple applied uniformly. **Multi-colour themes** instead carry a _palette_ of several colour triples and assign each branch of the tab's hierarchy a different one, the way XMind's "Rainbow" theme tints each main branch of a mind map a distinct hue.

## What they are

A multi-colour theme is an ordinary `ThemeDefinition` with two extra fields:

- `palette: ThemePaletteEntry[]`: an ordered list of `{ fill, stroke, text }` triples, one per branch colour. Branches cycle through the palette (`palette[branchIndex % palette.length]`), so a diagram with more branches than colours repeats hues rather than running out.
- `rootColor: ThemePaletteEntry`: the colour for the **trunk**: the root node(s) of the hierarchy, plus any newly-added element that isn't wired into a hierarchy yet. A neutral so the radiating branch hues read as the accent. Optional: a palette theme without one paints the trunk with its element-level `elementFill` / `elementStroke` / `elementText`, and a null field there falls back to a neutral slate. Every built-in multi-colour theme sets it.

A built-in palette is never empty. Should an empty palette reach the renderer anyway, every element paints with the trunk colour.

Every palette entry and `rootColor` of a built-in theme keeps its `text` at a contrast ratio of at least 4.5:1 against its `fill` (WCAG 2.2 AA for normal text).

A theme with no `palette` is a single-colour theme and behaves exactly as before. The backdrop half (background colour + pattern + pattern colour) is unchanged; multi-colour applies only to **element** colours.

The catalogue ships three multi-colour themes, all extra:

| Theme    | Feel                                                   |
| -------- | ------------------------------------------------------ |
| Rainbow  | Saturated six-hue spectrum (red → orange → … → purple) |
| Pastel   | Soft, low-saturation version of the same wheel         |
| Tropical | Vivid teal / cyan / lime / orange / pink / violet      |

## How a branch is decided

The design model has no explicit parent/child field; hierarchy is **implicit in pinned arrows** ([Design structure](../006-design/design-structure.md), `Endpoint.kind === 'pinned'`). `packages/design/src/hierarchy.ts` derives branches from them:

1. Each arrow whose **both** endpoints pin to **boxed** elements defines a directed edge `from → to` (parent → child). Free-floating arrows, arrows pinned to another arrow or to an element no longer on the tab, and self-loops contribute nothing.
2. **Roots** are boxed elements with no incoming pinned edge but at least one outgoing one (the hub of a process, the top of a hierarchy). Roots get the sentinel `ROOT_BRANCH`.
3. Each root's **direct children** seed a fresh branch index, in document order, and that index propagates down the whole subtree (a depth-first walk). So a top-level limb and all its sub-topics share one hue. Shared/diamond descendants keep the first index that reaches them.
4. **Loose** elements: boxed elements no pinned arrow touches; each takes the next branch index in document order. This means a flat canvas with no hierarchy (scattered shapes, a page of cards) still gets rainbow variety rather than collapsing to one colour. Loose elements continue the same counter as the root branches, so once the palette wraps a loose element can share a limb's hue; that is accepted, since any fixed palette repeats.
5. **Rootless** elements: in the graph but unreachable from any root, as in a loop `A → B → C → A`, take the trunk colour. A loop has no natural limb to name.
6. **Arrows** themselves take the colour of the branch they feed _into_ (their `to` element's branch), falling back to the `from` element's branch, then the trunk, so a connector matches the limb it draws.

The walk is a pure function over the element list, so it is unit-tested without rendering (`hierarchy.test.ts`). It handles any hierarchy the tab can hold, including a single chain of `MAX_ELEMENTS_PER_TAB` elements, without exhausting the call stack.

## Where it applies

Multi-colour assignment needs the **whole element list** (to see the arrow graph), unlike the single-colour path which is per-element. So `packages/design/src/theme-graph.ts` exposes graph-aware wrappers alongside the per-element helpers in `packages/design/src/themes.ts`:

- `recolourElementsForTheme(elements, theme)`: used when a template or an agent's tab is painted with a theme.
- `switchThemeElements(elements, prev, next)`: the Theme accordion / welcome picker "apply a theme" path. Preserves a field the user hand-customised away from the previous theme, same per-field rule as the single-colour `switchThemeElement`.
- `resetThemeElementsToTheme(elements, theme)`: the "Reset elements to theme" button; force-repaints every branch from the palette, overwriting customs.

Each computes the branch map once, then reuses the existing per-element transforms by handing them a **synthetic per-element theme** whose `elementFill / elementStroke / elementText` are that element's resolved branch colours. This keeps every existing rule (sticky notes keep their amber, `themeLockFill` fills survive, tables track the backdrop) working without a parallel code path. For a single-colour theme the wrappers fall straight through to the per-element helpers, so nothing changes for the other 21 single-colour themes. `resetArrowsToTheme` is the fourth wrapper: it repaints only arrows, each from its branch ([Canvas + Theme dialog](canvas-and-theme-dialog.md)).

The branch walk itself never logs; it runs inside every wrapper. Each wrapper logs once per call on a palette theme, naming the operation, the theme, and the element and branch counts, so a theme apply leaves a trace without the walk flooding the console.

### Newly-added elements

A brand-new element dropped on a multi-colour-themed tab has no place in the arrow graph yet, so `deriveNewBoxedColours` gives it the theme's `rootColor`. Once the user connects it into the hierarchy, **Reset elements to theme** (or re-picking the theme) re-runs the branch walk and gives the limb its proper hue. This is deliberate: silently re-rainbowing the whole canvas every time an arrow is drawn would be surprising and would fight a user who has hand-coloured things.

## UI

Theme cards (the Theme accordion grid and the welcome / template picker grid) render through a shared `ThemeSwatch` component. The swatch is a miniature diagram in the theme's own colours: a titled node flowing into two others over the theme's backdrop. A single-colour theme draws all three nodes in its element colours; a multi-colour theme gives the three nodes its first three palette entries (cycling when the palette is shorter), so the card reads as "many colours" at a glance. The swatch is decorative (`aria-hidden`); the card's own text names the theme.

Six of the Tab Style dialog's one-click looks use these themes (and UML), so a multi-colour tab is one click away
([Canvas + Theme dialog](canvas-and-theme-dialog.md) "Looks").

## Telemetry

Applying any theme already emits `track('Theme', 'Changed', <label>)` ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)); the multi-colour themes reuse that with their own labels, so no enum change is needed.

## Counts

The catalogue ships **24 themes** (12 default + 12 extra), the extras including the dark schemes (Pine, Plum, Abyss, Espresso) and three multicolour themes (Rainbow, Pastel, Tropical). It was 27 until Basic and Charcoal merged into the single **Default** scheme ([Live app](../007-editor/live-app.md)), and 26 until Autumn and Jewel retired ([Light and dark halves](light-and-dark.md)); designs saved against a retired scheme are migrated on load ([Retired colour schemes](retired-schemes.md)). The counts are pinned by `apps/live/lib/themes.test.ts` and cited in [Canvas and palette](../008-canvas/canvas-and-palette.md), [Marketing site](../019-marketing/marketing-site.md), and [Marketing assets](../019-marketing/marketing-assets.md); all four move together. Six **seasonal themes** (three of them multicolour: Spring, Pumpkin, Yuletide) sit outside these counts: no picker lists them, and a tab wears one only through a seasonal look ([Seasonal looks](canvas-and-theme-dialog.md#seasonal-looks)).
