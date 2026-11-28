# Road: blueprint

Derived from [Road](../road.md).

## Files

| File                                                                                     | Role                                                                                                              |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/office-road.ts`                                                   | `ROAD_FILL`, `ROAD_FILL_DARK`, `ROAD_TONES`, `ROAD_KERB`, `roadRun`, `roadDashes`, `roadParts` (the flat drawing) |
| `packages/document/src/shape-kind.ts`, `shape-kinds.ts`                                  | `road` joins `ShapeKind` and `SHAPE_KINDS` beside the garden pieces                                               |
| `packages/document/src/office.ts`                                                        | `road` joins `OfficeKind`, `OFFICE_KINDS`, `SizedOfficeKind` and the sized list (drawn to its size)               |
| `packages/document/src/colors.ts`                                                        | `FLOOR_FILLS.road`: the asphalt, light and dark paper; the floor branch of `behaviourSkin`; the self-drawn list   |
| `packages/document/src/paint-order.ts`                                                   | `road` is a backdrop of rank 1 (with the Garden Path): over grass, under everything else                          |
| `packages/document/src/furniture-facing.ts`                                              | `road` joins `TURNING_KINDS`; `turnPiece` turns it with `turnFlat` (the Rug's)                                    |
| `packages/document/src/shape-factory.ts`                                                 | Default 480 × 136; wordless; not aspect locked                                                                    |
| `packages/document/src/svg-render-faces.ts`                                              | `sizedSvg(roadParts)` in the asphalt fill                                                                         |
| `packages/document/src/animation-membership.ts`, `data-shapes.ts`, `behaviour-shapes.ts` | `road` beside `garden-path` in each list                                                                          |
| `packages/avatar/src/office-geometry.ts`                                                 | `isFloorShape('road')`: never blocks, never a destination                                                         |
| `apps/editor/components/canvas/collab/GardenViews.tsx`                                   | `RoadView`: `roadParts` through `LitParts`                                                                        |
| `apps/editor/components/canvas/PieceArt.tsx`                                             | `hasPieceArt('road')` and its case                                                                                |
| `apps/editor/components/palette/tile-defs/leisure-tiles.tsx`                             | The `tools:road` tile (Garden)                                                                                    |
| `apps/editor/components/palette/palette-icons-garden.tsx`                                | `RoadIcon`                                                                                                        |
| `apps/editor/components/palette/space-category-groups.ts`                                | `tools:road` after `tools:garden-path` in **Paths and Fences**                                                    |
| `apps/editor/lib/palette-tile-keywords.ts`                                               | Its search words                                                                                                  |
| `apps/editor/lib/avatar-click-intent.ts`                                                 | `road: W` (walk to the clicked point)                                                                             |
| `apps/editor/lib/real-3d/scene-grass.ts`, `lib/space-3d/space-3d-walls.ts`               | `road` covers grass                                                                                               |
| `apps/editor/lib/space-3d/space-3d-pieces.ts`                                            | `road` is flat                                                                                                    |
| `apps/editor/lib/real-3d/scene-pieces.ts`                                                | `road` is flat with standing parts (its kerbs)                                                                    |
| `apps/editor/lib/real-3d/models/road.ts`                                                 | `ROAD_MODELS.road`: the two kerbs; `roadCar`: the traffic's car, body and trim apart                              |
| `apps/editor/lib/real-3d/models/rounded.ts`                                              | `car` exported (its body and trim colours as arguments), shared with the Car Park                                 |
| `apps/editor/lib/real-3d/road-traffic.ts`                                                | Pure: `roadLanes`, `laneCars`, `trafficRoads`, the schedule constants and the palette                             |
| `apps/editor/components/canvas/real-3d/road-traffic-mesh.ts`                             | `RoadTraffic`: the one instanced mesh, the fade, `update`                                                         |
| `apps/editor/components/canvas/real-3d/contact-shadows.ts`                               | `road` casts no contact shadow                                                                                    |
| `apps/editor/components/canvas/real-3d/Real3DLayer.tsx`                                  | Builds `RoadTraffic` once the board has a road; `update` each frame; never `stir`                                 |
| `packages/templates/src/template-3d-fit.ts`                                              | Rule `outdoor`: a road's middle never lies in a room or a corridor                                                |
| `packages/templates/src/template-roomy.ts`                                               | `road` grows along its length and is floor                                                                        |
| `packages/templates/src/template-builders-campus.ts`                                     | The Company Campus's street along its front, outside the gate                                                     |
| `liveworkspace/apps/help/app/palette/virtual-office/page.mdx`                            | The Road in the Garden list and a line of its own                                                                 |

## Domain and naming

| Term         | Identifier      | Meaning                                                                                  |
| ------------ | --------------- | ---------------------------------------------------------------------------------------- |
| Road         | `road`          | The shape kind, default 480 × 136                                                        |
| Run          | `roadRun(w, h)` | `{ horizontal: w >= h, length: max(w, h), across: min(w, h) }`                           |
| Kerb         | `ROAD_KERB`     | 8 px band along each long side (`min(8, across / 10)`)                                   |
| Lane         | `RoadLane`      | One lane's centre line: start, end (in its direction of travel) and its length           |
| Car          | `LaneCar`       | One car on a lane now: `s` (its middle's distance along the lane), `fade` (0..1), `tone` |
| Slot         | `SLOT_S`        | 7 s; each slot sets off at most one car per lane                                         |
| Traffic road | `TrafficRoad`   | A road the cars drive: id, box, seed; outdoors and wide enough                           |

## Behaviour and state

- **Lanes** (`roadLanes(box)`): `kerb = min(ROAD_KERB, across / 10)`, `lane = (across - 2 * kerb) / 2`. Across (`horizontal`):
  the bottom lane's centre `y + kerb + lane * 1.5` runs from `x` to `x + width` (+x); the top lane's centre
  `y + kerb + lane / 2` from `x + width` to `x` (-x). Down: the left lane's centre `x + kerb + lane / 2` from `y` to
  `y + height` (+y); the right lane's centre `x + kerb + lane * 1.5` from `y + height` to `y` (-y). Keep right, the
  same at every facing. `lane < MIN_LANE` (48, so 96 across the lanes): no lanes, no traffic.
- **Schedule** (`laneCars(seed, laneIndex, length, tSeconds, out)`): slot `k` covers `[k * SLOT_S, (k + 1) * SLOT_S)`.
  `h = hash(seed, laneIndex, k)` (mulberry32 of the three mixed); with `r0 = h()`, the slot sets off a car when
  `r0 < DEPART_CHANCE` (0.6), at `k * SLOT_S + h() * (SLOT_S - HEADWAY_S)` (`HEADWAY_S` 2.5), its tone
  `floor(h() * TRAFFIC_TONES.length)`. Travel `T = (length - CAR_LENGTH) / CAR_SPEED`; `T <= 0`: no cars. A car that
  set off at `d` is on the lane while `0 <= t - d < T`, `s = CAR_LENGTH / 2 + (t - d) * CAR_SPEED`, its fade
  `min(1, (t - d) / FADE_S, (T - (t - d)) / FADE_S)`. Slots `floor((t - T) / SLOT_S)` to `floor(t / SLOT_S)` are read:
  at most `ceil(T / SLOT_S) + 1` per lane. Consecutive cars are at least `HEADWAY_S` apart, so never overlap
  (`HEADWAY_S * CAR_SPEED = 750 > CAR_LENGTH`).
- **The time** is `Date.now() / 1000` (seconds since the epoch), so it is the same moment on every clock that agrees.
- **The seed** is FNV-1a of the road's id.
- **Who drives** (`trafficRoads(elements)`): every `road` shape whose middle is not inside a `room` or `corridor`
  (`pointInRoom` of the board's rooms and corridors by their boxes) and whose lanes exist. Rebuilt when the board
  changes, by a key of the roads' ids and boxes.
- **In view**: each frame a road is skipped unless one of its box's four floor corners, or its middle, projects inside
  the clip square widened by 10% (`camera.projectionMatrix`), so a road whose box spans the view is still in view.
- **Reduced motion** (`prefersReducedMotion()` read each frame, one media query): no cars; both meshes' count 0.
- **The frame loop** calls `traffic.update(roads, Date.now() / 1000, camera)` after the characters, never `stir`.

## Presentation

- `roadParts(w, h)`, in this order: the asphalt `rect('floor', 0, 0, w, h, 0)` (the element's fill); its speckle
  (`gravelSpecks` inside the carriageway, light `#ffffff14`, dark `#0000001f`); a hairline edge line 3 px inside each
  kerb (`#ffffff59`, 1.5 px); the dashes (`#f5f5f0`, 3 px thick, 24 long, 20 apart, centred so the first and last are
  whole, none on a road shorter than one dash); each kerb a `panel` of `ROAD_TONES.kerb` `#d9d5cc` with its face a
  `mark` `#0000002e` 2 px along its road side.
- 3D kerbs (`ROAD_MODELS.road`): `m.rounded` along each long side, the kerb's band, `0..KERB_Z` (2.2 as built,
  about 3 as risen), `ROAD_TONES.kerb`, bevel 0.8.
- The car (`roadCar`): `car` built at `CAR_WIDTH` 48 × `CAR_LENGTH` 92, nose toward +y, centred at the origin. Built
  twice, body white (`0xffffff`, sill `0x9a9a9a`) and body black; a corner whose colour differs between the two is
  body (`tint` 1), the rest trim (`tint` 0). Body and trim go into one geometry with a `tint` attribute (1 body, 0 trim); positions rise with `RISE`.
- `TRAFFIC_TONES`: `0xd94848` cherry red, `0x4f7fd9` cornflower blue, `0x7fa77a` sage green, `0xe8bf3f` sunflower
  yellow, `0xf1efe9` pearl white, `0x5d6673` slate grey, `0x2f9c95` teal.
- **The fade** is a dissolve: each car's pixels are discarded against a 4 × 4 ordered (Bayer) threshold below its
  fade, in the lit pass and in the sun's shadow pass (`customDepthMaterial`), so a car stays opaque to the depth and
  ink passes and its shadow fades with it.

## Performance and limits

- One `InstancedMesh`, capacity `MAX_CARS` 96; past it the later roads' cars are left out.
  `instanceMatrix`, a `carColour` (vec3) and a `carFade` (float) `InstancedBufferAttribute` written in place each
  frame, `DynamicDrawUsage`, `needsUpdate` only when the count or a car changed.
- `laneCars` writes into a preallocated `Float32Array` (3 numbers per car); no array, object or closure per car or
  per frame; one `Matrix4` and one `Vector3` reused.
- No road: no `RoadTraffic` is built and the frame does nothing for traffic.
- Measured 2026-11-27 (ego lite, Apple laptop GPU), 10 roads 1600 px long in view: see [Measurements](#measurements).

## Errors and edge cases

- A road with zero width or height: `roadParts` returns `[]`, `roadLanes` none.
- A road shorter than a car (`length <= CAR_LENGTH`): no cars.
- A road dragged: the drag preview's box drives (the key changes, the cars follow the new box at once).
- A road deleted while a car is on it: its cars go at the next frame.
- A clock jump: cars are where the new time puts them; nothing is kept between frames to go stale.

## Accessibility

- Reduced motion: no cars. The road is `aria-label="Road"` in its drawing.

## Testing

| Rule                                                           | Test                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| Lanes keep right, either way round; too narrow has none        | `apps/editor/lib/real-3d/road-traffic.test.ts`                     |
| Same cars for the same id and time; different roads differ     | `road-traffic.test.ts`                                             |
| Cars never closer than the headway; fade in, full, fade out    | `road-traffic.test.ts`                                             |
| No traffic indoors; only roads drive                           | `road-traffic.test.ts`                                             |
| Worst case: 10 long roads, a minute of frames, within a budget | `road-traffic.test.ts`                                             |
| Body and trim split; tint marks only the body                  | `apps/editor/lib/real-3d/road-model.test.ts`                       |
| The drawing: kerbs, whole dashes, empty when sizeless          | `packages/document/src/office-road.test.ts`                        |
| A turn swaps the sides about the middle                        | `office-road.test.ts`                                              |
| Floor, walkable, flat, covers grass                            | `office-road.test.ts`, `packages/avatar` `office-geometry.test.ts` |
| Template roads stay out of rooms                               | `packages/templates/src/template-3d-fit.test.ts`                   |
| The tile sits in Paths and Fences                              | `apps/editor/components/palette/category-flyout-groups.test.ts`    |

## Constants and configuration

| Constant        | Value | Why                                                         |
| --------------- | ----- | ----------------------------------------------------------- |
| `SLOT_S`        | 7     | Several seconds between cars on a lane                      |
| `DEPART_CHANCE` | 0.6   | About six slots in ten set off a car                        |
| `HEADWAY_S`     | 2.5   | Cars never bunch                                            |
| `CAR_SPEED`     | 300   | A little above the walk's 260 px/s                          |
| `FADE_S`        | 0.5   | A soft arrival and leaving                                  |
| `CAR_LENGTH`    | 92    | A car longer than a character is wide, two lane-widths long |
| `CAR_WIDTH`     | 48    | Fits a 60 px lane with room each side                       |
| `MIN_LANE`      | 48    | Narrower, a car would cover the line or the kerb            |
| `MAX_CARS`      | 96    | Ten long roads' worth                                       |

## Measurements

- **CPU**, `RoadTraffic.update` for ten 1600 px roads all in view, 1800 frames (`road-traffic-mesh.test.ts`, Apple
  laptop, 2026-11-28): about 5 to 6 microseconds a frame, 9.5 cars drawn on average. A car is 1,772 triangles, so ten
  roads' cars are about 17,000 triangles in one draw (and one in the sun's shadow pass), against about 613,000 in the
  Company Campus scene.
- **In the browser** (ego lite, Company Campus with its street, the window in the background so frames were throttled):
  page scripts 15.1 ms a second with cars against 13.3 ms under reduced motion (no cars), inside the run-to-run noise.
  The cars never call `stir`, so a calm scene stays at 30 frames a second while they drive.
