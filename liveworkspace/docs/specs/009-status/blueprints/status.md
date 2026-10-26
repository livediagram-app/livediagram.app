# Status history: blueprint

Derived from [status.md](../status.md). The spec decides; this file only adds engineering precision, read from the code. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md). Paths are relative to the repository root.

## Domain and naming

| Term     | Identifier                                      | Meaning                                                        |
| -------- | ----------------------------------------------- | -------------------------------------------------------------- |
| Run      | the `7 * * * *` cron                            | One pass over every check                                      |
| Check    | a `liveworkspace/packages/status` service entry | One service's answer: up, degraded or down, with code and time |
| Daily    | `daily` row                                     | One service's day                                              |
| Incident | `incidents` row                                 | A run of failed checks                                         |
| Snapshot | `snapshots` rows `latest` and `history`         | The read API's two answers, rebuilt every run                  |

## Behaviour and state

Each hour the run checks every service (at most six at a time), writes the checks, the day and the incidents,
prunes past 90 days and replaces the two `snapshots` rows the read API serves.

## Interfaces and contracts

`GET /api/status` (the latest run) and `GET /api/status/history` (90 days), public, cached 2 minutes. In
production the run reaches livediagram's router and MCP over service bindings.

Every route the specs name, with the section that defines it (each checked to have its path's literal in the code):

| Route                             | Specified in                                                        |
| --------------------------------- | ------------------------------------------------------------------- |
| `GET /api/status`                 | [status.md "The read API"](../../009-status/status.md#the-read-api) |
| `GET /api/status/history?days=90` | [status.md "The read API"](../../009-status/status.md#the-read-api) |

## Security and trust

Reads are anonymous and read one stored row. The Worker holds no secret; `PLATFORM_ORIGIN` names what it checks.

## Performance and limits

Measured in [status.md "Performance"](../status.md#performance): 27 subrequests and about 110 rows written a run;
the worst-case history stays under 24 KB.

## Observability

Every log line the service writes, by its fingerprint (the first literal of the call; `…` marks an interpolation):

| Level   | Fingerprint                   | Where      |
| ------- | ----------------------------- | ---------- |
| `log`   | `run:`                        | `index.ts` |
| `error` | `status cache put failed`     | `api.ts`   |
| `error` | `status run failed`           | `index.ts` |
| `error` | `status snapshot read failed` | `api.ts`   |

## Files

| File                                            | Role                                                                                                                                                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/status/src/api.ts`          | The read API (liveworkspace/docs/specs/009-status/status.md "The read API"): GET /api/status and /api/status/history?days=, public, anonymous and cacheable                                                 |
| `liveworkspace/apps/status/src/config.ts`       | The Worker's settings                                                                                                                                                                                       |
| `liveworkspace/apps/status/src/env.ts`          |                                                                                                                                                                                                             |
| `liveworkspace/apps/status/src/incidents.ts`    | Incidents (liveworkspace/docs/specs/009-status/status.md "The hourly run"): outages only                                                                                                                    |
| `liveworkspace/apps/status/src/index.ts`        | liveworkspace status (liveworkspace/docs/specs/009-status/status.md): every service, liveworkspace's own and each app's, checked once an hour from Cloudflare and kept for 90 days                          |
| `liveworkspace/apps/status/src/probe.ts`        | Checking every service from the Worker (liveworkspace/docs/specs/009-status/status.md "The hourly run"): each probe of the shared list, with a timeout, judged by the same rules as the pag…                |
| `liveworkspace/apps/status/src/rollup.ts`       | A service's day, from its checks (liveworkspace/docs/specs/009-status/status.md "The hourly run"): how many, how many up, slow and down, the median and 95th percentile answer time, and th…                |
| `liveworkspace/apps/status/src/run.ts`          | One hourly run (liveworkspace/docs/specs/009-status/status.md "The hourly run"): check every service, then one D1 read batch (today's checks so far, the open incidents, the window's days …                |
| `liveworkspace/apps/status/src/snapshot.ts`     | The read API's two answers (liveworkspace/docs/specs/009-status/status.md "The read API"), built once a run from what it stored, so a read is one row                                                       |
| `liveworkspace/packages/status/src/index.ts`    | wire shapes (liveworkspace/docs/specs/009-status/status.md).                                                                                                                                                |
| `liveworkspace/packages/status/src/judge.ts`    | How an answer is judged (liveworkspace/docs/specs/010-site/site.md "Status", liveworkspace/docs/specs/009-status/status.md "The hourly run"): the same rules in the visitor's browser and in the status Wo… |
| `liveworkspace/packages/status/src/services.ts` | What the status page checks (liveworkspace/docs/specs/010-site/site.md "Status") and the status Worker checks every hour (liveworkspace/docs/specs/009-status/status.md): liveworkspace's shared services,… |
| `liveworkspace/packages/status/src/wire.ts`     | The status Worker's read API, as it goes over the wire (liveworkspace/docs/specs/009-status/status.md "The read API"): compact on purpose, since the page reads every service's 90 days in …                |

## Constants and configuration: the Worker

`liveworkspace/apps/status/wrangler.toml`, account `851be7d244b76a6557bcbe6c4ded80f5`, main `src/index.ts`, compatibility date `2026-05-29`.

**Production**

| Setting                        | Value                                           |
| ------------------------------ | ----------------------------------------------- |
| Worker name                    | `liveworkspace-status`                          |
| Route                          | `liveworkspace.app/api/status*`                 |
| D1 `STATUS_DB`                 | `liveworkspace-status`, migrations `migrations` |
| Service `LIVEDIAGRAM_ROUTER`   | `livediagram-router`                            |
| Service `LIVEDIAGRAM_MCP`      | `livediagram-mcp`                               |
| Rate limit `READ_RATE_LIMITER` | 60 per 60 s                                     |
| Crons                          | `7 * * * *`                                     |
| Var `ENVIRONMENT`              | `production`                                    |
| Var `PLATFORM_ORIGIN`          | `https://liveworkspace.app`                     |

**`env.staging`**

| Setting                        | Value                                                   |
| ------------------------------ | ------------------------------------------------------- |
| Worker name                    | `liveworkspace-status-staging`                          |
| Route                          | `staging.liveworkspace.app/api/status*`                 |
| D1 `STATUS_DB`                 | `liveworkspace-status-staging`, migrations `migrations` |
| Service `LIVEDIAGRAM_ROUTER`   | `livediagram-router-staging`                            |
| Rate limit `READ_RATE_LIMITER` | 60 per 60 s                                             |
| Crons                          | `7 * * * *`                                             |
| Var `ENVIRONMENT`              | `staging`                                               |
| Var `PLATFORM_ORIGIN`          | `https://staging.liveworkspace.app`                     |

Env fields (`env.ts`): `ENVIRONMENT`, `PLATFORM_ORIGIN`.

## Data and persistence

Migrations, in order:

- `0001_status.sql`

| Table       | Columns                                                                | Created in        |
| ----------- | ---------------------------------------------------------------------- | ----------------- |
| `checks`    | `at`, `service`, `state`, `code`, `ms`, `error`                        | `0001_status.sql` |
| `daily`     | `day`, `service`, `up`, `slow`, `down`, `p50`, `p95`, `worst`          | `0001_status.sql` |
| `incidents` | `id`, `service`, `started_at`, `last_at`, `ended_at`, `worst`, `error` | `0001_status.sql` |
| `snapshots` | `key`, `at`, `body`                                                    | `0001_status.sql` |

## Constants and configuration: named constants

| Constant              | Value                                                          | File        |
| --------------------- | -------------------------------------------------------------- | ----------- |
| `DAY_MS`              | `86_400_000`                                                   | `config.ts` |
| `RETENTION_DAYS`      | `90`                                                           | `config.ts` |
| `RETENTION_MS`        | `RETENTION_DAYS * DAY_MS`                                      | `config.ts` |
| `PROBE_CONCURRENCY`   | `6`                                                            | `config.ts` |
| `CACHE_SECONDS`       | `120`                                                          | `config.ts` |
| `USER_AGENT`          | `'liveworkspace-status/1 (+https://liveworkspace.app/status)'` | `config.ts` |
| `SLOW_MS`             | `1500`                                                         | `judge.ts`  |
| `TIMEOUT_MS`          | `10_000`                                                       | `judge.ts`  |
| `STATUS_API_PATH`     | `'/api/status'`                                                | `wire.ts`   |
| `STATUS_HISTORY_PATH` | `'/history'`                                                   | `wire.ts`   |
| `HISTORY_DAYS`        | `90`                                                           | `wire.ts`   |
| `INCIDENTS_MAX`       | `50`                                                           | `wire.ts`   |
| `LETTER`              | `{ up: 'u', slow: 's', down: 'd' }`                            | `wire.ts`   |
| `STATE_OF_LETTER`     | `(object or list, see file)`                                   | `wire.ts`   |

## Testing

7 test files:

- `liveworkspace/apps/status/src/api.test.ts`
- `liveworkspace/apps/status/src/probe.test.ts`
- `liveworkspace/apps/status/src/rollup.test.ts`
- `liveworkspace/apps/status/src/run.test.ts`
- `liveworkspace/packages/status/src/judge.test.ts`
- `liveworkspace/packages/status/src/services.test.ts`
- `liveworkspace/packages/status/src/wire.test.ts`
