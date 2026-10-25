# Transactional email (Resend)

**Status: in progress.** Optional, off by default. Wires [Resend](https://resend.com)
into the api worker so the product can send a small set of account emails. Like
sign-in ([Auth + guest access](auth-and-guest-access.md)), it is **entirely gated on a secret**: when
`RESEND_API_KEY` is absent the whole feature is inert — no sends, no new request
work — and everything else behaves exactly as before. Guests and the canvas stay
account-free and never receive email.

## 1. What we send

**Onboarding — sent by liveworkspace, not here.** The welcome, activation nudge,
week 1, week 2 and win-back series is one per liveworkspace account, sent by the
accounts Worker for every app ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md)
"Onboarding emails"). livedocuments keeps no lifecycle table and runs no sweep; it
reports when someone saves a document they own (`reportActivity`: a genuine
create, and each summary push from a document's room) so the series knows who
is active.

**Transactional — always send (when the feature is on):**

1. **Team invite** — no longer sent by livedocuments: teams, their invitations
   and those emails (the invite, its reminders and the answer to the admins)
   belong to the liveworkspace account and come from liveworkspace, which also
   counts them ([Teams](../013-workspace/teams.md)).
2. **Account deleted** — after a user deletes their account (spec: account
   self-deletion), a confirmation that their livedocuments data and their
   liveworkspace account are gone.
3. **New comment** (#1, opt-out `notifyComments`) — when someone other than the
   owner comments on a document (either comment path), the owner is emailed
   **immediately** (no cron), at most once a document per 15 minutes. Never
   includes the comment text. On the tab save it counts only the saver's own
   new comments: a save can carry a peer's comment that reached the saver live
   first, and that is not the saver commenting.
4. **API-token expiry** — not sent by livedocuments: API tokens belong to the
   liveworkspace account ([Public API + tokens](../015-api/public-api-and-tokens.md)),
   and liveworkspace warns the owner a week before one expires, for every app
   ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md) "Expiry warnings").
5. **Someone joined my document** (opt-out `notifyDocumentJoin`) — a signed-in person
   opened one of the owner's documents through a share link for the first time. The
   index says so (its `joined` notice, [One Explorer contracts](../../../../liveworkspace/docs/one-explorer-contracts.md)
   "Notices"), and the document's room emails the owner, at most once a document per 15
   minutes. Never for a guest or the owner.
6. **Milestones** (opt-out `notifyMilestones`) — the owner's **tenth document** (the
   index's count of the documents they have made, the Trash's included, asked when
   they make one), and the **first share link** they make (the index's `shared`
   notice). Each goes once per account, claimed at liveworkspace
   (`milestones/claim`) before it is sent.
7. **Action assigned** (opt-out `notifyActionAssigned`) and **mentioned**
   (opt-out `notifyMentions`) — a teammate assigned you an action, or
   @-mentioned you in a comment, on a team document ([Assigned actions](../012-collaboration/assigned-actions.md) §4,
   [Comment mentions](../012-collaboration/comment-mentions.md) "The email"). The recipient is
   one of the document's team's people as liveworkspace keeps the team; the same
   email goes once a day, and one sender's are capped at 60 an hour across all their documents.

How each is sent, and what it asks of liveworkspace: addresses and switches for
many people in one go (`notificationRecipients`), a team's people
(`readTeamPeople`), and the milestone claim, all in `@liveworkspace/auth-client`
(`notify.ts`), which every app shares, with the windows and caps. The once-only
state of the join, assignment and mention emails is the document's own
(`notify_claims` in its SQLite, pruned to a day); the api keeps no other email state.

The opt-out categories livedocuments reads (`notifyComments`,
`notifyDocumentJoin`, `notifyMilestones`, `notifyActionAssigned`, `notifyMentions`)
join the [Account settings & email notifications](profile-and-email-notifications.md)
switches in Settings > Notifications, beside `notifyTips` and `notifyInviteResponse`,
which the accounts Worker reads for onboarding and team invites. Most are settings
every liveworkspace app shares (the `all` scope, marked "All apps" in Settings),
so turning one off here turns it off in every app; `notifyDocumentJoin` is
livedocuments' own. Every opt-out email's footer links to
`/explorer?settings=notifications` (also emitted as a `List-Unsubscribe` header; the old `/explorer/profile` URL in already-sent mail redirects there, see [Account settings & email notifications](profile-and-email-notifications.md)) so the
recipient can turn it off in one click. The opt-out toggles are
documented for users in the [Email Notifications](../../../apps/help/app/account-and-data/email-notifications/page.mdx)
help article.

## 2. Gating — the secret is the switch

- `RESEND_API_KEY` (secret) — when **unset**, `emailEnabled(env)` is false and
  every send is a no-op, so a deployment with email off does no extra work for
  email. This mirrors the model-key-absent → AI-hidden pattern.
- Addresses, milestone claims and the notification settings come from the
  liveworkspace accounts Worker (`ACCOUNTS_URL` and the client credentials). A
  deployment without it sends no email: it has no address to send to.
- `RESEND_FROM` (plain var, optional) — the From identity. Default
  `livedocuments <hello@livedocuments.app>`. Requires a domain verified in Resend.
- `APP_BASE_URL` (plain var, optional) — public origin for links in emails.
  Default `https://livedocuments.app`.

Local dev: drop `RESEND_API_KEY=re_…` into `apps/api/.dev.vars` (gitignored).
Production: `wrangler secret put RESEND_API_KEY`.

## 3. Data model

None beside the document's `notify_claims`: the api keeps no address. An owner's address is looked up when an email is sent
(`accountEmails` from `@liveworkspace/auth-client`, up to 100 ids in one call,
verified addresses only, accounts only). A guest is never emailed. Each document
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
  the same: a brand-gradient band across the top of the card (amber-400 to
  orange-700, flat brand-700 `#a34a0c` where a client drops gradients), the logo mark beside
  the "live"/"documents" wordmark in the header, a brand-50 page behind the card,
  and a footer under the card with the lockup again, the tagline ("Make pages together, live. Free and
  open source.") and a link to the
  site. Both lockups link to `APP_BASE_URL`. The mark is a transparent 64px PNG
  (`/email/livedocuments-mark-64.png`, shown at 28px in the header and 22px in
  the footer) served by the marketing app and written by `pnpm icons:brand`,
  because Gmail and Outlook drop SVG and most clients block `data:` images.
  Its `alt` is empty, since the wordmark beside it names the product when
  images are blocked. The path is permanent: every email already sent points
  at it.
- `apps/api/src/person/account-app.ts` — what the accounts Worker keeps of an
  account for livedocuments: `ownerEmails` / `ownerEmail`, `recordOwnerSighting`,
  `reportOwnerActivity`. None throws; a failure reads as "no address".
- `apps/api/src/person/notify.ts` — what the notification emails ask of
  liveworkspace: recipients with a switch on (`notifyRecipients`), a team's
  people (`teamPeople`), the milestone claim and the index's count of documents made.
- `@liveworkspace/index-app` `notify-claims.ts` — the document's once-only claims, and the sender's hourly cap in their own store.
- `apps/api/src/email/notifications.ts` — the notification sends.

All sends use `ctx.waitUntil` — email is never on the request's critical path.

**Counting sends ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).** `sendEmail` writes one
anonymous `Email·Sent·<kind>` event (`reportServerEvent`), and a failure
writes `Error·Api·Http<status>.SendEmail` (or `Network.SendEmail` when the
request never completed). Server-side rather than through `POST /api/events`
because nothing about an email reaches a browser: the send happens in a
`waitUntil` after the response has gone (in the worker or the document's Durable Object), so this is the only place that can
count it. Before this, every email was unmeasurable and a dead
`RESEND_API_KEY` was invisible — every failure went to `console.error` and
nowhere else. Gated on `TELEMETRY_ENABLED` like every other emit, and its own
failure is swallowed: telemetry must never turn a delivered email into a thrown
send. The template kind and nothing else goes on the wire — never an address, a
name, or a recipient count.

## 5. Privacy / security

- Authenticated-only; the address is the verified token claim, never input.
- No document content, names, or anything the user typed is ever in an email
  beyond the team name and the user's own email.
- Off by default; a deployment opts in by providing a Resend key + domain
  (keeps [Open source + distribution](../002-project-scope/open-source-and-business-model.md) intact — no required SaaS call).

## 6. Out of scope (for now)

Dark-mode email variants, bounce handling (Resend handles delivery; sends are
best-effort, and milestones idempotent via their claims). Per-notification
**email preferences** are no longer out of scope — [Account settings & email notifications](profile-and-email-notifications.md)
adds an opt-out toggle for each of its two transactional notifications, stored
in the [User preferences](../007-editor/user-preferences.md) preference blob.
