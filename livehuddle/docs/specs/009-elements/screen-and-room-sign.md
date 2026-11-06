# Screen and Room Sign

Two meeting pieces for a Space ([Office](office.md)): a **Screen** on a room's wall that shows what someone in the room
is sharing, and a **Room Sign** by a room's door that says whether the room is free. Both are placed pieces (a fixed
default size, like the office furniture) in the palette's **Meeting** category, and both read the room they belong to
from where they stand. Neither stores anything about who is where: occupancy and sharing are presence and the call,
worked out on every machine, as a [chair's occupancy](chair.md#occupancy-is-presence) is.

## Why

A meeting room in a Space is a call of its own ([Meeting rooms and the
stage](../012-collaboration/meeting-rooms-and-stage.md#rooms-are-calls-part-1-built)), and a screen share already
reaches everyone in it, as a small bubble above the sharer's head ([Video and screen
bubbles](../012-collaboration/video-and-screen-bubbles.md)). A real meeting room puts the share on the wall, where
everyone looks. And before walking in on a meeting, people look at the sign by the door. The [Knock](../012-collaboration/knock.md)
is the polite way in that a sign makes possible.

## A piece's room

Both pieces belong to one **call area**: a Room or an Office Pod (`roomZones`, call-geometry.ts).

- A piece **inside** a room's floor belongs to it (the innermost one, so a Screen in a pod in a room is the pod's).
- A piece **outside every room** (a sign beside the door, on the corridor side) belongs to the nearest room or pod
  whose floor is within **64 canvas px** of the piece's centre, nearest first.
- Otherwise it has no room: a Screen still plays its video link or shows its idle face; a Room Sign reads **No Room**.
- Worked out from the board alone (`meetingPieceRoom`), only when the board changes, never on a step.

## Screen

A flat wall screen: a dark panel in a thin bezel, a small status light on its lower edge, a soft shadow on the wall.

- **Default 192 × 120**, aspect locked. Placed like any office piece (a tap places it at its size, a drag moves the
  drop). Not a destination, never blocks walking, takes no label (it has nothing to write on).
- **What it shows**, the first of these that applies, for each viewer:
  1. **A screen share in its room.** When someone standing in the Screen's room is sharing their screen in the call,
     and this viewer receives that share, the Screen shows it, scaled to fit inside the panel (letterboxed, never
     cropped), with the sharer's name in a small chip in its corner. Your own share shows on the Screen of the room
     you are in. Several sharers in one room: the one nearest the Screen.
  2. **Its video link.** A YouTube, Vimeo or Loom link set from its menu (`screenUrl`) shows the video's poster (a
     named card for providers without one) with a play mark. Nothing third-party loads until somebody opens it, as
     for every embed.
  3. **The idle face**: the panel dark, a faint screen glyph and **No one is sharing**.
- **Who receives the share** is the call's own rule, unchanged ([Who sees
  what](../012-collaboration/video-and-screen-bubbles.md#who-sees-what)): whoever in the room hears the sharer
  (within earshot, [Rooms are calls](../012-collaboration/meeting-rooms-and-stage.md#rooms-are-calls-part-1-built))
  can receive the share; someone outside the room never does, and sees the video link or the idle
  face. The share's bubble rules still apply (the sharer's character is on screen, at most two screens, a hidden tab
  receives none), so the Screen costs no extra traffic: it shows a stream this viewer already receives.
- **Pressing it** (a click that is not a drag, `usePressWithoutDrag`) opens it large:
  - a share opens the call's maximised panel for that sharer ([Maximised](../012-collaboration/video-and-screen-bubbles.md#maximised)),
    exactly as pressing their bubble does;
  - a video link opens a large player over the canvas (at most 1280 px wide, 16:9, never more than 90% of the window),
    with the video's name and a **Close** button in a bar above it; Escape or the backdrop closes it. The player
    mounts only then, on the provider's embed origin (youtube-nocookie.com for YouTube).
  - The idle face is not pressable.
- **Not synced (yet).** The video plays for whoever opens it, from the start, on their own screen. Play and pause
  synced across the room is a follow-up (Not in scope).
- **Video Link** is set from the element menu's **Screen** section: a link field with **Set** and **Clear**. A link
  that is not a YouTube, Vimeo or Loom video says "That isn't a video link" and is not saved. `screenUrl` is an
  http(s) address of at most 2,048 characters; anything else makes the element invalid.
- **No per-frame work**: the face re-renders when the call's received streams change or when who is in its room
  changes, never on a step or a frame.

## Room Sign

A small plaque by a room's door: the room's name over a status line with a coloured dot, and a **Knock** button.

- **Default 120 × 64**, aspect locked. Placed freely beside a door (snapping onto the nearest Door or doorway is a
  follow-up, Not in scope). Not a destination, never blocks walking, takes no label of its own: its name is its room's.
- **The name** is the room's label (a Room's name plate, "Kitchen"), an Office Pod's label or **Office Pod**, or
  **No Room** when it has none.
- **The status**, from presence alone, the same on every machine:
  - **Free** (a green dot): nobody is inside.
  - **In Use** (an amber dot) with the number of people inside, "In Use · 3", and on the line under it how long it has
    been in use, "12 min", beside the Knock button. "Inside" is a walker on this tab whose feet are in the room's floor and not in a smaller room or pod
    within it (a pod in a room has its own sign); you count while you walk.
  - **Do Not Disturb** (a red dot): an Office Pod whose door is shut (both its seats held, [Office Pod](office.md#office-pod)).
- **How long** counts from when this viewer first saw the room go from empty to in use, never stored and never sent:
  presence carries where people stand, not when they arrived. A viewer who opens the Space while a room is already in
  use counts from then, and the time reads "Just now" until a minute passes. Shown as "Just now", "5
  min", "1 h 20 min". It ticks once a minute while the room is in use, and not at all while it is free.
- **Knock**: a small button on the plaque while the room is In Use or Do Not Disturb, for anyone who is walking and is
  not already inside. Pressing it knocks on the room ([Knock](../012-collaboration/knock.md)); for ten seconds it reads
  **Knocked** and does nothing. A free room has no Knock: walk in.
- Re-renders when its room's count, status or name change, and once a minute while In Use; never on a step.

## Share roles

| Act                                                 | Editor | Participant | Viewer |
| --------------------------------------------------- | ------ | ----------- | ------ |
| Place, move, resize, delete a Screen or Room Sign   | Yes    | No          | No     |
| Set or clear a Screen's Video Link                  | Yes    | No          | No     |
| See a Screen (share, video poster, idle) and a Sign | Yes    | Yes         | Yes    |
| Open a Screen large                                 | Yes    | Yes         | Yes    |
| Knock from a Room Sign                              | Yes    | Yes         | Yes    |

- Placing and the Video Link are editing (`can.edit`); a Participant has no palette.
- Seeing and opening are your own view. Knocking is presence: anyone who may walk may knock (a Viewer walks).
- Sharing the screen the Screen shows stays an Editor's act ([Share
  roles](../012-collaboration/video-and-screen-bubbles.md#share-roles)).

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- Placing one: `Element · Added · Screen`, `Element · Added · Room-sign`.
- A Video Link set or cleared: `Element · Changed · Screen`.
- Opening a Screen large: `Canvas · Used · ScreenOpen`. Knocking is counted by [Knock](../012-collaboration/knock.md).
- Never who, never which room, never the link.

## Export

An export draws a Screen's idle face (or its video's named card when it has a link) and a Room Sign's plaque reading
**Free** under the name **Room**: an export is a still picture of one element, with nobody in it.

## Not in scope

- Play and pause of a Screen's video synced for everyone in the room (it would ride a presence op like a knock, from
  whoever pressed play, with the video's time; the embed's player API differs per provider).
- A Room Sign snapping onto the nearest Door or doorway as it is placed (the placement preview work owns snapping).
- The time in use shared across machines (an optional `enteredAt` on the avatar presence, so a late viewer sees the
  same minutes as everyone else).
- A Screen that receives a share whose sharer is off screen (the bubble rules would need to count a Screen in view as
  the sharer in view), or more than two at once.
- A schedule or booking on a Room Sign.
