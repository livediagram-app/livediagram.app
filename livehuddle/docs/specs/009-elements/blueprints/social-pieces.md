# Social pieces blueprint

Derived from [Social pieces](../social-pieces.md).

## Files

| File                                                             | Role                                                                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/office-social.ts`                         | The drawings (`OFFICE_SOCIAL_ART`), `pondParts`, the note and zone types, limits and validators                  |
| `packages/document/src/office-recreation.ts`                     | The second set's drawings (`OFFICE_RECREATION_ART`): pool, foosball, dartboard, vending, bean bag, reading nook  |
| `packages/document/src/furniture-parts.ts`                       | `rect`, `ellipse`, `path`, `allSides`: the part builders every office drawing module shares                      |
| `packages/document/src/office.ts`                                | The kinds join `OfficeKind`; the pond is a sized kind                                                            |
| `packages/document/src/participant-content.ts`                   | `mergeNoticeNotes`: a Participant adds and removes only its own notes                                            |
| `packages/document/src/element-deltas.ts`                        | The `notice-pin` and `notice-unpin` deltas, applied on every screen and in the store                             |
| `packages/document/src/validate-shape.ts`                        | `noticeNotes`, `clockZones`, `jukeboxSource` validation                                                          |
| `../packages/avatar/src/office-geometry.ts`                      | Footprints (`OFFICE_FOOTPRINT`), the fixed seats, `isWallPieceShape`                                             |
| `../packages/avatar/src/seats.ts`                                | `PING_PONG_SEATS`, `BENCH_SEATS`, `PICNIC_TABLE_SEATS`, `HAMMOCK_SEATS`, `BEAN_BAG_SEATS`, `READING_NOOK_SEATS`  |
| `../packages/avatar/src/walk.ts`                                 | `elementUnderFeet` skips wall pieces                                                                             |
| `apps/editor/components/canvas/collab/SocialArt.tsx`             | The live parts drawn over a piece's art: rally, fire, water, screen, jukebox lights, night glow                  |
| `apps/editor/components/canvas/collab/SocialFaces.tsx`           | The Notice Board's cards and Notes button, the World Clock's dials, the Jukebox's button                         |
| `apps/editor/lib/piece-control.ts`                               | `pieceControlProps`, `isPieceControlPress`: a face's control keeps its press from the canvas                     |
| `apps/editor/components/canvas/collab/NoticeBoardPopover.tsx`    | The note list and add box                                                                                        |
| `apps/editor/components/canvas/collab/PondView.tsx`              | The pond at its own size                                                                                         |
| `apps/editor/components/canvas/collab/useSocialPieces.ts`        | Which jukebox's area you stand in, the Insert Coin bubble, the audio element                                     |
| `apps/editor/lib/minute-clock.ts`                                | The one shared minute timer (`useMinuteNow`)                                                                     |
| `apps/editor/lib/jukebox-listening.ts`                           | The viewer's off / on / muted choice (this device), the shared audio element                                     |
| `apps/editor/components/palette/SocialMenuSections.tsx`          | `WorldClockMenuSection`, `JukeboxMenuSection`                                                                    |
| `apps/editor/app/social-motion.css`                              | The CSS loops, none under reduced motion                                                                         |
| `packages/api-schema/src/table-game.ts`                          | The game wire: `GameInputOp`, `GameEventOp`, `parseGameInput`, `parseGameEvent`, `GAME_INPUT_MS`                 |
| `apps/api/src/room-op-gate.ts`                                   | Drops a Viewer's `game-input` and `game-event`, and a malformed one from anyone                                  |
| `apps/editor/lib/table-games/ping-pong.ts`                       | The game as pure functions: the ball's flight, a strike, service and winning, `applyPongEvent`                   |
| `apps/editor/lib/table-games/table-game-inbox.ts`                | `receiveGameOp` (from the room connection), `onGameOp` (the table showing a game)                                |
| `apps/editor/lib/table-games/game-seats.ts`                      | `gameSeats`: the player on each seat of a game piece (Editors and Participants only), `sameGameSeats`            |
| `apps/editor/lib/table-games/table-game-scene.ts`                | The tab's scene (you, who sits where, the room), `useGameSeats`, `sendGameOp`, `setGameOn` / `useGameOn`         |
| `apps/editor/lib/table-games/useTableGameScene.ts`               | The canvas publishes the scene (from useCanvasAvatar): your seat, each peer's seat and role, the sender          |
| `apps/editor/lib/table-games/pong-session.ts`                    | `PongSession`: one table's game on one screen: seats, trust, your moments, the silent rule, the scoreboard       |
| `apps/editor/components/canvas/collab/usePingPong.ts`            | The session wired to the seats, the inbox, the keys and one rAF loop that draws through refs                     |
| `apps/editor/components/canvas/collab/PingPongGame.tsx`          | The ball, both paddles, the scoreboard and your paddle's pointer control, over the table's art (a social face)   |
| `../packages/avatar/src/key-claims.ts`                           | `claimAvatarKeys`, `avatarKeyClaimed`: keys a piece takes from the walk and the action keys while it holds them  |
| `packages/document/src/arcade-scores.ts`                         | `ArcadeScore`, `MOON_MAIL_SCORING`, `arcadeScoreCeiling`, `isArcadeScore(s)`, `arcadeTableWith`, `arcadePlaceOf` |
| `packages/document/src/element-deltas.ts`                        | The `arcade-score` and `arcade-clear` deltas, applied on every screen and in the store                           |
| `packages/document/src/collab-ledger.ts`                         | The latest clear and the ten best scores after it, per machine; merged into saves and a Participant's answers    |
| `apps/api/src/document-room-rules.ts`                            | `answersAsSelf`: a Participant's `arcade-score` only when its `by` is the adder key; never its `arcade-clear`    |
| `apps/editor/lib/arcade/moon-mail.ts`                            | Moon Mail as a deterministic model: `newRun`, `hop`, `advance` (fixed 60 Hz steps), seeded spawns                |
| `apps/editor/lib/arcade/moon-mail-paint.ts`                      | `createMoonMailPainter`: draws a run on a 2D canvas in play units, its sky cached, its moments in fixed slots    |
| `apps/editor/lib/arcade/arcade-post.ts`                          | `arcadeScoreFor`: the score a finished run posts and the place it takes, or null; `arcadePlaceLine`              |
| `apps/editor/components/canvas/collab/ArcadeFace.tsx`            | The Insert Coin bubble, the cabinet's press and Enter / Space while you stand at it, the lazy panel's mount      |
| `apps/editor/components/canvas/collab/arcade/ArcadePanel.tsx`    | The panel (loaded by `lazy()`): who may play, the screen, posting, the High Scores, a Viewer's scores-only view  |
| `apps/editor/components/canvas/collab/arcade/useMoonMail.ts`     | One run on this screen: its phase, the strip, the keys, pausing, and one rAF loop that paints through a ref      |
| `apps/editor/components/canvas/collab/arcade/MoonMailScreen.tsx` | The square canvas, its Start / Paused / Game Over cards, the strip with the Pause button                         |
| `apps/editor/components/canvas/collab/arcade/HighScores.tsx`     | The table: rank, name (and **You**), score, day; the new row lit; **No Scores Yet**                              |
| `apps/editor/components/palette/ArcadeMenuSection.tsx`           | The Editor's menu section: the table's count and **Clear High Scores**, asked first                              |

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
  A screen with no match on show, or only a won one, joins a later moment of another match as it stands (a late
  watcher, "Watching"): a serve from the seat serving at that score after a point, a strike sending the ball away
  from the striker, or a miss giving the other seat a point.
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

## Arcade Machine (Work Tracker #529)

Built in three parts: part 1 the spec, the High Scores' stored shape, deltas, ledger and room rule, and Moon Mail's
model; part 2 the panel, the drawing, the controls and posting; part 3 (this state) the bubble's best score, the
Editor's Clear High Scores, copies starting empty, the answers flush's no-op and the two-browser test.

### Arcade domain and naming

| Term        | Identifier                    | Meaning                                                                       |
| ----------- | ----------------------------- | ----------------------------------------------------------------------------- |
| High Scores | `arcadeScores`                | The machine's table: `ArcadeScore[]`, best first, at most `ARCADE_SCORES_MAX` |
| Score       | `ArcadeScore`                 | `{ id, name, score, ms, by, at }`                                             |
| Ceiling     | `arcadeScoreCeiling(ms)`      | The most a run of `ms` can score (`MOON_MAIL_SCORING`)                        |
| Place       | `arcadePlaceOf(table, score)` | The 1-based place a score would take, or null when it does not make the table |
| Run         | `MoonMailRun`                 | One run of Moon Mail on one screen: ship, letters, rocks, score, shields      |
| Orbit       | `ORBITS`, `run.orbit`         | 0 (inner) to 2 (outer); radii in play units of the square screen              |
| Streak      | `run.streak`, `streakFor`     | Letters in a row without a hit, and the ×1 to ×5 it scores at                 |

### Arcade data and persistence

- `ShapeElement.arcadeScores?: ArcadeScore[]`, only meaningful on `arcade-machine`; absent = no scores. Validated in
  `validate-shape.ts` by `isArcadeScores`: an array of at most `ARCADE_SCORES_MAX` (10) valid scores with unique ids.
  Listed in `element-fields.ts`.
- `isArcadeScore(v)`: `id` 1 to 64 characters; `name` 1 to `ARCADE_NAME_MAX` (24) characters, not only spaces;
  `score` an integer from 1 to `arcadeScoreCeiling(ms)`; `ms` an integer from 1 to `ARCADE_RUN_MS_MAX` (7,200,000,
  two hours); `by` 1 to 128 characters; `at` a finite number.
- Table order (`compareArcadeScores`): higher `score` first, then earlier `at`, then `id` by code unit, so every
  screen sorts alike.
- `MOON_MAIL_SCORING` (`{ startLetters: 3, letterEveryMs: 900, letterPoints: 10, streakMax: 5, streakEvery: 5 }`)
  lives beside the ceiling, `(startLetters + floor(ms / letterEveryMs)) * letterPoints * streakMax`, in
  `packages/document`, and the game imports it, so the rule the room checks and the rule the game plays cannot
  drift apart.
- A copied machine starts empty: `arcadeScores` is in `ORIGINAL_ONLY_FIELDS` (`packages/document/src/duplicate.ts`),
  so Duplicate (`freshCopyFields`) and the clipboard (`stripIdentity`) both drop it. Duplicate Tab and a copied Space
  re-mint the tab's elements whole and keep it. An export draws the cabinet without it.

### Arcade behaviour and state

- **`arcade-score`** (`{ kind: 'arcade-score'; score: ArcadeScore }`): on a shape whose kind is `arcade-machine`,
  locked or not, with `isArcadeScore(score)` and no score of that id on the table, `arcadeTableWith(table, score)`
  inserts it in order and cuts to ten; when the new score is not among the ten the element comes back unchanged
  (the same object). Anything else: unchanged.
- **`arcade-clear`** (`{ kind: 'arcade-clear' }`): on an `arcade-machine` with scores, drops `arcadeScores`; else
  unchanged.
- `mergeIncomingElement` keeps the receiver's `arcadeScores`; `elementChangeIsDeltaOnly` leaves them out of its
  comparison; `graftLiveTabState` (comments.ts) carries them over an undo or redo. The participant content rule copies
  nothing of them from an `el` update (`mergePieces` copies only named fields), so an older screen's update keeps
  the stored table.
- **The ledger** (`ElementLedger.arcade?: { scores: Record<id, { score, seq }>; cleared?: number }`): an
  `arcade-score` with a valid score whose id is new to the entry is recorded, then the entry's scores are cut to the
  ten best by table order (the cut ones would be cut on the machine too, so the entry stays at ten); an
  `arcade-clear` sets `cleared` to its seq and drops every recorded score. `mergeLedgerIntoTab` applies the clear
  when `cleared > since`, then each score with `seq > since`, in seq order, each through `applyElementDelta`.
  `mergeLedgerAnswersIntoTab` takes the arcade entry whole (its clear and scores), so a Participant's score reaches
  the stored machine `ANSWERS_FLUSH_MS` after it is posted. Replayed from seq 0, the clear would drop the stored
  table and the scores rebuild the same one as new objects, so every later flush (any Participant's reaction, pin or
  press on the tab) rewrote the row for nothing: `applyArcadeEvents` hands back the element itself when the table it
  ends on holds the same scores in the same order (`sameArcadeTable`), so `writeParticipantAnswers` skips the write.
- **The room's rule**: `arcade-score` joins `PARTICIPATION_DELTA_KINDS` (room-messages.ts); `answersAsSelf` admits
  it when `score.by` equals the session's non-empty adder key. `arcade-clear` is not a participation delta, so the
  gate drops a Participant's; an Editor's relays as every Editor delta does. A Viewer's either is dropped.

### The table on the machine (part 3)

- **The bubble's best** (`ArcadeFace`): with `element.arcadeScores[0]`, a second line under **Insert Coin**,
  **Best 1,240 · Ann** (`arcadeBestLine`: the score in `en-GB` figures, the name truncated by CSS at 140 px), in the
  same button, so the press is unchanged; the `sr-only` status reads "Insert Coin. Best 1,240 by Ann". Read from the
  element, so a posted score or a clear on any screen re-renders it as the delta lands.
- **Clear High Scores** (`apps/editor/components/palette/ArcadeMenuSection.tsx`): in the
  Editor's element menu, under Tools, a **High Scores** section (the star glyph; the facing section after it already
  carries the piece's name) for an `arcade-machine` when `onClearArcadeScores` is given (the host passes
  it only at `can.level === 'edit'`; a Participant's and a Viewer's menus are their own). It reads **3 Scores on the table**
  (**1 Score on the table**) or **No Scores Yet**, and **Clear High Scores** (disabled while empty) first closes the menu (`onClose`: the menu's
  popover layer sits above the confirm's modal layer, so it would cover the confirm's buttons), then asks `useConfirm` with the title
  "Clear all 3 scores?" ("Clear 1 score?"), the message "This can't be undone. The table empties for everyone in
  the Space." and the confirm label **Clear High Scores**; confirmed, one
  `applyElementDelta(id, { kind: 'arcade-clear' })` and `track('Element', 'Changed', 'Arcade-machine')`.
- **The two-browser test** (`apps/editor/e2e/arcade-scores.spec.ts`): an owner seeds a machine in a Team Pod and
  shares it; a Participant joins, walks to the machine, plays until it scores, closes the panel (posting); the
  owner's bubble shows the Participant's best and a Viewer's panel lists it with **Viewers See the Scores** and no
  Start; the owner clears it from the menu and the Participant's reopened panel reads **No Scores Yet**.

### Moon Mail's model (`apps/editor/lib/arcade/moon-mail.ts`)

- **Deterministic**: no clock, no `Math.random`; a run carries its own seed (mulberry32), so the same seed and the
  same hops replay the same run. The model mutates the run it is given (one object per run, owned by the panel's
  loop), so a frame allocates nothing but a spawned letter or rock.
- **The square**: 0 to 1 each way, the moon at (0.5, 0.5), `MOON_R` 0.11, `ORBITS` radii `[0.2, 0.3, 0.4]`. The
  ship starts on orbit 1 at angle `-π/2` (the top) and moves clockwise on screen (its angle grows).
- **Steps**: `advance(run, dtMs)` adds `min(dtMs, MAX_FRAME_MS)` (250) to an accumulator and runs whole `STEP_MS`
  (1000 / 60) steps; nothing happens once `run.over`. A step first counts itself (`run.steps`, and `run.ms` the whole
  milliseconds those make, so every bound compares whole numbers), then moves the ship at its speed (1.1 rad/s,
  +0.015 rad/s each second, at most 2.6: `SHIP_SPEED_START`, `SHIP_SPEED_GAIN`, `SHIP_SPEED_MAX`) and each rock the
  other way, ages every item, spawns, and meets. The letter interval is `LETTER_EVERY_STEPS` (54 steps, exactly
  900 ms).
- **Letters**: three at the start, on orbits from the seed, at the ship's angle plus 1.2, 2.4 and 3.6 rad. The letter
  timer counts up each step; once it reaches `letterEveryMs` with fewer than `LETTERS_MAX` (5) waiting, one appears
  and the timer goes back to 0 (never carried over), on an orbit from the seed at the ship's angle plus π and up to
  ±π/2, so at most one appears per `letterEveryMs`.
- **Rocks**: the first at `FIRST_ROCK_MS` (2,000) into a run, then one every `rockEveryMs(ms)` (2,600 ms less 15 ms
  each second, at least 800: `ROCK_EVERY_START_MS`, `ROCK_EVERY_GAIN`, `ROCK_EVERY_MIN_MS`) while fewer than
  `ROCKS_MAX` (7) drift: on an orbit from the seed, at the ship's angle plus π and up to ±0.5, moving anticlockwise
  at 0.5 to 0.9 rad/s. A rock lives `ROCK_LIFE_MS` (9,000). A new rock never walls off all three orbits: when rocks
  within `ROCK_WALL_GAP` (0.6 rad) of its angle already hold both other orbits, it takes the lowest of theirs.
- **A tap** (`hopForTap(run, x, y)`): farther from the middle than the ship's orbit is `out`, else `in`.
- **Collisions**: an item on the ship's orbit is met when the arc between them (the angle difference wrapped to ±π,
  times the orbit's radius) is under `LETTER_REACH` (0.045) for a letter or `ROCK_REACH` (0.035) for a rock. A letter
  met scores `letterPoints * streakFor(streak)`, `streakFor(n) = min(1 + floor(n / streakEvery), streakMax)`, then
  `streak += 1`, and goes. A rock met while `ms >= hurtUntil` takes a shield, sets `streak` to 0 and `hurtUntil` to
  `ms + HURT_MS` (1,500), and goes; met while hurt it passes through. The last shield gone sets `over`.
- **Hops**: `hop(run, 'out' | 'in')` moves `orbit` by one within 0 to 2 at once (the drawing eases it) and records
  `hopAt`; a hop past either end, or once over, changes nothing and answers false.
- **What the drawing reads**: `run.orbit`, `run.angle`, `run.items` (kind, orbit, angle, age), `score`, `streak`,
  `shields`, `hurtUntil`, `hopAt`, `ms`, `over`, and the counters `letters` and `hits` (a flash per event).
- **The bound holds**: letters collected in a run of `ms` are at most `startLetters + floor(ms / letterEveryMs)`,
  each worth at most `letterPoints * streakMax`, so `run.score <= arcadeScoreCeiling(run.ms)` always; a test plays
  seeded runs with random hops and checks it at every step.

### The panel (part 2)

- **Opening** (`ArcadeFace`, the machine's `SocialFace`): with `useNearArcade(id)` false it draws nothing (a click walks
  to the front, `walkPointFor`). True, it draws the Insert Coin bubble inside one `<button>` laid over the whole box
  (`pieceControlProps`, `data-piece-main`, `cursor-pointer`, `aria-label="Play Moon Mail"`), so a press there opens
  and never walks; and, while the panel is shut, `claimAvatarKeys` holds plain Enter and Space, so `useAvatarKeys`
  (Space jumps) and `useAvatarSpeech` (Enter opens the message box, which now asks `avatarKeyClaimed` too) stand
  aside, and a window `keydown` opens the panel unless it repeats, `isTypingTarget`, `isEnterActivatedTarget` (a
  focused button keeps its own keys) or `walkInputBlocked()`. Open is `ArcadeFace`'s own state, independent of
  standing there, so the panel stays open if you are moved.
- **Loading**: `ArcadePanel` is `lazy(() => import('./arcade/ArcadePanel'))` under a `Suspense` whose fallback is a
  `ReaderShell` titled **Moon Mail** reading **Loading…**, so nothing of the game is in the editor's first load
  (`apps/editor/app/arcade-lazy.test.ts` walks the static imports from the editor's entries and finds none of it).
- **The shell**: `ReaderShell` with `widthClassName="max-w-[360px]"`, `initialFocus="container"` (so Space never
  presses Close) and `onBackdrop`: a run playing pauses, anything else closes. `useModalGuard(true)` while open, so
  `walkInputBlocked()` holds every walking input, the editor's shortcuts and the tours stand aside.
- **Who plays**: `useOptionalEditorContext()`, read only in the panel. `can.level` `edit` or `participate` plays; `view`
  or no editor shows `HighScores` alone with **Viewers See the Scores**. The signing key is `signingKeyOf(editor)`
  (`useNoteSigner.ts`): a Participant's adder key, an Editor's adder key or participant key. The tab is
  `activeTab.id` as the panel opens, so a score posted as the tab is left reaches the machine's own tab.
- **Posting** (`arcadeScoreFor(run, table, { key, name, now, id })`): null when the run scored 0, played under 1 ms,
  there is no key or `arcadePlaceOf` finds no place; else `{ score: { id, name, score, ms, by: key, at: now }, place }`
  with `name` from `arcadeName(selfParticipant.name)`. Sent once per run as one
  `applyElementDelta(id, { kind: 'arcade-score', score }, tabId)`; `track('Canvas', 'Used', 'Arcade')` once per run
  ended, posted or not. `arcadePlaceLine(place)`: 1 is **New High Score!**, else **You Placed #n**.
- **The run** (`useMoonMail`): phases `ready`, `playing`, `paused`, `over` in React state, which changes only at those
  moments. The run itself is a ref (`newRun(seed)`, the seed from `crypto.getRandomValues`). The strip (`score`,
  `streakFor(streak)`, `shields`) is React state set only when one of the three changes, compared each frame, so a
  frame renders nothing unless a letter or a rock was met. One `requestAnimationFrame` runs only while `playing`:
  `advance(run, now - last)` (the model caps a frame at 250 ms), then `paint`; a run turning `over` stops the loop and
  ends the run. Any other phase paints one still frame (on entering it, on a resize, on a change of motion).
- **Pausing**: `visibilitychange` to hidden, the window's `blur` and a press outside the panel pause a `playing` run;
  nothing resumes it but **Resume**, P, Space, Enter or a tap.
- **Keys** (while the panel is open: `claimAvatarKeys` over the game's keys, and a window `keydown` without
  modifiers): Arrow Up or W hops out, Arrow Down or S hops in (repeats ignored: one press, one hop), Space or Enter
  starts (`ready`, `over`) or resumes, Space or P pauses and resumes; a focused button keeps its own Space and Enter.
  Escape is `ReaderShell`'s. The screen takes focus (`tabIndex={0}`) as a run starts.
- **The strip**: **Score** in tabular figures, the streak's `×n` (amber from ×2), the shields as three
  `lucideShieldCheck` marks (sky while held, faint once lost, read as "2 of 3 shields left"), and, only while a run
  plays, the **Pause** button (its tooltip **Pause (P)**); paused, the screen's card holds **Resume**.
- **Touch** (`pointerdown` on the screen, `touch-none`): `ready` and `over` start, `paused` resumes, `playing` hops by
  `hopForTap` at the press's place in the square.
- **Closing**: the panel's unmount (Close, Escape, the backdrop, the tab left, the machine deleted) ends a run that is
  `playing` or `paused` and has played, posting as at Game Over (a run that scored nothing posts nothing,
  but still counts as a run).

### The drawing (`createMoonMailPainter`)

- The canvas's backing store is its CSS size times `devicePixelRatio` (at most 2); `setTransform(size * dpr)` makes
  every drawing call in play units (0 to 1), so the model's numbers are drawn as they are.
- **The sky**: a night gradient, 48 stars from a fixed seed, the moon (radius `MOON_R`, a grey gradient, three craters)
  and the three orbits as dotted rings, painted once per size into a layer canvas and copied each frame with one
  `drawImage`. The ship's orbit is traced brighter over it.
- **Letters**: a white envelope with its flap and a red seal, popping in over 180 ms. **Rocks**: one of three fixed
  outlines, brown-grey with a darker edge, turning slowly with age and fading over their last 600 ms. **The ship**: a
  small coral mail rocket along its path (heading `angle + π/2`), a porthole and a flickering flame; its radius eases
  from the old orbit to the new over `HOP_GLIDE_MS` (120) after `hopAt`. While hurt it blinks every 100 ms.
- **Moments**: a letter met (the run's `letters` counter rising) rings out in amber with its points (**+20**) rising
  and fading over 600 ms; a hit (`hits`) flashes the screen's edge red for 300 ms. Kept in four fixed slots.
- **Reduced motion**: no twinkle, no flame flicker, no rock spin, no glide (the ship is drawn on its orbit), a hurt
  ship drawn at 45% instead of blinking, and no moments.

### Arcade performance and limits

- A frame: at most 15 steps (250 ms), each a few multiplications per item over at most 12 items; no allocation but
  a spawn. The unit test plays 10 minutes of Moon Mail (36,000 steps) with an autopilot inside 150 ms of CPU
  (`cpuMsOf`).
- The table is ten scores of about 150 bytes each, so an `arcade-score` delta is under 300 bytes and the stored
  field under 2 KB. The ledger entry stays at ten scores however many are posted.
- First load: nothing. The model, the painter and the panel load with `lazy()` the first time a panel opens;
  `apps/editor/app/arcade-lazy.test.ts` proves no static import from the editor's entries reaches them. `ArcadeFace` (in the first
  load) is a bubble, a button and one key listener, mounted only while you stand at a machine.
- A frame while playing: one `advance` (at most 15 steps), one `drawImage` of the cached sky and a few paths per item
  (at most 12), the ship and up to four moments; no React render unless the strip changed. The painter's test paints
  10 minutes of play (36,000 frames) on a recording context inside a CPU budget (`cpuMsOf`). Nothing runs while the
  panel is shut, paused, over or hidden.

### Arcade testing

| Rule                                                                          | Test                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| A valid score, the ceiling, the name and run bounds; order, ties, ten, place  | `packages/document/src/arcade-scores.test.ts`                      |
| The deltas apply; whole-element updates and undo keep the table; the ledger   | `packages/document/src/arcade-score-deltas.test.ts`                |
| The room relays a Participant's own score only, never its clear or a Viewer's | `apps/api/src/room-op-gate.test.ts`, `share-roles.test.ts`         |
| Moon Mail's rules, determinism, the bound, the frame loop's CPU budget        | `apps/editor/lib/arcade/moon-mail.test.ts`                         |
| The painted frame, reduced motion, moments, the painter's CPU budget          | `apps/editor/lib/arcade/moon-mail-paint.test.ts`                   |
| What a run posts, its place, nothing for 0 or no key                          | `apps/editor/lib/arcade/arcade-post.test.ts`                       |
| The press and keys at the machine, the lazy panel's mount                     | `apps/editor/components/canvas/collab/ArcadeFace.test.tsx`         |
| Phases, keys, taps, pausing, posting once, closing mid-run, a Viewer's view   | `apps/editor/components/canvas/collab/arcade/ArcadePanel.test.tsx` |
| No Moon Mail code in the first load                                           | `apps/editor/app/arcade-lazy.test.ts`                              |
| The bubble's best line, updated as the table changes                          | `apps/editor/components/canvas/collab/ArcadeFace.test.tsx`         |
| Clear High Scores: the count, disabled when empty, asks first, one clear      | `apps/editor/components/palette/ArcadeMenuSection.test.tsx`        |
| A copied machine starts empty                                                 | `packages/document/src/duplicate.test.ts`                          |
| An answers flush that changes nothing hands back the same tab                 | `packages/document/src/arcade-score-deltas.test.ts`                |
| A score posted on one screen lands on another; a clear empties both; Viewers  | `apps/editor/e2e/arcade-scores.spec.ts`                            |
