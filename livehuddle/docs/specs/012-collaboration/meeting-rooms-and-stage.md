# Meeting rooms and the stage

Status: **built** (Work Tracker #319, built in four parts; #436 folded into part 1). Part 1, **rooms are
calls**, part 2, **the stage under the hood** (the element, its hearing and its role gate), part 3, **raise hand and
Do Not Disturb** (with the line over the call group for a stage you may not speak from), and part 4, **the stage's
way in** (its palette tile, its settings, the All-Hands Hall on a real stage, and its help). Under the calls kill
switch, and on wherever calls are ([Turning calls on](proximity-audio.md#turning-calls-on)).

Plain distance ([Proximity audio](proximity-audio.md#hearing)) suits an open floor, but not every gathering. A meeting
room should be private: nobody outside hears a word, while inside it you still hear the people near you. An all-hands
needs one speaker heard by everyone. And somebody heads-down needs a way to stop voices reaching them at all.

## Rooms are calls (part 1, built)

An [Office Room](../009-elements/office.md#room) (the `room` shape) is a **call of its own** (owner, 2026-11-03: rooms
are the zones, not a separate element). Its walls block sound fully, as they block walking.

- **Inside a room, you hear the people near you in the same room, by distance**, exactly as on the open floor (owner,
  2026-11-06: hearing everyone in a big room at full volume was too much): the same hearing radius, release radius,
  fade and pan as [Proximity audio](proximity-audio.md#hearing). Opposite corners of a long boardroom do not hear
  each other; walk over to join a conversation. Earlier, a room was one call at full volume whatever the distance.
- **Nobody outside the room hears anyone inside it**, however close: a character pressed against the outside of the
  wall, or standing in the corridor by the door, hears nothing. And nobody inside hears anyone outside.
- **A glass-walled room is a room** ([Glass walls](../009-elements/office.md#glass-walls), Work Tracker #539): its call
  stays inside exactly as a solid room's does (`roomZones` takes every `room` whatever its `variant`, and so does the
  server's hearing check). People outside see who is in it through the glass and hear none of them; people inside hear
  nobody outside. A [Window](../009-elements/room-builder.md#window) in any wall changes nothing either.
- **Two rooms side by side do not hear each other** through their shared wall (#436: walls block, they do not damp).
- **Outside every room** (the open floor, a corridor, a lawn), hearing is by distance exactly as before.
- **The doorway is the threshold.** You are inside once your feet are past the line of the walls (the wall's centre
  line, which runs across the doorway too). Standing in the doorway with your feet on the corridor side, you are
  still in the corridor; one step in, you are in the room. There is no in-between, so nobody is half heard.
- **A room inside a room** (a phone booth drawn inside an open-plan room): you are in the innermost room your feet
  are in, so the booth is private from the floor around it.
- **A closed room** (doorway **None**, reached by a [Portal](../009-elements/portal-element.md)) is a call like any
  other.
- **An [Office Pod](../009-elements/office.md#office-pod) is a room for this**: the floor inside its walls is a call of
  its own, door open or shut, and a pod in a room is the innermost call (`roomZones` takes `office-pod` with
  `podInterior`).
- **So is a [Phone Booth](../009-elements/workday-pieces.md#phone-booth)**, a call for one: the booth inside its frame
  (`roomZones` takes `phone-booth` with `boothInterior`), so whoever sits in it is out of the room's audio. Its call
  holds only its sitter: someone walking across it stays in the room's call.
- A room's rotation is ignored, as the walls ignore it.
- **Video and screens follow hearing**: a bubble is received only from someone you hear
  ([Who sees what](video-and-screen-bubbles.md#who-sees-what)), so a room's cameras and shared screens stay in it.
  Within a room, as in the open, that is the people in earshot, and the caps still pick the nearest six cameras and
  two screens.
- **The equaliser still shows through walls.** Bars above a talking character carry only that somebody is talking,
  never what is said, so a closed door reads like glass: you can see the meeting is busy. They show brighter for the
  people you hear, as before.
- **The mic indicator** reads **Live** while anyone in earshot on your side of the walls hears you, and **Nobody
  Near** otherwise.
- A **Virtual Office** template's rooms become its private spaces with no change to the board: the meeting rooms,
  the phone booths and the kitchen are walled off, and inside each, as on the open floor between them, hearing is by
  distance. The **Coworking Space** and the **All-Hands Hall** are each one big room, so their people hear their
  neighbours, as on an open floor, until someone speaks from the hall's [Stage](#the-stage-part-2-built) (part 4).
- **A big room hears its talkers** (#482) is retired with whole-room hearing: a room by distance costs what the same
  people on the open floor cost, so it needs no cap. See [Cost](#cost).

## The stage (part 2, built)

The All-Hands Hall's stage was a rug with "Stage" written over it. It is a real element: part 2 builds the element
and its hearing, and part 4 gives it its tile, its settings and the hall
([The stage's way in](#the-stages-way-in-part-4-built)).

- **A Stage** is an office piece (shape kind `stage`, [Office](../009-elements/office.md#stage)): a raised platform
  drawn from the room's camera, the floor's fill a little lighter, a front edge you see the face of, and its name
  ("Stage") on a plate at its front. It is a floor piece like a rug: behind furniture, never blocking, never a
  destination. Default 360 × 140.
- **Standing on it** means your feet are on its top, strictly inside it: the front edge (the face you see) and the
  outline are off it, as a room's threshold is outside the room. Of two stages overlapping, the smaller holds you.
  A stage's rotation is ignored.
- **Whoever stands on the stage is heard by everyone on the tab**: every walking character in the Space's tab, in any
  room or none, at full volume and centred (no pan). On the stage, speakers hear each other as one call (full
  volume, by side). Several stages on one tab are one stage for hearing: every speaker on any of them reaches the tab
  and hears the others.
- **The audience is muted to the stage by default.** While anyone stands on a stage, everyone in the stage's room (or,
  for a stage in the open, everyone else on the tab) is its **audience**: the stage does not hear them, and in the
  stage's room they hear each other by distance, as everywhere, so neighbours can whisper without the hall hearing.
  The walls still stand: the hall's audience never hears the corridor, and a stage in the open leaves every meeting room on the
  tab behind its walls.
- **Only someone the stage lets speak is a speaker.** Standing on a stage you may not speak from (the role gate
  below), you are its audience like anyone in the room.
- **Seen too, if the stage says so.** A stage's **Show Cameras** setting (`stageCameras`, off by default) lets everyone
  on the tab receive an on-stage speaker's camera and screen bubbles, within the bubble caps (the nearest six cameras
  and two screens on screen) and the kill switch's limits. Off, a speaker's bubbles reach only the other speakers on
  a stage, who hear them as one room; the audience hears without seeing.
- Walking off the stage ends it at once: you are back to your room's call. Hearing re-decides on the next scene, as
  it does for a room.
- **The mic indicator** reads **Live** on the stage while anyone else walks the tab (they all hear you).
- **The stage shows who is on it, to everyone.** While anyone stands on a stage, the stage lights up for everyone on
  the tab: a soft spotlight falls on its top, and an **On Stage** badge with a red dot hangs from its plate, with a
  dot in each person's presence colour and their names ("Alex", "Alex and Sam", "Alex, Sam +2"). Your own name reads
  **You**, so on your screen the badge says "You" (or "You and Sam"). While you stand on a stage that lets you speak,
  unmuted, a second badge sits to its right on your screen alone: **Everyone Can Hear You**, with a megaphone (owner,
  2026-11-07). It is worked out from the board, so it shows on the local preview too (Mic: Only You), and goes while
  you are muted. It is presence, never the document (like a chair's sitter, [Chair](../009-elements/chair.md)
  "Occupancy is presence"): it goes out the moment the last person steps off, leaves Avatar mode, changes tab or
  drops off, and it works with calls off too. The spotlight fades in and out (off under reduced motion). Someone on a
  stage they may not speak from still lights it: it says who stands there; the mic indicator and the stage line say
  who is heard.
- **You are told you are on it.** While you speak from a stage, a calm line hangs over the call group, where the stage
  line goes: **"You're on stage. Everyone on this tab hears you."** (the may-not-speak line keeps its place for a stage
  you may not speak from). It is an `aria-live="polite"` status, so it is announced once.
- Implementation: `stageStanders` (`apps/editor/lib/calls/stage-presence.ts`) works out who stands on each stage from
  your character and the peers' presence, on the same top-of-the-stage test the call uses (`stageAt`), and is merged
  into the occupants the element views already receive (`sittersOf`), kept by value so a stage re-renders only when
  who is on it changes, never on a step. `StageView` draws the light and the badge; the strip line is
  `StageLine`'s on-stage state.

## Raise hand (part 3, built)

A stage's audience asks to speak by raising a hand, and the stage lets them.

- **Raise Hand** sits on the Call dock while you are a live stage's **audience** (someone speaks from a stage and
  you do not) and you may speak (an Editor or a Participant). Pressed, it reads **Lower Hand**, and a raised hand
  shows above your character: a small amber hand on a round badge, beside your head, where everyone on the tab sees
  it. Raising is counted (`RaiseHand`).
- **The stage sees how many.** While you speak from a stage, the Call dock shows the number of raised hands on the
  tab (a hand badge with the count), and each raised hand above a character is a button: **Let Speak**.
- **Let Speak** is pressed by anyone speaking from a stage, or by an Editor anywhere on the tab, on the hand above
  someone's character. That person is then **heard by everyone on the tab as if on the stage** (full volume,
  centred, and they hear the other speakers as one room), and their badge turns from the amber hand to the brand's
  microphone. Their Call dock reads **Speaking**, still with **Lower Hand**. Letting someone speak is counted
  (`LetSpeak`).
- **It ends** when they press **Lower Hand**, when someone who may let them speak presses their badge again
  (**Done**), when they walk out of the room they raised it in (for a stage in the open, off the open floor into a
  room), or when the call ends (they leave the mode, the tab or the Space). Done lowers the hand too: asking again is a new
  hand.
- **Whoever let you speak must still be able to.** Each browser checks the person who pressed Let Speak is an Editor
  or speaks from a stage now; once neither is true (a Participant who let you speak steps off the stage), you are
  the audience again, with your hand still raised. The check follows the person, not their connection: when whoever
  let you speak reconnects (a dropped network, a sleeping laptop), they come back as the same person and you keep
  speaking, in every browser and in the room's own check.
- **Heard, not seen.** Someone let speak reaches the whole tab's ears, never its screens: their camera and screen
  bubbles stay with the people who would see them anyway (the other speakers, as one room).
- **Presence, never stored**: a hand lives on the room's connection, so a reload, a dropped connection or leaving
  the mode lowers it, and nobody arriving later sees an old one. Your own Call dock agrees: when your connection drops,
  your hand goes down there too (it reads **Raise Hand** again), so you never see **Lower Hand** for a hand nobody
  else sees. A late arrival does see the hands already up: a
  raised hand is sent again whenever someone new walks onto the tab.
- With a screen reader: the badge is a button named "Sam raised a hand, Let Speak" (or "Sam is speaking, Done")
  for someone who may press it, and an image named "Sam raised a hand" for everyone else; the Call dock's count is
  read as "3 raised hands".

## The stage line (part 3, built)

Standing on a stage you may not speak from, a calm line hangs just over the call group (on the [Call dock](../008-canvas/avatar-mode.md#the-call-dock), at the bottom centre), centred on it (owner, 2026-11-07: the call moved to the dock, so the line moved from under the group to over it):
**"Only Editors speak from this stage"** (or "Only Editors and Participants speak from this stage" for a Viewer on a
stage that lets Participants speak). It goes the moment you step off. It is an `aria-live="polite"` status, so a
screen reader hears it once on stepping on.

## Do Not Disturb (part 3, built)

- A fifth [status](../008-canvas/avatar-mode.md#status), **Do Not Disturb** (token `dnd`): a red dot with a white bar
  across it, shown to everyone like the other statuses.
- **While it is on, no voice reaches you**: every audio subscription closes, every bubble closes, and other people's
  equalisers hide from you ([Proximity audio](proximity-audio.md#do-not-disturb)). The stage does not reach you either.
- **You can still be heard** if you speak (your microphone keeps its own Mute), and your bars still show to others,
  so turning to a neighbour does not need the status cleared.
- Set and cleared from the avatar palette's Status flyout, like the others, for the session only. While you are in a call,
  the Call dock shows a **Do Not Disturb** segment beside the microphone; pressing it clears the status.
- **Only livehuddle offers it.** The status vocabulary is shared with livediagram (`@livehuddle/avatar`), which has
  no calls: there the Avatar panel keeps offering the four (livehuddle's avatar palette offers the five), though a `dnd` status on the wire still parses and draws.

## The stage's way in (part 4, built)

- **The tile.** **Stage** sits in the palette's **Rooms** category ([The Space categories](../010-palette/palette-top-level-categories.md#the-space-categories)), straight after Room
  (Fence, Room, Stage, Rug): a platform with a microphone on
  a stand. Its line: "A raised platform: whoever stands on it is heard by the whole tab." A new stage goes in behind
  everything, like a room or a rug, so chairs already placed stand in front of it. Only an Editor's palette offers
  it ([Share roles](#share-roles)).
- **Its settings** are in the element menu's **Tools › Stage** section, as a room's doorway is in Tools › Room (a Tools flyout
  holding one section shows that section at the menu's top level, so the menu reads **Stage**):
  - **Who Can Speak**: two tiles, **Editors** (the default) and **Editors and Participants** (`stageSpeakers`:
    `'edit'`, `'take-part'`), with the line "Who the whole tab hears from the stage. Anyone else standing on it is
    heard as the audience is."
  - **Show Cameras**: a switch (`stageCameras`, off by default), described "Everyone on the tab sees a speaker's
    camera and screen".
  - A selection holding several stages sets them all; other kinds in it are left alone. Each change is one undoable
    step, synced like any edit.
- **The All-Hands Hall** template ([Virtual office](virtual-office-template.md#spaces)) stands a real Stage at the
  front of the hall, 400 × 160, centred, named "Stage", where the rug and its "Stage" text were. It keeps the
  defaults but one: **Show Cameras** is on, since the hall exists for a presenter everyone watches. Editors speak
  from it; an Editor switches it to **Editors and Participants** for a panel or a demo from the floor.
- **Help**: a **Stage** article in the help centre, under Palette › Virtual Office, with a figure of a speaker on a
  stage heard by the hall; the Virtual Office article's Stage section links to it.
- **livediagram's All-Hands Hall keeps its rug**: livediagram has no calls, so it has no Stage element.

## Share roles

| Act                                         | Editor | Participant                   | Viewer |
| ------------------------------------------- | ------ | ----------------------------- | ------ |
| Hear and be heard in a room's call (part 1) | Yes    | Yes                           | Hear   |
| Speak from a stage (part 2)                 | Yes    | When the stage allows (below) | No     |
| Place a stage, change its settings (part 4) | Yes    | No                            | No     |
| Raise and lower a hand (part 3)             | Yes    | Yes                           | No     |
| Let a raised hand speak (part 3)            | Yes    | From the stage                | No     |
| Set Do Not Disturb (part 3)                 | Yes    | Yes                           | Yes    |

- **Who may take the stage** is the stage's own setting, **Who Can Speak** (`stageSpeakers`): **Editors** (`edit`,
  the default) or **Editors and Participants** (`take-part`). Someone not allowed may still stand on it; they are
  heard as the audience is, and [the stage line](#the-stage-line-part-3-built) says "Only Editors speak from this stage".
- **Whose level counts** is the one the room stamps on each person's presence from their grant (`role`), never one a
  browser claims; your own is your session's `can`.
- A Viewer never speaks anywhere ([Proximity audio](proximity-audio.md#share-roles)); it hears a room or a stage as
  anyone does.
- **Placing and setting up a stage is an Editor's** (part 4): only an Editor's palette offers the tile, and the Stage
  section lives in the Editor's element menu; a Participant's or a Viewer's short menu has none. On the server, the
  participant content rule keeps a stage's settings (and its name: a stage is a Behaviour piece) as stored whatever
  a Participant's change says, and a Viewer's element change reaches nobody.
- Gated in the editor on the session's `can` (never `isReadOnly`), and in the room on the grant's level for the hand
  and let-speak ops (part 3), as the room gates `avatar-voice` and `call-track`: a Viewer's `avatar-hand` or
  `avatar-let-speak` reaches nobody. **The room checks Let Speak too** (#495): a let-speak (or a Done) reaches its
  hand only from an Editor, or from someone the room places on a stage that lets them speak (their last shared
  position on the tab, on the tab's stored stages, with the same small margin the hearing check allows); any other
  is dropped and logged. Each browser still checks it as before.

## Trust

Hearing is decided in each browser, from positions every walker already shares, and **checked again on the server**
(#483) whenever a browser subscribes, so a modified browser cannot listen in on a room it is not in:

- **The room tells the mint route who may hear whom.** A call proves its session to the room once it starts (the
  `call-session` op, [Proximity audio](proximity-audio.md#the-wire)), so the room knows which session is whose. Every
  subscribe asks the room, for each track, whether the subscriber may hear its publisher now: from both people's last
  shared positions on the same tab, the tab's visible rooms and stages as last saved, and the hands let speak.
- **Allowed** when the two share a room, or both stand in the open within earshot, or the publisher speaks from a
  stage that lets them, or has been let speak by someone who still may. A camera or screen follows the same answer
  (bubbles follow hearing).
- **Conservative, so nobody is silenced by mistake.** Positions on the server lag the screen by a step or two, so the
  check allows a margin: 160 canvas px beyond the release radius in the open, and 64 canvas px either side of a wall
  or a stage's edge. Someone pressed against a wall's outside may therefore be allowed to subscribe; nobody further
  off is. A room drawn or moved in the last few seconds counts once it is saved. If the room does not know a
  position yet (just after it starts), it allows for its first minute.
- **A refusal is never an error.** The track is refused alone (`not_heard`); the call asks again after 2 seconds
  while it still wants it, and proves its session again, so a refusal from a stale position heals itself. Each
  refusal is logged on the server and counted in the browser that met it, so false refusals show.
- The rooms, stage and hands arrange a meeting; the check stops listening in from elsewhere on the board. It cannot
  stop someone from walking their character into a room in plain sight, which everyone sees.

## Cost

A room hears by distance, as the open floor does, so a room costs what the same people standing in the open would:
each listener receives only the people within the hearing radius, about 0.018 GB per stream-hour. Four in a meeting
room standing together is 12 streams, about 0.2 GB an hour ($0.01). The Coworking Space's floor with 30 people spread
round it receives only neighbours, not `n × (n − 1)`. Earlier, a room was one call, so the same 30 would have been
870 streams (about 16 GB an hour) without the big-room cap (#482); hearing by distance retires both.

A stage (part 2) is one speaker to everyone: about 0.018 GB per listener-hour, so a hall of 100 is about $0.09 an
hour, and its audience whispers by distance, so a big hall costs what a stage costs plus the whispering, not `n²`.
Video on the stage is under the kill switch's limits ([Calls kill switch](../016-platform/calls-kill-switch.md)).

## Telemetry

Part 1 adds none: hearing is not an act. Part 2: `track('Canvas', 'Used', 'StageSpeak')` when, in a call, you step
onto a stage that lets you speak (once per stepping on). Part 3: `track('Canvas', 'Used', 'RaiseHand')`, `track('Canvas', 'Used', 'LetSpeak')`, and the status
change already counted (`AvatarStatus`). Part 4: placing a stage is `Element · Added · Stage`, as every element is
counted; changing its Who Can Speak or Show Cameras is `Element · Changed · Stage`. Never who, never how long.

## Out of scope

- Walls that damp rather than block (#436 asked; the owner chose rooms as calls).
- Muting someone else, and per-person volume ([Proximity audio](proximity-audio.md#out-of-scope)). An Editor may stop
  someone else's screen share ([Video and screen share bubbles](video-and-screen-bubbles.md#share-roles)).
- Recording a stage, or any transcript.
