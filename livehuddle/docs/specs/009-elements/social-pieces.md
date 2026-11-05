# Social pieces

Status: **approved** (owner, 2026-11-05). Pieces that give a Space somewhere to leave a note, see the time where
colleagues are, and hang out between meetings: a **Notice Board** and a **World Clock** on the wall, a **Jukebox**, a
**Ping-Pong Table**, an **Arcade Machine** and a **Fireplace** in a new **Recreation** category, and outdoor seating
(**Bench**, **Picnic Table**, **Hammock**), a **Garden Umbrella**, a **Fountain**, a **Pond** and a **Campfire** in
**Garden**. They are [Office](office.md) pieces in every way not said here: drawn upright from the room's camera,
placed at a fixed size (the Pond alone is resizable), no settings `…`, an Editor's to place, move and delete, and
walked, sat at and used by everyone in [Avatar mode](../008-canvas/avatar-mode.md).

## Why

A virtual office that only holds meetings feels like a meeting. People in a real office leave notes on a board, glance
at the clocks to see whether New York is awake yet, and drift to the ping-pong table or the fire after a long call.
These pieces give a Space those small, social places, built from the same parts as the rest of the office.

## Where they live

| Category             | Pieces                                                                  |
| -------------------- | ----------------------------------------------------------------------- |
| **Meeting**          | Notice Board, World Clock                                               |
| **Recreation** (new) | Jukebox, Ping-Pong Table, Arcade Machine, Fireplace                     |
| **Garden**           | Bench, Picnic Table, Hammock, Garden Umbrella, Fountain, Pond, Campfire |

Recreation (`collab-recreation`, a game controller glyph, "Somewhere to unwind between meetings.") sits after Bar and
before Garden ([The Space categories](../010-palette/palette-top-level-categories.md#the-space-categories)).

Shape kinds: `notice-board`, `world-clock`, `jukebox`, `ping-pong-table`, `arcade-machine`, `fireplace`, `bench`,
`picnic-table`, `hammock`, `garden-umbrella`, `fountain`, `pond`, `campfire`.

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

- **Seats** follow the [Chair](chair.md) rules exactly: walk onto the piece to sit on the free seat nearest where you
  arrived, one sitter a seat, a full piece stops you beside it; who sits is presence, never stored, and the piece names
  its sitters in a pill above it. None of them turns.
- **Scenery** blocks as the [Plant](office.md#plant-bookshelf) does: a solid footprint, a character inside one walks
  out of it and never deeper in. The drawing above the footprint never blocks; a character in front of it is drawn in
  front of it.
- **Wall pieces** (Notice Board, World Clock) are walked past, not to: standing in front of one rings nothing.
- **Elements paint under avatars**, so nothing here is drawn over a character: the umbrella's canopy is drawn plainly
  as part of the piece, and a sitter at a picnic table under it stands in front of it.

## Notice Board

A cork board in a wooden frame, hung on a wall, that holds pinned notes.

- **A note** is a short title (up to 60 characters, optional), a body (up to 280 characters), the author's name, the
  date it was pinned and an optional colour from five: **Yellow** (the default), **Pink**, **Blue**, **Green** and
  **Purple**. A board holds up to 50 notes; once full, pinning says so and asks for a note to be unpinned first.
- **The face** shows up to the four newest notes as small cards pinned to the cork, each with its colour, title (or
  the start of its body) and a pin. More than four shows a "+N More" tag. An empty board reads **No Notes Yet**.
- **Opening it**: the face's **Notes** button (and, while walking, a click anywhere on the board) opens a popover
  listing every note, newest first: its title, body, author and date ("5 Nov"). At the top an **add box** (title,
  body with a live 280 counter, the five colour dots, **Pin Note**) for those who may pin. Escape or a click outside
  closes it.
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
  **Jukebox Music** row in the Avatar panel. Muted, nothing plays anywhere until you unmute.
- **Playing shows**: the face's lights glow and three notes drift up while it plays for you (CSS; still under reduced
  motion). Who hears what is never shared: it is all on your own machine, and nothing is written to the document.
- **A stream that fails** (an address that does not load, or refuses to play) shows **Can't Play** on the face for
  you; the music never retries in a loop.
- Calls are unaffected: the music plays under call audio at its low volume.

## Ping-Pong Table

- A green table with a white centre line, a net across the middle and a paddle at each end.
- **Two seats**, the left end facing right and the right end facing left (as a seat at each end of the Meeting
  Table).
- **When both seats are taken** a tiny rally plays: a ball arcs from one end to the other and back, every 1.2
  seconds, in CSS. Under reduced motion the ball rests on the net line instead. It is decoration: there is no score
  and no game. A playable mini-game is a follow-up.

## Arcade Machine

- An upright cabinet with a glowing screen (a slow colour shimmer and a blinking cursor, in CSS) and a joystick and
  two buttons on its panel. Under reduced motion the screen holds still.
- Walking up to it (your character's feet within 24 px of its front) shows an **Insert Coin** bubble above it for you,
  for as long as you stand there. Nothing else happens, and nobody else sees your bubble.

## Fireplace, Campfire

Gathering spots with a fire that flickers.

- **Fireplace**: a brick fireplace with a mantel, logs and flames, for rooms. **Campfire**: logs in a ring of stones
  with flames, for the Garden.
- **The flames flicker** (a CSS scale and opacity loop on two flame layers, out of step) and a soft glow breathes on
  the ground. Under reduced motion they hold still, lit.

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
- **Participant**: pins a note and unpins its own, signed with its adder key, which the room checks; walks, sits and uses everything like everyone; the participant
  palette does not offer the pieces.
- **Viewer**: reads the notes; walks, sits and listens like everyone (all of it is presence or local).

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- Placing one: `Element · Added · <Kind>` (`Notice-board`, `World-clock`, `Jukebox`, `Ping-pong-table`,
  `Arcade-machine`, `Fireplace`, `Bench`, `Picnic-table`, `Hammock`, `Garden-umbrella`, `Fountain`, `Pond`,
  `Campfire`).
- A note pinned or unpinned: `Element · Changed · Notice-board`; zones changed: `Element · Changed · World-clock`; a
  source set: `Element · Changed · Jukebox`. Never the note's words, the zones or the address.

## Not in scope

- Playing ping-pong or an arcade game (follow-ups: a mini-game per piece).
- A built-in jukebox playlist, queueing songs, or volume control beyond mute.
- Replying to, editing or reacting to a note; notes with images or links.
- Alarms, meeting countdowns or daylight shading on the World Clock.
- Music in an export or a still image: an export draws each piece's art, the notice board's cork and the clock's plaque,
  without notes or hands.
