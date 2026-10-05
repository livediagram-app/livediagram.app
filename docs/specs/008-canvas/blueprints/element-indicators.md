# Element indicators: blueprint

Derived from [Element indicators](../element-indicators.md). Defaults in [DEFAULTS.md](DEFAULTS.md).

## Domain and naming

| Term          | Identifier                                                            | Not                        |
| ------------- | --------------------------------------------------------------------- | -------------------------- |
| Indicator     | `IndicatorItem` with `kind` `link` / `note` / `action` / `comment`    | badge, segment             |
| Command       | `IndicatorItem` with `kind` `outline` / `tidy`, `command: true`       | badge                      |
| Style         | `ElementIndicatorStyle` = `'corner' \| 'footer'`                      | layout, mode               |
| Cluster       | the laid-out run of items for one element                             | strip, chip                |
| Pip           | the fallback cluster on the outline                                   | badge pill                 |
| Anchor        | `IndicatorAnchor` = `'top-right' \| 'bottom-left' \| 'bottom-centre'` | position                   |
| Outline rings | `indicatorRings(el, cornerPx)`: closed polylines, local px            | hit outline (that's lines) |

## Files

| File                                                                        | Holds                                                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `packages/document/src/indicator-placement.ts`                              | `indicatorRings`, `placeIndicators`, `footerAnchor`, the placement constants (pure)  |
| `packages/document/src/shape-hit.ts`                                        | exports `roundedRectRing` (was the private `roundedRect`)                            |
| `apps/live/lib/element-indicator-style.ts`                                  | `ELEMENT_INDICATOR_STYLES`, `readElementIndicatorStyle`, `withElementIndicatorStyle` |
| `apps/live/components/canvas/ElementIndicatorStyleContext.tsx`              | the style as a context, provided by `Canvas.tsx` from `settings`                     |
| `apps/live/components/canvas/indicator-items.ts`                            | `IndicatorItem`, `clusterSize(items, form)` (the size estimate)                      |
| `apps/live/components/canvas/useIndicatorLayout.ts`                         | `placeCluster`, `useIndicatorLayout` (memoised), `labelReserveY`                     |
| `apps/live/components/canvas/ElementIndicators.tsx`                         | the component: a layout → Corner cluster, Footer row or Pip                          |
| `apps/live/components/canvas/element-labels.tsx`, `element-label-views.tsx` | `reserveY`: a `ScalingLabel`'s extra top and bottom inset                            |
| `apps/live/components/canvas/element-badges.tsx`                            | keeps `RemoteSelectorsStrip` + `ADORNMENT_MIN_ZOOM`; `BadgeStrip` is removed         |
| `apps/live/components/canvas/BoxedElementView.tsx`                          | renders `ElementIndicators` where `BadgeStrip` was; root gains the `group/el` name   |
| `apps/live/lib/user-preferences.ts`                                         | `elementIndicatorStyle?: 'corner' \| 'footer'`                                       |
| `apps/live/components/dialogs/settings/settings-catalogue.ts`               | the Editor › Element Indicators choice row                                           |
| `apps/telemetry/app/event-explanations.ts`                                  | the two `UI\|Changed\|ElementIndicators*` explanations                               |

## Interfaces and contracts

```ts
// packages/document/src/indicator-placement.ts
export type IndicatorAnchor = 'top-right' | 'bottom-left' | 'bottom-centre';
export type IndicatorBox = { x: number; y: number; width: number; height: number };
export function indicatorRings(el: BoxedElement, cornerPx: number): Point[][];
export function placeIndicators(
  rings: readonly (readonly Point[])[],
  width: number,
  height: number,
  size: { width: number; height: number },
  anchor: IndicatorAnchor,
): IndicatorBox | null;
export function footerAnchor(el: BoxedElement): IndicatorAnchor; // 'bottom-left' | 'bottom-centre'
export function pipCornerInset(rings, width, height): { x: number; y: number } | null;
```

- `labelTextBox({ width, height, label, textSize, padding, alignX, alignY })`: null for `'scale'`
  or blank text; else per line of the label a width of `chars × LABEL_FONT_PX[size] × LABEL_CHAR_EM`,
  lines = Σ ceil(width / (w − 2·padding)), box width = min(room, widest), height =
  min(h − 2·padding, lines × px × LABEL_LINE_EM), placed by the alignment inside the padding.
  `BoxedElementView` passes its label, size, padding and alignment to `useIndicatorLayout`.
- `pipCornerInset`: walks `d` from 0 in 0.5px steps up to `min(width, height) / 2` and returns
  `{ x: d, y: d }` for the first `(width - d, d)` inside a ring; null with no rings or no hit. The pip
  falls back to `badgeCornerInset` when it is null.
- `labelReserveY(layout, height, padding)`: Corner → `box.y + box.height - padding`, Footer →
  `height - box.y - padding`, floored at 0; 0 for the pip or no layout. Passed to `renderLabel`,
  read only by `ScalingLabel` as `paddingTop` / `paddingBottom` = `padding + reserveY`.

- `indicatorRings`: a shape the outline hit-test traces (`pickedByOutline`) → the **closed** lines of
  `shapeHitOutline(el)`; every other element → `[roundedRectRing(0, 0, w, h, cornerPx, cornerPx)]`.
  Non-positive sizes → `[]`.
- `placeIndicators`: slides an inset `s` from `INDICATOR_START_INSET_PX` up in `INDICATOR_STEP_PX`
  steps and returns the first box that **fits**, or `null`:
  - top-right: `{ x: width - s - size.width, y: s }`; stop once `y + size.height > height / 2 - INDICATOR_MIDDLE_CLEARANCE_PX`.
  - bottom-left: `{ x: s, y: height - s - size.height }`; stop once `y < height / 2 + INDICATOR_MIDDLE_CLEARANCE_PX`.
  - bottom-centre: `{ x: (width - size.width) / 2, y: height - s - size.height }`; same stop.
  - Every anchor stops once the box passes the vertical centre. A box inside the middle band
    (`INDICATOR_MIDDLE_CLEARANCE_PX` of the centre) is accepted only when a `label` box was given
    and the box keeps `INDICATOR_OUTLINE_CLEARANCE_PX` clear of it.
  - **Fits** = all four corners and four edge midpoints inside some ring (`insidePolygon`), no ring
    vertex inside the box, and every ring segment at least `INDICATOR_OUTLINE_CLEARANCE_PX` from
    every box edge (`segmentDistance`). Segments whose bounding box is farther than the clearance
    from the box are skipped before measuring.
- `footerAnchor`: `bottom-left` for a non-shape element and for shape kinds `square`, `mind-node`,
  `stadium`, `page`, `browser` and every kind not drawn by outline (cards, panels, web
  components); `bottom-centre` for every other outline-drawn kind (circle, diamond, hexagon, ...).
- `readElementIndicatorStyle(prefs)` → `'footer'` only for exactly `'footer'`, else `'corner'`.

## Behaviour and state

- Items, in order: commands first (`outline`, `tidy`, only for a mind root from
  `useMindOutlineBadge`), then `link`, `note`, `action`, `comment`. Footer renders commands **last**.
- Form chosen per element, first that fits: Corner → `corner`, else `pip`. Footer → `footer`
  (labelled), else `footer-compact`, else `pip`.
- Placement is memoised on `[rings key: shape, width, height, cornerPx, borderRadius, strokeWidth], form, size`.
- Commands: `visibility: hidden` unless the element root (`group/el`) is hovered or the element
  is selected; their width is always part of the size so nothing moves when they appear.
- Hover / selection raises the resting glyph opacity from `INDICATOR_REST_OPACITY` to
  `INDICATOR_ACTIVE_OPACITY`; the glyph under the pointer reaches 1.

## Presentation and UX

- Corner cluster: `items` as 20×20 buttons (14px glyph, 3px padding), `gap` 0, a backing in the
  element's fill (`own.fill ?? defaultFillColor`, none when transparent) with 4px radius and 2px
  inner padding. Comment adds its count (11px, semibold, tabular) after the glyph.
- Footer row: height 20px, 8px gap; labelled items glyph 12px + 4px + 11px medium text; action shows
  a 16px initials disc in the assignee's colour (`IDENTITY_FILL`); compact drops the words.
- Pip: centred on `badgeCornerInset(...)` with `translate(50%, -50%)`, 22px tall, element fill, 1px
  ring in the text colour at 15%, `rounded-full` on rounded elements else `rounded-md`, 11px glyphs.
- All glyphs inherit the element's text colour (`currentColor`).

## Accessibility

- Buttons with the labels in the spec; focus-visible ring 2px in the text colour.
- Hidden commands use `visibility: hidden` (out of tab order and AX tree).
- Link and action keep their `HoverCard`s.

## Errors and edge cases

| Case                                | Handling                         |
| ----------------------------------- | -------------------------------- |
| No rings (zero size)                | `placeIndicators` → `null` → pip |
| Element too small / thin / spiky    | `null` → pip                     |
| Label runs under the corner cluster | the fill backing masks it        |
| Transparent fill (frame, text)      | no backing                       |
| Zoom below `ADORNMENT_MIN_ZOOM`     | nothing renders (unchanged)      |
| Unknown stored style                | reads as `'corner'`              |

## Performance and limits

Rings are at most a few hundred points (`PATH_ARC_SEGMENTS` arcs, 12-segment cubics). The slide runs
at most `height / 2 / INDICATOR_STEP_PX` steps, each pruned by bounding box; the result is memoised
per element and only computed for elements that carry an indicator. Only those elements read the
style context.

## Constants and configuration

| Constant                         | Value | Safe range  | Provenance                                   |
| -------------------------------- | ----- | ----------- | -------------------------------------------- |
| `INDICATOR_OUTLINE_CLEARANCE_PX` | 6     | 4 to 10     | spec: "at least 6px clear of the outline"    |
| `INDICATOR_MIDDLE_CLEARANCE_PX`  | 14    | 8 to 24     | spec: middle band "14px short of the centre" |
| `INDICATOR_START_INSET_PX`       | 3     | 0 to 6      | D-row: start tight, the slide finds the fit  |
| `INDICATOR_STEP_PX`              | 1     | 1 to 2      | D-row                                        |
| `LABEL_CHAR_EM`                  | 0.58  | 0.5 to 0.65 | D79: a generous average advance              |
| `LABEL_LINE_EM`                  | 1.3   | 1.2 to 1.5  | D79                                          |
| `INDICATOR_REST_OPACITY`         | 0.5   | 0.4 to 0.6  | spec                                         |
| `INDICATOR_ACTIVE_OPACITY`       | 0.85  | 0.75 to 1   | spec                                         |

## Observability

Placement is pure and deterministic; no logs. A style change is the telemetry event in the spec.

## Testing

| Rule                                                         | Test                                                     |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| Rounded rect: corner fits tight, clear of the outline        | `packages/document/src/indicator-placement.test.ts`      |
| Circle: corner slides along the diagonal, stays inside       | same                                                     |
| Diamond / small pill / thin bar: no fit → `null`             | same                                                     |
| Never crosses the middle band                                | same                                                     |
| A short fixed label frees the corner; a long one does not    | same                                                     |
| Footer: bottom-left on boxes, bottom-centre on a circle      | same                                                     |
| Unknown style reads as corner                                | `apps/live/lib/element-indicator-style.test.ts`          |
| Pip on a hexagon's edge and a rounded box's corner curve     | `packages/document/src/indicator-placement.test.ts`      |
| Commands hidden at rest, shown when selected; labels; counts | `apps/live/components/canvas/ElementIndicators.test.tsx` |
| A scaled label's reserve; none for the pip                   | same                                                     |
| Footer uses words, falls back to compact and to the pip      | same                                                     |
| Settings row writes the style and fires the choice event     | `settings-catalogue.test.ts` (existing per-row rules)    |
