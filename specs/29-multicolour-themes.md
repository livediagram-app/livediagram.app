# Multi-colour (rainbow) themes

Most themes in the catalogue ([spec/09](09-canvas-and-command-palette.md), `apps/live/lib/themes.ts`) paint every element one colour — a single fill / stroke / text triple applied uniformly. **Multi-colour themes** instead carry a _palette_ of several colour triples and assign each branch of the diagram's hierarchy a different one, the way XMind's "Rainbow" theme tints each main branch of a mind map a distinct hue.

## What they are

A multi-colour theme is an ordinary `ThemeDefinition` with two extra fields:

- `palette: ThemePaletteEntry[]` — an ordered list of `{ fill, stroke, text }` triples, one per branch colour. Branches cycle through the palette (`palette[branchIndex % palette.length]`), so a diagram with more branches than colours repeats hues rather than running out.
- `rootColor: ThemePaletteEntry` — the colour for the **trunk**: the root node(s) of the hierarchy, plus any newly-added element that isn't wired into a hierarchy yet. A neutral so the radiating branch hues read as the accent.

A theme with no `palette` is a single-colour theme and behaves exactly as before. The backdrop half (background colour + pattern + pattern colour) is unchanged — multi-colour applies only to **element** colours.

The catalogue ships three multi-colour themes, all behind the picker's "Show more themes" toggle:

| Theme    | Feel                                                   |
| -------- | ------------------------------------------------------ |
| Rainbow  | Saturated six-hue spectrum (red → orange → … → purple) |
| Pastel   | Soft, low-saturation version of the same wheel         |
| Tropical | Vivid teal / cyan / lime / orange / pink / violet      |

## How a branch is decided

The diagram model has no explicit parent/child field; hierarchy is **implicit in pinned arrows** ([spec/05](05-diagram-structure.md), `Endpoint.kind === 'pinned'`). `apps/live/lib/hierarchy.ts` derives branches from them:

1. Each arrow whose **both** endpoints pin to elements defines a directed edge `from → to` (parent → child). Free-floating arrows contribute nothing.
2. **Roots** are boxed elements with no incoming pinned edge but at least one outgoing one (the centre of a mind map, the CEO of an org chart). Roots get the sentinel `ROOT_BRANCH`.
3. Each root's **direct children** seed a fresh branch index, in document order, and that index propagates down the whole subtree (a depth-first walk). So a top-level limb of a mind map and all its sub-topics share one hue. Shared/diamond descendants keep the first index that reaches them.
4. **Loose** elements — boxed elements no pinned arrow touches — each take the next branch index in document order. This means a flat board with no hierarchy (scattered shapes, a kanban) still gets rainbow variety rather than collapsing to one colour.
5. **Arrows** themselves take the colour of the branch they feed _into_ (their `to` element's branch), falling back to the `from` element's branch, then the trunk — so a connector matches the limb it draws.

The walk is a pure function over the element list, so it is unit-tested without rendering (`hierarchy.test.ts`).

## Where it applies

Multi-colour assignment needs the **whole element list** (to see the arrow graph), unlike the single-colour path which is per-element. So `themes.ts` exposes graph-aware wrappers alongside the existing per-element helpers:

- `recolourElementsForTheme(elements, theme)` — used when a template or Markdown import is painted with a theme.
- `switchThemeElements(elements, prev, next)` — the Theme accordion / welcome picker "apply a theme" path. Preserves a field the user hand-customised away from the previous theme, same per-field rule as the single-colour `switchThemeElement`.
- `resetThemeElementsToTheme(elements, theme)` — the "Reset elements to theme" button; force-repaints every branch from the palette, overwriting customs.

Each computes the branch map once, then reuses the existing per-element transforms by handing them a **synthetic per-element theme** whose `elementFill / elementStroke / elementText` are that element's resolved branch colours. This keeps every existing rule (sticky notes keep their amber, `themeLockFill` fills survive, tables track the backdrop) working without a parallel code path. For a single-colour theme the wrappers fall straight through to the per-element helpers, so nothing changes for the other 18 themes.

### Newly-added elements

A brand-new element dropped on a multi-colour-themed tab has no place in the arrow graph yet, so `deriveNewBoxedColours` gives it the theme's `rootColor`. Once the user connects it into the hierarchy, **Reset elements to theme** (or re-picking the theme) re-runs the branch walk and gives the limb its proper hue. This is deliberate: silently re-rainbowing the whole canvas every time an arrow is drawn would be surprising and would fight a user who has hand-coloured things.

## UI

Theme cards (the Theme accordion grid and the welcome / template picker grid) render through a shared `ThemeSwatch` component. A single-colour theme shows the existing one-dot-on-backdrop preview; a multi-colour theme shows a row of small stripes — one per palette entry — so the card reads as "many colours" at a glance.

## Telemetry

Applying any theme already emits `track('Theme', 'Changed', <label>)` ([spec/22](22-telemetry.md)); the multi-colour themes reuse that with their own labels, so no enum change is needed.

## Counts

Adding three multi-colour themes takes the catalogue from 18 to **21 themes** (12 default + 9 extra). The counts are pinned by `apps/live/lib/themes.test.ts` and cited in [spec/09](09-canvas-and-command-palette.md), [spec/16](16-marketing-site.md), and [spec/23](23-marketing-assets.md); all four move together.
