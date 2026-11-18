# 3D view blueprint

Derived from [3D view](../3d-view.md). Defaults applied: D136 to D141, D143, D144 ([DEFAULTS.md](DEFAULTS.md)).

## Files

| File                                                                     | Role                                                                                                           |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `apps/editor/lib/space-3d/space-3d-camera.ts`                            | Pure: the camera's constants, `stageTransform`, `floorPointAt` (screen to canvas), `screenPointOf`             |
| `apps/editor/lib/space-3d/space-3d-walls.ts`                             | Pure: `spaceWalls(elements)`, the standing walls with their doorways, labels and shade                         |
| `apps/editor/lib/space-3d/space-3d-cutaway.ts`                           | Pure: `cutAwayIds(walls, feet)`, `viewArea`, `wallsInArea`, `areaMovedFar`                                     |
| `apps/editor/lib/space-3d/space-3d-pieces.ts`                            | Pure: `standsIn3D`, `standAttr`, `standingIdsInArea`, `seatLift`, `standingPiecePointAt`                       |
| `apps/editor/lib/space-3d/standing-pieces-on-screen.ts`                  | Reads the near standing pieces' boxes and screen rects for a press                                             |
| `apps/editor/components/canvas/space-3d/useStandingPieces.ts`            | Marks the standing pieces in the view area `data-space-near`, outside React                                    |
| `apps/editor/lib/space-3d/space-3d-zoom.ts`                              | Pure: `SPACE_3D_ZOOM`, `space3DZoomIn`, `space3DZoomOut`                                                       |
| `apps/editor/components/canvas/space-3d/useSpace3DZoom.ts`               | Zooms in as the view stands up and back out as it lies down                                                    |
| `apps/editor/lib/space-3d/space-3d-preference.ts`                        | The remembered choice: `space3DPreference` (a state store over Browser Storage), `toggleSpace3D`               |
| `apps/editor/lib/space-3d/space-3d-phase.ts`                             | Pure: the view's phases and `nextSpace3DPhase`                                                                 |
| `apps/editor/lib/space-3d/space-3d-key.ts`                               | Pure: `isSpace3DKey(e)`, Shift+3 by its code                                                                   |
| `apps/editor/components/canvas/space-3d/useSpace3DView.ts`               | The phase machine, the stage's style, the main's attribute, Shift+3, the lazy import                           |
| `apps/editor/lib/space-3d/space-3d-roofs.ts`                             | Pure: `spaceRoofs(elements)`, the rooms on grass that get a house roof, `roofOver`, `roofShape`                |
| `apps/editor/components/canvas/space-3d/Space3DRoofs.tsx`                | Draws the roofs near the view on the wall tops; marks the one over your feet `data-inside` from the pose store |
| `apps/editor/components/canvas/space-3d/Space3DWalls.tsx`                | Loaded on first use: draws the walls near the view and cuts away the ones in front of your feet                |
| `apps/editor/components/canvas/space-3d/Space3DButton.tsx`               | The cluster's 3D View switch                                                                                   |
| `apps/editor/components/canvas/space-3d/Space3DOverlay.tsx`              | The overlay: a second stage over the first, `InSpace3DOverlay` (a moved host), `useInSpace3D`                  |
| `apps/editor/app/space-3d.css`                                           | The 3D rules: preserve-3d, the billboards, the walls' faces, the fold, the fog, the hidden pattern             |
| `apps/editor/components/canvas/Canvas.tsx`                               | The stage round the world layer; `scale: 1 1 zoom`; mounts the walls layer and the fog                         |
| `apps/editor/hooks/canvas/useCanvasSurfaceGestures.ts`                   | A walking press in 3D goes through `floorPointAt` instead of `pointerToCanvas`                                 |
| `apps/editor/components/canvas/CanvasChrome.tsx`                         | The switch in the cluster, while walking, before the zoom controls                                             |
| `packages/avatar/src/components/AvatarWalker.tsx`                        | `data-avatar-stand` round the figure and the spread chip, turned about the feet                                |
| `packages/avatar/src/components/AvatarSpeechLayer.tsx`                   | A bubble's anchor is a billboard about the speaker's feet                                                      |
| `apps/editor/components/calls/{CallBubbles,TalkingBars,RaisedHands}.tsx` | Each root is a billboard about its character's feet                                                            |
| `packages/avatar/src/billboard.ts`                                       | `SPACE_BILLBOARD_ATTR` and `billboardOrigin(dx, dy, x, y)`, the feet as a billboard's origin                   |
| `apps/editor/components/canvas/receptionist/ReceptionistBubble.tsx`      | A billboard about his feet; never flips under his feet in 3D                                                   |
| `apps/editor/lib/editor-deferred-code.ts`                                | `loadSpace3DWalls`, the walls layer's lazy chunk                                                               |
| `apps/editor/components/dialogs/shortcut-sections.ts`                    | Shift+3 under "While walking"                                                                                  |

## Domain and naming

| Term           | Identifier             | Meaning                                                                                                                                             |
| -------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3D view        | `Space3D`              | The tilted view of a Space while walking                                                                                                            |
| Stage          | `data-space-stage`     | The element round the world layer that carries the camera's tilt and perspective                                                                    |
| Phase          | `Space3DPhase`         | `flat`, `rising`, `tilted` or `falling`                                                                                                             |
| Standing wall  | `SpaceWall`            | `{ id, a, b, kind, height, label?, shade }`, a wall face on the floor line from `a` to `b`                                                          |
| Wall kind      | `SpaceWallKind`        | `wall` (Room, Corridor, Office Pod), `glass`, `fence`, `picket` (a Garden Fence), `door` (a shut Door's panel), `grass` (a row of blades on a lawn) |
| Standing piece | `data-space-stands`    | A Space piece's box that stands up in 3D: `base` (about its front edge) or `centre` (turned)                                                        |
| Near           | `data-space-near`      | Set on the standing pieces in the view area; only these turn up                                                                                     |
| Seat lift      | `--space-seat-lift`    | A sitter's nudge towards the camera, canvas px along the floor                                                                                      |
| Billboard      | `data-space-billboard` | An element turned to face the camera about its character's feet                                                                                     |
| Cut away       | `data-cut`             | A wall faded because it stands in front of your feet                                                                                                |
| View area      | `SpaceArea`            | The canvas rectangle whose walls are drawn                                                                                                          |

Synonyms banned: "isometric", "orbit", "perspective mode", "3D mode" (it is a view, not a mode).

## Behaviour and state

1. `space3DPreference` holds a boolean, read once from `livehuddle:v2:space-3d` (`'1'` on, anything else off) when
   the module first loads in a browser. `toggleSpace3D()` tracks `Canvas · Used · Space3DView` when it turns the
   view on (before writing), writes `'1'` or `'0'`, and sets the store.
2. `useSpace3DView(walking)` wants the view when `walking && preference`. The phase moves by `nextSpace3DPhase`:
   - `flat` + want: `rising` (`tilted` at once under reduced motion).
   - `rising`: after two animation frames, `tilted`; not wanted any more: `flat`.
   - `tilted` + not wanted: `falling` (`flat` at once under reduced motion).
   - `falling`: after `SPACE_3D_TILT_MS`, `flat`; wanted again: `tilted`.
3. The phase drives:
   - `<main data-space-view={phase}>` for every phase but `flat`.
   - The stage's style: `--space-tilt` is `SPACE_3D_TILT_DEG` in `tilted`, else `0deg`; `--space-stand` is `-90deg` in
     `tilted`, else `0deg`; transform `perspective(SPACE_3D_PERSPECTIVE_PX) rotateX(var(--space-tilt))` in every phase
     but `flat`, where the stage has no transform.
   - The world layer's `scale: 1 1 <zoom>` in every phase but `flat`, so standing things grow with the floor.
   - `space3DTiltNow` (a module value) is the tilt in degrees for `tilted` and `rising`, else 0: what a walking press
     unprojects with.
   - `Space3DWalls` is mounted in every phase but `flat`.
4. `Space3DWalls` builds `spaceWalls(elements)` once per board change (`useMemo`). It reads the view area from the
   viewport store and the canvas size: on mount and whenever `areaMovedFar` says the centre has moved three quarters of a
   screen or the zoom or size changed, it sets the area, and draws `wallsInArea(walls, area)`. It subscribes to your
   pose store: on each pose it works out `cutAwayIds(drawn, feet)` and toggles `data-cut` on the walls whose state
   changed, outside React. It also builds `spaceRoofs(elements)` and draws `Space3DRoofs` over the walls: two slopes
   and two hip ends per roof, ghosted, the roof over your feet hidden by `data-inside`, toggled outside React.
   A Stage adds its four edges to `spaceWalls` as `stage` walls 20 px tall, and `standsRaised` lifts a character
   (`AvatarWalker`'s `raised`, `--space-raise`) or a near piece (`useStandingPieces`) whose foot is on it.
5. Standing pieces: BoxedElementView sets `data-space-stands={standAttr(el)}` on every element's box (absent for
   what lies flat). `Space3DWalls` calls `useStandingPieces(layer, elements, area)`, which, whenever the area or the
   board changes, sets `data-space-near` on the boxes in `standingIdsInArea` and clears it from the rest, and clears
   every one when the layer unmounts. Under `[data-space-view]` the element plane is `preserve-3d`, and a near
   `base` box turns `rotate: x -tilt` about `50% 100%` (a `centre` box about its own origin), on the tilt's transition.
6. `useSpace3DZoom(walking, zoom, setZoom)` (in Canvas): when the preference turns on while walking it sets the zoom
   to `space3DZoomIn(zoom)` (× `SPACE_3D_ZOOM` 1.4, clamped) and remembers `{ from, to }`; off while walking, it sets
   `space3DZoomOut(zoom, entered)`: `from` when the zoom is still `to`, else ÷ 1.4, clamped. A walk's start is
   `useAvatarCamera`'s `centreAvatar`, which lands at `SPACE_3D_ZOOM` while the preference is on, else 1.
7. Sitters: CanvasCharactersLayer passes `seatLift={seatLift(piece, feet)}` to each seated walker (yours and every
   peer's; the piece looked up among the standing pieces by `seatedOn`). AvatarWalker writes it as
   `--space-seat-lift` on its box and its chip box; the stand's 3D rule appends
   `translateZ(var(--space-seat-lift) * sin(tilt))`, which is 0 while flat.
8. A walking press in 3D first asks `standingPiecePointAt(standingPiecesOnScreen(main, elements), client)`: of the
   near boxes whose screen rect holds the press, the one with the lowest front edge, the press mapped back into its
   box (a turned one: its middle). Only when none holds it does the press go to `floorPointAt`.
9. Shift+3 (`isSpace3DKey`) toggles the preference while walking, unless typing, a menu or a dialog holds the
   keyboard (the same guards as the avatar action keys).
10. The 3D View switch is drawn while walking, `aria-pressed` from the preference, and toggles it.
11. A walking press, while `space3DTiltNow()` is not 0, maps the client point through `floorPointAt` with `<main>`'s
    rect and the view; a null (above the horizon) walks nowhere.
12. The overlay: in every phase but `flat` the canvas draws `Space3DOverlayStage` after the stage and the fog, a
    second stage with the same style and a world layer moved by `useViewportTransform` as the canvas's is. Its node
    goes to `Space3DOverlayProvider` round the characters layer; `InSpace3DOverlay` draws the speech layer, talking
    bars, raised hands, call bubbles and the Receptionist's card into it (in place while flat). Being a separate 3D
    context painted after the world, nothing in it is ever sorted behind a wall; inside it each billboard stands about
    its feet under the same camera, so it lands over the same head. Each draws into a host of its own (`display: contents`) that moves between a slot in place and the overlay, never unmounted, so a half-typed message keeps its text, focus and caret and a bubble keeps floating.
    `ReceptionistBubble` reads `useInSpace3D()`: while true it never flips under his feet, and it places itself again
    when it changes.

## Interfaces and contracts

- `stageTransform(): string` returns `perspective(1100px) rotateX(var(--space-tilt))`.
- `floorPointAt(client, rect, view, tiltDeg, perspective?) → { x, y } | null`: `rect` is `<main>`'s
  `{ left, top, width, height }`, `view` `{ zoom, offset }`. With `X`, `Y` the point from the rect's centre,
  `t` the tilt: `den = P cos t + Y sin t`; `den ≤ 1` is null; `fy = Y P / den`, `fx = X (P − fy sin t) / P`; the canvas
  point is `(fx / zoom + w / 2 − offset.x, fy / zoom + h / 2 − offset.y)`. At tilt 0 it equals `pointerToCanvas`.
- `screenPointOf(point, size, view, tiltDeg, perspective?)` is its inverse, for tests and the cut-away's checks.
- `spaceWalls(elements: readonly Element[]): SpaceWall[]`:
  - Doors: every `door` shape's `doorLine`, shut (`doorClosed === true`) or open.
  - A `room`: `roomWalls(el)` cut by every door (`cutByDoors`), kind `glass` when `isGlassRoom`, else `wall`.
  - A `corridor`: `corridorWalls(el)` cut by every door, kind `wall`. An `office-pod`: `podWalls(el)`, kind `wall`.
  - A `fence`: `fenceLine(el)`, kind `fence`; a `garden-fence`: `fenceLine(el)`, kind `picket`.
  - A `grass`: level rows from `x + 10` to `x + width − 10`, every `SPACE_GRASS_ROW` (22) from `y + 10` while
    `≤ y + height − 10`, kind `grass`, `SPACE_GRASS_HEIGHT` (7), each row less the x spans of every covering piece
    (`COVERS_GRASS`: room, corridor, office-pod, garden-path, rug, stage, pond, swimming-pool, car-park, stairs,
    avatar-pad) whose box holds its y. `cutAwayIds` never cuts a `grass` row.
  - A shut door whose line stands on one of those walls (`doorSpanOnWall` not null): its line, kind `door`.
  - Each wall runs left to right (`a.x ≤ b.x`, or top to bottom when vertical), so its face fronts the camera.
  - `height`: `wall` and `glass` `SPACE_WALL_HEIGHT` (56), `fence` and `picket` `SPACE_FENCE_HEIGHT` (22), `door`
    `SPACE_DOOR_HEIGHT` (50). `shade`: `|sin angle|`, 0 facing the camera, 1 running away from it.
  - `label`: a Room's plain label on its back wall: of its walls running within 30 degrees of level, the longest of
    those nearest the top, after the doorway is cut.
  - Ids: `<element id>:<index>`, stable for a board that did not change.
- `cutAwayIds(walls, feet): Set<string>`: a wall is cut when some point of it lies within `SPACE_CUT_HALF_WIDTH` (72)
  of `feet.x` and between `feet.y` and `feet.y + SPACE_CUT_DEPTH` (150). Null feet: none.
- `viewArea(view, size)`: centred on the canvas point at the screen's middle, `SPACE_AREA_SIDE` (1.5) screens to each
  side, `SPACE_AREA_AHEAD` (3) screens up and `SPACE_AREA_BEHIND` (1.5) down, in canvas px at the zoom.
- `wallsInArea(walls, area)`: the walls whose bounding box meets it.

## Data and persistence

- One Browser Storage key, `livehuddle:v2:space-3d`, `'1'` or `'0'`, this browser only, never synced. Missing or
  unreadable (private mode): off. Nothing else is stored; nothing reaches the document, the room or the server.

## Errors and edge cases

- A press above the horizon: `floorPointAt` null, no walk.
- A board with no walls: the floor tilts, nothing stands.
- A wall of zero length: dropped.
- A room too small for its doorway: `roomWalls` decides, as for walking.
- Leaving Walk mid-rise: `rising` goes straight to `flat`; mid-fall and back: `falling` returns to `tilted`.
- Changing tab: the walk ends, so the view flattens; travel keeps walking, so it stays tilted.
- The chunk failing to load: the floor still tilts; no walls stand (Next's dynamic import logs it).

## Security and trust

- Read-only for everyone; a wall's label is the room's label as plain text (React text, never HTML).

## Performance and limits

- Per step: `cutAwayIds` over the drawn walls (a few dozen on Virtual Office's 30), attribute writes only on change.
- Per board change: `spaceWalls`, linear in elements times doors.
- Per pan or zoom: `areaMovedFar`, constant; a re-render of the walls layer only when it says so.
- Layers: one per drawn wall plus the element plane and the characters; the element plane is flat.
- Bundle: the walls layer and its maths load with `next/dynamic` on first use; the stage, button and hook are small.

## Presentation and UX

- The switch: `ClusterPopoverButton` with `toggle`, label and hover title "3D View", description "Tilt the Space back
  and stand its walls up. Shift+3.", name "3D", the `Space3DGlyph` icon (a floor in perspective with two walls).
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

- The switch is a button with `aria-pressed` and a visible focus ring (the cluster's), reachable by Tab and F6
  (Controls), and Shift+3. Reduced motion: the phases skip `rising` and `falling`; transitions collapse (globals.css).
- The walls are `aria-hidden`; the board's own accessible tree is unchanged.

## Observability

- `Canvas · Used · Space3DView` when someone turns it on (the button or Shift+3). No per-step events.

## Testing

| Rule                                                                        | Test                                                                                                |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| The projection and its inverse; tilt 0 is the flat map                      | `lib/space-3d/space-3d-camera.test.ts`                                                              |
| Walls of rooms, corridors, pods, fences; doors cut                          | `lib/space-3d/space-3d-walls.test.ts`                                                               |
| The cut-away rule, the view area and culling                                | `lib/space-3d/space-3d-cutaway.test.ts`                                                             |
| Phases, reduced motion, Shift+3, the stored choice                          | `lib/space-3d/space-3d-state.test.ts`                                                               |
| The switch, the stage, the walls layer draws and cuts                       | `components/canvas/space-3d/space-3d.test.tsx`                                                      |
| The stand wraps the figure                                                  | `packages/avatar/src/components/AvatarWalker.stand.test.tsx`                                        |
| Which kinds stand, the near set, the seat lift, a press on a standing piece | `lib/space-3d/space-3d-pieces.test.ts`                                                              |
| The near set toggled and cleared; the press reads rects                     | `components/canvas/space-3d/space-3d.test.tsx`                                                      |
| Upright pieces' boxes marked, floor and stickies not                        | `components/canvas/BoxedElementView.space-stands.test.tsx`                                          |
| A sitter's lift on its box and chip                                         | `packages/avatar/src/components/AvatarWalker.stand.test.tsx`                                        |
| The overlay draws bubbles over walls                                        | `components/canvas/space-3d/space-3d.test.tsx`                                                      |
| The Receptionist's card re-placed when 3D turns on                          | `components/canvas/receptionist/ReceptionistBubble.test.tsx`                                        |
| Which rooms get a roof, its pitch and cap, the roof over your feet          | `lib/space-3d/space-3d-roofs.test.ts`                                                               |
| The off-screen nudge counts the 3D view's floor                             | `hooks/canvas/useOffscreenContent.test.tsx`                                                         |
| Wall pieces snap to a wall face; templates' are on walls                    | `packages/document/src/wall-mounted.test.ts`, `packages/templates/src/template-wall-pieces.test.ts` |

## Constants and configuration

| Constant                  | Value       | Why                                                                                      |
| ------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| `SPACE_3D_TILT_DEG`       | 52          | A map tilted back: steep enough to stand walls, flat enough to see rooms                 |
| `SPACE_3D_PERSPECTIVE_PX` | 1100        | A gentle vanishing point on a laptop; a phone looks a little deeper                      |
| `SPACE_3D_TILT_MS`        | 520         | The tilt's duration (the motion spec's long transition)                                  |
| `SPACE_WALL_HEIGHT`       | 56          | A character's height (`AVATAR_HEIGHT`)                                                   |
| `SPACE_FENCE_HEIGHT`      | 22          | Knee high on a character                                                                 |
| `SPACE_STAGE_LIFT`        | 20          | A step up a character reads as a stage, low enough not to hide feet behind it            |
| `SPACE_ROOF_PITCH`        | 0.7         | About 35 degrees, a house's pitch                                                        |
| `SPACE_ROOF_MAX_RISE`     | 150         | A hall's ridge stays near the walls rather than towering                                 |
| `SPACE_DOOR_HEIGHT`       | 50          | A shut Door reads below its wall                                                         |
| `SPACE_SEAT_LIFT_SHARE`   | 0.6         | A chair's, a sofa's and a table's near seats; not a desk's or a chair's back view (D144) |
| `SPACE_CUT_HALF_WIDTH`    | 72          | Wider than a character and its chip                                                      |
| `SPACE_CUT_DEPTH`         | 150         | A wall's height seen at the tilt, with the character's own height                        |
| `SPACE_CUT_OPACITY`       | 0.18        | A ghost you can still place                                                              |
| `SPACE_AREA_*`            | 1.5, 3, 1.5 | Covers the tilted view's floor with room to walk before a re-cull                        |
