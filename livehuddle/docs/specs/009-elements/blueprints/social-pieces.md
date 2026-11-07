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
| `apps/editor/lib/table-games/game-seats.ts`                   | `gameSeats`: the player on each seat of a game piece (Editors and Participants only), `sameGameSeats`           |
| `apps/editor/lib/table-games/table-game-scene.ts`             | The tab's scene (you, who sits where, the room), `useGameSeats`, `sendGameOp`, `setGameOn` / `useGameOn`        |
| `apps/editor/lib/table-games/useTableGameScene.ts`            | The canvas publishes the scene (from useCanvasAvatar): your seat, each peer's seat and role, the sender         |
| `apps/editor/lib/table-games/pong-session.ts`                 | `PongSession`: one table's game on one screen: seats, trust, your moments, the silent rule, the scoreboard      |
| `apps/editor/components/canvas/collab/usePingPong.ts`         | The session wired to the seats, the inbox, the keys and one rAF loop that draws through refs                    |
| `apps/editor/components/canvas/collab/PingPongGame.tsx`       | The ball, both paddles, the scoreboard and your paddle's pointer control, over the table's art (a social face)  |
| `../packages/avatar/src/key-claims.ts`                        | `claimAvatarKeys`, `avatarKeyClaimed`: keys a piece takes from the walk and the action keys while it holds them |

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
| Player     | `GamePlayer`, `GameSeats`   | The Editor or Participant on a game piece's seat, from presence        |
| Session    | `PongSession`               | One table's game on one screen                                         |
| Scoreboard | `PongView`, `PongStatus`    | `rest`, `ready`, `play`, `won` or `reduced`, the score, the winner     |

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

Built in two parts: part 1 the spec, the wire, the room's rule and the model; part 2 (this state) the session, the
drawing and the controls.

- **The wire**: `game-input` and `game-event` are presence op kinds (`PRESENCE_OP_KINDS`, room-messages.ts), so the
  room relays them unordered and never logs them. `gateClientOp` drops either from a Viewer, and either that fails
  its parser. `game-input` joins `ROOM_SAMPLE_KINDS` (document-room.ts), so `PresenceRelay` sends it to its `tabId`'s
  sockets only and, in a room of more than 10, coalesces it to the sender's newest sample each step. The editor sends
  both through the canvas's `onCallSignal` (`CallSignal` takes them without their `tabId`; `broadcastCallSignal`
  stamps the active tab), so no new prop crosses the editor.
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
  listeners; each table's `usePingPong` listens and keeps only the ops for its piece on the scene's tab.
- **The scene** (`useTableGameScene`, called by `useCanvasAvatar` after `seatsOf`): you first (`You`, your colour,
  `avatar.seatedOn`, `seatClaim.index`, `plays: takePart`), then each `remoteAvatars` row (its seat by `claimOf` over
  `seatsOf(seatedOn)`, else its claim's index; `plays` when the row's `role`, carried by `buildRemoteAvatarRows`, is
  `edit` or `participate`; a missing role reads as a Viewer's). Memoised on presence and your seat, and published by an
  effect into the module store with one stable sender over the newest `onCallSignal` (null with no room).
  `useGameSeats(piece, 2)` reads `gameSeats` through `useSyncExternalStore`, kept by `sameGameSeats`, so a walker
  elsewhere re-renders no table. The first source listed holds a doubly claimed seat.
- **The session** (`PongSession`, one per table per screen, pure): `setSeats(players, canPlay)` ends the match when a
  seat's player id changes (a stand-up, leaving the mode, the tab or the document) or, for a player, when `canPlay`
  (motion not reduced) changes. `receive(from, op, now)` keeps an op only when `from` is the id on `op.seat` and is
  not you, records that seat as heard (it can play), and eases its paddle toward a `game-input`'s axis or applies a
  `game-event` with `applyPongEvent`. `tick(now, dt)` eases the other paddle (time constant `PADDLE_EASE_MS`, 50 ms),
  ends the match past `silentAfter` (the waiting seat unheard again, your own screen announcing again), else takes
  your moment, then sends your paddle. Your moments, only while you play, your screen can play and both seats are
  ready (you by `canPlay`, the other by being heard): the left seat opens a match `servePauseMs` after both became
  ready, or `wonPauseMs` after a win (`serve`, seq 1, a fresh 12-character id, the ball from `serveBall` at your
  paddle with a random tilt); the server serves `servePauseMs` after a point; at your end, `arrivalMs` after the ball
  left, `strike` at your paddle sends `hit` or `miss` (the point to the other seat). Each sent moment is applied
  locally through the same reducer. Your paddle (`game-input`) goes out at most every `GAME_INPUT_MS`: on change,
  once as soon as both seats are held, after a game ends, and every `READY_REPEAT_MS` (1 s) while no match is on
  show. A match turning `won` on the left player's screen calls `onWon` once per match id:
  `track('Canvas', 'Used', 'PingPong')`. The scoreboard (`shownView`, a new object only when its status, score or
  winner changes): `play` or `won` with a match; without one, `reduced` for a player whose motion is reduced with
  the other seat held, `ready` when both seats are ready, else `rest`. `ball(now)`: in flight `ballShown`; before a
  serve resting `ballR + 0.02` in front of the server's paddle at that paddle's height; none with no match. Your
  paddle clamps to `PADDLE_MIN`..`PADDLE_MAX` (`paddleHalf` in from each long side); a held key moves it
  `PADDLE_KEY_SPEED` (1.5 play areas a second).
- **The loop** (`usePingPong`): runs only with both seats held. Under full motion one `requestAnimationFrame` steps
  the held keys (`nudge`), `tick`s (a frame's step capped at 100 ms) and draws through the component's refs; under
  reduced motion a 250 ms `setInterval` ticks and draws nothing. After each step and each received op
  `setView(session.shownView)`, a no-op for React unless the scoreboard changed. `setGameOn(piece, status is ready,
play or won)` tells `SocialArt`'s `RestingRally` to give way.
- **The keys**: while you play at the table and a game is on (`ready`, `play`, `won`) under full motion,
  `claimAvatarKeys` holds W, S, Arrow Up and Arrow Down without Meta, Ctrl or Alt; `useAvatarKeys` (steering, which
  stands you up) and `useAvatarActionKeys` (W waves, S spins) return early for a claimed key. The game's own window
  listeners keep the held up and down flags (not in a field or behind a modal, `walkInputBlocked`; all dropped on
  blur and when the claim is released).
- **The drawing** (`PingPongGame`, the table's `SocialFace`): nothing with a seat empty or status `rest`. Over
  `Overlay` (the art's drawn rectangle), an SVG on the art's 184 by 112 grid maps the play area onto `PING_PONG_TOP`
  (`x 28, y 30, w 128, h 44`): each paddle a 3-wide rounded bar `2 * paddleHalf * h` long in its player's colour with
  a white edge, on its `paddleLine`; the ball a white circle of radius 2.4 with an amber edge and a soft shadow; each
  moved by a `transform` attribute per frame (`translate(-999 -999)` with no ball). The SVG is left out under reduced
  motion. For you, while you play under full motion, a piece-control layer (`pieceControlProps`, `cursor-ns-resize`,
  `touch-none`) over the drawn rectangle sets your paddle from the pointer's height over the table top on
  `pointerdown` (capturing the pointer, so a finger can drag beyond the table) and `pointermove`. The scoreboard,
  `role="status"`, is centred with its bottom 3 grid units above the table top: in play two halves, `IDENTITY_FILL`
  in each player's colour, the left's points on the left in tabular figures, with a screen-reader sentence
  (`You 3, Ann 5`); `Ready` and `Motion Reduced` in the neutral pill; `<Name> Wins` (`You Win`) in the winner's
  colour.

### Ping-pong performance and limits

- A frame at a table with a game: one `tick` (a handful of comparisons, one `Math.exp`, at most one `ballAt`) and
  three `setAttribute` calls; no allocation beyond the ball's point and three short strings, and no React render. The
  unit test runs 100,000 ticks with `ball()` inside 300 ms of CPU (`cpuMsOf`).
- A table with an empty seat runs nothing per frame. A table re-renders only when its players or its scoreboard
  change.
- Network: a moving paddle at most 20 `game-input` a second, a still one none during a game and one a second while
  waiting; one `game-event` per moment (about one a second in a rally). The ball never goes over the wire.
