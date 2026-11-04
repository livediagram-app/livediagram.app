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
| Cost        | `realtimeCostUsd(bytes)`                     | `max(0, GB − 1,000) × $0.05`                                     |
| Thresholds  | `budgetThresholds(env)`                      | `{ audioOnlyAtUsd, offAtUsd }` from vars, defaults 10 and 25     |
| Level       | `budgetLevel(costUsd, thresholds)`           | `'none' \| 'audio-only' \| 'off'` the cost has reached           |
| Usage       | `fetchRealtimeEgressBytes(...)`              | One GraphQL request: SFU plus TURN egress bytes for the month    |
| Poll        | `pollCallsBudget(env, now)`                  | The scheduled run: price, trip, record, email                    |

## Modules

| File                                   | Responsibility                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `apps/api/src/calls/calls-mode.ts`     | The modes, `callsMode`, its cache, `parseCallsMode`, `stricterCallsMode`, `callsModeAllows` |
| `apps/api/src/calls/realtime-usage.ts` | `fetchRealtimeEgressBytes`, `monthStartUtc`, `realtimeCostUsd`                              |
| `apps/api/src/calls/calls-budget.ts`   | `budgetThresholds`, `budgetLevel`, `pollCallsBudget` and the trip record                    |
| `apps/api/src/email/templates.ts`      | `callsBudgetEmail`, kind `CallsBudget`                                                      |
| `apps/api/src/index.ts`                | The worker's `scheduled` handler runs `pollCallsBudget`                                     |
| `apps/api/src/types.ts`                | `CALLS_SWITCH`, the `CALLS_*` vars and secrets on `Env`                                     |
| `apps/api/wrangler.toml`               | The cron, the thresholds, the account id and the (owner-created) KV binding                 |

Part 2 imports `callsMode` and `callsModeAllows` from `apps/api/src/calls/calls-mode.ts`; nothing else calls them in
part 1.

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
