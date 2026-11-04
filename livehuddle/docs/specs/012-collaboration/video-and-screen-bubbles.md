# Video and screen share bubbles

Status: **built for staging** (Work Tracker #317, #318), on top of [Proximity audio](proximity-audio.md) (#315) and
under the [calls kill switch](../016-platform/calls-kill-switch.md) (#316). Off in production with the rest of calls
([Turning calls on](proximity-audio.md#turning-calls-on)).

People talking in proximity can turn on a camera, or share a screen, and it shows as a small **bubble above their
character's head** to the people in earshot. Anyone watching a bubble can press it to **maximise** it, and restore it
again. Both kinds share one bubble.

## Who sees what

Video and screens ride the call exactly as voices do: you see the bubbles of the people you hear
([Hearing](proximity-audio.md#hearing): everyone in your [room](meeting-rooms-and-stage.md#rooms-are-calls-part-1-built),
or in the open within 260 canvas px, let go beyond 300), and nobody else. A room's cameras and screens stay in it. Nothing is sent to
someone out of earshot, so a bubble costs nothing until somebody walks up.

On top of earshot, a bubble is received only while it can be seen:

- **Off-screen bubbles are not received.** A speaker in earshot whose character is outside the canvas's visible area
  (with a margin of 120 canvas px, so a bubble at the edge does not flicker) gets no video.
- **A hidden tab receives none.** While the page is hidden (another browser tab, a minimised window), every video and
  screen subscription closes; voices carry on. Coming back opens them again.
- **At most 6 camera bubbles at once**, the nearest. Further cameras in earshot show their character only.
- **At most 2 screen bubbles at once**, the nearest. A screen is about three bubbles' worth of traffic.
- A bubble you have maximised is kept whatever the caps and the viewport say, until you restore it.

## The camera (#317)

- **Camera** is one button beside the microphone in the call's strip, once you have joined. Off by default. Pressing
  it asks for the camera (once per site, as the browser decides) and turns it on; pressing again turns it off and the
  browser's camera light goes out.
- Your own bubble shows above your own head, mirrored, so you see what others see. Others see it unmirrored.
- **Camera Blocked** (amber): the browser refused the camera. The hover card says how to allow it.
- The camera stays on while you walk alone: it is your choice to make. Nothing is sent to anyone not in earshot.
- Leaving the call, the mode or the tab turns it off.

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
- The sharer sees a clear **"You are sharing your screen"** bar at the top of the canvas with a **Stop Sharing**
  button ("Sharing your screen" on a phone, so it never cuts off), and a small bubble of their own share above
  their head.
- Viewers in earshot see the share as a bubble above the sharer, next to their camera bubble when both are on, and
  maximise it the same way.
- **It stops** when the sharer presses Stop Sharing (the bar or the strip), when they stop it from the browser's own
  control, when they leave the call, the mode or the tab, and when the kill switch tightens. Walking away from people
  stops them receiving it, as with a voice; the share itself carries on for whoever is still near.
- No audio from the shared screen or tab: voices stay the call's only sound.

## The bubble

One bubble for both kinds, drawn in the canvas layer so it zooms and slides with the character:

- A rounded 16:9 tile, 120 canvas px wide, above the name chip and the talking equaliser, with a ring in the person's
  colour. A screen bubble has a small screen badge in its corner.
- Hover or focus shows **"Maximise Sam's camera"** (or screen); pressing it maximises.
- While the stream is arriving, the tile shows the person's colour softly with no spinner; a video that stalls keeps
  its last frame.
- Under reduced motion the bubble does not slide or scale; it appears in place.

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
| Share a screen                            | Yes    | No          | No     |

- A camera is taking part, like speaking: an Editor's or a Participant's, guests included, no sign-in.
- Sharing a screen is an Editor's act (Future work's role table). The card asked for the bubble above the sharer in
  place of the table's "into a frame on the board"; this spec records that change.
- Gated in the editor on `can.takePart` (camera) and `can.level === 'edit'` (screen), never on read-only; on the server
  by the grant's level in the mint route, and by the room, which drops a `call-track` op naming a screen from anyone
  but an Editor, and any from a Viewer.

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
share, `track('Canvas', 'Used', 'BubbleMaximise')` on maximising. Never who, never what was shown.

## Out of scope

- An Editor stopping someone else's share (the role table's last row), and per-person hiding of a bubble.
- Screen share audio, a frame on the board that holds a share, recording.
- Background blur or replacement, and choosing a camera other than the browser's default.
