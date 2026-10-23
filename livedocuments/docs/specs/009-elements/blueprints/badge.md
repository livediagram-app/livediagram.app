# The badge, the step number and attachment: blueprint

Derived from [The badge](../badge.md) and [The step number](../step-number.md). Defaults in
[DEFAULTS.md](DEFAULTS.md) as `Dn`.

| File                                                                                                                      | Role                                                                     |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/document/src/chip.ts`                                                                                           | `ChipLook`, `chipColours`, `badgeSize`, step numbering, `renumberSteps`  |
| `packages/document/src/attachment.ts`                                                                                     | `AttachPoint`, `canHost`, `attachPointXY`, `settleChips`, `withAttached` |
| `packages/document/src/shape-kind.ts`, `validate.ts`                                                                      | `'badge'`, `'step'`                                                      |
| `packages/document/src/element-types.ts`, `element-fields.ts`, `validate-shape.ts`                                        | `chipLook`, `attachedTo`, `attachAt`, `stepSequence`                     |
| `packages/document/src/shape-factory.ts`                                                                                  | Sizes and starting content                                               |
| `packages/document/src/colors.ts`                                                                                         | Both in `SELF_PAINTING_SHAPES`                                           |
| `packages/document/src/layers.ts`                                                                                         | `paintTier`: an attached chip paints in the top tier                     |
| `packages/document/src/duplicate.ts`                                                                                      | `attachedTo` follows a copied host, else the copy is detached            |
| `packages/document/src/svg-render-chip.ts`                                                                                | `svgChip`: the headless body                                             |
| `apps/editor/app/document/[id]/useEditorState.ts`                                                                         | `settleChips(prev, next)` at the commit choke point                      |
| `apps/editor/components/canvas/ChipFace.tsx`                                                                              | The pill / disc face                                                     |
| `apps/editor/components/palette/ChipMenuSection.tsx`                                                                      | Look tiles, Detach, Renumber Steps, Play in Order                        |
| `apps/editor/hooks/canvas/useBoxedDragHandlers.ts`, `useNudgeSelection.ts`, `useClipboard.ts`, `useElementDuplication.ts` | `withAttached`                                                           |

## Domain and naming

| Term        | Identifier                                                        | Meaning                                             |
| ----------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| Chip        | `isChipShape(kind)`                                               | A badge or a step number (code only; never in copy) |
| Badge       | `shape: 'badge'`                                                  | The text pill                                       |
| Step number | `shape: 'step'`                                                   | The numbered disc                                   |
| Look        | `ChipLook = 'solid' \| 'ink' \| 'outline' \| 'tinted' \| 'quiet'` | Absent = the kind's default                         |
| Attachment  | `attachedTo` + `attachAt`                                         | Held on a host's point                              |
| Point       | `AttachPoint`                                                     | One of eight: corners and edge midpoints            |
| Host        | `canHost(el)`                                                     | The element an attachment names                     |

Banned: "pin", "dock" (legacy docks), "group".

## Behaviour and state

### Settling (`settleChips(prev, next)`)

Runs at the editor's commit choke point for every tab a commit changed, in `element-normalise` for agent
writes (with `prev = []`), and on the output of `buildTemplate` and `buildPageLayout` (with `prev = []` and
`attachLoose: false`, as a stored board reads), so a template or layout lands settled in previews and agent creates. Returns `next` itself when nothing changes and when `next` holds no chip.

For each chip in `next`, in order:

1. **Fit (badge only).** `badgeSize(label, textSize)`: height from the text size (sm or scale 22, md 28, lg 36,
   a number px × 1.6), font `round(h * 0.48)`, width `max(h, ceil(len * font * 0.6) + round(h * 0.9))`. A badge
   whose size differs is resized about its centre.
2. **Number (step only).** A step whose label is empty and that is new in this commit (its id not in `prev`) takes
   `nextStepNumber(next)`: one more than the highest whole-number label among the tab's steps, else `"1"`.
3. **Attached** (valid `attachedTo` + `attachAt`):
   - Host missing: in `prev` → the chip is **removed** (deleted with its host); never there → detached (both fields
     deleted).
   - Host present: `target = attachPointXY(host, attachAt)`. If the chip moved in this commit while its host did not
     (its centre changed against `prev` and the host's box did not) and its centre is more than `ATTACH_SNAP_PX`
     from `target`, it is **detached**, then considered for attaching below. Otherwise it is placed with its centre on
     `target`.
4. **Unattached:** a chip that is new or moved in this commit attaches to the nearest point within `ATTACH_SNAP_PX`
   of its centre among the hosts (`canHost`, not itself), the topmost host winning a tie, and is placed on it.

`attachPointXY(host, point)`: the point on the host's box (`top-left` = (x, y), `top` = (x + w/2, y), …), rotated
about the host's centre by `host.rotation` degrees.

### Carry and copies

`withAttached(elements, ids)`: `ids` plus every chip attached to an element in `ids`. Composed beside
`withSheetCharts` in the drag, nudge, copy and duplicate paths, so a host's chips move in its drag preview and copy
with it. Deletion needs no path of its own (settling removes orphans of a deleted host).

`duplicate.ts`: `attachedTo` maps to the host's copy when the host was copied; otherwise both fields are deleted.

### Paint order

`paintTier`: an attached chip is tier 4 (above everything in its layer), so a later element never covers it.

### Steps

- `renumberSteps(elements)`: steps sorted by reading order (rows: centres within half the step's height of the row's
  first; rows top to bottom, then left to right) take `"1"`, `"2"`, … One history step; telemetry `RenumberSteps`.
- `stepSequence: true` on a step with a body animation and a whole-number label `n`: the wrapper's
  `animation-delay` is `(n − 1) × STEP_SEQUENCE_BEAT_S / speedFactor` (D183). Turning it on or off writes every step
  on the tab.

### Writes

`withChipLook(el, look | null)`, `detachChip(el)`; through the menu's generic style ops (`ChipLook`, `ChipDetach`).

### Invariants

- I1: after settling, an attached chip's centre is on its point (within 0.5 px).
- I2: no chip names a host that is missing from the tab after a commit.
- I3: a badge's size is `badgeSize` of its label after a commit.

## Interfaces and contracts

```ts
export type ChipLook = 'solid' | 'ink' | 'outline' | 'tinted' | 'quiet';
export const CHIP_LOOKS: readonly ChipLook[];
export function isChipShape(kind: string): kind is 'badge' | 'step';
export function chipLookOf(el: ShapeElement): ChipLook; // badge → solid, step → ink by default
export function chipColours(
  look: ChipLook,
  c: { accent: string; surface: string; ink: string },
): {
  fill: string;
  text: string;
  border: string | null;
  textOpacity: number;
};
export function badgeSize(
  label: string,
  textSize: TextSize | undefined,
): { width: number; height: number; fontPx: number };
export function nextStepNumber(elements: readonly Element[]): string;
export function renumberSteps(elements: Element[]): Element[];
export type AttachPoint =
  'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left';
export const ATTACH_POINTS: readonly AttachPoint[];
export const ATTACH_SNAP_PX = 16;
export function canHost(el: Element): boolean;
export function attachPointXY(host: Rect & { rotation?: number }, point: AttachPoint): Point;
export function settleChips(prev: readonly Element[], next: Element[]): Element[];
export function withAttached(
  elements: readonly Element[],
  ids: ReadonlySet<ElementId>,
): ReadonlySet<ElementId>;
```

Validation: `chipLook` one of `CHIP_LOOKS`; `attachAt` one of `ATTACH_POINTS`; `attachedTo` a non-empty string;
`stepSequence` boolean. A badge label is bounded at 24 and a step label at 3 by the editor's label editor and by
`element-normalise` (agents), not by validation (a stored longer label still renders, clipped).

## Data and persistence

| Field          | Class     | Notes                                           |
| -------------- | --------- | ----------------------------------------------- |
| `chipLook`     | persisted | Absent = the kind's default                     |
| `attachedTo`   | persisted | Removed with `attachAt` on detach               |
| `attachAt`     | persisted |                                                 |
| `stepSequence` | persisted | Stored only when true                           |
| x / y / size   | persisted | Kept true by settling, so readers need no logic |

## Errors and edge cases

| #   | Case                                           | Handling                                                              |
| --- | ---------------------------------------------- | --------------------------------------------------------------------- |
| E1  | Host deleted (any path)                        | Chip removed in the same commit; undo restores both                   |
| E2  | Host id unknown on load / agent write          | Detached in place                                                     |
| E3  | `attachAt` unknown                             | Treated as unattached                                                 |
| E4  | Chip attached to a chip, a container or itself | Not a host: detached on the next settle                               |
| E5  | Peer moves the host                            | The peer's commit settled and sent the chip's move too                |
| E6  | A step label that is not a whole number        | Kept; plays without a sequence delay; not counted by `nextStepNumber` |
| E7  | Two chips on one point                         | Both sit there; the later paints on top                               |

## Security and trust

Labels render as React text and `xmlEscape`d in export; ids are compared, never evaluated.

## Performance and limits

`settleChips` exits at once without chips; otherwise one id map (O(n)) and, per new or moved unattached chip, a scan
of hosts with a bounding-circle reject before the eight-point test. Measured (CPU, warm): a 2,000-box board with 200
badges all moved settles in 11 to 17 ms; one badge's drag in 0.5 to 1.3 ms. Budget test: the fastest of five warm passes
under 75 ms of CPU for the worst case (`attachment.perf.test.ts`); the headroom is for the CI coverage job, where an
instrumented pass on a shared runner measured 58 ms with one warm-up (17 ms warm under coverage locally).

## Presentation and UX

- Sizes: badge from `badgeSize` (24 tall at default, D181), step 28 × 28 aspect-locked (D182).
- Starting content: badge "New", step the next number.
- Looks as the spec's table; the step's Ink is the theme's ink with the surface colour number.
- Menu section **Badge** or **Step Number** (Tools flyout): look tiles (Solid, Ink, Outline, Tinted, Quiet); **Detach**
  while attached; on a step, **Renumber Steps**. **Play in Order** is a toggle in the same section, shown
  while the step has an animation. **Renumber Steps** is also a command-palette command (`renumber-steps`, offered while
  the tab holds a step; `apps/editor/lib/editor-commands.ts`).
- No resize handles on a badge (it fits its text); no quick-connect ring or anchors on either.

## Accessibility

Look tiles named "Solid Look" … ; the face's text is the label (screen reader name from `elementAriaLabel`).

## Observability

Telemetry: `Element·Added·Badge` / `Step`; `Element·Changed·ChipLook`, `ChipDetach`, `RenumberSteps`,
`StepSequence`. Settling logs nothing (it runs on every commit).

## Testing

| Rule                                                | Test file                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Points, rotation, snap, attach, detach, follow (I1) | `packages/document/src/attachment.test.ts`                                                                   |
| Host deleted removes, unknown host detaches (I2)    | same                                                                                                         |
| Badge fit (I3), next number, renumber, looks        | `packages/document/src/chip.test.ts`                                                                         |
| Duplicate remap / detach                            | `packages/document/src/duplicate.test.ts`                                                                    |
| Paint tier                                          | `packages/document/src/layers.test.ts`                                                                       |
| Export draws pill / disc in its look                | `packages/document/src/chip.test.ts`                                                                         |
| Face, menu section                                  | `apps/editor/components/canvas/ChipFace.test.tsx`, `apps/editor/components/palette/ChipMenuSection.test.tsx` |
| Settle budget                                       | `packages/document/src/attachment.perf.test.ts`                                                              |
| Templates and layouts land settled                  | `packages/templates/src/template-settled.test.ts`                                                            |

## Constants and configuration

| Name                   | Value               | Provenance / safe range |
| ---------------------- | ------------------- | ----------------------- |
| `ATTACH_SNAP_PX`       | 16                  | Spec; 8 to 24           |
| `BADGE_LABEL_MAX`      | 24                  | Spec                    |
| `STEP_LABEL_MAX`       | 3                   | Spec                    |
| `BADGE_HEIGHT_PX`      | sm 22, md 28, lg 36 | D181                    |
| `STEP_SIZE_PX`         | 28                  | Spec (D182)             |
| `STEP_SEQUENCE_BEAT_S` | 0.4                 | D183; 0.25 to 0.8       |
