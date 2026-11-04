# Calls kill switch

Status: **part 1 built** (the switch, the budget poll and its email; Work Tracker #316). Part 2, the gate in the
Realtime mint route, the room telling clients to close their tracks, the calm "Calls are paused" state and the media
limits, follows once proximity audio (#315) has merged.

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
- **Who reads it.** The Realtime mint route, before every session and every track (part 2): `off` refuses both,
  `audio-only` refuses any video or screen-share track. Nothing else.

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
role alike. Only someone with access to the Cloudflare account flips it. Part 2 adds what each role sees when calls
are paused.

## Part 2 (after #315)

- The mint route checks `callsMode()` before every session and track.
- When the switch tightens, the room tells every connected client to close the call tracks it no longer allows,
  and the UI shows a calm "Calls are paused" (or "Video is paused") state, never an error.
- Media limits that keep normal use cheap: at most N video bubbles received per person, a cap on screen-share
  resolution and frame rate, and a maximum call length. Guests may publish audio (decided on #315), so sign-in to
  publish no longer applies to audio; whether video and screen sharing need it is part 2's to settle.
