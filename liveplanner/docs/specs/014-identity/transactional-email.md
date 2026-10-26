# Transactional email

**Status: in progress.** Optional. The api worker sends a small set of account emails through
Cloudflare Email Service, as every liveworkspace app does ([liveworkspace/docs/specs/003-accounts/email.md](../../../../liveworkspace/docs/specs/003-accounts/email.md)).
There is no third-party provider and no API key: the worker's `send_email` binding, `EMAIL`, is the
credential. The feature is **entirely gated on that binding**: a deployment without it is inert —
no sends, no new request work — and everything else behaves exactly as before. Guests and the editor stay
account-free and never receive email.

## 1. What we send

**Onboarding — sent by liveworkspace, not here.** The welcome, activation nudge,
week 1, week 2 and win-back series is one per liveworkspace account, sent by the
accounts Worker for every app ([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md)
"Onboarding emails"), which also counts those sends. liveplanner keeps no
lifecycle table and runs no sweep; it reports when someone's plan is saved
(`reportActivity`, the newest save of a plan they own, pushed from the plan's
room at most once a minute) so the series knows who is active.

**Transactional — always send (when the feature is on):**

1. **Team invite**: not sent by liveplanner: teams, their invitations
   and those emails (the invite, its reminders and the answer to the admins)
   belong to the liveworkspace account and come from liveworkspace, which also
   counts them ([Teams](../013-workspace/teams.md)).
2. **Account deleted** — after a user deletes their account (spec: account
   self-deletion), a confirmation that their liveplanner data and their
   liveworkspace account are gone.
3. **New comment** (#1, opt-out `notifyComments`) — when someone other than the
   owner comments on a project (either comment path), the owner is emailed
   **immediately** (no cron), at most once a project per 15 minutes. Never
   includes the comment text. On the tab save it counts only the saver's own
   new comments: a save can carry a peer's comment that reached the saver live
   first, and that is not the saver commenting.
4. **Form response** and **form suspended** (opt-out `notifyFormResponses` for
   the first) — someone filled in one of the owner's forms, or a form was
   suspended after reports ([Forms](../030-forms/forms.md) "Hearing about
   responses").
5. **API-token expiry** — not sent by liveplanner: API tokens belong to the
   liveworkspace account ([Public API + tokens](../015-api/public-api-and-tokens.md)),
   and liveworkspace warns the owner a week before one expires, for every app
   ([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md) "Expiry warnings").
6. **Someone joined my plan** (opt-out `notifyProjectJoin`) — a signed-in person
   opened one of the owner's plans through a share link for the first time. The
   index says so (its `joined` notice, [One Explorer contracts](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md)
   "Notices"), and the plan's room emails the owner, at most once a plan per 15
   minutes. Never for a guest or the owner.
7. **Milestones** (opt-out `notifyMilestones`) — the owner's **tenth plan** (the
   index's count of the plans they have made, the Trash's included, asked when
   they make one), and the **first share link** they make (the index's `shared`
   notice). Each goes once per account, claimed at liveworkspace
   (`milestones/claim`) before it is sent.
8. **Action assigned** (opt-out `notifyActionAssigned`) and **mentioned**
   (opt-out `notifyMentions`) — a teammate assigned you an action, or
   @-mentioned you in a comment, on a team plan ([Assigned actions](../012-collaboration/assigned-actions.md) §4,
   [Comment mentions](../012-collaboration/comment-mentions.md) "The email"). The recipient is
   one of the plan's team's people as liveworkspace keeps the team; the same
   email goes once a day, and one sender's are capped at 60 an hour across all their plans.

How each is sent, and what it asks of liveworkspace: addresses and switches for
many people in one go (`notificationRecipients`), a team's people
(`readTeamPeople`), and the milestone claim, all in `@liveworkspace/auth-client`
(`notify.ts`), which every app shares, with the windows and caps. The once-only
state of the join, assignment and mention emails is the plan's own
(`notify_claims` in its SQLite, pruned to a day); liveplanner has no D1.

The opt-out categories liveplanner reads (`notifyComments`, `notifyFormResponses`,
`notifyProjectJoin`, `notifyMilestones`, `notifyActionAssigned`, `notifyMentions`)
join the [Account settings & email notifications](profile-and-email-notifications.md)
switches in Settings > Notifications, beside `notifyTips` and `notifyInviteResponse`,
which the accounts Worker reads for onboarding and team invites. Most are settings
every liveworkspace app shares (the `all` scope, marked "All apps" in Settings),
so turning one off here turns it off in every app; `notifyFormResponses` and
`notifyProjectJoin` are liveplanner's own. Every opt-out email's footer links to
`/explorer?settings=notifications` (also emitted as a `List-Unsubscribe` header), which, like the old `/explorer/profile` URL in already-sent mail, opens the account's notification settings in place ([Account settings & email notifications](profile-and-email-notifications.md)), so the
recipient can turn it off in one click. The opt-out toggles are
documented for users in the [Email Notifications](../../../apps/help/app/account-and-data/email-notifications/page.mdx)
help article.

## 2. Gating — the binding is the switch

- `EMAIL` (`send_email` binding, `[[send_email]] name = "EMAIL"` in `apps/api/wrangler.toml`, restated
  as `[[env.staging.send_email]]` because bindings don't inherit) — when **absent**,
  `emailEnabled(env)` is false and every send is a no-op, so a deployment with email off does no
  extra work for email. Email off means no binding: a fork turns it off by deleting those blocks.
  This mirrors the model-key-absent → AI-hidden pattern.
- Addresses and the notification settings come from the liveworkspace accounts
  Worker (`ACCOUNTS_URL` and the client credentials). A deployment without it
  sends no email: it has no address to send to.
- `EMAIL_FROM` (plain var) — the From identity, `liveplanner <hello@liveplanner.app>` in production
  and staging (and the default when unset). Its domain must be onboarded to Email Service on the
  liveworkspace account, which adds the SPF and DKIM records itself.
- `APP_BASE_URL` (plain var, optional) — public origin for links in emails.
  Default `https://www.liveplanner.app`.

Local dev: nothing to set. `wrangler dev` simulates the binding, printing each email and saving its
text and HTML to files instead of sending it, which is also the way to look over a template.

## 3. Data model

None beyond the plan's own `notify_claims`. An owner's address is looked up when an email is sent
(`accountEmails` from `@liveworkspace/auth-client`, up to 100 ids in one call,
verified addresses only, accounts only). A guest is never emailed. Each plan
keeps its own `notify_claims` rows (key, sender, time) for the join, assignment
and mention emails, a day at most; no text, address or name is in them (the
keys of the last two are SHA-256 hashes).

## 4. Code shape

- `apps/api/src/email/client.ts` — `emailEnabled(env)` + `sendEmail(env, msg)`, which hands the
  message to `@liveworkspace/email`'s `sendEmail(env.EMAIL, …)` (the platform's one caller of the
  binding: it sends `List-Unsubscribe` and gives up after 10 seconds). Never throws: returns
  `{ sent }` and logs on failure, with the address redacted, so email is always best-effort and
  never blocks or fails the caller.
- `apps/api/src/email/templates.ts` — the `{ kind, subject, html }` builders
  (on-brand, inline-styled HTML; links use `APP_BASE_URL`). `kind` is the
  template's telemetry token (see below): it rides on the builder's return so
  it reaches `sendEmail` through the spread every caller already writes,
  instead of being re-stated (and forgotten) at each call site.
  **Branding.** Every builder renders through one shell, so every email looks
  the same: a brand-gradient band across the top of the card (sky-400 to
  blue-700, flat `#0ea5e9` where a client drops gradients), the logo mark beside
  the "live"/"planner" wordmark in the header, a brand-50 page behind the card,
  and a footer under the card with the lockup again, the tagline ("Plan
  the work together, live. Free, no trackers.") and a link to the
  site. Both lockups link to `APP_BASE_URL`. The mark is a transparent 64px PNG
  (`/email/liveplanner-mark-64.png`, shown at 28px in the header and 22px in
  the footer) served by the marketing app and written by `pnpm icons:brand`,
  because Gmail and Outlook drop SVG and most clients block `data:` images.
  Its `alt` is empty, since the wordmark beside it names the product when
  images are blocked. The path is permanent: every email already sent points
  at it.
- `apps/api/src/person/account-app.ts` — what the accounts Worker keeps of an
  account for liveplanner: `ownerEmails` / `ownerEmail`, `recordOwnerSighting`,
  `reportOwnerActivity`. None throws; a failure reads as "no address".
- `apps/api/src/person/notify.ts` — what the notification emails ask of
  liveworkspace: recipients with a switch on (`notifyRecipients`), a team's
  people (`teamPeople`), the milestone claim and the index's count of plans made.
- `@liveworkspace/index-app` `notify-claims.ts` — the plan's once-only claims, and the sender's hourly cap in their own store.
- `apps/api/src/email/notifications.ts` — the notification sends.

All sends use `ctx.waitUntil` — email is never on the request's critical path.

**Counting sends ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).** `sendEmail` reports one
anonymous `Email·Sent·<kind>` event (`reportServerEvent`), and a failure
reports `Error·Api·<code>.SendEmail`, where `<code>` is Email Service's refusal code (such as
`E_RECIPIENT_SUPPRESSED`), or `Network.SendEmail` for a failure without one (a timeout, say). Server-side rather than from a browser
because nothing about an email reaches a browser: the send happens in a cron or
a `waitUntil` after the response has gone, so this is the only place that can
count it. Before this, every email was unmeasurable and a broken
sender was invisible — every failure went to `console.error` and
nowhere else. Gated on `TELEMETRY_ENABLED` like every other emit, and its own
failure is swallowed: telemetry must never turn a delivered email into a thrown
send. The template kind and nothing else goes on the wire — never an address, a
name, or a recipient count.

## 5. Privacy / security

- Authenticated-only; the address is the verified token claim, never input.
- No project content, names, or anything the user typed is ever in an email
  beyond the team name and the user's own email.
- Optional; a deployment opts in by declaring the `EMAIL` binding with a sender on an onboarded
  domain (keeps [Business model + licence](../002-project-scope/business-model-and-licence.md)'s degrade-never-break rule — no required SaaS call).

## 6. Out of scope (for now)

Dark-mode email variants, bounce handling (Email Service handles delivery and
refuses suppressed recipients; sends are best-effort). Per-notification **email preferences** are in scope, [Account settings & email notifications](profile-and-email-notifications.md)
adds an opt-out toggle for each notification, stored in the person's settings at
the accounts Worker ([User preferences](../007-editor/user-preferences.md)).
