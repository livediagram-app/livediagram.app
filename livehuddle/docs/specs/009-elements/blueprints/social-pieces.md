# Social pieces blueprint

Derived from [Social pieces](../social-pieces.md).

## Files

| File                                                          | Role                                                                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/office-social.ts`                      | The drawings (`OFFICE_SOCIAL_ART`), `pondParts`, the note and zone types, limits and validators                 |
| `packages/document/src/office-recreation.ts`                  | The second set's drawings (`OFFICE_RECREATION_ART`): pool, foosball, dartboard, vending, bean bag, reading nook |
| `packages/document/src/furniture-parts.ts`                    | `rect`, `ellipse`, `path`, `allSides`: the part builders every office drawing module shares                     |
| `packages/document/src/office.ts`                             | The kinds join `OfficeKind`; the pond is a sized kind                                                           |
| `packages/document/src/participant-content.ts`                | `mergeNoticeNotes`: a Participant adds and removes only its own notes                                           |
| `packages/document/src/element-deltas.ts`                     | The `notice-pin` and `notice-unpin` deltas, applied on every screen and in the store                            |
| `packages/document/src/validate-shape.ts`                     | `noticeNotes`, `clockZones`, `jukeboxSource` validation                                                         |
| `../packages/avatar/src/office-geometry.ts`                   | Footprints (`OFFICE_FOOTPRINT`), the fixed seats, `isWallPieceShape`                                            |
| `../packages/avatar/src/seats.ts`                             | `PING_PONG_SEATS`, `BENCH_SEATS`, `PICNIC_TABLE_SEATS`, `HAMMOCK_SEATS`, `BEAN_BAG_SEATS`, `READING_NOOK_SEATS` |
| `../packages/avatar/src/walk.ts`                              | `elementUnderFeet` skips wall pieces                                                                            |
| `apps/editor/components/canvas/collab/SocialArt.tsx`          | The live parts drawn over a piece's art: rally, fire, water, screen, jukebox lights, night glow                 |
| `apps/editor/components/canvas/collab/SocialFaces.tsx`        | The Notice Board's cards and Notes button, the World Clock's dials, the Jukebox's button                        |
| `apps/editor/lib/piece-control.ts`                            | `pieceControlProps`, `isPieceControlPress`: a face's control keeps its press from the canvas                    |
| `apps/editor/components/canvas/collab/NoticeBoardPopover.tsx` | The note list and add box                                                                                       |
| `apps/editor/components/canvas/collab/PondView.tsx`           | The pond at its own size                                                                                        |
| `apps/editor/components/canvas/collab/useSocialPieces.ts`     | Which jukebox's area you stand in, the Insert Coin bubble, the audio element                                    |
| `apps/editor/lib/minute-clock.ts`                             | The one shared minute timer (`useMinuteNow`)                                                                    |
| `apps/editor/lib/jukebox-listening.ts`                        | The viewer's off / on / muted choice (this device), the shared audio element                                    |
| `apps/editor/components/palette/SocialMenuSections.tsx`       | `WorldClockMenuSection`, `JukeboxMenuSection`                                                                   |
| `apps/editor/app/social-motion.css`                           | The CSS loops, none under reduced motion                                                                        |
| `packages/api-schema/src/table-game.ts`                       | The game wire: `GameInputOp`, `GameEventOp`, `parseGameInput`, `parseGameEvent`, `GAME_INPUT_MS`                |
| `apps/api/src/room-op-gate.ts`                                | Drops a Viewer's `game-input` and `game-event`, and a malformed one from anyone                                 |
| `apps/editor/lib/table-games/ping-pong.ts`                    | The game as pure functions: the ball's flight, a strike, service and winning, `applyPongEvent`                  |
| `apps/editor/lib/table-games/table-game-inbox.ts`             | `receiveGameOp` (from the room connection), `onGameOp` (the table showing a game)                               |

## Domain and naming

| Term       | Identifier                  | Meaning                                                                |
| ---------- | --------------------------- | ---------------------------------------------------------------------- |
| Note       | `NoticeNote`, `noticeNotes` | `{ id, title?, text, author, by, at, color? }`, oldest first           |
| Zone       | `ClockZone`, `clockZones`   | `{ zone, label }`, up to six                                           |
| Source     | `jukeboxSource`             | An `https` audio address                                               |
| Listening  | `JukeboxListening`          | `'off' \| 'on' \| 'muted'`, per device                                 |
| Wall piece | `isWallPieceShape`          | Notice board, world clock, dartboard: never blocks, never rung         |
| Night glow | `NightGlow`, `NIGHT_GLOW`   | The light a lit piece throws on dark paper (vending window, nook lamp) |
| Play area  | `PONG`, `paddleLine`        | The table top, 0 to 1 across (seat 0's end to seat 1's) and down       |
| Match      | `PongMatch`                 | `{ match, seq, score, phase, ball, since }` as one screen keeps it     |
| Moment     | `GameEventOp`               | A `serve`, `hit` or `miss`, sent by the seat whose moment it is        |

## Behaviour and state

- **The second set** (pool table, foosball table, dartboard, vending machine, bean bag, reading nook) is art and walk
  geometry only. Footprints in `OFFICE_FOOTPRINT`: pool table `x 8..192 / 200, y 50..120 / 128`, foosball table
  `x 12..156 / 168, y 44..98 / 104`, vending machine `x 4..68 / 72, y 96..124 / 128`. The dartboard joins
  `isWallPieceShape`. The bean bag and the reading nook join `FixedSeatKind` (`BEAN_BAG_SEATS`: one seat at
  `(0.5, 36/56)`; `READING_NOOK_SEATS`: one at `(76/160, 64/112)`, both facing down) and so `seatsACharacter`, and
  FurnitureView rings their one sitter. Click intent (`avatar-click-intent.ts`): every one `walk`.
- **The night glow**: `SocialArt` draws `NightGlow` over a vending machine or a reading nook only while
  `useCanvasSurface()` is `'dark'`: a radial-gradient pool on the floor and a soft wash over the lit part, at the grid
  positions `NIGHT_GLOW[kind]` (office-recreation.ts) names. Static, no class on a loop; the export renderer never
  draws it.

- **Pinning**: the popover sends one delta through the editor's `applyElementDelta` (`useElementDeltas`), never a
  history commit: `{ kind: 'notice-pin', note }` or `{ kind: 'notice-unpin', noteId, by }`. `applyElementDelta`
  (`element-deltas.ts`) applies it on the sender, every receiver and the store: only on a notice board that is not
  locked, a pin only when the note passes `isNoticeNote`, its id is new and the board holds fewer than `NOTES_MAX`, an
  unpin only when the note's `by` matches. `mergeIncomingElement` keeps the receiver's `noticeNotes`,
  `elementChangeIsDeltaOnly` leaves them out of its comparison (so a notes-only change sends no `el` update), and
  `graftLiveTabState` carries them over an undo or redo. The room's ledger (`collab-ledger.ts`) records each pin and
  unpin, so an Editor's save snapshotted before a pin merges it.
- **The room's rule**: `notice-pin` and `notice-unpin` are participation deltas (`PARTICIPATION_DELTA_KINDS`); the op
  gate (`room-op-gate.ts`) relays a Participant's only when `answersAsSelf` finds the note's (or the unpin's) `by`
  equal to the session's adder key, then schedules the room's answers write, which folds the ledger's notes into the
  stored tab (`mergeLedgerAnswersIntoTab`), applying each against the stored board. A Viewer's is dropped.
  `mergeNoticeNotes` stays on the participant content rule, as defence against an older screen's `el` update.
- **The minute**: `useMinuteNow` is a `useSyncExternalStore` over one `setTimeout` to the next whole minute, armed while
  one clock is subscribed and cleared when the last unsubscribes.
- **The jukebox**: `useSocialPieces` (in `useCanvasAvatar`) narrows the elements to jukeboxes, arcades and rooms once
  per element change, then on each move of your feet works out the jukebox whose area holds you and the arcade you
  stand at; an effect sets the one shared `HTMLAudioElement`'s source and plays or pauses it only when that answer,
  the source or your choice changes.

## Ping-pong (Work Tracker #528)

Built in two parts. Part 1 (this blueprint's state) is the spec, the wire, the room's rule and the model; nothing on
screen reads them yet, and the table still plays only its decorative rally. Part 2 adds the session, the drawing and
the controls.

- **The wire**: `game-input` and `game-event` are presence op kinds (`PRESENCE_OP_KINDS`, room-messages.ts), so the
  room relays them unordered and never logs them. `gateClientOp` drops either from a Viewer, and either that fails
  its parser. `game-input` joins `ROOM_SAMPLE_KINDS` (document-room.ts), so `PresenceRelay` sends it to its `tabId`'s
  sockets only and, in a room of more than 10, coalesces it to the sender's newest sample each step.
- **The model** (`ping-pong.ts`): `ballAt(ball, ms)` is the closed form of the flight (x straight, y folded between
  `ballR` and `1 - ballR`), so a frame's work is one call and no state; `arrivalMs` is when the ball reaches the
  paddle line it travels to (`endOf`); `strike(ball, seat, paddleY)` judges the meeting at that line and returns
  the new flight (angle from the offset, speed times `speedUp` to `maxSpeed`) or null for a miss; `serverAt` and
  `winnerAt` are the table tennis rules (first to 11 by two, service every two points and every point from 10 all).
- **A match**: `applyPongEvent(current, ev, now)` is the one reducer every screen runs on every moment, its own
  included. The left seat's `serve` with `seq` 1 at 0 all opens a match; any other moment must carry the next `seq`
  of the match on show, come from `nextSeat` (the server while `serve`, the ball's end while `flight`), and keep the
  score (`serve`, `hit`) or give the point to the other seat (`miss`); anything else returns `current` unchanged.
  `ballShown` holds the ball at the far paddle line until that end's word comes; `silentAfter` is when the waiting
  seat counts as gone.
- **The inbox**: `useRoomConnection` hands both kinds to `receiveGameOp`, which parses and notifies `onGameOp`
  listeners. The listener (part 2) checks the sender's presence id sits on the seat the op names.
