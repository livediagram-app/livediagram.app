# Calls kill switch

Status: **built** (Work Tracker #316): part 1, the switch, the budget poll and its email; part 2, the switch wired
into the Realtime mint route, the room telling clients when it tightens, the calm "Calls Paused" state and the media
each mode allows.

## What

One switch decides whether livehuddle's calls may use Cloudflare Realtime, in three modes:

| Mode       | Stored as    | What it allows                          |
| ---------- | ------------ | --------------------------------------- |
| Calls on   | `on`         | Audio, video and screen sharing         |
| Audio only | `audio-only` | Audio; no video bubble, no screen share |
| Calls off  | `off`        | No Realtime session or track at all     |

Text, avatars, presence and the Space itself never depend on it: the switch only ever stops media.

## Why

livehuddle is free, and Cloudflare Realtime bills $0.05 per GB of egress once the account's shared 1,000 GB a month
(SFU and TURN together) is used. Nothing else livehuddle does is billed by traffic, so calls need a way to stop
spending that does not wait for a deploy, and a guard that acts when nobody is watching.

## The switch

- **Where it lives.** One key, `calls-mode`, in the api Worker's own KV namespace, bound as `CALLS_SWITCH`
  (owner's answer: a KV key). A person flips it in seconds with one command, and the budget poll can trip it; an
  admin control can write the same key later.
- **The command.** From `livehuddle/apps/api`:

  ```sh
  corepack pnpm exec wrangler kv key put --binding CALLS_SWITCH --remote calls-mode off
  corepack pnpm exec wrangler kv key put --binding CALLS_SWITCH --remote calls-mode audio-only
  corepack pnpm exec wrangler kv key put --binding CALLS_SWITCH --remote calls-mode on
  ```

  Add `--env staging` for staging. Deleting the key is the same as `on`.

- **Reading it.** `callsMode(env)` answers the mode. It keeps the answer for 5 seconds per Worker isolate
  (`CALLS_MODE_CACHE_MS`), so a burst of joins costs one KV read, and a flip reaches every isolate within KV's own
  propagation (up to about a minute at the edge) plus those 5 seconds.
- **What it reads as.** No key, or no `CALLS_SWITCH` binding (a fork, local dev), reads as `on`: the switch is a
  brake, never a prerequisite, and production's own off flag for calls lives with the mint route (#315). A value it
  does not know reads as `off`, so a typo stops spending rather than starting it. `audio_only` and `audio` are
  accepted for `audio-only`, and case and spaces are ignored. If KV cannot be read, the last answer this isolate had
  stands; with none, `on`.
- **Who reads it.** The Realtime mint route, before every session and every track, the Space's room, while calls
  are under way in it, and `/api/capabilities`, so a page opened while calls are paused shows it. See
  [Wired in](#wired-in).

## The budget poll

A scheduled run of the api Worker every 15 minutes (`*/15 * * * *`) prices the month so far and tightens the switch.

1. **Usage.** One request to Cloudflare's GraphQL Analytics API for the account, summing `egressBytes` from the
   Realtime SFU (`callsUsageAdaptiveGroups`) and TURN (`callsTurnUsageAdaptiveGroups`) datasets from 00:00 UTC on
   the first of the month to now. Realtime bills egress only, and the free 1,000 GB is shared by the two, so the
   sum is what the bill counts. Analytics are sampled and arrive a few minutes late; the thresholds leave room.
2. **Cost.** `max(0, GB − 1,000) × $0.05`, with a GB as 10⁹ bytes.
3. **Thresholds** (owner's answer, settings, not code): **audio only at $10** a month above the free tier
   (`CALLS_AUDIO_ONLY_AT_USD`), **off at $25** (`CALLS_OFF_AT_USD`). Both are `[vars]` in `wrangler.toml`; a missing
   or unreadable value falls back to those defaults. In GB above the free tier: 200 GB and 500 GB.
4. **Trip.** When the cost reaches a threshold this month has not yet tripped, the poll writes the stricter of the
   switch's current mode and the threshold's mode, records the trip, and emails the owner.
5. **Once a month.** The trip record (`calls-budget`, `{ month, level, costUsd, at }`) holds the highest level this
   month has tripped, so a later poll at the same level does nothing and sends no second email. Audio only, then
   off, sends two emails; jumping straight past both sends one, for off.
6. **Only tightens.** The poll never loosens the switch, not at a lower cost, not when a new month begins. Turning
   calls back on is always the owner's act, with the command above; the new month only clears the trip record, so
   the next month's thresholds can trip and email again.

The poll does nothing, and says so once in the log, when `CALLS_SWITCH`, the analytics token or the account id is
missing: a fork or a fresh deployment pays nothing for it. A failed analytics request leaves the switch as it was
and logs; the next run tries again.

**Rehearsing it.** `CALLS_USAGE_TEST_GB`, a var set only on staging when rehearsing, replaces the analytics figure
with a usage in GB, so "a test usage figure over the threshold trips it" can be shown without spending: set it to
`1300` for audio only (cost $15) or `1600` for off (cost $30). Production never sets it.

## The email

Each trip sends one email to `CALLS_ALERT_TO` through the app's Email Service binding (`EMAIL`, the same sender as
every livehuddle email): the level it tripped to, the month's usage in GB and its cost, the threshold, what the
switch now says, and the one command that turns calls back on. No `CALLS_ALERT_TO`, or no `EMAIL` binding, still
trips the switch; it only skips the email. The address is a secret, so it is never in the public repo.

## Settings and secrets

| Name                      | Kind   | Meaning                                                                 |
| ------------------------- | ------ | ----------------------------------------------------------------------- |
| `CALLS_SWITCH`            | KV     | The switch and the trip record. One namespace per environment           |
| `CALLS_AUDIO_ONLY_AT_USD` | var    | Monthly cost above the free tier that trips audio only. Default `10`    |
| `CALLS_OFF_AT_USD`        | var    | Monthly cost above the free tier that trips calls off. Default `25`     |
| `CALLS_USAGE_ACCOUNT_ID`  | var    | The Cloudflare account whose Realtime usage is priced                   |
| `CALLS_ANALYTICS_TOKEN`   | secret | A Cloudflare API token with Account Analytics: Read, and nothing else   |
| `CALLS_ALERT_TO`          | secret | Where trip emails go                                                    |
| `CALLS_USAGE_TEST_GB`     | var    | Staging rehearsal only: a usage figure in GB used in place of analytics |

Staging and production share the account, so both price the same usage; each trips its own switch and each emails.

## The backstop

The poll can be late (15 minutes, plus analytics delay) or down. Cloudflare's own **billing notification** is the
backstop: in the dashboard, Notifications, a "Usage Based Billing" alert on Realtime for the account, set just above
the free tier (1,000 GB), emails the owner whatever this Worker is doing. It is the owner's to create; nothing in
the repo can set it.

## Share roles

The switch is not a share-role act: no Editor, Participant or Viewer can see or change it, and it applies to every
role alike. Only someone with access to the Cloudflare account flips it. Every role sees the same calm "Calls Paused"
state while it is off (an Editor's and a Participant's Join Audio, a Viewer's Listen In), and the same refusal.

## Wired in

### What each mode allows

One rule, `callsModeAllows(mode, kind)`, decides every mint, for a `session` or a track of one kind: `audio`,
`video` or `screen`. A track's kind comes from its name (`callTrackKind`): the microphone (`mic`) is audio, the camera
(`cam`, #317) video and a shared screen (`screen`, #318) screen.

| Mode         | Session | Audio | Video | Screen |
| ------------ | ------- | ----- | ----- | ------ |
| `on`         | Yes     | Yes   | Yes   | Yes    |
| `audio-only` | Yes     | Yes   | No    | No     |
| `off`        | No      | No    | No    | No     |

The rule and the track names live in `@livehuddle/api-schema`, so the api and the editor read the same table.

### The mint route

The switch is an extra gate after the calls gate, never a replacement: production's own hard off and the unset
secrets ([Proximity audio](../012-collaboration/proximity-audio.md#turning-calls-on)) are checked first and still
refuse whatever the switch says.

- **Session.** `off` answers **503 `calls_off`** with reason **`paused`**. Otherwise the answer carries the mode
  (`on` or `audio-only`), so a browser that joins learns it.
- **Publish and subscribe.** Each track asked for is checked against the mode by its kind: `off` refuses with reason
  `paused`, a video or screen track under `audio-only` with reason **`audio-only`**. A refusal is the whole request's
  (nothing is half-made).
- **Renegotiate** is refused while `off`: it finishes setting up a subscription.
- **Close** is always allowed while the calls gate is open, `off` included: closing tracks never costs anything, and
  lets a browser leave cleanly.

### The room tells its clients

A flip from the command line, or a trip by the poll, reaches nobody by itself, so the Space's room watches the
switch while a call is under way in it:

- Each `avatar-voice` or `call-track` op the room relays (a speaker starts, talks, or a new walker arrives) lets it
  read the switch, at most once every 5 seconds per room (`CALLS_MODE_CACHE_MS`; the read is cached per isolate too).
- When the mode differs from the last one the room told, it sends every socket in the room a system op,
  `calls-mode` `{ mode }`, stamped `from: 'system'`. A client may never send one: the room drops it like every
  system op.
- A client in a call that no longer allows it closes it at once: the microphone is released, every subscription and
  the session end. A client not in a call only changes its button.
- **A silent room still hears within about 5 seconds** (Work Tracker #463). A call that publishes (a microphone, a
  camera or a screen) and has sent the room nothing for 5 seconds sends a `calls-check` op: no payload but its tab,
  never relayed, consumed by the room as one more reason to read the switch (the same 5-second throttle). So a flip
  reaches every call within about 5 seconds of the room's read, plus the switch's own caching, whether or not anyone
  talks. A Viewer, who publishes nothing, sends none (nothing it receives exists without a publisher, whose check
  covers it), and the room drops one from a Viewer like its other call ops.
- **Why a check from the call, not a poll or an alarm.** A poll of `/api/capabilities` would be a Worker request per
  listener every 5 seconds. An alarm on the room would be a Durable Object alarm and a storage write every 5 seconds
  per room, and memory the room loses when it hibernates. The check rides the socket each publisher already holds:
  one inbound message per publisher per 5 seconds of silence (Cloudflare bills inbound WebSocket messages at 20 to 1,
  so about 36 billed requests per publisher-hour), none while it talks (its levels already reach the room), and no
  state kept anywhere.

### Calls Paused

Pausing is never an error. While the mode is `off` (from `/api/capabilities` when the page opens, from the room's
push, or from a refused mint):

- The audio control beside Avatar reads **Calls Paused**, with a pause icon, in the cluster's calm resting colour,
  never amber or red. Its hover card says "Calls are paused for now. Everything else in the Space carries on. Press
  to try again."
- Pressing it tries to join: if calls are back on, you join, as Join Audio would; if not, it stays paused.
- A call that was live when the pause arrived ends quietly into that state, and a screen reader hears "Calls are
  paused".
- Text, avatars, the equaliser bars already on screen and the Space carry on.

`audio-only` leaves audio as it is; the camera and Share Screen buttons ([Video and screen share
bubbles](../012-collaboration/video-and-screen-bubbles.md#the-kill-switch), #317 and #318) read **Video Paused**, a
camera or share that was on stops, and every bubble closes.

### Sign-in to publish

Guests may publish audio (decided on #315). Video and screen sharing follow the same share roles as audio, with no
sign-in either: the switch and the per-mode table are the cost guard, and a guest on a Participant link is taking
part like anyone else.

### Later

The per-person cap on video bubbles received (the nearest 6) and the screen share's resolution and frame-rate caps
(1080p, 5 to 15 fps) are set in [Video and screen share bubbles](../012-collaboration/video-and-screen-bubbles.md). A maximum call length is not set: the TURN credentials
already last 4 hours, and the budget poll guards the month.
