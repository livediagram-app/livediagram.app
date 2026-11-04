# Meeting rooms and the stage

Status: **in progress** (Work Tracker #319, built in four parts; #436 folded into part 1). Part 1, **rooms are
calls**, and part 2, **the stage under the hood** (the element, its hearing and its role gate, not yet in the palette),
are built for staging; raise hand and Do Not Disturb (part 3) and the stage's palette tile, settings, template and help
(part 4) are specified here and built later. Under the calls kill switch and off in production with the rest of calls
([Turning calls on](proximity-audio.md#turning-calls-on)).

Plain distance ([Proximity audio](proximity-audio.md#hearing)) suits an open floor, but not every gathering. A meeting
room should be private: whoever is in it hears everyone else in it, and nobody outside hears a word. An all-hands
needs one speaker heard by everyone. And somebody heads-down needs a way to stop voices reaching them at all.

## Rooms are calls (part 1, built)

An [Office Room](../009-elements/office.md#room) (the `room` shape) is a **call of its own** (owner, 2026-11-03: rooms
are the zones, not a separate element). Its walls block sound fully, as they block walking.

- **Inside a room, you hear everyone in the same room**, at full volume, whatever the distance: opposite corners of
  a long boardroom hear each other as well as two people side by side. Voices still sit left or right of you as
  they stand (the same pan as in the open), so a group can tell who is talking.
- **Nobody outside the room hears anyone inside it**, however close: a character pressed against the outside of the
  wall, or standing in the corridor by the door, hears nothing. And nobody inside hears anyone outside.
- **Two rooms side by side do not hear each other** through their shared wall (#436: walls block, they do not damp).
- **Outside every room** (the open floor, a corridor, a lawn), hearing is by distance exactly as before.
- **The doorway is the threshold.** You are inside once your feet are past the line of the walls (the wall's centre
  line, which runs across the doorway too). Standing in the doorway with your feet on the corridor side, you are
  still in the corridor; one step in, you are in the room. There is no in-between, so nobody is half heard.
- **A room inside a room** (a phone booth drawn inside an open-plan room): you are in the innermost room your feet
  are in, so the booth is private from the floor around it.
- **A closed room** (doorway **None**, reached by a [Portal](../009-elements/portal-element.md)) is a call like any
  other.
- **Only rooms you can see count.** A room on a hidden layer neither blocks walking nor makes a call. A room's
  rotation is ignored, as the walls ignore it.
- **Video and screens follow hearing**: a bubble is received only from someone you hear
  ([Who sees what](video-and-screen-bubbles.md#who-sees-what)), so a room's cameras and shared screens stay in it.
  Within a room, the caps still pick the nearest six cameras and two screens.
- **The equaliser still shows through walls.** Bars above a talking character carry only that somebody is talking,
  never what is said, so a closed door reads like glass: you can see the meeting is busy. They show brighter for the
  people you hear, as before.
- **The mic indicator** reads **Live** while anyone in your room hears you (or, in the open, anyone in earshot), and
  **Nobody Near** otherwise.
- A **Virtual Office** template's rooms become its calls with no change to the board: the meeting rooms, the phone
  booths and the kitchen are private, the open floor between them is by distance. The **Coworking Space** and the
  **All-Hands Hall** are each one big room, so everyone inside either hears everyone else inside it (see
  [Cost](#cost)); the hall's stage changes that once the template stands a Stage on it (part 4).

## The stage (part 2, built)

The All-Hands Hall's stage today is only a rug with "Stage" written over it. It becomes a real element. Part 2 builds
the element and its hearing; the palette tile, its settings in the element menu, the hall template's switch from the
rug and the help come in part 4, so until then a stage arrives only from an agent, the API or a pasted board.

- **A Stage** is an office piece (shape kind `stage`, [Office](../009-elements/office.md#stage)): a raised platform
  drawn from the room's camera, the floor's fill a little lighter, a front edge you see the face of, and its name
  ("Stage") on a plate at its front. It is a floor piece like a rug: behind furniture, never blocking, never a
  destination. Default 360 × 140.
- **Standing on it** means your feet are on its top, strictly inside it: the front edge (the face you see) and the
  outline are off it, as a room's threshold is outside the room. Of two stages overlapping, the smaller holds you.
  A stage on a hidden layer is no stage, as a hidden room is no room; its rotation is ignored.
- **Whoever stands on the stage is heard by everyone on the tab**: every walking character in the Space's tab, in any
  room or none, at full volume and centred (no pan). On the stage, speakers hear each other as one room does (full
  volume, by side). Several stages on one tab are one stage for hearing: every speaker on any of them reaches the tab
  and hears the others.
- **The audience is muted to the stage by default.** While anyone stands on a stage, everyone in the stage's room (or,
  for a stage in the open, everyone else on the tab) is its **audience**: the stage does not hear them, and in the
  stage's room they hear each other only by distance, so neighbours can whisper without the hall hearing. The walls
  still stand: the hall's audience never hears the corridor, and a stage in the open leaves every meeting room on the
  tab its own call (its audience on the open floor already hears by distance).
- **Only someone the stage lets speak is a speaker.** Standing on a stage you may not speak from (the role gate
  below), you are its audience like anyone in the room.
- **Seen too, if the stage says so.** A stage's **Show Cameras** setting (`stageCameras`, off by default) lets everyone
  on the tab receive an on-stage speaker's camera and screen bubbles, within the bubble caps (the nearest six cameras
  and two screens on screen) and the kill switch's limits. Off, a speaker's bubbles reach only the other speakers on
  a stage, who hear them as one room; the audience hears without seeing.
- Walking off the stage ends it at once: you are back to your room's call. Hearing re-decides on the next scene, as
  it does for a room.
- **The mic indicator** reads **Live** on the stage while anyone else walks the tab (they all hear you).

## Raise hand (part 3, planned)

- An audience member may **Raise Hand** from the call strip while a stage is live. A small raised hand shows above
  their character, and a count of raised hands shows to the people on the stage.
- Anyone on the stage (or an Editor) presses a raised hand's **Let Speak**: that person is heard by everyone on the
  tab as if on the stage, until they **Lower Hand**, the stage presses **Done**, or they walk out of the room.
- Raising a hand is presence, never stored: leaving the mode lowers it.

## Do Not Disturb (part 3, planned)

- A fifth [status](../008-canvas/avatar-mode.md#status), **Do Not Disturb** (token `dnd`): a red dot with a bar
  across it, shown to everyone like the other statuses.
- **While it is on, no voice reaches you**: every audio subscription closes, every bubble closes, and other people's
  equalisers hide from you ([Proximity audio](proximity-audio.md#do-not-disturb)). The stage does not reach you either.
- **You can still be heard** if you speak (your microphone keeps its own Mute), and your bars still show to others,
  so turning to a neighbour does not need the status cleared.
- Set and cleared from the Avatar panel's Status row, like the others, for the session only.

## Share roles

| Act                                         | Editor | Participant                   | Viewer |
| ------------------------------------------- | ------ | ----------------------------- | ------ |
| Hear and be heard in a room's call (part 1) | Yes    | Yes                           | Hear   |
| Speak from a stage (part 2)                 | Yes    | When the stage allows (below) | No     |
| Change a stage's settings (part 4)          | Yes    | No                            | No     |
| Raise and lower a hand (part 3)             | Yes    | Yes                           | No     |
| Let a raised hand speak (part 3)            | Yes    | From the stage                | No     |
| Set Do Not Disturb (part 3)                 | Yes    | Yes                           | Yes    |

- **Who may take the stage** is the stage's own setting, **Who Can Speak** (`stageSpeakers`): **Editors** (`edit`,
  the default) or **Editors and Participants** (`take-part`). Someone not allowed may still stand on it; they are
  heard as the audience is, and (part 4) a line under the call strip says "Only Editors speak from this stage".
- **Whose level counts** is the one the room stamps on each person's presence from their grant (`role`), never one a
  browser claims; your own is your session's `can`.
- A Viewer never speaks anywhere ([Proximity audio](proximity-audio.md#share-roles)); it hears a room or a stage as
  anyone does.
- Gated in the editor on the session's `can` (never `isReadOnly`), and in the room on the grant's level for the hand
  and let-speak ops (part 3), as the room gates `avatar-voice` and `call-track` today.

## Trust

Hearing is decided in each browser, from positions every walker already shares, as distance is: the room relays
positions and the mint route lets any session in the Space subscribe to a microphone published in it. A browser that
ignores the rule could still subscribe to a microphone in a room it is not in. The rooms, stage and hands are for
arranging a meeting, not for keeping a secret from someone with edit access to the code; a server-side check (the
mint route asking the room who may hear whom) is a follow-up, recorded on the card.

## Cost

A room is one call, so everyone in it receives everyone else's microphone: a room of `n` people is `n × (n − 1)`
streams, about 0.018 GB per stream-hour. Four in a meeting room is 12 streams, about 0.2 GB an hour ($0.01). The
Coworking Space's open floor with 30 people is 870 streams, about 16 GB an hour, about $0.78 an hour once past the
free 1,000 GB a month; the same 30 spread round the floor in the open would hear only their neighbours.

A stage (part 2) is one speaker to everyone: about 0.018 GB per listener-hour, so a hall of 100 is about $0.09 an
hour, and its audience whispers by distance, so a big hall costs what a stage costs plus the whispering, not `n²`.
Video on the stage is under the kill switch's limits ([Calls kill switch](../016-platform/calls-kill-switch.md)).

## Telemetry

Part 1 adds none: hearing is not an act. Part 2: `track('Canvas', 'Used', 'StageSpeak')` when, in a call, you step
onto a stage that lets you speak (once per stepping on). Part 3: `track('Canvas', 'Used', 'RaiseHand')`, `track('Canvas', 'Used', 'LetSpeak')`, and the status
change already counted (`AvatarStatus`). Never who, never how long.

## Out of scope

- Walls that damp rather than block (#436 asked; the owner chose rooms as calls).
- Muting someone else, and per-person volume ([Proximity audio](proximity-audio.md#out-of-scope)).
- Recording a stage, or any transcript.
