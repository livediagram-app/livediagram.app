# Social pieces

Status: **approved** (owner, 2026-11-05). Pieces that give a Space somewhere to leave a note, see the time where
colleagues are, and hang out between meetings: a **Notice Board** and a **World Clock** on the wall, a **Jukebox**, a
**Ping-Pong Table**, a **Pool Table**, a **Foosball Table**, an **Arcade Machine**, a **Dartboard** and a **Fireplace**
in a new **Play** category, a **Vending Machine** in **Perks**, **Bean Bags** and a **Reading Nook** in **Seats**, and
outdoor seating (**Bench**, **Picnic Table**, **Hammock**), a **Garden Umbrella**, a **Fountain**, a **Pond** and a
**Campfire** in **Garden**. They are [Office](office.md) pieces in every way not said here: drawn upright from the room's camera,
placed at a fixed size (the Pond alone is resizable), no settings `…`, an Editor's to place, move and delete, and
walked, sat at and used by everyone in [Avatar mode](../008-canvas/avatar-mode.md).

## Why

A virtual office that only holds meetings feels like a meeting. People in a real office leave notes on a board, glance
at the clocks to see whether New York is awake yet, and drift to the ping-pong table or the fire after a long call.
These pieces give a Space those small, social places, built from the same parts as the rest of the office.

## Where they live

| Category       | Pieces                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------ |
| **Seats**      | Bean Bag, Reading Nook (after the office's Chair, Desk, Sofa and Meeting Table)            |
| **Perks**      | Vending Machine (after the office's Plant, Bookshelf, Water Cooler and Coffee Machine)     |
| **Meet**       | Notice Board, World Clock                                                                  |
| **Play** (new) | Jukebox, Ping-Pong Table, Pool Table, Foosball Table, Arcade Machine, Dartboard, Fireplace |
| **Garden**     | Bench, Picnic Table, Hammock, Garden Umbrella, Fountain, Pond, Campfire                    |

Play (`collab-recreation`) sits after Perks and before Garden, and since 2026-11-06 holds the bar pieces too,
in named groups: **Bar**, **Games** (Ping-Pong Table, Pool Table, Foosball Table, Arcade Machine, Dartboard) and
**Lounge** (Jukebox, Fireplace). Garden's pieces sit in **Plants**, **Paths and Fences**, **Furniture** and **Features**
([Groups in a flyout](../010-palette/palette-top-level-categories.md#groups-in-a-flyout)).

Shape kinds: `notice-board`, `world-clock`, `jukebox`, `ping-pong-table`, `arcade-machine`, `fireplace`, `bench`,
`picnic-table`, `hammock`, `garden-umbrella`, `fountain`, `pond`, `campfire`, and the second set (Work Tracker #549 to
#552, #535): `pool-table`, `foosball-table`, `dartboard`, `vending-machine`, `bean-bag`, `reading-nook`.

## How each one walks

| Piece           | Default size | Walk                                                                             |
| --------------- | ------------ | -------------------------------------------------------------------------------- |
| Notice Board    | 176 × 128    | Hangs on a wall: never blocks, never a destination                               |
| World Clock     | 168 × 72     | Hangs on a wall: never blocks, never a destination                               |
| Jukebox         | 72 × 112     | Scenery: its base (the bottom quarter) blocks                                    |
| Ping-Pong Table | 184 × 112    | Two seats, one at each end, facing the table (chair rules)                       |
| Arcade Machine  | 64 × 112     | Scenery: its cabinet's foot blocks; walking up to it says "Insert Coin"          |
| Fireplace       | 128 × 120    | Scenery: its hearth blocks                                                       |
| Bench           | 136 × 64     | Two seats side by side, sitters facing down the canvas (chair rules)             |
| Picnic Table    | 200 × 152    | Six seats, three each side, every sitter facing the table (as the Meeting Table) |
| Hammock         | 152 × 80     | One seat in the middle, the sitter facing down the canvas                        |
| Garden Umbrella | 120 × 152    | Scenery: only the pole's foot blocks; the canopy never does                      |
| Fountain        | 136 × 120    | Scenery: the basin blocks                                                        |
| Pond            | 240 × 152    | Scenery drawn to its size: the water blocks, so you walk round it                |
| Campfire        | 80 × 72      | Scenery: the ring of stones blocks                                               |
| Pool Table      | 200 × 128    | Scenery: the table blocks, from the middle of its cloth down to its feet         |
| Foosball Table  | 168 × 104    | Scenery: the table blocks, from the middle of its pitch down to its feet         |
| Dartboard       | 80 × 96      | Hangs on a wall: never blocks, never a destination                               |
| Vending Machine | 72 × 128     | Scenery: its base (the bottom quarter) blocks, as the Jukebox's                  |
| Bean Bag        | 64 × 56      | One seat, the sitter facing down the canvas (chair rules)                        |
| Reading Nook    | 160 × 112    | One seat in its armchair, the sitter facing down the canvas (chair rules)        |

- **Seats** follow the [Chair](chair.md) rules exactly: walk onto the piece to sit on the free seat nearest where you
  arrived, one sitter a seat, a full piece stops you beside it; who sits is presence, never stored, a piece with more than
  one seat rings each taken seat in its sitter's colour, and the piece names its sitters in a pill above their heads. None of them turns.
- **Scenery** blocks as the [Plant](office.md#plant-bookshelf) does: a solid footprint, a character inside one walks
  out of it and never deeper in. The drawing above the footprint never blocks; a character in front of it is drawn in
  front of it.
- **Wall pieces** (Notice Board, World Clock, Dartboard) are walked past, not to: standing in front of one rings
  nothing.
- **Elements paint under avatars**, so nothing here is drawn over a character: the umbrella's canopy is drawn plainly
  as part of the piece, and a sitter at a picnic table under it stands in front of it.

## Notice Board

A cork board in a wooden frame, hung on a wall, that holds pinned notes.

- **A note** is a short title (up to 60 characters, optional), a body (up to 280 characters), the author's name, the
  date it was pinned and an optional colour from five: **Yellow** (the default), **Pink**, **Blue**, **Green** and
  **Purple**. A board holds up to 50 notes; once full, pinning says so and asks for a note to be unpinned first.
- **The face** shows up to the four newest notes as small cards pinned to the cork, each with its colour, title (or
  the start of its body) and a pin. More than four shows a "+N More" tag. An empty board reads **No Notes Yet**.
- **Opening it**: the face's **Notes** button opens a popover listing every note, newest first: its title, body, author and date ("5 Nov"). At the top an **add box** (title,
  body with a live 280 counter, the five colour dots, **Pin Note**) for those who may pin. Escape or a click outside
  closes it.
- **While walking** a press anywhere on the board (or on Notes) opens the same notes large in the
  [reader](../008-canvas/avatar-mode.md#the-reader) instead, and never walks you to the wall.
- **Who may do what**: an Editor or a Participant pins a note and unpins their own; an Editor unpins any note. A
  Viewer reads the notes and sees no add box or Unpin buttons. Unpin asks no confirmation (a note is small). A pin
  and an unpin are not undoable, like a comment: they are the room's, and one person's undo never takes them back.
- **Stored on the element** (`ShapeElement.noticeNotes`, an array oldest first): each `{ id, title?, text, author,
by, at, color? }`, where `by` is the pinner's adder key (an Editor without one writes their participant key) and
  `at` the epoch ms it was pinned.
- **Notes travel as deltas** ([Collab race hardening](../012-collaboration/collab-race-hardening.md)), never inside a
  whole-element update. A pin is one `notice-pin` delta carrying the note; an unpin is one `notice-unpin` naming the
  note's id and its signer's `by`, and removes the note only while that is still its signer. A whole-element update
  (an Editor moving the board, say) keeps every receiver's own notes, so one sent in the same moment as somebody's
  pin can no longer carry the old list over the new note, on screens or in the store; two people pinning at once
  both land, in the room's order. A board's 50-note cap, a duplicate id and a locked board are checked where the
  delta is applied, on every screen alike: a pin past the cap, a replayed note or a pin on a locked board changes
  nothing.
- **A Participant pins and unpins as itself** ([Share roles](../013-workspace/share-roles.md)): the room relays a
  Participant's `notice-pin` only when the note's `by` is the sender's server-verified adder key, and its
  `notice-unpin` only when the `by` it names is that key, so it can remove only notes it signed (each screen, and the
  room's write into the stored board, check the stored note's signer). A Viewer's is dropped. The room writes a
  Participant's notes into the stored board itself, as it writes its comment reactions. The participant content
  rule still keeps every note a Participant did not sign as stored, should an older screen send notes inside an
  update.
- Its label is not drawn. It does not turn. Aspect locked.
- **A face's controls are their own**: pressing the **Notes** button (or the Jukebox's **Play**) never selects,
  drags, label-edits or erases the piece, never starts a draw over it, and is not a walk in Avatar mode. The count
  beside **Notes** is a badge ([Counts are badges](../004-interface-design/counts.md)), never "(3)".

## World Clock

A wooden plaque on the wall with small clock dials, one per time zone.

- **Zones**: up to six, each an IANA time zone (`Europe/London`) with a label of up to 24 characters ("London").
  `ShapeElement.clockZones`: `{ zone, label }[]`. With none set the clock shows **the viewer's own zone**, labelled
  **Local**, so a new clock is right for everyone who looks at it.
- **The face** shows the first three zones as analogue dials side by side, each with its label and the time below in
  digits (24-hour or 12-hour as the viewer's locale writes it). A zone whose day differs from the viewer's adds a small
  "+1" or "-1". A zone the browser does not know draws its dial empty with "?" for the time.
- **It ticks once a minute**, all clocks on the canvas together from one shared timer that wakes at the top of each
  minute while any clock is on screen; nothing runs per frame. The hands jump; there is no second hand. Reduced
  motion changes nothing, since nothing moves between minutes.
- **While walking** a press on the clock opens every zone large in the [reader](../008-canvas/avatar-mode.md#the-reader),
  and never walks you to the wall.
- **Editing**: an Editor's element menu has a **World Clock** section listing the zones, each with its label field
  and a remove button, and an **Add Zone** row: a zone field that suggests from the browser's list of zones as you
  type, with the label filled from the city part of the zone ("New_York" → "New York"). Participants and Viewers see
  the clock and never the section.
- Its label is not drawn. It does not turn. Aspect locked.

## Jukebox

A rounded, lit jukebox that plays a shared background stream to the people standing in its area.

- **The source** is a link an Editor sets in the element menu's **Jukebox** section: an `https` address of an audio
  stream or file (MP3, AAC or Ogg), up to 500 characters. `ShapeElement.jukeboxSource`. With none set the face reads
  **No Music Set**. **Default stream: link only for now.** No stream we could find is both always-on and licensed
  CC0 or royalty-free for any use, so v1 ships without a built-in list; a short list of checked, CC0 streams is a
  follow-up ([Future work](../005-project-roadmap/future-work.md)).
- **Its area** is the room it stands in (the innermost Room whose floor holds the jukebox's base), or, standing in no
  room, a circle 280 px round its base. Your character standing in the area hears it; leave and it stops. Two
  jukeboxes whose areas overlap: you hear the one whose area is innermost, then the nearest.
- **Off by default, per viewer.** Nobody hears a jukebox until they press its **Play** button once: browsers block
  sound that starts without a press, and music should never surprise anyone. After that it plays whenever you walk
  into an area, at a low volume (20%). The choice is remembered on this device.
- **Muting**: the face's button reads **Play** (never pressed), then **Mute** and **Unmute**. The same switch is the
  **Jukebox Music** switch in the avatar palette's Status flyout. Muted, nothing plays anywhere until you unmute.
- **Playing shows**: the face's lights glow and three notes drift up while it plays for you (CSS; still under reduced
  motion). Who hears what is never shared: it is all on your own machine, and nothing is written to the document.
- **A stream that fails** (an address that does not load, or refuses to play) shows **Can't Play** on the face for
  you; the music never retries in a loop.
- Calls are unaffected: the music plays under call audio at its low volume.

## Ping-Pong Table

- A green table with a white centre line, a net across the middle and a paddle at each end.
- **Two seats**, the left end facing right and the right end facing left (as a seat at each end of the Meeting
  Table).
- **It is playable** (Work Tracker #528): the two people sitting at it play a game of table tennis, seen from above,
  each moving the paddle at their own end. Everyone else sees the same rally and the same score.

### A game

- **Who plays**: the sitter on the left seat and the sitter on the right seat, each an Editor or a Participant
  ([Share roles](#share-roles)). A Viewer sitting at the table sits, and its seat counts as empty for the game. Anyone
  else on the tab watches.
- **The resting rally**: with both seats taken and no game running (a Viewer in one, or a player's motion reduced, or
  a screen from before games), the table plays its decorative rally as before: a ball arcing from end to end every 1.2
  seconds in CSS, no score. Under reduced motion the ball rests on the net line.
- **Starting**: a game starts once both seats hold a player whose screen can play (motion not reduced, see below).
  A player's screen says it can play by sending its paddle as soon as both seats are held (see [The wire](#the-wire)).
  Once both have said so, every screen's scoreboard reads **Ready** for a second, then the left player serves. Nobody
  presses anything to start.
- **Playing**: the ball crosses the table, bounces off the two long sides, and is struck back by a paddle that
  meets it at that player's end. Where it meets the paddle sets its angle (the paddle's middle sends it straight,
  its tips send it steeply). Each strike speeds it up a little, to a cap. A ball that passes a paddle is a point to
  the other player. Between a point and the next serve the ball rests at the server's paddle, riding up and down with
  it, for a second.
- **Scoring**: first to 11, by two clear points (at 10 all, play on until one leads by two). Service changes every
  two points, and every point from 10 all; the left player serves first. The score is shown above the table, left
  player's points on the left, for everyone on the tab, in a small pill in each player's colour, in the middle above
  the table (clear of the two players' heads at its ends). A won game shows **<Name> Wins** in the winner's colour
  (**You Win** on the winner's own screen) for five seconds, then a new game starts at 0 all if both are still
  sitting.
- **Leaving ends your side**: standing up (or leaving Avatar mode, or the tab, or the document) ends the game at
  once for everyone; the table goes back to its resting state and the score is gone. Nothing about a game is
  stored: it lives on the screens of the people looking at the table, like a walking character.
- **Watching**: anyone on the tab sees the ball, both paddles and the score, whether or not they stand nearby. Someone
  who opens the tab mid-game sees the ball and the score from the next strike or point on (a game's moments are never
  replayed).

### Controls

Only while you sit at the table, and only for your own paddle:

- **Mouse or pen**: the paddle follows the pointer's height over the table (no press needed) while the pointer is over
  the table or within its piece's box. The pointer there is an up-and-down arrow, and a press on it is the paddle's:
  it never walks, selects or stands you up.
- **Touch**: drag anywhere on the table; the paddle follows your finger's height. A press on the piece you sit on
  keeps you in it ([Chair](chair.md)), so playing never stands you up.
- **Keyboard**: **W** and **S**, or **Arrow Up** and **Arrow Down**, move the paddle while a game runs at your table.
  They are the paddle's then, an exception to the Chair rule that any arrow key stands you up and to `W` waving:
  **Arrow Left**, **Arrow Right**, a click elsewhere or any other walk still stands you up, ending your side.
- Your paddle moves on your screen at once, never waiting for the room.

### Reduced motion

Under reduced motion (the system setting) a screen draws no ball and no moving paddles: it shows the scoreboard
only, updating as points are won. A **player** whose motion is reduced does not play (a game needs a ball they can
see): their screen sends no paddle, so no game starts at that table, and its scoreboard reads **Motion Reduced**.

### The wire

A game rides the tab's live room as two presence ops, never stored, never ordered or replayed, so a game costs the
document nothing and a reconnect only misses moments. Both are built for any game a piece hosts (the Arcade
Machine's, Work Tracker #529, reuses them): they name the piece and a seat, and carry the game's own payload.

- **`game-input`** `{ tabId, pieceId, seat, axis }`: one player's control, a number from 0 (the top of the play area)
  to 1 (its bottom). Sent on change, at most every 50 ms (20 a second), only while sitting at the piece with a game
  to play (both seats held, your motion not reduced). It also says your screen can play: one goes out as soon as both
  seats are held, one after a game ends, and one a second while no game is on, so a word lost to a dropped connection
  is said again. While a game is on nothing is sent while the paddle is still. It is a sample: the room sends it to the sender's tab only and,
  in a busy room, coalesces it with the walkers' ([A busy room bounds its presence
  fan-out](../015-api/api.md)). Receivers ease the paddle toward the newest sample.
- **`game-event`** `{ tabId, pieceId, seat, game: 'ping-pong', match, seq, event, ball?, score }`: one moment of the
  game, sent by the one player whose moment it is: `serve` (the server), `hit` and `miss` (the player at the end the
  ball was travelling to). `match` names the game (a fresh id per game, chosen by the left player), `seq` counts its
  moments from 1, `ball` is the ball as it leaves on a `serve` or `hit` (`x` and `y` from 0 to 1 across and down the play area, the
  table top from the left seat's end; `vx` and `vy` in play areas per second), and
  `score` is the score after the moment, so a late watcher is right from its first event.
- **No ball traffic per frame.** Between two events the ball's flight is a straight line folded at the long sides, the
  same on every screen from the same start, so each screen draws it from the last event alone. A rally of strikes
  every second or so is about one event a second; the only steady stream is a moving paddle's 20 samples a second.
- **Who decides**: each player decides their own end. When the ball reaches your end, your screen, which knows your
  paddle exactly, says whether you struck it (`hit`, with the ball's new flight) or missed it (`miss`, a point to the
  other player). So neither player is judged on a paddle position a network delay old, and there is never a second
  opinion: only one player may send the next moment. Until that word arrives, other screens hold the ball at that
  end's paddle line.
- **Trust**: a screen applies an event only from the presence id sitting on the event's seat, for the match it is
  showing (or a `serve` with `seq` 1 from the left seat, which starts a new match), with the next `seq`, and from the
  seat whose turn it is. Anything else changes nothing. The room relays both ops from an Editor or a Participant
  and drops a Viewer's and any that is malformed.
- **A silent player**: if the word from an end has not come 3 seconds after the ball reached it, every screen treats
  that player as gone and the game ends, as if they had stood up. A screen that loses its room connection ends its
  own game the same way.

## Arcade Machine

- An upright cabinet with a glowing screen (a slow colour shimmer and a blinking cursor, in CSS) and a joystick and
  two buttons on its panel. Under reduced motion the screen holds still.
- Walking up to it (your character's feet within 24 px of its front) shows an **Insert Coin** bubble above it for you,
  for as long as you stand there; nobody else sees your bubble. With a score on the machine's table the bubble adds
  its best below: **Best 1,240 · Ann**.
- A click anywhere on the cabinet walks you to its front, 16 px below it under the click (`walkPointFor` in
  `apps/editor/lib/avatar-click-intent.ts`), never onto the floor behind its screen; a turned cabinet's click is the walk.
- **It is playable** (Work Tracker #529): a press on the cabinet while you stand at it (its Insert Coin bubble showing)
  opens its game, **Moon Mail**, in a panel over the canvas, for you alone. Everyone in the Space shares the
  machine's **High Scores**.

### Moon Mail

Our own game, made for this machine: a mail run round a small moon.

- **The screen** is square: a small grey moon in the middle and three orbits round it, drawn as faint dotted rings.
  Your mail ship flies round the middle orbit on its own, clockwise, a little faster every second (from a lap in
  about 5.7 seconds to one in about 2.4, reached after 100 seconds).
- **Letters** (small envelopes) wait on the orbits. Flying through one collects it: 10 points times your
  **streak**. Three wait when a run starts; another appears at most every 0.9 seconds while fewer than five wait,
  always on the far side of the moon from you.
- **Space rocks** drift round the orbits the other way, from the far side of the moon, more often as the run goes on
  (one every 2.6 seconds at first, down to one every 0.8). Flying into one costs one of your three **shields** and
  ends your streak; for 1.5 seconds after, your ship blinks and nothing can hit it. A rock that has drifted for 9
  seconds fades away.
- **Hopping**: you choose only your orbit, one hop at a time, outward or inward; the ship never stops. From the outer
  orbit there is no further out, from the inner none further in.
- **The streak**: every five letters collected in a row raises it by one, from ×1 to at most ×5 (letters 1 to 5 score
  ×1, 6 to 10 ×2, and from the 21st ×5). A hit sets it back to ×1.
- **The run ends** when the last shield goes: the screen reads **Game Over** with the score, and a score that makes
  the table is posted to it (see [High Scores](#high-scores)). **Play Again** starts a new run.
- **The strip** under the screen shows the score (tabular figures), the streak (`×3`) and the shields left (three
  small shield marks).

### The panel

- **Opening**: a press on the cabinet while you stand at it, or **Enter** or **Space** while your Insert Coin bubble
  shows. It loads the game the first time it opens (the game's code is never part of the Space's first load) and
  shows **Loading…** in the panel until it is ready.
- **Its place**: centred over the dimmed canvas, as every [reader](../008-canvas/avatar-mode.md) is, 360 px wide (on a
  phone, the screen's width less 12 px each side), never over the bottom-right controls. Its header reads **Moon
  Mail** with a **Close** button (an X, with its tooltip). The square screen fills the panel's width; under it the
  strip, then the High Scores, which scroll with the panel on a short screen.
- **Before a run**: the screen shows the moon and orbits at rest with **Press Space or Tap to Start**, and below it
  the machine's [High Scores](#high-scores). **Start**, Space, Enter or a tap on the screen starts a run.
- **Playing**: the panel holds the keys, so walking stops while it is open (see Controls). The ship, letters and
  rocks move on the screen; the strip counts.
- **Pausing**: **P**, Space, or the **Pause** button pauses a run and shows **Paused** with **Resume**. A run pauses
  by itself when the tab or the window is hidden or loses focus, and never resumes by itself.
- **Closing**: **Escape**, the **Close** button, a press on the dimmed canvas outside the panel (except during a run,
  when that press pauses it instead, so a stray tap never ends a run), or the panel's tab being left. Closing during a
  run ends it, and its score counts as at Game Over (posted if it makes the table). Your character stays where it
  stood.
- **Game Over** shows the score large, then where it landed (**New High Score!** or **You Placed #4**; nothing more
  when it did not make the table), and **Play Again**. The new row is lit in the High Scores below.
- **A Viewer's press** opens the same panel on the High Scores alone, with no Start and the line **Viewers See the
  Scores**.
- **Pressing the cabinet**: while your Insert Coin bubble shows, the whole cabinet (and the bubble) is one press, with
  the pointer cursor; away from it a click on the cabinet walks you to its front as before. Enter and Space open it
  only while the bubble shows, nothing else holds the keyboard (a field, a dialog, a focused button) and the panel is
  shut; they then neither jump nor open the message box.

### Controls

- **Keyboard**: **Arrow Up** or **W** hops out, **Arrow Down** or **S** hops in; **Space** or **Enter** starts; **P**
  or Space pauses and resumes; **Escape** closes. While the panel is open these keys are the game's and never walk,
  wave or spin your character ([key claims](../008-canvas/avatar-mode.md)).
- **Touch, mouse or pen**: a tap on the screen outside your ship's orbit hops out, inside it hops in. A tap before a
  run starts it. The screen takes the press: it never pans, selects or walks.
- A hop shows at once on your screen; nothing about a run goes over the wire while it plays.

### Reduced motion

The game is played by moving things, so it still plays under reduced motion (the system setting), with nothing that
moves only for show: the stars behind the moon hold still, a hop jumps to its orbit instead of gliding, a hit dims the
ship steadily instead of blinking, and nothing flashes or shakes.

### High Scores

- **One table per machine**, shared by everyone in the Space: its ten best scores, best first, each its rank, the
  player's name, the score and the day it was set ("5 Nov"). An empty table reads **No Scores Yet**. Your own rows
  are marked (**You** beside the name).
- **The name** is the person's display name in the Space (the name their character carries), cut to 24 characters;
  with none it is **Guest**. There is nothing to type.
- **Posting**: a run's score is posted when it ends, if it is at least 1 and would make the table (fewer than ten
  scores on it, or better than its tenth). A tie keeps the earlier score above. One person may hold several places.
  The panel then says where it landed: **New High Score!** at the top, else **You Placed #4**.
- **It syncs**: a posted score reaches everyone's table at once, through the room, and stays on the machine.
- **Clearing**: an Editor's element menu has an **Arcade Machine** section with **Clear High Scores**, which asks
  first ("Clear all 10 scores? This can't be undone.") and empties the table for everyone.
- **Stored on the element** (`ShapeElement.arcadeScores`, best first, at most ten): each `{ id, name, score, ms, by,
at }`, where `ms` is how long the run played (paused time not counted), `by` the poster's adder key (an Editor
  without one writes their participant key) and `at` the epoch ms it was posted.
- **Scores travel as deltas** ([Collab race hardening](../012-collaboration/collab-race-hardening.md)), never inside a
  whole-element update: a posted score is one `arcade-score` delta carrying it; a clear is one `arcade-clear`. A
  whole-element update keeps every receiver's own table, so an Editor moving the machine never carries an old table
  over a new score. Where the delta is applied, on every screen and in the store alike, the table is put in order
  and cut to ten: a score that does not make it, a replay of an id the table holds, or one that fails the checks
  below changes nothing. A locked machine still takes scores (a lock fixes where it stands, as a Timer's does).
- **Trust**: the game runs on the player's screen alone, so a score is that screen's word, held to what a run could
  score. A score is a whole number from 1 to the run's ceiling: letters appear at most one every 0.9 seconds after
  the three a run starts with, each worth at most 50 (×5), so a run of `ms` scores at most
  `(3 + floor(ms / 900)) × 50`; a run plays at most 2 hours. A name is at most 24 characters. The room relays a
  Participant's `arcade-score` only when its `by` is the sender's server-verified adder key (so a Participant posts
  as itself), drops a Participant's `arcade-clear` and drops a Viewer's either. The room writes a Participant's
  scores into the stored machine itself, as it writes its notes. A hand-made score inside those bounds is still
  possible; the table holds ten, and an Editor clears it.
- **Not undoable**: a posted score and a clear are the room's, like a pinned note; one person's undo never takes
  them back.

## Fireplace, Campfire

Gathering spots with a fire that flickers.

- **Fireplace**: a brick fireplace with a mantel, logs and flames, for rooms. **Campfire**: logs in a ring of stones
  with flames, for the Garden.
- **The flames flicker** (a CSS scale and opacity loop on two flame layers, out of step) and a soft glow breathes on
  the ground. Under reduced motion they hold still, lit.

## Pool Table, Foosball Table, Dartboard

More for the games corner, each a visual only: nobody plays, nothing is scored, and nothing moves (a game per piece
is a follow-up, built on the Ping-Pong Table's [wire](#the-wire)).

- **Pool Table**: a wooden table on turned legs, green cloth inside its cushions, six pockets, a racked triangle of
  coloured balls with the black, the white cue ball and a cue resting on the cloth.
- **Foosball Table**: a wooden cabinet round a green pitch with a white halfway line and centre circle, a goal at each
  end, four rods across it, each with its little players (red and blue, rod by rod) and a handle at the front, and the
  ball on the centre spot.
- **Dartboard**: a round board on a wooden backboard, hung from a nail: twenty black and cream segments, the red and
  green double and treble rings, the bull, and three darts stuck in it. A wall piece: a click on it while walking walks
  to the floor in front, and standing there rings nothing.

## Vending Machine

A social spot like the Water Cooler, for a break room or the games corner.

- A tall teal cabinet with a lit sign across its top, a glass window of snacks and cans on five spiral shelves, a side
  panel with a small green display, a keypad and a coin slot, and a pickup flap at the bottom.
- **Lit**: its sign and window are light colours on every paper. **On dark paper** it glows: a soft light spills from
  the window onto the floor in front of it and the glass brightens, drawn over the art for dark paper only (static: no
  loop, so reduced motion changes nothing). An export draws the art, without the glow.
- Scenery, like the Jukebox: its base blocks and walking up to it rings nothing. It does not give a drink (the Drinks
  Fridge and the Water Cooler do); a snack in the hand is a follow-up.

## Bean Bag, Reading Nook

Relaxed seating for breakout areas. Both seat people by the [Chair](chair.md) rules, as every seat here does.

- **Bean Bag**: a slouchy coral bean bag, one seat, the sitter facing down the canvas. Place several for a corner.
- **Reading Nook**: a set in one piece: a mustard wingback armchair on a round rug, a side table with a stack of books,
  and a floor lamp whose shade is lit. One seat, in the armchair, facing down the canvas. **On dark paper** the lamp
  throws a warm pool of light on the rug and a halo round its shade (drawn as the Vending Machine's glow is).
- Neither turns; their seat colours are their own (no fill from the theme).

## Bench, Picnic Table, Hammock

- **Bench**: a wooden garden bench with a back, two seats.
- **Picnic Table**: a wooden table with a bench along each side, six seats facing the table, three each side.
- **Hammock**: a striped hammock slung between two posts, one seat.

## Garden Umbrella, Fountain, Pond

- **Garden Umbrella**: a striped parasol on a pole with a weighted base, to stand beside or over a Picnic Table. Only
  the base blocks.
- **Fountain**: a round stone basin with a two-tier spout. The water shimmers and the spout's spray rises and falls
  gently (CSS; still under reduced motion).
- **Pond**: a pool of water with a stone rim and a lily pad or two, drawn to its size like Grass (the rim, water and
  pads are a fixed handful of shapes however big). Resizable, not aspect locked. A faint ripple drifts across it (CSS;
  still under reduced motion). The water blocks: its footprint is the pond less its rim's outer edge.

## Share roles

- **Editor**: places, moves and deletes every piece; sets a World Clock's zones and a Jukebox's source; pins notes and
  unpins any note.
- **Participant**: pins a note and unpins its own, signed with its adder key, which the room checks; plays ping-pong;
  walks, sits and uses everything like everyone; the participant palette does not offer the pieces.
- **Viewer**: reads the notes; watches a ping-pong game but never plays (the room drops its `game-input` and
  `game-event`, and a Viewer on a seat counts as no player); sees an Arcade Machine's High Scores but never plays
  or posts (the room drops its `arcade-score`); walks, sits and listens like everyone (all of it is presence or
  local).
- An **Editor** also clears an Arcade Machine's High Scores; a **Participant** plays Moon Mail and posts its own
  scores, signed with its adder key, which the room checks.

| Piece                                 | Editor | Participant | Viewer |
| ------------------------------------- | ------ | ----------- | ------ |
| Ping-Pong Table: play                 | Yes    | Yes         | No     |
| Ping-Pong Table: watch                | Yes    | Yes         | Yes    |
| Arcade Machine: play, post a score    | Yes    | Yes (own)   | No     |
| Arcade Machine: see the High Scores   | Yes    | Yes         | Yes    |
| Arcade Machine: clear the High Scores | Yes    | No          | No     |
| Notice Board: pin a note              | Yes    | Yes (own)   | No     |
| World Clock, Jukebox: set             | Yes    | No          | No     |

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- Placing one: `Element · Added · <Kind>` (`Notice-board`, `World-clock`, `Jukebox`, `Ping-pong-table`,
  `Arcade-machine`, `Fireplace`, `Bench`, `Picnic-table`, `Hammock`, `Garden-umbrella`, `Fountain`, `Pond`,
  `Campfire`, `Pool-table`, `Foosball-table`, `Dartboard`, `Vending-machine`, `Bean-bag`, `Reading-nook`).
- A note pinned or unpinned: `Element · Changed · Notice-board`; zones changed: `Element · Changed · World-clock`; a
  source set: `Element · Changed · Jukebox`. Never the note's words, the zones or the address.
- A ping-pong game played to its end: `Canvas · Used · PingPong`, sent by the left player's screen alone, so a game
  counts once. Never the score or who played.
- A Moon Mail run ended (Game Over or closed mid-run): `Canvas · Used · Arcade`, from the player's screen. High
  Scores cleared: `Element · Changed · Arcade-machine`. Never the score or the name.

## Not in scope

- Playing pool, foosball or darts (follow-ups: a mini-game per piece, on the ping-pong wire).
- Watching someone else's Moon Mail run, more than one game on a machine, typing initials, sound, and a high-score
  table across Spaces.
- Ping-pong against the computer, doubles, a stored score or a leaderboard, sound, and spin.
- A snack or a can from the Vending Machine.
- A built-in jukebox playlist, queueing songs, or volume control beyond mute.
- Replying to, editing or reacting to a note; notes with images or links.
- Alarms, meeting countdowns or daylight shading on the World Clock.
- Music in an export or a still image: an export draws each piece's art, the notice board's cork and the clock's plaque,
  without notes or hands.
