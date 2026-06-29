# 64 — Transactional & lifecycle email (Resend)

**Status: in progress.** Optional, off by default. Wires [Resend](https://resend.com)
into the api worker so the product can send a small set of account emails. Like
Clerk (spec/04) and AI (spec/25), it is **entirely gated on a secret**: when
`RESEND_API_KEY` is absent the whole feature is inert — no sends, no new request
work — and everything else behaves exactly as before. Guests and the canvas stay
account-free and never receive email.

## 1. What we send

Five messages, two kinds:

**Lifecycle (onboarding) — signed-in users only:**

1. **Welcome** — sent the first time we see an authenticated user. Tips on
   building a first diagram (shapes, arrows, templates).
2. **Week 1** — ~7 days after the welcome. Tips on the Explorer (folders,
   search, recents, sharing from the grid).
3. **Week 2** — ~14 days after the welcome. Introduces Teams (shared diagrams,
   inviting people, Admin/Member roles — spec/32).

**Transactional — always send (when the feature is on):**

4. **Team invite** — when an email address is invited to a team (spec/32), the
   invitee gets a message with a link to sign in and view/accept the invite
   (`/explorer/invites`).
5. **Account deleted** — after a user deletes their account (spec: account
   self-deletion), a confirmation that the account and its data are gone.

[spec/65](65-profile-and-email-notifications.md) adds two further transactional
messages — **someone joined my diagram** and **someone responded to my team
invite** — each opt-**out** per user via a notification preference, on the same
`RESEND_API_KEY` gate and the same best-effort `ctx.waitUntil` contract.

The lifecycle series has **no unsubscribe link** for now (decision: treat as
low-volume onboarding). If that changes, add an `unsubscribed_at` column +
a public `GET /api/email/unsubscribe?token=…` endpoint and skip the series for
unsubscribed rows; the schema below leaves room for it.

## 2. Gating — the secret is the switch

- `RESEND_API_KEY` (secret) — when **unset**, `emailEnabled(env)` is false and
  every send is a no-op. No `email_lifecycle` writes happen either (the
  first-sighting upsert is itself guarded), so a deployment with email off does
  zero extra work. This mirrors the `OPENAI_API_KEY`-absent → AI-hidden pattern.
- `RESEND_FROM` (plain var, optional) — the From identity. Default
  `livediagram <hello@livediagram.app>`. Requires a domain verified in Resend.
- `APP_BASE_URL` (plain var, optional) — public origin for links in emails.
  Default `https://livediagram.app`.

Local dev: drop `RESEND_API_KEY=re_…` into `apps/api/.dev.vars` (gitignored).
Production: `wrangler secret put RESEND_API_KEY`.

## 3. Data model

One table, keyed by the owner id (the Clerk `sub` — lifecycle email is
authenticated-only). Migration `0029_email_lifecycle.sql`:

```sql
CREATE TABLE IF NOT EXISTS email_lifecycle (
  owner_id        TEXT PRIMARY KEY,   -- Clerk user id (verified)
  email           TEXT NOT NULL,      -- from the verified session token only
  created_at      INTEGER NOT NULL,   -- first authenticated sighting (ms)
  welcome_sent_at INTEGER,
  week1_sent_at   INTEGER,
  week2_sent_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_email_lifecycle_due ON email_lifecycle (created_at);
```

The `email` is only ever the **verified** `email` claim from the Clerk session
token (spec/32) — never a client-supplied value, never a guest. Rows exist only
for authenticated owners.

## 4. Sign-up detection — first authenticated sighting

On any request carrying a verified Clerk identity (userId + email), and only
when `emailEnabled`, the worker does an `INSERT … ON CONFLICT DO NOTHING` into
`email_lifecycle`. If a **new** row was created (`meta.changes === 1`), that
first sighting is treated as sign-up: send the welcome and stamp
`welcome_sent_at`. All of this runs in `ctx.waitUntil(...)` so it never delays
the response, and is wrapped so an email/D1 hiccup can't fail the user's request.

**Existing-deployment caveat:** first-sighting means that turning Resend on for a
deployment that already has users would welcome each of them on their next
sign-in. Before enabling on such a deployment, backfill the table so existing
owners are marked as already-sent (no email fires for them):

```sql
INSERT OR IGNORE INTO email_lifecycle
  (owner_id, email, created_at, welcome_sent_at, week1_sent_at, week2_sent_at)
SELECT DISTINCT owner_id, '', 0, 0, 0, 0 FROM diagrams WHERE owner_id LIKE 'user_%';
```

(The `'user_%'` prefix targets Clerk ids, skipping guest UUID owners.)

## 5. Scheduling the series — the existing daily cron

The api worker already runs `crons = ["0 3 * * *"]`. Its `scheduled()` handler
gains a step (guarded by `emailEnabled`): select a bounded batch of rows where
`created_at <= now - 7d AND week1_sent_at IS NULL`, send the Explorer email and
stamp `week1_sent_at`; same for `14d` / `week2_sent_at` (Teams). Daily cadence
means "after 1 week" resolves to the first daily run on/after day 7 — close
enough for onboarding; no per-user timers.

## 6. Code shape

- `apps/api/src/email/client.ts` — `emailEnabled(env)` + `sendEmail(env, msg)`
  (POST `https://api.resend.com/emails`, `Bearer RESEND_API_KEY`). Never throws:
  returns `{ sent }` and logs on failure, so email is always best-effort and
  never blocks or fails the caller.
- `apps/api/src/email/templates.ts` — the five `{ subject, html }` builders
  (on-brand, inline-styled HTML; links use `APP_BASE_URL`).
- `apps/api/src/db/email-lifecycle.ts` — sighting upsert (returns "is new"), the
  two due-queries + mark-sent, and row deletion (called from `deleteAccount`).
- Hooks: welcome in the request path (`index.ts`), week1/week2 in `scheduled()`,
  invite in `routes/teams.ts` (invite create), deletion in `routes/account.ts`.

All sends use `ctx.waitUntil` (or are already in the cron) — email is never on
the request's critical path.

## 7. Privacy / security

- Authenticated-only; the address is the verified token claim, never input.
- No diagram content, names, or anything the user typed is ever in an email
  beyond the team name (already known to the invitee's inviter) and the user's
  own email.
- Off by default; self-hosters opt in by providing their own Resend key + domain
  (keeps spec/03 self-hosting intact — no required SaaS call).

## 8. Out of scope (for now)

Unsubscribe endpoint for the lifecycle series, HTML theming beyond simple
inline styles, retries/bounce handling (Resend handles delivery; sends are
best-effort and idempotent via the `*_sent_at` stamps). Per-notification
**email preferences** are no longer out of scope — [spec/65](65-profile-and-email-notifications.md)
adds an opt-out toggle for each of its two transactional notifications, stored
in the spec/20 preference blob.
