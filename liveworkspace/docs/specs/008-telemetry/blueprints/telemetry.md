# Telemetry: blueprint

Derived from [telemetry.md](../telemetry.md). The spec decides; this file only adds engineering precision, read from the code. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md). Paths are relative to the repository root.

## Domain and naming

| Term  | Identifier                   | Meaning                                           |
| ----- | ---------------------------- | ------------------------------------------------- |
| Event | `events` row                 | A category, an action and a count, never a person |
| Batch | `POST /api/telemetry/events` | At most 100 events, answered `204` always         |
| App   | `TELEMETRY_KEY_<APP>`        | Who may send server-side events                   |

## Behaviour and state

One cron, `17 3 * * *`, deletes events older than `RETENTION_MS` and logs `{ sweep: 'events', rows }`.

## Interfaces and contracts

Browsers post `text/plain` batches with no cookies, accepted only from the app's own origins; Workers post with
`TELEMETRY_KEY_<APP>`. The dashboard reads the summary.

Every route the specs name, with the section that defines it (each checked to have its path's literal in the code):

| Route                                                            | Specified in                                                                     |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `POST /api/events`                                               | [telemetry.md "Sending events"](../../008-telemetry/telemetry.md#sending-events) |
| `GET /api/telemetry/summary?app=all\|<an app in TELEMETRY_APPS>` | [telemetry.md "The dashboard"](../../008-telemetry/telemetry.md#the-dashboard)   |

## Security and trust

No address or person is stored. Browser batches are limited per network (120 a minute, `clientRateKey`). Secrets are set once per Worker and environment with `wrangler secret put` and survive every deploy; the
`Env fields` line under the Worker's configuration below lists every name the Worker reads, vars and secrets
together (a name not in a `[vars]` table is a secret). App keys are compared in constant time, and each key speaks
only for its own app.

## Performance and limits

The figures are in [telemetry.md "Performance"](../telemetry.md#performance).

## Observability

Every log line the service writes, by its fingerprint (the first literal of the call; `…` marks an interpolation):

| Level   | Fingerprint                | Where        |
| ------- | -------------------------- | ------------ |
| `error` | `events sweep failed`      | `index.ts`   |
| `error` | `summary cache put failed` | `summary.ts` |
| `log`   | `sweep:`                   | `index.ts`   |

## Files

| File                                               | Role                                                                                                                                                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/telemetry/src/config.ts`       | The Worker's settings                                                                                                                                                                           |
| `liveworkspace/apps/telemetry/src/db.ts`           |                                                                                                                                                                                                 |
| `liveworkspace/apps/telemetry/src/env.ts`          |                                                                                                                                                                                                 |
| `liveworkspace/apps/telemetry/src/index.ts`        | liveworkspace telemetry (liveworkspace/docs/specs/008-telemetry/telemetry.md): one Worker for every app's anonymous events                                                                      |
| `liveworkspace/apps/telemetry/src/ingest.ts`       | POST /api/telemetry/events: every app's anonymous events (liveworkspace/docs/specs/008-telemetry/telemetry.md "Sending events")                                                                 |
| `liveworkspace/apps/telemetry/src/summary.ts`      | GET /api/telemetry/summary?app=…: the dashboard's numbers (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard"), for one app or, with app=all or no app, for every app          |
| `liveworkspace/apps/telemetry/src/vocabularies.ts` | Each app's closed event vocabulary, as that app defines it (its own api-schema): the service stores only events its app could have sent                                                         |
| `packages/telemetry/src/apps.ts`                   | The apps that send telemetry to liveworkspace (liveworkspace/docs/specs/008-telemetry/telemetry.md)                                                                                             |
| `packages/telemetry/src/emitter.ts`                | The browser's batching emitter (liveworkspace/docs/specs/008-telemetry/telemetry.md "Sending events"), one engine for every sender: each app's `@<app>/telemetry-client` wraps it with its own… |
| `packages/telemetry/src/error-tokens.ts`           | Error telemetry tokens (docs/specs/017-telemetry/telemetry.md 'Error' category): how every error source says WHERE it failed inside the one `type` token it has, for every…                     |
| `packages/telemetry/src/explorer-events.ts`        | The Explorer's events (liveworkspace/docs/specs/008-telemetry/telemetry.md "The Explorer on liveworkspace.app"): what the one Explorer page on liveworkspace.app may report, in the name of th… |
| `packages/telemetry/src/index.ts`                  | The liveworkspace telemetry contract (liveworkspace/docs/specs/008-telemetry/telemetry.md): which apps send events, what a batch looks like, the dashboard's summary, and the Explorer's event… |
| `packages/telemetry/src/server.ts`                 | What an app's api Worker sends the central ingest itself (liveworkspace/docs/specs/008-telemetry/telemetry.md "Sending events").                                                                |
| `packages/telemetry/src/summary.ts`                | The dashboard's data (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard"): grouped counts for three FIXED windows and a 30-day daily series, for one app or for every app      |
| `packages/telemetry/src/testing.ts`                | Tests' view of the central telemetry service: stubs the global fetch, keeps the events of every batch posted to its events path and answers 204. Pair with TELEMETRY_ON in…                     |
| `packages/telemetry/src/wire.ts`                   | What an app sends the central ingest (liveworkspace/docs/specs/008-telemetry/telemetry.md "Sending events").                                                                                    |
| `packages/telemetry-client/src/daily-return.ts`    | The once-per-UTC-day "returning visitor" gate (a product's docs/specs/017-telemetry/telemetry.md, `Participant·Returned`), shared by every editor and by liveworkspace's E…                     |
| `packages/telemetry-client/src/errors.ts`          | Client error tracking (a product's docs/specs/017-telemetry/telemetry.md 'Error' category).                                                                                                     |
| `packages/telemetry-client/src/index.ts`           | The browser side of every product's telemetry (a product's docs/specs/017-telemetry/telemetry.md): three-field {category, action, type} events, batched to the liveworkspa…                     |
| `packages/telemetry-client/src/page-hide.ts`       | Run a callback when the page is being hidden or unloaded (docs/specs/017-telemetry/telemetry.md), BEFORE the telemetry engine's own page-hide flush sends its last batch.                       |
| `packages/telemetry-client/src/timing.ts`          | Timing telemetry (a product's docs/specs/017-telemetry/timing-telemetry.md): time a key moment of the experience and report it as `Timing·Measured·<Metric>.<Bucket>`                           |

## Constants and configuration: the Worker

`liveworkspace/apps/telemetry/wrangler.toml`, account `851be7d244b76a6557bcbe6c4ded80f5`, main `src/index.ts`, compatibility date `2026-05-29`.

**Production**

| Setting                          | Value                                              |
| -------------------------------- | -------------------------------------------------- |
| Worker name                      | `liveworkspace-telemetry`                          |
| Route                            | `liveworkspace.app/api/telemetry*`                 |
| D1 `TELEMETRY_DB`                | `liveworkspace-telemetry`, migrations `migrations` |
| Rate limit `EVENTS_RATE_LIMITER` | 120 per 60 s                                       |
| Crons                            | `17 3 * * *`                                       |
| Var `ENVIRONMENT`                | `production`                                       |
| Var `TELEMETRY_ENABLED`          | `true`                                             |

**`env.staging`**

| Setting                          | Value                                                      |
| -------------------------------- | ---------------------------------------------------------- |
| Worker name                      | `liveworkspace-telemetry-staging`                          |
| Route                            | `staging.liveworkspace.app/api/telemetry*`                 |
| D1 `TELEMETRY_DB`                | `liveworkspace-telemetry-staging`, migrations `migrations` |
| Rate limit `EVENTS_RATE_LIMITER` | 120 per 60 s                                               |
| Crons                            | `17 3 * * *`                                               |
| Var `ENVIRONMENT`                | `staging`                                                  |
| Var `TELEMETRY_ENABLED`          | `true`                                                     |

Env fields (`env.ts`): `ENVIRONMENT`, `TELEMETRY_ENABLED`, `TELEMETRY_KEY_LIVEDESIGN`, `TELEMETRY_KEY_LIVEDIAGRAM`, `TELEMETRY_KEY_LIVEDOCUMENTS`, `TELEMETRY_KEY_LIVEPLANNER`.

## Data and persistence

Migrations, in order:

- `0001_events.sql`

| Table    | Columns                                   | Created in        |
| -------- | ----------------------------------------- | ----------------- |
| `events` | `app`, `category`, `action`, `type`, `ts` | `0001_events.sql` |

## Constants and configuration: named constants

| Constant                     | Value                                                        | File                 |
| ---------------------------- | ------------------------------------------------------------ | -------------------- |
| `API_PATH`                   | `'/api/telemetry'`                                           | `config.ts`          |
| `RETENTION_MS`               | `60 * DAY_MS`                                                | `config.ts`          |
| `CORS`                       | `{ 'Access-Control-Allow-Origin': '*' }`                     | `config.ts`          |
| `VOCABULARIES`               | `(object or list, see file)`                                 | `vocabularies.ts`    |
| `TELEMETRY_APPS`             | `(object or list, see file)`                                 | `apps.ts`            |
| `ALL_TELEMETRY_APPS`         | `'all'`                                                      | `apps.ts`            |
| `TELEMETRY_APP_ORIGINS`      | `(object or list, see file)`                                 | `apps.ts`            |
| `PLATFORM_TELEMETRY_APP`     | `'liveworkspace.app'`                                        | `apps.ts`            |
| `TELEMETRY_SENDERS`          | `(object or list, see file)`                                 | `apps.ts`            |
| `PLATFORM_TELEMETRY_ORIGINS` | `(object or list, see file)`                                 | `apps.ts`            |
| `TELEMETRY_FLUSH_DELAY_MS`   | `10_000`                                                     | `emitter.ts`         |
| `TELEMETRY_MAX_BUFFER`       | `25`                                                         | `emitter.ts`         |
| `TEAM_ITEM_TYPES`            | `['Project', 'Design', 'Document'] as const`                 | `explorer-events.ts` |
| `EXPLORER_TELEMETRY_EVENTS`  | `(object or list, see file)`                                 | `explorer-events.ts` |
| `TELEMETRY_WINDOW_DAYS`      | `(object or list, see file)`                                 | `summary.ts`         |
| `TELEMETRY_ON`               | `{ TELEMETRY_ENABLED: 'true', TELEMETRY_KEY: 'k' } as const` | `testing.ts`         |
| `TELEMETRY_URL`              | `'https://liveworkspace.app/api/telemetry'`                  | `wire.ts`            |
| `TELEMETRY_DASHBOARD_URL`    | `'https://liveworkspace.app/telemetry'`                      | `wire.ts`            |
| `TELEMETRY_EVENTS_PATH`      | `'/events'`                                                  | `wire.ts`            |
| `TELEMETRY_SUMMARY_PATH`     | `'/summary'`                                                 | `wire.ts`            |
| `TELEMETRY_BATCH_MAX`        | `100`                                                        | `wire.ts`            |
| `TELEMETRY_KEY_HEADER`       | `'X-Telemetry-Key'`                                          | `wire.ts`            |
| `TELEMETRY_TYPE_PATTERN`     | `/^[A-Za-z0-9 ._-]{1,40}$/`                                  | `wire.ts`            |
| `ERROR_EMIT_CAP_PER_TYPE`    | `10`                                                         | `errors.ts`          |

## Testing

13 test files:

- `liveworkspace/apps/telemetry/src/env.test.ts`
- `liveworkspace/apps/telemetry/src/index.test.ts`
- `liveworkspace/apps/telemetry/src/ingest.test.ts`
- `packages/telemetry/src/apps.test.ts`
- `packages/telemetry/src/emitter.test.ts`
- `packages/telemetry/src/error-tokens.test.ts`
- `packages/telemetry/src/explorer-events.test.ts`
- `packages/telemetry/src/server.test.ts`
- `packages/telemetry/src/summary.test.ts`
- `packages/telemetry-client/src/daily-return.test.ts`
- `packages/telemetry-client/src/index.test.ts`
- `packages/telemetry-client/src/page-hide.test.ts`
- `packages/telemetry-client/src/timing.test.ts`
