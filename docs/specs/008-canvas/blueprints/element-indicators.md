# Element indicators: blueprint

Derived from [Element indicators](../element-indicators.md). Defaults in [DEFAULTS.md](DEFAULTS.md).

## Domain and naming

| Term          | Identifier                                                                                 | Not                        |
| ------------- | ------------------------------------------------------------------------------------------ | -------------------------- |
| Indicator     | `IndicatorItem` with `kind` `link` / `note` / `action` / `comment`                         | badge, segment             |
| Command       | `IndicatorItem` with `kind` `outline` / `tidy`, `command: true`                            | badge                      |
| Style         | `ElementIndicatorStyle` = `'top' \| 'footer' \| 'off'`                                     | layout, mode, corner       |
| Form          | `IndicatorForm` = `'top' \| 'footer' \| 'footer-compact' \| 'pip'`                         | variant                    |
| Cluster       | the laid-out run of items for one element                                                  | strip, chip                |
| Pip           | the fallback cluster on the outline (`pipInset`)                                           | badge pill                 |
| Anchor        | `IndicatorAnchor` = `'top-right' \| 'top-centre' \| 'bottom-left' \| 'bottom-centre'`      | position                   |
| Centred shape | `centredIndicators(el)`: circle, diamond, hexagon, cloud, triangle, trapezoid, star, actor | round shape                |
| Content       | the label's text plus an inline icon (`contentBox`)                                        | label box                  |
| Content inset | `ContentInset` = `{ top, bottom }`: how far the content area pulls in                      | reserve, padding           |
| Outline rings | `indicatorRings(el, cornerPx)`: closed polylines, local px                                 | hit outline (that's lines) |

## Files

| File                                                                                   | Holds                                                                                                                                                 |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/indicator-placement.ts`                                         | `indicatorRings`, `centredIndicators`, `topAnchor`, `footerAnchor`, `contentBox`, `placeIndicators`, `pipInset`, `contentShift`, the constants (pure) |
| `packages/document/src/shape-hit.ts`                                                   | exports `roundedRectRing` (was the private `roundedRect`)                                                                                             |
| `apps/live/lib/element-indicator-style.ts`                                             | `ELEMENT_INDICATOR_STYLES`, `readElementIndicatorStyle`, `withElementIndicatorStyle`                                                                  |
| `apps/live/components/canvas/ElementIndicatorStyleContext.tsx`                         | the style as a context, provided by `Canvas.tsx` from `settings`                                                                                      |
| `apps/live/components/canvas/indicator-items.ts`                                       | `IndicatorItem`, `buildIndicatorItems`, `clusterSize(items, form)`, `indicatorBacking`                                                                |
| `apps/live/components/canvas/useIndicatorLayout.ts`                                    | `placeCluster`, `useIndicatorLayout` (memoised), `ContentLayout`, `ContentInset`                                                                      |
| `apps/live/components/canvas/ElementIndicators.tsx`                                    | the component: a layout → Top cluster, Footer row or pip                                                                                              |
| `apps/live/components/canvas/InsetContent.tsx`                                         | the content area pulled in by a `ContentInset`; renders nothing extra at zero                                                                         |
| `apps/live/components/canvas/ElementFaceRouter.tsx`                                    | `contentInset`: wraps the inline-icon layout and the plain label in `InsetContent`                                                                    |
| `apps/live/components/canvas/shape-inline-icon-layout.tsx`                             | exports `inlineIconMetrics`, `inlineIconGap` (shared with the content estimate)                                                                       |
| `apps/live/components/canvas/element-badges.tsx`                                       | keeps `RemoteSelectorsStrip` + `ADORNMENT_MIN_ZOOM`; `BadgeStrip` is removed                                                                          |
| `apps/live/components/canvas/BoxedElementView.tsx`                                     | builds items and the content layout, renders `ElementIndicators`; root gains the `group/el` name                                                      |
| `apps/live/lib/user-preferences.ts`                                                    | `elementIndicatorStyle?: 'top' \| 'footer' \| 'off'`                                                                                                  |
| `apps/live/components/dialogs/settings/settings-catalogue.ts`                          | the Editor › Element Indicators choice row (Top / Footer / Off)                                                                                       |
| `apps/telemetry/app/event-explanations.ts`, `apps/telemetry/app/catalogue/settings.ts` | the three `UI\|Changed\|ElementIndicators*` explanations and the chart                                                                                |

## Interfaces and contracts

```ts
// packages/document/src/indicator-placement.ts
export type IndicatorAnchor = 'top-right' | 'top-centre' | 'bottom-left' | 'bottom-centre';
export type IndicatorBox = { x: number; y: number; width: number; height: number };
export type ContentIcon = {
  size: number;
  position: 'left' | 'right' | 'above' | 'below';
  gap: number;
};
export function indicatorRings(el: BoxedElement, cornerPx: number): Point[][];
export function centredIndicators(el: BoxedElement): boolean;
export function topAnchor(el: BoxedElement): IndicatorAnchor; // 'top-right' | 'top-centre'
export function footerAnchor(el: BoxedElement): IndicatorAnchor; // 'bottom-left' | 'bottom-centre'
export function contentBox(input: {
  width: number;
  height: number;
  label: string;
  textSize: TextSize;
  padding: number;
  alignX: TextAlignX;
  alignY: TextAlignY;
  fontPx?: number;
  icon?: ContentIcon;
}): IndicatorBox | null;
export function placeIndicators(
  rings: readonly (readonly Point[])[],
  width: number,
  height: number,
  size: { width: number; height: number },
  anchor: IndicatorAnchor,
  label?: IndicatorBox | null,
): IndicatorBox | null;
export function pipInset(rings, width, height, centred: boolean): { x: number; y: number } | null;
export function contentShift(
  cluster: IndicatorBox,
  content: IndicatorBox,
  height: number,
  padding: number,
  alignY: TextAlignY,
  footer: boolean,
): { top: number; bottom: number } | null;
```

- `indicatorRings`: a shape the outline hit-test traces (`pickedByOutline`) → the **closed** lines of
  `shapeHitOutline(el)`; every other element → `[roundedRectRing(0, 0, w, h, cornerPx, cornerPx)]`.
  Non-positive sizes → `[]`.
- `topAnchor` / `footerAnchor`: `top-centre` / `bottom-centre` for a centred shape, else `top-right` /
  `bottom-left`.
- `contentBox`: font px = `fontPx`, else `LABEL_FONT_PX[textSize]` for a fixed size, else none.
  Text (when there is a font and non-blank label): per `\n` paragraph a width of
  `chars × px × LABEL_CHAR_EM`; lines = Σ ceil(width / (w − 2·padding)); width = widest, height =
  lines × px × `LABEL_LINE_EM`. An icon adds `gap + size` along its side (row for left / right,
  column for above / below; no gap without text) and sets the cross size to at least `size`. Both
  clamp to the padded box and are placed by the alignment inside the padding. Null with neither.
  `BoxedElementView` passes the label, size, padding and alignment, plus `fontPx` and `icon` from
  `inlineIconMetrics` / `inlineIconGap` when the shape has an inline icon.
- `placeIndicators`: slides an inset `s` from `INDICATOR_START_INSET_PX` in `INDICATOR_STEP_PX`
  steps and returns the first box that is **clear** and **fits**, or `null`:
  - top-right `{ x: width − s − w, y: s }`; top-centre `{ x: (width − w) / 2, y: s }`;
    bottom-left `{ x: s, y: height − s − h }`; bottom-centre `{ x: (width − w) / 2, y: height − s − h }`.
  - Stops (`null`) once the box passes the vertical centre or `x < 0`.
  - **Clear**: with `label`, at least `INDICATOR_OUTLINE_CLEARANCE_PX` from that box; without it,
    outside the middle band (`INDICATOR_MIDDLE_CLEARANCE_PX` short of the centre on its side).
  - **Fits**: all four corners and four edge midpoints inside some ring (`insidePolygon`), no ring
    vertex inside the box, every ring segment at least `INDICATOR_OUTLINE_CLEARANCE_PX` from every
    box edge (`segmentDistance`), segments whose bounds are farther than that skipped first.
- `pipInset`: half-pixel steps; centred → down `x = width / 2` up to `height / 2`, returning
  `{ x: width / 2, y: d }`; else along the 45° line up to `min(width, height) / 2`, returning
  `{ x: d, y: d }`; the first point inside a ring. Null with no rings or no hit (the pip then uses
  `badgeCornerInset`).
- `contentShift`: `need` = cluster bottom + clearance − content top (Top), or content bottom +
  clearance − cluster top (Footer). `need ≤ 0` → `{ 0, 0 }`. Content aligned against the move
  (bottom under Top, top under Footer) → null. `inset` = `2·need` for middle, `need` otherwise; null
  when `content.height + inset + 2·padding > height`; else `{ top: inset }` (Top) or
  `{ bottom: inset }` (Footer).
- `readElementIndicatorStyle(prefs)` → `'footer'` or `'off'` when stored exactly, else `'top'`.

## Behaviour and state

- Items, in order: commands first (`outline`, `tidy`, only for a mind root from
  `useMindOutlineBadge`), then `link`, `note`, `action`, `comment`. Footer renders commands **last**.
- `placeCluster(element, cornerPx, items, style, content)`, forms in order (Top → `top`; Footer →
  `footer` then `footer-compact`), for each:
  1. With a content box: `placeIndicators(..., contentBox)` → found: inset `{ 0, 0 }`.
  2. `placeIndicators(...)` without it → none: next form.
  3. No content box (a scale-to-fit label, no icon): inset `{ band, band }`, band = cluster's
     extent from its edge (`y + h` for Top, `height − y` for Footer) − padding, floored at 0.
  4. Else `contentShift(...)` → non-null: that inset; null: next form.
     Then the pip, inset `{ 0, 0 }`, at `pipInset(rings, w, h, centredIndicators(el))`.
- Style `'off'` (or no items) → `useIndicatorLayout` returns null: nothing drawn, no inset.
- Placement is memoised on the shape, size, corner, border radius, stroke width, the items' kinds
  and counts, the style and every `ContentLayout` field (icon size, side and gap included).
- Commands: `visibility: hidden` unless the element root (`group/el`) is hovered or the element is
  selected; their width is always part of the size so nothing moves when they appear.
- Hover / selection raises the glyphs from `opacity-50` (`REST`) to `opacity-85` (`ACTIVE`); the
  glyph under the pointer reaches 1.

## Presentation and UX

- Top cluster: items as 20×20 buttons (14px glyph, 3px padding), no gap, a backing in the element's
  fill (`indicatorBacking`, none when transparent) with 4px radius and 2px padding. Comment adds its
  count (11px, semibold, tabular) after the glyph.
- Footer row: 22px tall, 10px gap, 4px side padding; labelled items glyph 12px + 4px + 11px medium
  word; the action's 16px initials disc in the assignee's colour (`IDENTITY_FILL`); compact drops
  the words.
- Pip: centred on its inset with `translate(50%, -50%)`, 22px tall, element fill, 1px ring in the
  text colour at 15%, `rounded-full` on rounded elements else `rounded-md`, 11px glyphs.
- Content inset: `InsetContent` is an `absolute inset-x-0` box with `top` / `bottom` from the inset,
  around the inline-icon layout and the plain label (both `absolute inset-0` inside it). Web
  components, pages, lanes and icon captions lay out their own content and are not moved.
- All glyphs inherit the element's text colour (`currentColor`).

## Accessibility

- Buttons with the labels in the spec; focus-visible ring 2px in the text colour.
- Hidden commands use `visibility: hidden` (out of tab order and AX tree).
- Link and action keep their `HoverCard`s.

## Errors and edge cases

| Case                                       | Handling                                    |
| ------------------------------------------ | ------------------------------------------- |
| No rings (zero size)                       | `placeIndicators` → `null` → pip            |
| Element too small / thin / spiky           | `null` → pip                                |
| Content under the cluster, room to move    | `contentShift` moves it                     |
| Content under the cluster, no room to move | pip                                         |
| Content aligned against the move           | pip                                         |
| Label runs under the glyphs anyway         | the fill backing masks it (estimate margin) |
| Transparent fill (frame, text)             | no backing                                  |
| Zoom below `ADORNMENT_MIN_ZOOM`            | nothing renders; the inset stays (stable)   |
| Style Off                                  | nothing renders, no inset                   |
| Unknown stored style                       | reads as `'top'`                            |

## Performance and limits

Rings are at most a few hundred points (`PATH_ARC_SEGMENTS` arcs, 12-segment cubics). Each form runs
at most two slides of `height / 2 / INDICATOR_STEP_PX` steps, each pruned by bounding box; the result
is memoised per element and only computed for elements that carry an indicator. Only those elements
read the style context.

## Constants and configuration

| Constant                         | Value | Safe range  | Provenance                                   |
| -------------------------------- | ----- | ----------- | -------------------------------------------- |
| `INDICATOR_OUTLINE_CLEARANCE_PX` | 6     | 4 to 10     | spec: "at least 6px clear"                   |
| `INDICATOR_MIDDLE_CLEARANCE_PX`  | 14    | 8 to 24     | spec: middle band "14px short of the centre" |
| `INDICATOR_START_INSET_PX`       | 3     | 0 to 6      | D75                                          |
| `INDICATOR_STEP_PX`              | 1     | 1 to 2      | D75                                          |
| `LABEL_CHAR_EM`                  | 0.58  | 0.5 to 0.65 | D79: a generous average advance              |
| `LABEL_LINE_EM`                  | 1.3   | 1.2 to 1.5  | D79                                          |

## Observability

Placement is pure and deterministic; no logs. A style change is the telemetry event in the spec.

## Testing

| Rule                                                           | Test                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| Rounded rect: Top fits tight, clear of the outline             | `packages/document/src/indicator-placement.test.ts`      |
| Circle: slides along the diagonal, stays inside                | same                                                     |
| Diamond / small pill / thin bar: no fit → `null`               | same                                                     |
| Never crosses the middle band                                  | same                                                     |
| A short fixed label frees the corner; a long one does not      | same                                                     |
| Centred shapes anchor top-centre / bottom-centre; boxes do not | same                                                     |
| A centred cluster sits inside a circle's and a hexagon's top   | same                                                     |
| Pip: hexagon's edge, rounded box's curve, diamond's apex       | same                                                     |
| Content box counts an inline icon                              | same                                                     |
| Content shift: twice for middle, refuses against the alignment | same                                                     |
| Unknown style reads as Top; Footer and Off read back           | `apps/live/lib/element-indicator-style.test.ts`          |
| Commands hidden at rest, shown when selected; labels; counts   | `apps/live/components/canvas/ElementIndicators.test.tsx` |
| Off draws nothing                                              | same                                                     |
| Icon + label move down under Top; clear content stays          | same                                                     |
| Scale label shrinks evenly; nothing moves for the pip          | same                                                     |
| Footer uses words, falls back to compact and to the pip        | same                                                     |
| Settings row writes the style and fires the choice event       | `settings-catalogue.test.ts` (existing per-row rules)    |
