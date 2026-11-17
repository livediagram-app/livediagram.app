# 3D view blueprint

Derived from [3D view](../3d-view.md). Defaults applied: D136 to D141 ([DEFAULTS.md](DEFAULTS.md)).

## Files

| File                                                                     | Role                                                                                               |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `apps/editor/lib/space-3d/space-3d-camera.ts`                            | Pure: the camera's constants, `stageTransform`, `floorPointAt` (screen to canvas), `screenPointOf` |
| `apps/editor/lib/space-3d/space-3d-walls.ts`                             | Pure: `spaceWalls(elements)`, the standing walls with their doorways, labels and shade             |
| `apps/editor/lib/space-3d/space-3d-cutaway.ts`                           | Pure: `cutAwayIds(walls, feet)`, `viewArea`, `wallsInArea`, `areaMovedFar`                         |
| `apps/editor/lib/space-3d/space-3d-preference.ts`                        | The remembered choice: `space3DPreference` (a state store over Browser Storage), `toggleSpace3D`   |
| `apps/editor/lib/space-3d/space-3d-phase.ts`                             | Pure: the view's phases and `nextSpace3DPhase`                                                     |
| `apps/editor/lib/space-3d/space-3d-key.ts`                               | Pure: `isSpace3DKey(e)`, Shift+3 by its code                                                       |
| `apps/editor/components/canvas/space-3d/useSpace3DView.ts`               | The phase machine, the stage's style, the main's attribute, Shift+3, the lazy import               |
| `apps/editor/components/canvas/space-3d/Space3DWalls.tsx`                | Loaded on first use: draws the walls near the view and cuts away the ones in front of your feet    |
| `apps/editor/components/canvas/space-3d/Space3DButton.tsx`               | The cluster's 3D View switch                                                                       |
| `apps/editor/app/space-3d.css`                                           | The 3D rules: preserve-3d, the billboards, the walls' faces, the fold, the fog, the hidden pattern |
| `apps/editor/components/canvas/Canvas.tsx`                               | The stage round the world layer; `scale: 1 1 zoom`; mounts the walls layer and the fog             |
| `apps/editor/hooks/canvas/useCanvasSurfaceGestures.ts`                   | A walking press in 3D goes through `floorPointAt` instead of `pointerToCanvas`                     |
| `apps/editor/components/canvas/CanvasChrome.tsx`                         | The switch in the cluster, while walking, before the zoom controls                                 |
| `packages/avatar/src/components/AvatarWalker.tsx`                        | `data-avatar-stand` round the figure and the spread chip, turned about the feet                    |
| `packages/avatar/src/components/AvatarSpeechLayer.tsx`                   | A bubble's anchor is a billboard about the speaker's feet                                          |
| `apps/editor/components/calls/{CallBubbles,TalkingBars,RaisedHands}.tsx` | Each root is a billboard about its character's feet                                                |
| `packages/avatar/src/billboard.ts`                                       | `SPACE_BILLBOARD_ATTR` and `billboardOrigin(dx, dy, x, y)`, the feet as a billboard's origin       |
| `apps/editor/components/canvas/receptionist/ReceptionistBubble.tsx`      | A billboard about his feet; never flips under his feet in 3D                                       |
| `apps/editor/lib/editor-deferred-code.ts`                                | `loadSpace3DWalls`, the walls layer's lazy chunk                                                   |
| `apps/editor/components/dialogs/shortcut-sections.ts`                    | Shift+3 under "While walking"                                                                      |

## Domain and naming

| Term          | Identifier             | Meaning                                                                                    |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| 3D view       | `Space3D`              | The tilted view of a Space while walking                                                   |
| Stage         | `data-space-stage`     | The element round the world layer that carries the camera's tilt and perspective           |
| Phase         | `Space3DPhase`         | `flat`, `rising`, `tilted` or `falling`                                                    |
| Standing wall | `SpaceWall`            | `{ id, a, b, kind, height, label?, shade }`, a wall face on the floor line from `a` to `b` |
| Wall kind     | `SpaceWallKind`        | `wall` (Room, Corridor, Office Pod), `glass`, `fence`, `door` (a shut Door's panel)        |
| Billboard     | `data-space-billboard` | An element turned to face the camera about its character's feet                            |
| Cut away      | `data-cut`             | A wall faded because it stands in front of your feet                                       |
| View area     | `SpaceArea`            | The canvas rectangle whose walls are drawn                                                 |

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
   changed, outside React.
5. Shift+3 (`isSpace3DKey`) toggles the preference while walking, unless typing, a menu or a dialog holds the
   keyboard (the same guards as the avatar action keys).
6. The 3D View switch is drawn while walking, `aria-pressed` from the preference, and toggles it.
7. A walking press, while `space3DTiltNow()` is not 0, maps the client point through `floorPointAt` with `<main>`'s
   rect and the view; a null (above the horizon) walks nowhere.

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
  - A `fence` or `garden-fence`: `fenceLine(el)`, kind `fence`.
  - A shut door whose line stands on one of those walls (`doorSpanOnWall` not null): its line, kind `door`.
  - Each wall runs left to right (`a.x ≤ b.x`, or top to bottom when vertical), so its face fronts the camera.
  - `height`: `wall` and `glass` `SPACE_WALL_HEIGHT` (56), `fence` `SPACE_FENCE_HEIGHT` (22), `door`
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
- The walls: face colour `--space-wall` (light canvas `#e7e5e4`, dark `#475569`), shaded towards
  `--space-wall-shade` by `shade`; top edge 3 px `--space-wall-top` (light `#ffffff`, dark `#94a3b8`); a soft darker
  foot. Glass: `rgb(186 230 253 / 0.28)` with a `rgb(224 242 254 / 0.9)` top edge. Fence: `FENCE_WOOD` rails and posts.
  Door: wood `#a16207` (dark `#ca8a04`) with a lighter top edge. A label: 12 px, semibold, `--space-wall-ink`.
- A Room's flat label: BoxedElementView wraps it in `data-room-floor-label` (`display: contents`), and
  `app/space-3d.css` hides it under `[data-space-view]`, so only the back-wall sign shows.
- The fog: the top 36% of the canvas in its own background colour, masked from opaque to clear, faded in with the tilt.

## Accessibility

- The switch is a button with `aria-pressed` and a visible focus ring (the cluster's), reachable by Tab and F6
  (Controls), and Shift+3. Reduced motion: the phases skip `rising` and `falling`; transitions collapse (globals.css).
- The walls are `aria-hidden`; the board's own accessible tree is unchanged.

## Observability

- `Canvas · Used · Space3DView` when someone turns it on (the button or Shift+3). No per-step events.

## Testing

| Rule                                                   | Test                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| The projection and its inverse; tilt 0 is the flat map | `lib/space-3d/space-3d-camera.test.ts`                       |
| Walls of rooms, corridors, pods, fences; doors cut     | `lib/space-3d/space-3d-walls.test.ts`                        |
| The cut-away rule, the view area and culling           | `lib/space-3d/space-3d-cutaway.test.ts`                      |
| Phases, reduced motion, Shift+3, the stored choice     | `lib/space-3d/space-3d-state.test.ts`                        |
| The switch, the stage, the walls layer draws and cuts  | `components/canvas/space-3d/space-3d.test.tsx`               |
| The stand wraps the figure                             | `packages/avatar/src/components/AvatarWalker.stand.test.tsx` |

## Constants and configuration

| Constant                  | Value       | Why                                                                      |
| ------------------------- | ----------- | ------------------------------------------------------------------------ |
| `SPACE_3D_TILT_DEG`       | 52          | A map tilted back: steep enough to stand walls, flat enough to see rooms |
| `SPACE_3D_PERSPECTIVE_PX` | 1100        | A gentle vanishing point on a laptop; a phone looks a little deeper      |
| `SPACE_3D_TILT_MS`        | 520         | The tilt's duration (the motion spec's long transition)                  |
| `SPACE_WALL_HEIGHT`       | 56          | A character's height (`AVATAR_HEIGHT`)                                   |
| `SPACE_FENCE_HEIGHT`      | 22          | Knee high on a character                                                 |
| `SPACE_DOOR_HEIGHT`       | 50          | A shut Door reads below its wall                                         |
| `SPACE_CUT_HALF_WIDTH`    | 72          | Wider than a character and its chip                                      |
| `SPACE_CUT_DEPTH`         | 150         | A wall's height seen at the tilt, with the character's own height        |
| `SPACE_CUT_OPACITY`       | 0.18        | A ghost you can still place                                              |
| `SPACE_AREA_*`            | 1.5, 3, 1.5 | Covers the tilted view's floor with room to walk before a re-cull        |
