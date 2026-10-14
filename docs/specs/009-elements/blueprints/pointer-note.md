# Pointer note: blueprint

Derived from [The pointer note](../pointer-note.md). Attachment is the badge's ([Badge blueprint](badge.md)); this adds
the note's own tip. Defaults in [DEFAULTS.md](DEFAULTS.md) as `Dn`.

| File                                                      | Role                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| `packages/document/src/pointer-note.ts`                   | Kind guard, tip read / write, leader geometry, tip snapping         |
| `packages/document/src/attachment.ts`                     | `settleChips` settles a pointer note; `withAttached` carries it     |
| `packages/document/src/svg-render-pointer-note.ts`        | Headless body: panel, leader, tip                                   |
| `apps/live/components/canvas/PointerNoteOverlay.tsx`      | Canvas face: leader, tip, the tip handle while selected             |
| `apps/live/components/palette/PointerNoteMenuSection.tsx` | Detach                                                              |
| `apps/live/hooks/canvas/usePointerNoteSetters.ts`         | `setPointerTip(id, tipAbs)`: snap, attach or free, one history step |

## Domain and naming

| Term         | Identifier                               | Meaning                                                |
| ------------ | ---------------------------------------- | ------------------------------------------------------ |
| Pointer note | `shape: 'pointer-note'`, `isPointerNote` | The note element                                       |
| Tip          | `pointerTip: { x, y }`                   | Where the leader ends, relative to the note's top-left |
| Leader       | `pointerLeader(note)`                    | The line from the note's nearest edge point to the tip |
| Host / point | `attachedTo` / `attachAt`                | The badge's fields                                     |

Banned: "callout" (a Card preset), "arrow" (an arrow element), "pin" (comment pins).

## Behaviour and state

### Settling (in `settleChips(prev, next)`)

For each pointer note `n` (before: `p`, the same id in `prev`):

1. Attached with a known, hostable host and a valid point: `target = attachPointXY(host, attachAt)`.
   - The host's box changed since `prev`, or the note is new: keep the tip, move the note so its tip lands on target:
     `x = target.x - tip.x`, `y = target.y - tip.y`.
   - Otherwise (the note moved, resized or nothing): keep the note, re-aim the tip: `tip = target - (x, y)`.
2. Attached to an id in `prev` that is gone from `next`: the note is removed (deleted with its host).
3. Attached to an unknown or unhostable id, or with an invalid point: detached where it is, its tip unchanged.
4. Unattached: unchanged. (A note is never attached by landing near a point; only its tip handle attaches it.)

`withAttached` adds attached pointer notes to a carried set, as it does chips; duplicate and paste remap `attachedTo`
through the same path.

### Tip handle (`snapPointerTip(elements, note, tipAbs)`)

Returns `{ pointerTip, attachedTo?, attachAt? }`: the nearest host point within `ATTACH_SNAP_PX` of `tipAbs`
(excluding the note itself and other pointer notes, chips and containers, `canHost`) attaches the tip there, the tip set
to that point; otherwise the tip is `tipAbs - (x, y)` and the note is detached.

### Leader (`pointerLeader(note)`)

The tip in note-local coordinates `t`; the start is the point of the note's box nearest `t` (clamped to the box);
when `t` lies inside the box there is no leader (`null`). The face and the export draw the same line.

### Writes

`withPointerTip(el, tip)`; `detachChip` detaches a pointer note too. Telemetry `PointerTip` (moved or attached),
`PointerDetach`.

### Invariants

- I1: an attached note's `x + tip.x, y + tip.y` equals its host point after any commit (to 0.5 px).
- I2: a note is never attached by its own position, only by its tip.
- I3: the export and the canvas draw the leader from `pointerLeader`.

## Interfaces and contracts

```ts
export function isPointerNote(el: Element): el is ShapeElement & { shape: 'pointer-note' };
export function pointerTipOf(el: ShapeElement): { x: number; y: number };
export function withPointerTip<T extends Element>(el: T, tip: { x: number; y: number }): T;
export function pointerLeader(
  el: ShapeElement,
): { x1: number; y1: number; x2: number; y2: number } | null;
export function snapPointerTip(
  elements: readonly Element[],
  note: ShapeElement,
  tipAbs: { x: number; y: number },
): { pointerTip: { x: number; y: number }; attachedTo?: string; attachAt?: AttachPoint };
```

Validation: `pointerTip` an object of two finite numbers, each within ±4000 (`POINTER_TIP_MAX`).

## Data and persistence

| Field                    | Class     | Notes                                  |
| ------------------------ | --------- | -------------------------------------- |
| `pointerTip`             | persisted | Absent reads as the default tip (D190) |
| `attachedTo`, `attachAt` | persisted | As a badge's                           |

## Errors and edge cases

| #   | Case                                   | Handling                                                    |
| --- | -------------------------------------- | ----------------------------------------------------------- |
| E1  | Tip inside the note's box              | No leader; the tip dot still shows                          |
| E2  | Host rotated                           | `attachPointXY` turns the point with it                     |
| E3  | Host and note moved in the same commit | Treated as the host moving (both carried); the tip holds    |
| E4  | `pointerTip` missing or invalid        | The default tip (D190); validation refuses an invalid write |

## Security and trust

Text renders as React text and is escaped in export; the tip is two bounded numbers.

## Performance and limits

Settling adds one pass over pointer notes (O(notes)); the tip handle snaps against hosts with the badge's
bounding-circle reject, on pointer-up only.

## Presentation and UX

- Starting content (D190): 180 × 64, label "Stale for 60 s after a price change", tip at (-24, 120) (56 px below the
  bottom-left corner, 24 px left of it); amber border `#d97706`, wash `#fffbeb`, ink `#78350f`; text sm, top-left;
  radius md.
- Tip: a 7 px dot in the border colour; leader 1.5 px in the border colour.
- Handle: while selected and editable, a 12 px ring on the tip, `cursor: grab`; dragging shows the tip following the
  pointer and a 16 px halo on the point it would attach to.

## Accessibility

The handle is a `role="button"` named "Move pointer tip"; arrow keys move the tip 1 px (10 px with Shift) and commit
on key-up.

## Observability

`Element·Added·PointerNote`; `Element·Changed·PointerTip`, `PointerDetach`.

## Testing

| Rule                                | Test file                                                      |
| ----------------------------------- | -------------------------------------------------------------- |
| Settling (I1, I2, deletes, carries) | `packages/document/src/pointer-note.test.ts`                   |
| Leader, snapping, export (I3)       | same                                                           |
| Face, tip handle drag and keys      | `apps/live/components/canvas/PointerNoteOverlay.test.tsx`      |
| Menu section                        | `apps/live/components/palette/PointerNoteMenuSection.test.tsx` |

## Constants and configuration

| Name              | Value | Provenance / safe range |
| ----------------- | ----- | ----------------------- |
| `POINTER_TIP_MAX` | 4000  | Spec; any board-sized   |
| `ATTACH_SNAP_PX`  | 16    | The badge's             |
| Tip dot           | 7 px  | D190                    |
