# Arrow anchors and auto-rebind: blueprint

Derived from [Arrow anchors and auto-rebind](../arrow-anchors.md), with the setting from
[User preferences](../../007-editor/user-preferences.md). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                          | Role                                                                                               |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `packages/diagram/src/arrow-types.ts`                         | `Anchor` (16 ids), `ALL_ANCHORS`, `Endpoint`                                                       |
| `packages/diagram/src/anchors.ts`                             | The anchor table: side, position class, box fraction, outward vector                               |
| `packages/diagram/src/shape-outline.ts`                       | Anchoring outlines, outline projection, point-inside test                                          |
| `packages/diagram/src/svg-path-outline.ts`                    | `sampleSvgPath`: an outline polygon from a drawn path (cloud, document)                            |
| `packages/diagram/src/shape-geometry.ts`                      | `ACTOR_HULL`, the actor's anchoring hull (D8)                                                      |
| `packages/diagram/src/geometry.ts`                            | `anchorPosition`                                                                                   |
| `packages/diagram/src/anchor-choice.ts`                       | `exitSideTowards`, `anchorAimPoint`, `bestAnchorTowards`                                           |
| `packages/diagram/src/arrow-path.ts`                          | `arrowPathPolyline` (exported centreline), side-aware curve/elbow rules                            |
| `packages/diagram/src/arrow-path-hits.ts`                     | `arrowPolyline`, `pathPassesThrough`, `pathsCross`, `pinnedBoxedElement`, `passesThroughOwnShapes` |
| `packages/diagram/src/arrow-rebind.ts`                        | `rebindArrowAnchorsAfterMove`, `arrowReferencesAny`                                                |
| `packages/diagram/src/arrow-rebind-swap.ts`                   | `swapCrossingEnds`                                                                                 |
| `packages/diagram/src/arrow-endpoint-spread.ts`               | Quarter fans                                                                                       |
| `packages/diagram/src/validate.ts`                            | `ANCHORS` derived from `ALL_ANCHORS`                                                               |
| `packages/diagram/src/legacy-groups.ts`                       | Legacy group anchors resolved through the table                                                    |
| `packages/diagram/src/duplicate.ts`                           | Endpoint copy without `manual`                                                                     |
| `apps/live/lib/user-preferences.ts`                           | `autoRebindArrowsEnabled`: on unless `false`                                                       |
| `apps/live/hooks/canvas/useEditorDrag.ts`                     | Live rebind per drag frame                                                                         |
| `apps/live/hooks/canvas/useNudgeSelection.ts`                 | Rebind per nudge                                                                                   |
| `apps/live/app/diagram/[id]/useArrowConnect.ts`               | Click-to-connect: creation anchors only, no rebind                                                 |
| `apps/live/hooks/canvas/arrow-endpoint-resolve.ts`            | Stops writing `manual`                                                                             |
| `apps/live/hooks/canvas/useBoxedDragHandlers.ts`              | Tap-placed arrow direction from `anchorOutward`                                                    |
| `apps/live/components/dialogs/settings/settings-catalogue.ts` | Setting copy                                                                                       |
| `apps/help/app/palette/auto-attach-arrows/page.mdx`           | Help article                                                                                       |
| `apps/api/src/ai-prompt.ts`                                   | Anchor list for the AI                                                                             |
| `apps/api/src/openapi/schemas.generated.ts`                   | Regenerated `Anchor` enum and pinned endpoint schema                                               |

## Domain and naming

| Term              | Identifier                                             | Meaning                                                             |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| Anchor            | `Anchor`                                               | One of the 16 ids                                                   |
| Side              | `Side = 'n' \| 'e' \| 's' \| 'w'`                      | An edge of the connector box                                        |
| Position class    | `AnchorClass = 'corner' \| 'quarter' \| 'middle'`      | Where along an edge an anchor sits                                  |
| Anchor set        | `anchorSetOf(el): readonly AnchorClass[]`              | The position classes an element offers                              |
| Offered anchors   | `offeredAnchors(el): readonly Anchor[]`                | The anchors of its set, table order                                 |
| Primary side      | `anchorPrimarySide(a)`                                 | The one side of a middle / quarter; a corner's horizontal side      |
| Connector box     | `connectorBox(el)`                                     | The element box, or a Technology icon's mark                        |
| Anchoring outline | `AnchorOutline`                                        | The outline anchors are projected onto and inside is tested against |
| Drawn path        | `arrowPolyline(arrow, index)`                          | The rendered path as a polyline, between true anchor points         |
| Considered arrow  | (internal) `considered: ElementId[]`                   | An arrow the run evaluates                                          |
| Trigger           | `pathPassesThrough`                                    | The drawn path goes inside a pinned end's shape                     |
| Facing side       | `exitSideTowards(el, aim)`                             | The side the centre-to-aim ray leaves through                       |
| Aim point         | `aimPointOf(other, centre, index)`                     | Closest point of the other connector box, or the other position     |
| Reference point   | `referencePointOf(other, index)`                       | Other connector box centre, or the other position                   |
| Held              | (internal) `held: Map<ElementId, Map<Anchor, number>>` | Pinned ends per anchor per element                                  |
| Swap              | `swapCrossingEnds`                                     | Two same-side ends trade anchors                                    |

Banned synonyms: "face" for side (the old algorithm's word), "port", "handle" for anchor,
"manual anchor", "distribution".

## Behaviour and state

### The anchor table (`anchors.ts`)

One `Record<Anchor, AnchorInfo>`; every helper reads it.

| Anchor | Class   | Sides    | Box fraction `(fx, fy)` | Outward `(x, y)`   |
| ------ | ------- | -------- | ----------------------- | ------------------ |
| `n`    | middle  | `n`      | `(0.5, 0)`              | `(0, -1)`          |
| `nne`  | quarter | `n`      | `(0.75, 0)`             | `(0, -1)`          |
| `ne`   | corner  | `n`, `e` | `(1, 0)`                | `(0.707, -0.707)`  |
| `ene`  | quarter | `e`      | `(1, 0.25)`             | `(1, 0)`           |
| `e`    | middle  | `e`      | `(1, 0.5)`              | `(1, 0)`           |
| `ese`  | quarter | `e`      | `(1, 0.75)`             | `(1, 0)`           |
| `se`   | corner  | `s`, `e` | `(1, 1)`                | `(0.707, 0.707)`   |
| `sse`  | quarter | `s`      | `(0.75, 1)`             | `(0, 1)`           |
| `s`    | middle  | `s`      | `(0.5, 1)`              | `(0, 1)`           |
| `ssw`  | quarter | `s`      | `(0.25, 1)`             | `(0, 1)`           |
| `sw`   | corner  | `s`, `w` | `(0, 1)`                | `(-0.707, 0.707)`  |
| `wsw`  | quarter | `w`      | `(0, 0.75)`             | `(-1, 0)`          |
| `w`    | middle  | `w`      | `(0, 0.5)`              | `(-1, 0)`          |
| `wnw`  | quarter | `w`      | `(0, 0.25)`             | `(-1, 0)`          |
| `nw`   | corner  | `n`, `w` | `(0, 0)`                | `(-0.707, -0.707)` |
| `nnw`  | quarter | `n`      | `(0.25, 0)`             | `(0, -1)`          |

- `ALL_ANCHORS` lists the ids in the table's order: clockwise from `n`.
- A corner's first listed side is its primary side (its horizontal edge), which the fan and the
  curve / elbow rules use exactly as they used it for the eight anchors before.
- `anchorsOf(side, cls)` returns, in table order: the middle of `side`; the two quarters on
  `side`; the two corners lying on `side`.
- `anchorLiesOn(a, side)` is true when `side` is among `a`'s sides.
- Quarter outward vectors are the side normal (D10).

### Anchor sets (`anchors.ts`)

- `ANCHOR_SETS`: `Partial<Record<ShapeKind, readonly AnchorClass[]>>`; `circle` maps to
  `['corner', 'middle']`. Every other element (every non-shape, and every shape kind absent from the
  map) takes `FULL_ANCHOR_SET = ['corner', 'quarter', 'middle']`.
- `anchorSetOf(el)`: `ANCHOR_SETS[el.shape]` for a shape, else `FULL_ANCHOR_SET`.
- `offeredAnchors(el)`: `ALL_ANCHORS` filtered to `anchorSetOf(el)`, memoised per set.
- `offeredClass(el, cls)`: `cls` when offered; else quarter → corner → middle, corner → quarter →
  middle (the first offered). Middle is always offered (invariant I7).
- Consumers: `snapToAnchor` and `computeSnapTargets` iterate `offeredAnchors(el)`; the Excalidraw
  import's nearest anchor too; the run's step 4.3 asks `offeredClass`.

### Anchor position (`anchorPosition`)

1. `box = connectorBox(el)`; `local = (box.x + fx·box.width, box.y + fy·box.height)`.
2. If `el` is a shape and `box === el`, and `anchorOutline(el)` is not null, replace `local` with
   `projectOntoOutline(outline, centre, local)`: the first point where the ray from the box centre
   through `local` crosses the outline; keep `local` when there is none.
3. Else, for a Technology icon with a label, push `local` to the element edge on the caption side
   for every anchor lying on that side: `textAlignX` left → side `w`; right → side `e`; centre with
   `textAlignY` bottom → side `s`; centre otherwise → side `n`. Only the axis across the side moves.
4. Rotate about the element (not the connector box) centre by `rotation`.

### Anchoring outlines (`shape-outline.ts`)

`anchorOutline(el): AnchorOutline | null`, in local unrotated px, for `el.type === 'shape'` with
`connectorBox(el) === el` and a positive width and height:

| Kind                                                                   | Outline                                                                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `circle`                                                               | `{ kind: 'ellipse', cx, cy, rx: w/2, ry: h/2 }`                                                                     |
| `diamond`, `parallelogram`, `hexagon`, `triangle`, `trapezoid`, `star` | `shapePolygonVertices(kind)` mapped from 0..100 to the box                                                          |
| `stadium`                                                              | Capsule polygon: `r = min(w, h)/2`, two half circles of `STADIUM_ARC_SEGMENTS` segments on the short axis ends (D8) |
| `actor`                                                                | `ACTOR_HULL` (viewBox 90 × 130) fitted "meet": `k = min(w/90, h/130)`, centred (D8)                                 |
| `cloud`, `document`                                                    | `sampleSvgPath(d)` of the kind's single main path in the shape-geometry table, mapped from 0..100 to the box        |
| anything else                                                          | `null`: the connector box is the outline                                                                            |

`pointInsideOutline(el, p, inset): boolean`:

1. Rotate `p` into the element's local frame (inverse `rotation` about the element centre).
2. `null` outline: inside the connector box shrunk by `inset` on every side.
3. Ellipse: `rx' = rx − inset`, `ry' = ry − inset`; false when either ≤ 0; else
   `(dx/rx')² + (dy/ry')² < 1`.
4. Polygon: even-odd containment and a distance greater than `inset` to every edge.

### Path outlines (`svg-path-outline.ts`)

`sampleSvgPath(d, segmentsPerCurve = PATH_CURVE_SEGMENTS): Point[] | null` walks an absolute path
of `M`, `L`, `C` and `Z` commands, emitting each line end and `segmentsPerCurve` points per cubic
(end included). Any other command returns null and logs O4; `anchorOutline` then falls back to the
box.

### Creation anchor (`bestAnchorTowards`)

`bestAnchorTowards(el, towards): Anchor` returns the middle of `exitSideTowards(el, towards)`, and
`'e'` when that is null (the direction is zero).

`exitSideTowards(el, towards): Side | null`:

1. `d = towards − centreOf(el)`, rotated by `−rotation` into the local frame.
2. Exit times: `e = hw/dx` for `dx > 0`, `w = hw/−dx` for `dx < 0`, `s = hh/dy` for `dy > 0`,
   `n = hh/−dy` for `dy < 0`, else `Infinity`, with `hw`, `hh` the connector box half sizes
   (`|| 1` for a zero dimension).
3. The side with the smallest finite time wins; ties resolve in the order `n`, `e`, `s`, `w`.
   All infinite: `null`.

`anchorAimPoint(other, fromCentre)` clamps `fromCentre` into `connectorBox(other)`; when the clamp
returns `fromCentre` itself (overlap) it returns `centreOf(other)`.

### Drawn path (`arrow-path-hits.ts`)

`arrowPolyline(arrow, index): Point[]` resolves both ends with `endpointPosition` (true anchors, no
fan) and returns `arrowPathPolyline(arrowStyleOf(arrow), from, to, arrow.from, arrow.to,
curveOffset, elbowOffset, curvePoints)`: `[from, to]` straight; `[from, elbow, to]` angled, or the
bend points; the quadratic sampled at 24 steps, or the Catmull-Rom sampled at 12 steps per span.

`pathPassesThrough(path, el): boolean`, for each segment `a → b`:

1. Map `a`, `b` into the local frame (rotation keeps segments straight).
2. Clip the segment to the connector box's local rect (Liang-Barsky); skip when empty.
3. Sample the clipped part every `PATH_SAMPLE_STEP_PX`, both clip ends included, at most
   `PATH_MAX_SAMPLES_PER_SEGMENT` samples (D2).
4. True as soon as one sample is `pointInsideOutline(el, sample, PATH_INSIDE_INSET_PX)` (D1).

`pathsCross(p, q): boolean` is true when some segment of `p` and some segment of `q` intersect
properly (both parameters strictly inside `(0, 1)`, non-parallel) at a point farther than
`CROSSING_ENDPOINT_TOLERANCE_PX` from all four path end points (D4). Collinear overlap is not a
crossing.

### The run (`rebindArrowAnchorsAfterMove(elements, movingIds)`)

State lives only inside one call. Steps:

1. **Index.** `index = buildElementIndex(elements)`; `held` counts every pinned end of every arrow
   by element and anchor.
2. **Considered.** In document order, an arrow is considered when a pinned end's element id is in
   `movingIds`, and it is neither a self-loop (both ends pinned to one element) nor rigid (both
   ends pinned, both element ids in `movingIds`).
3. **Trigger.** For each considered arrow in document order (D7), with its current state:
   `path = arrowPolyline(arrow, index)`; `shapes` = the boxed elements of its pinned ends;
   triggered when `pathPassesThrough(path, s)` for some `s` in `shapes`. Not triggered: next arrow.
4. **Re-evaluate** `from`, then `to` (D7). For an end pinned to boxed element `el` with anchor `a`:
   1. `aim = aimPointOf(otherEnd)`, `side = exitSideTowards(el, aim)`; `null` → keep.
   2. `anchorLiesOn(a, side)` → keep.
   3. `candidates = anchorsOf(side, offeredClass(el, anchorClass(a)))`. A middle has one candidate:
      take it.
   4. Two candidates: order by distance from `anchorPosition(el, c)` to
      `referencePointOf(otherEnd)`; when the two distances differ by at most `CLOSENESS_TIE_PX`
      (D3), order by distance to `anchorPosition(el, a)` instead.
   5. Take the first candidate whose `held` count on `el` is zero, else the first candidate.
   6. Write `{ kind: 'pinned', elementId, anchor }` (a fresh object, D12), move one `held` count
      from `a` to the new anchor, update `index` for the arrow, log O1.
5. **Swap.** `swapCrossingEnds(elements, considered, index, changed)`: it works on the same `index`
   and records its trades in the same `changed` map; `held` is not needed, as a trade keeps the
   counts.
6. **Result.** The input array when nothing changed (D11), else a new array with only the changed
   arrows replaced.

Invariants, each asserted by a test:

- **I1:** a non-triggered arrow is returned unchanged (reference equality).
- **I2:** an end only ever changes to an anchor of its own position class, or trades anchors in a
  swap.
- **I3:** a re-evaluated end that changes lands on its facing side.
- **I4:** free and on-arrow ends never change.
- **I5:** running the pass twice on its own output changes nothing further (idempotent at rest).
- **I6:** deterministic for the same input.
- **I7:** every anchor set contains `middle`.
- **I8:** snapping, snap markers and a re-anchored end only ever land on an offered anchor.

### Swap (`arrow-rebind-swap.ts`)

`swapCrossingEnds(elements, considered, index, changed): void`:

1. Collect pinned ends of every arrow that is not a self-loop, grouped by element id.
2. For each element in document order that holds an end of a considered arrow, repeat passes until
   one makes no swap, at most `SWAP_MAX_PASSES` passes (D5). A group with more than
   `SWAP_MAX_ENDS_PER_SIDE` ends on one side skips that side and logs O3 (D5).
3. In a pass, for each pair `i < j` in document order (arrow order, `from` before `to`):
   - skip unless the anchors differ, share a side, and at least one arrow is considered;
   - skip unless `pathsCross(pathA, pathB)`;
   - build both arrows with the anchors traded; skip when `pathsCross` still holds, or either
     traded path `pathPassesThrough` a shape of its own pinned ends;
   - apply, update `index`, log O2.

## Interfaces and contracts

```ts
// arrow-types.ts
export type Anchor =
  | 'n'
  | 'nne'
  | 'ne'
  | 'ene'
  | 'e'
  | 'ese'
  | 'se'
  | 'sse'
  | 's'
  | 'ssw'
  | 'sw'
  | 'wsw'
  | 'w'
  | 'wnw'
  | 'nw'
  | 'nnw';
export const ALL_ANCHORS: readonly Anchor[];
export type Endpoint =
  | { kind: 'free'; x: number; y: number }
  | { kind: 'pinned'; elementId: ElementId; anchor: Anchor }
  | { kind: 'on-arrow'; arrowId: ElementId; t: number };

// anchors.ts
export type Side = 'n' | 'e' | 's' | 'w';
export type AnchorClass = 'corner' | 'quarter' | 'middle';
export function anchorClass(a: Anchor): AnchorClass;
export function anchorSides(a: Anchor): readonly Side[];
export function anchorPrimarySide(a: Anchor): Side;
export function anchorLiesOn(a: Anchor, side: Side): boolean;
export function anchorsOf(side: Side, cls: AnchorClass): readonly Anchor[];
export const FULL_ANCHOR_SET: readonly AnchorClass[];
export function anchorSetOf(el: BoxedElement): readonly AnchorClass[];
export function offeredAnchors(el: BoxedElement): readonly Anchor[];
export function offeredClass(el: BoxedElement, cls: AnchorClass): AnchorClass;

// svg-path-outline.ts
export function sampleSvgPath(d: string, segmentsPerCurve?: number): Point[] | null;
export function anchorFraction(a: Anchor): { fx: number; fy: number };
export function anchorOutward(a: Anchor): Point;

// shape-outline.ts
export type AnchorOutline =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'polygon'; points: readonly Point[] };
export function anchorOutline(el: BoxedElement): AnchorOutline | null;
export function projectOntoOutline(o: AnchorOutline, centre: Point, p: Point): Point | null;
export function pointInsideOutline(el: BoxedElement, p: Point, inset: number): boolean;
// The same test for a local (unrotated) point with the outline computed once.
export function pointInsideLocalOutline(
  el: BoxedElement,
  outline: AnchorOutline | null,
  local: Point,
  inset: number,
): boolean;
export function connectorBox(el: BoxedElement): Rect;

// anchor-choice.ts
export function exitSideTowards(el: BoxedElement, towards: Point): Side | null;
export function anchorAimPoint(other: BoxedElement, fromCentre: Point): Point;
export function bestAnchorTowards(el: BoxedElement, towards: Point): Anchor;

// arrow-path.ts
export function arrowPathPolyline(
  style: ArrowStyle,
  from: Point,
  to: Point,
  fromEp: Endpoint,
  toEp: Endpoint,
  curveOffset?: Delta,
  elbowOffset?: Delta,
  curvePoints?: Delta[],
): Point[];

// arrow-path-hits.ts
export function arrowPolyline(arrow: ArrowElement, index: ElementIndex): Point[];
export function pathPassesThrough(path: readonly Point[], el: BoxedElement): boolean;
export function pathsCross(p: readonly Point[], q: readonly Point[]): boolean;
export function pinnedBoxedElement(ep: Endpoint, index: ElementIndex): BoxedElement | null;
export function passesThroughOwnShapes(
  arrow: ArrowElement,
  path: readonly Point[],
  index: ElementIndex,
): boolean;

// arrow-rebind.ts (signature unchanged)
export function rebindArrowAnchorsAfterMove(
  elements: Element[],
  movingIds: ReadonlySet<ElementId> | Map<ElementId, unknown>,
): Element[];
```

`bestAnchorTowards` loses its `current` and `avoid` parameters: no caller passes them.

Validation (`validate.ts`): `ANCHORS = new Set<string>(ALL_ANCHORS)`; a pinned endpoint with an
anchor outside it fails `isValidEndpoint`, which rejects the element (named rejection of the
existing validator). The api, the MCP tools and every import path validate through it.

## Data and persistence

- **Persisted.** `Endpoint.anchor` in element JSON: D1 tab storage, IndexedDB offline diagrams,
  JSON export, templates. The eight old ids keep their meaning; the eight new ones are additive.
  No migration.
- **`manual`.** Removed from the type. No code writes it. Stored `manual: true` flags are inert,
  and an end the rebind rewrites drops it (D12).
- **Never persisted.** Outlines, paths, held counts, fans: all derived per call.
- **Wire.** Anchor changes ride the drag's element updates like any other element edit; nothing
  new on the realtime protocol.
- **OpenAPI.** `Anchor` enum grows to 16 and the pinned endpoint loses `manual`, regenerated with
  `pnpm --filter @livediagram/api gen:openapi`.

## Errors and edge cases

| #   | Case                                              | Handling                                                    |
| --- | ------------------------------------------------- | ----------------------------------------------------------- |
| E1  | Pinned element missing or not boxed               | End skipped; its shape is not in `shapes`                   |
| E2  | Centre equals aim point                           | `exitSideTowards` null: keep                                |
| E3  | Shape thinner than `2 × PATH_INSIDE_INSET_PX`     | Inside test always false: never triggers                    |
| E4  | Self-loop                                         | Not considered; not in swap groups                          |
| E5  | Both ends on elements that moved together         | Not considered                                              |
| E6  | Both candidates held                              | Closer one taken; the fan separates                         |
| E7  | Candidates equally close                          | Nearer the previous anchor (D3)                             |
| E8  | Path still passes through after re-evaluation     | Kept as decided; next run sees the same side and keeps (I5) |
| E9  | Swap would not uncross, or would pass through     | No swap                                                     |
| E10 | More than `SWAP_MAX_ENDS_PER_SIDE` ends on a side | Side skipped, O3                                            |
| E11 | Unknown anchor id in stored data                  | Validation rejects the element                              |
| E12 | On-arrow other end                                | Treated as a point for aim and reference                    |
| E13 | Setting off                                       | The hooks never call the run                                |
| E14 | Degenerate zero-length path                       | No sample lies inside: no trigger                           |
| E15 | An editor bundle older than the sixteen anchors   | Out of scope: deploys ship the editor and the api together  |

## Security and trust

- Pure client-side geometry over data the user can already edit; no new trust boundary.
- Anchor ids arriving through the api, MCP, share-link editors or imports pass `ANCHORS`
  validation before storage.
- Abuse: a diagram crafted with thousands of arrows on one side cannot make a drag frame quadratic
  beyond `SWAP_MAX_ENDS_PER_SIDE²` pairs (E10); the trigger test is linear in considered arrows and
  bounded per segment by `PATH_MAX_SAMPLES_PER_SEGMENT`.

## Performance and limits

- **Trigger.** Per considered arrow: at most `(segments) × min(clip length / step,
PATH_MAX_SAMPLES_PER_SEGMENT)` samples × 2 shapes × outline edges (≤ 34, the stadium). A straight
  arrow between two 160 px boxes costs ≈ 2 × 90 samples × 4 checks.
- **Swap.** Pairs per side ≤ `32² / 2`; each pair ≤ 25 × 25 segment tests; ≤ `SWAP_MAX_PASSES`.
- **Budget.** The run stays under 4 ms for 100 considered arrows, inside a 16 ms drag frame.
  Measured (node 24, one hub with 100 arrows, a quarter of them curved, 60 drag frames): median
  0.95 ms, p95 2.9 ms; the first frame pays JIT warm-up.
- **Cap.** `MAX_ELEMENTS_PER_TAB` (10,000) bounds everything else.

## Presentation and UX

- **Setting row.** Label "Auto-Attach Arrows" (unchanged). Description: "When a move leaves an
  arrow running through a shape it connects, its end moves to the side facing the other end and
  keeps its corner, quarter or middle spot." Default on.
- **Snap-target markers.** Sixteen dots per nearby element, same size and style as before.
- **Anchor dots.** Unchanged: four middles on a selected element.
- **No loading or error state:** the run is synchronous inside the drag frame.
- **Help article** (`/help/palette/auto-attach-arrows/`) rewritten to the new rule and default.

## Accessibility

- No new control. The Settings switch keeps its role, label and keyboard behaviour.
- Snap-target dots stay decorative (not focusable, hidden from assistive technology).
- Anchor changes are instantaneous: nothing animates, so reduced motion is unaffected.

## Web experience

- **INP.** Toggling the setting is unchanged. A drag frame runs the pass inside the frame budget
  above; no long task.
- **CLS / LCP.** Unaffected: the canvas is absolutely positioned and nothing loads.

## Observability

Fixed prefix `[arrow-rebind]`, `key=value` pairs, `console.debug` (D6). Only triggered arrows and
swaps log, never a quiet frame.

| #   | Where                                | Fingerprint                                                                                                                                        |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | Step 4, per re-evaluated end         | `[arrow-rebind] trigger arrow=<id> end=<from\|to> element=<id> side=<s> <old>-><new>` (`<new>` = `<old>` when kept, plus `kept=<facing\|no-side>`) |
| O2  | Swap applied                         | `[arrow-rebind] swap element=<id> arrows=<a>,<b> <anchorA><-><anchorB>`                                                                            |
| O3  | Side over the cap                    | `[arrow-rebind] swap skipped element=<id> side=<s> ends=<n>`                                                                                       |
| O4  | `sampleSvgPath`, unsupported command | `console.warn` `[shape-outline] unsupported path command=<c>`                                                                                      |

## Testing

| Rule                                                                                                     | Test                                                                               | File                                                             |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 16 anchors, clockwise, old 8 kept                                                                        | ids, order, uniqueness                                                             | `anchors.test.ts`                                                |
| Class, sides, primary side, `anchorsOf`                                                                  | whole table                                                                        | `anchors.test.ts`                                                |
| Anchor sets, I7, fallback classes                                                                        | circle offers 8, square 16; quarter → corner, corner → quarter / middle            | `anchors.test.ts`                                                |
| Snapping and markers honour the set (I8)                                                                 | no quarter snap on a circle; 8 markers                                             | `anchor-geometry.test.ts`, `apps/live/lib/drag-geometry.test.ts` |
| A quarter on a circle re-anchors to a corner                                                             | morphed-circle end flips side                                                      | `arrow-rebind.test.ts`                                           |
| Cloud and document outlines, path sampler, O4                                                            | anchors on the outline; unsupported command → null + warn                          | `anchor-geometry.test.ts`                                        |
| Box positions                                                                                            | all 16 on a box                                                                    | `anchor-geometry.test.ts`                                        |
| Outline projection incl. quarters                                                                        | circle, diamond, star, stadium, actor points lie on the outline                    | `anchor-geometry.test.ts`                                        |
| Rotation                                                                                                 | a quarter on a 90° element                                                         | `anchor-geometry.test.ts`                                        |
| Caption push by side                                                                                     | `ssw`, `s`, `sse` pushed for a bottom caption                                      | `anchor-geometry.test.ts`                                        |
| Inside test                                                                                              | box, ellipse, polygon, inset, rotated                                              | `anchor-geometry.test.ts`                                        |
| Validation accepts 16, rejects others                                                                    | `nne` valid, `nnn` invalid                                                         | `validate.test.ts`                                               |
| Snapping reaches quarters                                                                                | cursor near `nne` snaps to it                                                      | `anchor-geometry.test.ts`                                        |
| Curve / elbow orientation for quarters                                                                   | `ene` horizontal-first, `nne` vertical-first                                       | `arrow-path.test.ts`                                             |
| Quarter fan                                                                                              | centred, half-edge room, `ene` fans on y                                           | `arrow-endpoint-spread.test.ts`                                  |
| Creation anchor                                                                                          | facing middles, aspect, rotation, zero direction                                   | `anchor-geometry.test.ts`                                        |
| Path hits                                                                                                | straight / curved / angled through, grazing, clip; crossing, shared end, collinear | `arrow-path-hits.test.ts`                                        |
| No trigger, no change (I1)                                                                               | a "better" side exists, path clear                                                 | `arrow-rebind.test.ts`                                           |
| Trigger through own shape; middle stays middle                                                           | box moved past its partner                                                         | `arrow-rebind.test.ts`                                           |
| Trigger through the other shape; facing end kept                                                         | head on the far side                                                               | `arrow-rebind.test.ts`                                           |
| Quarter closer / held / both held / tie                                                                  | four cases                                                                         | `arrow-rebind.test.ts`                                           |
| Corner: new side, and kept via second side                                                               | two cases                                                                          | `arrow-rebind.test.ts`                                           |
| No memory                                                                                                | move back, anchor stays                                                            | `arrow-rebind.test.ts`                                           |
| Former `manual` end re-anchors, flag dropped                                                             | stored `manual: true`                                                              | `arrow-rebind.test.ts`                                           |
| One free end                                                                                             | pinned end moves, free end never (I4)                                              | `arrow-rebind.test.ts`                                           |
| Rigid / self-loop / not moving                                                                           | three cases                                                                        | `arrow-rebind.test.ts`                                           |
| Curved and angled paths trigger                                                                          | two cases                                                                          | `arrow-rebind.test.ts`                                           |
| Rotation-aware side                                                                                      | rotated element                                                                    | `arrow-rebind.test.ts`                                           |
| E1, E2, E12                                                                                              | missing element, coincident centres, on-arrow other end                            | `arrow-rebind.test.ts`                                           |
| I5, I6                                                                                                   | second run no-op, two runs equal                                                   | `arrow-rebind.test.ts`                                           |
| O1                                                                                                       | spy `console.debug`                                                                | `arrow-rebind.test.ts`                                           |
| Swap: crossing same side, uncross only, pass-through guard, different sides, not considered, cap, O2, O3 | eight cases                                                                        | `arrow-rebind-swap.test.ts`                                      |
| Default on                                                                                               | `{}` → true, `false` → false                                                       | `apps/live/lib/user-preferences.test.ts`                         |
| Live drag re-anchors in the browser                                                                      | seeded diagram, path read with the drag held open, O1                              | `apps/live/e2e/arrow-rebind.spec.ts`                             |
| The first crossing frame decides a quarter                                                               | drag past the quarter: `ene`, not `ese`                                            | `apps/live/e2e/arrow-rebind.spec.ts`                             |
| Setting off: nothing moves                                                                               | flip the Settings switch, drag                                                     | `apps/live/e2e/arrow-rebind.spec.ts`                             |
| Snap-target markers show 16                                                                              | `computeSnapTargets` length                                                        | `apps/live/lib/drag-geometry.test.ts`                            |

## Constants and configuration

| Name                             | Value    | Provenance                                                        | Safe range   | Home                       |
| -------------------------------- | -------- | ----------------------------------------------------------------- | ------------ | -------------------------- |
| `PATH_INSIDE_INSET_PX`           | `2`      | Grazing tolerance, about a medium stroke width (D1)               | `[0.5, 6]`   | `arrow-path-hits.ts`       |
| `PATH_SAMPLE_STEP_PX`            | `2`      | Not coarser than the inset (D2)                                   | `[0.5, 4]`   | `arrow-path-hits.ts`       |
| `PATH_MAX_SAMPLES_PER_SEGMENT`   | `512`    | Covers a 1,000 px clip at the step (D2)                           | `[64, 4096]` | `arrow-path-hits.ts`       |
| `CROSSING_ENDPOINT_TOLERANCE_PX` | `1`      | Sub-pixel: two paths into one anchor meet, not cross (D4)         | `[0.1, 4]`   | `arrow-path-hits.ts`       |
| `CLOSENESS_TIE_PX`               | `0.5`    | Below a rendered pixel (D3)                                       | `[0, 2]`     | `arrow-rebind.ts`          |
| `SWAP_MAX_PASSES`                | `8`      | Uncrossing converges in a pass or two in practice (D5)            | `[1, 32]`    | `arrow-rebind-swap.ts`     |
| `SWAP_MAX_ENDS_PER_SIDE`         | `32`     | Bounds the pair count at 496 (D5)                                 | `[8, 128]`   | `arrow-rebind-swap.ts`     |
| `STADIUM_ARC_SEGMENTS`           | `16`     | Sub-pixel error at 200 px (D8)                                    | `[8, 64]`    | `shape-outline.ts`         |
| `ACTOR_HULL`                     | 9 points | Convex hull of the actor's head, arm tips and feet, to y 130 (D8) | n/a          | `shape-geometry.ts`        |
| `QUARTER_FAN_ROOM`               | `0.5`    | A quarter's fan stays between its corner and its middle (spec)    | `(0, 0.5]`   | `arrow-endpoint-spread.ts` |
| `PATH_CURVE_SEGMENTS`            | `12`     | Under half a pixel of error on a 200 px cloud bump (D13)          | `[4, 64]`    | `svg-path-outline.ts`      |
