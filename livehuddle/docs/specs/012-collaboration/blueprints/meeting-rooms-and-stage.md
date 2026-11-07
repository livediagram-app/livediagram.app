# Meeting rooms and the stage blueprint

Derived from [Meeting rooms and the stage](../meeting-rooms-and-stage.md). Paths are livehuddle's; `../packages/…` is
the monorepo's. Part 1 (rooms are calls), part 2 (the stage under the hood), part 3 (raise hand, Let Speak, Do Not
Disturb and the stage line) and part 4 (the palette tile, settings, template and help) are built.

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
| hand (part 3)           | presence op `avatar-hand` `{ kind, tabId, raised, letSpeak? }`                                     | Your raised hand, and the presence id of who let it speak (absent: nobody)     |
| let speak (part 3)      | presence op `avatar-let-speak` `{ kind, tabId, targetId, on }`                                     | Let a raised hand speak (`on`), or Done; addressed to the hand's owner         |
| hands (part 3)          | `CallHand` `{ tabId, letSpeak, at }` by presence id in the calls store                             | Every peer's raised hand, in the order they went up                            |
| stage place (part 3)    | `CallSelf.stage`: `'none' \| 'audience' \| 'speaker' \| 'barred'`, `CallSelf.barredBy`             | Where you stand towards a live stage, for the Call dock                        |
| your hand (part 3)      | `CallSelf.hand`: `'down' \| 'raised' \| 'speaking'`, `CallSelf.handsUp`                            | Your own hand, and how many hands are up on the tab (for a speaker)            |
| Do Not Disturb (part 3) | `AvatarStatus` `'dnd'`; `AVATAR_CALL_STATUSES`                                                     | The fifth status, and the list livehuddle offers                               |

## Behaviour and state (part 1)

**Zones** (`apps/editor/lib/calls/zones.ts`, pure): `roomZones(elements)` maps each `type: 'shape'`, `shape: 'room'`
element to its interior; the caller passes the tab's elements (the same list
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

**The canvas** (`apps/editor/components/calls/useCanvasCall.ts`): memoises `roomZones(elements)` on the elements, and passes it in the call's deps. `useProximityCall` puts it in the
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

**Levels** (`calls-hands-store.ts`): `setCallLevels(participants)` keeps each peer's stamped `role` from every presence
list (`useRoomConnection`'s `roomPresence`), notifying the call (`onCallLevels`, which re-stages the scene it holds)
only when a level changed. The room already stamps `role` from the grant in `helloPresence`
(`apps/api/src/document-room-rules.ts`), so the wire is unchanged.

## Behaviour and state (part 4)

**The tile** (`apps/editor/components/palette/palette-tile-defs.tsx`, `tools:stage`): `tileGroup: 'move'`, `section: 'tools'`,
`toolGroup: 'behaviour'`, label "Add Stage", caption "Stage", blurb "A platform the whole tab hears", action
`{ type: 'shape', kind: 'stage' }`, glyph `StageIcon` (`palette-icons.tsx`: the platform's top and front face, a
microphone on a stand). Its `tileGroup: 'rooms'` puts it in the Rooms category, after `tools:room` in catalogue order, so
Rooms reads Fence, Room, Stage, Rug. Placing goes through `placeBoxed`, which prepends a floor piece (`isFloorShape` holds
`stage`), so a new stage is behind everything. A Participant has no palette ([A Participant walks](../../013-workspace/share-roles.md#a-participant-walks)). The
palette search finds it by `SHAPE_KEYWORDS.stage` (`apps/editor/lib/palette-tile-keywords.ts`: platform, podium,
all-hands, town hall, keynote, presenter, speaker); Rooms holds four tiles, and its description names "a stage".

**The settings** (`apps/editor/components/palette/StageMenuSection.tsx`): `StageMenuSection({ target, sectionProps, onSetStage })`,
an accordion titled "Stage" (section id `stage`) inside the element menu's Tools flyout. A two-column `MenuTileGrid`
of `STAGE_SPEAKERS` with `STAGE_SPEAKER_LABELS` ("Editors", "Editors and Participants"), the active one
`target.stageSpeakers ?? DEFAULT_STAGE_SPEAKERS`; the hint line; then `MenuToggleRow` "Show Cameras" on
`target.stageCameras === true`. Pressing a tile calls `onSetStage({ stageSpeakers })`; the switch
`onSetStage({ stageCameras: !on })`. `ElementDataSections` shows the Tools flyout and the section when the target is
a `stage`. The setter is `useDataShapeSetters`' `setStageSelected(patch)`, a `makeShapePatcher` matching `stage`,
tracked `Element · Changed · Stage`, wired through `useEditorState` and `EditorContextMenuHost` as
`onSetStage` (`EditorContextMenu.types.ts`).

**The hall** (`packages/templates/src/template-builders-spaces.ts`, `buildAllHandsHall`): the hall room's pieces hold
`{ kind: 'stage', x: (HALL_W - STAGE_W) / 2, y: 48, w: STAGE_W, h: STAGE_H, stageCameras: true }` with `STAGE_W` 400
and `STAGE_H` 160; the rug and the "Stage" text go. `OfficePiece` gains an optional `stageCameras`, copied onto the
element by `furnishRooms` (`template-office-parts.ts`), which now sorts every `isFloorShape` piece (a rug or a stage)
with the floors, as `officePlan` does. The hall's preview (`packages/template-previews/src/template-preview-23.tsx`)
draws the stage's top and front face, and `packages/templates/welcome.json` is regenerated from it.

**Help**: `apps/help/app/palette/virtual-office/stage/page.mdx` (registered in `packages/help-registry`, slug
`stage`, `categorySlug: 'palette/virtual-office'`, `parentSlug: 'virtual-office'`, with a feature colour and icon),
its figures in `apps/help/components/illustrations/stage.tsx` (`StageHall`, `StageSettings`); the Virtual Office
article gains a Stage section linking to it.

## Behaviour and state (part 3)

**The wire** (`packages/api-schema/src/call-hand.ts`): `parseAvatarHand(op)` takes a `tabId` (1 to 64 chars), a
boolean `raised`, and an optional `letSpeak` that is null or a presence id (1 to 64 chars), dropped when `raised` is
false; `parseAvatarLetSpeak(op)` takes a `tabId`, a `targetId` (a presence id) and a boolean `on`. Both are
`PRESENCE_OP_KINDS`. The room (`room-op-gate.ts`) drops either from a Viewer or malformed, relays `avatar-hand` to
every socket unbatched (not a sample kind), and delivers `avatar-let-speak` to the named session alone, as it does
`avatar-push` (`sendToPresence`), dropping one aimed at nobody. The room cannot place people, so whether the presser
stands on a stage is left to the browsers.

**Hands in the store** (`calls-hands-store.ts`): `receiveCallOp` keeps a peer's `avatar-hand` as a `CallHand` (`raised`
false deletes it; a first raise stamps `at`, a later op keeps it, so the order is the order hands went up), at most
`HANDS_MAX` (`ROOM_MAX_CONNECTIONS`, 100) at once. Hands go with `forgetCallPeer`, `pruneCallPeers` and
`resetCallPeers`, so leaving the mode, a dropped socket or the room closing lowers them. `receiveLetSpeak(from, op)`
hands an addressed `avatar-let-speak` to the running call (`onLetSpeak`). `noteLetSpeak(targetId, on)` keeps the
hands this browser let speak (`callLetByMe()`), since a browser never learns its own presence id and so cannot
recognise itself in another's `letSpeak`. `useCallHands()` is the canvas's read.

**Who may let speak** (`stage.ts`): `mayLetSpeak(id, walkers, levels, stages)` is true for an Editor (by the level
the room stamped) or a walker on the tab standing on a stage that lets them speak (`stageAt`, `mayTakeStage`).
`letSpeakers(hands, walkers, levels, stages, mine)` returns the walkers whose hand carries a `letSpeak` that passes
`mayLetSpeak`, or that this browser let speak (`mine`) while it may itself. `staging(...)` takes them (`let`) and your
own (`selfLet`): each is a speaker as if on a stage, **unseen** (their bubbles are not received by the audience),
adding no audience room; a tab with no stages at all still returns null.

**The call** (`proximity-call.ts`): `raiseHand()` (only a speaking level, only as a live stage's audience) keeps your
hand with the zone you raised it in, sends `avatar-hand` `{ raised: true }`, and tracks `RaiseHand`; `lowerHand()`
sends `{ raised: false }`. On an addressed let-speak (`onLetSpeak`) from someone `mayLetSpeak` passes for, with your
hand up: `on` sets your hand's `letSpeak` to them and sends it; Done lowers the hand. Each `update` lowers the hand
when your zone is no longer the one it went up in, re-sends a raised hand when a walker arrives (with the locator),
and works out `selfLet` (your hand's `letSpeak` still passes). `CallSelf` gains `stage`, `barredBy` (the stage's Who
Can Speak while you stand on one that bars you, else null), `hand` and `handsUp` (raised, not let speak, among the
tab's walkers), set on every update and on every hands change (`onCallHands`). Leaving the call lowers the hand.

**Let Speak in the canvas** (`useCanvasCall.ts`, `components/calls/RaisedHands.tsx`): `RaisedHands` draws a badge
beside each walker's head whose hand is up, and beside yours while `CallSelf.hand` is not down. The canvas works out
whether you may let speak (`mayLetSpeakSelf`: an Editor, or standing on a stage that lets you speak); if so each
peer's badge is a button: a raised hand sends `avatar-let-speak` `{ on: true }` (tracks `LetSpeak`), a speaking one
`{ on: false }` (Done), each through `props.onCallSignal` with the tab added, and `noteLetSpeak` records it.

**Do Not Disturb**: `'dnd'` joins `AVATAR_STATUS_IDS` (the wire, `@liveworkspace/api-schema/avatar`) and the status
catalogue (`../packages/avatar/src/status.ts`: label "Do Not Disturb", colour `#e11d48`, drawn with a white bar).
`AVATAR_STATUSES` stays the four every product offers; `AVATAR_CALL_STATUSES` adds Do Not Disturb, and
livediagram's Avatar Panel offers the four, and livehuddle's avatar palette (its Status flyout,
`AvatarPaletteFlyouts.tsx`) the five. While your status is `dnd`, `ProximityCall.setDoNotDisturb(true)` makes `hear()` want
nothing (no audio, no bubbles, `heard` empty) and `useCanvasCall`'s `hidePeers` is true; publishing is untouched. The
Call dock shows a **Do Not Disturb** segment that clears it (`onClearDoNotDisturb`).

**The call group** (`components/calls/CallStripGroup.tsx`, `StageSegments.tsx`, on the Call dock, `CallDock.tsx`): as audience with a speaking level,
Raise Hand / Lower Hand (pressed, amber), or Speaking (brand) while let speak; as a speaker, a count of raised hands
when there are any; and over the group (centred on it, `bottom-full`), while `barredBy` is set, the stage line (`StageLine`).

## Interfaces and contracts

- `CallScene` gains `zones?: readonly CallZone[]`; `ProximityCallDeps` gains `zones?: readonly CallZone[]`.
- Part 2: `CallScene` and `ProximityCallDeps` gain `stages?: readonly CallStage[]`; `CallZoning` gains `stage?: CallStaging`; `Together` gains `'stage'`.
- `nextHeard`'s fourth argument is optional: without it everyone is in the open, the old behaviour.
- No wire change in part 1. Part 2 adds two optional shape fields (validated in `validate-shape.ts`); part 3 adds
  `avatar-hand` and `avatar-let-speak` to `@livehuddle/api-schema` (`call-hand.ts`) with field-by-field parsers
  shared by the room and the editor, and `'dnd'` to the shared `AvatarStatus`.
- Part 3: `staging(self, selfLevel, walkers, levels, stages, hands?)` where `hands` is `{ let, self }`; `CallActions`
  gains `raiseHand` and `lowerHand`; `ProximityCall` gains `raiseHand`, `lowerHand` and `setDoNotDisturb`;
  `ProximityCallDeps` gains `doNotDisturb`.

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
- A let-speak from someone who may not let speak (a Participant off every stage), or with no hand up: ignored.
- The person who let you speak steps off the stage: every browser's check fails, and you are the audience again
  with your hand still raised. A hand whose owner left: pruned with presence.
- Raise Hand with no live stage, or as a Viewer: the button is not offered, and the call refuses it anyway.
- Do Not Disturb while let speak: you are heard by the tab and hear nobody, as the status says.

## Security and trust

Hearing is still the browser's choice first, and the server now checks it (the spec's Trust, #483):

- **Binding.** After the mint, the call sends `call-session {sessionId, sessionToken}`; the room verifies the HMAC
  token (`openSessionToken` with `REALTIME_APP_TOKEN`) and keeps `callSession` in the socket's attachment, so it
  survives hibernation. Never relayed. A forged proof is dropped with `[calls] token room`. Publishers are mapped by
  this proven session too, never by `call-track` locators, which anyone could copy.
- **The question.** The tracks route, before a subscribe, asks the room over RPC `callsHearing(documentId,
subscriberSession, asks)`. `RoomCalls` (`apps/api/src/calls/room-calls.ts`) answers per track from what the room
  relays: positions (`avatar` ops), levels (the grant), hands and who let them speak, stopped shares, and each tab's
  rooms and stages from the stored tab (`SELECT rev`, then `data` only when the revision moved; parsed with
  `roomZones`, `callStages` from `@livehuddle/document`, the editor's own geometry).
- **The verdict** (`call-hearing.ts`, pure): unknown position: `heard` in the first minute after the room started
  (`ROOM_WAKE_GRACE_MS`), else `unplaced`; another tab `apart`; a stage speaker or a hand let speak by someone who
  still may: `heard`; otherwise each side's possible zones (the point and eight points `EDGE_MARGIN_PX` away) are
  intersected: a shared room is `heard`, the shared open floor is `heard` within the release radius plus
  `HEARING_MARGIN_PX`. A subscriber session the room has not been shown is `unknown-session`; a stopped screen is
  `stopped`.
- **The answer.** `subscribe-hearing.ts` splits the request: refused tracks come back in place as
  `{ sessionId, trackName, errorCode: 'not_heard' }`, the rest go to Realtime. Each refusal logs
  `[calls] not heard <answer> <track>`. A room that cannot answer (throws, times out, missing binding) refuses
  nobody (`[calls] hearing unanswered`).
- **The retry.** `SfuSession` holds a `not_heard` track back for `NOT_HEARD_RETRY_MS` (2 s), doubling to
  `NOT_HEARD_RETRY_MAX_MS` (16 s) while refused, and calls `onNotHeard`; the call counts `CallNotHeard` and sends
  `call-session` again (at most every `REPROVE_MS`), which heals a room that restarted or a socket that reconnected.
- **Let-speak** (#495). The room delivers an `avatar-let-speak` only when `RoomCalls.letSpeak` passes: an Editor, or
  someone it places (with the edge margin) on a stage that lets their level speak. Otherwise `[calls] let-speak
refused` and nothing is delivered. The browser's own check stays.

## Performance and limits

- `roomZones` is linear in the tab's elements and runs only when the elements change (memoised), never on
  a step.
- Zoning is `walkers × rooms` comparisons once per scene update (at most once a frame while anyone walks), then hearing
  is linear in walkers as before. The test walks 100 walkers through 50 rooms within a CPU budget.
- Staging adds `walkers × stages` comparisons per update; `callStages` runs only when the elements or rooms
  change. The test runs 100 walkers, 50 rooms and a live stage within the same kind of budget. Measured (best of
  seven, CPU time): a scene of 100 walkers among 50 rooms is 14.5 µs, 16.0 µs with a live stage; `callStages` over a
  tab of 2,051 elements is 6.9 µs.
- Raise hand (part 3) adds `hands × stages` comparisons per scene (`letSpeakers`, at most `HANDS_MAX` hands) and a
  count of the hands up; a hand changing re-runs the scene once. Measured (best of five, CPU time): 100 hands all let
  speak, with the staging, is about 30 µs a scene. The canvas's `RaisedHands` draws nothing and costs one empty
  check while no hand is up; the hands store notifies only on a raise, a lower, a let-speak or a prune.
- A stage is one speaker to everyone: `listeners` streams per speaker (the spec's Cost), subscribed in batches of 16.
- A room hears by distance (owner, 2026-11-06): `togetherWith` answers `'open'` for anyone on your side of the walls,
  room or floor, so `nextHeard` measures them as on the open floor; `'room'` is left for fellow speakers on a stage.
  The big-room cap (#482, its old `big-room` module) and the store's `talkedAt` and `onCallTalkStart`, which fed it, are
  removed with whole-room hearing: a room's streams are bounded by the hearing radius like the open floor's, and the
  per-scene work drops the sort and the talkers' scan. The stage's `audience` set (rooms that heard by distance only
  under a live stage) went with it. The api's `hearingVerdict` measures distance in a shared room too, with the same
  `HEARING_MARGIN_PX` past the release radius.
- **The server check** costs one RPC to the room per subscribe request (already batched at 16) plus one `SELECT rev`
  per tab asked about; the tab's JSON is parsed again only when its revision moved. Measured on a loaded laptop: 1,600
  verdicts 31 ms CPU (about 19 µs each), 100 subscribes of 16 tracks in a room of 100 31 ms (about 0.3 ms each).
  Positions are kept per presence (bounded by the room's connections) and forgotten on close.

## Observability

Part 1 adds no log: zoning runs on every step, and the subscriptions it changes go through `SfuSession` and its
existing `[calls]` logs. Part 3: the room's gate drops a Viewer's or malformed `avatar-hand` silently, as it drops
every other refused op (no log: a flood would log a line a frame); the editor logs `[calls] let speak ignored` when a
let-speak fails the check, and `[calls] hand` on each raise and lower. The server check logs `[calls] not heard`
per refused track, `[calls] hearing unanswered` when it fails open, `[calls] let-speak refused` and `[calls] token
room`; the browser counts `CallNotHeard`.

## Testing

| Rule                                                                                    | Test                                                                                                                             |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| A room's interior is inside its wall centre lines, for any size and door                | `../packages/avatar/src/office-geometry.test.ts`                                                                                 |
| Zones from rooms only; strict edges; innermost wins; ties by id                         | `apps/editor/lib/calls/zones.test.ts`                                                                                            |
| Same room by distance; next room through a wall silent;                                 | `apps/editor/lib/calls/hearing.test.ts`                                                                                          |
| hallway to room silent; hallway to hallway by distance; 100 × 50 in budget              |                                                                                                                                  |
| The call subscribes by zone, re-zones on update, bubbles follow, Live                   | `apps/editor/lib/calls/proximity-call.test.ts`                                                                                   |
| The canvas passes visible rooms only                                                    | `apps/editor/components/calls/useCanvasCall.test.tsx`                                                                            |
| Stages: visible only, top strict, smallest wins, room found, gate by level              | `apps/editor/lib/calls/stage.test.ts`                                                                                            |
| Stage reaches the tab centred; audience by distance; walls kept; unseen                 | `apps/editor/lib/calls/hearing.test.ts`                                                                                          |
| The call hears and places the stage, hides unseen bubbles, StageSpeak once              | `apps/editor/lib/calls/proximity-call.test.ts`                                                                                   |
| Levels kept from presence, notified on change only                                      | `apps/editor/lib/calls/calls-store.test.ts`                                                                                      |
| The element: defaults, drawing, validation, export, Copy Format                         | `packages/document/src/office.test.ts` and siblings                                                                              |
| Hand and let-speak parsers: bounds, booleans, ids                                       | `packages/api-schema/src/call-hand.test.ts`                                                                                      |
| The gate: a Viewer's hand and let-speak dropped, malformed dropped                      | `apps/api/src/room-op-gate.test.ts`                                                                                              |
| Let-speak addressed to its target alone; a hand relayed to all                          | `apps/api/src/document-room.test.ts`                                                                                             |
| Hands kept in order, bounded, pruned with presence; let-by-me                           | `apps/editor/lib/calls/calls-store.test.ts`                                                                                      |
| Who may let speak; let-speak speakers heard by the tab, unseen                          | `apps/editor/lib/calls/stage.test.ts`                                                                                            |
| Raise, Let Speak, Done, walking out, leaving; Do Not Disturb hears nobody               | `apps/editor/lib/calls/proximity-call.test.ts`                                                                                   |
| Strip: Raise/Lower/Speaking by role, count, stage line, DND segment                     | `apps/editor/components/calls/CallStripGroup.test.tsx`                                                                           |
| Badges: who sees a button, Let Speak and Done sent                                      | `apps/editor/components/calls/RaisedHands.test.tsx`                                                                              |
| The panel offers the list it is given; dnd parses and draws                             | `../packages/avatar/src/status.test.ts` and the panel's tests                                                                    |
| Server verdicts: rooms, booths, margins, tabs, grace, stages, let-speak                 | `apps/api/src/calls/call-hearing.test.ts`                                                                                        |
| Room state by role: hearing, let-speak, stopped shares, tab cache, cost                 | `apps/api/src/calls/room-calls.test.ts`                                                                                          |
| The route answers `not_heard` in place, fails open                                      | `apps/api/src/calls/subscribe-hearing.test.ts`, `routes/calls.test.ts`                                                           |
| Through the real room: proof kept, hearing, let-speak refused, stop-share               | `apps/api/src/document-room-calls.test.ts`                                                                                       |
| The shared geometry                                                                     | `packages/document/src/call-geometry.test.ts`                                                                                    |
| `not_heard` held back and retried with backoff; the call re-proves                      | `apps/editor/lib/calls/sfu-session.test.ts`, `proximity-call.test.ts`                                                            |
| Part 4: the tile, its place in Rooms, its search words                                  | `apps/editor/components/palette/palette-tile-defs.test.tsx`, `palette-layouts.test.ts`, `apps/editor/lib/palette-search.test.ts` |
| Part 4: the Stage section's tiles, switch and calls                                     | `apps/editor/components/palette/StageMenuSection.test.tsx`                                                                       |
| Part 4: the setter patches stages only, counted once                                    | `apps/editor/hooks/canvas/useDataShapeSetters.stage.test.ts`                                                                     |
| Part 4: no Stage settings in a Participant's or Viewer's menu                           | `apps/editor/components/palette/ReadOnlyElementMenuHost.test.tsx`                                                                |
| Part 4: a Participant's change to a stage's settings kept as stored                     | `packages/document/src/participant-content.leak.test.ts`                                                                         |
| Part 4: the hall stands a real stage, cameras on, no rug; its presenter reaches the tab | `packages/templates/src/template-builders-office.test.ts`, `apps/editor/lib/calls/stage.test.ts`                                 |

## Constants and configuration

Part 1 adds no constant: the interior comes from the room's own `ROOM_WALL` and `ROOM_BACK_FACE`. Part 2 adds
`STAGE_FRONT` (24, the front face), `STAGE_FLOOR` (`#fbf7ef` on light paper, `#3a3430` on dark) and
`DEFAULT_STAGE_SPEAKERS` (`edit`), in `packages/document/src/office.ts`. Part 3 adds `HANDS_MAX` (the room's
`ROOM_MAX_CONNECTIONS`, 100: one hand a connection) in `calls-hands-store.ts`, `PRESENCE_ID_MAX` (64, the room's other id
bound) in `call-hand.ts`, and the Do Not Disturb colour `#e11d48` (rose 600, apart from In a Meeting's red
`#ef4444` by its bar).
