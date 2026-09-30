# Lane: blueprint

Derived from [The lane](../lane.md). The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as
`Dn`.

Scope, by file:

| File                                                           | Role                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/document/src/lane-gutter.ts`                         | `LANE_GUTTER_PX`, `LANE_BAND_PX`, `laneGutterEdge`, `laneSizeOfElement` |
| `packages/document/src/lane-seam-snapping.ts`                  | `laneSeamCoordinates`, `alignmentCoordinates`, `snapSeamCoordinate`     |
| `packages/document/src/shape-factory.ts`                       | `SHAPE_DEFAULT_SIZE.lane` (900 × 200) and the lane defaults             |
| `packages/document/src/colors.ts`                              | `hasHeadingBand`                                                        |
| `packages/document/src/svg-render-shapes.ts`                   | `svgLaneGutter`: the export's strip and rule                            |
| `packages/document/src/arrow-label-layout.ts`                  | Lanes are not label obstacles                                           |
| `apps/live/lib/canvas.ts`                                      | `withFrameContents`, `framesFirst`, container size donation             |
| `apps/live/components/canvas/LaneGutter.tsx`                   | The canvas strip, the seam and its drag                                 |
| `apps/live/components/canvas/BoxedElementView.tsx`             | Mounts `LaneGutter` behind the label                                    |
| `apps/live/components/canvas/CanvasElementsLayer.tsx`          | Wires `onCommitHeaderSize` and `onSnapSeam`                             |
| `apps/live/app/document/[id]/useSelectionEditing.ts`           | `commitHeaderSize`                                                      |
| `apps/live/hooks/canvas/useColorStyleSetters.ts`               | `setHeaderFillSelected`                                                 |
| `apps/live/components/palette/ElementColourBorderSections.tsx` | The Heading colour row                                                  |
| `apps/live/components/palette/palette-tile-defs.tsx`           | Tile `tools:lane`, section `build`                                      |

## Domain and naming

| Term         | Identifier                                         | Meaning                                           |
| ------------ | -------------------------------------------------- | ------------------------------------------------- |
| Lane         | `shape: 'lane'`                                    | The element kind                                  |
| Container    | `isFrameEl` (frame or lane)                        | A shape that carries what it fully contains       |
| Gutter       | (render) strip or band                             | The tinted title backdrop                         |
| Gutter edge  | `LaneGutterEdge`: `left right top bottom centre-x` | Where the gutter runs, from the title's alignment |
| Band         | `isLaneBand(edge)`                                 | A gutter across the lane (`top` / `bottom`)       |
| Heading size | `headerSize`, else `laneSizeOfElement` default     | Gutter thickness in element px                    |
| Heading fill | `headerFill`                                       | Gutter colour; shared with a table's header row   |
| Seam         | (render) the gutter / body boundary                | Drag handle for `headerSize`                      |
| Seam target  | `laneSeamCoordinates`, `alignmentCoordinates`      | Coordinates a seam may snap to                    |

Banned synonyms: "swimlane" in code (fine in copy), "header" for the gutter in code (the field is
`headerSize` / `headerFill`, the concept is gutter), "divider" for the seam, "section" (a frame).

## Behaviour and state

1. **Create.** `createShape('lane', x, y)`: 900 × 200, `textAlignX: 'left'`, `textAlignY:
'middle'`, `padding: 'lg'`, `label: 'Lane'`.
2. **Gutter edge.** `laneGutterEdge(alignX, alignY)`: `left` or `right` when the title is pinned
   horizontally; else `top` or `bottom` when pinned vertically; else `centre-x`.
3. **Gutter size.** `laneSizeOfElement(el) = headerSize ?? (band ? LANE_BAND_PX : LANE_GUTTER_PX)`,
   clamped to `[MIN_GUTTER_PX, span - MIN_GUTTER_PX]` where `span` is the lane's height for a band
   and its width otherwise; both renderers use this one clamp [QA10].
4. **Gutter fill.** `headerFill` at full strength when set; else the stroke at opacity 0.1.
5. **Seam drag.** States: **idle** (`dragSize === null`) and **dragging**. Pointer-down on the seam
   stores `{ start, from: size }` and enters dragging. Each `pointermove` on `window`:
   - `travel` is the client delta on the band's axis; `signed = 2 * travel` for `centre-x`, `-travel`
     for `right` / `bottom`, else `travel`.
   - `raw = clamp(from + signed / zoom, MIN_GUTTER_PX, span - MIN_GUTTER_PX)` (`D17`).
   - `centre-x` or no snapper: live size = `raw` (`D19`). Otherwise convert to an absolute seam
     coordinate, `snapSeamCoordinate` it against other lanes' seams on the same axis and the
     alignment grid (`D18`), convert back and clamp.
   - The live size is written to state and to `liveSizeRef`.
     `pointerup` / `pointercancel` reads `liveSizeRef`, returns to idle and calls
     `onCommitSize(round(size))` (`D21`): one `commit`, one undo step.
6. **Carry.** Dragging a lane moves, through `withFrameContents`, every non-container boxed element
   whose box it fully contains and whose backmost container it is, and every arrow whose free ends
   all sit in it. Pinned ends follow their elements.
7. **Paint order.** `framesFirst` puts containers first, so lanes sit behind their contents [QA11].
8. **Size donation.** A selected container never donates its size to a new element [QA11].
9. **Stacking.** Lanes are never repositioned automatically. Each lane draws its own border, so
   flush lanes show two borders side by side [QA9].

Guards:

- The seam is interactive only when `onCommitHeaderSize` is wired: not read-only and not locked
  [GA7]. It is interactive whether or not the lane is selected (`D20`).
- Snapping is skipped for `centre-x`.

Invariants:

- **I1:** exactly one gutter edge per alignment pair (nine pairs, five edges).
- **I2:** a committed `headerSize` lies in `[MIN_GUTTER_PX, span - MIN_GUTTER_PX]` at commit time.
- **I3:** a container is never carried as another container's content.
- **I4:** an element inside several containers belongs to the backmost one.

## Interfaces and contracts

```ts
// packages/document/src/lane-gutter.ts
export const LANE_GUTTER_PX = 132;
export const LANE_BAND_PX = 64;
export type LaneGutterEdge = 'left' | 'right' | 'top' | 'bottom' | 'centre-x';
export type LaneLike = {
  textAlignX?: TextAlignX | undefined;
  textAlignY?: TextAlignY | undefined;
  headerSize?: number | undefined;
};
export function laneGutterEdge(alignX: TextAlignX, alignY: TextAlignY): LaneGutterEdge;
export function isLaneBand(edge: LaneGutterEdge): boolean;
export function laneEdgeOfElement(el: LaneLike): LaneGutterEdge;
export function laneSizeOfElement(el: LaneLike): number;

// packages/document/src/lane-seam-snapping.ts
export const SEAM_SNAP_THRESHOLD = 8;
export function laneSeamCoordinates(
  elements: Element[],
  axis: 'x' | 'y',
  excludeId: ElementId,
  edgeOf: (el: Element) => 'left' | 'right' | 'top' | 'bottom' | 'centre-x',
  sizeOf: (el: Element) => number,
): number[];
export function alignmentCoordinates(
  elements: Element[],
  axis: 'x' | 'y',
  excludeId: ElementId,
): number[];
export function snapSeamCoordinate(
  candidate: number,
  targets: { seams: number[]; alignment: number[] },
  threshold?: number,
): { value: number; snappedTo: number | null };

// apps/live/lib/canvas.ts
export function withFrameContents(elements: Element[], ids: Set<string>): Set<string>;

// apps/live/app/document/[id]/useSelectionEditing.ts
commitHeaderSize: (elementId: string, headerSize: number) => void;
```

Validation: `'lane'` is in `SHAPE_KINDS`. `headerSize`, when present, is a finite number `>= 0`
[GA6]; `headerFill` is a colour string like every other colour field.

## Data and persistence

| Field        | Class     | Notes                                                |
| ------------ | --------- | ---------------------------------------------------- |
| `headerSize` | persisted | Absent means the orientation's default               |
| `headerFill` | persisted | Absent means the 10% stroke wash; shared with tables |
| `dragSize`   | ephemeral | `LaneGutter` state plus `liveSizeRef`; never stored  |

No migration.

## Errors and edge cases

| #   | Case                                     | Handling                                          |
| --- | ---------------------------------------- | ------------------------------------------------- |
| E1  | Lane narrower than `2 * MIN_GUTTER_PX`   | Max falls back to `MIN_GUTTER_PX`                 |
| E2  | Stored `headerSize` larger than the span | Clamped at render, canvas and export alike [QA10] |
| E3  | Title realigned to the other axis        | Same `headerSize`, clamped to the new span [QA10] |
| E4  | Fast drag leaving the seam               | Listeners on `window`, release always commits     |
| E5  | `pointercancel`                          | Commits the last live size                        |
| E6  | `zoom` of 0                              | Treated as 1                                      |
| E7  | Element straddling a lane edge           | Not carried (full containment)                    |
| E8  | Overlapping lanes and frames             | Backmost container owns (I4)                      |
| E9  | Locked lane                              | Seam inert [GA7]                                  |

## Security and trust

No trust boundary of its own; `headerSize` is bounded by validation [GA6]. `headerFill` reaches only
CSS `background-color` and SVG `fill`, which ignore invalid values.

## Performance and limits

`laneSeamCoordinates` and `alignmentCoordinates` are `O(n)` per `pointermove`; at
`MAX_ELEMENTS_PER_TAB` (10 000) that is 30 000 numbers per move, well inside a frame.
`withFrameContents` is `O(n * c)` for `c` containers and runs once per drag start.

## Presentation and UX

- Palette: tile `tools:lane` in the Build tab.
- Gutter: strip or band on its edge, inheriting the lane's corner radius on that side; `centre-x`
  is square with a rule on both sides. Rule: 1px in the stroke colour.
- Seam: 8px hit strip (`w-2` / `h-2`) centred on the seam, `cursor-ew-resize` / `cursor-ns-resize`,
  `bg-brand-400/30` on hover and `/40` while dragging.
- Heading colour: the "Heading" row in the Colours section, shown when `hasHeadingBand`; it reads
  `'transparent'` while unset.
- Border: the ordinary shape border (`strokeWidth`, default `medium`, 2px) [QA9].

## Accessibility

- The seam is `role="separator"` with `aria-orientation` and `aria-label` "Resize the lane's
  title area". It is not focusable and has no keyboard or value semantics [GA8].
- The title is the element's label, so it keeps every label a11y path.
- No motion beyond the drag.

## Web experience

The drag writes local state only; one commit on release (INP). Canvas-space rendering (CLS).

## Observability

None in code today [GA1].

## Testing

| Rule                                          | Test                                                                         | File                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------- |
| Gutter edge from alignment (I1)               | laneGutterEdge, six cases                                                    | `apps/live/components/canvas/lane-gutter.test.ts`  |
| Seam coordinates per edge, other axis ignored | laneSeamCoordinates                                                          | `packages/document/src/lane-seam-snapping.test.ts` |
| Alignment grid                                | alignmentCoordinates                                                         | `packages/document/src/lane-seam-snapping.test.ts` |
| Threshold and seam-wins tie                   | snapSeamCoordinate                                                           | `packages/document/src/lane-seam-snapping.test.ts` |
| Export strip follows the edge, fill vs wash   | chrome the canvas draws on a box                                             | `packages/document/src/svg-render.test.ts`         |
| Export draws a body                           | every kind with a body draws one                                             | `packages/document/src/export-consistency.test.ts` |
| Release slices are lanes                      | user story map drops an activity backbone over release-banded story stickies | `apps/live/lib/templates.test.ts`                  |
| Containment rules (I3, I4) for frames         | withFrameContents                                                            | `apps/live/lib/canvas.test.ts`                     |
| A lane carries its contents                   | none [GA14]                                                                  |                                                    |
| Drag clamp, centred 2x, one commit (I2)       | none [GA14]                                                                  |                                                    |
| Render clamp of a stored size                 | none [QA10]                                                                  |                                                    |

## Constants and configuration

| Name                  | Value     | Provenance / safe range                                   |
| --------------------- | --------- | --------------------------------------------------------- |
| `LANE_GUTTER_PX`      | 132       | Room for a few words across; 96 to 200                    |
| `LANE_BAND_PX`        | 64        | One line plus `lg` padding (24) above and below; 48 to 96 |
| `MIN_GUTTER_PX`       | 28        | Smallest gutter a title fits; 16 to 40 (`LaneGutter.tsx`) |
| `SEAM_SNAP_THRESHOLD` | 8         | Element px; 4 to 12                                       |
| Default size          | 900 × 200 | `SHAPE_DEFAULT_SIZE.lane`                                 |
| Wash opacity          | 0.1       | Unset gutter tint                                         |
