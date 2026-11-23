# Call minutes blueprint

Derived from [Call minutes](../call-minutes.md). The spec decides; this file only adds engineering precision, read
from the code. Paths are relative to `livehuddle/`.

## Files

| File                                                             | Role                                                                                                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/api-schema/src/call-minutes.ts`                        | `CALL_MINUTES_LOW` (80), `CallSessionMinutes`, `CallMinutesRefusal`, `CallMinutesResponse`, `CallMinutesOp`, `parseCallMinutesOp`             |
| `packages/api-schema/src/call-control.ts`                        | `CallSessionOp.left`, kept by `parseCallSession` only when exactly `true`                                                                     |
| `packages/api-schema/src/room-op-kinds.ts`                       | `call-minutes` in `SYSTEM_OP_KINDS`: the room drops one sent by a client                                                                      |
| `apps/api/src/subscription.ts`                                   | `subscriptionOf(env)`: the api's one subscription client (`livehuddle.app`), one entitlement cache per isolate                                |
| `apps/api/src/calls/call-meter.ts`                               | `CallMeter`: the room's meter. `admit`, `proved`, `left`, `dropped`, `alarm`, `due`, `read`, `restore`, `forget`                              |
| `apps/api/src/calls/realtime-api.ts`                             | `sessionMids` (`GET sessions/:id`), `severSession` (force-close every track of a session, in batches of 64)                                   |
| `apps/api/src/routes/calls.ts`                                   | `callsPayer(grant)`, the admit before `mintSession`, `GET calls/minutes`                                                                      |
| `apps/api/src/document-room/document-room.ts`                    | `callMeter` (the host wiring), the RPCs `callsAdmit` and `callMinutes`, `restore` in the constructor                                          |
| `apps/api/src/document-room/room-call-sessions.ts`               | `noteCallSession` (a proof counts the person in; `left` takes them out), `callSessionHolders`                                                 |
| `apps/api/src/document-room/room-roster.ts`                      | `dropSession`: a closed connection's session goes to the meter (`dropped`)                                                                    |
| `apps/api/src/document-room/room-lifecycle.ts`                   | `armAlarm` adds `callMeter.due()`; `alarm` runs `callMeter.alarm(now)`; `purge` forgets the meter                                             |
| `apps/api/src/room-scope.ts`                                     | `call-minutes` reaches a tab-scoped session                                                                                                   |
| `apps/editor/lib/api/calls.ts`                                   | `CallsApiError.minutesUsed`, `apiCallMinutes`                                                                                                 |
| `apps/editor/lib/calls/call-minutes-store.ts`                    | What the browser was told: `caller`, `owner`, `low`, `used`, `notice`                                                                         |
| `apps/editor/lib/calls/call-minutes-words.ts`                    | Every sentence, and `callMinutesResetDay` (`nextMonthStart`, UTC, the reader's locale)                                                        |
| `apps/editor/lib/calls/proximity-call.ts`                        | Notes a session's `minutes`; a metered call sends `left` in `teardown`; a refused mint with `minutesUsed` stops the call without failing it   |
| `apps/editor/lib/calls/useProximityCall.ts`                      | No auto-join while used; joins again on the store's resumed signal                                                                            |
| `apps/editor/components/calls/minutes/CallMinutesHost.tsx`       | In the Call dock: loads the low notice and the used dialog only when there is one to show                                                     |
| `apps/editor/components/calls/minutes/CallMinutesLow.tsx`        | The one-time low notice                                                                                                                       |
| `apps/editor/components/calls/minutes/CallMinutesUsedDialog.tsx` | The used dialog: the kit's `UsageMeter` and `LimitNotice`                                                                                     |
| `apps/editor/components/calls/minutes/CallsPausedSegment.tsx`    | The dock's Calls Paused while used                                                                                                            |
| `apps/editor/components/calls/minutes/CallMinutesSection.tsx`    | Call Minutes at the foot of Collaborators (`CollaboratorsDialog`'s `below`); limit from the page's subscription or owner view, else the api's |

## The meter's state

One key in the room's Durable Object storage, `call-meter` (`CALL_METER_KEY`), written after a step only when the
step changed it. Never read or written with Pro off.

| Field     | Meaning                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| `owner`   | Who pays (`p:<accountId>` or `t:<teamId>`), as the last join's grant named them                                   |
| `month`   | The UTC month (`2026-11`) the fields below belong to                                                              |
| `tickAt`  | When the next minute is paid; null while no call runs                                                             |
| `paid`    | The collab keys whose current minute is paid                                                                      |
| `used`    | What the service last said the owner has used; null until it has said                                             |
| `spent`   | `{ used, limit }` of the refusal that ended the month, else null                                                  |
| `lowTold` | The room has said the month is running low                                                                        |
| `orphans` | `{ id, due }`: sessions no connection holds, and when each is closed at Realtime. At most 64 (`CALL_ORPHANS_MAX`) |

Who is in a call is never stored: it is read from the connections (`callSessionHolders`: each socket's
`callSession`, keyed by its `collabKey`), which survive hibernation in their attachments.

## Steps

Every step runs on the meter's own queue (`run`), one at a time, since a spend awaits the service and the room takes
other events meanwhile. A step that throws does not wedge the next.

- **`admit(owner)`** (the mint route, before `newSession`): a new owner starts the state afresh; a new month clears
  `used`, `spent` and `lowTold`. While `spent`, it reads the owner's entitlement (the client keeps one for 60
  seconds) and refuses unless the limit is now higher than the refusal's. Then `settle(joining)`.
- **`settle(joining)`**: `people` are the distinct collab keys holding a session. With `people + (joining ? 1 : 0)`
  under 2 it does nothing. Otherwise it spends one minute for each person not in `paid`, in one `spend(owner,
'callMinutes', count)`, adds them to `paid`, and sets `tickAt` a minute ahead when none is set.
- **`charge`**: `count` people's minute is spent in parts of at most `SPEND_AMOUNT_MAX` (1,000), never 0, so the
  service takes each one. A refusal with minutes still left spends exactly what is left of that part, once, and
  stops. The client's own answer (`unmetered`: the service out of reach, or refusing) knows no count: nothing is
  learned from it, and nothing left is asked for. A real answer sets `used`, and at 80 or fewer left (and more than 0) tells `low` once.
- **A refusal by the service** (`refusedByService`: a 4xx, a wrong key): `settle` records nothing as `spent`. With
  `joining`, it answers `{ used, limit, unchecked: true }`, which the mint route turns into 503 `calls_off` with
  reason `unconfigured`. Without, it sets `tickAt` a minute ahead and returns: the call runs on, `paid` stays as it
  was, and the next alarm asks again.
- **`exhaust`**: sets `spent`, clears `tickAt` and `paid`, broadcasts `{ kind: 'call-minutes', state: 'used', owner,
used, limit }` and severs every held session.
- **`proved(sessionId, replaced)`** (`noteCallSession`): takes the session out of `orphans`, orphans the one it
  replaced, and runs `settle(false)` in the background.
- **`left(sessionId)`**, **`dropped(sessionId)`**: orphan the session, due now or in 30 seconds
  (`CALL_ORPHAN_GRACE_MS`).
- **`alarm(now)`**: when `tickAt` is due, clears `paid` and `tickAt` and settles (which sets the next tick only with
  two or more people). Then severs each due orphan that no connection holds.

## Routes

| Route                                   | With Pro on                                                                                                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/documents/:id/calls/session` | After the grant, the Community check and the calls gate: `callsAdmit(callsPayer(grant))`. Refused: `429 { error: 'calls_minutes_used' }` with what the caller may know |
| `GET /api/documents/:id/calls/minutes`  | After the grant and the Community check, before the calls gate: `callMinutes(payer)`. `{ metered: false }` with Pro off or a grant that names no owner                 |

`callsPayer` is `itemPayer(grant)` (`@liveworkspace/subscription`, the one rule): the owner's scope, `GUEST_SPACE`
(`'guest'`) for a guest's Space, or null for a grant that names nobody. A guest's Space runs the same meter with
`chargeHere`: its minutes are counted in the room's `call-meter` state against `guestLimit('callMinutesPerMonth')`,
and no client call is made for it (no entitlement, no spend).

`minutesAudience(ctx, grant, payer)` says what the caller is told (spec "Who is told what"): `owner` when the
grant's subject is an account (`isAccountIdShape(grant.sub)`), `guest: true` for a guest's Space, and `numbers`
when `grant.sub === grant.owner` or the caller's token names the grant's team. The mint's answer, its 429 and the
minutes read all go through it. The room's `call-minutes` op carries the state alone.

**Media while the month is used.** `CallMeter.paused` is true while `spent` is set in the current month.
`exhaust` severs every session and then calls the host's `end` (`endCallSessions`: every attachment's `callSession`
is set to null); `noteCallSession` takes no proof while paused; `callsHearing` answers `minutes-used` for every
track, which `splitByHearing` reports as `paused`; `callsPaused` answers the same for the routes that ask the room
nothing else. `tracks`, `renegotiate` and `layer` answer `429 calls_minutes_used` before any Realtime request.

**Who a person is** (`callPersonOf`, `room-call-sessions.ts`): an account's session (`account`, with a collab key
that came by the `X-Verified-Collab-Key` header) is its collab key. Every other is `unverifiedPerson(...)`: a
guest's of its header key, a link visitor's (`keyMinted`, or `keyVisitor` once its hello's secret gave it a key)
of its `presenceId`. `CallMeter.owed` pays for at most `CALL_UNVERIFIED_PEOPLE_MAX` (10) unverified people in one
minute, counted against the minute's `paid` list, so churn inside a minute costs nothing more.

## Closing a session at Realtime

`severSession(env, sessionId)`: `GET /apps/:app/sessions/:id` for the session's tracks, then `PUT
.../tracks/close` with `{ tracks: [{ mid }], force: true }` in batches of 64. `404` and `410` mean the session is
gone already. Never throws; any other failure is logged as `[calls] sever failed <status>`. Skipped on a deployment
without the four Realtime secrets.

## The editor

- A session answer with `minutes` sets the store's `caller`, `owner` and `low`. Without one the store stays empty and
  the call sends nothing new.
- `receiveCallMinutes(from, op, inCall)` takes the op only from `system`. `used` ends the running call through
  `onCallMinutesUsed` and opens the dialog when a call was running; `ok` clears everything and fires
  `onCallMinutesResumed`.
- The low notice shows when the reader's owner view allows `upgrade` or `manage`, the api's read has numbers, and
  between 1 and 80 are left. Shown, it writes `livehuddle:call-minutes-low:<owner>:<month>` to `localStorage` and is
  not shown again in that browser that month.
- Every part that draws the subscription kit is loaded with `next/dynamic`, so the dock's first load carries the
  store, the words and the flag alone.

## Performance and limits

Subrequests are the Worker's or the room's own; a storage write is one `put` of the `call-meter` key.

| Moment                         | Pro off        | Pro on                                                                                                                                                                                                              |
| ------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A join (`calls/session`)       | Unchanged      | One more call into the room (`callsAdmit`). One spend and one storage write only when the join starts a call (the person already there pays) or names a new owner. An entitlement read only while the month is used |
| A proof (`call-session`)       | Unchanged      | One spend and one storage write when the person has not paid this minute; neither for a re-proof, a renewal or a second tab                                                                                         |
| Each minute of a call          | No alarm       | One alarm, one spend for everyone together, one storage write, one `setAlarm`                                                                                                                                       |
| Nobody in a call, or one alone | No alarm       | No alarm for calls, no spend                                                                                                                                                                                        |
| A leave, or a dropped socket   | Unchanged      | One storage write and one alarm 0 to 30 seconds on, which makes one Realtime read and, for a session still holding tracks, one close per 64 tracks                                                                  |
| The month used                 | Not applicable | One broadcast, and one Realtime read and close per call session in the Space, once                                                                                                                                  |
| A wake from hibernation        | Unchanged      | One storage read (`call-meter`)                                                                                                                                                                                     |
| The minutes read               | No room call   | One call into the room and one entitlement read (the client keeps one for 60 seconds)                                                                                                                               |
| A subscribe (`calls/tracks`)   | Unchanged      | Unchanged: the paused answer rides the `callsHearing` call it already makes                                                                                                                                         |
| A publish, renegotiate, layer  | Unchanged      | One more call into the room (`callsPaused`, a field read, no storage and no subrequest). Once a track, a negotiation or a maximise, never a frame                                                                   |

The room's one alarm takes the meter's time as one more entry in `armAlarm`'s list, so it coexists with the
facilitator, grants, the outbox, shares, Community and upkeep, floored at a second like every other.

## Testing

- `apps/api/src/calls/call-meter.test.ts`: the meter against a stand-in service (`src/test-subscription-service.ts`).
- `apps/api/src/document-room-call-minutes.test.ts`: the real room, Pro off and on.
- `apps/api/src/routes/calls-minutes.test.ts`: who pays, a claimed tier ignored, the refusal, the minutes read.
- `apps/api/src/calls/realtime-sever.test.ts`: closing a session.
- `packages/api-schema/src/call-minutes.test.ts`: the op's parser and `left`.
- `apps/editor/lib/calls/call-minutes-store.test.ts`, `call-minutes-words.test.ts`, `proximity-call.minutes.test.ts`.
- `apps/editor/components/calls/minutes/CallMinutes.test.tsx`: the three audiences, and Pro off.

## Trying it locally

Free has 1,000 minutes. The subscription Worker lowers Free's limits in development with `DEV_FREE_LIMITS`
(`liveworkspace/apps/subscription/.dev.vars`, off unless set): `{"callMinutesPerMonth":84}` shows the low notice after about two
minutes of two people in a call, and `{"callMinutesPerMonth":6}` uses the month in about three.
