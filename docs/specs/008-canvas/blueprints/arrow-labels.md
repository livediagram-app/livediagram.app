# Arrow labels: blueprint

Derived from [Arrow labels](../arrow-labels.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file:

| File                                                                                                 | Role                                                                                     |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/document/src/arrow-label-layout.ts`                                                        | The layout engine: route, open run, width rule, wrap, slide, beside, knockout            |
| `packages/document/src/arrow-label-wrap.ts`                                                          | Word metrics, greedy wrap on cached widths, balanced wrap                                |
| `packages/document/src/arrow-label.ts`                                                               | `arrowLabelFontSize`: the caption size presets                                           |
| `packages/document/src/svg-render.ts`                                                                | `contentBounds` counts routes and label plates; one pass per render                      |
| `packages/document/src/svg-render-arrows.ts`                                                         | Export: multi-line caption, plate, knockout mask from the same layout                    |
| `apps/live/hooks/canvas/useArrowLabelLayouts.ts`                                                     | One `arrowLabelPass` per element change; `draftLayout`; `labelRectOf`; `sameLabelRender` |
| `apps/live/components/canvas/Canvas.tsx`                                                             | Calls the hook; feeds `labelRectOf` to the selection derivation                          |
| `apps/live/components/canvas/CanvasElementsLayer.tsx`                                                | Hands each `ArrowView` its render from the `arrowLabels` it is given                     |
| `apps/live/lib/canvas-selection.ts`                                                                  | Toolbar anchors span each selected arrow's selection extent                              |
| `apps/live/lib/export-tab.ts`                                                                        | PNG / PDF rasterise arrows from `svgArrow`; SVG export shares one pass                   |
| `apps/live/hooks/ui/useSlideThumbnails.ts`, `useLayerThumbnails.ts`, `components/canvas/Minimap.tsx` | One pass each, with their own mask-id prefix                                             |
| `apps/live/components/canvas/ArrowView.tsx`                                                          | Knockout mask on the line + halo; renders the layout it is given                         |
| `apps/live/components/canvas/ArrowLabel.tsx`                                                         | Multi-line SVG caption; textarea editor laid out by the same engine                      |

## Domain and naming

| Term             | Identifier                                       | Meaning                                                         |
| ---------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| Label layout     | `ArrowLabelLayout`                               | Where and how one label renders                                 |
| Layout mode      | `mode: 'on-line' \| 'beside' \| 'placed'`        | Auto on the route / auto beside it / user-dragged `labelOffset` |
| Route            | `route: Pt[]` (polyline, draw order)             | `arrowPathPolyline` of the resolved (spread) endpoints          |
| Placement        | `placementOf(arrow, route, clear, blockOn)`      | The span a label may occupy and its preferred centre `sc`       |
| Open run         | `openRunOf(span, clearances)`                    | A span minus end / corner clearances                            |
| Label block      | `LabelBlock = { lines, width, height }`          | Wrapped text plus padding; `width`/`height` are the plate size  |
| Footprint        | `footprintAlong(block, dir)`                     | Length of route the block covers when centred on it             |
| Knockout         | `knockout: Rect \| null`                         | The block inflated by `KNOCKOUT_MARGIN_PX`, cut from lines      |
| Plate rect       | `labelPlate(layout): Rect`                       | The plate as a rect, centred on `center`                        |
| Selection extent | `selectionExtent(el)` in `deriveCanvasSelection` | `elementBounds` unioned with the arrow's plate rect, if any     |

Banned synonyms: "caption box" (say label block), "gap" in code (say knockout), "midpoint" for the
label anchor (the anchor may slide).

## Behaviour

`layoutArrowLabels(elements, options?) => Map<ElementId, ArrowLabelLayout>` walks arrows in document
order (D17); each arrow's layout sees the knockouts of the arrows before it as obstacles.
`layoutArrowLabel(arrow, text, ctx)` lays out one arrow (used for the live editor with draft text).
An arrow with empty text has no entry.

1. **Route.** Resolve endpoints with `endpointPosition` plus `arrowEndpointSpread` (exactly as the
   canvas and export do), then `arrowPathPolyline`. Total length `L`. `L < 1` → beside at the
   `from` point.
2. **Clearances.** At an end carrying a head: `headLength(shape, size) + END_STUB_PX`; at a bare
   end: `END_STUB_PX`. `headLength = (8/6) * ARROWHEAD_SIZE_PX[size]`, times 1.5 for diamonds.
3. **Placement.** Whole-route open run `[w0, w1]`, route middle `sm = (w0 + w1) / 2`. Straight and
   curved: span `[0, L]`, `sc = sm`. Angled: the segment containing `sm`, if the block fits there with
   `sm` at least half its footprint from both ends of that segment's open run; `sc = sm`. Otherwise
   the longest segment (first in draw order on a tie, D18), `sc = sm` clamped to
   `[a + half, b - half]` of its open run. A segment boundary that is a corner takes `END_STUB_PX`.
4. **Open run** `[s0, s1]` = the span shrunk by the clearances. Empty (`s1 <= s0`) → beside.
5. **Local direction** at arc length `s`: unit vector from `pointAt(s - W)` to `pointAt(s + W)`,
   `W = LOCAL_DIRECTION_WINDOW_PX`, both clamped into `[0, L]`.
6. **Block** for the span, direction `u` at its open-run centre:
   - `half = (s1 - s0) / 2`.
   - Wrap at `cap = crossCapPx + (alongCapPx - crossCapPx) * u.x²` (D25). While `footprintAlong(block, u) > 2 * half` and the widest
     line has more than one word, re-wrap at `block.textWidth - 1`. Still too long → beside.
   - Balance: binary search the smallest width in `[longestWord, found]` that keeps the same line
     count (8 iterations, D19).
   - `footprintAlong(block, u) = min(block.width / |u.x|, block.height / |u.y|)`, with the knockout
     margin included on both sides; a zero component drops its term.
7. **Slide.** Candidates at `s = sc + k * step` for `k = 0, ±1, ±2, …` with `step = (s1 - s0) / 12`,
   limited to `[max(s0, sc - (s1 - s0) / 4), min(s1, sc + (s1 - s0) / 4)]`, ordered by `|k|`, `+`
   before `-` (D20). A candidate is taken when the block centred at `pointAt(s)` fits
   (`footprintAlong <= 2 * min(s - s0, s1 - s)`), and its knockout rect hits no obstacle. None
   taken → the centre candidate.
8. **Obstacles.** Boxed elements except `frame` and `lane` shapes (containers, D21), and knockouts
   already placed. The arrow's own endpoint elements are obstacles too, so a short arrow's label
   does not sit on a box it connects.
9. **Beside.** Anchor at the route point at `L / 2`, direction `u`, left normal `n = (-u.y, u.x)`.
   Offset `d = |n.x| * w/2 + |n.y| * h/2 + BESIDE_GAP_PX`. Starting at the cap for `u` and narrowing
   the wrap as in step 6, try `+n` then `-n` at each width; the first plate without an obstacle hit
   wins, else `+n` at the cap. `knockout: null`.
10. **Placed.** Centre = `arrowLabelAnchor(..., labelOffset, ...)`. Block wrapped at `cap`,
    balanced. Knockout when `|offset| < |n.x| * w/2 + |n.y| * h/2` (the block overlaps the line),
    else null.
11. **Own line only.** An arrow's mask takes its own label's knockout and no other; a label never
    cuts an arrow crossing beneath it.

## Interfaces

```ts
type ArrowLabelLayoutOptions = {
  crossCapPx: number;
  alongCapPx: number;
  // Font stack a caption paints in; the measure uses it.
  fontFamilyOf?: (arrow: ArrowElement) => string | undefined;
  // Injected for tests; defaults to labelMeasure.
  measureFor?: (
    fontPx: number,
    bold: boolean,
    italic: boolean,
    family?: string,
  ) => (s: string) => number;
};
type ArrowLabelLayout = {
  mode: 'on-line' | 'beside' | 'placed';
  center: Pt;
  lines: string[];
  fontPx: number;
  lineHeightPx: number;
  width: number; // plate width (text + 2 * LABEL_PAD_X_PX)
  height: number; // plate height (lines * lineHeight + 2 * LABEL_PAD_Y_PX)
  knockout: Rect | null;
};
```

Text is `arrow.label`, split on `\n` into explicit lines (kept), each wrapped. Words split on
whitespace; a single word wider than the cap is not broken (D22).

## Selection

- `useArrowLabelLayouts` returns `{ renderOf, labelRectOf, draftLayout }`, memoised on the pass, so
  a stable object feeds `deriveCanvasSelection`'s `useMemo`. `labelRectOf(id)` is
  `labelPlate(layout)` or `null` when the arrow has no label.
- `deriveCanvasSelection({ ..., labelRectOf? })`: `selectionBounds` and `multiToolbarBounds` are the
  union of each selected element's selection extent. Only arrows consult `labelRectOf`; boxed elements keep
  `elementBounds`. The extent uses the plate, not the knockout (D31): the toolbar gap already
  clears it.
- `Canvas` owns the pass (it needs it for the selection) and passes `arrowLabels` to
  `CanvasElementsLayer`.

## Rendering

- Canvas and export draw `lines` as one `<text>` with a `<tspan x dy>` per line, centred on
  `center`, `dominant-baseline="central"` on the block's vertical centre.
- The plate (`labelFill`) is the block rect, `rx = 4`.
- The knockout is a black rounded rect (`rx = KNOCKOUT_RADIUS_PX`) in the arrow's mask, merged with
  the route-behind holes into one mask. The mask region is the explicit vast span already used.

## Presentation and UX

- The editor is a `<textarea>` in a `<foreignObject>` at the plate, 2px wider than the plate
  (`EDITOR_SLACK_PX`), same font, size, weight, line height and padding as the label, centred,
  `placeholder="Label"`, white (dark: slate-900) with a sky ring. An empty draft is laid out as the
  word "Label" so there is always a box to type into.
- While editing, the label, its wrap and its knockout follow the draft on every keystroke.
- Selected and editable, the plate shows a dashed brand outline and the `move` cursor (label drag).

## Accessibility

- The editor has `aria-label="Arrow label"`; Enter commits (not mid-IME composition),
  Shift+Enter breaks the line, Escape cancels.
- Text colour and contrast are the caption's own, unchanged; the knockout only removes line
  behind the text, which can only raise contrast. No motion is added.

## Errors and edge cases

- Zero-length route, empty open run, word wider than cap: handled above; never throws.
- Label on a self-loop: route as drawn; same rules.
- `measureFor` returning NaN: treated as `CHAR_WIDTH_FALLBACK_PX * length` (D23).

## Performance

- Word widths cached per `(font, word)` in a module `Map`, capped at 2 000 entries (cleared when
  full, D24). Wrap sums cached widths; it never measures joined strings.
- Per arrow: at most `words` re-wraps, 8 balance wraps, 9 slide candidates × obstacles. 300 arrows
  × 200 boxes stays well under one frame on the hot path, which is a layout pass per element
  change, not per pointer move of an unrelated gesture.

## Web experience

- The pass runs in a `useMemo` on element changes only; pan, zoom, selection and presence renders
  reuse it, and `ArrowView` compares its label render by value, so an unmoved label does not
  re-render (INP). Labels are SVG in canvas space: no layout shift outside the canvas (CLS).

## Observability

`console.debug('[arrow-label]', id, mode, reason)` when a label falls back to beside (`reason`:
`short-route` / `empty-run` / `no-fit`). No log on the normal path.

## Testing

`arrow-label-layout.test.ts` and `arrow-label-wrap.test.ts`, with an injected fixed-width measure:
one test per numbered behaviour step, the angled route-middle and corner fallback, plus: horizontal width follows run length,
vertical width hits the cap, diagonal blends, balance avoids an orphan, explicit newline kept, head
clearance moves the centre, obstacle slides the anchor, slide stays within a quarter run of its centre, beside
when too short, beside side flips on an obstacle, placed knockout on and off, own knockout
only. Export parity: `svg-render.test.ts` asserts the export wraps and masks the same lines.
Selection: `canvas-selection.test.ts` (an arrow's bounds span its label, unlabelled arrow unchanged,
boxed element unaffected, multi-toolbar spans labels), `useArrowLabelLayouts.test.ts` (`labelPlate`),
and `e2e/arrow-labels.spec.ts` (the toolbar never overlaps a label above its line across 100 to
170 % zoom).

## Constants

| Name                        | Value | Provenance / safe range                      |
| --------------------------- | ----- | -------------------------------------------- |
| `END_STUB_PX`               | 12    | Visible line either side of a label; 8 to 24 |
| `LABEL_PAD_X_PX`            | 4     | Text to plate edge, horizontal; 2 to 8       |
| `LABEL_PAD_Y_PX`            | 2     | Text to plate edge, vertical; 1 to 6         |
| `KNOCKOUT_MARGIN_PX`        | 3     | Plate to cut edge; 0 to 8                    |
| `KNOCKOUT_RADIUS_PX`        | 4     | Rounded cut corners; matches the plate       |
| `BESIDE_GAP_PX`             | 6     | Line to beside-label edge; 4 to 12           |
| `LOCAL_DIRECTION_WINDOW_PX` | 24    | Half-window for local direction; 8 to 64     |
| `CROSS_CAP_PX`              | 120   | Chosen by the operator; safe 100 to 200      |
| `ALONG_CAP_PX`              | 240   | Chosen by the operator; safe 200 to 320      |
| `CHAR_WIDTH_FALLBACK_PX`    | 7     | Per char at 12 px, scaled; the old estimate  |
| `WORD_WIDTH_CACHE_MAX`      | 2000  | Cache bound                                  |
