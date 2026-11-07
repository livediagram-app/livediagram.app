# Video and screen share bubbles

Status: **built** (Work Tracker #317, #318), on top of [Proximity audio](proximity-audio.md) (#315) and
under the [calls kill switch](../016-platform/calls-kill-switch.md) (#316). On wherever calls are
([Turning calls on](proximity-audio.md#turning-calls-on)).

People talking in proximity can turn on a camera, or share a screen, and it shows as a small **bubble above their
character's head** to the people in earshot. Anyone watching a bubble can press it to **maximise** it, and restore it
again. Both kinds share one bubble. With no call to send it on, the same buttons give a [local preview](#local-preview)
that only you see.

## Who sees what

Video and screens ride the call exactly as voices do: you see the bubbles of the people you hear
([Hearing](proximity-audio.md#hearing): everyone in your [room](meeting-rooms-and-stage.md#rooms-are-calls-part-1-built),
or in the open within 260 canvas px, let go beyond 300), and nobody else. A room's cameras and screens stay in it. Nothing is sent to
someone out of earshot, so a bubble costs nothing until somebody walks up.

On top of earshot, a bubble is received only while it can be seen:

- **Off-screen bubbles are not received.** A speaker in earshot whose character is outside the canvas's visible area
  (with a margin of 120 canvas px, so a bubble at the edge does not flicker) gets no video. The visible area is what
  the screen shows at any zoom: the canvas zooms about the middle of the screen, so zoomed in or out the area is
  centred where the screen's middle is, never anchored at its top-left corner (a bug until 2026-11-06 left everyone to
  your right and below you unreceived when zoomed in).
- **A hidden tab receives none.** While the page is hidden (another browser tab, a minimised window), every video and
  screen subscription closes; voices carry on. Coming back opens them again.
- **At most 6 camera bubbles at once**, the nearest. Further cameras in earshot show their character only.
- **At most 2 screen bubbles at once**, the nearest. A screen is about three bubbles' worth of traffic.
- A bubble you have maximised is kept whatever the caps and the viewport say, until you restore it.

## The camera (#317)

- **Camera** is one button beside the microphone in the call group, on the [Call dock](../008-canvas/avatar-mode.md#the-call-dock) at the bottom centre of the canvas. Off by default. Pressing it asks for the camera
  (once per site, as the browser decides) and turns it on; pressing again turns it off and the browser's camera light
  goes out. Before you join, or where there is no call at all, it is a [local preview](#local-preview).
- Your own bubble shows above your own head, mirrored, so you see what others see. Others see it unmirrored.
- **Camera Blocked** (amber): the browser refused the camera. The hover card says how to allow it.
- The camera stays on while you walk alone: it is your choice to make. Nothing is sent to anyone not in earshot.
- Leaving the call, the mode or the tab turns it off. A camera you only previewed and never sent stays a preview when
  a call ends (see [Local preview](#local-preview)).

### Two layers (simulcast)

The camera is published once with two encodings, and each viewer's subscription picks one (Cloudflare Realtime's
simulcast: `preferredRid` per subscriber, changed with `tracks/update`, confirmed in the Realtime docs on
2026-11-04):

| Layer | RID | Size             | Bitrate  | Used for                       |
| ----- | --- | ---------------- | -------- | ------------------------------ |
| Small | `h` | 640×360 at most  | 300 kbps | Every bubble                   |
| Large | `f` | 1280×720 at most | 1.5 Mbps | A bubble this viewer maximised |

Maximising switches only that viewer's subscription to the large layer; restoring switches it back. Everyone else
keeps the small layer. A bubble never steps up to the large layer by itself: if the small layer is unavailable it
waits for it.

## The screen share (#318)

- **Share Screen** sits beside the camera, for an **Editor** only ([Share roles](#share-roles)). It opens the
  browser's own picker (`getDisplayMedia`): a screen, a window or a tab.
- Capped for cost and clarity: up to **1920×1080 at 5 to 15 frames a second**, tuned for text (`contentHint`
  `detail`), at most **1 Mbps**, one layer.
- **While you share, the sharing controls join the Call dock** (owner, 2026-11-06: "When I am sharing my screen,
  remove the customisation option for my character and use the space it frees up to move the sharing controls into
  the palette"; since 2026-11-07 the call's buttons sit on the [Call dock](../008-canvas/avatar-mode.md#the-call-dock), and the avatar palette keeps its look
  while you share: Gender, Clothes and Hair stay). Right after the call group, behind a divider, a **Screen Share**
  group: a **Sharing** indicator (a pulsing rose dot, a `status` region whose hover card reads "You Are Sharing Your
  Screen"), then **Stop Sharing** (rose, named beside its glyph on a desktop, the glyph alone on a phone). The call
  group's own Share button gives way to it while the share is on, so Stop Sharing has one home; it comes back the
  moment the share ends however it ends. The floating "You are sharing your screen" bar this replaced is gone. The sharer still sees a small bubble of their own
  share above their head.
- **The camera has no controls of its own** beyond its on and off button in the call group (no device switch, no
  blur, no mirror toggle: your own camera is always mirrored), so turning it on changes nothing else in the strip
  (owner, 2026-11-06: "Maybe same with camera too, if that has any controls").
- Viewers in earshot see the share as a bubble above the sharer, next to their camera bubble when both are on, and
  maximise it the same way.
- **It stops** when the sharer presses Stop Sharing (on the Call dock), when they stop it from the browser's own
  control, when they leave the call, the mode or the tab, and when the kill switch tightens. Walking away from people
  stops them receiving it, as with a voice; the share itself carries on for whoever is still near.
- No audio from the shared screen or tab: voices stay the call's only sound.

## Local preview

Owner, 2026-11-05: camera and screen work in Avatar mode even with no call. With no call your bubble shows only on
your own screen and nothing is sent; once a call is joined, the same bubble is sent exactly as above.

- **Offered whenever the browser can capture.** In Avatar mode, the Camera button shows wherever the browser has a
  camera API in a secure context, and Share Screen wherever it has a screen picker (not on a phone), whether or not
  calls are on: in a This Browser Space, in a private Space nobody else can open, with calls off on the deployment or
  paused by the kill switch, and before the call connects. With no call to offer, the call group on the
  [Call dock](../008-canvas/avatar-mode.md#the-call-dock) holds the microphone (a [local preview](proximity-audio.md#no-call-here)) and the two buttons; with a call joined
  (or Calls Paused) on offer, they sit beside it.
- **No call, nothing sent.** With no call joined (no room, calls off or paused, or not joined yet, connecting), turning one on
  captures locally, at the same sizes and frame rates as a sent one, and shows your own bubble above your own head.
  Nothing goes to the room or to Cloudflare: no session, no `call-track` op, no publish.
- **"Only You".** A preview bubble carries a small **Only You** tag, and its hover card says "Only you see this.
  Nothing is sent." The dock's buttons are titled **Camera: Only You** and **Share Screen: Only You** with short cards
  ("Nothing is sent. Press to turn off.", "Try sharing. Nothing is sent.", "Your link lets you preview, not share."; owner,
  2026-11-07: "shorten the tooltips when local"), and the Screen Share group's indicator reads **Only You** (titled
  **Screen: Only You**) in place of Sharing, with the same Stop Sharing, whose card reads "Close the preview."
- **The call sends it.** When a call goes live while a preview is on, the call takes the track already captured: no
  second permission prompt, no second picker. From then on it is an ordinary camera or share (counted, capped and
  received as above) and the tag goes. A preview turned on while a call is joining is taken the moment it goes live.
- **What the call may not send stays a preview.** A Participant may preview a screen, but sharing one is an Editor's
  ([Share roles](#share-roles)), so a Participant's screen stays local in a call too, tag and all. Under **audio
  only** in a live call the strip reads Video Paused, so a preview stops there as a sent camera does; outside a call
  the switch does not touch a preview, which sends nothing.
- **When it stops.** Pressing the button again, the browser's own Stop on a screen, leaving the mode, changing tab and
  closing the page all stop a preview and release the camera or screen. Leaving a call stops what that call was sending,
  as before; a preview it never sent stays as it was.
- Do Not Disturb and the hidden-tab rule are about what reaches you: neither changes your own preview.

## The bubble

One bubble for both kinds, drawn in the canvas layer so it zooms and slides with the character:

- A rounded 16:9 tile, **180 canvas px wide** (owner, 2026-11-07: "Make the bubble bigger"), just over the head, with
  a ring in the person's colour. A screen bubble has a small screen badge in its corner.
- Hover or focus shows **"Maximise Sam's camera"** (or screen); pressing it maximises. In Avatar mode a press on a
  bubble (anyone's, your own too), on Stop Sharing or on the maximised panel **only** does that: it never also walks
  you to the spot behind it (owner, 2026-11-07: "when sharing camera or screen, anybody including me who clicks the
  bubble over my head walks to that spot, don't do that").
- While the stream is arriving, the tile shows the person's colour softly with no spinner; a video that stalls keeps
  its last frame.
- Under reduced motion the bubble does not slide or scale; it appears in place.

### Bubble size and place

- **Size.** 180 canvas px wide (it was 120), 16:9, so a face and a screen read at 100%.
- **Place.** Its bottom sits `BUBBLE_LIFT_PX` = the head's chrome (`AVATAR_HEAD_CHROME`, what the name chip, status chip
  and away Zz take) + 8 px over the head, 32 px above the top of the head (it was 50, above the talking equaliser)
  (owner, 2026-11-07: "bring it slightly closer to their body, atm it floats quite high far away").
- **The talking equaliser moves onto the bubble.** Someone wearing a bubble no longer shows the
  [equaliser](proximity-audio.md#the-talking-equaliser) over their head: it shows on the bubble's **top-left corner**
  while they talk, your own too. Someone with no bubble keeps it over the head.

### Close together (#468)

People talking stand close, so their bubbles would cover each other. They never do:

- **Bubbles slide apart sideways.** Bubbles at about the same height (their tops and bottoms within 8 canvas px of
  meeting) are laid out in one row, in their people's left-to-right order, 8 canvas px apart. A crowded row is
  centred on its people, each bubble moved as little as the others; a bubble with room to spare stays exactly above
  its head. A person's camera and screen move together.
- **A small tail** in the person's colour under each bubble points down at its own head, so a bubble nudged aside
  still says whose it is. It slides along the bubble's lower edge with the nudge, never past its rounded corners.
- **No jitter when people walk past each other.** Two bubbles swap sides only once their people have crossed by 24
  canvas px, and the swap is a short slide (220 ms), never a jump. Walking side by side, the bubbles glide with the
  characters as before.
- **A row wider than the view wraps** (#487). When a row of bubbles is wider than the visible canvas (three people
  and a share in a 450 px window), it breaks, in its left-to-right order, into rows that each fit; each further row
  sits 8 canvas px above the one before, and every row of a wrap is kept inside the view. A person's camera and screen
  never split. The order stays the one above, so wrapping adds no jitter; a wrapped bubble's tail is hidden, since
  its head is under another row.
- **Near the edge, a row stays inside the view** (#503). A row that fits, over people standing at the left or right
  edge of the visible canvas, slides in just far enough to show every bubble whole, as a speech bubble does; only the
  bubbles at the edge move, so someone further in keeps theirs over their head. The order and the gaps stay, so it
  adds no jitter, and each tail still points down at its own head.
- Under reduced motion the nudge and the swap are not animated.

**Speech bubbles stay clear.** A speech bubble ([Avatar mode](../008-canvas/avatar-mode.md#speech-bubbles)) floats
up from a head, and a camera or screen bubble sits right there. Wherever a speech bubble's path up would cross a
camera or screen bubble, its own speaker's or anyone's, it starts 8 canvas px above that bubble instead, so it reads
as rising from the video. If a bubble moves into its path while it flies (someone walks up), it eases up out of the
way (about 150 ms) and is never pushed down again during its flight. The composer you type in stays at your head:
it is yours, open only while you type, and drawn over your own camera.

### Maximised

- The bubble opens into a large panel over the canvas (at most 1280 px wide, 16:9, never more than 90% of the window),
  with the person's name, the kind, and a **Restore** button in a bar above the picture (never over it, where a
  shared screen's own title sits). The canvas stays live behind a soft dimmed backdrop.
- **Restore**, Escape, or pressing the backdrop puts it back. One bubble is maximised at a time: maximising another
  restores the first.
- If its person walks out of earshot, stops the camera or share, or leaves, the panel closes by itself.
- On a phone the panel fills the width.

## Share roles

From [Future work](../005-project-roadmap/future-work.md#share-roles) and [Proximity audio](proximity-audio.md#share-roles):

| Act                                       | Editor | Participant | Viewer |
| ----------------------------------------- | ------ | ----------- | ------ |
| See bubbles of the people near you        | Yes    | Yes         | Yes    |
| Maximise and restore a bubble (your view) | Yes    | Yes         | Yes    |
| Turn on a camera                          | Yes    | Yes         | No     |
| Preview your own camera or screen         | Yes    | Yes         | No     |
| Share a screen                            | Yes    | No          | No     |
| Stop someone else's screen share          | Yes    | No          | No     |

- A camera is taking part, like speaking: an Editor's or a Participant's, guests included, no sign-in.
- A [local preview](#local-preview) sends nothing, so it is allowed to anyone who can take part (`can.takePart`): an
  Editor's or a Participant's. Sending still follows the rows above, so a Participant's screen preview stays local even
  in a call, with its Only You tag. A Viewer, who neither speaks nor shows a camera, has no preview.
- Sharing a screen is an Editor's act (Future work's role table). The card asked for the bubble above the sharer in
  place of the table's "into a frame on the board"; this spec records that change.
- Gated in the editor on `can.takePart` (camera) and `can.level === 'edit'` (screen), never on read-only; on the server
  by the grant's level in the mint route, and by the room, which drops a `call-track` op naming a screen from anyone
  but an Editor, and any from a Viewer.
- **An Editor can stop someone else's share** (#469), for a share left running in a meeting. Another person's screen
  bubble shows a **Stop** button to an Editor (top left, on hover or focus, always on a touch screen, beside the
  maximise mark; its name and hover card say "Stop Sam's Screen"), and the maximised panel's bar shows **Stop
  Sharing** too. Pressing it ends the share as the sharer's own Stop does: their bubble closes
  for everyone, their strip's Share Screen reads off, and nothing else of their call changes. The sharer is told who
  did it (#504): a short info toast, "Alex stopped your screen share" (the Editor's presence name, or "An Editor" when
  their canvas does not know them), shown only when a share was really running. Counted
  (`StopOthersShare`). The room delivers the stop only from an Editor and the sharer's browser acts on it only from
  someone the room stamped an Editor; until the sharer's call says its screen is off, the mint route refuses anyone a
  new subscription to that screen.

## The kill switch

`callsModeAllows(mode, kind)` gives the camera the kind `video` and the screen the kind `screen`
([Calls kill switch](../016-platform/calls-kill-switch.md#what-each-mode-allows)).

- Under **audio only**, the camera and share buttons read **Video Paused**, with a pause icon, in the strip's calm
  resting colour; the hover card says "Video and screen sharing are paused for now. Audio carries on." A camera or a
  share that was on stops, and every bubble closes. Voices carry on.
- Under **off**, the whole call ends into **Calls Paused**, as for audio.
- The mint route refuses a video or screen publish, subscribe or layer change under `audio-only` with `calls_off`
  reason `audio-only`, so a browser that has not heard of the switch yet is stopped there too.

## The wire

The `call-track` op ([Proximity audio](proximity-audio.md#the-wire)) gains two optional locators beside the
microphone's: `video` (track name `cam`) and `screen` (track name `screen`), each the same shape, the same session
and token, or `null` when off. `track` stays the microphone's, and may be `null` while a camera or screen is on (a
blocked microphone). The op is sent whenever any of the three changes, and to new walkers as before.

`call-stop-share`: `{ kind, tabId, targetId }`, an Editor's request that `targetId` stop sharing. Addressed like a
let-speak: the room sends it to that person's connection alone, and drops it from anyone but an Editor or when it
fails its parser.

## The mint route

- `POST /calls/tracks` with `publish` names its `trackName`: `mic` (the default), `cam` or `screen`. A camera publish
  needs an Editor or a Participant; a screen publish an Editor (**403 `calls_editor_only`**).
- A subscribe's locators may name any of the three tracks; a camera subscription asks for the small layer.
- `PUT /calls/layer` `{ sessionId, sessionToken, tracks: [{ mid, sessionId, trackName, rid }] }` switches this
  session's camera subscriptions between `h` and `f` (Realtime's `tracks/update`). Camera tracks only.

## Cost

Cloudflare bills $0.05 per GB of egress after the account's first 1,000 GB a month.

- A camera bubble: 300 kbps, about 0.135 GB per viewer-hour; maximised, 1.5 Mbps, about 0.675.
- A room of 30 in groups of 3 to 4, everyone on camera: about 12 GB an hour, about $0.60 an hour.
- A screen share: about 1 Mbps, 0.45 GB per viewer-hour; one share to 10 viewers is about $0.23 an hour.
- The caps (6 cameras, 2 screens), off-screen and hidden-tab rules bound what any one viewer can cost.

## Telemetry

`track('Canvas', 'Used', 'CameraOn')` on turning the camera on, `track('Canvas', 'Used', 'ScreenShare')` on starting a
share (a local preview counts the same: both answer "did people turn it on", and a later join sends the same track
without counting again), `track('Canvas', 'Used', 'BubbleMaximise')` on maximising, `track('Canvas', 'Used', 'StopOthersShare')` on an
Editor stopping someone else's share. Never who, never what was shown.

## Out of scope

- Per-person hiding of a bubble, and an Editor turning off someone else's camera.
- Screen share audio, a frame on the board that holds a share, recording.
- Background blur or replacement, and choosing a camera other than the browser's default.
