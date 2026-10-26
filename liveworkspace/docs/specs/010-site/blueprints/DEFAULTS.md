# Site blueprint defaults

One row per default applied where a spec is silent or qualitative. Rows that name a constant are read from the code: the spec gives no value, the code's is the default.

| #   | Blueprint | Spec silence                                     | Default applied                                                                          |
| --- | --------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| D1  | site      | No value given for `EMAIL_PATTERN`               | `/^[^@\s]+@[^@\s]+\.[^@\s]+$/` (`accounts.ts`)                                           |
| D2  | site      | No value given for `HANDOFF_PARAM`               | `'handoff'` (`accounts.ts`)                                                              |
| D3  | site      | No value given for `LAST_APP_KEY`                | `'liveworkspace:explorer-app'` (`host.ts`)                                               |
| D4  | site      | No value given for `NOTIFICATIONS_SETTINGS`      | `/explorer?${SETTINGS_PARAM}=notifications` (`host.ts`)                                  |
| D5  | site      | No value given for `PREVIEW_CACHE_CEILING`       | `1000` (`previews.tsx`)                                                                  |
| D6  | site      | No value given for `PREVIEW_CONCURRENCY`         | `4` (`previews.tsx`)                                                                     |
| D7  | site      | No value given for `CONTACT_URL`                 | `'https://livediagram-router.liveworkspace-easing509.workers.…` (`legal.ts`)             |
| D8  | site      | No value given for `HISTORY_REFRESH_MS`          | `5 * 60_000` (`history.ts`)                                                              |
| D9  | site      | No value given for `CHECK_COOLDOWN_MS`           | `30_000` (`probe.ts`)                                                                    |
| D10 | site      | No value given for `HISTORY_MAX`                 | `30` (`probe.ts`)                                                                        |
| D11 | site      | No value given for `TURNSTILE_ORIGIN`            | `'https://challenges.cloudflare.com'` (`turnstile.ts`)                                   |
| D12 | site      | No value given for `SITES`                       | `[PLATFORM_SITE, ...APP_SITES]` (`index.ts`)                                             |
| D13 | site      | No value given for `APP_NAMES`                   | `Object.keys(APP_ITEMS) as AppName[]` (`index.ts`)                                       |
| D14 | site      | No value given for `PROFILE_PICTURE_HOST`        | `'lh3.googleusercontent.com'` (`picture.ts`)                                             |
| D15 | site      | No value given for `PROFILE_PICTURE_ORIGIN`      | `https://${PROFILE_PICTURE_HOST}` (`picture.ts`)                                         |
| D16 | site      | No value given for `MAX_PICTURE_URL_LEN`         | `512` (`picture.ts`)                                                                     |
| D17 | site      | No value given for `DEFAULT_PICTURE_PX`          | `96` (`picture.ts`)                                                                      |
| D18 | site      | No value given for `WORKSPACE_PROXY_HEADER`      | `'X-Liveworkspace-Proxy'` (`workspace-proxy.ts`)                                         |
| D19 | site      | No value given for `WORKSPACE_CLIENT_IP_HEADER`  | `'X-Liveworkspace-Client-IP'` (`workspace-proxy.ts`)                                     |
| D20 | site      | No value given for `FLOW_COOKIE_MAX_AGE_SECONDS` | `900` (`workspace-proxy.ts`)                                                             |
| D21 | site      | No value given for `ACCOUNT_TRIGGER_CLASS`       | `'relative touch-target-y inline-flex max-w-56 cursor-pointer…` (`face.tsx`)             |
| D22 | site      | No value given for `SETTINGS_CARD`               | `'rounded-xl border border-slate-200 bg-white dark:border-sla…` (`SettingsGroup.tsx`)    |
| D23 | site      | No value given for `SETTINGS_CARD_SLOT`          | `'border-t border-slate-100 first:rounded-t-xl first:border-t…` (`SettingsGroup.tsx`)    |
| D24 | site      | No value given for `SETTINGS_ROW_BUTTON`         | `'shrink-0 cursor-pointer rounded-lg border border-slate-200 …` (`SettingsRowShell.tsx`) |
| D25 | site      | No value given for `DRIVE_ROW_REFRESH_MS`        | `5_000` (`GoogleDriveRow.tsx`)                                                           |
| D26 | site      | No value given for `DRIVE_NOT_SYNCED_YET`        | `'Not synced yet'` (`cloud-sync-copy.ts`)                                                |
| D27 | site      | No value given for `DRIVE_CONNECT_FAILED`        | `'Couldn’t reach Google. Check your connection and try again.'` (`cloud-sync-copy.ts`)   |
| D28 | site      | No value given for `DRIVE_CONNECT_CANCELLED`     | `'Connection cancelled. Connect whenever you’re ready.'` (`cloud-sync-copy.ts`)          |
| D29 | site      | No value given for `DRIVE_OFFLINE`               | `'Can’t reach Google Drive. Trying again automatically.'` (`cloud-sync-copy.ts`)         |
| D30 | site      | No value given for `DRIVE_NEEDS_RECONNECT`       | `'Google Drive needs reconnecting. Your files are safe.'` (`cloud-sync-copy.ts`)         |
| D31 | site      | No value given for `DRIVE_NOTICE_TEXT`           | `'Moved to a Drive folder liveworkspace can’t see.'` (`cloud-sync-copy.ts`)              |
| D32 | site      | No value given for `DRIVE_NOT_CONNECTED_TEXT`    | `'Your work from every app, copied to your Google Drive in ma…` (`cloud-sync-copy.ts`)   |
| D33 | site      | No value given for `DRIVE_SINCE_STEPS_MS`        | `[DRIVE_JUST_NOW_MS, DRIVE_UNDER_A_MINUTE_MS] as const` (`cloud-sync-copy.ts`)           |
| D34 | site      | No value given for `SETTINGS_DIALOG_SIZE`        | `'3xl' as const` (`frame.ts`)                                                            |
| D35 | site      | No value given for `SETTINGS_DIALOG_CLASS`       | `'max-h-[calc(100%-2rem)] sm:h-[min(44rem,calc(100%-6rem))] s…` (`frame.ts`)             |
| D36 | site      | No value given for `SETTINGS_INPUT`              | `'w-full rounded-xl border border-slate-300 bg-white px-3 py-…` (`ProfileEditor.tsx`)    |
| D37 | site      | No value given for `SETTINGS_ROW_ATTRIBUTE`      | `'data-settings-row'` (`settings-scroll-anchor.ts`)                                      |
| D38 | site      | No value given for `SETTINGS_APP_IDS`            | `Object.keys(CATALOGUES) as SettingsAppId[]` (`store.ts`)                                |
