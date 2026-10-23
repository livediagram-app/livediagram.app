# Accent edge: blueprint

Derived from [Accent edge](../accent-edge.md). Defaults in [DEFAULTS.md](DEFAULTS.md) as `Dn`.

| File                                                      | Role                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| `packages/document/src/accent-edge.ts`                    | Vocabulary, `supportsAccentEdge`, geometry, colour, `svgAccentEdge` |
| `packages/document/src/element-types.ts`                  | `accentEdge`, `accentEdgeColor` on `ShapeElement`                   |
| `packages/document/src/element-fields.ts`                 | Both fields listed for `shape`                                      |
| `packages/document/src/svg-render.ts`                     | Appends `svgAccentEdge` after the box, before the face and label    |
| `apps/editor/components/canvas/AccentEdgeOverlay.tsx`     | The canvas bar, clipped by the wrapper's own radius                 |
| `apps/editor/components/canvas/BoxedElementView.tsx`      | Mounts the overlay (one line)                                       |
| `apps/editor/components/palette/AccentEdgeRow.tsx`        | The Border category's Accent Edge row + colour well                 |
| `apps/editor/lib/format-painter.ts`, `format-config.ts`   | Copied with Border                                                  |
| `apps/editor/lib/element-telemetry.ts` / telemetry schema | `Element·Changed·AccentEdge`                                        |

## Domain and naming

| Term          | Identifier                  | Meaning                                      |
| ------------- | --------------------------- | -------------------------------------------- |
| Accent edge   | `AccentEdge`, `accentEdge`  | `'left' \| 'top' \| 'bottom'`; absent = None |
| Edge colour   | `accentEdgeColor`           | Hex; absent = the border colour as drawn     |
| Edge shapes   | `ACCENT_EDGE_SHAPES`        | `square`, `stadium`, `card`                  |
| Bar thickness | `accentEdgeThickness(w, h)` | `clamp(min(w, h) * 0.06, 3, 6)` element px   |

Banned: "stripe", "rail" (the timeline rail), "accent bar" (the banner's own bar, `isAccentBarShape`).

## Behaviour and state

- `supportsAccentEdge(el)`: `el.type === 'shape' && ACCENT_EDGE_SHAPES.has(el.shape)`.
- `resolvedAccentEdge(el)`: the stored value when `supportsAccentEdge` and it is one of the three, else `null`
  (an unknown value or an unsupported kind draws nothing).
- `accentEdgeRect(edge, w, h)` in the **inner box** (the box inside the border, origin at its top-left):
  left `{0, 0, t, h}`, top `{0, 0, w, t}`, bottom `{0, h - t, w, t}`, `t = accentEdgeThickness(w, h)` of the
  element's own size.
- Colour: `accentEdgeColor ?? drawnStroke`, where `drawnStroke` is the colour the border is drawn in (the same
  value the canvas and export already resolve), so a theme switch carries an unset colour.
- Writes: `setAccentEdgeSelected(edge | null)` and `setAccentEdgeColorSelected(hex | null)` apply to every selected
  shape that supports it, one history step; `null` deletes the field. Unsupported selected elements are untouched.
- Style presets never write either field (D106). The format painter copies both with **Border** for shapes.

## Interfaces and contracts

```ts
export type AccentEdge = 'left' | 'top' | 'bottom';
export const ACCENT_EDGES: readonly AccentEdge[];
export const ACCENT_EDGE_SHAPES: ReadonlySet<string>;
export function isAccentEdge(v: unknown): v is AccentEdge;
export function supportsAccentEdge(el: { type: string; shape?: string }): boolean;
export function resolvedAccentEdge(el: Element): AccentEdge | null;
export function accentEdgeThickness(width: number, height: number): number;
export function accentEdgeRect(edge: AccentEdge, width: number, height: number): Rect;
export function svgAccentEdge(
  el: ShapeElement,
  o: { stroke: string; borderWidth: number; radius: number },
): string;
```

Validation: none. Both fields are cosmetic and lenient like `headerFill` (an unknown value renders as None).

## Data and persistence

| Field             | Class     | Notes                        |
| ----------------- | --------- | ---------------------------- |
| `accentEdge`      | persisted | Absent = None                |
| `accentEdgeColor` | persisted | Absent = the border's colour |

No migration.

## Errors and edge cases

| #   | Case                                  | Handling                                                                   |
| --- | ------------------------------------- | -------------------------------------------------------------------------- |
| E1  | Stored on an unsupported kind         | Ignored by every renderer; menu hides the row                              |
| E2  | Unknown stored value                  | Renders as None                                                            |
| E3  | Element smaller than 6px on a side    | Thickness floors at 3, clipped by the box                                  |
| E4  | Sketch finish                         | Drawn under the sketched body's outline, still clipped by the box's radius |
| E5  | A peer's selection colours the border | The bar keeps its own resolved colour (the peer colour is the ring only)   |

## Security and trust

A colour string reaches the DOM as a style value and the export through `xmlEscape`.

## Performance and limits

One absolutely positioned div per element that has one, nothing otherwise (the overlay returns `null`). No
measurement, no effect, no subscription.

## Presentation and UX

- Row title **Accent Edge**, tiles **None**, **Left**, **Top**, **Bottom** (glyph: a square outline with the edge
  thickened), in the Border category after Pattern.
- When an edge is set, a colour row labelled **Edge Colour** (the shared `ColourRow`), and **Match Border** while
  `accentEdgeColor` is set. Writes go through the menu's generic `ElementStyleOps` (`apps/editor/lib/element-style-ops.ts`).

## Accessibility

Tiles are buttons with `aria-pressed`; the well is the shared picker's trigger. The bar is decorative
(`aria-hidden`).

## Observability

`track('Element', 'Changed', 'AccentEdge')` before a write from the row; no logs (a cosmetic write has no failure
path of its own).

## Testing

| Rule                                     | Test file                                                  |
| ---------------------------------------- | ---------------------------------------------------------- |
| Supported kinds, resolution, E1, E2      | `packages/document/src/accent-edge.test.ts`                |
| Thickness clamp and rects per edge       | same                                                       |
| Export draws a clipped bar in the colour | same (`svgAccentEdge`), `svg-render.test.ts`               |
| Canvas overlay draws per edge / nothing  | `apps/editor/components/canvas/AccentEdgeOverlay.test.tsx` |
| Row writes, hides on unsupported         | `apps/editor/components/palette/AccentEdgeRow.test.tsx`    |
| Format painter maps both to Border       | `apps/editor/lib/format-config.test.ts` (exhaustive table) |

## Constants and configuration

| Name                 | Value | Provenance / safe range            |
| -------------------- | ----- | ---------------------------------- |
| `ACCENT_EDGE_MIN_PX` | 3     | Visible at 50% zoom; 2 to 4        |
| `ACCENT_EDGE_MAX_PX` | 6     | Inside the label's padding; 4 to 8 |
| `ACCENT_EDGE_SHARE`  | 0.06  | Of the shorter side; 0.04 to 0.08  |
