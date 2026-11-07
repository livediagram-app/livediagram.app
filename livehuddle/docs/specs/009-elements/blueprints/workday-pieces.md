# Workday pieces blueprint

Derived from [Workday pieces](../workday-pieces.md).

## Files

| File                                                             | Role                                                                                                                                                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/office-workday.ts`                        | The drawings (`OFFICE_WORKDAY_ART`), `WORKDAY_TONES`, and where the live parts go (`TREADMILL_BELT`, `PHONE_BOOTH_LAMP`, `HOT_DESK_CARD`, `RECEPTION_BELL`)                                   |
| `packages/document/src/pet-wander.ts`                            | The dog's legs: `petLeg`, `petLegAt`, `msToNextLeg`, `petArea`, `hashId`, `seeded`; pure                                                                                                      |
| `packages/document/src/call-geometry.ts`                         | `roomZones` adds each Phone Booth's floor (`boothInterior`) as a zone                                                                                                                         |
| `packages/document/src/office.ts`                                | The eight kinds join `OfficeKind` and `OFFICE_ART`                                                                                                                                            |
| `../packages/avatar/src/office-geometry.ts`                      | The six seats join `FixedSeatKind`; `isStandingSeatShape`; the reception desk's footprint                                                                                                     |
| `../packages/avatar/src/booth.ts`                                | `boothInterior`: the booth's floor, its call zone                                                                                                                                             |
| `../packages/avatar/src/seats.ts`                                | `NAP_POD_SEATS`, `TREADMILL_SEATS`, `WEIGHT_BENCH_SEATS`, `PHONE_BOOTH_SEATS`, `STANDING_DESK_SEATS`, `HOT_DESK_SEATS`                                                                        |
| `../packages/avatar/src/status.ts`                               | `AVATAR_BREAK_STATUS` (Activity), `AVATAR_BUSY_STATUS` (Availability); their signatures in `../packages/avatar/src/components/avatar-status-effects.tsx`                                      |
| `../packages/avatar/src/seat-status.ts`                          | `pieceStatusOf`, `shownStatus`: the status that shows from yours, the piece's and when you picked                                                                                             |
| `../packages/api-schema/src/avatar.ts`                           | `break` and `busy` join `AVATAR_STATUS_IDS`                                                                                                                                                   |
| `packages/api-schema/src/bell.ts`                                | `AvatarBellOp`, `parseAvatarBell`, `BELL_THROTTLE_MS`                                                                                                                                         |
| `apps/api/src/room-op-gate.ts`, `document-room/document-room.ts` | The bell is presence from any level; throttled per sender (`createKnockThrottle(BELL_THROTTLE_MS)`)                                                                                           |
| `apps/editor/components/canvas/useSeatStatus.ts`                 | Wraps `useAvatarStatus`: the shown status, and the pick that records the seat it was made on                                                                                                  |
| `apps/editor/components/canvas/collab/WorkdayFaces.tsx`          | `WorkdayArt` in the piece's grid (the running belt, the booth's lamp, the Hot Desk's name card, the bell's waves) and `WorkdayFace` over its box (the Welcome bubble with Ring Bell, the dog) |
| `apps/editor/lib/office/reception-bell.ts`                       | The ringer store, the bell inbox, earshot, `useReceptionBell`; the ding                                                                                                                       |
| `apps/editor/lib/office/useWorkdayPieces.ts`                     | Which reception desk your feet stand at (`useAtReception`), and each bed's area (`usePetArea`)                                                                                                |
| `apps/editor/app/workday-motion.css`                             | The belt, the trot, the wag, the heart and the bell's waves; none under reduced motion                                                                                                        |

## Domain and naming

| Term          | Identifier                                    | Meaning                                                                 |
| ------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| Piece status  | `pieceStatusOf(kind)`                         | The status a seat piece shows while you sit: `focus`, `break`, `busy`   |
| Shown status  | `shownStatus(own, pickedOn, seatedOn, piece)` | The status peers and the panel see                                      |
| Standing seat | `isStandingSeatShape`                         | Treadmill, standing desk: held like a seat, drawn standing              |
| Leg           | `petLeg(id, n, area)`                         | One 9 s step of the dog: a spot, or the bed (every fourth)              |
| Pet area      | `petArea(bed, rooms)`                         | The innermost room's interior holding the bed's middle, else the circle |
| Earshot       | `hearsBell(desk, self, zones)`                | Your zone and the desk's room, for whether a ring reaches you           |

## Behaviour and state

- **Shown status** (`shownStatus`): `piece && pickedOn !== seatedOn ? piece : own`, where `piece` is
  `pieceStatusOf` of the kind you sit on (null when standing or the piece is gone), and `pickedOn` the `seatedOn` you
  had when you last picked. `useSeatStatus` keeps `own` and `pickedOn`; on a change of `seatedOn` it resets
  `pickedOn` to null (adjusted during render), so a pick made while seated outlives that seat as `own` but a later
  seat shows its piece again. The walk publishes the shown status; leaving the mode clears `own` (useAvatarStatus).
  Because `useAvatarWalk` returns `seatedOn` and takes `status`, `useCanvasAvatar` keeps the seat it read last render
  in state (one render's lag, adjusted during render, not an effect).
- **Standing pose**: the canvas draws a sitter `seated` only when the piece it holds is not a standing seat
  (`sitsDown`, over a set of standing-seat ids rebuilt per board change).
- **The booth's call**: `roomZones` pushes a Phone Booth's `boothInterior` (the drawn rect inset 6 px of 80 on each
  side and from 40 px of 136 down to 6 px from its foot); the api's hearing check reads the same function.
- **The dog**: leg `n = petLegAt(now)`; `petLeg(id, n, area)` is null (the bed) when `n % 4 === 3`, otherwise a
  point from `seeded(hashId(id) ^ n * 0x9e3779b1)` inside the area (inset by `PET_INSET`); `dogOffset` makes it
  relative to the bed. The areas are worked out per board change (`petAreasOf`) and published per bed. `PetDog` sets its spot with a timeout to
  the next leg boundary (one per dog), translating from the bed with a `PET_TROT_MS` CSS transition. Reduced motion, or no area
  yet: the spot is always the bed and the dog sleeps.
- **Welcome**: `receptionAt(feet, desks)`: the desk whose front strip (`x - 0 .. x + width`, `y + 0.62 h .. y + h +
RECEPTION_REACH`) holds your feet. A module store like the arcade's; a step re-renders nothing unless the answer
  changes.
- **Ringing**: the face calls `ringBell(deskId)`, which the canvas hook points at `send({ kind: 'avatar-bell', deskId
})` while walking; `ringBell` starts the 5 s Rang itself; the ringer plays its own ding and waves (no toast). A received op
  (`receiveBellOp`) reaches `useReceptionBell`, which checks the desk is a Reception Desk on the board, you walk, you
  are not on Do Not Disturb, and `hearsBell`: the desk's room (`meetingPieceRoom`) equals your zone, or the desk has
  no room and your feet are within `BELL_RADIUS`. Then the ding, the waves (`bumpBell(deskId)`) and the toast.

## Interfaces and contracts

- `AvatarBellOp = { kind: 'avatar-bell'; tabId: string; deskId: string }`; `parseAvatarBell` rejects anything else
  (empty or over-long ids). The client sends `{ kind: 'avatar-bell', deskId }` (the room connection adds `tabId`).
- `AVATAR_STATUS_IDS` gains `break` and `busy`; an older client's `parseAvatarStatus` drops them (no status).

## Data and persistence

Nothing new is stored: the eight kinds are elements with no fields of their own. Statuses, seats, the bell and the
dog are presence, the clock or local.

## Errors and edge cases

- A piece deleted while sat on: `pieceStatusOf` finds no element, so the own status shows.
- A ring for a desk not on the receiver's board, or not a Reception Desk: dropped.
- A dog whose room is too small for its inset: it wanders the circle round its bed instead.
- Two sitters at once on a Hot Desk: the seat claim settles it; the card names the holder.

## Security and trust

- The bell is throttled in the room (one per sender per `BELL_THROTTLE_MS`) and parsed at the gate; a Viewer's
  passes, as a knock does. The receiver checks its own earshot, so a crafted desk id rings nobody far away.

## Performance and limits

- The shown status is a constant-time lookup per render. The standing set is built once per board change.
- `receptionAt` runs on a change of your feet over the few desks (picked once per board change), like `arcadeAt`.
- The dog: one timeout per dog per 9 s; `petLeg` is a hash and two PRNG draws. A test holds 100000 legs inside a
  CPU budget.
- The booth adds one zone per booth to `roomZones`, which already loops every element once.

## Presentation and UX

- Copy: **Welcome**, **Ring Bell**, **Rang**, **Hot Desk**, **Pat the Dog**, toast "{name} rang the bell at
  Reception" ("Someone" without a name).
- The bubble follows the Insert Coin bubble's style; the Ring Bell button is a piece control (never walks, drags or
  selects).

## Accessibility

- The bubble is `role="status"`; Ring Bell and the dog are buttons with labels; the name card is text in the piece's
  label for screen readers ("Hot desk, Sam sitting").
- Reduced motion: no belt, no trot or wag, no heart rise, no bell waves; the dog sleeps in its bed.

## Observability

`Canvas · Used · ReceptionBell` on each ring sent, `Canvas · Used · PatPet` on each pat.

## Testing

| Rule                                          | Test                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| Seats, standing seats, footprints, booth zone | `../packages/avatar/src/workday-pieces.test.ts`, `call-geometry.test.ts`    |
| Shown status                                  | `../packages/avatar/src/workday-pieces.test.ts`, `useSeatStatus.test.tsx`   |
| Drawings and kinds                            | `packages/document/src/office-workday.test.ts`                              |
| The dog's legs and CPU budget                 | `packages/document/src/pet-wander.test.ts`                                  |
| Bell parse, gate (every level), throttle      | `packages/api-schema/src/bell.test.ts`, `apps/api/src/room-op-gate.test.ts` |
| Earshot, Welcome, ringing                     | `apps/editor/lib/office/reception-bell.test.ts`, `useWorkdayPieces.test.ts` |
| Faces                                         | `apps/editor/components/canvas/collab/workday-views.test.tsx`               |
| Templates                                     | `packages/templates/src/template-workday.test.ts`                           |

## Constants and configuration

| Constant           | Value | Why                                                 |
| ------------------ | ----- | --------------------------------------------------- |
| `PET_LEG_MS`       | 9000  | Long enough to read as a dog settling, not a sprite |
| `PET_TROT_MS`      | 3000  | A third of a leg spent moving                       |
| `PET_RADIUS`       | 240   | A bed in no room keeps its dog close                |
| `PET_INSET`        | 28    | The dog stays off the walls                         |
| `RECEPTION_REACH`  | 32    | As the arcade's reach, a step more for a wide desk  |
| `BELL_RADIUS`      | 480   | Across an open lobby                                |
| `BELL_THROTTLE_MS` | 5000  | A ring, not a rattle                                |

## Defaults ledger

- Dog only (no cat), no name, pats local: the smallest delight that needs no wire (spec "Not in scope").
- The booth's zone is its inside, with no walls: a seat stops a second person, so no door is needed.
