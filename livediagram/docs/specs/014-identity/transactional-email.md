# Transactional & lifecycle email

**Status: in progress.** Optional, off without its binding. The api worker sends a small set of account
emails through Cloudflare Email Service, the way every app on the platform does
([Email](../../../../liveworkspace/docs/email.md)). Like sign-in ([Auth + guest access](auth-and-guest-access.md)) and the photo reader
([Note reader](../021-event-storming/note-reader.md)), it is **entirely gated on configuration**, here the
`send_email` binding `EMAIL`: when it is absent the whole feature is inert — no sends, no new request
work — and everything else behaves exactly as before. Guests and the canvas stay
account-free and never receive email.

## 1. What we send

livediagram sends the emails about what happens in livediagram. The account's own
emails come from liveworkspace, once for every app: the welcome, the onboarding
series (week 1, week 2, the activation nudge, win-back, all opt-out `notifyTips`),
team invitations, their reminders and answers, and API-token notices
(liveworkspace/docs/accounts.md "Onboarding emails"). livediagram tells
liveworkspace what it needs for them: each signed-in account it sees (a sighting,
which also counts sign-ups) and each save of a document someone owns (activity,
once a minute a document, `apps/api/src/liveworkspace/activity.ts`).

**Transactional — always send (when the feature is on):**

1. **Account deleted** — after a user deletes their account (spec: account
   self-deletion), a confirmation that their livediagram data and their
   liveworkspace account are gone.

**Notifications — each opt-out, read from the preference blob
([User preferences](../007-editor/user-preferences.md)), set in the Settings dialog:**

2. **Someone joined my document** (`notifyDocumentJoin`) —
   [Account settings & email notifications](profile-and-email-notifications.md).
3. **New comment** (opt-out `notifyComments`) — when someone other than the
   owner comments on a document (either comment path), the owner is emailed
   **immediately** (no cron). Never includes the comment text. On the tab save
   it counts only the saver's own new comments: a save can carry a peer's
   comment that reached the saver live first, and that is not the saver
   commenting.
4. **Action assigned** (opt-out `notifyActionAssigned`) — a teammate assigned
   the recipient an action ([Assigned actions](../012-collaboration/assigned-actions.md)).
5. **Mentioned** (opt-out `notifyMentions`) — a teammate @-mentioned the
   recipient in a comment ([Comment mentions](../012-collaboration/comment-mentions.md)). Unlike the owner's new-comment email it
   quotes the comment (the first 280 characters): the recipient was named in
   it, and the document is in their own team's library.

**Milestones — once each, opt-out `notifyMilestones`:**

6. **Milestone** — a celebration when an owner's document count reaches 10,
   fired on a genuine create.
7. **First share** — the first time an owner shares a document.

Each milestone is claimed from liveworkspace before it is sent
(`claimMilestone(credentials, { userId, milestone: 'milestone' | 'firstShare' })`):
only the first claim answers true, so a burst of saves sends one email, and any
doubt (liveworkspace out of reach) sends none. liveworkspace keeps the claim per
app, so each app celebrates its own.

The opt-out switches are read in `getNotificationPrefs`
(`apps/api/src/liveworkspace/notification-prefs.ts`), from the preferences
liveworkspace keeps; all but `notifyDocumentJoin` are in the `all` scope, so
turning one off in any app turns it off everywhere. Every opt-out email's footer
links to `/explorer?settings=notifications` (also emitted as a
`List-Unsubscribe` header; the old `/explorer/profile` URL in already-sent mail
redirects there, see [Account settings & email notifications](profile-and-email-notifications.md)) so the
recipient can turn it off in one click. The opt-out toggles are
documented for users in the [Email Notifications](../../../apps/help/app/account-and-data/email-notifications/page.mdx)
help article.

## 2. Gating — the binding is the switch

- `EMAIL` (the `send_email` binding, declared in `apps/api/wrangler.toml` as `[[send_email]]` and restated
  as `[[env.staging.send_email]]`, since bindings don't inherit) — when it is **absent**,
  `emailEnabled(env)` is false and every send is a no-op, so a deployment with email off does zero extra
  work. There is no API key: the binding is the credential. This mirrors the model-key-absent → AI-hidden
  pattern. A fork turns email off by leaving the binding out.
- Sign-in (`ACCOUNTS_URL` and the client credentials): the addresses are
  liveworkspace's, so without it nobody has one and nothing is sent.
- `EMAIL_FROM` (plain var) — the From identity, a bare address or `Name <address>`. Its domain must be
  onboarded to Email Service on this account. livediagram.app isn't on it yet, so production and staging
  both send as `livediagram <hello@liveplanner.app>` until it moves
  ([Email](../../../../liveworkspace/docs/email.md) "Senders until the domains move"). Unset, it defaults to
  `livediagram <hello@livediagram.app>`.
- `APP_BASE_URL` (plain var, optional) — public origin for links in emails.
  Default `https://livediagram.app`.

Local dev: nothing to set. `wrangler dev` simulates the binding, printing each email and saving its HTML
to a file, so nothing is sent. Production and staging: the binding in `wrangler.toml` is all there is.

## 3. Data model

livediagram keeps no address and no email state of its own. liveworkspace answers
each account's **verified** address (`accountEmails(credentials, ids)`, up to 100
ids a call; an account without a verified address is left out), and keeps the
milestone claims. A notification to several people (a team's admins) asks for
every address in one call. Guests have no address and never receive email.

## 6. Code shape

- `apps/api/src/email/client.ts` — `emailEnabled(env)` + `sendEmail(env, msg)`, which hands the message
  to `@liveworkspace/email`'s `sendEmail(env.EMAIL, …)` (the one place that calls the binding; it sends
  `List-Unsubscribe` and gives up after 10 seconds). Never throws: returns `{ sent }` and logs on failure,
  with the address redacted, so email is always best-effort and never blocks or fails the caller.
- `apps/api/src/email/templates.ts` — the `{ kind, subject, html }` builders
  (on-brand, inline-styled HTML; links use `APP_BASE_URL`). `kind` is the
  template's telemetry token (see below): it rides on the builder's return so
  it reaches `sendEmail` through the spread every caller already writes,
  instead of being re-stated (and forgotten) at each call site.
  **Branding.** Every builder renders through one shell, so every email looks
  the same: a brand-gradient band across the top of the card (sky-400 to
  blue-700, flat `#0ea5e9` where a client drops gradients), the logo mark beside
  the "live"/"diagram" wordmark in the header, a brand-50 page behind the card,
  and a footer under the card with the lockup again, the tagline ("Diagram,
  draw and make pages together, live. Free and open source.") and a link to the
  site. Both lockups link to `APP_BASE_URL`. The mark is a transparent 64px PNG
  (`/email/livediagram-mark-64.png`, shown at 28px in the header and 22px in
  the footer) served by the marketing app and written by `pnpm icons:brand`,
  because Gmail and Outlook drop SVG and most clients block `data:` images.
  Its `alt` is empty, since the wordmark beside it names the product when
  images are blocked. The path is permanent: every email already sent points
  at it.
- `apps/api/src/liveworkspace/emails.ts` — `getOwnerEmails`
  (the verified addresses, never throwing) and `claimMilestone`.
- `apps/api/src/email/notifications.ts` — the notification sends, each reading
  the address, then the recipient's switch, then sending.

All sends use `ctx.waitUntil` — email is never on the request's critical path.

**Counting sends ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).** `sendEmail` writes one
anonymous `Email·Sent·<kind>` row straight to the events table, and a failure
writes `Error·Api·<code>.SendEmail`: Email Service's refusal code when it gives one (such as
`E_RECIPIENT_SUPPRESSED.SendEmail`), else `Network.SendEmail` (a timeout, or a failure with no code). Server-side rather than through `POST /api/events`
because nothing about an email reaches a browser: the send happens in a
`waitUntil` after the response has gone, so this is the only place that can
count it. Without it a refused sender was invisible — every failure went to `console.error` and
nowhere else. Gated on `TELEMETRY_ENABLED` like every other emit, and its own
failure is swallowed: telemetry must never turn a delivered email into a thrown
send. The template kind and nothing else goes on the wire — never an address, a
name, or a recipient count.

## 7. Privacy / security

- Authenticated-only; the address is the account's verified one from liveworkspace, never input.
- No document content, names, or anything the user typed is ever in an email
  beyond the team name and the user's own email.
- Off without the `EMAIL` binding; on once the binding and an onboarded sender are set
  ([Open source + distribution](../002-project-scope/open-source-and-business-model.md): no required SaaS call).

## 8. Out of scope (for now)

Dark-mode email variants, and bounce handling (Email Service handles delivery and keeps its own suppression list; sends are
best-effort, and the milestone claims keep those to one each).
