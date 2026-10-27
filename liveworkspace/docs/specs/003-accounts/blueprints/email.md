# Email: blueprint

Derived from [email.md](../email.md) and [accounts.md "Emails"](../accounts.md#emails), ["Notification
emails"](../accounts.md#notification-emails), ["Onboarding emails"](../accounts.md#onboarding-emails) and ["Sign-ups
and milestones per app"](../accounts.md#sign-ups-and-milestones-per-app). The spec decides; this file only adds
engineering precision, read from the code. Defaults are cited as `ACCn`. Paths are relative to the repository root.

Scope, by file:

| File                                                  | Role                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| `liveworkspace/apps/accounts/src/email.ts`            | `sendEmail`; the code, invitation, invitation response and token expiry emails  |
| `liveworkspace/apps/accounts/src/email-layout.ts`     | The frame every email is drawn in; `emailBrand`, `appUrl`                       |
| `liveworkspace/apps/accounts/src/lifecycle.ts`        | The onboarding series: stages, claims, retries, `recordActivity`, `signupAppOf` |
| `liveworkspace/apps/accounts/src/lifecycle-email.ts`  | The series' five emails                                                         |
| `liveworkspace/apps/accounts/src/migration-notice.ts` | The migration notice: its route, checks, claims and copy                        |
| `liveworkspace/apps/accounts/src/account-apps.ts`     | Sightings, milestones, verified emails                                          |
| `liveworkspace/apps/accounts/src/notify.ts`           | Many people's notify switches; a team's people                                  |
| `packages/email/src/index.ts`                         | The one wrapper of the `send_email` binding (10 s timeout, `List-Unsubscribe`)  |
| `packages/auth-client/src/notify.ts`                  | The rules every app's notification emails keep                                  |

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

| Email               | Sent when                                       | Subject                                                        | Brand / links                                                                        | Can be turned off              |
| ------------------- | ----------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------ |
| Sign-in code        | a code is asked for                             | `<code> is your live<word> sign-in code`                       | the app it came through, else liveworkspace                                          | no                             |
| Team invitation     | an admin invites; reminders at stage 1 to 3     | `<who> invited you to <team> on liveworkspace` (`Reminder: …`) | accept at `/explorer/invites`; decline at `/join/decline?token=`                     | no                             |
| Invitation response | someone accepts or declines                     | `<responder> accepted\|declined your invitation to <team>`     | `/explorer/team?id=`; unsubscribe `/explorer?settings=notifications`                 | `notifyInviteResponse` (`all`) |
| Token expiring      | daily, a week before                            | `Your liveworkspace API token expires soon`                    | `/explorer?settings=tokens`                                                          | no                             |
| Welcome             | right after sign-up, caught up every 15 min     | `Welcome to liveworkspace`                                     | liveworkspace's frame, links to the home app                                         | no                             |
| Week 1              | ~7 days in                                      | `Find your way around the Explorer`                            | as above                                                                             | `notifyTips`                   |
| Week 2              | ~14 days in                                     | `Bring your team into your work`                               | as above                                                                             | `notifyTips`                   |
| Activation          | ~3 days in, nothing made, week 1 not sent       | `Your first piece of work is waiting`                          | as above                                                                             | `notifyTips`                   |
| Win-back            | once, 4 weeks after the last save               | `Your work is waiting`                                         | as above                                                                             | `notifyTips`                   |
| Migration notice    | once per address, asked for by `migrate notify` | `livediagram is now part of liveworkspace`                     | liveworkspace's frame from `NOTICE_FROM`; **Open livediagram** to livediagram's home | no (a service message)         |

### The migration notice (`migration-notice.ts`)

`POST /api/auth/internal/migration-notice` `{ recipients, dryRun? }`, `Bearer ADMIN_TOKEN` (`sameSecret`, `401`).
`400 bad_request` with a `message` naming the first bad field: 1 to `NOTICE_BATCH_MAX` (50) recipients, each with a
valid address (at most 254 characters, no two the same in a call), a `name` string of at most `NOTICE_NAME_MAX`
(120), boolean flags, and at most `NOTICE_DOCUMENTS_MAX` (50) split documents of 1 to `NOTICE_PARTS_MAX` (4) parts;
a document name or part title is 1 to `NOTICE_TEXT_MAX` (200) characters, no control characters, and a part's `url`
is `https` on its own app's domain (`www.`, `staging.` or the bare domain). Then, per address, lower-cased:

1. One `SELECT email FROM "user" WHERE email IN (…)` for the call: an address with no account is `skipped`
   (`no_account`).
2. A dry run renders and answers `preview` with `subject`, `html`, `text`, and `wouldSkip` (`already_sent`,
   `no_account`) where a real run would skip; it writes nothing.
3. Otherwise `INSERT INTO migration_notice (email, claimedAt) … ON CONFLICT DO NOTHING RETURNING email`: no row is
   `skipped` (`already_sent`). Then the send, from `NOTICE_FROM`, one at a time; `sent` stamps `sentAt` and
   `messageId`. A send that throws is `failed`: a timeout keeps the claim with its `error` (the mail may have gone);
   any other refusal deletes the claim, so the next run tries again.

Answers `200 { sent, skipped, failed, results: [{ email, status, reason?, messageId?, subject?, html?, text?,
wouldSkip? }] }`. `503 not_configured` for a real send without `NOTICE_FROM`. Logged `[notice] sent`, `[notice]
failed` with the address redacted.

The invitation's inviter name falls back to `Someone`. The code email says it works 10 minutes. Nothing a person
wrote is ever in a series email.

### The onboarding series (`lifecycle.ts`)

- A row (`startLifecycle`) is made by Better Auth's user-create hook with the sign-up's app: the `client_id` of the
  signed `oauth_query` (an email code's own request, or Google's server context), mapped through `oauth_client_app`,
  else `liveworkspace.app`. `.invalid` addresses get none. The welcome is queued in the isolate (≤ 1,000) and sent
  after the response.
- Each stage, per run, up to 100 accounts with a verified address and fewer than 3 failed sends, longest waiting
  first, by its partial index; one send at a time. A stage is claimed (stamped) before sending (`taken` if another
  run got it); `notifyTips` set to `0` in `all` keeps the stamp and sends nothing (`skipped`); a failed send clears
  the stamp, `send_attempts + 1` (`[lifecycle] giving up …` at the third), else a success resets it.
- The frequent cron runs only `welcome`; the daily runs the order `welcome`, `activation`, `week1`, `week2`,
  `winback`. Logged `[lifecycle] onboarding emails`.
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

| `migration_notice` | `email` | (WITHOUT ROWID) | the migration notice | the migration notice |

`migration_notice` (0014): `email` (lower case), `claimedAt`, `sentAt`, `messageId`, `error`.

`email_lifecycle` columns: `created_at`, the five `*_sent_at`, `send_attempts` (default 0), `last_attempt_at`,
`active_at`, `signup_app` (0009, CHECK the four apps or `liveworkspace.app`). `account_app`: `first_seen_at`,
`milestone_sent_at`, `first_share_sent_at`. Both cascade from `user`.

## Errors and edge cases

| Case                               | Behaviour                                             |
| ---------------------------------- | ----------------------------------------------------- |
| No binding outside development     | the send throws; the caller logs it                   |
| An address failing three days      | it leaves every due list for good (`send_attempts` 3) |
| The inline welcome racing the cron | the claim lets one send                               |
| Tips turned off                    | stamped, never sent                                   |
| An unknown account sighted         | never "first"                                         |

## Testing

| Test                                                                          | Pins                                                                |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `liveworkspace/apps/accounts/src/email.test.ts` (9)                           | `codeEmail`; `sendCodeEmail`; `inviteResponseEmail`                 |
| `liveworkspace/apps/accounts/src/lifecycle.test.ts` (19)                      | starting the series; the welcome; the series; telemetry; the emails |
| `liveworkspace/apps/accounts/src/account-apps.test.ts` (4)                    | sightings; milestones; emails                                       |
| `liveworkspace/apps/accounts/src/notify.test.ts` (4)                          | `readNotifySettings`; `teamPeople`                                  |
| `liveworkspace/apps/accounts/src/signup-app.test.ts` (4)                      | the app a sign-up came through                                      |
| `liveworkspace/apps/accounts/src/migration-notice.test.ts`                    | the migration notice                                                |
| `packages/email/src/index.test.ts`, `packages/auth-client/src/notify.test.ts` | the binding wrapper; the apps' notify rules                         |

## Constants and configuration

`ACTIVATION_DELAY_MS` 3 d, `WINBACK_QUIET_MS` 4 weeks, `SWEEP_LIMIT` 100, `MAX_SEND_ATTEMPTS` 3, `STAGE_ORDER`,
`MAX_WAITING` 1,000 (`lifecycle.ts`); `MAX_EMAIL_IDS` 100 (`account-apps.ts`); `MAX_NOTIFY_OWNERS` 100,
`MAX_NOTIFY_KEYS` 8 (`notify.ts`); `EMAIL_SEND_TIMEOUT_MS` 10 s (`packages/email`); `JOIN_NOTIFY_THROTTLE_MS` 15 min,
`NOTIFY_EMAIL_DEDUPE_MS` 24 h, `NOTIFY_EMAILS_PER_SENDER_PER_HOUR` 60 (`packages/auth-client/src/notify.ts`). `NOTICE_BATCH_MAX` 50, `NOTICE_DOCUMENTS_MAX` 50, `NOTICE_PARTS_MAX` 4, `NOTICE_NAME_MAX` 120, `NOTICE_TEXT_MAX` 200
(`migration-notice.ts`). Var `EMAIL_FROM` `sign-in@liveplanner.app` and var `NOTICE_FROM`
`liveworkspace <support@liveworkspace.app>` in both environments; binding `[[send_email]] EMAIL`.

## Defaults ledger

- `ACC15`: three failed sends in a row take an account off every due list for good; a success before then resets
  the count.
- `ACC16`: a series email for someone who has opened no app speaks for liveworkspace and is not counted under any app.
