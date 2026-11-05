# Directory and Elevator: blueprint

Derived from [Directory](../directory.md) and [Elevator](../elevator.md). The spec decides; this file only adds
engineering precision.

Scope, by file:

| File                                                           | Role                                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/document/src/office-wayfinding.ts`                   | `WAYFINDING_ART` (both drawings), `WAYFINDING_TONES`                     |
| `packages/document/src/office.ts`                              | `'directory'`, `'elevator'` in `OfficeKind` / `OFFICE_KINDS`, OFFICE_ART |
| `packages/document/src/shape-kind.ts`, `shape-kinds.ts`        | The kinds in `ShapeKind` and `SHAPE_KINDS`                               |
| `packages/document/src/shape-factory.ts`                       | 72x124 and 112x140; the office branch locks the aspect                   |
| `packages/document/src/behaviour-shapes.ts`                    | In `BEHAVIOUR_SHAPES`; no shared `…` (an office piece)                   |
| `packages/document/src/data-shapes.ts`, `element-types.ts`     | Directory: nothing to write on; Elevator: its label is its name          |
| `packages/document/src/colors.ts`, `animation-membership.ts`   | Self-painting; wordless                                                  |
| `packages/document/src/svg-render-faces.ts`                    | Export through `furnitureArt`                                            |
| `packages/api-schema/src/telemetry-schema.ts`                  | `Directory`, `Elevator` tokens                                           |
| `apps/editor/lib/wayfinding.ts`                                | Places, names, approach / arrival points, floors, who is where           |
| `apps/editor/components/canvas/wayfinding/wayfinding-store.ts` | Per-canvas store: snapshot, open Elevator, door arrival                  |
| `apps/editor/components/canvas/wayfinding/useWayfinding.ts`    | Fills the store; Walk There, Go, Ride; walk-in                           |
| `apps/editor/components/canvas/wayfinding/DirectoryFace.tsx`   | Press, popover, rows                                                     |
| `apps/editor/components/canvas/wayfinding/ElevatorFace.tsx`    | Press, floor panel, doors                                                |
| `apps/editor/components/canvas/useCanvasAvatar.tsx`            | Composes `useWayfinding`; the resolver returns its handle                |
| `apps/editor/components/canvas/ElementFaceRouter.tsx`          | Renders the two faces over the drawing                                   |
| `apps/editor/components/canvas/EditorCanvasHost.tsx`           | `tabPresence`; `onTravelToTab` (travel keeps Avatar mode)                |
| `apps/editor/hooks/canvas/useCanvasTool.ts`                    | `keepWalkingTo(tabId)`: the next tab change is travel                    |

## Domain and naming

| Term           | Identifier                                         | Meaning                                                    |
| -------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| Place          | `SpacePlace = { id, tabId, kind, name, ... }`      | A Room, Office Pod or Stage on a tab                       |
| Place kind     | `'room' \| 'pod' \| 'stage'`                       | From the element's shape (`office-pod` reads `pod`)        |
| Approach point | `SpacePlace.approach`                              | Just outside the doorway (null: no doorway)                |
| Arrival point  | `SpacePlace.arrival`                               | Just inside the doorway, else the centre / the stage's top |
| Floor          | `SpaceFloor = { tabId, name, elevators, arrival }` | A tab, its Elevators and where it arrives                  |
| Exit point     | `elevatorExitPoint(el)`                            | Bottom centre, the figure's head under the name's line     |
| Occupancy      | `whoIsWhere(...)`                                  | Person id to place id (null: Around)                       |
| Wayfinding     | `Wayfinding` handle                                | Store plus actions, stable for the canvas's life           |

## Behaviour and state

- **Naming.** `spacePlaces(tabs)`: per tab, places sorted by `(y, x, id)`; an empty / whitespace label takes
  `${noun} ${n}`, `n` counting only the unnamed of that kind before it. Nouns: Room, Office Pod, Stage.
- **Approach.** Box room: the doorway's middle on its wall line (`roomDoorSpan`), approach 32px outside, arrival
  40px inside. `none` or a Room Builder room: arrival at the centre (outline vertices' mean for an outline), no
  approach; a Room Builder room with a Door on its outline uses the door's centre, inward found with
  `pointInPolygon`. Pod: the front wall's middle below `podInterior`, 28px out, 24px in. Stage: approach 18px below
  its front edge, arrival at `stageTop`'s centre.
- **Occupancy.** Feet into `stageAt(callStages)` then `zoneAt(roomZones)`, over the current tab's visible
  elements; a zone id is a place id. People without a position (not walking) count as Around.
- **Store.** `createWayfindingStore()` holds `{ tabs, activeTabId, people, openElevatorId, arrivalElevatorId,
arrivalSeq }`. `set` notifies only when a field changes by reference; the hook publishes `people` only when the
  by-value key (id, tab, place) changes, so a walk does not re-render an open popover each frame. Faces read with
  selectors (`useWayfindingSelect`), an Elevator only its own open / arrival flags.
- **Walk There.** Not walking: `enter()` (the Avatar pick), the target kept in a ref and started by an effect once
  the walk has a position. Then the route `walkThereRoute(feet, place)` is walked leg by leg, each `walkTo`'s
  arrival starting the next: from outside the place's walls box (`SpacePlace.bounds`, rooms and pods only), the
  approach then the arrival; from inside it, the arrival alone. Each leg is routed by `walkTo` itself
  (`findWalkPath` in `@liveworkspace/avatar`, avatar-mode.md "Finding the way"), so the walk goes round the place's
  walls and anything else in the way.
- **Go / Ride.** `go({ tabId, point, ignoreId })`: while walking, arm the ignored Elevator and `teleportTo(point)`
  first. Same tab: centre the camera (`viewportOffsetCentredOn` on a zero box at the point). Another tab: remember
  `{ tabId, point, ignoreId }` and call `onTravelToTab(tabId)` (EditorCanvasHost: `keepWalkingTo(tabId)` then the
  tab link), so `useCanvasTool` does not end the mode for that one change; an effect on the active tab then centres
  the camera, again on the next frame after the tab's own view restore, and plays the doors.
- **Names.** `floorElevators(elements)`: a tab's Elevators by `(y, x, id)`, the trimmed label else `Elevator n`
  (`n` over the unnamed only); `elevatorName` reads one. The face shows the name under the piece.
- **Peers.** `buildRemoteAvatarRows(..., tabFocus)` drops a peer's packet once their tab-focus left its tab, since
  travel never publishes `avatar: null` on the way out.
- **Walk-in.** An effect on `avatar.standingOnId`: arriving on an `elevator` that is not the ignored one sets
  `openElevatorId`; stepping off clears the ignore and closes a walk-opened panel.
- **Doors.** A ride's arrival sets `arrivalElevatorId` with a fresh `arrivalSeq`; that Elevator's face keys its
  door animation on the seq.

## Interfaces and contracts

`onEnterPortal(element)` (the element layer's resolver) returns `{ targetName, travel, wayfinding? }`; `wayfinding`
is set for the two kinds and is the same object every call. `CanvasProps.onTravelToTab?` and `onEnterAvatarMode?` are read by `useCanvasAvatar` from `props`; `Canvas.tsx` is unchanged.
`CanvasProps.tabPresence?: Map<string, Participant[]>` is read by `useCanvasAvatar` from `props`.

## Errors and edge cases

A place whose element vanished while the popover is open drops out with the next snapshot. A Go to a deleted place
or a tab that no longer exists does nothing. One tab: the Elevator panel shows one floor. A tab not loaded yet has
no elements: it lists no places until it loads.

## Performance and limits

Places and floors are computed in the open popover only (`useMemo` on the snapshot's tabs). Occupancy is O(people
x places) per presence change; the self's place is recomputed per walk frame (a few box tests) and published only
on change. No listener or timer outlives a face.

## Accessibility

Both faces are real buttons named "Directory" / "Elevator" with `aria-expanded`; the popovers are `dialog`s with
headed groups, every action a labelled button, Escape closes.
