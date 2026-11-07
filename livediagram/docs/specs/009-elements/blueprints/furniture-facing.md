# Turning furniture: blueprint

Derived from [Turning furniture](../furniture-facing.md). The spec decides; this file only adds engineering precision.

Scope, by file:

| File                                                                              | Role                                                                                                                            |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `../packages/avatar/src/facing.ts`                                                | `SeatFacing`, `facingView`, `turnFacing`, `turnedSitterFacing`, `mirrorFraction`, `turnedBox`                                   |
| `../packages/avatar/src/furniture-art.ts`                                         | `@liveworkspace/avatar/furniture-art`: each piece's `front`, `back` and `side` drawings, and the generic turn both products use |
| `../packages/avatar/src/seats.ts`                                                 | `SEAT_VIEWS`: each kind's seats on its front, back and side drawings; `seatPoints`                                              |
| `../packages/avatar/src/office-geometry.ts`                                       | `footprintFraction(shape, facing)`, `officeFootprint`: the bookshelf's (and plant's) footprint per facing                       |
| `../packages/avatar/src/hooks/useAvatarWalk.ts`                                   | `followSeat`: a sitter carried round when the piece turns or moves                                                              |
| `packages/document/src/furniture-facing.ts`                                       | `TURNING_SHAPES`, `turnsWithFacing`, `isFurnitureShape`, `pieceArt`, `defaultPieceFacing`, `pieceFacing`, `turnPiece(By)`       |
| `packages/document/src/rotation.ts`                                               | `supportsRotation` is false for every piece of furniture (`isFurnitureShape`)                                                   |
| `packages/document/src/svg-render-faces.ts`                                       | The export draws `furnitureFrame(pieceArt(el), pieceFacing(el))`                                                                |
| `packages/edit-operations/src/element-format.ts`                                  | `SHAPE_KIND_FIELDS` lists `chairFacing` for every turning kind                                                                  |
| `apps/editor/components/canvas/collab/FurnitureView.tsx`                          | The canvas draws the same frame; `MachineAnswer` plays on the facing's drawing                                                  |
| `../packages/workbench/src/components/canvas/TurnButtons.tsx`                     | Rotate Left / Right, disabled when locked                                                                                       |
| `apps/editor/components/canvas/SelectionPopover.tsx`, `MultiSelectionToolbar.tsx` | The pair after More and Edit Text, before Duplicate                                                                             |
| `apps/editor/components/palette/CollabMenuSections.tsx`                           | The facing section titled for the piece, Down / Left / Up / Right, its hint                                                     |
| `apps/editor/hooks/canvas/useDataShapeSetters.ts`                                 | `turnSelection`: one commit, locked and non-turning pieces skipped, one telemetry event                                         |
| `apps/editor/lib/editor-commands-selection.ts`                                    | `rotate-left` / `rotate-right` when `selectionTurns`                                                                            |
| `../packages/workbench/src/lib/placing-facing.ts`                                 | `createPlacingFacing`: the facing of the piece being placed; `withPlacingFacing`, `placingSize`                                 |
| `../packages/workbench/src/hooks/canvas/usePlacingTurnKeys.ts`                    | `createPlacingTurnKeys`: Space / Shift+Space, window capture phase, ahead of the pan and the label key                          |
| `../packages/workbench/src/lib/palette-carry.ts`                                  | `createPaletteCarry`: the pointer carry of a turning tile; its drop is `usePaletteDrop`'s                                       |
| `apps/editor/lib/placing-facing.ts`, `apps/editor/lib/palette-carry.ts`           | Thin wrappers binding the shared factories to livediagram's `turnsWithFacing` and drag preview                                  |
| `apps/editor/hooks/canvas/usePlacingTurnKeys.ts`                                  | The thin wrapper binding `createPlacingTurnKeys` to livediagram's placing state                                                 |
| `apps/editor/components/canvas/PaletteDragGhost.tsx`                              | The dashed footprint sized by `placingSize`, following pointer moves during a carry                                             |

## Rules the code keeps

- **One table of drawings.** A piece's `FurnitureArt` (`front`, `back`, `side`) is what the canvas, the export, the
  seats (`SEAT_VIEWS` grids match the drawings' grids) and the footprints are read against. Facing `'w'` is `side`
  mirrored: seats by `1 - u`, footprints by `mirrorFraction`, the drawing by a horizontal flip.
- **A turn is `turnPiece`.** It keeps the centre, fits the current drawing whole to read the scale, sizes the box to
  the target drawing at that scale, and drops `rotation`. Equal proportions keep the box exactly, so a chair turns in
  place and a round trip of a letterboxed box differs only by its slack.
- **The turning set is livediagram's own.** `TURNING_SHAPES` is chair, desk, sofa, meeting-table, bookshelf,
  water-cooler, coffee-machine and rug; `isFurnitureShape` adds the plant (furniture, never rotated, but one drawing).
  The room is neither.
- **Seats keep their order.** Seat `i` is the same cushion in every view, so a claim (`seat-claims.ts`) survives a
  turn and `followSeat` moves its sitter to `seatPoints(el)[i]`.
- **Placing.** The facing is module state keyed by kind; `usePlacingTurnKeys` resets it when the placing kind changes
  or ends. Both commit paths (`useShapeDrawing`'s tap, `dropPaletteItem`) apply `withPlacingFacing`, and the drag snap
  and `PaletteDragGhost` measure `placingSize` and re-measure when the facing changes under a still pointer. There is
  no armed-tile preview to turn.
- **The carry.** Mouse or pen, primary button, a turning kind: the tile's native `dragstart` is cancelled under a
  pressed carry. Past 4px it publishes `{ carried: true }`; a release over a `main` not under `[data-floating-panel]`
  notifies `subscribeCarryDrop` with the target, and only the canvas whose `main` holds the target lands it. The
  release's click is swallowed for one task. Escape (capture phase) and `blur` and `pointercancel` end it. Touch keeps
  the native drag.
- **Telemetry.** `turnSelection` emits `track('Element', 'Changed', <token>)` once, the token
  `elementTelemetryType` gives the first piece it turned.

## Testing

- `../packages/avatar/src/facing.test.ts`, `seats.test.ts`, `office-geometry.test.ts`, `useAvatarWalk.seats.test.tsx`
- `packages/document/src/furniture-facing.test.ts` (every turning kind has its own back and side, bar the Rug's back),
  `seating.test.ts`, `office.test.ts`, `rotation.test.ts`
- `apps/editor`: `placing-facing.test.ts`, `palette-carry.test.ts`, `usePlacingTurnKeys.test.tsx`,
  `usePaletteDrop.test.ts`, `CanvasSelectionToolbars.test.tsx`, `useDataShapeSetters.facing.test.ts`,
  `editor-commands.test.ts`, `FurnitureView.test.tsx`, `machine-answer.test.tsx`
- `packages/workbench`: `TurnButtons.test.tsx`, and the shared placing factories' tests
