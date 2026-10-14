# Concept graphics: blueprint

Derived from [Concept graphics](../concept-graphics.md). Defaults in [DEFAULTS.md](DEFAULTS.md) as `Dn`.

| File                                                                                                 | Role                                                                         |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `packages/document/src/concept.ts`                                                                   | Kinds, rows, bounds, ramp, the three layouts, variant + anim writes          |
| `packages/document/src/web-components.ts`                                                            | `conceptRows` in `WebRows`; `withWebRows`, `appendWebRow`, `canAppendWebRow` |
| `packages/document/src/svg-render-concept.ts`                                                        | `svgConcept`: the headless body (rest frame)                                 |
| `packages/document/src/shape-variants.ts`                                                            | `pyramid` + `funnel` / `inverted` variants                                   |
| `apps/live/components/canvas/ConceptFace.tsx`                                                        | Canvas face: rows, in-place lines, the Cycle's centre label                  |
| `apps/live/app/canvas-motion.css`                                                                    | `lvd-concept-*` keyframes                                                    |
| `apps/live/components/palette/ConceptMenuSection.tsx`                                                | Variant tiles, a hub's Spokes; none for a kind with neither                  |
| `apps/live/components/palette/context-menu-web-editors.tsx`                                          | The Rows editor (label + note); none for chevrons                            |
| `apps/live/components/canvas/ConceptRowBar.tsx`                                                      | `ChevronStageControls` (hover zones, bars) and `ConceptRowBar`               |
| `apps/live/hooks/ui/useGraceHover.ts`                                                                | The hovered stage, cleared `HOVER_GRACE_MS` after the pointer leaves         |
| `apps/live/lib/move-row.ts`                                                                          | `moveRow`, shared by the Rows editor and the stage bar                       |
| `apps/live/components/palette/palette-categories.tsx`, `palette-tile-defs.tsx`, `palette-layouts.ts` | The Concepts category                                                        |

## Domain and naming

| Term              | Identifier                                                                                                 | Meaning                |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------- |
| Concept graphic   | `ConceptShape = 'layer-stack' \| 'pyramid' \| 'cycle' \| 'hub' \| 'onion' \| 'chevrons'`, `isConceptShape` | The six kinds          |
| Row               | `ConceptRow = { label: string; note?: string }`                                                            | A layer, tier or step  |
| Variant           | `PyramidVariant = 'pyramid' \| 'inverted' \| 'funnel'`                                                     | Absent = pyramid       |
| Concept animation | `ConceptAnim = 'build' \| 'pulse' \| 'flow'`                                                               | `flow` only on a Cycle |
| Spokes            | `hubSpokes?: boolean`                                                                                      | Absent = on; Hub only  |

Banned: "SmartArt", "tier" for a Cycle step in copy ("Step"), "layer" for the Layers feature.

## Behaviour and state

### Bounds (`CONCEPT_ROWS`)

| Kind        | min | max | Notes drawn          | Add row says  |
| ----------- | --- | --- | -------------------- | ------------- |
| layer-stack | 2   | 8   | side notes           | "Layer n"     |
| pyramid     | 2   | 6   | values (funnel only) | "Tier n"      |
| cycle       | 3   | 8   | none                 | "Step n"      |
| hub         | 3   | 8   | none                 | "Satellite n" |
| onion       | 2   | 6   | none                 | "Ring n"      |
| chevrons    | 2   | 8   | notes under stages   | "Stage n"     |

`CONCEPT_LABEL_MAX` 60, `CONCEPT_NOTE_MAX` 40. `withWebRows(el, { conceptRows })` trims and collapses each string,
slices the array to the kind's max and ignores a write below its min (as the web components' rows). An empty note
stores `undefined`.

### Ramp

`conceptRamp(n, accent, fill)`: row `i` of `n` is `mixHex(accent, fill, 1 - 0.78 * i / max(1, n - 1))` (the first row
the accent, the last 22% accent); the text on each is `labelOn(rowFill)`. A non-hex colour falls back to the accent
for every row.

### Layouts (element-relative; canvas and export call the same functions)

- `layerStackLayout(w, h, n, notes)`: gap 6; band height `(h - 6(n - 1)) / n`; bands span `w` or, with notes,
  `round(w * 0.62)`; a note column from the band's right + 16 to `w`, a 10 px rule joining each; label px
  `round(clamp(bandH * 0.36, 11, 20))`, note px `round(clamp(labelPx * 0.8, 10, 16))`.
- `conceptFitPx(text, width, px)`: a row's text shrinks from its kind's size until its characters fit (0.6 em each),
  never under 10 px, then ellipses; canvas and export call it alike.
- `pyramidLayout(w, h, n, variant)`: gap 4; tier height `(h - 4(n - 1)) / n`. Pyramid: the half-width at depth `y`
  is `(y / h) * w / 2`, the apex at the top centre; Inverted mirrors it vertically. Funnel: tier `i`'s top half-width
  is `lerp(w / 2, 0.175 w, i / n)` and its bottom `lerp(w / 2, 0.175 w, (i + 1) / n)`. Each tier is four points (three
  at a pyramid's apex); its label rect is centred, as wide as the tier at the label's middle less 8; an apex tier's label takes its wide 60%. Label
  px `round(clamp(tierH * 0.34, 10, 20))`; a Funnel's value follows its label after a gap in the same rect.
- `cycleLayout(w, h, n)`: `S = min(w, h) / 2`; disc radius `r = min(S * 0.26, S * sin(π / n) * 0.6)`; ring radius
  `R = S - r - 2`; disc `i` at angle `-90° + i * 360° / n` about the centre; arc `i` from disc `i` to `i + 1`, clockwise,
  each end inset by `asin(min(1, (r + 6) / R))`; label px `round(clamp(r * 0.36, 10, 16))`; centre label rect a square
  of side `(R - r) * 1.2` about the centre.

- `hubLayout(w, h, n)`: `S = min(w, h) / 2`; satellite radius `r = min(S * 0.25, S * sin(π / n) * 0.6)`; ring
  `R = S - r - 2`; hub radius `H = max(16, min(S * 0.34, R - r - 10))`; satellite `i` at `-90° + i * 360° / n`;
  spoke `i` from the hub's edge to the satellite's edge along their line; satellite label rect the disc's box inset 2 px each side; hub
  label rect a square of side `H * 1.4` about the centre; label px `round(clamp(r * 0.3, 10, 14))`.
- `onionLayout(w, h, n)`: `S = min(w, h) / 2`; ring `k` (0 = core) has radius `S * (k + 1) / n`; drawn outermost
  first; the core's label rect `S / n * 1.9` wide and `S / n * 1.4` tall about the centre; ring `k > 0`'s label rect is centred
  at the top of its band (`y` from `cy - R_k` to `cy - R_{k-1}`), `width = min(w, R_k * 1.1)`; label px
  `round(clamp(S / n * 0.36, 10, 18))`.
- `chevronLayout(w, h, n, notes)`: chevron height `ch = notes ? round(h * 0.62) : h`; gap 4; point depth
  `p = min(ch * 0.35, w / n / 3)`; stage width `sw = (w + (n - 1) * (p - 4)) / n`; stage `i` from `x0 = i * (sw - p + 4)`;
  points: top-left, `(x0 + sw - p, 0)`, the point `(x0 + sw, ch / 2)`, `(x0 + sw - p, ch)`, bottom-left, and for `i > 0`
  the notch `(x0 + p, ch / 2)`; label rect from `x0 + (i > 0 ? p : 0) + 4` to `x0 + sw - p - 4`, the full height; note
  rect from `x0` to `x0 + sw - p`, `y = ch + 8` to `h`; label px `round(clamp(ch * 0.24, 10, 18))`, note px
  `round(clamp(labelPx * 0.8, 10, 14))`.

### Writes

`withPyramidVariant(el, variant | null)`; `withHubSpokes(el, on)` (on deletes the field, off stores `false`); `withConceptAnim(el, anim | null)`, `withConceptAnimSpeed`,
`withConceptAnimRepeat`: through the menu's generic style ops. Telemetry: `PyramidVariant`, `ConceptAnim`; rows
`ConceptRows` (the web rows setter).

### Animation (CSS, `apps/live/app/canvas-motion.css`)

Each row element carries `--i` (its index in reading order) and the face `--n` and `--lvd-concept-speed`:

- `build`: `lvd-concept-build` per row, 0.45 s × speed, delay `--i * 0.18 s × speed`, `both`; Repeat on loops with a
  1.5 s hold (`infinite`).
- `pulse`: `lvd-concept-pulse`, duration `(--n * 0.6 + 0.8) s × speed`, delay `--i * 0.6 s × speed`, `infinite`; a
  brightness lift and 3% scale in the first 8%, settled by 16%.
- `flow` (Cycle arcs): `stroke-dasharray: 6 6`, `stroke-dashoffset` to -24 over 1.2 s × speed, linear, `infinite`.
- Build's reading order: stack top to bottom, pyramid base up (`--i` reversed), funnel and inverted top down, cycle
  clockwise from step 1 (each arc after its step), hub: the hub first (`--i` 0) then satellite `i` at `i + 1` with its
  spoke, onion core outward, chevrons left to right.
- `prefers-reduced-motion: reduce` → `animation: none`. Exports draw the rest frame (no classes).

### Invariants

- I1: row count within the kind's bounds after any write.
- I2: canvas and export place every row from the same layout call.
- I3: a stored `conceptAnim` the kind does not offer (flow on a stack) renders as none.

## Interfaces and contracts

```ts
export type ConceptShape = 'layer-stack' | 'pyramid' | 'cycle';
export type ConceptRow = { label: string; note?: string };
export type PyramidVariant = 'pyramid' | 'inverted' | 'funnel';
export type ConceptAnim = 'build' | 'pulse' | 'flow';
export const CONCEPT_ROWS: Record<ConceptShape, { min: number; max: number; noun: string }>;
export function isConceptShape(kind: string): kind is ConceptShape;
export function conceptAnimsFor(kind: ConceptShape): readonly ConceptAnim[];
export function conceptRamp(
  n: number,
  accent: string,
  fill: string,
): { fill: string; text: string }[];
export function layerStackLayout(w: number, h: number, n: number, notes: boolean): LayerStackLayout;
export function pyramidLayout(
  w: number,
  h: number,
  n: number,
  variant: PyramidVariant,
): PyramidLayout;
export function cycleLayout(w: number, h: number, n: number): CycleLayout;
```

Validation: `conceptRows` array of at most 8 `{ label ≤ 60, note? ≤ 40 }`; `pyramidVariant` one of three. The
animation fields are cosmetic and lenient, like every element animation: an unknown value renders as none.

## Data and persistence

| Field            | Class     | Notes                                                                     |
| ---------------- | --------- | ------------------------------------------------------------------------- |
| `conceptRows`    | persisted | Order is meaning                                                          |
| `pyramidVariant` | persisted | Absent = pyramid                                                          |
| `conceptAnim*`   | persisted | Cosmetic; Repeat stored only when it differs from the animation's default |

## Errors and edge cases

| #   | Case                                  | Handling                                                                       |
| --- | ------------------------------------- | ------------------------------------------------------------------------------ |
| E1  | No rows stored (an agent's bare kind) | Draws nothing but its centre label; Add Row starts at one                      |
| E2  | Label too long for its tier           | Ellipsed (canvas `truncate`, export character clip)                            |
| E3  | Rows past the max (an old client)     | Validation refuses past 8; a pyramid with 7 or 8 draws all (layout is generic) |
| E4  | Non-hex colours                       | Every row in the accent; text `labelOn` of the accent                          |

## Security and trust

Strings render as React text and `xmlEscape`d in export; bounded by validation.

## Performance and limits

Layouts are O(rows) ≤ 8. Animations are CSS on at most 16 nodes per element (rows + arcs); none run while the
element is still.

## Presentation and UX

- Starting content (D186): stack 360 × 260 Presentation / API / Domain / Storage with notes "Next.js", "Workers",
  "packages/document", "D1"; pyramid 320 × 260 Vision / Strategy / Objectives / Daily work; funnel 340 × 260 Visited
  12,400 / Signed up 3,100 / Activated 820 / Retained 210; cycle 300 × 300 Plan / Do / Check / Act, centre "Weekly loop". Round 2 (D188): hub 340 × 320 Payments / Stock / Email / Search / Analytics / Support,
  centre "Orders"; onion 320 × 320 Domain / Application / Adapters / Infrastructure; chevrons 600 × 150 Commit /
  Build / Test / Release with notes "push to main", "2 min", "8,400 tests", "manual gate".
- Chevron stage bars (`ChevronStageControls`, only while `editable`: selected, unlocked, an Editor): one transparent
  zone per stage (its outline's bounding box) under the stages arms the hover; the hovered stage's `ConceptRowBar` is
  drawn over the stages, centred on the stage's label box, `BAR_INSET_PX` (6) screen px inside its top, scaled by
  `1 / zoom` about its top centre; its pointer-down stops propagation. Every stage's bar shows when
  `isMobileViewportSync()`. Move writes `moveRow`, Delete filters the row, Add Note (only while no row has a note) sets
  that row's `note: 'Note'`, all through `onSetRows` (`withWebRows`).
- Menu (Tools flyout): **Rows** for every kind but chevrons (label + note per row where drawn, ↑ ↓ ×, Add Layer /
  Tier / Step), **Pyramid**
  variant tiles (Pyramid, Inverted, Funnel). **Animation** is the Animation row's Concept section
  (`ElementAnimationTiles.tsx` `ConceptAnimTiles`: None, Build, Pulse, Flow on a Cycle; Speed; Repeat); a concept
  graphic takes no Shape set (`animation-membership.ts` `hasOwnBodySet`).
- Ring: Add Layer / Add Tier / Add Step.
- Palette **Concepts** category (Structure band, rows with blurbs): Layer Stack, Pyramid, Funnel, Cycle.

## Accessibility

In-place lines `role="textbox"` "Layer 1", "Layer 1 note", "Tier 2", "Step 3"; variant tiles named; the face's
polygons are `aria-hidden`.

## Web experience

In-place edits commit on blur (INP); animations are compositor-only except Flow's dash offset on at most 8 arcs.

## Observability

`Element·Added·LayerStack` / `Pyramid` / `Cycle`; `Element·Changed·ConceptRows`, `PyramidVariant`, `ConceptAnim`.

## Testing

| Rule                                             | Test file                                                        |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| Bounds (I1), ramp, layouts per kind (I2)         | `packages/document/src/concept.test.ts`                          |
| Writes, anims offered (I3), validation           | same                                                             |
| Export draws rows, notes, arcs                   | same                                                             |
| Face, in-place commit                            | `apps/live/components/canvas/ConceptFace.test.tsx`               |
| Menu section                                     | `apps/live/components/palette/ConceptMenuSection.test.tsx`       |
| Chevron stage bars (hover, phone, roles, writes) | `apps/live/components/canvas/ConceptRowBar.test.tsx`             |
| No Rows section for chevrons                     | `apps/live/components/palette/context-menu-web-editors.test.tsx` |
| Motion budget (loops infinite, reduced motion)   | existing CSS motion-budget test                                  |

## Constants and configuration

| Name                | Value  | Provenance / safe range                       |
| ------------------- | ------ | --------------------------------------------- |
| `CONCEPT_LABEL_MAX` | 60     | Spec                                          |
| `CONCEPT_NOTE_MAX`  | 40     | Spec                                          |
| Ramp floor          | 0.22   | Spec                                          |
| Stack band share    | 0.62   | Spec                                          |
| Funnel tip          | 0.35   | Spec                                          |
| Build stagger       | 0.18 s | D187; 0.1 to 0.3                              |
| Pulse beat          | 0.6 s  | D187; 0.4 to 1                                |
| `BAR_INSET_PX`      | 6      | Clears the stage's top edge; 4 to 10          |
| `HOVER_GRACE_MS`    | 250    | Same as the table's axis triggers; 150 to 400 |
