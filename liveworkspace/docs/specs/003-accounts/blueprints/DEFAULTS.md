# Accounts blueprint defaults

One row per default applied where a spec is silent or qualitative. Rows that name a constant are read from the code: the spec gives no value, the code's is the default.

| #   | Blueprint | Spec silence                                          | Default applied                                                           |
| --- | --------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| D1  | accounts  | No value given for `SEND_CODE_PATH`                   | `'/email-otp/send-verification-otp'` (`auth-options.ts`)                  |
| D2  | accounts  | No value given for `NAME_MAX_LENGTH`                  | `80` (`auth-options.ts`)                                                  |
| D3  | accounts  | No value given for `BENCH_ACCOUNTS_PATH`              | `${AUTH_BASE_PATH}/internal/bench-accounts` (`bench-accounts.ts`)         |
| D4  | accounts  | No value given for `CLIENTS_PATH`                     | `${AUTH_BASE_PATH}/internal/clients` (`clients.ts`)                       |
| D5  | accounts  | No value given for `MUTED`                            | `'#475569'` (`email-layout.ts`)                                           |
| D6  | accounts  | No value given for `GUEST_IDLE_MS`                    | `400 * DAY_MS` (`guest-sweep.ts`)                                         |
| D7  | accounts  | No value given for `GUEST_TOKEN_TTL_SECONDS`          | `365 * 24 * 60 * 60` (`guests.ts`)                                        |
| D8  | accounts  | No value given for `HANDOFF_TTL_SECONDS`              | `60` (`handoff.ts`)                                                       |
| D9  | accounts  | No value given for `HANDOFF_NONCE_MAX_AGE_SECONDS`    | `900` (`handoff.ts`)                                                      |
| D10 | accounts  | No value given for `USER_ID`                          | `/^user_[A-Za-z0-9]{1,64}$/` (`ids.ts`)                                   |
| D11 | accounts  | No value given for `PURGES_PER_RUN`                   | `25` (`index-purge.ts`)                                                   |
| D12 | accounts  | No value given for `TIMELINE_SCOPES_MAX`              | `250` (`index-timeline.ts`)                                               |
| D13 | accounts  | No value given for `TIMELINE_CALLS_PER_RUN`           | `10` (`index-timeline.ts`)                                                |
| D14 | accounts  | No value given for `TIMELINE_MAX_ATTEMPTS`            | `96` (`index-timeline.ts`)                                                |
| D15 | accounts  | No value given for `TIMELINE_OUTBOX_MAX`              | `5_000` (`index-timeline.ts`)                                             |
| D16 | accounts  | No value given for `ACTIVATION_DELAY_MS`              | `3 * DAY_MS` (`lifecycle.ts`)                                             |
| D17 | accounts  | No value given for `WINBACK_QUIET_MS`                 | `4 * WEEK_MS` (`lifecycle.ts`)                                            |
| D18 | accounts  | No value given for `MAX_SEND_ATTEMPTS`                | `3` (`lifecycle.ts`)                                                      |
| D19 | accounts  | No value given for `STAGE_ORDER`                      | `['welcome', 'activation', 'week1', 'week2', 'winback']` (`lifecycle.ts`) |
| D20 | accounts  | No value given for `MAX_NOTIFY_KEYS`                  | `8` (`notify.ts`)                                                         |
| D21 | accounts  | No value given for `PROFILE_COLOR_MAX`                | `64` (`profiles.ts`)                                                      |
| D22 | accounts  | No value given for `ADMIN_HEADER`                     | `'x-liveworkspace-admin'` (`secrets.ts`)                                  |
| D23 | accounts  | No value given for `SETTINGS_MAX_BYTES`               | `16_384` (`settings.ts`)                                                  |
| D24 | accounts  | No value given for `TEAM_NAME_MAX_LENGTH`             | `80` (`teams.ts`)                                                         |
| D25 | accounts  | No value given for `MAX_TEAMS_PER_ACCOUNT`            | `50` (`teams.ts`)                                                         |
| D26 | accounts  | No value given for `ORGANISATION_MAX_LENGTH`          | `80` (`teams.ts`)                                                         |
| D27 | accounts  | No value given for `INVITE_LINK_TTL_MS`               | `7 * 24 * 60 * 60 * 1000` (`teams.ts`)                                    |
| D28 | accounts  | No value given for `REMINDER_AGES_MS`                 | `[1 * DAY_MS, 7 * DAY_MS, 21 * DAY_MS] as const` (`teams.ts`)             |
| D29 | accounts  | No value given for `INVITATION_TTL_MS`                | `28 * DAY_MS` (`teams.ts`)                                                |
| D30 | accounts  | No value given for `MAX_REMINDER_ATTEMPTS`            | `3` (`teams.ts`)                                                          |
| D31 | accounts  | No value given for `LIST_PREVIEW_MEMBERS`             | `4` (`teams.ts`)                                                          |
| D32 | accounts  | No value given for `TELEMETRY_TIMEOUT_MS`             | `2_000` (`telemetry.ts`)                                                  |
| D33 | accounts  | No value given for `TOKEN_EXPIRY_WARNING_MS`          | `7 * DAY_MS` (`token-expiry.ts`)                                          |
| D34 | accounts  | No value given for `MAX_API_TOKENS_PER_ACCOUNT`       | `20` (`tokens.ts`)                                                        |
| D35 | accounts  | No value given for `TOKEN_NAME_MAX_LENGTH`            | `80` (`tokens.ts`)                                                        |
| D36 | accounts  | No value given for `LAST_USED_STAMP_WINDOW_MS`        | `60_000` (`tokens.ts`)                                                    |
| D37 | accounts  | No value given for `WORKBENCH_TICKET_TTL_MS`          | `60_000` (`routes.ts`)                                                    |
| D38 | accounts  | No value given for `WORKBENCH_SESSION_TTL_MS`         | `8 * 60 * 60 * 1000` (`routes.ts`)                                        |
| D39 | accounts  | No value given for `WORKBENCH_TICKETS_PER_MINUTE`     | `30` (`routes.ts`)                                                        |
| D40 | accounts  | No value given for `WORKBENCH_NAME_MAX_LENGTH`        | `40` (`routes.ts`)                                                        |
| D41 | accounts  | No value given for `WORKBENCH_ORIGIN_MAX_LENGTH`      | `255` (`routes.ts`)                                                       |
| D42 | accounts  | No value given for `WORKBENCH_POLL_INTERVAL_S`        | `5` (`routes.ts`)                                                         |
| D43 | accounts  | No value given for `WORKBENCH_SESSION_PREFIX`         | `'lvw_'` (`store.ts`)                                                     |
| D44 | accounts  | No value given for `WORKBENCH_TICKET_BYTES`           | `16` (`store.ts`)                                                         |
| D45 | accounts  | No value given for `WORKBENCH_PAIRING_CODE_BYTES`     | `16` (`store.ts`)                                                         |
| D46 | accounts  | No value given for `WORKBENCH_SESSION_SECRET_BYTES`   | `32` (`store.ts`)                                                         |
| D47 | accounts  | No value given for `WORKBENCH_PAIRING_TTL_MS`         | `10 * 60 * 1000` (`store.ts`)                                             |
| D48 | accounts  | No value given for `WORKBENCH_SESSION_GRACE_MS`       | `24 * 60 * 60 * 1000` (`store.ts`)                                        |
| D49 | accounts  | No value given for `WORKBENCH_QUOTA_MAX`              | `1_000` (`store.ts`)                                                      |
| D50 | accounts  | No value given for `WORKBENCH_TICKET_PATTERN`         | `/^[A-Za-z0-9_-]{22}\.[0-9a-f]{64}$/` (`store.ts`)                        |
| D51 | accounts  | No value given for `WORKBENCH_SESSION_PATTERN`        | `/^lvw_[A-Za-z0-9_-]{43}\.[0-9a-f]{64}$/` (`store.ts`)                    |
| D52 | accounts  | No value given for `WORKBENCH_CODE_PATTERN`           | `/^[A-Za-z0-9_-]{22}$/` (`store.ts`)                                      |
| D53 | accounts  | No value given for `WORKSPACE_TOKEN_TTL_SECONDS`      | `15 * 60` (`workspace-token.ts`)                                          |
| D54 | accounts  | No value given for `ACCOUNT_NAME_MAX_LENGTH`          | `64` (`account-name.ts`)                                                  |
| D55 | accounts  | No value given for `ACCOUNT_COLOUR_MAX_LENGTH`        | `64` (`account-name.ts`)                                                  |
| D56 | accounts  | No value given for `TOKEN_VALID_FOR_MS`               | `60_000` (`account.ts`)                                                   |
| D57 | accounts  | No value given for `TOKEN_INVALID_FOR_MS`             | `10_000` (`account.ts`)                                                   |
| D58 | accounts  | No value given for `INVITATIONS_TTL_MS`               | `30_000` (`invitations.ts`)                                               |
| D59 | accounts  | No value given for `MILESTONE_ITEM_COUNTS`            | `[10]` (`notify.ts`)                                                      |
| D60 | accounts  | No value given for `NOTIFY_RATE_WINDOW_MS`            | `60 * 60 * 1000` (`notify.ts`)                                            |
| D61 | accounts  | No value given for `GUEST_STATE_PATTERN`              | `/^[A-Za-z0-9_-]{8,200}$/` (`oauth.ts`)                                   |
| D62 | accounts  | No value given for `SILENT_SESSION_KEY`               | `'liveworkspace:silent-sign-in'` (`silent.ts`)                            |
| D63 | accounts  | No value given for `SIGNED_OUT_MAX_AGE_SECONDS`       | `400 * 24 * 3600` (`silent.ts`)                                           |
| D64 | accounts  | No value given for `SILENT_RETURN_MAX_LENGTH`         | `1500` (`silent.ts`)                                                      |
| D65 | accounts  | No value given for `WORKBENCH_SESSION_VALID_FOR_MS`   | `60_000` (`workbench.ts`)                                                 |
| D66 | accounts  | No value given for `WORKBENCH_SESSION_INVALID_FOR_MS` | `10_000` (`workbench.ts`)                                                 |
| D67 | accounts  | No value given for `WORKBENCH_SESSION_CACHE_MAX`      | `1_000` (`workbench.ts`)                                                  |
| D68 | accounts  | No value given for `EMAIL_SEND_TIMEOUT_MS`            | `10_000` (`index.ts`)                                                     |
| D69 | accounts  | No value given for `ACCOUNT_KEYS`                     | `new Set(ACCOUNT_TOGGLES.map((row) => row.key))` (`account.ts`)           |
| D70 | accounts  | No value given for `PRESENCE_COLOUR_VALUES`           | `PRESENCE_COLOURS.map((c) => c.value)` (`presence.ts`)                    |
