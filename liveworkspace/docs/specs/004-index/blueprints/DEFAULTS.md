# Index blueprint defaults

One row per default applied where a spec is silent or qualitative. Rows that name a constant are read from the code: the spec gives no value, the code's is the default.

| #   | Blueprint | Spec silence                                       | Default applied                                                                           |
| --- | --------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| D1  | index     | No value given for `LINGER_MS`                     | `2 * 60 * 60 * 1000` (`account-purge.ts`)                                                 |
| D2  | index     | No value given for `FREQUENT_CRON`                 | `'*/15 * * * *'` (`account-purge.ts`)                                                     |
| D3  | index     | No value given for `TOMBSTONE_RETRY_AFTER_MS`      | `60 * 60 * 1000` (`account-purge.ts`)                                                     |
| D4  | index     | No value given for `CALL_BUDGET`                   | `{ ms: 5_000, calls: 300 }` (`account-purge.ts`)                                          |
| D5  | index     | No value given for `CRON_BUDGET`                   | `{ ms: 30_000, calls: 300 }` (`account-purge.ts`)                                         |
| D6  | index     | No value given for `SHARE_CODE_LENGTH`             | `14` (`codec.ts`)                                                                         |
| D7  | index     | No value given for `D1_COMPOUND_MAX`               | `5` (`compound.ts`)                                                                       |
| D8  | index     | No value given for `API_PATH`                      | `INDEX_API_PATH` (`config.ts`)                                                            |
| D9  | index     | No value given for `MAX_BODY_BYTES`                | `512 * 1024` (`config.ts`)                                                                |
| D10 | index     | No value given for `PURGE_NOW_MAX`                 | `25` (`config.ts`)                                                                        |
| D11 | index     | No value given for `APP_CALL_CONCURRENCY`          | `6` (`config.ts`)                                                                         |
| D12 | index     | No value given for `APP_CALL_TIMEOUT_MS`           | `10_000` (`config.ts`)                                                                    |
| D13 | index     | No value given for `HANDOFF_MAX_BYTES`             | `32 * 1024 * 1024` (`config.ts`)                                                          |
| D14 | index     | No value given for `HANDOFF_APP_TIMEOUT_MS`        | `30_000` (`config.ts`)                                                                    |
| D15 | index     | No value given for `OPEN_MEMORY_MAX`               | `5_000` (`config.ts`)                                                                     |
| D16 | index     | No value given for `PASSWORD_MEMORY_MAX`           | `1_000` (`config.ts`)                                                                     |
| D17 | index     | No value given for `SHARE_GUESS_RETRY_AFTER_S`     | `60` (`config.ts`)                                                                        |
| D18 | index     | No value given for `SHARE_PASSWORD_ITERATIONS`     | `100_000` (`password-hash.ts`)                                                            |
| D19 | index     | No value given for `NOTICE_RETRY_AFTER_MS`         | `60 * 60 * 1000` (`person-notices.ts`)                                                    |
| D20 | index     | No value given for `NOTICE_GIVE_UP_MS`             | `7 * 24 * 60 * 60 * 1000` (`person-notices.ts`)                                           |
| D21 | index     | No value given for `ITEM_COLUMNS`                  | `'i.id, i.app, i.kind, i.owner_id, i.team_id, i.scope, i.fold…` (`rows.ts`)               |
| D22 | index     | No value given for `LIVE_LINK`                     | `(alias: string) =>` (`rows.ts`)                                                          |
| D23 | index     | No value given for `EXPIRY_SWEEP_MAX`              | `2_000` (`share-expiry.ts`)                                                               |
| D24 | index     | No value given for `FUTURE_SLACK_MS`               | `5 * 60 * 1000` (`timeline.ts`)                                                           |
| D25 | index     | No value given for `WORKBENCH_CLOSE_CONCURRENCY`   | `10` (`workbench-close.ts`)                                                               |
| D26 | index     | No value given for `GUEST_TOKEN_REFRESH_BEFORE_MS` | `30 * 24 * 3600 * 1000` (`guest-token.ts`)                                                |
| D27 | index     | No value given for `GUEST_HANDOFF_BACKOFF_MS`      | `5 * 60_000` (`guest-token.ts`)                                                           |
| D28 | index     | No value given for `GRANT_RENEW_BEFORE_MS`         | `60_000` (`item-grants.ts`)                                                               |
| D29 | index     | No value given for `GRANT_REFUSAL_MEMORY_MS`       | `30_000` (`item-grants.ts`)                                                               |
| D30 | index     | No value given for `GRANT_RETRY_MS`                | `15_000` (`item-grants.ts`)                                                               |
| D31 | index     | No value given for `GRANTS_HELD_MAX`               | `32` (`item-grants.ts`)                                                                   |
| D32 | index     | No value given for `APPS`                          | `['livediagram', 'liveplanner', 'livedocuments', 'livedesign'] as const` (`constants.ts`) |
| D33 | index     | No value given for `LEVELS`                        | `['view', 'participate', 'edit'] as const` (`constants.ts`)                               |
| D34 | index     | No value given for `FOLDER_PREVIEW_IDS_MAX`        | `60` (`constants.ts`)                                                                     |
| D35 | index     | No value given for `FOLDER_PREVIEW_ITEMS`          | `4` (`constants.ts`)                                                                      |
| D36 | index     | No value given for `INDEX_API_URL`                 | `https://liveworkspace.app${INDEX_API_PATH}` (`constants.ts`)                             |
| D37 | index     | No value given for `DELEGATED_TEAMS_MAX`           | `50` (`constants.ts`)                                                                     |
| D38 | index     | No value given for `GRANT_LIFETIME_S`              | `600` (`constants.ts`)                                                                    |
| D39 | index     | No value given for `GRANT_RENEW_BEFORE_S`          | `60` (`constants.ts`)                                                                     |
| D40 | index     | No value given for `GRANT_ISSUER`                  | `INDEX_API_URL` (`constants.ts`)                                                          |
| D41 | index     | No value given for `GRANT_JWKS_URL`                | `${INDEX_API_URL}/jwks` (`constants.ts`)                                                  |
| D42 | index     | No value given for `LIST_LIMIT_DEFAULT`            | `50` (`constants.ts`)                                                                     |
| D43 | index     | No value given for `SUMMARY_MAX_BYTES`             | `2048` (`constants.ts`)                                                                   |
| D44 | index     | No value given for `SEARCH_WORDS_MAX`              | `16` (`constants.ts`)                                                                     |
| D45 | index     | No value given for `FILTER_VALUES_MAX`             | `8` (`constants.ts`)                                                                      |
| D46 | index     | No value given for `INTENT_WORD`                   | `/^[a-z0-9-]{1,32}$/` (`constants.ts`)                                                    |
| D47 | index     | No value given for `ITEM_OWNERS`                   | `['me', 'others'] as const` (`constants.ts`)                                              |
| D48 | index     | No value given for `TRASH_RETENTION_MS`            | `30 * 24 * 60 * 60 * 1000` (`constants.ts`)                                               |
| D49 | index     | No value given for `EMPTY_ITEM_STALE_MS`           | `30 * 24 * 60 * 60 * 1000` (`constants.ts`)                                               |
| D50 | index     | No value given for `OPEN_DEBOUNCE_MS`              | `60 * 1000` (`constants.ts`)                                                              |
| D51 | index     | No value given for `USE_WINDOW_DAYS`               | `90` (`constants.ts`)                                                                     |
| D52 | index     | No value given for `MOST_USED_MAX`                 | `8` (`constants.ts`)                                                                      |
| D53 | index     | No value given for `PERSON_TIMELINE_EVENT_TYPES`   | `['image_uploaded', 'taken_offline'] as const` (`constants.ts`)                           |
| D54 | index     | No value given for `APP_TIMELINE_EVENT_TYPES`      | `['edited'] as const` (`constants.ts`)                                                    |
| D55 | index     | No value given for `APP_PERSON_EVENT_TYPES`        | `['image_uploaded'] as const` (`constants.ts`)                                            |
| D56 | index     | No value given for `ACCOUNT_EVENT_AHEAD_MS`        | `8 * 24 * 60 * 60 * 1000` (`constants.ts`)                                                |
| D57 | index     | No value given for `TIMELINE_PAGE`                 | `30` (`constants.ts`)                                                                     |
| D58 | index     | No value given for `ITEM_SOURCES`                  | `['person', 'ai', 'import', 'template'] as const` (`constants.ts`)                        |
| D59 | index     | No value given for `FORM_PLACE_TTL_MS`             | `60_000` (`forms.ts`)                                                                     |
| D60 | index     | No value given for `FORM_PLACE_CACHE_MAX`          | `1_000` (`forms.ts`)                                                                      |
| D61 | index     | No value given for `EXPORT_FORMATS`                | `['svg', 'file'] as const` (`internal.ts`)                                                |
| D62 | index     | No value given for `IMPORT_MAX_BYTES`              | `32 * 1024 * 1024` (`internal.ts`)                                                        |
| D63 | index     | No value given for `MIGRATION_MAX_BYTES`           | `IMPORT_MAX_BYTES` (`internal.ts`)                                                        |
| D64 | index     | No value given for `LIST_PAGES`                    | `5` (`lists.ts`)                                                                          |
| D65 | index     | No value given for `NOTIFY_QUOTA_KIND`             | `'notify-email'` (`notify-claims.ts`)                                                     |
| D66 | index     | No value given for `FLUSH_IDLE_MS`                 | `2_000` (`outbox.ts`)                                                                     |
| D67 | index     | No value given for `FLUSH_MIN_GAP_MS`              | `60_000` (`outbox.ts`)                                                                    |
| D68 | index     | No value given for `FLUSH_RETRY_MS`                | `60_000` (`outbox.ts`)                                                                    |
| D69 | index     | No value given for `DRAIN_TABS`                    | `50` (`outbox.ts`)                                                                        |
| D70 | index     | No value given for `PUSH_CONCURRENCY`              | `6` (`outbox.ts`)                                                                         |
| D71 | index     | No value given for `ROOM_PURGE_TIMEOUT_MS`         | `3_000` (`purge.ts`)                                                                      |
| D72 | index     | No value given for `ROOM_PURGE_CONCURRENCY`        | `10` (`purge.ts`)                                                                         |
| D73 | index     | No value given for `ROOM_GRANT_MAX_LENGTH`         | `8192` (`room-ticket.ts`)                                                                 |
| D74 | index     | No value given for `MAX_TAB_HOLDERS`               | `20` (`tab-shares.ts`)                                                                    |
| D75 | index     | No value given for `DRAIN_SHARES`                  | `50` (`tab-shares.ts`)                                                                    |
| D76 | index     | No value given for `MISS_RECHECK_MS`               | `2_000` (`teams.ts`)                                                                      |
| D77 | index     | No value given for `FRESH_TEAMS_MS`                | `30_000` (`teams.ts`)                                                                     |
| D78 | index     | No value given for `TEAM_NAME_MAX`                 | `80` (`teams.ts`)                                                                         |
| D79 | index     | No value given for `TEAM_ORGANISATION_MAX`         | `80` (`teams.ts`)                                                                         |
