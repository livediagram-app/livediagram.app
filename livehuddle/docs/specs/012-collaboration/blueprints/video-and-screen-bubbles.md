# Video and screen share bubbles blueprint

Derived from [Video and screen share bubbles](../video-and-screen-bubbles.md). Builds on the
[proximity audio blueprint](proximity-audio.md); paths are livehuddle's, `../packages/…` the monorepo's.

## Domain and naming

| Term         | Identifier                                                           | Meaning                                                                |
| ------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| media kind   | `CallMedia` (`'video' \| 'screen'`)                                  | What a bubble shows                                                    |
| track names  | `CALL_VIDEO_TRACK_NAME` (`cam`), `CALL_SCREEN_TRACK_NAME` (`screen`) | Beside the microphone's `mic`                                          |
| layer        | `CallLayer` (`'h' \| 'f'`)                                           | The camera's small and large simulcast encodings                       |
| camera state | `CallSelf.camera`: `off`, `starting`, `on`, `blocked`                | This browser's camera                                                  |
| screen state | `CallSelf.screen`: `off`, `starting`, `on`                           | This browser's share                                                   |
| preview      | `CallSelf.previewCamera`, `CallSelf.previewScreen`                   | A local preview's camera and screen state, beside the call's           |
| can preview  | `CallSelf.canPreviewCamera`, `CallSelf.canPreviewScreen`             | Avatar mode, `can.takePart`, and the browser can capture that kind     |
| maximised    | `CallMaximised` `{ id, media }` or null                              | The one bubble this viewer has opened large (`id` `self` for your own) |
| seen         | `pickSeen(…)`                                                        | The bubbles received: earshot, on screen, nearest, capped              |

## Behaviour and state

**Choosing bubbles** (`lib/calls/bubbles.ts`, pure): `pickSeen({ self, heard, walkers, peers, view, visible,
maximised })` returns the presence ids whose camera and whose screen to receive: peers in `heard` with that locator,
inside `view` grown by `BUBBLE_VIEW_MARGIN_PX`, sorted by distance, the first `MAX_VIDEO_BUBBLES` cameras and
`MAX_SCREEN_BUBBLES` screens; nothing while `visible` is false; the maximised one always kept while it is heard and
the tab is visible.

**Subscriptions** (`lib/calls/sfu-session.ts`): keyed by `<publisherSessionId>|<trackName>`, so one publisher can be
heard and seen at once. `want(entries)` takes `{ locator, layer? }`; a camera entry subscribes with
`simulcast` for its layer, and a changed layer on a held subscription queues a `layer` call (Realtime's
`tracks/update`) instead of a resubscribe. `publishTrack(name, track, init)` publishes once per name and later swaps
the track (`replaceTrack`, `null` while off), so turning a camera off and on never renegotiates.

**The call** (`lib/calls/call-video.ts`, driven by `proximity-call.ts`): `toggleCamera()` opens the camera (`getUserMedia` at
`CAMERA_CONSTRAINTS`), publishes it with `CAMERA_ENCODINGS` (`f` then `h`), stores it as your own media and sends the
`call-track` op with `video`; off stops the track, swaps `null` in and sends `video: null`. `toggleScreen()` opens
`getDisplayMedia` at `SCREEN_CONSTRAINTS`, sets `contentHint = 'detail'`, publishes with one encoding
(`SCREEN_MAX_BITRATE`, `SCREEN_MAX_FPS`) and stops on the track's `ended` (the browser's own Stop) as on the button.
A mode that no longer allows `video` or `screen` stops both and drops every bubble. A `visibilitychange` re-picks.

**Local preview** (`lib/calls/local-preview.ts`, in the canvas chunk, never the call's): `LocalPreview` captures the
camera (`getUserMedia` at `CAMERA_CONSTRAINTS`) or a screen (`getDisplayMedia` at `SCREEN_CONSTRAINTS`, `contentHint`
`detail`, stopped on `ended`) with no call, shows it as your own media and keeps `previewCamera` / `previewScreen`.
A stop while capture is pending cancels it (a generation count). `take(kind)` hands a stream over without stopping it.
The constraints live in `lib/calls/media-constraints.ts` (re-exported by `call-config.ts`), so the preview pulls no
call code into first load. `canCapture(kind)`: a secure context and `navigator.mediaDevices` with that API.
`useProximityCall` makes one per canvas and routes the buttons: a preview that is on turns off; else a live call that
may send that kind (camera: a speaker, screen: an Editor) toggles as before; else the preview starts. It stops the
preview on leaving the mode, a tab change and unmount. The call gets the preview in its input (`preview`) and, while
live and on every preview change, `adoptPreview()`: it takes each kind it may send under the mode
(`CallVideo.adoptCamera` / `adoptScreen`, the same publish path as a toggle, no capture) and stops a preview of a kind
the mode forbids. On teardown it clears only the own media it held and keeps the rest of `self`
(`resetCallMedia(SELF_MEDIA_ID)`), so a preview it never took survives. `localOnly(self, media)` tells the bubble,
the strip and the sharing bar a stream is a preview (the call's state off, the preview's on).

**State** (`lib/calls/calls-store.ts`): `CallPeer` gains `video` and `screen` locators. A separate media store (`calls-media-store.ts`) holds
the streams the bubbles draw (`callMedia()`: presence id → `{ video?, screen? }`, `self` for your own), and the
maximised bubble (`setCallMaximised`). Maximising a bubble that is not received any more clears it.

## Interfaces and contracts

- `CallTrackOp` gains `video?: CallTrackLocator | null` and `screen?: CallTrackLocator | null`, parsed by
  `parseCallTrack` with each locator's `trackName` held to its slot (`parseCallTrackLocator(v, name)`).
- `CallTracksRequest.publish` gains `trackName?: CallTrackName`. A subscribe locator may carry `layer?: CallLayer`.
- `PUT /api/documents/:id/calls/layer`: `CallLayerRequest = { sessionId, sessionToken, tracks: { mid, sessionId,
trackName, layer }[] }`, at most `MAX_SUBSCRIBE_BATCH`, `trackName` `cam` only. Answers `CallTracksResponse`.
- New refusal: `403 { error: 'calls_editor_only' }` for a screen publish without an Editor's grant.
- `TRACK_KINDS` (`calls-mode.ts`): `mic` audio, `cam` video, `screen` screen.

## Data and persistence

Nothing is stored. Streams live in memory for the call's life and are stopped on leaving.

## Errors and edge cases

- Camera refused: `camera: 'blocked'`, the button reads **Camera Blocked**; pressing it asks again.
- Screen picker cancelled: back to `off`, no error.
- The browser's own Stop on a share (the track's `ended`): the same as Stop Sharing.
- `calls_off` reason `audio-only` on a video or screen request: the mode becomes `audio-only` and camera and share
  stop (never an error).
- A locator refused by Realtime (the publisher left): never asked again until a new locator.
- A `tracks/update` refused (`update_track_error`): the bubble stays on whatever layer it had.

## Security and trust

- **Stopping someone else's share** (#469). `call-stop-share {targetId}` passes the room's gate from an Editor only
  and is addressed to the target. The room records the target's current screen token (from their last `call-track`)
  as stopped, and the mint route answers `stopped` (as `not_heard`) to a new subscription to that screen until the
  sharer's `call-track` names no screen or a new one. The sharer's call stops its screen unless the room stamped the
  sender something other than an Editor, then (only when a screen was running) calls `onShareStopped(from)`, which
  `useCanvasCall` turns into `toast.info(shareStoppedNotice(name))`, the name looked up in `remoteAvatars` (#504). UI: an Editor-only **Stop** (named "Stop Sam's Screen") on someone else's screen bubble (a
  sibling of the maximise button, top left, on hover, focus or always on a touch screen) and in the maximised panel's
  bar (focus then goes to the panel, never to Stop). Counted `StopOthersShare`.

- A screen publish is checked against the grant's level at the time (`edit`), and the session must be a speaker's.
- The room drops a `call-track` op carrying a `screen` locator from anyone but an Editor (`room-op-gate.ts`).
- Track tokens are per publishing session, as before: a locator from another Space is refused before Realtime.

## Performance and limits

- `pickSeen` runs with `hear()`: linear in heard peers plus a sort of at most the heard set.
- `layoutBubbles` runs on every render of the bubble layer (each walk step): a sort of the groups, an order pass of
  at most n² adjacent swaps and a linear pack, with n at most 9 (6 cameras, 2 screens, your own). Held under a CPU
  budget by a test of 1,000 layouts of the worst case.
- A `<video>` per received bubble, at most 6 + 2 + your own two. Bubbles re-render on a walker's step only for their
  own position (one style change), never the video element.
- Off-screen and hidden-tab rules close subscriptions, so the SFU stops sending; the bubble code adds nothing to the
  canvas chunk until a call starts except the bubble layer, the media store and the local preview (about a hundred
  lines, constraints included). A preview captures only on a press and adds no per-frame work beyond its own bubble.

## Presentation and UX

- **Wrapping** (#487). `layoutBubbles(boxes, prevOrder, view)` takes the visible canvas across (`BubbleView`, from
  the call's snapped view rect, half a snap step in from each edge; each edge is snapped on its own, so the
  right one never lands past the screen's, #503). A row wider than it is cut, in its stable order,
  into runs that fit (a person's group never splits; one wider than the view gets a run alone); each further run is
  lifted its height plus `BUBBLE_GAP_PX`, and a lifted group's tail is hidden. Every run, wrapped or not (#503), is
  held inside the view by `keepInside`: each box's left is clamped between the view's left plus the run before it and
  the view's right less the run from it on. Both bounds step by a box's width plus the gap, as packed lefts do at
  least, so the clamp keeps the order and the gaps and moves only the boxes that would run off; one box wider than the
  view keeps its left end in view. `dy` comes back beside `dx`, and the rects handed to the speech layer include
  the lift.

- `components/calls/MediaBubble.tsx`: the one bubble (camera or screen), and `CallBubbles.tsx`, the layer that places
  them above characters (above the talking bars, `BUBBLE_LIFT_PX`), side by side when a person has both.
- **Close together** (`lib/calls/bubble-layout.ts`, pure): `layoutBubbles(boxes, prevOrder)` takes each person's
  bubble group as a box (`{ id, x, bottom, width, height }` in canvas px: centred on the head, bottom
  `BUBBLE_LIFT_PX` over it, `groupWidth(count)` wide, 16:9 tall) and answers each group's sideways nudge `dx`, its
  laid-out rect and the order used. Rows: boxes sorted by top, a box joins the row above when it starts less than
  `BUBBLE_GAP_PX` below the row's lowest bottom. Order within a row: the previous order (`prevOrder`), new ids put in
  by x, then adjacent pairs swapped only when the left one's x is more than `BUBBLE_SWAP_PX` right of the other's
  (a new id swaps on any inversion). Packing: the classic ordered 1D cluster merge, each cluster's left edge the mean
  of its members' wanted lefts less their offsets in it (least squares), merged with the cluster before while they
  come within `BUBBLE_GAP_PX`. `CallBubbles` keeps the order in state, adjusted during render (it settles in one
  extra render, as the order it hands back is already stable), passes each `Group` its `dx`, and writes the rects to
  its `rectsRef` (`useCallBubbleRects`, made in `Canvas.tsx`; emptied with no stream and on unmount) after each commit.
- A group's inner row carries the nudge as `translateX(dx)` with a `BUBBLE_NUDGE_MS` ease-out transition (off under
  reduced motion), apart from the outer box's `left`/`top` glide, so a swap slides while a walk keeps its linear
  glide. The tail: a 10 px square turned 45°, the person's colour, under the row, at `tailShift(dx, width)` off the
  row's centre (`-dx` held `BUBBLE_TAIL_INSET_PX` inside each end), with the same transition.
- **Speech clear of bubbles**: `Canvas.tsx` hands the same ref to `AvatarSpeechLayer` as `obstacles`; the layer's
  flight loop lifts each speech bubble by `speechLift` (`../packages/avatar/src/speech.ts`, the
  [avatar speech blueprint](../../008-canvas/blueprints/avatar-speech.md)).
- `components/calls/MaximisedBubble.tsx`: the large panel, a fixed overlay outside the canvas transform.
- `components/calls/ScreenShareBar.tsx`: the "You are sharing your screen" bar, top centre, with Stop Sharing.
- `CallClusterButton.tsx`: Camera and Share Screen segments between the microphone and Leave; **Video Paused**
  under audio only.

## Accessibility

Bubbles are buttons with `aria-label` "Maximise Sam's camera"; the panel is a dialog labelled by its title, Escape
restores, focus moves to Restore on open and back to the bubble on close. The sharing bar is a `status` region.
`<video>` elements are muted (`muted`, `playsInline`): voices come through the audio graph.

## Testing

| Rule                                                       | Test                                                      |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| Locators held to their slot; video and screen fields       | `../packages/api-schema/src/call-voice.test.ts`           |
| Track kinds for `cam` and `screen`                         | `../packages/api-schema/src/calls-mode.test.ts`           |
| Publish by name and role; layer route; audio-only refusals | `apps/api/src/routes/calls.test.ts`                       |
| Simulcast subscribe and `tracks/update` shapes             | `apps/api/src/calls/realtime-api.test.ts`                 |
| Room drops a non-Editor's screen locator                   | `apps/api/src/room-op-gate.test.ts`                       |
| Earshot, viewport, hidden tab, caps, maximised kept        | `apps/editor/lib/calls/bubbles.test.ts`                   |
| Rows, nudge, swap hysteresis, layout CPU budget            | `apps/editor/lib/calls/bubble-layout.test.ts`             |
| Speech lift past bubbles                                   | `../packages/avatar/src/speech.test.ts`                   |
| Keys per track, layer change, publish by name              | `apps/editor/lib/calls/sfu-session.test.ts`               |
| Camera and share on and off, ended, audio-only stops them  | `apps/editor/lib/calls/proximity-call.test.ts`            |
| Strip segments per role, Video Paused                      | `apps/editor/components/calls/CallClusterButton.test.tsx` |
| Preview: captures, sends nothing, stops, cancels, releases | `apps/editor/lib/calls/local-preview.test.ts`             |
| Join adopts a preview without a second prompt; roles; mode | `apps/editor/lib/calls/proximity-call.test.ts`            |
| Buttons offered without a room; routing; mode and tab stop | `apps/editor/lib/calls/useProximityCall.test.tsx`         |
| Preview role per level                                     | `apps/editor/lib/share-roles.test.ts`                     |
| Bubble, maximise, restore, Escape, sharing bar             | `apps/editor/components/calls/*.test.tsx`                 |

## Constants and configuration

| Constant                | Value                               | Why                                        |
| ----------------------- | ----------------------------------- | ------------------------------------------ |
| `MAX_VIDEO_BUBBLES`     | 6                                   | The card's cap: the nearest six            |
| `MAX_SCREEN_BUBBLES`    | 2                                   | A screen is about three bubbles of traffic |
| `BUBBLE_VIEW_MARGIN_PX` | 120                                 | An edge bubble does not flicker            |
| `BUBBLE_WIDTH_PX`       | 120                                 | Readable at 100%, small beside a character |
| `BUBBLE_GAP_PX`         | 8                                   | Between bubbles, and a person's two        |
| `BUBBLE_SWAP_PX`        | 24                                  | Crossing needed before two bubbles swap    |
| `BUBBLE_NUDGE_MS`       | 220                                 | A swap slides, quick enough to follow      |
| `BUBBLE_TAIL_INSET_PX`  | 14                                  | The tail stays off the rounded corners     |
| `CAMERA_CONSTRAINTS`    | 1280×720, 24 fps ideal              | The large layer's source                   |
| `CAMERA_ENCODINGS`      | `f` 1.5 Mbps; `h` scale 2, 300 kbps | The card's cost figures                    |
| `SCREEN_CONSTRAINTS`    | ≤1920×1080, 5 to 15 fps             | The card's cap                             |
| `SCREEN_MAX_BITRATE`    | 1 Mbps                              | About 0.45 GB per viewer-hour              |
