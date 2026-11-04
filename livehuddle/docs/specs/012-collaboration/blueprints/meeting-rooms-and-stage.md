# Meeting rooms and the stage blueprint

Derived from [Meeting rooms and the stage](../meeting-rooms-and-stage.md). Paths are livehuddle's; `../packages/…` is
the monorepo's. Part 1 (rooms are calls) is built; the rest is the design later parts build to.

## Domain and naming

| Term                    | Identifier                                                                                         | Meaning                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| room's interior         | `roomInterior(el)` (`@liveworkspace/avatar`)                                                       | The box inside a room's wall centre lines: x+5 to x+w−5, y+31 to y+h−5         |
| zone                    | `CallZone` `{ id, x0, y0, x1, y1, area }`                                                          | A visible room's interior, as the call reads it                                |
| zone of a point         | `zoneAt(at, zones)`                                                                                | The innermost (smallest) zone strictly containing the feet, or null (the open) |
| zone ids                | `CallZoning` `{ self, of }`                                                                        | Your zone and each walker's, worked out once per scene                         |
| stage (part 2)          | shape kind `stage`, `ShapeElement.stageSpeakers?: 'edit' \| 'take-part'`, `stageCameras?: boolean` | The platform and its two settings                                              |
| hand (part 3)           | presence op `avatar-hand` `{ kind, tabId, raised, letSpeak? }`                                     | A raised hand and who it was let speak by                                      |
| Do Not Disturb (part 3) | `AvatarStatus` `'dnd'`                                                                             | The fifth status                                                               |

## Behaviour and state (part 1)

**Zones** (`apps/editor/lib/calls/zones.ts`, pure): `roomZones(elements)` maps each `type: 'shape'`, `shape: 'room'`
element to its interior; the caller passes the tab's elements on visible layers (`visibleLayerElements`, the same list
the walk collides with). `zoneAt(at, zones)` is strict (`x0 < x < x1`, `y0 < y < y1`), so feet on a wall's centre line,
the doorway's threshold, are outside; of several zones it picks the smallest area, then the lower id, so nesting and
overlap are deterministic. `zoning(self, walkers, zones)` returns `{ self, of }` with one `zoneAt` per walker.

**Hearing** (`apps/editor/lib/calls/hearing.ts`, pure): `nextHeard(prev, self, peers, zoning?)` first compares zones:
a peer in a different zone from yours (a room versus the open, or two rooms) is never heard; a peer in your room is
always heard (no radius, no hysteresis: the wall is the edge, and nobody stands in a wall); two people in the open
fall through to the distance rule unchanged. `inEarshot(self, at, sameRoom)` is the one yes/no for the mic indicator.
`placeFor(self, at, sameRoom)` returns `{ gain, pan }`: gain 1 in a shared room, `gainAt(d)` in the open; pan
`panAt(dx)` either way.

**The call** (`apps/editor/lib/calls/proximity-call.ts`): `CallScene.zones` (default none) arrives with every
`update`; the call works out the zoning once per update and keeps it for `hear()` (the subscriptions and
`pickSeen`, which reads only `heard`), `place()` (gain and pan) and `someoneNear`. A track arriving or the kill switch
changing re-runs `hear()` with the kept zoning.

**The canvas** (`apps/editor/components/calls/useCanvasCall.ts`): memoises `roomZones(visibleLayerElements(elements,
tabLayers))` on the elements and layers, and passes it in the call's deps. `useProximityCall` puts it in the
`CallScene` memo.

## Behaviour and state (later parts)

**Stage (part 2)**: `stageAt(at, stages)` like `zoneAt`. A walker on a stage whose `stageSpeakers` allows their level
is a **stage speaker**: every listener on the tab subscribes to them (`heard` gains them whatever the zones), placed at
gain 1, pan 0. A stage speaker hears the other stage speakers and the hands let speak. While a stage has a speaker,
its **audience** (walkers in the stage's zone, or the whole tab for a stage in the open) is zoned as the open: distance
hearing among themselves, never heard by the stage. Whether a walker's share level allows the stage needs their level
in presence: if the participant presence does not carry it yet, part 2 adds it there (stamped by the room from the
grant, never from the client), not a new op.

**Hands (part 3)**: `avatar-hand` is relayed to the tab, unbatched, gated in `room-op-gate.ts` (Editor and Participant
raise; `letSpeak` accepted only from an Editor or a walker the sender's browser sees on the stage, re-checked in each
listener's hearing). The calls store keeps hands per presence id, pruned with presence.

**Do Not Disturb (part 3)**: `'dnd'` joins the status list. The list is shared (`AVATAR_STATUSES` in
`../packages/avatar/src/status.ts`, `AvatarStatus` in `@liveworkspace/api-schema/avatar`), so part 3 either makes the
offered list a product option (livediagram has no calls) or adds the status everywhere with livediagram's meaning
"hide others' bars" only; the part decides and records it. While your status is `dnd`, `hear()` wants nothing (no audio, no bubbles)
and `useCanvasCall`'s `hidePeers` is true; publishing is untouched.

## Interfaces and contracts

- `CallScene` gains `zones?: readonly CallZone[]`; `ProximityCallDeps` gains `zones?: readonly CallZone[]`.
- `nextHeard`'s fourth argument is optional: without it everyone is in the open, the old behaviour.
- No wire change in part 1. Part 2 adds two optional shape fields (validated in `validate-shape.ts`); part 3 adds
  `avatar-hand` to `@livehuddle/api-schema` with a field-by-field parser shared by the room and the editor.

## Data and persistence

Part 1 stores nothing. The stage's settings (part 2) are fields on its element, saved with the board like a room's
`roomDoor`. Hands and Do Not Disturb are presence only.

## Errors and edge cases

- No rooms on the tab: every zone is null, hearing is exactly the distance rule.
- A room moved, resized, deleted or hidden while people stand in it: the next scene re-zones everyone; subscriptions
  follow on the same `update` that carries the change.
- A walker whose position puts their feet in a wall (never reached by walking, but possible after a room is dragged
  onto them): zoned by the strict rule like anyone else.
- Your character not placed yet (`self` null): you hear nobody, as before.

## Security and trust

Hearing is the browser's choice, as distance is (the spec's Trust). The mint route checks only that a microphone was
published in the same Space. A server-side check, the room telling the mint route who may hear whom from the
positions and zones it relays, is a recorded follow-up.

## Performance and limits

- `roomZones` is linear in the tab's elements and runs only when the elements or layers change (memoised), never on
  a step.
- Zoning is `walkers × rooms` comparisons once per scene update (at most once a frame while anyone walks), then hearing
  is linear in walkers as before. The test walks 100 walkers through 50 rooms within a CPU budget.
- A room is one call: everyone in it subscribes to everyone else, `n × (n − 1)` streams (the spec's Cost). The SFU
  session batches subscribes at `MAX_SUBSCRIBE_BATCH` (16) per request, so a crowded room joins in a few requests.

## Observability

Part 1 adds no log: zoning runs on every step, and the subscriptions it changes go through `SfuSession` and its
existing `[calls]` logs. Later parts log a refused `avatar-hand` in the room's op gate as it logs the other refused
ops.

## Testing

| Rule                                                                       | Test                                                  |
| -------------------------------------------------------------------------- | ----------------------------------------------------- |
| A room's interior is inside its wall centre lines, for any size and door   | `../packages/avatar/src/office-geometry.test.ts`      |
| Zones from rooms only; strict edges; innermost wins; ties by id            | `apps/editor/lib/calls/zones.test.ts`                 |
| Same room opposite corners at full gain; next room through a wall silent;  | `apps/editor/lib/calls/hearing.test.ts`               |
| hallway to room silent; hallway to hallway by distance; 100 × 50 in budget |                                                       |
| The call subscribes by zone, re-zones on update, bubbles follow, Live      | `apps/editor/lib/calls/proximity-call.test.ts`        |
| The canvas passes visible rooms only                                       | `apps/editor/components/calls/useCanvasCall.test.tsx` |

## Constants and configuration

Part 1 adds no constant: the interior comes from the room's own `ROOM_WALL` and `ROOM_BACK_FACE`.
