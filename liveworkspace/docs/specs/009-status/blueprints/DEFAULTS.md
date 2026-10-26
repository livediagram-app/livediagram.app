# Status blueprint defaults

One row per default applied where a spec is silent or qualitative. Rows that name a constant are read from the code: the spec gives no value, the code's is the default.

| #   | Blueprint | Spec silence                           | Default applied                                                              |
| --- | --------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| D1  | status    | No value given for `DAY_MS`            | `86_400_000` (`config.ts`)                                                   |
| D2  | status    | No value given for `RETENTION_DAYS`    | `90` (`config.ts`)                                                           |
| D3  | status    | No value given for `RETENTION_MS`      | `RETENTION_DAYS * DAY_MS` (`config.ts`)                                      |
| D4  | status    | No value given for `PROBE_CONCURRENCY` | `6` (`config.ts`)                                                            |
| D5  | status    | No value given for `USER_AGENT`        | `'liveworkspace-status/1 (+https://liveworkspace.app/status)'` (`config.ts`) |
| D6  | status    | No value given for `SLOW_MS`           | `1500` (`judge.ts`)                                                          |
| D7  | status    | No value given for `TIMEOUT_MS`        | `10_000` (`judge.ts`)                                                        |
| D8  | status    | No value given for `HISTORY_DAYS`      | `90` (`wire.ts`)                                                             |
| D9  | status    | No value given for `INCIDENTS_MAX`     | `50` (`wire.ts`)                                                             |
| D10 | status    | No value given for `LETTER`            | `{ up: 'u', slow: 's', down: 'd' }` (`wire.ts`)                              |
