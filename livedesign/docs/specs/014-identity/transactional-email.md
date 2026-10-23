# Transactional email (Resend)

**Status: in progress.** Optional, off by default. Wires [Resend](https://resend.com)
into the api worker so the product can send a small set of account and notification emails. Like
sign-in ([Auth + guest access](auth-and-guest-access.md)), it is **entirely gated on a secret**: when
`RESEND_API_KEY` is absent the whole feature is inert — no sends, no new request
work — and everything else behaves exactly as before. Guests and the canvas stay
account-free and never receive email.

## 1. What we send

The **onboarding series** (welcome, week-1 and week-2 tips, the activation
nudge and win-back) is not livedesign's: liveworkspace's accounts Worker
sends one series per account, whichever app it signed up through
([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md)
"Sign-ups and milestones per app"), and reads the shared `notifyTips` setting
before each. livedesign reports what it takes to schedule it: a sign-up
sighting (§4) and the owner's activity (§5).

livedesign sends the rest, two kinds:

**Transactional — always send (when the feature is on):**

1. **Team invite** — when an email address is invited to a team ([Teams](../013-workspace/teams.md)), the
   invitee gets a message with a link to sign in and view/accept the invite
   (`/explorer/invites`), and a quieter **Decline invite** link to
   `/join/decline?token=<token>` that turns it down with no account and no
   sign-in ([Teams → Declining from the email](../013-workspace/teams.md#declining-from-the-email)).
2. **Account deleted** — after a user deletes their account (spec: account
   self-deletion), a confirmation that their livedesign data and their
   liveworkspace account are gone.

[Account settings & email notifications](profile-and-email-notifications.md) adds two further opt-out
notifications — **someone joined my design** and **someone responded to my team
invite** — read from the person's [User preferences](../007-editor/user-preferences.md), set in the Settings dialog.

**Later additions (same gate + best-effort `ctx.waitUntil` contract):**

3. **Milestone** (#6, opt-out `notifyMilestones`) — a celebration when an owner's
   design count reaches 10, fired on a genuine create. Claimed once per account
   from the accounts Worker before it is sent (`claimMilestone`, milestone
   `milestone`), which dedups a burst of saves across isolates.
   **First share** (opt-out `notifyMilestones`) is the same, claimed as
   `firstShare` when an owner makes their first share link.
4. **API-token expiry** (#3, transactional) — 7 days before a token's 6-month
   expiry, so a script / connected tool doesn't silently break. Daily cron.
   `api_tokens.expiry_warned_at`, the baseline migration.
5. **New comment** (#1, opt-out `notifyComments`) — when someone other than the
   owner comments on a design (either comment path), the owner is emailed
   **immediately** (no cron). Never includes the comment text. On the tab save
   it counts only the saver's own new comments: a save can carry a peer's
   comment that reached the saver live first, and that is not the saver
   commenting.
6. **Action assigned** (opt-out `notifyActionAssigned`) — a teammate assigned
   the recipient an action ([Assigned actions](../012-collaboration/assigned-actions.md)).
7. **Mentioned** (opt-out `notifyMentions`) — a teammate @-mentioned the
   recipient in a comment ([Comment mentions](../012-collaboration/comment-mentions.md)). Unlike the owner's new-comment email it
   quotes the comment (the first 280 characters): the recipient was named in
   it, and the design is in their own team's library.
8. **Team invite reminders** (transactional, kinds `TeamInviteReminder1` /
   `TeamInviteReminder2` / `TeamInviteReminder3`) — 1, 7 and 21 days after an
   invite nobody has answered, from the daily cron, each with its own Decline
   invite link. The invite expires (is rejected) 28 days after it was sent. Not
   opt-out: the recipient may have no account to hold a preference, and the
   Decline link is the one-click way to stop them. Stamps on the invite's own
   `team_members` row (`reminder1_sent_at` to `reminder3_sent_at`, `reminder_attempts`, `clock_started_at`, the baseline migration); see [Teams → Reminders and expiry](../013-workspace/teams.md#reminders-and-expiry).

The opt-out notification categories (`notifyComments`, `notifyMilestones`,
`notifyMentions`, `notifyActionAssigned`) join the [Account settings & email notifications](profile-and-email-notifications.md) pair in `getNotificationPrefs`
(`apps/api/src/accounts/settings.ts`, one settings read) and as switches in
Settings > Notifications; every opt-out email's footer links to
`/explorer?settings=notifications` (also emitted as a `List-Unsubscribe` header; the old `/explorer/profile` URL in already-sent mail redirects there, see [Account settings & email notifications](profile-and-email-notifications.md)) so the
recipient can turn it off in one click. The opt-out toggles are
documented for users in the [Email Notifications](../../../apps/help/app/account-and-data/email-notifications/page.mdx)
help article.

## 2. Gating — the secret is the switch

- `RESEND_API_KEY` (secret) — when **unset**, `emailEnabled(env)` is false and
  every send is a no-op, so a deployment with email off does zero extra work.
- `RESEND_FROM` (plain var, optional) — the From identity. Default
  `livedesign <hello@livedesign.app>`. Requires a domain verified in Resend.
- `APP_BASE_URL` (plain var, optional) — public origin for links in emails.
  Default `https://livedesign.app`.

Local dev: drop `RESEND_API_KEY=re_…` into `apps/api/.dev.vars` (gitignored).
Production: `wrangler secret put RESEND_API_KEY`.

## 3. Where addresses come from

livedesign stores no address of its own. A person's address is their
liveworkspace account's **verified** email, asked of the accounts Worker
(`accountEmails`, `emailsOf` / `emailOf` in `apps/api/src/accounts/people.ts`).
A send that names several people (the admins told of an invite response, the
owners of expiring tokens) asks for all of their addresses in one request.
Guests have no address and never receive email; an invitee who has no account
yet is written to at the address an Admin typed.

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

- `apps/api/src/email/client.ts` — `emailEnabled(env)` + `sendEmail(env, msg)`
  (POST `https://api.resend.com/emails`, `Bearer RESEND_API_KEY`). Never throws:
  returns `{ sent }` and logs on failure, so email is always best-effort and
  never blocks or fails the caller.
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
- Hooks: invite in `routes/teams.ts` (invite create), invite reminders + expiry
  and token expiry in `scheduled()` (`email/team-invite-reminders.ts`,
  `email/token-expiry.ts`), notifications in `email/notifications.ts`, deletion
  in `routes/account.ts`.

All sends use `ctx.waitUntil` (or are already in the cron) — email is never on
the request's critical path.

**Counting sends ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).** `sendEmail` writes one
anonymous `Email·Sent·<kind>` event (`reportServerEvent`), and a failure
writes `Error·Api·Http<status>.SendEmail` (or `Network.SendEmail` when the
request never completed). Server-side rather than through `POST /api/events`
because nothing about an email reaches a browser: the send happens in a cron or
a `waitUntil` after the response has gone, so this is the only place that can
count it. Before this, a dead
`RESEND_API_KEY` was invisible — every failure went to `console.error` and
nowhere else. Gated on `TELEMETRY_ENABLED` like every other emit, and its own
failure is swallowed: telemetry must never turn a delivered email into a thrown
send. The template kind and nothing else goes on the wire — never an address, a
name, or a recipient count.

## 7. Privacy / security

- Authenticated-only; the address is the verified token claim, never input.
- No design content, names, or anything the user typed is ever in an email
  beyond the team name (already known to the invitee's inviter) and the user's
  own email.
- The team invite and its reminders go to an address an Admin typed, which may
  have no account: that is why they carry no account footer, and why their only
  credential is the single-purpose decline token, stored hashed
  ([Teams → Declining from the email](../013-workspace/teams.md#declining-from-the-email)).
- Off by default; self-hosters opt in by providing their own Resend key + domain
  (keeps [Open source + distribution](../002-project-scope/open-source-and-business-model.md) self-hosting intact — no required SaaS call).

## 8. Out of scope (for now)

Dark-mode email variants, bounce handling beyond the invite reminders' attempt cap (Resend handles
delivery; sends are best-effort, and one-time ones are idempotent through their claims and stamps). Per-notification
**email preferences** are no longer out of scope — [Account settings & email notifications](profile-and-email-notifications.md)
adds an opt-out toggle for each of its two transactional notifications, stored
with the person's [User preferences](../007-editor/user-preferences.md).
