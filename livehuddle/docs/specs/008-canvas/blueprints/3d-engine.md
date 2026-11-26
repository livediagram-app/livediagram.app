# Real 3D blueprint

Derived from [Real 3D](../3d-engine.md). Behind the `real3D` setting (Settings > Editor > Canvas, off).

## Files

| File                                                                        | Role                                                                                                                                                                                  |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/editor/lib/real-3d/projection.ts`                                     | Pure: `clipMatrix(stage, world, scaleZ, size)`, the CSS stage's own projection as a clip matrix, so both line up                                                                      |
| `apps/editor/lib/real-3d/mesh-builder.ts`                                   | Pure: `MeshBuilder` (bevelled boxes, slabs, flats, cylinders, lathes, spheres, tubes, outlines, glass, with normals), `parseColour`, `shade`, `mix`, `SHADE`                          |
| `apps/editor/lib/real-3d/character.ts`                                      | Pure: `characterParts(look)` (head, hair, torso, arms, thighs, shins, skirt, each with its joint), `BODY`, `lookKey`                                                                  |
| `apps/editor/lib/real-3d/scene-walls.ts`                                    | Pure: `wallMesh`, `roofMesh`, `wallPalette`: walls, glass, fences, windows, doorways with their leaves, roofs                                                                         |
| `apps/editor/lib/real-3d/piece-frame.ts`                                    | Pure: `pieceFrame(el)` (middle, yaw, size, footprint, facing), `frameToCanvas`, `canvasToFrame`                                                                                       |
| `apps/editor/lib/real-3d/piece-tones.ts`                                    | Pure: `pieceTones(art, seat, stroke)`, a piece's own colours from its drawing                                                                                                         |
| `apps/editor/lib/real-3d/scene-pieces.ts`                                   | Pure: `piecesMesh(elements)`, every standing piece's model merged in canvas coordinates, with each piece's box for presses; `facingInFrame`                                           |
| `apps/editor/lib/real-3d/models/kit.ts`                                     | The model kit: `Builder` (`b`, `c`, `legs`), `SEAT_Z`, `KIND_HEIGHT`, shared colours, `chairAt`                                                                                       |
| `apps/editor/lib/real-3d/models/{first,seating,storage,outdoor,rounded}.ts` | Each kind's model, by group; `rounded.ts` the turned and bent ones (cars, bikes, Fountain, Garden Umbrella, Campfire)                                                                 |
| `apps/editor/lib/real-3d/models/index.ts`                                   | `MODELS`, `buildModel(kind, context)`: a kind's model, or a block on its footprint at its height                                                                                      |
| `apps/editor/lib/real-3d/piece-pick.ts`                                     | Pure: `modelBounds`, `pickPiece(bounds, origin, dir)`, the piece a press's ray enters first                                                                                           |
| `apps/editor/lib/real-3d/real-3d-pick.ts`                                   | The layer's picker slot: `setReal3DPicker`, `real3DDrawing`, `real3DPointAt`                                                                                                          |
| `apps/editor/hooks/canvas/useCanvasSurfaceGestures.ts`                      | A walking press asks `real3DPointAt` (instead of the stood-up drawings) while Real 3D draws                                                                                           |
| `apps/editor/components/canvas/real-3d/character-rig.ts`                    | `CharacterKit` (each look's parts built once, 48 kept), `CharacterRig` (joints posed per frame: walk, sit, reactions, cup, flag), `WalkerPose`                                        |
| `apps/editor/components/canvas/real-3d/scene-look.ts`                       | `createLook(scene, renderer)`: the sky light, the sun and its soft shadows, the shadow catcher, the lit materials                                                                     |
| `apps/editor/components/canvas/real-3d/moment-fx.ts`                        | `MomentFx`: a piece's moment in the scene (rock, shiver or hop) and its particles (leaves, butterflies, coin and ripples, sparks, puffs, lamps, glints)                               |
| `apps/editor/lib/piece-moments.ts`                                          | Also `subscribeMoments`, `latestMoments`, so Real 3D plays the moments 2D plays                                                                                                       |
| `apps/editor/components/canvas/real-3d/outline-pass.ts`                     | The ink: the scene drawn into a target, then copied with a one-pixel outline at silhouettes and depth steps                                                                           |
| `apps/editor/components/canvas/real-3d/Real3DLayer.tsx`                     | Loaded on first use: the renderer, the static scene (walls, roofs, pieces), figures read from `[data-figure]` each frame, the cut-away and sight-line cut, the roof over you, moments |
| `apps/editor/app/document/real-3d-sheet/`                                   | Dev only: the contact sheet, every kind x facing x camera turn with sitters in its seats; `figure:...` kinds for one character; `?moment=<kind>` replays a moment                     |
| `apps/editor/components/canvas/Canvas.tsx`                                  | `data-real-3d` on the main, mounts `Real3DLayer`, moves the characters layer into the flat overlay                                                                                    |
| `apps/editor/app/space-3d.css`                                              | Under `[data-real-3d]`: hides the CSS walls, roofs, stood-up pieces and sprites (kept for presses); flat chips                                                                        |
| `apps/editor/components/canvas/space-3d/useFlatBillboards.ts`               | Also projects each `[data-avatar-stand]`, so chips and bubbles stay flat over their character                                                                                         |
| `packages/avatar/src/components/AvatarWalker.tsx`                           | `data-figure` (the pose as JSON) and `data-figure-scale` on each walker, the figures' only source                                                                                     |

## How it fits

- The CSS 3D view still runs underneath: its stage transform is the camera, its floor is the ground, its pieces' boxes
  take presses. The WebGL canvas sits over the floor and under the overlay, reading the stage's computed transform each
  frame, so the scene and the floor never drift.
- The static scene rebuilds only when the board's elements, the walls, the roofs or the palette change. Each frame
  moves the camera, poses each character's rig, plays moments (lifting the piece out of the merged mesh by zeroing its
  vertex range), and fades the walls in front of your feet and any wall or roof between your head and the camera.
- Measured on the Coworking Space (2026-11-25, block models): 2.4 ms a frame median, 5.1 ms p95; three.js's used parts
  133 KB gzipped, loaded only when Real 3D is on. With the smooth models, the Company Campus holds about 613,000
  triangles; frame time matched 2D (the browser's cap), not yet measured on a mid laptop or a phone.
