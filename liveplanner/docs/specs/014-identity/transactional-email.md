# Transactional email (Resend)

**Status: in progress.** Optional, off by default. Wires [Resend](https://resend.com)
into the api worker so the product can send a small set of account emails. Like
sign-in ([Auth + guest access](auth-and-guest-access.md)), it is **entirely gated on a secret**: when
`RESEND_API_KEY` is absent the whole feature is inert — no sends, no new request
work — and everything else behaves exactly as before. Guests and the editor stay
account-free and never receive email.

## 1. What we send

**Onboarding — sent by liveworkspace, not here.** The welcome, activation nudge,
week 1, week 2 and win-back series is one per liveworkspace account, sent by the
accounts Worker for every app ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md)
"Onboarding emails"), which also counts those sends. liveplanner keeps no
lifecycle table and runs no sweep; it reports when someone's plan is saved
(`reportActivity`, the newest save of a plan they own, pushed from the plan's
room at most once a minute) so the series knows who is active.

**Transactional — always send (when the feature is on):**

1. **Team invite** — no longer sent by liveplanner: teams, their invitations
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
   ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md) "Expiry warnings").
6. **Someone joined my plan** (opt-out `notifyProjectJoin`) — a signed-in person
   opened one of the owner's plans through a share link for the first time. The
   index says so (its `joined` notice, [One Explorer contracts](../../../../liveworkspace/docs/one-explorer-contracts.md)
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
(`notify_claims` in its SQLite, pruned to a day); liveplanner's D1 holds none.

The opt-out categories liveplanner reads (`notifyComments`, `notifyFormResponses`,
`notifyProjectJoin`, `notifyMilestones`, `notifyActionAssigned`, `notifyMentions`)
join the [Account settings & email notifications](profile-and-email-notifications.md)
switches in Settings > Notifications, beside `notifyTips` and `notifyInviteResponse`,
which the accounts Worker reads for onboarding and team invites. Most are settings
every liveworkspace app shares (the `all` scope, marked "All apps" in Settings),
so turning one off here turns it off in every app; `notifyFormResponses` and
`notifyProjectJoin` are liveplanner's own. Every opt-out email's footer links to
`/explorer?settings=notifications` (also emitted as a `List-Unsubscribe` header), which, like the old `/explorer/profile` URL in already-sent mail, lands on the account's notification settings on liveworkspace.app ([Account settings & email notifications](profile-and-email-notifications.md)), so the
recipient can turn it off in one click. The opt-out toggles are
documented for users in the [Email Notifications](../../../apps/help/app/account-and-data/email-notifications/page.mdx)
help article.

## 2. Gating — the secret is the switch

- `RESEND_API_KEY` (secret) — when **unset**, `emailEnabled(env)` is false and
  every send is a no-op, so a deployment with email off does no extra work for
  email. This mirrors the model-key-absent → AI-hidden pattern.
- Addresses and the notification settings come from the liveworkspace accounts
  Worker (`ACCOUNTS_URL` and the client credentials). A deployment without it
  sends no email: it has no address to send to.
- `RESEND_FROM` (plain var, optional) — the From identity. Default
  `liveplanner <hello@liveplanner.app>`. Requires a domain verified in Resend.
- `APP_BASE_URL` (plain var, optional) — public origin for links in emails.
  Default `https://liveplanner.app`.

Local dev: drop `RESEND_API_KEY=re_…` into `apps/api/.dev.vars` (gitignored).
Production: `wrangler secret put RESEND_API_KEY`.

## 3. Data model

None in liveplanner's D1. An owner's address is looked up when an email is sent
(`accountEmails` from `@liveworkspace/auth-client`, up to 100 ids in one call,
verified addresses only, accounts only). A guest is never emailed. Each plan
keeps its own `notify_claims` rows (key, sender, time) for the join, assignment
and mention emails, a day at most; no text, address or name is in them (the
keys of the last two are SHA-256 hashes).

## 4. Code shape

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
reports `Error·Api·Http<status>.SendEmail` (or `Network.SendEmail` when the
request never completed). Server-side rather than from a browser
because nothing about an email reaches a browser: the send happens in a cron or
a `waitUntil` after the response has gone, so this is the only place that can
count it. Before this, every email was unmeasurable and a dead
`RESEND_API_KEY` was invisible — every failure went to `console.error` and
nowhere else. Gated on `TELEMETRY_ENABLED` like every other emit, and its own
failure is swallowed: telemetry must never turn a delivered email into a thrown
send. The template kind and nothing else goes on the wire — never an address, a
name, or a recipient count.

## 5. Privacy / security

- Authenticated-only; the address is the verified token claim, never input.
- No project content, names, or anything the user typed is ever in an email
  beyond the team name and the user's own email.
- Off by default; a deployment opts in by providing a Resend key + domain
  (keeps [Business model + licence](../002-project-scope/business-model-and-licence.md)'s degrade-never-break rule — no required SaaS call).

## 6. Out of scope (for now)

Dark-mode email variants, bounce handling (Resend handles delivery; sends are
best-effort). Per-notification **email preferences** are no longer out of
scope — [Account settings & email notifications](profile-and-email-notifications.md)
adds an opt-out toggle for each notification, stored in the person's settings at
the accounts Worker ([User preferences](../007-editor/user-preferences.md)).
