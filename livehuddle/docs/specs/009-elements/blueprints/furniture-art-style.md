# Furniture art style: blueprint

Spec: [furniture-art-style.md](../furniture-art-style.md).

## Files

| File                                                                    | What it holds                                                                                               |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `packages/avatar/src/furniture-shading.ts`                              | `tone`, `partShade`, `shadeKeys`, `FURNITURE_LIGHT`, `FURNITURE_SOFT_SHADOW`, `FURNITURE_EDGE_STROKE`: pure |
| `packages/avatar/src/furniture-art.ts`                                  | `SEATING_TONES`, `SEAT_FABRIC`, `seatFabric`; the Chair, Desk, Sofa and Meeting Table drawings              |
| `packages/document/src/piece-material.ts`                               | `pieceMaterial`, `APPLIANCE_WHITE`: an office piece's material when it has no fill                          |
| `packages/document/src/office.ts`                                       | `ROOM_TONES`, `WALL_EDGE`, `FLOOR_BOARD`, `BOARD_LENGTH`, `floorBoards`; `roomParts` uses them              |
| `apps/editor/components/canvas/collab/furniture-paint.tsx`              | `useFurnitureLight`, `FurnitureLightDefs`, `FurniturePartView`, `LitParts`                                  |
| `packages/document/src/svg-render-office-art.ts`, `svg-render-doors.ts` | The export's lit parts (`lightOf`, `lightDefs`) and `plasterWallsSvg`                                       |
| `apps/editor/app/space-3d.css`                                          | The 3D walls' plaster and skirting variables                                                                |

## Behaviour

1. A drawing's light is built once per render from its parts and seat colour: `shadeKeys` gives each distinct
   `(role, colour)` among its `panel` and `face` parts an index. `FurnitureLightDefs` writes one vertical
   `linearGradient` per index (`partShade`: a panel from `tone(c, 0.2)` to `tone(c, -0.1)`, a face from
   `tone(c, -0.16)` to `tone(c, -0.34)`) and one soft radial shadow, under an id from `useId`.
2. A `panel` or `face` fills with its gradient and is stroked in `tone(colour, -0.5)` at `FURNITURE_EDGE_STROKE`
   (1.25), cached per colour (bounded at 512). A face no longer draws a second shade rect. `shadow` fills with the
   radial gradient. `line`, `rail`, `screen` and `floor` take a part's own `fill` when it has one.
3. The seat colour: `seatFabric(kind, fillColor)` for seating, the element's fill for a rug,
   `pieceMaterial(kind, fillColor)` for every other piece.
4. `roomParts` lays the floor, its boards (`floorBoards`: one `tint` path) and a 5 px `tint` band at the back
   wall's foot, then plaster walls (`ROOM_TONES.wallTop` tops, `wallFace` face) with a `mark` skirting along the back
   face's foot. Outline rooms and Corridors stroke their runs `wallEdge` at `ROOM_WALL + WALL_EDGE`, then
   `wallTop` at `ROOM_WALL`.
5. The export mirrors 1 to 4: `furnitureArt` and `sizedSvg` write `lightDefs` then each lit part, ids prefixed
   `fl-<element id>`.

## Testing

| Test                                                         | Covers                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------- |
| `packages/avatar/src/furniture-shading.test.ts`              | `rgbaOf`, `tone`, `partShade`, `shadeKeys`                |
| `packages/document/src/piece-material.test.ts`               | `pieceMaterial` and `seatFabric` defaults and own fills   |
| `packages/document/src/office.test.ts`                       | `floorBoards` is one path, staggered, empty for no floor  |
| `packages/document/src/seating.test.ts`                      | Rings still lie on a seat drawn before `ringUnder`        |
| `apps/editor/components/canvas/collab/office-views.test.tsx` | Lit fills, gradients per material, plaster corridor walls |

## Constants

| Name                    | Value                                 | Why                                             |
| ----------------------- | ------------------------------------- | ----------------------------------------------- |
| `FURNITURE_LIGHT`       | panel +0.2 / -0.1, face -0.16 / -0.34 | Lit from above, shade toward the floor (D236)   |
| `FURNITURE_EDGE_STROKE` | 1.25                                  | Finer than the old 2, crisp when small (D236)   |
| `SEAT_FABRIC`           | chair/sofa blue, desk/table charcoal  | Upholstery when a piece has no fill (D237)      |
| `ROOM_TONES`            | plaster `#f2ede5`, face `#ddd3c3`     | Walls the same in 2D and 3D (D238)              |
| `FLOOR_BOARD`           | 24 px rows, `BOARD_LENGTH` 120 px     | Reads as boards at 100% without crowding (D238) |
