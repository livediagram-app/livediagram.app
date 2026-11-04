# Meeting rooms and the stage blueprint

Derived from [Meeting rooms and the stage](../meeting-rooms-and-stage.md). Paths are livehuddle's; `../packages/…` is
the monorepo's. Part 1 (rooms are calls) and part 2 (the stage under the hood) are built; the rest is the design
later parts build to.

## Domain and naming

| Term                    | Identifier                                                                                         | Meaning                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| room's interior         | `roomInterior(el)` (`@liveworkspace/avatar`)                                                       | The box inside a room's wall centre lines: x+5 to x+w−5, y+31 to y+h−5         |
| zone                    | `CallZone` `{ id, x0, y0, x1, y1, area }`                                                          | A visible room's interior, as the call reads it                                |
| zone of a point         | `zoneAt(at, zones)`                                                                                | The innermost (smallest) zone strictly containing the feet, or null (the open) |
| zone ids                | `CallZoning` `{ self, of }`                                                                        | Your zone and each walker's, worked out once per scene                         |
| stage (part 2)          | shape kind `stage`, `ShapeElement.stageSpeakers?: 'edit' \| 'take-part'`, `stageCameras?: boolean` | The platform and its two settings                                              |
| stage's top (part 2)    | `stageTop(el)` (`@livehuddle/document`)                                                            | Where feet stand on it: x to x+w, y to y+h−`STAGE_FRONT`                       |
| call stage (part 2)     | `CallStage` `{ id, x0, y0, x1, y1, area, zone, speakers, cameras }`                                | A visible stage's top as the call reads it, and the room it stands in          |
| staging (part 2)        | `CallStaging` `{ self, speakers, audience, unseen }` on `CallZoning.stage`                         | Who speaks from a stage, which rooms are audiences, whose bubbles stay unseen  |
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

## Behaviour and state (part 2)

**The element** (`packages/document/src/office.ts`, `shape-factory.ts`, `validate-shape.ts`): `stage` is an
`OfficeKind` drawn to its own size like a room (`stageParts(width, height)`: the top in the floor's fill with two
plank lines, the front face `STAGE_FRONT` (24) tall shaded with the stroke, and a plate centred on the face, 40% of
the width between 64 and 160 px). A new stage is 360 × 140, label "Stage", `sm` text centred at the bottom (on the
plate), not aspect locked, neither field stored (absent reads as `edit` and off). `isFloorShape`
(`../packages/avatar/src/office-geometry.ts`) counts it, so it goes in at the back, paints under the furniture and is
never a destination. Its label is its plate, as a room's is (`selfLabelled` false, no Text animation set). The export
draws it with `stageSvg` (`svg-render-faces.ts`); the canvas with `StageView` (`components/canvas/collab/StageView.tsx`),
both from `stageParts`, the canvas through the room's `SizedPieceView`.

**Stages** (`apps/editor/lib/calls/stage.ts`, pure): `callStages(elements, zones)` maps each visible `stage` element
to its top (`stageTop`) and the room zone its top's centre is in (`zoneAt`), with `stageSpeakers` and `stageCameras`
read through their defaults; the canvas memoises it with the rooms. `stageAt(at, stages)` is strict like `zoneAt`,
the smallest first, then the lower id. `mayTakeStage(level, speakers)`: `edit` lets an Editor speak, `take-part` an
Editor or a Participant; a missing level is a Viewer's.

**Staging** (`staging(self, selfLevel, walkers, levels, stages)`): a walker standing on a stage that lets their
level speak is a **speaker**; so are you, from your own level. The live stages' room zones (not the open) are
**audience** zones. A speaker on a stage with Show Cameras off is **unseen**. No speaker anywhere returns null, and
the call keeps part 1's zoning untouched, so a tab with stages and nobody on them costs one `stageAt` per walker.

**Hearing** (`hearing.ts`): `togetherWith(id, zoning)` gains `'stage'`. With staging: if you speak, a speaker is
`'room'` and anyone else `'apart'`; if you do not, a speaker is `'stage'`. Otherwise the zones decide as in part 1,
except that two people in the same audience zone are `'open'` (distance). `nextHeard` always hears `'stage'`;
`placeFor` puts it at gain 1, pan 0. `someoneHears(self, walkers, zoning)` is the mic indicator: on a stage, anyone
on the tab; otherwise anyone `inEarshot` who is not a speaker (the stage does not hear you).

**The call** (`proximity-call.ts`): `CallScene` gains `stages`; peers' levels come from the calls store
(`callLevels()`); `ProximityCallInput`'s `canSpeak` and `canShare` give your own level (`edit` when you may share, `participate` when
you may speak, else `view`). Each `update` works out the zoning, then the staging, once; `hear()` passes `pickSeen`
the heard set without the unseen speakers, and places by `togetherWith` as before. Stepping onto a stage that carries
you tracks `StageSpeak` once until you step off.

**Levels** (`calls-store.ts`): `setCallLevels(participants)` keeps each peer's stamped `role` from every presence
list (`useRoomConnection`'s `roomPresence`), notifying the call (`onCallLevels`, which re-stages the scene it holds)
only when a level changed. The room already stamps `role` from the grant in `helloPresence`
(`apps/api/src/document-room-rules.ts`), so the wire is unchanged.

## Behaviour and state (later parts)

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
- Part 2: `CallScene` and `ProximityCallDeps` gain `stages?: readonly CallStage[]`; `CallZoning` gains `stage?: CallStaging`; `Together` gains `'stage'`.
- `nextHeard`'s fourth argument is optional: without it everyone is in the open, the old behaviour.
- No wire change in part 1. Part 2 adds two optional shape fields (validated in `validate-shape.ts`); part 3 adds
  `avatar-hand` to `@livehuddle/api-schema` with a field-by-field parser shared by the room and the editor.

## Data and persistence

Part 1 stores nothing. The stage's settings (part 2) are fields on its element, saved with the board like a room's
`roomDoor`: `stageSpeakers` (`'edit' | 'take-part'`) and `stageCameras` (boolean), each validated when present
(`validate-shape.ts`), copied by Copy Format (`edit-operations` `SHAPE_KIND_FIELDS.stage`), and absent on every older
document, which loads as before (no stage, no change). Hands and Do Not Disturb are presence only.

## Errors and edge cases

- No rooms on the tab: every zone is null, hearing is exactly the distance rule.
- A room moved, resized, deleted or hidden while people stand in it: the next scene re-zones everyone; subscriptions
  follow on the same `update` that carries the change.
- A walker whose position puts their feet in a wall (never reached by walking, but possible after a room is dragged
  onto them): zoned by the strict rule like anyone else.
- Your character not placed yet (`self` null): you hear nobody, as before.
- A stage with nobody allowed on it: no staging; its room is an ordinary room call.
- A stage dragged out from under its speaker, hidden, or its Who Can Speak narrowed: the next scene re-stages.
- A stage whose top is too small to stand on (height at or under `STAGE_FRONT`): no call stage.
- A peer with no level in presence (an old room): a Viewer for the stage, so never a speaker.

## Security and trust

Hearing is the browser's choice, as distance is (the spec's Trust). The mint route checks only that a microphone was
published in the same Space. A server-side check, the room telling the mint route who may hear whom from the
positions and zones it relays, is a recorded follow-up.

## Performance and limits

- `roomZones` is linear in the tab's elements and runs only when the elements or layers change (memoised), never on
  a step.
- Zoning is `walkers × rooms` comparisons once per scene update (at most once a frame while anyone walks), then hearing
  is linear in walkers as before. The test walks 100 walkers through 50 rooms within a CPU budget.
- Staging adds `walkers × stages` comparisons per update; `callStages` runs only when the elements, layers or rooms
  change. The test runs 100 walkers, 50 rooms and a live stage within the same kind of budget.
- A stage is one speaker to everyone: `listeners` streams per speaker (the spec's Cost), subscribed in batches of 16.
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
| Stages: visible only, top strict, smallest wins, room found, gate by level | `apps/editor/lib/calls/stage.test.ts`                 |
| Stage reaches the tab centred; audience by distance; walls kept; unseen    | `apps/editor/lib/calls/hearing.test.ts`               |
| The call hears and places the stage, hides unseen bubbles, StageSpeak once | `apps/editor/lib/calls/proximity-call.test.ts`        |
| Levels kept from presence, notified on change only                         | `apps/editor/lib/calls/calls-store.test.ts`           |
| The element: defaults, drawing, validation, export, Copy Format            | `packages/document/src/office.test.ts` and siblings   |

## Constants and configuration

Part 1 adds no constant: the interior comes from the room's own `ROOM_WALL` and `ROOM_BACK_FACE`. Part 2 adds
`STAGE_FRONT` (24, the front face), `STAGE_FLOOR` (`#fbf7ef` on light paper, `#3a3430` on dark) and
`DEFAULT_STAGE_SPEAKERS` (`edit`), in `packages/document/src/office.ts`.
