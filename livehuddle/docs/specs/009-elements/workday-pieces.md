# Workday pieces

Status: **approved** (owner, 2026-11-07; Work Tracker #553, #554, #545, #555, #533, #540). The pieces that say how
you are spending the day without a word, and give a Space an arrival point: a **Nap Pod** that sets you to Focusing,
a **Treadmill** and a **Weight Bench** that set you On a Break, a **Phone Booth** that takes you out of the room's
audio and shows Busy, a **Standing Desk** and a **Hot Desk** that shows your name while you sit there, a **Pet Bed**
whose office dog wanders its room and can be patted, and a **Reception Desk** that welcomes you and has a bell to
ring. They are [Office](office.md) pieces in every way not said here: drawn upright from the room's camera, placed at
a fixed size, aspect locked, no settings `…`, no words on them, an Editor's to place, move and delete, and walked,
sat at and used by everyone in [Avatar mode](../008-canvas/avatar-mode.md).

## Why

A virtual office shows who is in, but not how they are: heads-down, at the gym, on a call. In a real office you can
see it from across the floor. These pieces let where you sit say it for you, so nobody has to remember to set a
status and then forget to clear it. A front desk and an office dog make a Space feel like a place people arrive at
and like being in.

## Where they live

| Category  | Tiles, in palette order                                                                          |
| --------- | ------------------------------------------------------------------------------------------------ |
| **Rooms** | Phone Booth, Nap Pod and Reception Desk after the Office Pod (the Floor group)                   |
| **Seats** | Hot Desk and Standing Desk after the Reading Nook                                                |
| **Play**  | Treadmill and Weight Bench in a **Gym** group after Games; Pet Bed after the Fireplace in Lounge |

Shape kinds: `nap-pod`, `treadmill`, `weight-bench`, `phone-booth`, `standing-desk`, `hot-desk`, `pet-bed`,
`reception-desk`.

## How each one walks

| Piece          | Default size | Walking                                                                                    |
| -------------- | ------------ | ------------------------------------------------------------------------------------------ |
| Nap Pod        | 120 × 112    | One seat, reclined in the pod, the sitter facing down the canvas; sets **Focusing**        |
| Treadmill      | 72 × 112     | One spot on its belt, standing, facing up the canvas (at the console); sets **On a Break** |
| Weight Bench   | 136 × 88     | One seat on the bench, facing down the canvas; sets **On a Break**                         |
| Phone Booth    | 80 × 136     | One seat, facing down the canvas through the glass; a call of its own; sets **Busy**       |
| Standing Desk  | 112 × 104    | One spot in front of the desk, standing, facing up the canvas (at the monitor)             |
| Hot Desk       | 120 × 112    | One seat in front of the desk, facing up the canvas; shows its sitter's name               |
| Pet Bed        | 72 × 48      | Never blocks, never a destination: you walk over it; its dog wanders the room              |
| Reception Desk | 200 × 112    | Scenery: its counter blocks; standing in front of it shows **Welcome**                     |

- **Seats** follow the [Chair](chair.md) rules exactly: walk onto the piece to take its seat, one person a seat, a
  taken one stops you beside it; who sits is presence, never stored; two people who sat at once are settled by the
  seat claim (the earlier claim keeps it, the later stands up beside it). None of them turns.
- **Standing seats** (the Treadmill and the Standing Desk) are seats in every way but the pose: the character there
  stands rather than sits, on every screen, because the pose is worked out from the piece it holds.
- **Scenery** blocks as the [Plant](office.md#plant-bookshelf) does: the Reception Desk's counter, from the middle of
  its top down to its foot, full width.

## Statuses a piece sets

Your [status](../008-canvas/avatar-mode.md#status) can come from where you are, not only from the Status flyout:

| Where you sit               | Status shows   | Token   |
| --------------------------- | -------------- | ------- |
| A Nap Pod                   | **Focusing**   | `focus` |
| A Treadmill, a Weight Bench | **On a Break** | `break` |
| A Phone Booth               | **Busy**       | `busy`  |

- **It shows while you sit there.** Standing up, being stood up by an earlier claim, the piece being deleted or
  hidden, and leaving Avatar mode all show your own status again, the one you had before you sat. The piece's status
  is laid over yours, never written over it, so there is nothing to put back and nothing that can be left behind.
- **A status you pick while sitting wins.** Picking one from the Status flyout (None included) while you sit on a piece that
  sets one replaces the piece's for as long as you stay, and stays yours after you stand up. Sitting down again later
  shows the piece's status again.
- **Closing the tab or dropping off** takes your character away, status and all; nothing is stored. **Reconnecting**
  sends your presence again with what shows now, so a reconnect never brings back a stale piece status or loses one.
- **What peers see** is the status that shows, sent in your presence's `status` like any other. The Status flyout
  presses it too, so the flyout and your chip never disagree.
- **On a Break** (a blue dot; a water bottle in the hand) joins the Activity group after Out to Lunch, and **Busy** (a
  brown dot; a phone held to the ear) the Availability group after Away, so they can be set by hand as well. Like Do Not Disturb, they are in the shared status list
  (`@liveworkspace/avatar`), which livediagram parses and draws but does not offer.
- Busy is a status, not Do Not Disturb: knocks, toasts and other people's equalisers still reach you. The Phone
  Booth's privacy comes from its call (below), not from the status.

## The pieces

### Nap Pod

A cocoon-shaped lounger: a pale shell with a hood that arches over a reclined, cushioned seat, a soft blanket, and a
small reading lamp in the hood. One seat, the sitter facing down the canvas. Sitting sets **Focusing**, which puts
headphones on your character ([Status](../008-canvas/avatar-mode.md#status)). A quiet room is a Room with Nap Pods in
it; there is no separate quiet room piece.

### Treadmill, Weight Bench

The gym corner.

- **Treadmill**: a running machine seen from behind its user: a dark belt between two side rails, the console and
  handlebars at the top. One standing spot on the belt, facing the console. While someone is on it the belt's stripes
  run toward you (CSS); under reduced motion they hold still.
- **Weight Bench**: a padded flat bench with a barbell resting on a rack at its head, plates on each end, and a pair of
  dumbbells on the floor beside it. One seat, on the bench, facing down the canvas.
- Using either sets **On a Break**.

### Phone Booth

A one-person booth for taking a call: a tall oak-framed booth with a glass front, a felt-lined back wall, a small
shelf and a stool inside, and a lamp on its roof that glows red while it is in use (static: reduced motion changes
nothing).

- **One seat, no invite**: a private call for one, for a phone call away from the room. A call for two is the
  [Office Pod](office.md#office-pod).
- **It is a call of its own** while calls are on, like an Office Pod ([Meeting rooms and the
  stage](../012-collaboration/meeting-rooms-and-stage.md#rooms-are-calls-part-1-built)): its floor (the booth inside
  its frame) is a call zone, so whoever sits in it hears nobody in the room and nobody in the room hears them, on
  every screen and in the api's hearing check alike. A booth in a room is the innermost call there.
- **Only its sitter is in its call.** Someone walking across the booth's floor without sitting in it stays in the
  room's call the whole way, never joining the booth's, even for a step: the booth's call counts the person seated on
  it (the seat in their presence), not feet on its floor.
- **Sitting sets Busy.**
- It has no door and no walls that block: a full booth stops a second person beside it, by the seat rules.

### Standing Desk, Hot Desk

- **Standing Desk**: a tall height-adjustable desk on a steel frame, a monitor and a keyboard on it. One standing
  spot in front of it, facing the monitor (up the canvas). No status.
- **Hot Desk**: a desk with a chair in front, a monitor, a laptop dock and a name card standing on the front edge of
  the desk. One seat, facing the monitor (up the canvas).
- **The name card** reads **Hot Desk** while nobody sits there, and the sitter's name while somebody does ("You" for
  your own, on your screen), on every screen. The claim is the seat claim: whoever presence says holds the seat is
  named, and two people who sat at once are settled by the [seat rules](chair.md), so the card never shows two
  names. Nothing is stored: the desk is free again the moment its sitter stands, leaves or drops off.
- **While held, the card rises** off the desk to stand over the sitter, clear of their head and the chip over it,
  where any other seat's name pill would be (a Tall character's higher), so the head never hides the name. It is the
  desk's name pill: a held Hot Desk shows no second one. The desk's own card stays, blank, under it.

### Pet Bed and its dog

A round cushioned dog bed with a bone toy, and the office dog that lives in it: a small sandy dog with a darker ear and
a wagging tail.

- **It wanders its room.** The dog's room is the innermost Room whose floor holds the bed's middle; a bed in no room
  lets it wander a circle 240 px round the bed. Every 9 seconds is a **leg**: the dog trots to a spot in its room for
  the first 3 seconds of the leg, then sits there. Every fourth leg it goes back to its bed and naps.
- **Never behind or under a piece.** A spot where the dog's body would overlap any piece's box (a coffee machine, a
  desk, a plant, a fence) or another room inside its own is passed over for the generator's next spot, up to 12 tries;
  a room with no clear spot in 12 keeps the dog napping that leg. Floors are walked over: rugs, grass, paths, stages,
  pads and the beds. The same spot is chosen on every screen, as the pieces are the same.
- **The same dog for everyone, with nothing sent.** Each leg's spot comes from the bed's id and the leg's number
  (the time, `floor(now / 9000)`), through a small seeded generator, so every screen with a clock right to a second
  sees the dog in the same place. Nothing is stored, nothing rides presence, and nothing runs per frame: each dog has
  one timer that wakes once a leg and sets the next spot, and the trot between is a CSS transition.
- **Patting it**: a press on the dog pats it, for you: a small heart rises above it and its tail wags faster for a
  second and a half. Nobody else sees your pat. Its label for a screen reader is **Pat the Dog**.
- **Under reduced motion** the dog stays curled up asleep in its bed: no wandering, no wag, and a pat shows the heart
  without its rise.
- The dog never blocks and is never a destination; it is drawn over the floor and under people. An export draws the
  bed with the dog asleep in it.

### Reception Desk

A curved front desk: a wood counter top over a pale front panel with a band of the theme's colour, a monitor and a
plant behind the counter, and a brass service bell on the counter.

- **Walking up to it** (your feet within 32 px in front of its counter, across its width) shows a **Welcome** bubble
  above it for you, for as long as you stand there, as the [Arcade Machine](social-pieces.md#arcade-machine)'s
  Insert Coin does. Nobody else sees your bubble.
- **A click anywhere on the desk walks you to its front**, 16 px below it under the click (kept off its ends), never to
  the floor behind the counter, where there is no Welcome. A turned desk has no front below it, so the click is the walk.
  The [Arcade Machine](social-pieces.md#arcade-machine) walks the same way.
- **The bubble holds a Ring Bell button.** Pressing it rings the bell: you hear a bright ding, the bell on the desk
  rings out (two waves spread from it and fade), and so does it for everyone who hears it.
- **Who hears it**: everyone walking whose character stands in the desk's room (the room it stands in, or beside, as a
  Screen belongs to one), or, for a desk in no room, within 480 px of it. They hear the ding, see the bell ring out, and see
  a toast, **"Sam rang the bell at Reception"**, unless they are on Do Not Disturb, who are not rung. You do not get the
  toast for your own ring.
- **One ring per 5 seconds per person**: the button reads **Rang** for five seconds, and the room drops a second ring
  from the same person inside that window.
- A ring is a moment, like a knock: presence, never stored, never logged, never replayed.

## The wire

The bell is one presence op, `avatar-bell` (`{ kind, tabId, deskId }`), broadcast to the tab like a knock
([Knock](../012-collaboration/knock.md#the-wire)): never ordered, logged or replayed, never touching the document, from
any share level. The room drops a malformed one and a second from the same sender inside 5 seconds; each receiver
checks the desk is on its tab, is a Reception Desk, and that it stands in earshot. Nothing else here is on the wire:
statuses ride presence, sitting is the seat claim, the dog is the clock.

## Share roles

| Who             | May                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Editor**      | Places, moves and deletes every piece; sits, stands, uses, rings and pats like everyone                                                        |
| **Participant** | Has no palette, so places none; sits in every piece (and gets its status), rings the bell, pats the dog                                        |
| **Viewer**      | Walks, so sits in every piece and gets its status (presence), rings the bell (a visitor arriving is who a reception bell is for), pats the dog |

A Viewer rings the bell for the same reason a Viewer knocks: it is presence, not content, and a visitor at the front
desk is exactly who it is for. The room's throttle keeps anyone from ringing it on repeat.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- Placing one: `Element · Added · <Kind>` (`Nap-pod`, `Treadmill`, `Weight-bench`, `Phone-booth`, `Standing-desk`,
  `Hot-desk`, `Pet-bed`, `Reception-desk`).
- Ringing the bell: `Canvas · Used · ReceptionBell`; patting the dog: `Canvas · Used · PatPet`. Never who, never where.
- A status a piece sets is not an event (it is not a pick); a status picked by hand counts as before.

## In the templates

- **Virtual Office**: a Reception Desk in the Reception, and a Nap Pod in the Focus Room.
- **Coworking Space**: each of its two booths (a small room of its own) holds a Phone Booth in place of its chair.
- **Hotel and Suites**: the Lobby's reception is a Reception Desk in place of its two desks; the Spa Room gains a
  Treadmill in its corner beside its two pods (a Weight Bench is too wide for the corner, so it is only in the palette).
- **Co-working Tower**: the Quiet Room gains a Nap Pod beside its desks; the Hot Desks room's third island is four Hot
  Desks, two rows back to back that face the same way.
- **Startup HQ**: the back row of the Studio's second island stands, at two Standing Desks, and a Pet Bed lies in the
  aisle between the islands, where the office dog lives.
- The Tower's Phone Booths room keeps its six Office Pods (a call for two each): the Phone Booth piece is for one.

## Export

An export draws each piece's art as the canvas does, in the paper's ink: the Treadmill's belt still, the booth's lamp
unlit, the Hot Desk's card blank, the Pet Bed with its bone and no dog (the dog is live, so it is the canvas's alone), the
Reception Desk without its bubble.

## Not in scope

- Inviting someone into a Phone Booth (the Office Pod is the call for two).
- Choosing a cat, naming the dog, or a pat everyone sees.
- Booking a hot desk ahead, or a desk that remembers who sat there.
- A quiet-room piece or a room setting that sets Focusing (a Room with Nap Pods is the quiet room).
- Steps counted on the treadmill, or a workout.
