# Timeline rail: blueprint

Derived from [Timeline rail](../timeline-rail.md). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                      | Role                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/document/src/data-shapes.ts`                    | `RAIL_*` constants, `isRailShape`, `isSelfDrawingShape`                |
| `packages/document/src/shape-factory.ts`                  | `SHAPE_DEFAULT_SIZE['timeline-rail']`, `createShape` rail defaults     |
| `packages/document/src/element-types.ts`                  | `ShapeElement.railCount`, `ShapeElement.railLabels`                    |
| `packages/document/src/validate.ts`                       | `SHAPE_KINDS` entry, `railLabels` bound                                |
| `packages/document/src/svg-render-data.ts`                | `svgTimelineRail`: the headless render                                 |
| `packages/document/src/colors.ts`                         | `SELF_PAINTING_SHAPES` entry (no Border controls)                      |
| `apps/live/components/canvas/RailView.tsx`                | Canvas render + `RailLabel` inline editor                              |
| `apps/live/components/canvas/ShapeContentRouter.tsx`      | Routes a rail to `RailView`, computes `editable`                       |
| `apps/live/components/canvas/element-variant.ts`          | Borderless wrapper via `SELF_PAINTING_SHAPES`                          |
| `apps/live/hooks/canvas/useDataShapeSetters.ts`           | `setRailCountSelected`, `addRailPointSelected`, `setRailLabelSelected` |
| `apps/live/components/canvas/quick-connect-options.tsx`   | `ADD_POINT_OPTION`                                                     |
| `apps/live/components/canvas/QuickConnectRing.tsx`        | Appends "Add point" when `onAddRailPoint` is set                       |
| `apps/live/components/canvas/CanvasElementsLayer.tsx`     | `selectedIsRail` gate for `onAddRailPoint`                             |
| `apps/live/components/palette/ElementDataSections.tsx`    | The Timeline menu section                                              |
| `apps/live/components/palette/context-menu-data-rows.tsx` | `RailPointsRow`: the Points stepper                                    |
| `apps/live/components/palette/palette-tile-defs.tsx`      | Tile `tools:timeline`, section `build`                                 |
| `apps/live/lib/element-telemetry.ts`                      | `shapeTelemetryToken`: the `Added` token                               |

## Domain and naming

| Term        | Identifier                         | Meaning                                                   |
| ----------- | ---------------------------------- | --------------------------------------------------------- |
| Rail        | `shape: 'timeline-rail'`           | The element kind                                          |
| Point       | index `0..railCount-1`             | One dot with its stem and label slot                      |
| Point count | `ShapeElement.railCount`           | Number of points; absent means `RAIL_DEFAULT_POINTS`      |
| Point label | `ShapeElement.railLabels[i]`       | Index-aligned label of point `i`; absent or `''` is blank |
| Step        | `RAIL_POINT_STEP_PX`               | Width the rail gains per point                            |
| Add point   | `ADD_POINT_OPTION` (`'add-point'`) | The quick-connect ring action                             |
| Accent      | `strokeColor` (or presence colour) | Paints the dots                                           |

Banned synonyms: "node", "milestone" or "tick" for a point; "timeline" alone in code (it names the
explorer timeline); "dot count".

## Behaviour and state

The rail holds no state of its own beyond `railCount` and `railLabels`. Every write is one
`commit`, so one undo step.

1. **Create.** `createShape('timeline-rail', x, y)` returns `railCount: RAIL_DEFAULT_POINTS` (3),
   `strokeColor: '#64748b'`, size `RAIL_DEFAULT_POINTS * RAIL_POINT_STEP_PX` × 96 (`D16`).
2. **Set count** (`setRailCountSelected(count)`): for each selected rail,
   `n = clamp(round(count), RAIL_MIN_POINTS, RAIL_MAX_POINTS)`; write `railCount: n` and
   `width: n * RAIL_POINT_STEP_PX`. Non-rail selections are untouched. Tracks
   `Element·Changed·TimelineRail`.
3. **Add point** (`addRailPointSelected()`): for each selected rail,
   `n = min(RAIL_MAX_POINTS, (railCount ?? RAIL_DEFAULT_POINTS) + 1)`; same width rule. The ring
   offers it only while `railCount < RAIL_MAX_POINTS` and fires no event on a no-op [GA3].
4. **Set label** (`setRailLabelSelected(elementId, index, text)`): pads `railLabels` with `''` up to
   `index`, then writes `text` at `index`. Addressed by id, not by selection.
5. **Remove points.** Only through the stepper, down to `RAIL_MIN_POINTS`. Labels past the new
   count stay stored and reappear when the count grows again [QA7].
6. **Resize.** Free; points spread across the new width. The next count change resets width to
   `n * RAIL_POINT_STEP_PX`.

Label editor states (`RailLabel`): **inert** (not editable: a `div`, `pointer-events-none`),
**idle** (editable `textarea`), **drafting** (local `draft` differs from `value`). Transitions:
focus → drafting; blur → commit if `draft !== value`; Enter (no Shift) → blur; an external `value`
change re-seeds `draft`. Labels are single-line: a newline is stripped on commit [QA8].

Guards:

- `editable = isSelected && !readOnly && !isLocked` (`ShapeContentRouter.tsx`). The first click
  selects; the next one edits.
- The ring's "Add point" exists only when the single selected element is a rail
  (`selectedIsRail`).

Invariants:

- **I1:** after a count write, `width === railCount * RAIL_POINT_STEP_PX`.
- **I2:** every write leaves `railCount` in `[RAIL_MIN_POINTS, RAIL_MAX_POINTS]`.
- **I3:** a label write never changes another index.

## Interfaces and contracts

```ts
// packages/document/src/element-types.ts (ShapeElement)
railCount?: number;
railLabels?: string[];

// packages/document/src/data-shapes.ts
export const RAIL_MIN_POINTS = 2;
export const RAIL_MAX_POINTS = 12;
export const RAIL_DEFAULT_POINTS = 3;
export const RAIL_POINT_STEP_PX = 120;
export function isRailShape(kind: ShapeKind): boolean;

// apps/live/hooks/canvas/useDataShapeSetters.ts
setRailCountSelected: (count: number) => void;
addRailPointSelected: () => void;
setRailLabelSelected: (elementId: string, index: number, text: string) => void;

// apps/live/components/canvas/Canvas.types.ts
onAddRailPoint?: () => void;
onSetRailLabel?: (elementId: string, index: number, text: string) => void;
```

Validation (`isValidElement`): `railLabels`, when present, is an array of at most `MAX_DATA_ARRAY`
(5 000) entries. `railCount` is validated as a finite number in `[RAIL_MIN_POINTS,
RAIL_MAX_POINTS]` [GA6]; a failing element fails the tab (`invalid tab`, 400).

## Data and persistence

| Field        | Class     | Notes                                                    |
| ------------ | --------- | -------------------------------------------------------- |
| `railCount`  | persisted | Absent reads as 3                                        |
| `railLabels` | persisted | Sparse by position; may be longer than `railCount` [QA7] |
| `draft`      | ephemeral | Local to `RailLabel`, never stored                       |

No migration: both fields are optional and every reader defaults them.

## Errors and edge cases

| #   | Case                                     | Handling                                                           |
| --- | ---------------------------------------- | ------------------------------------------------------------------ |
| E1  | `railCount` absent                       | `RAIL_DEFAULT_POINTS`                                              |
| E2  | Stored `railCount` out of range          | Rejected on write [GA6]; renderers draw `max(1, round(n))` (`D13`) |
| E3  | `railLabels` shorter than the count      | Missing labels render blank                                        |
| E4  | `railLabels` longer than the count       | Extra entries kept, not drawn [QA7]                                |
| E5  | "Add point" at `RAIL_MAX_POINTS`         | Not offered [GA3]                                                  |
| E6  | Stepper at a bound                       | The button is `disabled`                                           |
| E7  | Label edited while another peer edits it | Last commit wins; the local draft re-seeds from the new value      |
| E8  | Locked or read-only rail                 | Labels inert, setters not wired (`onSetRailLabel` undefined)       |

## Security and trust

Writes arrive through `isValidTab` at the api. Label text is plain text: the canvas renders it as
React text and the export escapes it with `xmlEscape`. The bounded `railCount` [GA6] caps render cost.

## Performance and limits

At most 12 points, each one `<g>` plus one `textarea` or `div`. No measurement, no layout pass.

## Presentation and UX

- Palette: tile `tools:timeline` in the Build tab, caption "Timeline", description naming the
  ring's "Add point" [GA4].
- Geometry (element-relative, `D14`): inset `padX = min(44, 0.12 w)`; points evenly spaced from
  `padX` to `w - padX`; label slot top `0.06 h`, height `0.36 h`, width `0.92` of the spacing;
  dot at `0.58 h`, radius `clamp(0.1 h, 5, 9)`; line at `0.82 h`; font `clamp(0.16 h, 10, 16)`.
- Colours (`D15`): line `#94a3b8`, stem `#cbd5e1`, dots the accent, labels `textColor`.
- Wrapper: no border, no fill (`SELF_PAINTING_SHAPES`); selection ring only. No element label.
- Menu: section "Timeline" with the "Points" stepper (`−` / value / `+`).
- Empty label: placeholder "Label" while editable, nothing while inert.

## Accessibility

- The stepper buttons carry `aria-label` "Fewer points" / "More points" and `disabled` at bounds.
- The drawing is `aria-hidden`; inert labels are `aria-hidden`. Editable labels are `textarea`s
  with the placeholder "Label" and no accessible name [GA15].
- No motion.

## Web experience

Canvas-space SVG and absolutely positioned labels: no layout shift outside the canvas (CLS). A
label commit is one `commit` (INP).

## Observability

None in code today. The decision points (count clamp, no-op add) emit nothing [GA1].

## Testing

| Rule                                   | Test                                                      | File                                               |
| -------------------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| Count sets width to `n * step` (I1)    | sets the point count and resizes to keep spacing constant | `apps/live/hooks/canvas/useElementStyle.test.ts`   |
| Count clamped (I2)                     | clamps the count to the allowed range                     | `apps/live/hooks/canvas/useElementStyle.test.ts`   |
| Add point widens by one step           | appends a point via addRailPointSelected                  | `apps/live/hooks/canvas/useElementStyle.test.ts`   |
| Only rails change                      | leaves non-rail shapes untouched                          | `apps/live/hooks/canvas/useElementStyle.test.ts`   |
| `isRailShape` names exactly the rail   | kind predicate table (`'rail'`)                           | `packages/document/src/data-shapes.test.ts`        |
| Export draws a body, rasterised in PNG | every kind with a body draws one; image exports agree     | `packages/document/src/export-consistency.test.ts` |
| Label write pads and sets (I3)         | none [GA14]                                               |                                                    |
| Label commits on blur / Enter, once    | none [GA14]                                               |                                                    |
| "Add point" hidden at the cap          | none [GA3]                                                |                                                    |
| `Added·TimelineRail` token             | none [QA6]                                                |                                                    |

## Constants and configuration

| Name                  | Value       | Provenance / safe range                                  |
| --------------------- | ----------- | -------------------------------------------------------- |
| `RAIL_MIN_POINTS`     | 2           | A line needs two ends; fixed                             |
| `RAIL_MAX_POINTS`     | 12          | Legibility cap; 8 to 16                                  |
| `RAIL_DEFAULT_POINTS` | 3           | A readable start; within the bounds                      |
| `RAIL_POINT_STEP_PX`  | 120         | Room for a two-word label; 96 to 160                     |
| Default height        | 96          | `SHAPE_DEFAULT_SIZE['timeline-rail']`; 64 to 160         |
| `RAIL_LINE`           | `'#94a3b8'` | Tailwind slate-400, `svg-render-data.ts`; canvas literal |
| `MUTED_RULE`          | `'#cbd5e1'` | Tailwind slate-300 stem, `svg-render-data.ts`            |
| Default stroke        | `'#64748b'` | Tailwind slate-500, `createShape`                        |
| `MAX_DATA_ARRAY`      | 5 000       | Abuse bound for `railLabels`, `validate.ts`              |

Telemetry: `Element·Added·TimelineRail` on create and copy, `Element·Changed·TimelineRail` on every
count or label write [QA6].
