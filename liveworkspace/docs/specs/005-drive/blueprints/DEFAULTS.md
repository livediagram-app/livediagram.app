# Drive blueprint defaults

One row per default applied where a spec is silent or qualitative. Rows that name a constant are read from the code: the spec gives no value, the code's is the default.

| #   | Blueprint | Spec silence                                              | Default applied                                             |
| --- | --------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| D1  | drive     | No value given for `DOOR_TIMEOUT_MS`                      | `20_000` (`app-doors.ts`)                                   |
| D2  | drive     | No value given for `NO_BACKOFF`                           | `{ level: 0, lastErrorAt: null }` (`backoff.ts`)            |
| D3  | drive     | No value given for `DRIVE_HELP_PATH`                      | `'/help/google-drive'` (`client.ts`)                        |
| D4  | drive     | No value given for `DRIVE_FOLDER_MIME`                    | `'application/vnd.google-apps.folder'` (`constants.ts`)     |
| D5  | drive     | No value given for `DRIVE_STATE_TTL_MS`                   | `10 * MINUTE` (`constants.ts`)                              |
| D6  | drive     | No value given for `DRIVE_ACCOUNT_SWITCH_TTL_MS`          | `30 * MINUTE` (`constants.ts`)                              |
| D7  | drive     | No value given for `DRIVE_ITEM_MIN_WRITE_INTERVAL_MAX_MS` | `30 * MINUTE` (`constants.ts`)                              |
| D8  | drive     | No value given for `DRIVE_FALLBACK_CHECK_WATCHED_MS`      | `6 * HOUR` (`constants.ts`)                                 |
| D9  | drive     | No value given for `DRIVE_FALLBACK_CHECK_MAX_MS`          | `6 * HOUR` (`constants.ts`)                                 |
| D10 | drive     | No value given for `DRIVE_CHECK_MIN_GAP_MS`               | `30 * SECOND` (`constants.ts`)                              |
| D11 | drive     | No value given for `DRIVE_CHANGES_PAGE_SIZE`              | `1000` (`constants.ts`)                                     |
| D12 | drive     | No value given for `DRIVE_BACKOFF_CALM_MS`                | `HOUR` (`constants.ts`)                                     |
| D13 | drive     | No value given for `DRIVE_BACKOFF_MAX_LEVEL`              | `5` (`constants.ts`)                                        |
| D14 | drive     | No value given for `DRIVE_TOKEN_RENEW_BEFORE_MS`          | `MINUTE` (`constants.ts`)                                   |
| D15 | drive     | No value given for `DRIVE_CHANNEL_TTL_MS`                 | `7 * 24 * HOUR` (`constants.ts`)                            |
| D16 | drive     | No value given for `DRIVE_CHANNEL_RENEW_BEFORE_MS`        | `24 * HOUR` (`constants.ts`)                                |
| D17 | drive     | No value given for `DRIVE_MULTIPART_MAX_BYTES`            | `5 * 1024 * 1024` (`constants.ts`)                          |
| D18 | drive     | No value given for `DRIVE_THUMBNAIL_MAX_BYTES`            | `2 * 1000 * 1000` (`constants.ts`)                          |
| D19 | drive     | No value given for `DRIVE_PICKER_TOKENS_PER_MINUTE`       | `10` (`constants.ts`)                                       |
| D20 | drive     | No value given for `GOOGLE_CALL_TIMEOUT_MS`               | `10 * SECOND` (`constants.ts`)                              |
| D21 | drive     | No value given for `DRIVE_NAME_MAX`                       | `1024` (`constants.ts`)                                     |
| D22 | drive     | No value given for `APP_NAMES`                            | `Object.keys(APP_FILE_FORMATS) as AppName[]` (`formats.ts`) |
