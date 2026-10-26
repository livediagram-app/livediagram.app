# The badge, the step number and attachment: blueprint

Derived from [The badge](../badge.md) and [The step number](../step-number.md). No Plan surface places a badge or a
step number; they arrive with a tab (an import, a paste, an agent's elements, a template) and the canvas draws and
moves them. The spec decides; this file adds engineering precision.

Scope, by file:

| File                                       | Role                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| `packages/project/src/chip.ts`             | `isChip`, `badgeSize`, `stepFontPx`, `nextStepNumber`                         |
| `packages/project/src/attachment.ts`       | `AttachPoint`, `ATTACH_POINTS`, `ATTACH_SNAP_PX`, `settleChips`               |
| `packages/project/src/stored-elements.ts`  | Settles a stored tab's chips on read, `attachLoose: false`                    |
| `packages/templates/src/build-template.ts` | A template lands settled, `attachLoose: false`                                |
| `apps/editor/lib/settle-tabs.ts`           | `settleChipsInTabs`: every tab a commit or a tick changed, against its before |

## Domain and naming

| Term         | Identifier                                  | Meaning                                                |
| ------------ | ------------------------------------------- | ------------------------------------------------------ |
| Chip         | `isChip(el)`                                | A `badge` or `step` shape                              |
| Attach point | `AttachPoint`, `ATTACH_POINTS`              | One of eight: the four corners and four edge midpoints |
| Attachment   | `attachedTo` (host id) + `attachAt` (point) | Both set, or neither                                   |

## Settling

`settleChips(prev, next, { attachLoose = true })` runs at one place per write: the editor's commit and tick
(`settleChipsInTabs`, after diagram keys and stacks), an agent's write (`element-normalise.ts`), a stored tab's read
and a template's build. Every way a host moves, resizes, turns or is deleted reaches it, so no gesture carries
attachment code of its own. For each element of `next`:

1. A pointer note settles by its tip ([Pointer note](pointer-note.md) "Settling").
2. A badge fits its text: `badgeSize(label, textSize)`, kept centred.
3. A new step with no label takes the next number (`nextStepNumber`, counted on so several new in one write number
   1, 2, 3); every step's `textSize` is `stepFontPx` of its disc.
4. An attached chip: its host gone since `prev` deletes it; a host unknown, unable to host, the chip itself, or an
   invalid point detaches it. A chip moved more than `ATTACH_SNAP_PX` from its point while its host stayed still
   detaches; otherwise it is centred on its point, unless it is locked and already placed.
5. With `attachLoose`, a new or moved loose chip whose centre lands within `ATTACH_SNAP_PX` of a host's point attaches
   there (`nearestPoint`, a bounding-circle reject before the point scan).

It returns `next` itself when nothing changed, and passes through at once when `next` holds no chip or pointer note.

## Performance and limits

Settling runs on every commit and every tick, so it must fit a frame's slack. The worst case is every chip moved at
once, each considered for attaching: 2,000 boxes and 200 badges settle within a 75 ms CPU budget
(`attachment.perf.test.ts`; measured at 11 to 17 ms, and under 1.3 ms for one badge's drag).

## Testing

- `packages/project/src/attachment.test.ts`: fit, numbering, follow, detach, delete with the host, attach on drop.
- `packages/project/src/attachment.perf.test.ts`: the budget above.
- `packages/templates/src/template-settled.test.ts`: a template lands settled.

## Constants and configuration

| Constant         | Value | Provenance                          |
| ---------------- | ----- | ----------------------------------- |
| `ATTACH_SNAP_PX` | 16    | How close a centre comes to a point |
