# Telemetry blueprint defaults

One row per default applied where a spec is silent or qualitative. Rows that name a constant are read from the code: the spec gives no value, the code's is the default.

| #   | Blueprint | Spec silence                                  | Default applied                                                             |
| --- | --------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| D1  | telemetry | No value given for `RETENTION_MS`             | `60 * DAY_MS` (`config.ts`)                                                 |
| D2  | telemetry | No value given for `TELEMETRY_FLUSH_DELAY_MS` | `10_000` (`emitter.ts`)                                                     |
| D3  | telemetry | No value given for `TELEMETRY_MAX_BUFFER`     | `25` (`emitter.ts`)                                                         |
| D4  | telemetry | No value given for `TEAM_ITEM_TYPES`          | `['Project', 'Design', 'Document'] as const` (`explorer-events.ts`)         |
| D5  | telemetry | No value given for `TELEMETRY_ON`             | `{ TELEMETRY_ENABLED: 'true', TELEMETRY_KEY: 'k' } as const` (`testing.ts`) |
| D6  | telemetry | No value given for `TELEMETRY_TYPE_PATTERN`   | `/^[A-Za-z0-9 ._-]{1,40}$/` (`wire.ts`)                                     |
| D7  | telemetry | No value given for `ERROR_EMIT_CAP_PER_TYPE`  | `10` (`errors.ts`)                                                          |
