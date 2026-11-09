# Turning furniture: blueprint

Derived from [Turning furniture](../furniture-facing.md). The spec decides; this file only adds engineering precision.

Scope, by file:

| File                                                                              | Role                                                                                          |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `packages/avatar/src/facing.ts`                                                   | `SeatFacing`, `facingView`, `turnFacing`, `turnedSitterFacing`, `mirrorFraction`, `turnedBox` |
| `packages/avatar/src/seats.ts`                                                    | `SEAT_VIEWS`: each kind's seats on its front, back and side drawings; `seatPoints`            |
| `packages/avatar/src/office-geometry.ts`                                          | `OFFICE_FOOTPRINT_TURNED`, `footprintFraction(shape, facing)`, `officeFootprint`              |
| `packages/avatar/src/hooks/useAvatarWalk.ts`                                      | `followSeat`: a sitter carried round when the piece turns or moves                            |
| `packages/document/src/furniture-facing.ts`                                       | `TURNING_SHAPES`, `turnsWithFacing`, `pieceFacing`, `defaultPieceFacing`, `turnPiece(By)`     |
| `packages/document/src/rotation.ts`                                               | `supportsRotation` is false for every piece of furniture (`isFurnitureShape`)                 |
| `packages/document/src/svg-render-faces.ts`                                       | The export draws `furnitureFrame(art, pieceFacing(el))`                                       |
| `apps/editor/components/canvas/collab/FurnitureView.tsx`                          | The canvas draws the same frame                                                               |
| `packages/avatar/src/components/TurnButtons.tsx`                                  | Rotate Left / Right                                                                           |
| `apps/editor/components/canvas/SelectionPopover.tsx`, `MultiSelectionToolbar.tsx` | The pair after More and Edit Text, before Duplicate                                           |
| `apps/editor/hooks/canvas/useDataShapeSetters.ts`                                 | `turnSelection`: one commit, non-turning pieces skipped, one telemetry event                  |
| `apps/editor/lib/editor-commands-selection.ts`                                    | `rotate-left` / `rotate-right` when `selectionTurns`                                          |
| `apps/editor/lib/placing-facing.ts`                                               | The facing of the piece being placed; `withPlacingFacing`, `placingSize`                      |
| `apps/editor/hooks/canvas/usePlacingTurnKeys.ts`                                  | Space / Shift+Space, window capture phase, ahead of the pan and the label key                 |
| `apps/editor/lib/palette-carry.ts`                                                | The pointer carry of a turning tile; its drop is `usePaletteDrop`'s                           |

## Rules the code keeps

- **One table of drawings.** A piece's `FurnitureArt` (`front`, `back`, `side`) is what the canvas, the export, the
  seats (`SEAT_VIEWS` grids match the drawings' grids) and the footprints are read against. Facing `'w'` is `side`
  mirrored: seats by `1 - u`, footprints by `mirrorFraction`, the drawing by a horizontal flip.
- **A turn is `turnPiece`.** It keeps the centre, fits the current drawing whole to read the scale, sizes the box to
  the target drawing at that scale, and drops `rotation`. Equal proportions keep the box exactly, so a chair turns in
  place and a round trip of a letterboxed box differs only by its slack.
- **Seats keep their order.** Seat `i` is the same cushion in every view, so a claim (`seat-claims.ts`) survives a
  turn and `followSeat` moves its sitter to `seatPoints(el)[i]`.
- **Placing.** The facing is module state keyed by kind; `usePlacingTurnKeys` resets it when the placing kind
  changes or ends. Both commit paths (`useShapeDrawing`'s tap, `dropPaletteItem`) apply `withPlacingFacing`, and the
  drag snap measures `placingSize` and re-measures when the facing changes under a still pointer.
- **The carry.** Mouse or pen, primary button, a turning kind: the tile's native `dragstart` is cancelled under a
  pressed carry. Past 4px it publishes `{ carried: true }`; a release over a `main` not under `[data-floating-panel]`
  notifies `subscribeCarryDrop` with the target, and only the canvas whose `main` holds the target lands it. The
  release's click is swallowed for one task. Escape (capture phase) and `blur` and `pointercancel` end it.

## Testing

- `packages/avatar/src/facing.test.ts`, `seats.test.ts`, `amenity-pieces.test.ts`, `useAvatarWalk.seats.test.tsx`
- `packages/document/src/furniture-facing.test.ts` (every turning kind has its own back and side, bar the Bar Stool
  and the Rug's back), the per-group art tests
- `apps/editor`: `placing-facing.test.ts`, `palette-carry.test.ts`, `usePlacingTurnKeys.test.tsx`,
  `usePaletteDragGuides.test.tsx`, `usePaletteDrop.test.ts`, `PlacementPreview.test.tsx`,
  `CanvasSelectionToolbars.test.tsx`, `useDataShapeSetters.facing.test.ts`, `editor-commands.test.ts`
- `packages/avatar`: `packages/avatar/src/components/TurnButtons.test.tsx`, `placing-facing.test.ts` and
  `packages/avatar/src/hooks/usePlacingTurnKeys.test.tsx` (the shapes `apps/editor` binds)
