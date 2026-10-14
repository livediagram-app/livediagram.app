# The boundary: blueprint

Derived from [The boundary](../boundary.md). Defaults in [DEFAULTS.md](DEFAULTS.md) as `Dn`.

| File                                                                                   | Role                                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `packages/document/src/boundary.ts`                                                    | `BoundaryStyle`, `boundaryLayout`, `BOUNDARY_TINT`, writes   |
| `packages/document/src/containment.ts`                                                 | `CONTAINER_KINDS`, `isContainerKind`: frame, lane, boundary  |
| `graph-look.ts`, `arrow-behind.ts`, `arrow-label-layout.ts`, `apps/live/lib/canvas.ts` | Their frame-or-lane checks read `isContainerKind`            |
| `packages/document/src/layers.ts`                                                      | Containers paint first (tier 0), the larger first among them |
| `packages/document/src/colors.ts`                                                      | `defaultFillColor` transparent (the face paints the tint)    |
| `packages/document/src/svg-render-boundary.ts`                                         | `svgBoundary`: tint, tab or title, icon, meta                |
| `apps/live/components/canvas/BoundaryFace.tsx`                                         | The canvas face                                              |
| `apps/live/components/canvas/shape-svg-overlay.tsx`                                    | `boundary` on the CSS box path (its border is the wrapper's) |
| `apps/live/components/palette/BoundaryMenuSection.tsx`                                 | Style tiles                                                  |

## Domain and naming

| Term      | Identifier                                 | Meaning                 |
| --------- | ------------------------------------------ | ----------------------- |
| Boundary  | `shape: 'boundary'`                        | The element             |
| Style     | `BoundaryStyle = 'tab' \| 'inset' \| 'c4'` | Absent = tab            |
| Container | `isContainerKind(kind)`                    | Frame, lane or boundary |

Banned: "zone" in code, "group".

## Behaviour and state

- **Tint.** No `fillColor`: `colorWash(stroke, BOUNDARY_TINT)` (0.06) over the box. Nested boundaries stack their
  washes, which is how depth reads; nothing is derived or stored. A stored `fillColor` paints instead.
- **Layout** (`boundaryLayout(w, h, { style, icon, titleChars, meta })`), element-relative:
  - `tab`: a tab filled with the accent (title and icon in `labelOn(accent)`), of height 26 centred on the top edge (y = -13) from x = 14, its width the icon (16 + 6) plus the
    title's estimated width (`ceil(chars * 14 * 0.66) + 6`) plus 10 a side, capped at `w - 28`; the meta line inside the
    top-left corner below the tab (y = 20, height 18).
  - `inset`: icon and title at (12, 10), height 22, title px 13; meta after the title on the same line.
  - `c4`: title bold at (12, h - 46), height 22, meta below at (12, h - 26), height 18; no icon.
- **Writes.** `withBoundaryStyle(el, style | null)` and `withBoundaryMeta(el, on)` (on gives `BOUNDARY_META_DEFAULT`,
  "Meta line", unless it has words; off deletes `pageSubtitle`) through the menu's generic style ops (`BoundaryStyle`,
  `BoundaryMeta`).
  The meta line edits in place (`pageSubtitle`, `setPageHeading`, `MASTHEAD_SHAPES` gains `boundary`).
- **Paint order.** Tier 0 holds frames and boundaries; within it the larger area paints first, so an inner boundary
  never hides behind its outer one whatever the array order.
- **Animation.** The Shape set's tiles offered on a boundary are `CONTAINER_ANIMATIONS`: blink, glow, trace,
  gradient, shimmer, highlight.
- **Creation.** 480 × 300, label "Region", `strokeStyle: 'dashed'` (C4 picks `long-dash` when the style is set to
  C4 and the stroke is unset or dashed), `borderRadius: 'md'`, `textSize: 'sm'`, `textBold: true` (D184).

Invariants: I1 the canvas and export place the tab, title and meta from the same `boundaryLayout`; I2 containment of a
boundary is the shared predicate (one copy).

## Interfaces and contracts

```ts
export type BoundaryStyle = 'tab' | 'inset' | 'c4';
export const BOUNDARY_STYLES: readonly BoundaryStyle[];
export function boundaryStyleOf(el: ShapeElement): BoundaryStyle;
export const BOUNDARY_TINT = 0.06;
export function boundaryLayout(
  w: number,
  h: number,
  o: { style: BoundaryStyle; icon: boolean; titleChars: number; meta: boolean },
): {
  tab: LayoutRect | null;
  icon: LayoutRect | null;
  title: LayoutRect;
  meta: LayoutRect | null;
  titlePx: number;
  metaPx: number;
};
export function withBoundaryStyle<T extends Element>(el: T, style: BoundaryStyle | null): T;
export const BOUNDARY_META_DEFAULT = 'Meta line';
export function withBoundaryMeta<T extends Element>(el: T, on: boolean): T;
export const CONTAINER_KINDS: ReadonlySet<string>;
export function isContainerKind(kind: string): boolean;
```

Validation: `boundaryStyle` one of the three (rule list written out in `validate-shape.ts`).

## Data and persistence

`boundaryStyle` persisted, absent = tab. The tint is a constant; nothing about nesting is stored.

## Errors and edge cases

| #   | Case                                  | Handling                                         |
| --- | ------------------------------------- | ------------------------------------------------ |
| E1  | Title longer than the tab can hold    | Tab capped at `w - 28`; the title is clipped     |
| E2  | Boundary too short for C4's two lines | Title only                                       |
| E3  | Boundary inside a frame or a lane     | Its wash stacks on nothing but other boundaries' |
| E4  | Unknown style                         | Reads as tab                                     |

## Security and trust

Strings render as React text and `xmlEscape`d in export.

## Performance and limits

Nothing per tick: the tint is a constant, so a boundary costs one face and no board-wide pass.

## Presentation and UX

Menu section **Boundary** (Tools flyout): **Tab**, **Inset**, **C4** tiles. Palette: Build → **Boundary** after Frame
and Lane (Diagram); left out of Illustrate's Build. Placeholder for the meta line: "Meta line".

## Accessibility

Tiles named "Tab Style", "Inset Style", "C4 Style"; the meta line is `role="textbox"` "Boundary meta line".

## Observability

`Element·Added·Boundary`; `Element·Changed·BoundaryStyle`.

## Testing

| Rule                                   | Test file                                                   |
| -------------------------------------- | ----------------------------------------------------------- |
| Layout per style, tint, writes         | `packages/document/src/boundary.test.ts`                    |
| Containment and carry include boundary | `packages/document/src/containment.test.ts`                 |
| Paint order larger-first               | `packages/document/src/layers.test.ts`                      |
| Export draws tab, title, stacked tint  | `packages/document/src/boundary.test.ts`                    |
| Face                                   | `apps/live/components/canvas/BoundaryFace.test.tsx`         |
| Menu section (meta line, styles)       | `apps/live/components/palette/BoundaryMenuSection.test.tsx` |

## Constants and configuration

| Name             | Value     | Provenance / safe range |
| ---------------- | --------- | ----------------------- |
| `BOUNDARY_TINT`  | 0.06      | Spec; 0.04 to 0.1       |
| `BOUNDARY_TAB_H` | 26        | D185; 22 to 30          |
| Size             | 480 × 300 | D184                    |
