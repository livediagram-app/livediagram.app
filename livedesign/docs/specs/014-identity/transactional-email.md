# Transactional email

Status: shipped. Optional: on wherever the `EMAIL` binding is declared. The api worker sends a small set of account and
notification emails through Cloudflare Email Service, the platform's one email path
([liveworkspace/docs/specs/003-accounts/email.md](../../../../liveworkspace/docs/specs/003-accounts/email.md)). Like sign-in ([Auth + guest access](auth-and-guest-access.md)),
it is **entirely gated on configuration**: when the `EMAIL` binding is absent the whole feature is inert — no
sends, no new request work — and everything else behaves the same. Guests and the canvas stay
account-free and never receive email.

## 1. What we send

The **onboarding series** (welcome, week-1 and week-2 tips, the activation
nudge and win-back) is not livedesign's: liveworkspace's accounts Worker
sends one series per account, whichever app it signed up through
([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md)
"Sign-ups and milestones per app"), and reads the shared `notifyTips` setting
before each. livedesign reports what it takes to schedule it: a sign-up
sighting (§4) and the owner's activity (§5).

Teams and API tokens belong to the liveworkspace account
([Teams](../013-workspace/teams.md), [Public API + tokens](../015-api/public-api-and-tokens.md)), and so
do their emails: team invitations, their reminders and Decline links, the answer an invitation's
admins are told, and the warning a week before an API token expires all come from the accounts Worker
([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md) "Teams", "API tokens").

livedesign sends the rest, two kinds:

**Transactional — always send (when the feature is on):**

1. **Account deleted** — after a user deletes their account (spec: account
   self-deletion), a confirmation that their livedesign data and their
   liveworkspace account are gone.

[Account settings & email notifications](profile-and-email-notifications.md) adds a further opt-out
notification — **someone joined my design** — read from the person's
[User preferences](../007-editor/user-preferences.md), set in the Settings dialog.

**Notifications (same gate + best-effort `ctx.waitUntil` contract):**

2. **Milestone** (#6, opt-out `notifyMilestones`) — a celebration when an owner's
   design count reaches 10, fired on a genuine create. Claimed once per account
   from the accounts Worker before it is sent (`claimMilestone`, milestone
   `milestone`), which dedups a burst of saves across isolates.
   **First share** (opt-out `notifyMilestones`) is the same, claimed as
   `firstShare` when an owner makes their first share link.
3. **New comment** (#1, opt-out `notifyComments`) — when someone other than the
   owner comments on a design (either comment path), the owner is emailed
   **immediately** (no cron). Never includes the comment text. On the tab save
   it counts only the saver's own new comments: a save can carry a peer's
   comment that reached the saver live first, and that is not the saver
   commenting.
4. **Action assigned** (opt-out `notifyActionAssigned`) — a teammate assigned
   the recipient an action ([Assigned actions](../012-collaboration/assigned-actions.md)).
5. **Mentioned** (opt-out `notifyMentions`) — a teammate @-mentioned the
   recipient in a comment ([Comment mentions](../012-collaboration/comment-mentions.md)). Unlike the owner's new-comment email it
   quotes the comment (the first 280 characters): the recipient was named in
   it, and the design is in their own team's library.

The opt-out notification categories (`notifyComments`, `notifyMilestones`,
`notifyMentions`, `notifyActionAssigned`) join the [Account settings & email notifications](profile-and-email-notifications.md) pair in `getNotificationPrefs`
(`apps/api/src/accounts/settings.ts`, one settings read) and as switches in
Settings > Notifications; every opt-out email's footer links to
`/explorer?settings=notifications` (also emitted as a `List-Unsubscribe` header; the old `/explorer/profile` URL in already-sent mail redirects there, see [Account settings & email notifications](profile-and-email-notifications.md)) so the
recipient can turn it off in one click. The opt-out toggles are
documented for users in the [Email Notifications](../../../apps/help/app/account-and-data/email-notifications/page.mdx)
help article.

## 2. Gating — the binding is the switch

- `EMAIL` (`send_email` binding) — declared in `apps/api/wrangler.toml` as `[[send_email]]`, and restated as
  `[[env.staging.send_email]]` because bindings don't inherit. When **absent**, `emailEnabled(env)` is false
  and every send is a no-op, so a deployment with email off does zero extra work. There is no API key: the
  binding is the credential.
- `EMAIL_FROM` (plain var) — the From identity, a bare address or `Name <address>`. Set to
  `livedesign <hello@livedesign.app>` in production and staging, which is also the default. Its domain must be
  onboarded to Email Service on the liveworkspace account ([liveworkspace/docs/specs/003-accounts/email.md](../../../../liveworkspace/docs/specs/003-accounts/email.md)).
- `APP_BASE_URL` (plain var, optional) — public origin for links in emails.
  Default `https://livedesign.app`.

Email off means no binding: a fork turns it off by dropping the `[[send_email]]` blocks. Locally,
`wrangler dev` simulates the binding, printing each email and saving it to files, so nothing is sent.

## 3. Where addresses come from

livedesign stores no address of its own. A person's address is their
liveworkspace account's **verified** email, asked of the accounts Worker
(`accountEmails`, `emailsOf` / `emailOf` in `apps/api/src/accounts/people.ts`).
Guests have no address and never receive email.

## 4. Sign-ups

Where a sign-in completes (`/api/auth/callback`, once per sign-in), the api
records a **sighting** with the accounts Worker (`recordSighting`,
`apps/api/src/auth/session-telemetry.ts`). The first sighting of an account by
livedesign is its sign-up here: it counts `Session·SignedUp`
([Telemetry](../017-telemetry/telemetry.md)), and a milestone can only be
claimed for an account livedesign has sighted. The sighting is recorded whether
or not telemetry is on.

## 5. Activity

When an owner saves their own design (a create, or a tab save by the owner), the
api reports **activity** to the accounts Worker (`reportActivity`,
`reportOwnerActivity`), which is what its win-back email reads. Reports are
throttled to once a minute per owner and design in each isolate, so a minute of
autosaves is one request, and a guest's is never sent.

## 6. Code shape

- `apps/api/src/email/client.ts` — `emailEnabled(env)` + `sendEmail(env, msg)`, which hands the message to
  the shared `@liveworkspace/email` (`sendEmail(env.EMAIL, …)`, from `EMAIL_FROM`, with `List-Unsubscribe`
  for opt-out emails, giving up after 10 seconds). Never throws: returns `{ sent }` and logs on failure (the
  address redacted), so email is always best-effort and never blocks or fails the caller.
- `apps/api/src/email/send-test-email.test.ts` — a manual preview harness (`EMAIL_PREVIEW=1`) that renders
  each template through the client into `apps/api/.wrangler/email-preview/`.
- `apps/api/src/email/templates.ts` — the `{ kind, subject, html }` builders
  (on-brand, inline-styled HTML; links use `APP_BASE_URL`). `kind` is the
  template's telemetry token (see below): it rides on the builder's return so
  it reaches `sendEmail` through the spread every caller already writes,
  instead of being re-stated (and forgotten) at each call site.
  **Branding.** Every builder renders through one shell, so every email looks
  the same: a brand-gradient band across the top of the card (rose-400 to
  pink-700, flat brand-700 `#be123c` where a client drops gradients), the logo mark beside
  the "live"/"pages" wordmark in the header, a brand-50 page behind the card,
  and a footer under the card with the lockup again, the tagline ("Make pages together, live. Free and
  open source.") and a link to the
  site. Both lockups link to `APP_BASE_URL`. The mark is a transparent 64px PNG
  (`/email/livedesign-mark-64.png`, shown at 28px in the header and 22px in
  the footer) served by the marketing app and written by `pnpm icons:brand`,
  because Gmail and Outlook drop SVG and most clients block `data:` images.
  Its `alt` is empty, since the wordmark beside it names the product when
  images are blocked. The path is permanent: every email already sent points
  at it.
- `apps/api/src/accounts/people.ts` — addresses, milestone claims and activity,
  through the accounts Worker.
- Hooks: notifications in `email/notifications.ts`, deletion in
  `routes/account.ts`.

All sends use `ctx.waitUntil` (or are already in the cron) — email is never on
the request's critical path.

**Counting sends ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).** `sendEmail` writes one
anonymous `Email·Sent·<kind>` event (`reportServerEvent`), and a failure
writes `Error·Api·<code>.SendEmail`, where `<code>` is Email Service's refusal code (such as
`E_RECIPIENT_SUPPRESSED`), or `Network.SendEmail` when the error carries none (a timeout, say). Server-side rather than through `POST /api/events`
because nothing about an email reaches a browser: the send happens in a cron or
a `waitUntil` after the response has gone, so this is the only place that can
count it. Before this, a broken
sender was invisible — every failure went to `console.error` and
nowhere else. Gated on `TELEMETRY_ENABLED` like every other emit, and its own
failure is swallowed: telemetry must never turn a delivered email into a thrown
send. The template kind and nothing else goes on the wire — never an address, a
name, or a recipient count.

## 7. Privacy / security

- Authenticated-only; the address is the verified token claim, never input.
- No design content, names, or anything the user typed is ever in an email
  beyond what the notification is about (a design's name, a team the two share)
  and the user's own email.
- Off without the binding; a deployment opts in by declaring it, with a sender on an onboarded domain
  (keeps [Open source + distribution](../002-project-scope/open-source-and-business-model.md) intact — no required SaaS call).

## 8. Out of scope

Dark-mode email variants, bounce handling (Email Service handles
delivery; sends are best-effort, and one-time ones are idempotent through their claims and stamps). Per-notification
**email preferences** are in scope: [Account settings & email notifications](profile-and-email-notifications.md)
has an opt-out toggle for each notification, stored with the person's
[User preferences](../007-editor/user-preferences.md).
