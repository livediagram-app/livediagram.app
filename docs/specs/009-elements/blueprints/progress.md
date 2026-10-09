# Progress elements: blueprint

Derived from [Progress elements](../progress.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file:

| File                                                      | Role                                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/document/src/shape-kind.ts`                     | `'progress-bar'` and `'progress-ring'` in the `ShapeKind` union               |
| `packages/document/src/element-types.ts`                  | `progress`, `progressAnim`, `progressAnimSpeed`, `progressAnimRepeat` fields  |
| `packages/document/src/animation.ts`                      | `ProgressAnim`, `PROGRESS_ANIMS`, `PROGRESS_LOOPING_ANIMS`, `animLoops`       |
| `packages/document/src/data-shapes.ts`                    | `isProgressShape`, `clampPercent`, membership of `isSelfDrawingShape`         |
| `packages/document/src/shape-factory.ts`                  | `SHAPE_DEFAULT_SIZE` rows and the `createShape` seeds                         |
| `packages/document/src/colors.ts`                         | `SELF_PAINTING_SHAPES` membership (no wrapper border, no Border controls)     |
| `packages/document/src/svg-render-data.ts`                | `svgProgressBar`, `svgProgressRing`, `PROGRESS_LABEL_PX`: the export body     |
| `packages/document/src/svg-render-body.ts`                | `svgElementBody`: the export dispatch and the track, `PROGRESS_TRACK_DEFAULT` |
| `apps/live/components/canvas/ProgressView.tsx`            | Canvas bar and ring, the `lvd-prog-*` class choice                            |
| `apps/live/components/canvas/ShapeContentRouter.tsx`      | Routes the two kinds to `ProgressView` ahead of `ShapeSvgOverlay`             |
| `apps/live/app/canvas-motion.css`                         | The `lvd-prog-*` keyframes and their reduced-motion override                  |
| `apps/live/lib/icons.ts`                                  | `animSpeedVars`: the `--lvd-prog-speed` / `--lvd-prog-iter` properties        |
| `apps/live/components/palette/ElementDataSections.tsx`    | The Progress section inside the Tools flyout                                  |
| `apps/live/components/palette/context-menu-data-rows.tsx` | `ProgressRow`, `PercentSliderRow`, `ProgressAnimTiles`, `AnimTiles`           |
| `apps/live/hooks/canvas/useDataShapeSetters.ts`           | The four progress setters, via `makeShapePatcher`                             |
| `apps/live/hooks/canvas/shape-patcher.ts`                 | `makeShapePatcher`: selection-wide, kind-gated patch plus telemetry           |
| `apps/live/components/palette/palette-tile-defs.tsx`      | Tiles `data:progress-bar` and `data:progress-ring`                            |

## Domain and naming

| Term             | Identifier                                | Meaning                                                |
| ---------------- | ----------------------------------------- | ------------------------------------------------------ |
| Progress shape   | `isProgressShape(kind)`                   | A shape of kind `'progress-bar'` or `'progress-ring'`  |
| Progress bar     | `ShapeKind` `'progress-bar'`              | Horizontal pill meter                                  |
| Progress ring    | `ShapeKind` `'progress-ring'`             | Donut meter, aspect-locked                             |
| Percentage       | `ShapeElement.progress`                   | Filled share, a whole number in `[0, 100]`             |
| Fill animation   | `ShapeElement.progressAnim: ProgressAnim` | `'fill' \| 'pulse' \| 'stripes'`; absent = static fill |
| Animation speed  | `ShapeElement.progressAnimSpeed`          | `AnimationSpeed`, the shared four-step set             |
| Repeat           | `ShapeElement.progressAnimRepeat`         | Loop override; absent = the per-animation default      |
| Track            | the element's fill colour                 | The empty part of the meter                            |
| Filled portion   | the element's stroke (accent) colour      | The part sized to the percentage                       |
| Percentage label | the centred `{pct}%` text                 | Replaces the editable element label                    |

Banned synonyms: "progress value" (say percentage), "loader", "gauge", "meter animation" (say
fill animation).

## Behaviour and state

### Create

1. A palette tap or draw-to-size calls `createShape(kind, x, y)`.
2. Both kinds seed `progress: 50` and `progressAnim: 'fill'`; the ring also seeds
   `aspectLocked: true`.
3. Default size from `SHAPE_DEFAULT_SIZE`: bar 220 × 44, ring 130 × 130.
4. Style memory ([Quick style panel](../../008-canvas/quick-style-panel.md)) then dresses it with
   the colours last picked for its kind (`applyStyleMemory`).

### Render (canvas)

1. `ShapeContentRouter` sends a progress shape to `ProgressView`, with `accent` (the resolved
   stroke), `track = element.fillColor ?? '#e2e8f0'` on every paper [GE4] and `textColor`.
2. `pct = clampPercent(element.progress ?? 50)`.
3. **Bar**: a fully rounded track `div` in the track colour, an inner fill `div` of width `pct%`
   in the accent, and the class from `barFillClass`: `fill → lvd-prog-grow`,
   `pulse → lvd-prog-pulse`, `stripes → lvd-prog-stripes`, absent → none.
4. **Ring**: a 100 × 100 `viewBox`, stroke width 13, radius `50 - 13/2 - 1`; a track circle and an
   arc with `pathLength={100}`, `strokeDasharray="<pct> 100"`, round cap, `rotate(-90 50 50)` so it
   starts at twelve o'clock and sweeps clockwise. `fill → lvd-prog-ring-grow` keyed off
   `--lvd-progress`; `pulse → lvd-prog-pulse`; `stripes →` a full dashed circle (`4 3`, butt cap,
   `lvd-prog-ring-stripes`) masked to the progress sweep by a per-instance `useId` mask.
5. Both draw the `{pct}%` label (14 px, semibold, tabular numerals, `D97`), optically centred on
   its cap band (`text-optical-centre`; the export places its baseline with `capBandBaselineY`),
   and never the editable element label: `elementSupportsText` is false for self-drawing shapes.
6. Animation style: when `progressAnim` is set, `animSpeedVars('prog', progressAnimSpeed, loops)`
   with `loops = animLoops(progressAnim, progressAnimRepeat, PROGRESS_LOOPING_ANIMS)`.

### Loop rule

`animLoops(anim, repeat, loopingAnims) = repeat ?? (anim != null && loopingAnims.includes(anim))`.
With `PROGRESS_LOOPING_ANIMS = ['pulse', 'stripes']`, fill plays once and holds
(`animation-fill-mode: forwards`), pulse and stripes loop. `--lvd-prog-iter` is `1` or
`infinite`.

### Edit (context menu)

1. The Progress section shows only when `isProgressShape(target.shape)`, inside the Tools flyout.
2. `ProgressRow`: a 0 to 100 range input (`PercentSliderRow`, label "Percentage", right-aligned
   `{pct}%` readout) calling `setProgressSelected`.
3. `ProgressAnimTiles`: None / Fill / Pulse / Stripes tiles (`ProgressAnimPreview` miniatures in `AnimationPreviewTile`s), no header;
   once an animation is set, `SpeedTiles` (Slowest / Slow / Normal / Fast) and a Repeat toggle
   mount beneath, growing the Tools flyout on a selection [QE14].
4. The boxed-element Animation category is offered as well, animating the wrapper [QE2].
5. Progress shapes are excluded from the Shape morph grid (`isSelfDrawingShape`) and from Border
   controls (`SELF_PAINTING_SHAPES`).

### Setters

`setProgressFieldSelected = makeShapePatcher({ currentSelectionIds, commit, matches: isProgressShape })`.

| Setter                          | Patch                              | Telemetry type |
| ------------------------------- | ---------------------------------- | -------------- |
| `setProgressSelected(v)`        | `{ progress: clampPercent(v) }`    | `Progress`     |
| `setProgressAnimSelected(v)`    | `{ progressAnim: v ?? undefined }` | `ProgressAnim` |
| `setProgressAnimSpeedSelected`  | `{ progressAnimSpeed: v }`         | `ProgressAnim` |
| `setProgressAnimRepeatSelected` | `{ progressAnimRepeat: v }`        | `ProgressAnim` |

Guards and invariants:

- **I1**: an empty selection commits nothing and tracks nothing.
- **I2**: the kind gate is per element; a mixed selection patches only its progress shapes.
- **I3**: a rendered percentage is always a whole number in `[0, 100]`, whatever is stored.
- **I4**: one setter call is one commit, so one undo step.

## Interfaces and contracts

```ts
export type ProgressAnim = 'fill' | 'pulse' | 'stripes';
export const PROGRESS_ANIMS: readonly ProgressAnim[] = ['fill', 'pulse', 'stripes'];
export const PROGRESS_LOOPING_ANIMS: readonly ProgressAnim[] = ['pulse', 'stripes'];
export function isProgressShape(kind: ShapeKind): boolean;
export function clampPercent(value: number): number; // Math.round, clamp to [0, 100]
export function animLoops<T>(
  anim: T | null | undefined,
  repeat: boolean | undefined,
  loopingAnims: readonly T[],
): boolean;
// ShapeElement
progress?: number;
progressAnim?: ProgressAnim;
progressAnimSpeed?: AnimationSpeed;
progressAnimRepeat?: boolean;
// apps/live
export function ProgressView(props: {
  element: ShapeElement;
  accent: string;
  track: string;
  textColor: string;
}): JSX.Element;
```

Validation: `validate.ts` accepts `'progress-bar'` / `'progress-ring'` in `SHAPE_KINDS` and does not
check the four fields [GE5]. The renderer absorbs bad values: a non-finite or out-of-range
`progress` clamps (`D98`), an unknown `progressAnim` gets no class and renders static.

## Data and persistence

| Field                | Class     | Default when absent                  |
| -------------------- | --------- | ------------------------------------ |
| `progress`           | persisted | 50                                   |
| `progressAnim`       | persisted | static (seeded `'fill'` on create)   |
| `progressAnimSpeed`  | persisted | `DEFAULT_ANIMATION_SPEED` (`'slow'`) |
| `progressAnimRepeat` | persisted | `animLoops` default per animation    |
| mask id, CSS vars    | derived   | recomputed every render              |

No migration: every field is optional and read with a default.

## Errors and edge cases

| #   | Case                                   | Handling                                                           |
| --- | -------------------------------------- | ------------------------------------------------------------------ |
| E1  | `progress` absent                      | 50                                                                 |
| E2  | `progress` below 0, above 100, decimal | `clampPercent` rounds and clamps                                   |
| E3  | `progress` is 0                        | Bar fill width 0; export omits the fill rect and the ring arc      |
| E4  | Unknown `progressAnim`                 | No class; static fill                                              |
| E5  | Ring resized non-square                | `aspectLocked` keeps it square; the `viewBox` letterboxes          |
| E6  | Two rings with stripes on one board    | Mask ids from `useId`, never shared                                |
| E7  | Marker set via API on a progress shape | Not drawn (`isSelfDrawingShape`)                                   |
| E8  | `fillColor` absent, light paper        | Track `#e2e8f0` on the canvas and in the export                    |
| E9  | `fillColor` absent, dark paper         | Canvas `#e2e8f0` under a white label; export the themed fill [GE4] |

## Security and trust

The four fields arrive through the api like any element field. A hostile value reaches only a
number clamp, a class-name lookup that falls through, and CSS custom properties built from
`ANIMATION_SPEED_FACTOR`, so no string from the element is interpolated into markup or CSS
[GE5].

## Performance and limits

One `div` pair or two to three SVG circles per element; no measurement, no effect. The animation
is CSS only and compositor-friendly (`transform`, `opacity`, `stroke-dashoffset`,
`background-position`).

## Presentation and UX

- Colours: fill colour is the track, stroke colour the filled portion, text colour the label.
  The quick style panel's Background and Stroke rows set the track and the filled portion.
- The label reads `{pct}%`; there is no empty, loading or error state.
- Palette: Data category, captions "Progress" and "Donut", blurbs "How far along something is" and
  "The same, as a donut meter".

## Accessibility

- Reduced motion: `@media (prefers-reduced-motion: reduce)` sets `animation: none` on every
  `lvd-prog-*` class, so the resting frame is the static fill.
- The ring SVG is `aria-hidden`; the `{pct}%` text is real text in the DOM.
- The slider is a native range input with `aria-label="Percentage"`.
- Label contrast depends on the element's text colour against the track; no contrast check runs
  (`D99`).

## Web experience

Canvas-space content: no layout shift outside the element box (CLS). The keyframes run off the
main thread except `stroke-dashoffset` paint; INP is unaffected because the setters commit once
per input event.

## Observability

No log fingerprints: rendering is pure and the setters report through telemetry only. Telemetry:
`track('Element', 'Changed', 'Progress' | 'ProgressAnim')` from `makeShapePatcher`, and
`track('Element', 'Added', 'Progress-bar' | 'Progress-ring')` from the create path
(`shapeTelemetryToken`). Unknown-value fallbacks (E2, E4) are silent [GE12].

## Testing

| Rule                                              | Test                                                                                                       | File                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `isProgressShape` is exactly the two kinds        | progress covers both the bar and the ring                                                                  | `packages/document/src/data-shapes.test.ts`        |
| Self-drawing: no editable label                   | is false for the self-drawing data shapes                                                                  | `packages/document/src/element-has-text.test.ts`   |
| No Border controls                                | offers no border controls for any shape that draws its own body                                            | `packages/document/src/border.test.ts`             |
| Export draws the body, rasterised in PNG          | draws more than a box and a label for each of them; rasterises every kind whose body the SVG emitter draws | `packages/document/src/export-consistency.test.ts` |
| Export on dark paper paints no light track        | paints no element kind on a light base unless the element stores that fill                                 | `packages/document/src/svg-render-surface.test.ts` |
| Fill colour supported                             | stays on for the shapes that do paint one                                                                  | `packages/document/src/colors.test.ts`             |
| Setter patches only its kind, empty = no trace    | `makeShapePatcher` cases (rating fixture)                                                                  | `apps/live/hooks/canvas/shape-patcher.test.ts`     |
| Seeds `progress: 50`, `progressAnim: 'fill'`      | none [GE11]                                                                                                |                                                    |
| `clampPercent` rounds and clamps                  | none [GE11]                                                                                                |                                                    |
| Fill once, pulse / stripes loop, repeat overrides | none (`animLoops`) [GE11]                                                                                  |                                                    |
| Ring starts at twelve and sweeps clockwise        | none [GE11]                                                                                                |                                                    |
| Reduced motion freezes the fill                   | none [GE11]                                                                                                |                                                    |

## Constants and configuration

| Name                      | Value                                  | Provenance / safe range                               |
| ------------------------- | -------------------------------------- | ----------------------------------------------------- |
| `PROGRESS_ANIMS`          | `['fill', 'pulse', 'stripes']`         | Spec; closed set                                      |
| `PROGRESS_LOOPING_ANIMS`  | `['pulse', 'stripes']`                 | Spec: continuous by nature                            |
| `ANIMATION_SPEED_FACTOR`  | slowest 4, slow 2, normal 1, fast 0.5  | Shared with every element animation                   |
| `DEFAULT_ANIMATION_SPEED` | `'slow'`                               | Canvas and palette spec                               |
| `SHAPE_DEFAULT_SIZE`      | bar 220 × 44, ring 130 × 130           | Spec                                                  |
| Default percentage        | 50                                     | Spec; inline literal in view, export and setter       |
| Ring `STROKE`             | 13 (of a 100 viewBox)                  | Inline in `ProgressView` and `svgProgressRing` [GE13] |
| `PROGRESS_TRACK_DEFAULT`  | `#e2e8f0` (slate-200)                  | Export; the canvas repeats it inline [GE4] [GE13]     |
| Keyframe base durations   | grow 1.8 s, pulse 1.4 s, stripes 0.6 s | `canvas-motion.css`; scaled by `--lvd-prog-speed`     |
| `PROGRESS_LABEL_PX`       | 14 px, weight 600                      | Export; the canvas draws `text-sm font-semibold`      |
