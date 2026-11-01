# Email: blueprint

Derived from [email.md](../email.md) and [accounts.md "Emails"](../accounts.md#emails), ["Notification
emails"](../accounts.md#notification-emails), ["Onboarding emails"](../accounts.md#onboarding-emails) and ["Sign-ups
and milestones per app"](../accounts.md#sign-ups-and-milestones-per-app). The spec decides; this file only adds
engineering precision, read from the code. Defaults are cited as `ACCn`. Paths are relative to the repository root.

Scope, by file:

| File                                                 | Role                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `liveworkspace/apps/accounts/src/email.ts`           | `sendEmail`; the code, deletion code, invitation, response and expiry emails    |
| `liveworkspace/apps/accounts/src/email-layout.ts`    | The frame every email is drawn in; `emailBrand`, `appUrl`                       |
| `liveworkspace/apps/accounts/src/lifecycle.ts`       | The onboarding series: stages, claims, retries, `recordActivity`, `signupAppOf` |
| `liveworkspace/apps/accounts/src/lifecycle-email.ts` | The series' five emails                                                         |
| `liveworkspace/apps/accounts/src/account-apps.ts`    | Sightings, milestones, verified emails                                          |
| `liveworkspace/apps/accounts/src/notify.ts`          | Many people's notify switches; a team's people                                  |
| `packages/email/src/index.ts`                        | The one wrapper of the `send_email` binding (10 s timeout, `List-Unsubscribe`)  |
| `packages/auth-client/src/notify.ts`                 | The rules every app's notification emails keep                                  |

## Domain and naming

| Term      | Identifier                                                                | Meaning                                                      |
| --------- | ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Brand     | `EmailBrand { word, home, logo, accent, band, canvas, panel, panelEdge }` | liveworkspace's slate, or an app's palette and mark          |
| Stage     | `welcome`, `activation`, `week1`, `week2`, `winback`                      | The onboarding series, one per account                       |
| Home app  | the sign-up app, else the first app seen, else none                       | Where a series email's links go and what it is counted under |
| Sighting  | `account_app (user_id, app, first_seen_at)`                               | An app's first sight of an account: its sign-up count        |
| Milestone | `milestone`, `firstShare`                                                 | One-time emails an app claims before sending                 |

## Behaviour and state

### Sending (`sendEmail`)

Through the `EMAIL` binding from `liveworkspace <EMAIL_FROM>`. Without the binding, development logs `[email] To: …
Subject: …` and returns; staging and production throw (`the EMAIL binding is not set`). An `unsubscribeUrl` goes out
as `List-Unsubscribe`.

### The emails

| Email               | Sent when                                   | Subject                                                        | Brand / links                                                        | Can be turned off              |
| ------------------- | ------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------ |
| Sign-in code        | a code is asked for                         | `<code> is your live<word> sign-in code`                       | the app it came through, else liveworkspace                          | no                             |
| Deletion code       | an app asks before closing an account       | `<code> is your code to delete your liveworkspace account`     | the asking client's app, else liveworkspace                          | no                             |
| Team invitation     | an admin invites; reminders at stage 1 to 3 | `<who> invited you to <team> on liveworkspace` (`Reminder: …`) | accept at `/explorer/invites`; decline at `/join/decline?token=`     | no                             |
| Invitation response | someone accepts or declines                 | `<responder> accepted\|declined your invitation to <team>`     | `/explorer/team?id=`; unsubscribe `/explorer?settings=notifications` | `notifyInviteResponse` (`all`) |
| Token expiring      | a week before, in the send window           | `Your liveworkspace API token expires soon`                    | `/explorer?settings=tokens`                                          | no                             |
| Welcome             | right after sign-up, caught up every 15 min | `Welcome to liveworkspace`                                     | liveworkspace's frame, links to the home app                         | no                             |
| Week 1              | ~7 days in                                  | `Find your way around the Explorer`                            | as above                                                             | `notifyTips`                   |
| Week 2              | ~14 days in                                 | `Bring your team into your work`                               | as above                                                             | `notifyTips`                   |
| Activation          | ~3 days in, nothing made, week 1 not sent   | `Your first piece of work is waiting`                          | as above                                                             | `notifyTips`                   |
| Win-back            | once, 4 weeks after the last save           | `Your work is waiting`                                         | as above                                                             | `notifyTips`                   |

The invitation's inviter name falls back to `Someone`. The code email and the deletion code email say they work 10 minutes; both draw the code in the same tinted panel
(`codePanel`). Nothing a person
wrote is ever in a series email.

Every email is `frame(brand, { preheader, heading, body, footer })` with a `text` part. The code email takes the
brand it came through; every other email takes `workspaceBrand({ BASE_URL })`. The team and token emails:

| Email               | Heading                                                | Button                  | Sign-off under the rule                                                              |
| ------------------- | ------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------ |
| Team invitation     | `You’re invited to <team>` (`A reminder about <team>`) | `Answer the invitation` | the team is the same in every app; an invitation nobody answers closes after 28 days |
| Invitation response | `Invitation accepted\|declined`                        | `See the team`          | sent as one of the team's admins; `Manage your notifications` to turn these off      |
| Token expiring      | `Your API token expires soon`                          | `Manage your tokens`    | sent because an API token on the account is nearing its expiry                       |

`button(text, href)` and `list(items, ordered?)` in `email-layout.ts` draw the ink button and the bullet or numbered
list the frame's emails share. `escapeHtml` escapes every person-chosen value in the HTML (names, team names,
token names) and every link in an attribute; subjects and text parts are plain text, so they carry the values as
they are.

### The onboarding series (`lifecycle.ts`)

- A row (`startLifecycle`) is made by Better Auth's user-create hook with the sign-up's app: the `client_id` of the
  signed `oauth_query` (an email code's own request, or Google's server context), mapped through `oauth_client_app`,
  else `liveworkspace.app`. `.invalid` addresses get none. The welcome is queued in the isolate (≤ 1,000) and sent
  after the response.
- Each stage, per run, up to 100 accounts with a verified address and fewer than 3 failed sends, longest waiting
  first, by its partial index; one send at a time. A stage is claimed (stamped) before sending (`taken` if another
  run got it); `notifyTips` set to `0` in `all` keeps the stamp and sends nothing (`skipped`); a failed send clears
  the stamp, `send_attempts + 1` (`[lifecycle] giving up …` at the third), else a success resets it.
- The frequent cron runs only `welcome`; the hourly runs the order `welcome`, `activation`, `week1`, `week2`,
  `winback`. Logged `[lifecycle] onboarding emails`.
- Every stage but `welcome` adds the send window's filter on `u.timeZone` to its due query (below); when no zone is
  inside, that stage's query isn't run and it counts nothing.

### The send window (`send-window.ts`)

- `SEND_WINDOW`: `{ days: Mon to Fri, start 09:00, end 21:00, zone: 'Europe/London' }`. A local time is inside when
  its weekday is a window day and `start <= hh:mm < end`, in the zone, by `Intl.DateTimeFormat` (`hourCycle: h23`), so
  DST moves with the zone.
- `parseTimeZone(value)`: a string of at most 64 characters naming a zone `Intl` accepts, answered as the runtime's
  name for it (`resolvedOptions().timeZone`) when that is in the known list, else the name as given when it is;
  anything else `null`. The known list is `Intl.supportedValuesOf('timeZone')` and `UTC`.
- `parseSendWindow(spec, zone)`: `always` (no window), else `^(Sun|Mon|…)-(Sun|…) (\d\d):00-(\d\d):00$` with start
  before end, at most 24; a day range wraps (`Sat-Mon`). Unparsable: the default, warned `[email] EMAIL_SEND_WINDOW does not parse; using the default` (and alike for `EMAIL_DEFAULT_TIME_ZONE`).
  `sendWindowOf(env)` reads `EMAIL_SEND_WINDOW` and `EMAIL_DEFAULT_TIME_ZONE`, cached per value.
- `windowFilter(column, window, now)`: `null` for an `always` window (no filter), `'closed'` when no zone is inside
  (the caller runs no query). Otherwise one fragment and one bind: `<col> IN (SELECT value FROM json_each(?))` over
  the inside zones when the default zone is outside, or `(<col> IS NULL OR <col> NOT IN (SELECT value FROM
json_each(?)))` over the outside zones when it is inside. The split is worked out once per instant (the run's
  queries share it), with one `Intl.DateTimeFormat` per zone kept for the isolate (at most the known list).
- The session sighting (`index.ts`, `withSessionColour` in `profiles.ts`): on `GET /api/auth/get-session` with a
  user, an `X-Time-Zone` that `parseTimeZone` accepts is written in the colour read's batch
  (`UPDATE "user" SET timeZone = ?2 WHERE id = ?1 AND timeZone IS NOT ?2`). liveworkspace.app sends it from
  `lib/session.ts` and the sign-in flow's `/get-session` calls (`timeZoneHeader()` in `lib/accounts.ts`).
- Each email sent is `Email·Sent·<Welcome|Activation|Week1|Week2|WinBack>` under the home app; none is counted when
  there is no home app.

### What apps ask (client credentials)

| Route                                         | Body                                                             | Answer                                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `POST /api/account/internal/sightings`        | `{ userId }`                                                     | `{ first }`: one `INSERT … WHERE EXISTS user … ON CONFLICT DO NOTHING RETURNING`; `403 client_has_no_app` |
| `POST /api/account/internal/milestones/claim` | `{ userId, milestone }`                                          | `{ claimed }`: true only for the first claim; `400 invalid_milestone`                                     |
| `POST /api/account/internal/activity`         | `{ userId, at? }`                                                | `{ ok: true }`; `active_at` only moves forward, never past now; a guest is a no-op; `400 invalid_at`      |
| `POST /api/account/internal/emails`           | `{ ids (≤ 100 account ids) }`                                    | `{ emails: { id: address } }`, verified only                                                              |
| `POST /api/account/internal/settings/notify`  | `{ owners (≤ 100), app, keys (1 to 8, ^notify[A-Za-z]{1,58}$) }` | `{ settings: { owner: { all, app } } }`: stored values only (missing reads as on); `403 wrong_app`        |
| `POST /api/account/internal/teams/members`    | `{ teamId }`                                                     | a team's joined and invited people ([teams.md](teams.md))                                                 |

Each app's own rules (`@liveworkspace/auth-client` `notify.ts`): a join notice at most once per item per 15 minutes;
an assignment or mention once per sender, item, recipient and wording a day, at most 60 a sender an hour, and only to
the team's people.

## Data and persistence

| Table             | Key              | Indexes                                                                                                                                                                                                                                                               | Written by                     | Read by                                             |
| ----------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------- |
| `email_lifecycle` | `user_id`        | `email_lifecycle_welcome (created_at) WHERE welcome_sent_at IS NULL`; `…_week1`, `…_week2` alike; `…_activation (created_at) WHERE activation_sent_at IS NULL AND week1_sent_at IS NULL AND active_at IS NULL`; `…_winback (active_at) WHERE winback_sent_at IS NULL` | sign-up hook; stages; activity | the stages; `signupAppOf` for team and token emails |
| `account_app`     | `(user_id, app)` | (WITHOUT ROWID)                                                                                                                                                                                                                                                       | sightings; milestones          | milestones; a series' home app                      |

`email_lifecycle` columns: `created_at`, the five `*_sent_at`, `send_attempts` (default 0), `last_attempt_at`,
`active_at`, `signup_app` (0009, CHECK the four apps or `liveworkspace.app`). `account_app`: `first_seen_at`,
`milestone_sent_at`, `first_share_sent_at`. Both cascade from `user`.

## Errors and edge cases

| Case                                | Behaviour                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------- |
| No binding outside development      | the send throws; the caller logs it; the hourly windowed sweeps don't run |
| Recipient outside the send window   | stays due; goes in the first hourly run inside it                         |
| No zone known / unknown stored zone | timed by the default zone (`Europe/London`)                               |
| An address failing three days       | it leaves every due list for good (`send_attempts` 3)                     |
| The inline welcome racing the cron  | the claim lets one send                                                   |
| Tips turned off                     | stamped, never sent                                                       |
| An unknown account sighted          | never "first"                                                             |

## Testing

| Test                                                                          | Pins                                                                                            |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/accounts/src/email.test.ts`                               | `codeEmail`; `sendCodeEmail`; each team and token email in the frame, escaped, with a text part |
| `liveworkspace/apps/accounts/src/lifecycle.test.ts`                           | starting the series; the welcome; the series; the send window; telemetry; the emails            |
| `liveworkspace/apps/accounts/src/send-window.test.ts`                         | the window's edges, weekends, DST both ways, zones parsed and refused, the config, the filter   |
| `liveworkspace/apps/accounts/src/account-apps.test.ts` (4)                    | sightings; milestones; emails                                                                   |
| `liveworkspace/apps/accounts/src/notify.test.ts` (4)                          | `readNotifySettings`; `teamPeople`                                                              |
| `liveworkspace/apps/accounts/src/signup-app.test.ts` (4)                      | the app a sign-up came through                                                                  |
| `packages/email/src/index.test.ts`, `packages/auth-client/src/notify.test.ts` | the binding wrapper; the apps' notify rules                                                     |

## Constants and configuration

`ACTIVATION_DELAY_MS` 3 d, `WINBACK_QUIET_MS` 4 weeks, `SWEEP_LIMIT` 100, `MAX_SEND_ATTEMPTS` 3, `STAGE_ORDER`,
`MAX_WAITING` 1,000 (`lifecycle.ts`); `SEND_WINDOW` Mon to Fri 09:00 to 21:00, `DEFAULT_TIME_ZONE` `Europe/London`,
`MAX_TIME_ZONE_LENGTH` 64 (`send-window.ts`), vars `EMAIL_SEND_WINDOW` and `EMAIL_DEFAULT_TIME_ZONE` (unset in both
environments: the defaults); `MAX_EMAIL_IDS` 100 (`account-apps.ts`); `MAX_NOTIFY_OWNERS` 100,
`MAX_NOTIFY_KEYS` 8 (`notify.ts`); `EMAIL_SEND_TIMEOUT_MS` 10 s (`packages/email`); `JOIN_NOTIFY_THROTTLE_MS` 15 min,
`NOTIFY_EMAIL_DEDUPE_MS` 24 h, `NOTIFY_EMAILS_PER_SENDER_PER_HOUR` 60 (`packages/auth-client/src/notify.ts`). Var
`EMAIL_FROM` `sign-in@liveplanner.app` in both environments; binding `[[send_email]] EMAIL`.

## Defaults ledger

- `ACC15`: three failed sends in a row take an account off every due list for good; a success before then resets
  the count.
- `ACC16`: a series email for someone who has opened no app speaks for liveworkspace and is not counted under any app.
- `ACC18`: the send window is whole hours (the sweeps run hourly); a window that would cross midnight
  (`21:00-09:00`) doesn't parse and the default is used.
- `ACC19`: an invited address is timed by the zone of the account with that address, else the default.
