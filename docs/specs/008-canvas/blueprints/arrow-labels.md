# Arrow labels: blueprint

Derived from [Arrow labels](../arrow-labels.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file:

| File                                                  | Role                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/diagram/src/arrow-label-layout.ts`          | The layout engine: route, open run, width rule, wrap, slide, beside, knockout |
| `packages/diagram/src/arrow-label-wrap.ts`            | Word metrics, greedy wrap on cached widths, balanced wrap                     |
| `packages/diagram/src/arrow-label.ts`                 | `arrowLabelFontSize` (unchanged); the char-width `arrowLabelSize` is removed  |
| `packages/diagram/src/svg-render-arrows.ts`           | Export: multi-line caption, plate, knockout mask from the same layout         |
| `apps/live/components/canvas/CanvasElementsLayer.tsx` | One `layoutArrowLabels` pass per element change, handed to each `ArrowView`   |
| `apps/live/components/canvas/ArrowView.tsx`           | Knockout mask on the line + halo; renders the layout it is given              |
| `apps/live/components/canvas/ArrowLabel.tsx`          | Multi-line SVG caption; textarea editor laid out by the same engine           |
| `apps/live/lib/arrow-label-geometry.ts`               | Removed (`placeLabel` is replaced by the engine)                              |
| `packages/diagram/bench/arrow-labels/`                | The label bench: scenarios, cap + knockout switches, esbuild, seed            |

## Domain and naming

| Term         | Identifier                                  | Meaning                                                         |
| ------------ | ------------------------------------------- | --------------------------------------------------------------- |
| Label layout | `ArrowLabelLayout`                          | Where and how one label renders                                 |
| Layout mode  | `mode: 'on-line' \| 'beside' \| 'placed'`   | Auto on the route / auto beside it / user-dragged `labelOffset` |
| Route        | `route: Pt[]` (polyline, draw order)        | `arrowPathPolyline` of the resolved (spread) endpoints          |
| Placement    | `placementOf(arrow, route, clear, blockOn)` | The span a label may occupy and its preferred centre `sc`       |
| Open run     | `openRunOf(span, clearances)`               | A span minus end / corner clearances                            |
| Label block  | `LabelBlock = { lines, width, height }`     | Wrapped text plus padding; `width`/`height` are the plate size  |
| Footprint    | `footprintAlong(block, dir)`                | Length of route the block covers when centred on it             |
| Knockout     | `knockout: Rect \| null`                    | The block inflated by `KNOCKOUT_MARGIN_PX`, cut from lines      |

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
11. **Knockout others.** When `options.knockoutOthers`, each arrow's mask also takes every other
    label's knockout that intersects its route's bounding box; otherwise only its own.

## Interfaces

```ts
type ArrowLabelLayoutOptions = {
  crossCapPx: number;
  alongCapPx: number;
  knockoutOthers: boolean;
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

## Rendering

- Canvas and export draw `lines` as one `<text>` with a `<tspan x dy>` per line, centred on
  `center`, `dominant-baseline="central"` on the block's vertical centre.
- The plate (`labelFill`) is the block rect, `rx = 4`.
- The knockout is a black rounded rect (`rx = KNOCKOUT_RADIUS_PX`) in the arrow's mask, merged with
  the route-behind holes into one mask. The mask region is the explicit vast span already used.

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

## Observability

`console.debug('[arrow-label]', id, mode, reason)` when a label falls back to beside (`reason`:
`short-route` / `empty-run` / `no-fit`). No log on the normal path.

## Testing

`arrow-label-layout.test.ts` and `arrow-label-wrap.test.ts`, with an injected fixed-width measure:
one test per numbered behaviour step, the angled route-middle and corner fallback, plus: horizontal width follows run length,
vertical width hits the cap, diagonal blends, balance avoids an orphan, explicit newline kept, head
clearance moves the centre, obstacle slides the anchor, slide stays within a quarter run of its centre, beside
when too short, beside side flips on an obstacle, placed knockout on and off, knockout-others
toggle. Export parity: `svg-render.test.ts` asserts the export wraps and masks the same lines.

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
| `CROSS_CAP_PX` (default)    | 160   | Bench decides; candidates 120 / 160 / 200    |
| `ALONG_CAP_PX` (default)    | 240   | Bench decides; candidates 200 / 240 / 320    |
| `CHAR_WIDTH_FALLBACK_PX`    | 7     | Per char at 12 px, scaled; the old estimate  |
| `WORD_WIDTH_CACHE_MAX`      | 2000  | Cache bound                                  |
