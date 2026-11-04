# Proximity audio

Status: **built for staging** (Work Tracker #315), under the calls kill switch (Work Tracker #316). Still off in
production; see [Turning calls on](#turning-calls-on).

People in a Space talk by walking up to each other. You hear the characters near yours and nobody else; the voice
fades as they walk away and sits left or right of you as they stand. A character too far away to hear still shows
that its person is talking, with a small **equaliser** above its head, so you can choose to walk over (owner,
2026-11-02).

Settled in [Open decisions](../005-project-roadmap/open-decisions.md) D4: calls are in, audio first; video and screen
sharing stay [Future work](../005-project-roadmap/future-work.md).

## Who is in a call

Audio rides [Avatar mode](../008-canvas/avatar-mode.md): only a walking character has a place on the board, so only
someone in the mode hears or is heard. Leaving the mode, changing tab or closing the page leaves the call. A board
that is not shared (a This Browser Space, or one with no room) has nobody to talk to and shows no audio controls.

- **Join Audio.** Entering the mode does not open the microphone by itself. A **Join Audio** button sits in the
  bottom-right cluster beside Avatar while calls are on. Pressing it is the gesture a browser needs before it plays
  sound, and asks for the microphone (once per site, as the browser decides). Someone who may only listen joins without
  a microphone.
- **Leave Audio** ends it: the microphone is released, every subscription closes and the session ends. Leaving the
  mode does the same.

## Share roles

| Act                                        | Editor | Participant | Viewer |
| ------------------------------------------ | ------ | ----------- | ------ |
| Join Audio, hear the people near you       | Yes    | Yes         | Yes    |
| Speak (publish a microphone), mute, unmute | Yes    | Yes         | No     |
| Show a talking equaliser to others         | Yes    | Yes         | No     |
| See who is talking, walk over              | Yes    | Yes         | Yes    |

- A Viewer listens: its Join Audio says **Listen In**, its session may subscribe but never publish, and the room drops
  any `avatar-voice` or `call-track` op it sends.
- **Guests speak too**, wherever their Participant link lets them (owner, 2026-11-03): audio asks for no sign-in. This
  overrides #316's "sign in to publish media" for audio; #316 keeps its other limits.
- Gated in the editor on the session's `can.takePart`, never on `isReadOnly` (Avatar mode makes the canvas read-only
  for everyone in it), and on the server by the grant's level, in the mint route and the room alike.

## Hearing

Every speaker publishes their microphone once (ingress is free). Each listener subscribes only to the speakers in
earshot, from the positions the room already shares in the `avatar` op:

- **Hearing radius: 260 canvas px**, feet to feet. A speaker inside it is subscribed.
- **Release radius: 300 canvas px.** A subscribed speaker is let go only beyond it, so somebody standing on the edge
  does not flicker in and out.
- **Volume fades with distance**: full within 90 canvas px, then an equal-power fade to silence at the release
  radius, so letting go of a speaker makes no audible step.
- **Pans by position**: a speaker to your left is heard on the left, up to 80% of the way at the hearing radius.
- Volume and pan glide over 120 ms as people walk, so steps are never heard.
- A speaker is heard only on your tab, and only while both of you walk. Someone sitting in a chair is where the chair
  is.

## The microphone

- **Mute** and **Unmute** are one button, next to Avatar, once you have joined. Muted sends nothing: no audio, no
  equaliser.
- **The microphone is only open while someone could hear or see you**: while at least one other walker is on your tab.
  Alone on a tab for 15 seconds, the microphone closes (the browser's recording light goes out) and the button says so;
  it opens again the moment somebody arrives.
- **The mic indicator** on the button shows, at a glance:
  - **Live** (a soft brand ring and your own small level meter): somebody is in earshot and hears you.
  - **Nobody Near**: your microphone is open but nobody is within the hearing radius; your equaliser still shows to
    the people further away.
  - **Muted** (a struck-through microphone).
  - **Mic Blocked** (amber): the browser refused the microphone; the hover card says how to allow it. You still hear
    everyone.
  - **Mic Off**: nobody else is on your tab, so the microphone is closed until somebody arrives.
- The hover card names the state in words; the button's label is the action it takes.

## The talking equaliser

The speaker's own browser detects their voice and sends only a coarse level over the existing room socket, never
audio. Nobody out of earshot receives any media: it costs no Realtime egress and reveals nothing said.

- **Detection**: an analyser on the microphone, sampled every 50 ms. Speaking starts when the level crosses a
  threshold, and stops only after 600 ms below it (a **hangover**), so the pauses between words do not flicker.
- **On the wire**: a start (a level of 1 to 4), a new level at most every 250 ms while it changes, the same level
  again every 5 seconds while it holds (so a receiver can tell a long speech from a lost stop), and a stop (0). At
  most about 4 messages a second per speaker, and none from someone silent or muted.
- **Drawn above every talking character**, out of earshot and in it alike: three small bars in the speaker's colour
  just above the name chip. The bars move locally from the last level, so the motion is smooth without more
  messages. Out of earshot they are calm and faint, fading with distance (full at the release radius, a third as
  strong at 1,500 canvas px and beyond), so the nearest groups stand out; in earshot they are brighter, so you see
  who you are hearing.
- **A level that is not refreshed for 8 seconds is dropped**, as is a speaker who leaves the mode, the tab or the room.
- **Hover or tap the bars**: "Sam is talking, walk over". Pressing them walks your character towards Sam, stopping a
  short way off (60 canvas px) so you do not shove them. Only while you walk; otherwise the bars only show.
- **Your own bars** show above your own head while you talk, so you can see you are coming through.
- Under reduced motion the bars hold still at their level's height.
- A screen reader is not read the bars (they change too often); the hover card is their text.

### Do Not Disturb

[Do Not Disturb](../008-canvas/avatar-mode.md#status) (Work Tracker #319) still shows **your** bars to others but
hides **theirs** from you. Until #319 lands, the hook takes a `doNotDisturb` flag that is always false.

## Hide cursors

A [hide-cursors vote](session-tools.md#hide-participant-cursors-default-on) hides **cursors only** (owner,
2026-11-03): characters, their speech bubbles, their equalisers and the audio carry on through a vote.

## The wire

Two presence ops in `@livehuddle/api-schema` (`call-voice.ts`), each with a field-by-field parser shared by the room
and the editor:

- `avatar-voice`: `{ kind, tabId, level }`, `level` an integer 0 to 4, 0 meaning stopped. A **sample**, like `avatar`
  and `cursor`: the room relays it only to the sockets on its tab and, in a room of more than 10, coalesces it per
  sender per step with the walking samples ([API](../015-api/api.md) "A busy room bounds its presence fan-out"), so a
  full Space talking adds no frames, only bytes inside the frames it already sends.
- `call-track`: `{ kind, tabId, track }`, `track` either `null` (stopped publishing) or
  `{ sessionId, trackName, token }`: where a listener asks the mint route for this speaker's microphone. Sent when
  the speaker starts publishing and again whenever a new walker appears on their tab (a late joiner never receives a
  replay), at most once a second. Relayed to the whole room, unbatched.

The room drops either op from a Viewer, and drops one that fails its parser, as it drops a Viewer's `avatar-say`.

## The mint route

The browser never talks to Cloudflare Realtime's API: livehuddle's api Worker holds the Realtime app's secret and the
TURN key, and makes every call on the browser's behalf, after checking the caller's grant on the Space.

- `POST /api/documents/:id/calls/session`: a new Realtime session for this browser, with short-lived TURN credentials
  (ICE servers for 4 hours), a private **session token** that proves the session is the caller's, and whether it may
  speak.
- `POST /api/documents/:id/calls/tracks`: publish this browser's microphone (an offer and its `mid`; Editor or
  Participant only), or subscribe to speakers' microphones (their `call-track` locators). A locator's `token` is the
  api's signature over the Space and the publishing session, so a listener can only subscribe to a microphone
  published in the same Space.
- `PUT /api/documents/:id/calls/renegotiate`: the browser's answer to an offer the SFU made.
- `PUT /api/documents/:id/calls/close`: stop subscriptions or the microphone, by `mid`.

Every route answers **503 `calls_off`** while calls are off (close excepted while the kill switch alone pauses
them), **404** without a grant on the Space, and **403 `calls_listen_only`** for a Viewer's publish. The kill switch
checks every session and track against its mode ([Calls kill switch](../016-platform/calls-kill-switch.md#wired-in)).

## Turning calls on

Calls are on only where everything below holds; the editor learns it from `/api/capabilities` (`callsEnabled`) and
shows no audio controls otherwise.

- **Never in production yet.** The mint route refuses every session on the production deployment
  (`www.livehuddle.app`), whatever is configured. The kill switch (#316) is a further gate beside this flag, not its
  replacement; lifting the flag is a later, deliberate change.
- **The secrets are set**: the Realtime app's id and token, and a TURN key's id and API token. They are the owner's to
  create; unset, calls are off.
- **The kill switch allows it** ([Calls kill switch](../016-platform/calls-kill-switch.md)): `off` pauses calls, and
  the controls read **Calls Paused** rather than going away; `audio-only` leaves audio as it is.

`/api/capabilities` answers `callsEnabled` (this deployment has calls: not production, secrets set) and `callsMode`
(the switch: `on`, `audio-only` or `off`).

## Cost

Cloudflare charges $0.05 per GB of egress, after the first 1,000 GB each month (SFU and TURN together). Opus at about
40 kbps is about 0.018 GB per listener-hour. A Space of 30 in groups of 3 to 4 is about 1.6 GB an hour, about $0.08 an
hour. The equaliser adds no Realtime cost, only small presence messages.

## Telemetry

`track('Canvas', 'Used', 'AudioJoin' | 'AudioListen')` on joining (by the door: speaker or listener),
`track('UI', 'Changed', 'AudioMute')` on a mute or unmute, and `track('Canvas', 'Used', 'WalkToTalker')` on pressing
someone's bars. Never who, never how long, never anything heard.

## Out of scope

- Room walls deciding who hears whom (an [Office](../009-elements/office.md) room as one call), the All-Hands Hall's
  stage, and video or screen sharing: [Future work](../005-project-roadmap/future-work.md).
- Muting someone else (an Editor's act in the future-work role table) and per-person volume.
- Any recording, transcript or history: nothing said is stored anywhere.
