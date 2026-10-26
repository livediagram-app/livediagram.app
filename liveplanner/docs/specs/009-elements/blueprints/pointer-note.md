# Pointer note: blueprint

Derived from [The pointer note](../pointer-note.md). No Plan surface places one; it arrives with a tab and the canvas
draws and moves it. The spec decides; this file adds engineering precision.

Scope, by file:

| File                                              | Role                                          |
| ------------------------------------------------- | --------------------------------------------- |
| `packages/project/src/pointer-note.ts`            | `isPointerNote`, `pointerTipOf`               |
| `packages/project/src/attachment.ts`              | `settlePointerNote`, run inside `settleChips` |
| `packages/project/src/svg-render-pointer-note.ts` | The note and its leader line in an export     |

## Settling

A pointer note attaches by its **tip**, not its box: `attachedTo` and `attachAt` name the host point
([The badge](../badge.md) "Attachment") the tip rests on, and `pointerTip` is the tip's offset from the note's
top-left. `settlePointerNote`, for an attached note:

- its host gone since the last write: the note is deleted with it;
- its host unknown, unable to host, the note itself, or an invalid point: the note is detached;
- the note new, or its host moved or resized: the note is carried so its tip lands on the point;
- otherwise (the note moved, or nothing did): the note stays and its tip is re-aimed at the point, rounded to a tenth
  of a pixel.

An unattached note is returned as it is. Nothing changes when the tip is already within 0.05 px.

## Testing

`packages/project/src/pointer-note.test.ts` and `attachment.test.ts`: carried with its host, re-aimed when moved,
deleted with its host, detached from an unknown one.
