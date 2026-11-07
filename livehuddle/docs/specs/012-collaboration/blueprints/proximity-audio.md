# Proximity audio blueprint

Derived from [Proximity audio](../proximity-audio.md). Paths are livehuddle's; `../packages/…` is the monorepo's.

## Domain and naming

| Term          | Identifier                                           | Meaning                                                       |
| ------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| call          | `CallPhase`                                          | This browser's audio: `off`, `joining`, `live`, `error`       |
| speaker       | `canSpeak`                                           | A session that may publish (Editor, Participant)              |
| listener      | (a session in a call)                                | Anyone in a call; a Viewer is only this                       |
| voice level   | `VoiceLevel` (0 to 4)                                | The coarse loudness the speaker's browser sends; 0 is stopped |
| locator       | `CallTrackLocator` `{ sessionId, trackName, token }` | Where a listener asks for a speaker's microphone              |
| session token | `sessionToken`                                       | Private proof a Realtime session is the caller's              |
| track token   | `CallTrackLocator.token`                             | Public proof a publishing session belongs to this Space       |
| earshot       | `HEARING_RADIUS_PX`, `RELEASE_RADIUS_PX`             | Subscribe inside the first, let go outside the second         |
| calls gate    | `callsGate(env)`                                     | The api's one decision whether calls are on, the switch last  |

## Behaviour and state

**Module layout** (#496, no behaviour of its own): the call (`lib/calls/proximity-call.ts`) is the orchestrator and
composes focused parts. `call-config.ts` holds the timings, media constraints, `CallSignal`, `CallScene` and
`ProximityCallInput`; `call-mic.ts` (`CallMic`) the microphone, its idle close, mute and the voice sampler;
`call-video.ts` (`CallVideo`) the camera and the shared screen; `call-beacon.ts` (`CallBeacon`, `trackSignalOf`) the
`call-track` locator, its resend throttle and the quiet-spell `calls-check`; `call-subscriptions.ts`
(`chooseSubscriptions`, `seeable`, `presenceOf`) who is heard and which tracks are wanted; `call-staging.ts`
(`stageScene`) the stage and hands for one scene; `call-receiver.ts` (`CallReceiver`) arriving tracks into the audio
graph or a bubble, and their placing. The store is three modules behind one door, `calls-store.ts` (peers, your own
call, the kill-switch mode), which re-exports `calls-hands-store.ts` (hands, let-speaks, stamped levels) and
`calls-media-store.ts` (the bubbles' streams and the maximised one).

**Call phase** (`lib/calls/calls-store.ts`): `off` → (Join Audio) `joining` → `live`; `joining` → `error` on a refused
session or a failed connection; `live`/`error` → (Leave Audio, leaving the mode, changing tab, unmount) `off`.
`micState`: `closed` (no other walker for `MIC_IDLE_CLOSE_MS`, or a listener), `open`, `blocked` (getUserMedia
refused); `muted` is separate and survives the microphone closing.

**Hearing** (`lib/calls/hearing.ts`, pure): rooms first ([Meeting rooms and the stage](meeting-rooms-and-stage.md)
blueprint: `nextHeard`'s optional `zoning` hears a shared room whole and never across zones). In the open,
`nextHeard(prev, self, peers)` keeps a peer already heard while its
distance is ≤ `RELEASE_RADIUS_PX` and adds one at ≤ `HEARING_RADIUS_PX`; only peers with a locator are candidates.
`gainAt(d)`: 1 at ≤ `FULL_VOLUME_RADIUS_PX`, `cos(π/2 · (d − full)/(release − full))` to 0 at the release radius.
`panAt(dx)`: `clamp(dx / HEARING_RADIUS_PX, −1, 1) · MAX_PAN`. `barsOpacity(d, heard)`: 1 when heard, else linear from
`BARS_FAR_OPACITY_NEAR` at the release radius to `BARS_FAR_OPACITY_MIN` at `BARS_FADE_END_PX`.

**Voice detection** (`lib/calls/voice-detector.ts`, pure): `stepVoice(state, rms, now)` returns the next state and the
level to send, if any. Speaking starts at `rms ≥ VOICE_THRESHOLD_RMS`; it stops after `VOICE_HANGOVER_MS` below. The
level is `quantiseVoice(rms)`, 1 to 4 on a dB scale from `VOICE_DB_FLOOR` to `VOICE_DB_CEIL`. A changed level is sent
no sooner than `VOICE_MIN_INTERVAL_MS` after the last send; an unchanged one is resent after `VOICE_REFRESH_MS`; a
stop is sent at once. Muting stops it (sending 0 when it was speaking).

**Receiving** (`calls-store.ts`): `receiveCallOp(from, op)` parses with the shared parsers and keeps, per presence id,
the last level with its arrival time and the last locator. A level older than `VOICE_STALE_MS` reads as 0. A peer
leaving the room is pruned with the rest of its presence (`pruneCallPeers(present)`); a peer's `avatar: null` clears
its level and locator.

**Publishing a locator**: on publishing, and when the set of walker ids on the tab gains one, at most once per
`LOCATOR_RESEND_MS`; `track: null` on leaving.

**Subscriptions** (`lib/calls/sfu-session.ts`): one `RTCPeerConnection` and one Realtime session per call. Every
mutation (publish, subscribe batch, close batch) runs through one promise queue; a subscribe or close is reconciled
against the wanted set when it runs, so a peer walking in and out while a request is in flight makes no stale call.

**Audio graph** (`lib/calls/audio-graph.ts`): one `AudioContext`, resumed by the Join press. Per heard peer:
`MediaStreamAudioSourceNode → GainNode → StereoPannerNode → destination`, values set with `setTargetAtTime(…,
GLIDE_S)`. A muted `<audio>` element holds each remote stream (Chrome plays a WebRTC stream into Web Audio only while
an element holds it). The microphone feeds an `AnalyserNode` (`fftSize` 512) read every `VOICE_SAMPLE_MS`.

## Interfaces and contracts

Wire ops (`packages/api-schema/src/call-voice.ts`):

- `AvatarVoiceOp = { kind: 'avatar-voice'; tabId: string; level: VoiceLevel }`, parsed by `parseAvatarVoice`
  (tabId a string of at most 64; level an integer 0 to 4).
- `CallTrackOp = { kind: 'call-track'; tabId: string; track: CallTrackLocator | null }`, parsed by `parseCallTrack`
  (each locator field a non-empty string of at most `CALL_LOCATOR_MAX` = 128, `trackName` equal to `CALL_TRACK_NAME`).

Routes (`apps/api/src/routes/calls.ts`), each JSON:

| Route                                      | Body                                                                                           | Answer                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `POST /api/documents/:id/calls/session`    | none                                                                                           | `CallSessionResponse { sessionId, sessionToken, iceServers, canSpeak, mode, trackToken? }` |
| `POST /api/documents/:id/calls/tracks`     | `{ sessionId, sessionToken, publish: { sdp, mid } }` or `{ …, subscribe: CallTrackLocator[] }` | `CallTracksResponse { sessionDescription?, requiresImmediateRenegotiation, tracks }`       |
| `PUT /api/documents/:id/calls/renegotiate` | `{ sessionId, sessionToken, sdp }`                                                             | `{ ok: true }`                                                                             |
| `PUT /api/documents/:id/calls/close`       | `{ sessionId, sessionToken, mids, sdp? }`                                                      | `CallTracksResponse`                                                                       |

Rejections: `503 { error: 'calls_off', reason: 'unconfigured' | 'paused' | 'audio-only' }` (the
last two from the [kill switch](../../016-platform/blueprints/calls-kill-switch.md#wired-in-part-2)); `404` without a grant; `410` trashed;
`403 { error: 'calls_listen_only' }` for a listener's publish or a listener-signed session; `400 { error:
'invalid_call_request' }` for a malformed body, a bad session token, a bad track token, more than
`MAX_SUBSCRIBE_BATCH` (16) locators or a `trackName` other than `mic`; `502 { error: 'calls_upstream' }` when Realtime
fails (logged `[calls] upstream` with the operation and status).

Tokens (`apps/api/src/calls/call-tokens.ts`): HMAC-SHA256 keyed by `REALTIME_APP_TOKEN`, base64url.
`sessionToken = '<s|l>.' + mac('own|<documentId>|<sessionId>|<s|l>')`, `trackToken = mac('pub|<documentId>|<sessionId>')`.
Compared in constant time.

## Data and persistence

Nothing is stored: no table, no Durable Object storage, no log. The room keeps no voice state beyond the relay's
held frames for one step. The editor's store is memory only and empties on leaving.

## Errors and edge cases

- **`not_heard`** (the server hearing check, meeting-rooms-and-stage blueprint "Security and trust"): a subscribed
  track the room refuses is not a dead locator; `SfuSession` holds it back 2 s (doubling to 16 s) and asks again, and
  the call re-sends `call-session`. Every other `errorCode` is still a refusal never asked for again.

- Calls off, or no shared room: no controls; the store stays `off`.
- Session refused (`calls_off` after capabilities said on): phase `error`, the button reads **Audio Unavailable**;
  with reason `paused` it is no error: phase `off`, mode `off`, the button reads **Calls Paused**.
- The kill switch pauses calls mid-call (the room's `calls-mode` op, or a `paused` refusal): the call ends as Leave
  Audio does, into **Calls Paused**.
- Microphone refused: `micState: 'blocked'`, joined as a listener; the button says how to allow it.
- Connection fails (`iceconnectionstate` `failed`): phase `error`, Leave and Join again start fresh.
- A locator for a session that ended: the subscribe's per-track error is ignored; the peer is retried only when it
  sends a new locator.
- A peer who walks out of range mid-subscribe: the queue's reconciliation closes it on the next run.
- A stuck level (a lost stop): dropped after `VOICE_STALE_MS`.

## Security and trust

- The Realtime secret and TURN key are Worker secrets, never sent to a browser. TURN credentials are short-lived
  (`TURN_TTL_S`).
- Every route checks the index grant on the Space first (`resolveDocumentGrant`), then the gate, then the tokens. A
  listener-signed session cannot publish even with a Participant's grant later.
- A subscribe needs a track token for this Space, so a locator from another Space, or forged, is refused before
  Realtime is asked.
- The room drops `avatar-voice` and `call-track` from a Viewer and anything its parser refuses (`room-op-gate.ts`).
- Calls routes are writes: they ride the per-owner write limiter (300 a minute), which bounds a client hammering them.

## Performance and limits

- `avatar-voice` is a relayed sample (`sampleKinds` on the room's `PresenceRelay`): tab-scoped and coalesced, so in a
  room of more than 10 it adds bytes to frames the walkers already cause, never frames. Bound: 4 per second per
  speaker. The room test walks and talks 100 people and holds frames per socket at one a step and the room's CPU
  under its budget; the probe (`apps/api/scripts/avatar-fanout-probe`, `PROBE_TALK=1`) measures it on workerd.
  Measured 2026-11-04 (a shared machine at a load of about 22 on 10 cores, so CPU is noisy): 100 walkers, 1,009
  frames a second silent and 879 all talking, 29.9 and 30.2 MB/s, room CPU 56% and 53%; 32 walkers, 559 and 439
  frames a second, 5.2 and 4.4 MB/s, 32% and 29%. Talking adds no frames.
- `SfuSession.want` runs on every step anyone walks and returns at once while the subscribed set is the wanted one;
  a locator Realtime refuses is never asked for again in a loop.
- The hearing check runs on each change of `remoteAvatars` (at most once a frame), linear in walkers.
- Bars animate in CSS from a level custom property; a level change re-renders one bar group.
- The calls code loads only when someone presses Join Audio (`loadProximityCall`), so the canvas chunk gains only the
  store, the bars and the button.

## Presentation and UX

- The call group, first on the avatar palette (`components/calls/CallStripGroup.tsx`, placed by `AvatarPalette.tsx`):
  **Join Audio** (mic; Viewer: **Listen In**, headphones), then **Mute**/**Unmute** (mic, struck mic when muted, amber
  struck mic when blocked) with the indicator, and **Leave Audio** (headphones struck). Say's tinted strip buttons
  (`STRIP_TINT_BUTTON` on `TOOLBAR_TRIGGER_TONE`, 36 px, 44 px wide on a phone; a live mic solid brand), named beside the icon while the bar shows names (`useBarLabels`, through `CallNamesContext`),
  icon alone otherwise.
- Bars: three 3 px rounded bars, 2 px apart, 12 px tall at most, the speaker's colour, 6 px above the name chip
  (`components/calls/TalkingBars.tsx`). They live in the canvas layer and zoom with the characters and their chips,
  and slide with a walking character's glide (`avatarGlides`), landing at once on a jump.
- The microphone's resting state when nobody else is on the tab reads **Mic Off** ("it opens when somebody
  arrives"); a Viewer's reads **Listening**.

## Accessibility

Buttons carry `aria-label` and `aria-pressed` (Mute). The bars button's `aria-label` is its hover text. Bars hold
still under `prefers-reduced-motion`. Focus rings as every strip button.

## Observability

`[calls] gate` (reason) once per refused session, `[calls] upstream` per Realtime failure, `[calls] token` for a refused
token. The editor logs through `debugLog('calls', …)`.

## Testing

| Rule                                                          | Test                                                  |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| Secrets unset refuses; production open once they are set      | `apps/api/src/calls/calls-gate.test.ts`               |
| Tokens bind Space, session and role                           | `apps/api/src/calls/call-tokens.test.ts`              |
| Routes: grant, gate, listener publish, bad token, upstream    | `apps/api/src/routes/calls.test.ts` (Realtime mocked) |
| Room drops a Viewer's voice and track ops, and malformed ones | `apps/api/src/room-op-gate.test.ts`                   |
| Voice is tab-scoped and coalesced; 100 talking walkers bound  | `apps/api/src/document-room-fanout.test.ts`           |
| Parsers                                                       | `packages/api-schema/src/call-voice.test.ts`          |
| Hearing, gain, pan, hysteresis, bars fade                     | `apps/editor/lib/calls/hearing.test.ts`               |
| Detector: threshold, hangover, quantise, rate, refresh, mute  | `apps/editor/lib/calls/voice-detector.test.ts`        |
| Store: receive, stale, prune                                  | `apps/editor/lib/calls/calls-store.test.ts`           |
| Button states per role; bars hover text and walk              | `apps/editor/components/calls/*.test.tsx`             |
| The call: mint, publish, earshot, mute, idle close, errors    | `apps/editor/lib/calls/proximity-call.test.ts`        |
| One queue, batches, refused locators, closes                  | `apps/editor/lib/calls/sfu-session.test.ts`           |
| Join, leave with the mode or tab, rejoin after failure        | `apps/editor/lib/calls/useProximityCall.test.tsx`     |

## Constants and configuration

| Constant                 | Value     | Why                                                |
| ------------------------ | --------- | -------------------------------------------------- |
| `HEARING_RADIUS_PX`      | 260       | A meeting room of the Virtual Office holds a group |
| `RELEASE_RADIUS_PX`      | 300       | About 15% more, so the edge does not flicker       |
| `FULL_VOLUME_RADIUS_PX`  | 90        | Two or three characters side by side               |
| `MAX_PAN`                | 0.8       | Never hard left or right                           |
| `GLIDE_S`                | 0.12      | Gain and pan changes are never heard as steps      |
| `BARS_FADE_END_PX`       | 1500      | About a screen away at 100%                        |
| `BARS_FAR_OPACITY_NEAR`  | 0.9       | Out of earshot reads quieter than in earshot (1)   |
| `BARS_FAR_OPACITY_MIN`   | 0.3       | Still findable far away                            |
| `VOICE_SAMPLE_MS`        | 50        | 20 reads a second, cheap                           |
| `VOICE_THRESHOLD_RMS`    | 0.02      | About −34 dBFS, above room noise                   |
| `VOICE_HANGOVER_MS`      | 600       | Pauses between words                               |
| `VOICE_MIN_INTERVAL_MS`  | 250       | At most about 4 a second                           |
| `VOICE_REFRESH_MS`       | 5000      | Proves a long speech is still on                   |
| `VOICE_STALE_MS`         | 8000      | A lost stop clears                                 |
| `VOICE_DB_FLOOR/CEIL`    | −34 / −10 | The level's range                                  |
| `MIC_IDLE_CLOSE_MS`      | 15000     | Alone on a tab                                     |
| `LOCATOR_RESEND_MS`      | 1000      | Late joiners learn the locator                     |
| `WALK_TO_TALKER_STOP_PX` | 60        | Stop short of shoving                              |
| `TURN_TTL_S`             | 14400     | 4 hours, a long session                            |
| `MAX_SUBSCRIBE_BATCH`    | 16        | One request a step even in a crowd                 |

Env (`apps/api/src/types.ts`, `.env.example`): `REALTIME_APP_ID`, `REALTIME_APP_TOKEN`, `TURN_KEY_ID`,
`TURN_KEY_API_TOKEN`, all secrets, all unset by default.

## Assets and external resources

Icons `mic`, `mic-off`, `headphones`, `headphone-off` from the vendored Lucide set (`../packages/icons`, ISC).
Cloudflare Realtime SFU (`https://rtc.live.cloudflare.com/v1/apps/<id>/…`) and TURN
(`…/v1/turn/keys/<id>/credentials/generate-ice-servers`).

## Defaults ledger

See `DEFAULTS.md` rows PA1 to PA4 and PA6.
