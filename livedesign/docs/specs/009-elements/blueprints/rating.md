# Rating: blueprint

Derived from [Rating](../rating.md). The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as
`Dn`.

Scope, by file:

| File                                                      | Role                                                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/data-shapes.ts`                    | `RATING_MAX`, `RATING_DEFAULT`, `RatingAnim`, `RATING_ANIMS`, `RATING_LOOPING_ANIMS`, `isRatingShape`, `clampRating` |
| `packages/document/src/element-types.ts`                  | `rating`, `ratingAnim`, `ratingAnimSpeed`, `ratingAnimRepeat`                                                        |
| `packages/document/src/shape-factory.ts`                  | Size 200 × 44; seeds `rating` and the amber stroke                                                                   |
| `packages/document/src/colors.ts`                         | `SELF_PAINTING_SHAPES` membership                                                                                    |
| `packages/document/src/svg-render-data.ts`                | `svgRating`: the export body                                                                                         |
| `packages/document/src/svg-render-body.ts`                | `svgElementBody`: routes `'rating'` to `svgRating` with the resolved stroke                                          |
| `apps/live/components/canvas/RatingView.tsx`              | Canvas stars, animation class, stagger                                                                               |
| `apps/live/components/canvas/ShapeContentRouter.tsx`      | Routes `'rating'` to `RatingView`                                                                                    |
| `apps/live/components/canvas/element-variant.ts`          | Borderless wrapper via `SELF_PAINTING_SHAPES`                                                                        |
| `apps/live/app/canvas-motion.css`                         | `lvd-rating-*` keyframes and the reduced-motion override                                                             |
| `apps/live/components/palette/context-menu-data-rows.tsx` | `RatingPickerRow`, `RatingAnimTiles`, `AnimTiles`, `RatingMenuGlyph`                                                 |
| `apps/live/components/palette/ElementDataSections.tsx`    | The Rating section inside the Tools flyout                                                                           |
| `apps/live/hooks/canvas/useChartSetters.ts`               | The four rating setters, via `makeShapePatcher`                                                                      |
| `apps/live/components/palette/palette-tile-defs.tsx`      | Tile `data:rating`                                                                                                   |

## Domain and naming

| Term           | Identifier                              | Meaning                                                    |
| -------------- | --------------------------------------- | ---------------------------------------------------------- |
| Rating         | `ShapeKind` `'rating'`, `isRatingShape` | A row of `RATING_MAX` stars                                |
| Score          | `ShapeElement.rating`                   | Filled star count, whole number in `[0, RATING_MAX]` [QE1] |
| Star animation | `ShapeElement.ratingAnim: RatingAnim`   | `'pop' \| 'twinkle' \| 'pulse' \| 'rock'`                  |
| Speed / repeat | `ratingAnimSpeed`, `ratingAnimRepeat`   | The shared speed set and loop override                     |
| Accent         | the element's stroke colour             | Tints the filled stars                                     |
| Star picker    | `RatingPickerRow`                       | Menu row of five buttons setting 1 to 5                    |

Banned synonyms: "stars value", "score animation" (say star animation), "review".

## Behaviour and state

### Create

`createShape('rating', x, y)` seeds `rating: RATING_DEFAULT` (3) and `strokeColor: '#f59e0b'`
(amber-500); size 200 × 44. Style memory
([Quick style panel](../../008-canvas/quick-style-panel.md)) then dresses it with the colours last
picked for ratings (`applyStyleMemory`), which may replace the amber.

### Render

1. `score = clampRating(element.rating ?? RATING_DEFAULT)`.
2. Star size `max(12, min(height * 0.8, (width / RATING_MAX) * 0.86))`, gap `star * 0.16`, the row
   centred in the box.
3. Star `i` is filled when `i < score`: fill and stroke the accent, stroke width 0. Empty: no fill,
   stroke `#cbd5e1`, width 1.6.
4. Only filled stars carry `animClass('rating', ratingAnim)` plus
   `animSpeedVars('rating', ratingAnimSpeed, loops)`, `transformOrigin: center`.
5. Stagger: for `pop` and `twinkle`, star `i` is delayed `i * 0.12 * speedFactor` seconds;
   `pulse` and `rock` move in unison.
6. The wrapper paints no border or background (`SELF_PAINTING_SHAPES`); only the selection ring.

`loops = animLoops(ratingAnim, ratingAnimRepeat, RATING_LOOPING_ANIMS)` with
`RATING_LOOPING_ANIMS = ['twinkle', 'pulse']`: pop and rock play once, twinkle and pulse loop.

### Edit

1. The Rating section (Tools flyout) shows `RatingPickerRow`: five buttons, `aria-label` "n star(s)",
   each calling `setRatingSelected(n)` with `n` in `1..5`; a star is lit when `n <= value`.
2. `RatingAnimTiles`: an "Animation" header, None + the four, then Speed and Repeat, which mount
   once one is set and so grow the Tools flyout on a selection [QE14].
3. The boxed Animation category is also offered [QE2].
4. There is no on-canvas interaction: the stars are not buttons (`D100`).

### Setters

`makeShapePatcher({ matches: (kind) => kind === 'rating' })`:

| Setter                        | Patch                            | Telemetry type |
| ----------------------------- | -------------------------------- | -------------- |
| `setRatingSelected(v)`        | `{ rating: clampRating(v) }`     | `Rating`       |
| `setRatingAnimSelected(v)`    | `{ ratingAnim: v ?? undefined }` | `RatingAnim`   |
| `setRatingAnimSpeedSelected`  | `{ ratingAnimSpeed: v }`         | `RatingAnim`   |
| `setRatingAnimRepeatSelected` | `{ ratingAnimRepeat: v }`        | `RatingAnim`   |

Invariants: the empty-selection and per-element kind-gate rules of `makeShapePatcher`; a rendered
score is always a whole number in `[0, RATING_MAX]`.

## Interfaces and contracts

```ts
export const RATING_MAX = 5;
export const RATING_DEFAULT = 3;
export type RatingAnim = 'pop' | 'twinkle' | 'pulse' | 'rock';
export const RATING_ANIMS: readonly RatingAnim[] = ['pop', 'twinkle', 'pulse', 'rock'];
export const RATING_LOOPING_ANIMS: readonly RatingAnim[] = ['twinkle', 'pulse'];
export function isRatingShape(kind: ShapeKind): boolean;
export function clampRating(value: number): number; // round, clamp to [0, RATING_MAX]
export function svgRating(el: Data, accent: string): string;
export function RatingView(props: { element: ShapeElement; accent: string }): JSX.Element;
```

`validate.ts` does not check the four fields [GE5]; the renderer clamps the score and an unknown
animation maps to a class with no keyframes (static).

## Data and persistence

All four fields are persisted and optional. Absent `rating` renders 3; absent speed is `'slow'`;
absent repeat follows the loop rule. No migration.

## Errors and edge cases

| #   | Case                       | Handling                                                                                                   |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| E1  | `rating` 0                 | Five empty stars; the picker cannot set 0 [QE1]                                                            |
| E2  | `rating` > 5, < 0, decimal | `clampRating` rounds and clamps                                                                            |
| E3  | Unknown `ratingAnim`       | `lvd-rating-<x>` has no rule; static                                                                       |
| E4  | Very narrow or short box   | Star floor 12 px; stars overflow the box, unclipped                                                        |
| E5  | Theme switch               | `switchThemeElement` keeps the seeded amber (it is not the old theme's stroke); Reset to Theme replaces it |

## Security and trust

Values reach a numeric clamp and a class-name suffix; nothing from the element is written into
markup except the accent colour attribute, escaped by `xmlEscape` in the export [GE5].

## Performance and limits

Five small SVGs per element; CSS-only animation on `transform` / `opacity`.

## Presentation and UX

Five stars centred in the box, filled in the accent, empty in slate-300 outline. Palette: Data
category, caption "Rating", blurb "A score out of five stars". The quick style panel's Stroke row
sets the accent; its Background row, like the menu's Fill, writes a fill nothing paints [GE18].

## Accessibility

- Reduced motion: every `lvd-rating-*` class is `animation: none`.
- Canvas stars are `aria-hidden`; the score has no text alternative on the canvas [GE10].
- Picker buttons are real buttons with an `aria-label` per star count.

## Web experience

Canvas-space only: no CLS. Setters commit once per click (INP).

## Observability

Telemetry only: `track('Element', 'Added', 'Rating')` on create (`shapeTelemetryToken`) and
`track('Element', 'Changed', 'Rating' | 'RatingAnim')` from the setters. No log fingerprints
[GE12].

## Testing

| Rule                                     | Test                                                   | File                                               |
| ---------------------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| `isRatingShape` matches only `'rating'`  | rating matches only its own kind                       | `packages/document/src/data-shapes.test.ts`        |
| Score clamps to 0..5                     | sets the star score (clamped 0..5) on the rating shape | `apps/live/hooks/canvas/useElementStyle.test.ts`   |
| Animation set and clear                  | sets and clears the rating animation                   | `apps/live/hooks/canvas/useElementStyle.test.ts`   |
| Kind gate                                | leaves non-rating shapes untouched                     | `apps/live/hooks/canvas/useElementStyle.test.ts`   |
| Patcher: own kind only, empty = no trace | `makeShapePatcher` cases                               | `apps/live/hooks/canvas/shape-patcher.test.ts`     |
| Export draws stars                       | draws more than a box and a label for each of them     | `packages/document/src/export-consistency.test.ts` |
| Default three filled, amber              | none [GE11]                                            |                                                    |
| Pop / rock once, twinkle / pulse loop    | none [GE11]                                            |                                                    |
| Stagger only for pop / twinkle           | none [GE11]                                            |                                                    |

## Constants and configuration

| Name                    | Value                                             | Provenance / safe range                      |
| ----------------------- | ------------------------------------------------- | -------------------------------------------- |
| `RATING_MAX`            | 5                                                 | Spec                                         |
| `RATING_DEFAULT`        | 3                                                 | Spec                                         |
| Default accent          | `#f59e0b`                                         | Spec "amber accent"; seeded in `createShape` |
| Empty star stroke       | `#cbd5e1` (`MUTED_RULE` in export)                | Inline in `RatingView` [GE13]                |
| Star sizing             | floor 12, `h * 0.8`, `w / 5 * 0.86`, gap 0.16     | Duplicated in view and `svgRating` [GE13]    |
| Stagger step            | 0.12 s × speed factor                             | Inline in `RatingView`                       |
| Keyframe base durations | pop 0.5 s, twinkle 1.4 s, pulse 1.3 s, rock 0.7 s | `canvas-motion.css`                          |
| Size                    | 200 × 44                                          | `SHAPE_DEFAULT_SIZE`                         |
