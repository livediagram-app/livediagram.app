# Proximity audio

Status: **built** (Work Tracker #315), under the calls kill switch (Work Tracker #316). On wherever its secrets are set,
production included; see [Turning calls on](#turning-calls-on).

People in a Space talk by walking up to each other. You hear the characters near yours and nobody else; the voice
fades as they walk away and sits left or right of you as they stand. A character too far away to hear still shows
that its person is talking, with a small **equaliser** above its head, so you can choose to walk over (owner,
2026-11-02).

Settled in [Open decisions](../005-project-roadmap/open-decisions.md) D4: calls are in, audio first; video and screen
sharing stay [Future work](../005-project-roadmap/future-work.md).

## Who is in a call

Audio rides [Avatar mode](../008-canvas/avatar-mode.md): only a walking character has a place on the board, so only
someone in the mode hears or is heard. Leaving the mode, changing tab or closing the page leaves the call. A board
that is not shared (a This Browser Space, or one with no room) has nobody to talk to; the
microphone, camera and Share Screen buttons still show there, as a [local preview](video-and-screen-bubbles.md#local-preview).

- **Walking in joins.** There is no Join and no Leave button (owner, 2026-11-07: "Currently we have this concept of
  Joining audio and leaving audio, which is friction I don't like. When you join, you can automatically hear others
  near you etc, but your mic stays muted by default when joining"). Walking where there is a call (Avatar mode, a
  Space synced to the server, calls on) joins it by itself: you hear the people near you at once, and a Viewer
  listens likewise. A browser keeps sound from a page until it is touched, so if it held the audio back, it starts on
  your next press or key (a call that ends or fails first stops waiting for it). The call still ends on leaving the mode, the
  room or the tab; to stop hearing people, set
  [Do Not Disturb](meeting-rooms-and-stage.md#do-not-disturb-part-3-built).
- **Muted by default.** Your microphone starts **muted and is not opened**, so walking in never shows the browser's
  microphone prompt. It is asked for the first time you **unmute**.
- **While it connects** the [Call dock](../008-canvas/avatar-mode.md#the-call-dock) (a card at the bottom centre of the canvas; owner, 2026-11-07: "Audio,
  Camera and Share buttons should be moved from the palette and put as buttons in the bottom, but for livehuddle,
  center them") shows a greyed **Connecting…** (hover title Connecting Audio). If it fails, a warn **Retry** (Audio
  Unavailable) appears and a press tries again; under the kill switch it reads **Calls Paused** and a press tries
  again. Neither retries by itself: no loop after a failure or a pause.

## Share roles

| Act                                          | Editor | Participant | Viewer |
| -------------------------------------------- | ------ | ----------- | ------ |
| Hear the people near you (joined by walking) | Yes    | Yes         | Yes    |
| Speak (publish a microphone), mute, unmute   | Yes    | Yes         | No     |
| Show a talking equaliser to others           | Yes    | Yes         | No     |
| See who is talking, walk over                | Yes    | Yes         | Yes    |

- A Viewer listens: it joins by walking in like the others and its dock reads **Listening**; its session may subscribe but never publish, and the room drops
  any `avatar-voice` or `call-track` op it sends.
- **Guests speak too**, wherever their Participant link lets them (owner, 2026-11-03): audio asks for no sign-in. This
  overrides #316's "sign in to publish media" for audio; #316 keeps its other limits.
- Gated in the editor on the session's `can.takePart`, never on `isReadOnly` (Avatar mode makes the canvas read-only
  for everyone in it), and on the server by the grant's level, in the mint route and the room alike.

## Hearing

Every speaker publishes their microphone once (ingress is free). Each listener subscribes only to the speakers in
earshot, from the positions the room already shares in the `avatar` op.

**Rooms come first** ([Meeting rooms and the stage](meeting-rooms-and-stage.md#rooms-are-calls-part-1-built), Work
Tracker #319, #436): an [Office Room](../009-elements/office.md#room) is walled off: nobody outside it hears anyone
inside, and walls block sound fully. Inside a room, as on the open floor, the rules below apply (owner, 2026-11-06):

- **Hearing radius: 260 canvas px**, feet to feet. A speaker inside it is subscribed.
- **Release radius: 300 canvas px.** A subscribed speaker is let go only beyond it, so somebody standing on the edge
  does not flicker in and out.
- **Volume fades with distance** (in the open; full in a shared room): full within 90 canvas px, then an equal-power fade to silence at the release
  radius, so letting go of a speaker makes no audible step.
- **Pans by position**: a speaker to your left is heard on the left, up to 80% of the way at the hearing radius.
- Volume and pan glide over 120 ms as people walk, so steps are never heard.
- A speaker is heard only on your tab, and only while both of you walk. Someone sitting in a chair is where the chair
  is.

## The microphone

- **Mute** and **Unmute** are one button on the Call dock. It starts **muted**. Muted sends nothing: no audio, no
  equaliser. The first unmute opens the microphone (the browser asks then).
- **Unmuted, the microphone stays open**, alone or not, so you can see it work. Muted and alone on a tab for 15
  seconds, it is released (the browser's recording light goes out) and opens again on your next unmute.
- **A microphone the browser ends** (unplugged, its permission withdrawn) is released, never left published and
  silent. Unmuted, it opens again at once on whichever microphone the browser has now (Mic Blocked with none); muted,
  on your next unmute.
- **The mic indicator** on the button shows, at a glance:
  - **Live** (the button fills from its foot with your voice level, white on the solid brand: you are transmitting to someone): somebody is in earshot and hears you (in a room,
    anyone else in it).
  - **Nobody Near**: your microphone is open but nobody hears you (in the open, nobody within the hearing radius); your equaliser still shows to
    the people further away. The button fills the same way, in a brand tint on the tint.
  - **Muted** (a struck-through microphone).
  - **Mic Blocked** (amber): the browser refused the microphone; the hover card says how to allow it, then press to
    try again (a press asks the browser again). You still hear everyone.
  - **Mic Off**: you are unmuted and the microphone is still opening, a moment after you unmute.
- On a desktop the button is named beside its glyph on the [Call dock](../008-canvas/avatar-mode.md#the-call-dock) with a short label that follows its state:
  **Mic**, **Muted**, **Blocked**, **Mic Off**, **Listening** (owner, 2026-11-07: "On desktop add short labels to each,
  on mobile do not"). On a phone it is the glyph alone, square. The hover card names it and its state in words ("Mic:
  Live", "Mic: Muted") either way.

## No call here

While walking somewhere calls cannot reach (a space kept in This Browser, which has no server room to call through, a
server with calls switched off, calls paused, or a call that failed), the dock still shows the microphone, **Muted**,
as a **local preview** (owner, 2026-11-07: "I can't use audio when on this browser or alone, which makes it hard to
test, do what we did with camera and allow me to do it anyway, just don't transmit it to a server"):

- Pressing it opens the microphone **on your own screen only**, and drives your own talking equaliser. Nothing is
  sent: no session, no track, no signal to the room. Its title reads **Mic: Only You**, in the live tone, with the
  short card "Nothing is sent. Press to mute." (before the press: "Try your mic. Nothing is sent."), and pressing
  again mutes it (owner, 2026-11-07: "shorten the tooltips when local, its way to long for all 3 buttons mic, cam,
  etc"). The dock no longer explains why there is no call (the greyed Join Audio's reason text is gone): the preview
  itself says what matters, that only you see it.
- A microphone the browser ends while previewed (unplugged, its permission withdrawn) closes, as a press would.
- A call that starts takes over, **muted**. The camera and Share Screen beside it preview locally too, titled
  **Camera: Only You** and **Share Screen: Only You**.

Someone who may not speak (a Viewer) has no microphone to preview. The preview is `CallSelf.canPreviewMic` and
`previewMic`, run by `LocalMic` (`lib/calls/local-mic.ts`).

**The level meter** (owner, 2026-11-07: "show my voice volume etc in the mic button as I speak so I can see how loud it
is etc and see when I am transmitting"): while the microphone is open and unmuted (in a call, Live and Nobody Near;
the local preview while on) the button **fills from its foot** with your level (0 to 4, gliding). White on the solid
brand means somebody hears you; a brand tint on the tint means Nobody Near. It replaced the soft ring round the
microphone.

## The talking equaliser

The speaker's own browser detects their voice and sends only a coarse level over the existing room socket, never
audio. Nobody out of earshot receives any media: it costs no Realtime egress and reveals nothing said.

- **Detection**: an analyser on the microphone, sampled every 50 ms. Speaking starts when the level crosses a
  threshold, and stops only after 600 ms below it (a **hangover**), so the pauses between words do not flicker.
- **On the wire**: a start (a level of 1 to 4), a new level at most every 250 ms while it changes, the same level
  again every 5 seconds while it holds (so a receiver can tell a long speech from a lost stop), and a stop (0). At
  most about 4 messages a second per speaker, and none from someone silent or muted.
- **Drawn above every talking character**, out of earshot and in it alike: three small bars in the speaker's colour
  just above the name chip (someone wearing a camera or screen bubble shows them on the bubble's top-left corner
  instead: [Bubble size and place](video-and-screen-bubbles.md#bubble-size-and-place)). The bars move locally from the last level, so the motion is smooth without more
  messages. Out of earshot they are calm and faint, fading with distance (full at the release radius, a third as
  strong at 1,500 canvas px and beyond), so the nearest groups stand out; in earshot they are brighter, so you see
  who you are hearing.
- **A level that is not refreshed for 8 seconds is dropped**, as is a speaker who leaves the mode, the tab or the room.
- **Hover or tap the bars**: "Sam is talking, walk over". Pressing them walks your character towards Sam, stopping a
  short way off (60 canvas px) so you do not shove them. Only while you walk; otherwise the bars only show.
- **Your own bars** show above your own head while you talk, so you can see you are coming through.
- **Your hearing ring** (owner, 2026-11-07): whenever your own bars show (unmuted and talking, in a call or on the
  microphone's local preview), a soft ring in your colour lies on the floor round your feet at the hearing radius
  (260 canvas px), so you see where people can hear you. It pulses while you talk, a ripple running out from your
  feet to its edge, and fades away within a moment of your stopping (the same 600 ms hangover as the bars, then a 200
  ms fade). Walls block sound both ways, so inside a room (or a Phone Booth) it is cut to the room's floor, and every
  other room it reaches (standing outside one, or in the room round it) is cut out of it; on the top of a stage that
  lets you speak, where the whole tab hears you, it does not show (worked out from the board, so on the local preview
  too). Only you see it, never others; with the local preview it shows where you would be heard once the call is on.
  Under reduced motion it holds still. **Settings > Collaborate > Audio Proximity Ring** turns it off (on by default;
  `hearingRing`, synced with your other preferences); the call is unchanged. It sits under every character and takes
  no presses.
- Under reduced motion the bars hold still at their level's height.
- A screen reader is not read the bars (they change too often); the hover card is their text.

### Do Not Disturb

[Do Not Disturb](meeting-rooms-and-stage.md#do-not-disturb-part-3-built) (Work Tracker #319, part 3) still shows
**your** bars to others but hides **theirs** from you, and closes every subscription (no voice, no bubble, not even a
stage's). Your microphone carries on under its own Mute, so you are heard if you speak.

## The wire

Three presence ops in `@livehuddle/api-schema` (`call-voice.ts`), each with a field-by-field parser shared by the room
and the editor:

- `avatar-voice`: `{ kind, tabId, level }`, `level` an integer 0 to 4, 0 meaning stopped. A **sample**, like `avatar`
  and `cursor`: the room relays it only to the sockets on its tab and, in a room of more than 10, coalesces it per
  sender per step with the walking samples ([API](../015-api/api.md) "A busy room bounds its presence fan-out"), so a
  full Space talking adds no frames, only bytes inside the frames it already sends.
- `call-track`: `{ kind, tabId, track }`, `track` either `null` (stopped publishing) or
  `{ sessionId, trackName, token }`: where a listener asks the mint route for this speaker's microphone. Sent when
  the speaker starts publishing and again whenever a new walker appears on their tab (a late joiner never receives a
  replay), at most once a second. Relayed to the whole room, unbatched.

- `calls-check`: `{ kind, tabId }`, sent by a publishing call that has sent the room nothing for 5 seconds, so a
  silent room still reads the kill switch ([Calls kill switch](../016-platform/calls-kill-switch.md#the-room-tells-its-clients)).
  Consumed by the room, never relayed.

The room drops any of them from a Viewer, and drops one that fails its parser, as it drops a Viewer's `avatar-say`.

- `call-session`: `{ kind, tabId, sessionId, sessionToken }`, sent once a call has its session (a listener's too),
  and again after a subscribe was refused. It proves to the room which Realtime session is this connection's, so the
  mint route can ask the room who may hear whom ([Meeting rooms and the stage](meeting-rooms-and-stage.md#trust)).
  The room checks the token as the mint route does, keeps the session on the connection, and never relays the op;
  one that fails its parser or its token is dropped. From any level: a Viewer subscribes too.

## The mint route

The browser never talks to Cloudflare Realtime's API: livehuddle's api Worker holds the Realtime app's secret and the
TURN key, and makes every call on the browser's behalf, after checking the caller's grant on the Space.

- `POST /api/documents/:id/calls/session`: a new Realtime session for this browser, with short-lived TURN credentials
  (ICE servers for 4 hours), a private **session token** that proves the session is the caller's, and whether it may
  speak.
- `POST /api/documents/:id/calls/tracks`: publish this browser's microphone (an offer and its `mid`; Editor or
  Participant only), or subscribe to speakers' microphones (their `call-track` locators). A locator's `token` is the
  api's signature over the Space and the publishing session, so a listener can only subscribe to a microphone
  published in the same Space. Each subscription is then checked with the room (#483,
  [Meeting rooms and the stage](meeting-rooms-and-stage.md#trust)): a track the subscriber may not hear now is
  answered with `errorCode: 'not_heard'` in its place, and the rest are subscribed as asked.
- `PUT /api/documents/:id/calls/renegotiate`: the browser's answer to an offer the SFU made.
- `PUT /api/documents/:id/calls/close`: stop subscriptions or the microphone, by `mid`.

Every route answers **503 `calls_off`** while calls are off (close excepted while the kill switch alone pauses
them), **404** without a grant on the Space, and **403 `calls_listen_only`** for a Viewer's publish. The kill switch
checks every session and track against its mode ([Calls kill switch](../016-platform/calls-kill-switch.md#wired-in)).

### A session that expires

Walking in mints the session, but the browser connects its media to it only on the first publish (an unmute, the
camera, a shared screen) or the first subscribe. Realtime drops a session nobody connected to within about half a
minute, so someone who walks in and unmutes later, or a listener alone until a speaker arrives, holds a dead session
(found on production 2026-11-07: Realtime answered `410` to a publish 36 seconds after the mint, and the call looked
live, with your own equaliser and bubble, while nothing reached anyone).

- The routes answer **410 `calls_session_gone`** when Realtime says the session is gone, not the generic
  `502 calls_upstream`.
- The call **renews** itself on that answer, with no press: it mints a new session, proves it to the room
  (`call-session`), publishes again what was live (an open microphone, the camera, a shared screen), tells the room
  its new locators (`call-track`), and subscribes again to whoever it should hear. The dock stays as it was; the first
  unmute after a quiet spell takes a moment longer.
- A session that is gone again straight after renewing is a broken call, not an idle one: after 3 renewals inside a
  minute the call fails into **Retry** (Audio Unavailable), as a failed connection does. No loop.
- A publish that fails leaves nothing behind that claims it worked, so the next attempt publishes afresh.
- A microphone, camera or screen the browser is still asking for when the session goes is published on the session
  as it is when the browser answers: the renewed one, or, while that is still being minted, by the renewal once it
  is up. Never on the closed one the press found, where it would look live to you and reach nobody. A press of
  Camera or Share Screen while the session is renewed starts as an unmute does, and goes out the same way.

## Turning calls on

Calls run on any deployment, production (`www.livehuddle.app`) included, where both of these hold (the owner lifted
the earlier off flag for production on 2026-11-05); the editor learns it from `/api/capabilities` (`callsEnabled`) and
shows no call otherwise (the microphone, camera and screen buttons stay, as a
[local preview](video-and-screen-bubbles.md#local-preview) only you see).

- **The secrets are set**: the Realtime app's id and token, and a TURN key's id and API token. They are the owner's to
  create; unset, calls are off.
- **The kill switch allows it** ([Calls kill switch](../016-platform/calls-kill-switch.md)): `off` pauses calls, and
  the controls read **Calls Paused** rather than going away; `audio-only` leaves audio as it is.
- **The page may ask for them**: the editor's `Permissions-Policy` header allows `camera`, `microphone` and
  `display-capture` for its own origin (`self`), and still denies every other powerful feature. It denied the camera
  and the microphone until 2026-11-07 (a leftover from the livediagram fork), so Chrome and Edge refused both on
  every deployed page while local dev, which serves no such header, worked.

`/api/capabilities` answers `callsEnabled` (this deployment has calls: its secrets are set) and `callsMode`
(the switch: `on`, `audio-only` or `off`).

## Cost

Cloudflare charges $0.05 per GB of egress, after the first 1,000 GB each month (SFU and TURN together). Opus at about
40 kbps is about 0.018 GB per listener-hour. A Space of 30 in groups of 3 to 4 is about 1.6 GB an hour, about $0.08 an
hour. The equaliser adds no Realtime cost, only small presence messages.

## Telemetry

`track('Canvas', 'Used', 'CallNotHeard')` when the mint route refuses a subscription as not heard (#483: counts
false refusals). `track('Canvas', 'Used', 'CallRenewed')` when a call renews a session Realtime dropped. `track('Canvas', 'Used', 'AudioJoin' | 'AudioListen')` on the automatic join (by the door: speaker or listener; there is no leave event),
`track('UI', 'Changed', 'AudioMute')` on a mute or unmute, and `track('Canvas', 'Used', 'WalkToTalker')` on pressing
someone's bars. Never who, never how long, never anything heard.

## Out of scope

- Rooms as calls, the stage, raise hand and Do Not Disturb have their own spec:
  [Meeting rooms and the stage](meeting-rooms-and-stage.md). Video and screen sharing ride the same call:
  [Video and screen share bubbles](video-and-screen-bubbles.md).
- Muting someone else (an Editor's act in the future-work role table) and per-person volume.
- Any recording, transcript or history: nothing said is stored anywhere.
