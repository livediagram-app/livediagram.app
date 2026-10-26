# Workbench blueprint defaults

One row per default applied where a spec is silent or qualitative. Rows that name a constant are read from the code: the spec gives no value, the code's is the default.

| #   | Blueprint | Spec silence                                        | Default applied                                        |
| --- | --------- | --------------------------------------------------- | ------------------------------------------------------ |
| D1  | workbench | No value given for `WORKBENCH_TICKET_TTL_MS`        | `60_000` (`routes.ts`)                                 |
| D2  | workbench | No value given for `WORKBENCH_NAME_MAX_LENGTH`      | `40` (`routes.ts`)                                     |
| D3  | workbench | No value given for `WORKBENCH_ORIGIN_MAX_LENGTH`    | `255` (`routes.ts`)                                    |
| D4  | workbench | No value given for `WORKBENCH_POLL_INTERVAL_S`      | `5` (`routes.ts`)                                      |
| D5  | workbench | No value given for `WORKBENCH_TICKET_BYTES`         | `16` (`store.ts`)                                      |
| D6  | workbench | No value given for `WORKBENCH_PAIRING_CODE_BYTES`   | `16` (`store.ts`)                                      |
| D7  | workbench | No value given for `WORKBENCH_SESSION_SECRET_BYTES` | `32` (`store.ts`)                                      |
| D8  | workbench | No value given for `WORKBENCH_PAIRING_TTL_MS`       | `10 * 60 * 1000` (`store.ts`)                          |
| D9  | workbench | No value given for `WORKBENCH_SESSION_GRACE_MS`     | `24 * 60 * 60 * 1000` (`store.ts`)                     |
| D10 | workbench | No value given for `WORKBENCH_QUOTA_MAX`            | `1_000` (`store.ts`)                                   |
| D11 | workbench | No value given for `WORKBENCH_SESSION_ROOMS_MAX`    | `500` (`store.ts`)                                     |
| D12 | workbench | No value given for `WORKBENCH_TICKET_PATTERN`       | `/^[A-Za-z0-9_-]{22}\.[0-9a-f]{64}$/` (`store.ts`)     |
| D13 | workbench | No value given for `WORKBENCH_SESSION_PATTERN`      | `/^lvw_[A-Za-z0-9_-]{43}\.[0-9a-f]{64}$/` (`store.ts`) |
| D14 | workbench | No value given for `WORKBENCH_CODE_PATTERN`         | `/^[A-Za-z0-9_-]{22}$/` (`store.ts`)                   |
