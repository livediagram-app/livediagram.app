# Calls kill switch blueprint

Derived from [Calls kill switch](../calls-kill-switch.md).

## Domain and naming

| Term        | Identifier                                   | Meaning                                                          |
| ----------- | -------------------------------------------- | ---------------------------------------------------------------- |
| Mode        | `CallsMode`: `'on' \| 'audio-only' \| 'off'` | What calls may use Realtime for                                  |
| Switch key  | `CALLS_MODE_KEY` (`calls-mode`)              | The KV key a person or the poll writes                           |
| Trip record | `CALLS_BUDGET_KEY` (`calls-budget`)          | `{ month, level, costUsd, at }`: the highest trip this month     |
| Read        | `callsMode(env)`                             | The mode, cached `CALLS_MODE_CACHE_MS` (5 s) per isolate         |
| Parse       | `parseCallsMode(raw)`                        | Raw KV value to a mode: none is `on`, unknown is `off`           |
| Stricter    | `stricterCallsMode(a, b)`                    | The mode that allows less                                        |
| Allows      | `callsModeAllows(mode, kind)`                | Whether a `'session' \| 'audio' \| 'video' \| 'screen'` may mint |
| Track kind  | `callTrackKind(trackName)`                   | A track name's media kind (`mic` is `audio`), null if unknown    |
| Push        | `CallsModeOp` `{ kind: 'calls-mode', mode }` | The room's system op when the mode it last told changes          |
| Watch       | `CallsModeWatch`                             | The room's throttled read of the switch on each call op          |
| Check       | `CallsCheckOp` `{ kind: 'calls-check', tabId }` | A silent publishing call's nudge for the room to read the switch |
| Paused      | `CallsOffReason` `'paused'`                  | The switch is off: the gate's reason, and the refusal's          |
| Media off   | `CallsOffReason` `'audio-only'`              | A video or screen track refused while the switch is audio only   |
| Cost        | `realtimeCostUsd(bytes)`                     | `max(0, GB − 1,000) × $0.05`                                     |
| Thresholds  | `budgetThresholds(env)`                      | `{ audioOnlyAtUsd, offAtUsd }` from vars, defaults 10 and 25     |
| Level       | `budgetLevel(costUsd, thresholds)`           | `'none' \| 'audio-only' \| 'off'` the cost has reached           |
| Usage       | `fetchRealtimeEgressBytes(...)`              | One GraphQL request: SFU plus TURN egress bytes for the month    |
| Poll        | `pollCallsBudget(env, now)`                  | The scheduled run: price, trip, record, email                    |

## Modules

| File                                                 | Responsibility                                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `../packages/api-schema/src/calls-mode.ts`           | `CallsMode`, `CallsMediaKind`, `callsModeAllows`, `callTrackKind`, `CallsModeOp`, `parseCallsModeOp` |
| `apps/api/src/calls/calls-mode.ts`                   | `callsMode`, its cache, `parseCallsMode`, `stricterCallsMode`; re-exports the shared rule            |
| `apps/api/src/calls/calls-gate.ts`                   | `callsGate(env)`: production, secrets, then the switch; open answers the mode                        |
| `apps/api/src/calls/calls-mode-watch.ts`             | `CallsModeWatch`: the room's throttled read and its push                                             |
| `apps/api/src/routes/calls.ts`                       | Every session and track checked with `callsModeAllows`; close allowed while paused                   |
| `apps/api/src/routes/capabilities.ts`                | `callsEnabled` (gate open or only paused) and `callsMode`                                            |
| `apps/api/src/document-room/document-room.ts`        | Notes each relayed `avatar-voice` / `call-track`, and each consumed `calls-check`, to its `CallsModeWatch`; broadcasts the push |
| `apps/editor/lib/calls/calls-store.ts`               | `CallSelf.mode`, `receiveCallsMode(op)`, `onCallsMode`                                               |
| `apps/editor/lib/calls/proximity-call.ts`            | Ends the call into the paused state on a push or a `paused` refusal                                  |
| `apps/editor/components/calls/CallClusterButton.tsx` | The **Calls Paused** control                                                                         |
| `apps/api/src/calls/realtime-usage.ts`               | `fetchRealtimeEgressBytes`, `monthStartUtc`, `realtimeCostUsd`                                       |
| `apps/api/src/calls/calls-budget.ts`                 | `budgetThresholds`, `budgetLevel`, `pollCallsBudget` and the trip record                             |
| `apps/api/src/email/templates.ts`                    | `callsBudgetEmail`, kind `CallsBudget`                                                               |
| `apps/api/src/index.ts`                              | The worker's `scheduled` handler runs `pollCallsBudget`                                              |
| `apps/api/src/types.ts`                              | `CALLS_SWITCH`, the `CALLS_*` vars and secrets on `Env`                                              |
| `apps/api/wrangler.toml`                             | The cron, the thresholds, the account id and the (owner-created) KV binding                          |

## Constants

| Name                        | Value          | File                |
| --------------------------- | -------------- | ------------------- |
| `CALLS_MODE_CACHE_MS`       | `5_000`        | `calls-mode.ts`     |
| `REALTIME_FREE_GB`          | `1_000`        | `realtime-usage.ts` |
| `REALTIME_USD_PER_GB`       | `0.05`         | `realtime-usage.ts` |
| `BYTES_PER_GB`              | `1e9`          | `realtime-usage.ts` |
| `DEFAULT_AUDIO_ONLY_AT_USD` | `10`           | `calls-budget.ts`   |
| `DEFAULT_OFF_AT_USD`        | `25`           | `calls-budget.ts`   |
| `ANALYTICS_TIMEOUT_MS`      | `10_000`       | `realtime-usage.ts` |
| cron                        | `*/15 * * * *` | `wrangler.toml`     |

## Behaviour

- `callsMode` never throws. Cache hit within 5 s returns the cached mode with no KV read.
- `pollCallsBudget` returns what it did (`'inert' | 'failed' | 'below' | 'already' | 'tripped'`) for tests and the
  log. It reads the trip record, resets it when the month differs, and trips only when the level's rank is above
  the recorded one. It writes the switch before the record, and the record before the email, so a crash between
  them never sends a second email for the same level and never leaves the switch looser than the record says.
- The usage request runs with `AbortSignal.timeout(ANALYTICS_TIMEOUT_MS)`, so a hung API never holds the cron.

## Wired in (part 2)

**Gate** (`callsGate(env)`): `production` first, then `unconfigured`, then `callsMode(env)`. `off` closes it with
`paused`; otherwise `{ open: true, mode }` with `mode` `on` or `audio-only`.

**Mint route** (`routes/calls.ts`), after the grant:

| Route         | Gate closed `production` / `unconfigured` | Gate closed `paused`     | Open                                                                                               |
| ------------- | ----------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------- |
| `session`     | 503 `calls_off`, that reason              | 503 `calls_off` `paused` | Answer carries `mode`                                                                              |
| `tracks`      | 503 `calls_off`, that reason              | 503 `calls_off` `paused` | Each track's kind (`callTrackKind`) must pass `callsModeAllows`, else 503 `calls_off` `audio-only` |
| `renegotiate` | 503 `calls_off`, that reason              | 503 `calls_off` `paused` | As before                                                                                          |
| `close`       | 503 `calls_off`, that reason              | Allowed                  | As before                                                                                          |

A track name with no kind is already refused as malformed (400) by `parseCallTrackLocator`, and a publish names the
microphone, so today every track checked is `audio`.

**Room** (`CallsModeWatch`, one per room instance, memory only): `note()` on each relayed `avatar-voice` or
`call-track` op. It returns at once inside `CALLS_MODE_CACHE_MS` of its last read; otherwise it reads `callsMode` and,
when the answer differs from the mode it last told (starting from `on`), remembers it and broadcasts
`{ kind: 'op', from: 'system', op: { kind: 'calls-mode', mode } }` to every socket. A failed read is the read's own
(`callsMode` never throws). Hibernation forgets the watch: the next call op starts it again from `on`. A
`calls-check` op (`parseCallsCheck`, `@livehuddle/api-schema` `call-voice.ts`) is gated like `avatar-voice` (dropped
from a Viewer or malformed, `room-op-gate.ts`), then noted and never relayed.

**Editor**:

- `CallSelf.mode` (default `on`) is set from `/api/capabilities` (`callsMode`), from a session's answer, from the
  room's `calls-mode` op (only `from: 'system'`) and from a `paused` refusal.
- `ProximityCall` subscribes to `onCallsMode`; a mode that no longer allows a `session`, or a `calls_off` `paused`
  refusal from any route (session, publish, subscribe), ends the call (`pause()`): the same teardown as Leave Audio,
  then phase `off` with mode `off`.
- `ProximityCall` keeps when it last sent the room anything; a `CALLS_CHECK_MS` (5 s) interval, running while the call
  is live and publishes a microphone, camera or screen, sends `{ kind: 'calls-check' }` when nothing went for that
  long. Teardown clears it.
- `CallClusterButton` shows **Calls Paused** whenever the phase is `off` and the mode is `off`; pressing it runs
  `join`, which tries a session. A stopped call (`ended`) never blocks a fresh join.
- An `aria-live="polite"` region in the control says "Calls are paused" when the paused state appears.

**Errors and edge cases**: KV unreadable, the last mode stands (`callsMode`); a forged `calls-mode` op from a client
is dropped by the room's system-op rule and ignored by the editor unless `from` is `system`; a `calls-mode` op with
an unknown mode is ignored (`parseCallsModeOp`); a pause arriving while joining ends the join the same way.

**Performance**: the room's watch is one number compare per call op inside the window, and at most one KV read per
5 s per isolate outside it (`callsMode`'s cache). A silent publisher adds one inbound socket message per 5 s (about
36 billed requests an hour at the 20 to 1 rate), consumed with that same compare; a talking one adds none. Capabilities add the same cached read per page load. The editor's
store adds one listener set; the paused control is the same `Segment` as Join Audio.

**Testing**:

| Rule                                                                                                  | Test                                                      |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Mode table per kind; track kinds; the push op's parser                                                | `../packages/api-schema/src/calls-mode.test.ts`           |
| Gate: production before secrets before the switch; open carries mode                                  | `apps/api/src/calls/calls-gate.test.ts`                   |
| Routes: session, publish, subscribe, renegotiate refused when off; close allowed; mode on the session | `apps/api/src/routes/calls.test.ts`                       |
| Watch: throttled, tells changes only, from `on`                                                       | `apps/api/src/calls/calls-mode-watch.test.ts`             |
| Capabilities: enabled while paused, mode answered                                                     | `apps/api/src/routes/capabilities.test.ts`                |
| Room drops a client's `calls-mode` op; drops a Viewer's or malformed `calls-check`                    | `apps/api/src/room-op-gate.test.ts`                       |
| A `calls-check` reads the switch, tells everyone, and is never relayed                                | `apps/api/src/document-room-fanout.test.ts`               |
| Store: push sets the mode, only from the system                                                       | `apps/editor/lib/calls/calls-store.test.ts`               |
| Call: a push or a paused refusal ends it into the paused state                                        | `apps/editor/lib/calls/proximity-call.test.ts`            |
| Call: a silent publisher checks every 5 s, a talking one never; a flip lands within one check         | `apps/editor/lib/calls/proximity-call.test.ts`            |
| Button: Calls Paused, press tries again                                                               | `apps/editor/components/calls/CallClusterButton.test.tsx` |
