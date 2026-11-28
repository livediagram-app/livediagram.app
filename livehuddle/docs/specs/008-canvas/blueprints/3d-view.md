# 3D view blueprint

Derived from [3D view](../3d-view.md). Defaults applied: D136 to D141, D143, D144 ([DEFAULTS.md](DEFAULTS.md)).

## Files

| File                                                                     | Role                                                                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `apps/editor/lib/space-3d/space-3d-camera.ts`                            | Pure: the camera's constants, `stageTransform`, `floorPointAt` (screen to canvas), `screenPointOf`            |
| `apps/editor/lib/space-3d/space-3d-walls.ts`                             | Pure: `spaceWalls(elements)`, the standing walls with their doorways, labels and shade                        |
| `apps/editor/lib/space-3d/space-3d-cutaway.ts`                           | Pure: `cutAwayIds(walls, feet)`, `viewArea`, `areaMovedFar`                                                   |
| `apps/editor/lib/space-3d/space-3d-pieces.ts`                            | Pure: `standsIn3D`, `standAttr`, `standingIdsInArea`, `seatLift`, `standingPiecePointAt`                      |
| `apps/editor/lib/space-3d/standing-pieces-on-screen.ts`                  | Reads the near standing pieces' boxes and screen rects for a press                                            |
| `apps/editor/components/canvas/space-3d/useStandingPieces.ts`            | Marks the standing pieces in the view area `data-space-near`, outside React                                   |
| `apps/editor/lib/space-3d/space-3d-zoom.ts`                              | Pure: `SPACE_3D_ZOOM`, `space3DZoomIn`, `space3DZoomOut`                                                      |
| `apps/editor/lib/space-3d/arrival-intro.ts`                              | Pure: the arrival's overview, `introPose`, `introStart`, `introWorthPlaying`; the `arrivalIntroPlaying` store |
| `apps/editor/hooks/canvas/useArrivalIntro.ts`                            | Runs the overview: jump out, hold, zoom in on rAF; any input stops it                                         |
| `apps/editor/lib/space-3d/space-3d-preference.ts`                        | `space3DTiltNow` / `setSpace3DTiltNow`: the tilt a walking press is traced back through                       |
| `apps/editor/lib/space-3d/space-3d-key.ts`                               | Pure: `space3DTurnKey(e)`, `[` and `]` by their code                                                          |
| `apps/editor/components/canvas/space-3d/useSpace3DView.ts`               | Always 3D; the stage's style, the tilt for a press, `[` / `]`, the lazy import                                |
| `apps/editor/lib/space-3d/space-3d-roofs.ts`                             | Pure: `spaceRoofs(elements)`, the rooms on grass that get a house roof, `roofOver`, `roofShape`               |
| `apps/editor/components/canvas/space-3d/Space3DWalls.tsx`                | Loaded on first use: the floor near the view, the walls' colour tokens, the standing pieces near the view     |
| `apps/editor/components/canvas/space-3d/Space3DTurnButtons.tsx`          | A phone's Turn Left and Turn Right in the cluster                                                             |
| `apps/editor/components/canvas/space-3d/Space3DOverlay.tsx`              | The overlay: a second stage over the first, `InSpace3DOverlay` (a moved host), `useInSpace3D`                 |
| `apps/editor/app/space-3d.css`                                           | The 3D rules: preserve-3d, the billboards, the fold, the fog, the hidden pattern                              |
| `apps/editor/components/canvas/Canvas.tsx`                               | The stage round the world layer; `scale: 1 1 zoom`; mounts the walls layer and the fog                        |
| `apps/editor/hooks/canvas/useCanvasSurfaceGestures.ts`                   | A walking press in 3D goes through `floorPointAt` instead of `pointerToCanvas`                                |
| `apps/editor/components/canvas/CanvasChrome.tsx`                         | The switch in the cluster, while walking, before the zoom controls                                            |
| `packages/avatar/src/components/AvatarWalker.tsx`                        | `data-avatar-stand` round the chips (no figure: the scene draws it), turned about the feet                    |
| `packages/avatar/src/components/AvatarSpeechLayer.tsx`                   | A bubble's anchor is a billboard about the speaker's feet                                                     |
| `apps/editor/components/calls/{CallBubbles,TalkingBars,RaisedHands}.tsx` | Each root is a billboard about its character's feet                                                           |
| `packages/avatar/src/billboard.ts`                                       | `SPACE_BILLBOARD_ATTR` and `billboardOrigin(dx, dy, x, y)`, the feet as a billboard's origin                  |
| `apps/editor/components/canvas/receptionist/ReceptionistBubble.tsx`      | A billboard about his feet; never flips under his feet in 3D                                                  |
| `apps/editor/lib/editor-deferred-code.ts`                                | `loadSpace3DWalls`, the walls layer's lazy chunk                                                              |
| `apps/editor/components/dialogs/shortcut-sections.ts`                    | `[` `]` "Turn the camera" under "While walking"                                                               |

## Domain and naming

| Term           | Identifier             | Meaning                                                                                                                                                                                         |
| -------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3D view        | `Space3D`              | The tilted view of a Space, in Edit and Walk                                                                                                                                                    |
| Stage          | `data-space-stage`     | The element round the world layer that carries the camera's tilt and perspective                                                                                                                |
| Standing wall  | `SpaceWall`            | `{ id, a, b, kind, height, label?, shade }`, a wall face on the floor line from `a` to `b`                                                                                                      |
| Wall kind      | `SpaceWallKind`        | `wall` (Room, Corridor, Office Pod), `glass`, `fence`, `picket` (a Garden Fence), `doorway` (a Door's frame and lintel; its leaves are `scene-doors.ts`'s), `grass` (a row of blades on a lawn) |
| Standing piece | `data-space-stands`    | A Space piece's box that stands up in 3D: `base` (about its front edge) or `centre` (turned)                                                                                                    |
| Near           | `data-space-near`      | Set on the standing pieces in the view area; only these turn up                                                                                                                                 |
| Seat lift      | `--space-seat-lift`    | A sitter's nudge towards the camera, canvas px along the floor                                                                                                                                  |
| Billboard      | `data-space-billboard` | An element turned to face the camera about its character's feet                                                                                                                                 |
| View area      | `SpaceArea`            | The canvas rectangle whose walls are drawn                                                                                                                                                      |

Synonyms banned: "isometric", "orbit", "perspective mode", "3D mode" (it is a view, not a mode).

## Behaviour and state

1. The view is always 3D (the owner, 2026-11-27): nothing is stored, nothing switches it.
2. `useSpace3DView(walking)` sets `space3DShowing` and `space3DTiltNow` (52) on mount and clears them on unmount, and
   fetches the walls' code at once. It has no phases and returns nothing.
3. The canvas, always:
   - `<main data-space-view data-real-3d>`.
   - The stage's style (`space3DStageStyle(turn, tilt)`): `--space-tilt` is the tilt (`SPACE_3D_TILT_DEG` at rest),
     `--space-stand` is `-90deg`, `--space-turn` the turn; transform
     `perspective(SPACE_3D_PERSPECTIVE_PX) rotateX(var(--space-tilt))`.
   - The world layer's `scale: 1 1 <zoom>`, so standing things grow with the floor.
   - `space3DTiltNow` (a module value) is the tilt in degrees while the canvas is mounted, else 0: what a walking press
     unprojects with.
   - `Space3DWalls`, `Real3DLayer`, the fog and `Space3DOverlayStage` are mounted.
4. `Space3DWalls` draws no wall or roof (the 3D scene does, blueprints/3d-engine.md, cutting away the walls in front
   of your feet in its frame). It reads the view area from the viewport store and the canvas size: on mount and
   whenever `areaMovedFar` says the centre has moved three quarters of a screen or the zoom or size changed, it sets the
   area, and lays the tab's floor pattern (`data-space-floor`) over it. Its layer (`data-space-walls`) carries the
   walls' colour tokens (`wallColourVars`), which `Real3DLayer` reads for its wall palette.
   A Stage adds its four edges to `spaceWalls` as `stage` walls 20 px tall, and `standsRaised` lifts a character
   (`AvatarWalker`'s `raised`, `--space-raise`) or a near piece (`useStandingPieces`) whose foot is on it.
5. Standing pieces: BoxedElementView sets `data-space-stands={standAttr(el)}` on every element's box (absent for
   what lies flat). `Space3DWalls` calls `useStandingPieces(layer, elements, area)`, which, whenever the area or the
   board changes, sets `data-space-near` on the Office Pods (`standsInside3D`) in `standingIdsInArea` and clears it
   from the rest, and clears every one when the layer unmounts. Every other standing piece is the 3D scene's model,
   its box hidden under `[data-real-3d]`, so it is never stood up, raised or hung on a wall in the page. Under `[data-space-view]` the element plane is `preserve-3d`, and a near
   `base` box turns `rotate: x -tilt` about `50% 100%` (a `centre` box about its own origin), on the tilt's transition.
6. A walk's start is `useAvatarCamera`'s `centreAvatar`, which always lands at `SPACE_3D_ZOOM` (1.8). An arrival (a load,
   opening walking, a change of tab, travel; not a switch from Edit on the same tab) calls it with `arrive`, which
   first asks `useArrivalIntro.play(to, feet)`: under reduced motion, with no overview (`tabFitView` of the tab, passed
   in as `overview` by the editor's viewport slice) or when `introWorthPlaying(introStart(fit, to), to)` is false, it
   returns false and the view lands at once. Otherwise it sets the view to the overview, sets `arrivalIntroPlaying`,
   holds `INTRO_HOLD_MS`, then each frame sets `introPose(from, to, feet, size, k)`, `from` being the view as the hold
   ends, and lands exactly on `to`. `pointerdown`, `wheel`, `keydown`, `touchstart`
   and `gesturestart` on the window (capture) stop it where it is; so does anything that stops the entry's glide
   (leaving the mode, Fit, another arrival, unmounting). `Space3DWalls` skips its area check while
   `arrivalIntroPlaying` is set and checks again when it clears.
7. Sitters: CanvasCharactersLayer passes `seatLift={seatLift(piece, feet)}` to each seated walker (yours and every
   peer's; the piece looked up among the standing pieces by `seatedOn`). AvatarWalker writes it as
   `--space-seat-lift` on its box and its chip box; the stand's 3D rule appends
   `translateZ(var(--space-seat-lift) * sin(tilt))`.
8. A walking press in 3D first asks `standingPiecePointAt(standingPiecesOnScreen(main, elements), client)`: of the
   near boxes whose screen rect holds the press, the one with the lowest front edge, the press mapped back into its
   box (a turned one: its middle). Only when none holds it does the press go to `floorPointAt`.
9. `[` and `]` (`space3DTurnKey`) turn the camera in Edit and Walk, unless typing, a menu or a dialog holds the
   keyboard (the same guards as the avatar action keys).
10. On a phone, `Space3DTurnButtons` sit in the cluster; on a desktop the view dial's left and right turn.
11. A walking press, while `space3DTiltNow()` is not 0, maps the client point through `floorPointAt` with `<main>`'s
    rect and the view; a null (above the horizon) walks nowhere.
12. The overlay: the canvas draws `Space3DOverlayStage` after the stage and the fog, a
    second stage with the same style and a world layer moved by `useViewportTransform` as the canvas's is. Its node
    goes to `Space3DOverlayProvider` round the characters layer; `InSpace3DOverlay` draws the speech layer, talking
    bars, raised hands, call bubbles and the Receptionist's card into it (in place until the overlay's node has mounted, and outside a canvas). Being a separate 3D
    context painted after the world, nothing in it is ever sorted behind a wall; inside it each billboard stands about
    its feet under the same camera, so it lands over the same head. Each draws into a host of its own (`display: contents`) that moves between a slot in place and the overlay, never unmounted, so a half-typed message keeps its text, focus and caret and a bubble keeps floating.
    `ReceptionistBubble` reads `useInSpace3D()`: while true it never flips under his feet (with no room over his head it
    stands beside him once the view cannot pan to make it, blueprints/receptionist.md), it scales itself back by the camera's
    depth (`fit`) so it reads at its flat size, and it places itself again when it changes.
    `useFlatBillboards` keeps the overlay's text sharp (each card moved and scaled flat to where the camera stands it)
    in passes, a frame at a time, only while something moves (Work Tracker 1257, canvas-performance.md "A still Space
    does nothing"): a `MutationObserver` on the overlay's world (subtree, attributes and children: a card added, a
    speaker's feet moving, a pan or zoom, its own writes) and on the camera's attributes, and a `ResizeObserver` on the
    stage, wake it; a pass that moved a card, or ran while the camera has a running animation (a tilt or turn
    transition), asks for the next frame, and the first pass that does neither stops.

## Interfaces and contracts

- `stageTransform(): string` returns `perspective(1100px) rotateX(var(--space-tilt))`.
- `floorPointAt(client, rect, view, tiltDeg, perspective?) → { x, y } | null`: `rect` is `<main>`'s
  `{ left, top, width, height }`, `view` `{ zoom, offset }`. With `X`, `Y` the point from the rect's centre,
  `t` the tilt: `den = P cos t + Y sin t`; `den ≤ 1` is null; `fy = Y P / den`, `fx = X (P − fy sin t) / P`; the canvas
  point is `(fx / zoom + w / 2 − offset.x, fy / zoom + h / 2 − offset.y)`. At tilt 0 it equals `pointerToCanvas`.
- `screenPointOf(point, size, view, tiltDeg, perspective?)` is its inverse, for tests and the cut-away's checks.
- `spaceWalls(elements: readonly Element[]): SpaceWall[]`:
  - Doors: every `door` shape's `doorLine` (every door is a way through; none is stored shut).
  - A `room`: `roomWalls(el)` cut by every door (`cutByDoors`), kind `glass` when `isGlassRoom`, else `wall`.
  - A `corridor`: `corridorWalls(el)` cut by every door, kind `wall`. An `office-pod`: `podWalls(el)`, kind `wall`.
  - A `fence`: `fenceLine(el)`, kind `fence`; a `garden-fence`: `fenceLine(el)`, kind `picket`.
  - A `grass`: level rows from `x + 10` to `x + width − 10`, every `SPACE_GRASS_ROW` (22) from `y + 10` while
    `≤ y + height − 10`, kind `grass`, `SPACE_GRASS_HEIGHT` (7), each row less the x spans of every covering piece
    (`COVERS_GRASS`: room, corridor, office-pod, garden-path, rug, stage, pond, swimming-pool, car-park, stairs,
    avatar-pad) whose box holds its y. `cutAwayIds` never cuts a `grass` row.
  - A door whose line stands on one of those walls (`doorSpanOnWall` not null): its line, kind `doorway`, with its
    `doorId`, its `variant` (the door's type), `hinge` (the side the plan's leaf is hinged) and `glass` in a glass wall.
  - Each wall runs left to right (`a.x ≤ b.x`, or top to bottom when vertical), so its face fronts the camera.
  - `height`: `wall` and `glass` `SPACE_WALL_HEIGHT` (56), `fence` and `picket` `SPACE_FENCE_HEIGHT` (22), `door`
    `SPACE_DOOR_HEIGHT` (50). `shade`: `|sin angle|`, 0 facing the camera, 1 running away from it.
  - `label`: a Room's plain label on its back wall: of its walls running within 30 degrees of level, the longest of
    those nearest the top, after the doorway is cut.
  - Ids: `<element id>:<index>`, stable for a board that did not change.
- `cutDepth(height, tiltDeg = SPACE_3D_TILT_DEG)`: `height * WALL_RISE * tan(tiltDeg)`, the floor a wall hides
  behind it (tilt clamped to 0..89).
- `cutAwayIds(walls, feet, turn, rooms, tiltDeg = SPACE_3D_TILT_DEG): Set<string>`: a wall across the view is cut when
  some point of it lies within `SPACE_CUT_HALF_WIDTH` (72) of the feet across the view and between the feet and
  `cutDepth(wall.height, tiltDeg)` towards the camera (one box per wall height). The 3D layer passes the tilt now
  (`space3DTiltNow`). Null feet: none.
- `frontWallIds(walls, rooms, turn): ReadonlySet<string>`: every wall across the view (not grass, fence, picket) that is
  a room's own (`inRoomWall`) and nearer the camera than that room's middle. Memoised on the last (walls, rooms,
  turn). Editing (no character of yours) adds them all to the cut set each frame.
- `viewArea(view, size)`: centred on the canvas point at the screen's middle, `SPACE_AREA_SIDE` (1.5) screens to each
  side, `SPACE_AREA_AHEAD` (3) screens up and `SPACE_AREA_BEHIND` (1.5) down, in canvas px at the zoom.

## Data and persistence

- Nothing is stored; nothing reaches the document, the room or the server. The retired `livehuddle:v2:space-3d` key and
  the retired `rotateIn3D` and `real3D` preferences are never read; an old copy of them is left alone and changes
  nothing (preferences keep unknown keys, `lib/user-preferences.test.ts`).

## Errors and edge cases

- A press above the horizon: `floorPointAt` null, no walk.
- A board with no walls: the floor tilts, nothing stands.
- A wall of zero length: dropped.
- A room too small for its doorway: `roomWalls` decides, as for walking.
- Changing tab: the camera's turn and tilt go back to rest (`resetSpace3DTurn`); the view stays 3D.
- The chunk failing to load: the floor still tilts; no walls stand (Next's dynamic import logs it).

## Security and trust

- Read-only for everyone; a wall's label is the room's label as plain text (React text, never HTML).

## Performance and limits

- Per step: `cutAwayIds` over the drawn walls (a few dozen on Virtual Office's 30), attribute writes only on change.
- Per board change: `spaceWalls`, linear in elements times doors.
- Per pan or zoom: `areaMovedFar`, constant; a re-render of the walls layer only when it says so (any zoom change
  does, so the arrival's zoom in holds the area: one re-render as it starts and one as it ends, not one per frame).
- Layers: one per drawn wall plus the element plane and the characters; the element plane is flat.
- Bundle: the walls layer and its maths load with `next/dynamic` on first use; the stage, button and hook are small.

## Presentation and UX

- Turn buttons (phone): a `ClusterStrip` of two `ClusterPopoverSegment`s, Turn Left (`lucideRotateCcw`) and Turn Right
  (`lucideRotateCw`), hover descriptions naming `[` and `]`.
- The walls: plaster face `--space-wall` (light canvas `#ddd3c3`, dark `#b7ad9e`), shaded towards
  `--space-wall-shade` by `shade`; top edge 3 px `--space-wall-top` (light `#f2ede5`, dark `#d9d1c4`); a soft darker
  foot and a 4 px `--space-skirting` (`#a87548`) at the bottom. Glass: `rgb(186 230 253 / 0.28)` with a `rgb(224 242 254 / 0.9)` top edge. Fence: `FENCE_WOOD` rails and posts. Picket: white pickets (`--space-picket`, light `#ffffff`, dark `#e2e8f0`) every
  10 px on two rails. A Fence's and a Garden Fence's box carries `data-space-walled`, and `app/space-3d.css` hides it
  under `[data-space-view]`, so only the standing fence shows.
  Door: wood `#9a6a3f` (dark `#8a5d36`) with a lighter top edge. A label: 12 px, semibold, `--space-wall-ink`.
- A Room's flat label: BoxedElementView wraps it in `data-room-floor-label` (`display: contents`), and
  `app/space-3d.css` hides it under `[data-space-view]`, so only the back-wall sign shows.
- The fog: the top 20% of the canvas in its own background colour, masked from opaque through 35% at its middle to clear, faded in with the tilt.

## Accessibility

- Turn Left and Turn Right are buttons with the cluster's focus ring, reachable by Tab and F6 (Controls), and `[` / `]`.
  Reduced motion: transitions collapse (globals.css).
- The walls are `aria-hidden`; the board's own accessible tree is unchanged.

## Observability

- `Canvas · Used · Space3DTurn` on each quarter turn. No per-step events.

## Testing

| Rule                                                                            | Test                                                                                                |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| The projection and its inverse; tilt 0 is the flat map                          | `lib/space-3d/space-3d-camera.test.ts`                                                              |
| Walls of rooms, corridors, pods, fences; doors cut                              | `lib/space-3d/space-3d-walls.test.ts`                                                               |
| The cut-away rule, the view area and culling                                    | `lib/space-3d/space-3d-cutaway.test.ts`                                                             |
| The turn keys and the tilt now                                                  | `lib/space-3d/space-3d-state.test.ts`                                                               |
| The switch, the stage, the walls layer draws and cuts                           | `components/canvas/space-3d/space-3d.test.tsx`                                                      |
| The stand wraps the chips                                                       | `packages/avatar/src/components/AvatarWalker.stand.test.tsx`                                        |
| Which kinds stand, the near set, the seat lift, a press on a standing piece     | `lib/space-3d/space-3d-pieces.test.ts`                                                              |
| The near set toggled and cleared; the press reads rects                         | `components/canvas/space-3d/space-3d.test.tsx`                                                      |
| Upright pieces' boxes marked, floor and stickies not                            | `components/canvas/BoxedElementView.space-stands.test.tsx`                                          |
| A sitter's lift on its box and chip                                             | `packages/avatar/src/components/AvatarWalker.stand.test.tsx`                                        |
| The overlay draws bubbles over walls                                            | `components/canvas/space-3d/space-3d.test.tsx`                                                      |
| The Receptionist's card re-placed when 3D turns on                              | `components/canvas/receptionist/ReceptionistBubble.test.tsx`                                        |
| Which rooms get a roof, its pitch and cap, the roof over your feet              | `lib/space-3d/space-3d-roofs.test.ts`                                                               |
| The off-screen nudge counts the 3D view's floor                                 | `hooks/canvas/useOffscreenContent.test.tsx`                                                         |
| The arrival's overview: the path, its start, when it skips                      | `lib/space-3d/arrival-intro.test.ts`                                                                |
| The overview plays, input stops it, reduced motion and a small tab land at once | `hooks/canvas/useArrivalIntro.test.tsx`                                                             |
| Wall pieces snap to a wall face; templates' are on walls                        | `packages/document/src/wall-mounted.test.ts`, `packages/templates/src/template-wall-pieces.test.ts` |

## Constants and configuration

| Constant                  | Value       | Why                                                                                      |
| ------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| `SPACE_3D_TILT_DEG`       | 52          | A map tilted back: steep enough to stand walls, flat enough to see rooms                 |
| `SPACE_3D_PERSPECTIVE_PX` | 1100        | A gentle vanishing point on a laptop; a phone looks a little deeper                      |
| `SPACE_3D_TILT_MS`        | 520         | The camera's turn and stand-up ease (the motion spec's long transition)                  |
| `SPACE_WALL_HEIGHT`       | 56          | A character's height (`AVATAR_HEIGHT`)                                                   |
| `SPACE_FENCE_HEIGHT`      | 22          | Knee high on a character                                                                 |
| `SPACE_STAGE_LIFT`        | 20          | A step up a character reads as a stage, low enough not to hide feet behind it            |
| `SPACE_ROOF_PITCH`        | 0.7         | About 35 degrees, a house's pitch                                                        |
| `SPACE_ROOF_MAX_RISE`     | 150         | A hall's ridge stays near the walls rather than towering                                 |
| `SPACE_DOOR_HEIGHT`       | 50          | A shut Door reads below its wall                                                         |
| `SPACE_SEAT_LIFT_SHARE`   | 0.6         | A chair's, a sofa's and a table's near seats; not a desk's or a chair's back view (D144) |
| `SPACE_CUT_HALF_WIDTH`    | 72          | Wider than a character and its chip                                                      |
| `SPACE_CUT_DEPTH`         | ~233        | `cutDepth(SPACE_WALL_HEIGHT)`: 152 x 1.2 x tan 52deg, a Room wall's hidden floor         |
| `SPACE_CUT_OPACITY`       | 0.18        | A ghost you can still place                                                              |
| `SPACE_AREA_*`            | 1.5, 3, 1.5 | Covers the tilted view's floor with room to walk before a re-cull                        |
| `INTRO_HOLD_MS`           | 500         | The owner's half a second on the whole Space                                             |
| `INTRO_ZOOM_MS`           | 1400        | Slow enough to follow where you are, short enough not to wait on                         |
| `INTRO_MIN_RATIO`         | 1.25        | Less than a quarter closer shows nothing the arrival does not                            |

## Editing in 3D and the view dial (2026-11-26)

| Path                                                                          | What it does                                                                                                                                                                          |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/editor/lib/space-3d/floor-pointer.ts`                                   | The tilted view's pointer-to-floor slot: `setFloorPointer`, `floorPointer`                                                                                                            |
| `apps/editor/components/canvas/space-3d/useFloorPointer.ts`                   | Sets the slot while the view stands, through `floorPointAt` with the tilt, turn, zoom and pan                                                                                         |
| `apps/editor/lib/canvas.ts`                                                   | `pointerToCanvas` reads the floor point while tilted; `pointerDelta` for drags                                                                                                        |
| `apps/editor/hooks/canvas/useEditorDrag.ts`                                   | Moves by `pointerDelta`, so a dragged piece follows the pointer on the floor                                                                                                          |
| `apps/editor/components/canvas/real-3d/useScenePresses.ts`                    | Editing in Real 3D: a press on a model is handed to its piece's element                                                                                                               |
| `apps/editor/components/canvas/real-3d/selection-marks.ts`                    | The selected pieces' model boxes drawn in the selection colour                                                                                                                        |
| `apps/editor/lib/real-3d/real-3d-pick.ts`                                     | Also `real3DPieceAt`, the piece id under a press                                                                                                                                      |
| `apps/editor/lib/space-3d/right-turn-drag.ts`                                 | `attachRightTurn`: a mouse right-drag turns the camera freely (240 px a quarter) and tilts it (4 px a degree, `setTilt`), the context menu held until the release; `rightPressTurned` |
| `apps/editor/lib/space-3d/space-3d-turn.ts` (`space3DTilt`, `setSpace3DTilt`) | The camera's tilt, held within `SPACE_3D_TILT_RANGE`, back to 52° with the turn on a new tab                                                                                          |
| `apps/editor/hooks/canvas/useCanvasSurfaceGestures.ts` (`walkPointAt`)        | In Real 3D a walking press takes the scene's answer (`real3DPointAt`) before the doorways' screen boxes                                                                               |
| `apps/editor/lib/space-3d/fence-snap.ts`                                      | `snapFenceToGrass`: a fence tapped or dropped by a lawn's side fences that whole side (fence.md)                                                                                      |
| `apps/editor/components/chrome/ViewDial.tsx`                                  | The view dial: zoom up and down (step, hold, wheel, drag), turn left and right, the zoom menu in the middle                                                                           |
| `apps/editor/components/canvas/CanvasChrome.tsx`                              | The dial over the corner row on a desktop; the 3D switch in Edit too; Turn buttons only on a phone                                                                                    |
