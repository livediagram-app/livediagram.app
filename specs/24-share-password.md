# 24, Share password

An optional **password on a diagram** that gates share-link access. When set,
anyone opening any share link for that diagram must enter the password before
they can view it, and the password rides on every subsequent API call so writes
stay gated too. The point is to stop people guessing share URLs, not to provide
cryptographic protection.

Builds on [04-auth-and-guest-access](04-auth-and-guest-access.md) (hybrid
identity, share-code path) and [11-api](11-api.md) (share links).

## Model

- The password is a property of the **diagram**, not of individual links. One
  password covers every share link the owner mints (`spec/11` lets a diagram
  have many). Column: `diagrams.share_password TEXT` (nullable; null / empty =
  no password). Migration `0017_share_password.sql`.
- **Stored in plain text**, deliberately. The owner must be able to read it back
  and change it on the Share screen (the explicit product requirement), so a
  one-way hash won't do. This is acceptable here: the threat model is "stop
  drive-by URL guessing", the value lives in D1 behind the owner-authenticated
  API, and the repo's [secrets policy](06-secrets-policy.md) governs _source_
  secrets, not user data. It is **never** returned in the standard diagram DTO
  (no leak to viewers) — only via the owner-only endpoints below.
- **Verified in constant time and rate-limited.** Even though the password is a
  low-value, anti-guessing secret, the compare uses a timing-safe digest compare
  (`apps/api/src/auth/timing-safe.ts`) rather than `===`, so it can't be peeled a
  byte at a time via response timing, and the unauthenticated share-resolve read
  (`GET /api/share/:code`, which carries the password) is throttled per-IP by the
  optional `SHARE_RATE_LIMITER` binding to bound blind guessing.
- The **owner always bypasses** the password (identified by `ownerId` / Clerk
  `sub`). The gate only applies to non-owner, share-code access.

## API (apps/api)

- `GET /api/diagrams/:id/share` (owner-only, existing): response gains
  `password: string | null` alongside `links`. This is how the Share dialog
  reads the current value to show it.
- `PUT /api/diagrams/:id/share-password` (owner-only, new). Body
  `{ password: string | null }`. A null / empty / whitespace-only value clears
  the password. Returns `{ password: string | null }` (the stored value).
- `GET /api/share/:code` (viewer resolve): if the diagram has a password, return
  **401 `{ error: 'password_required' }`** when the request carries no
  `X-Share-Password`, **403 `{ error: 'password_invalid' }`** when it carries
  the wrong one, and only record the visit + return the diagram on a match.
- Every other share-code-authorised route is gated through
  `canReadDiagram` / `canEditDiagram` (`src/auth/diagram-access.ts`). Both gain a
  `sharePassword` argument: after the link + role check, if the diagram has a
  password and the provided one doesn't match, access is denied. The header is
  `X-Share-Password`, read via `sharePasswordOf(request)` (`routes/context.ts`),
  threaded at every call site (the diagram read/write/log routes + the image
  route). Owner-id and Clerk paths short-circuit before the password check.
- `GET /api/diagrams/:id/ws` (realtime upgrade): browsers can't set headers on a
  WS upgrade, so the password rides as the `p` query param next to `s` / `o`. A
  password-protected diagram refuses the upgrade (403) unless `p` matches; the
  owner (`o` matches) bypasses.

Helpers in `src/db/diagrams.ts` (the db.ts split moved them out of the
old monolithic module): `getDiagramSharePassword(env, id)`,
`setDiagramSharePassword(env, id, password | null)`.

## Client (apps/live)

- `api-client.ts` holds a module-level **session share password**
  (`setSessionSharePassword(pw | null)`), mirroring how the Clerk token provider
  is registered. `apiHeaders` attaches `X-Share-Password` when it is set, and
  `connectRoom` appends `&p=`. This keeps the password plumbing in one place
  instead of threading it through every call site.
- `apiLoadShared(code, ownerId)` returns a discriminated result:
  `{ diagram, role }` on success, `{ passwordRequired: true, invalid: boolean }`
  on 401/403, or `null` on 404 (not found / revoked). `invalid` is true only
  when a wrong password was submitted (403), so the gate can show an error.
- `apiSetSharePassword(ownerId, id, password | null)` → the PUT above.
  `apiListShareLinks` returns `{ links, password }`.

## Editor flow (apps/live, viewer)

When a visitor opens `/live/diagram/shared?s=<code>` and `apiLoadShared` reports
`passwordRequired`, the editor shows a **password gate** (`SharePasswordGate`, a
full-screen card with a lock, a single password input, and an error line) rather
than the canvas. On submit it calls `setSessionSharePassword(pw)` and re-runs
the bootstrap (a retry counter in the bootstrap effect's deps); the retried
`apiLoadShared` now carries the password and either hydrates the editor or
re-shows the gate with `invalid`. Once past the gate the password is on every
HTTP call (via `apiHeaders`) and the WS (`connectRoom`), so reads, writes, the
change log, images, and realtime all stay authorised.

Existing viewers when the owner sets or changes a password: their next API call
fails the gate and they are re-prompted. We do not actively kick them mid-session
(no realtime broadcast for password changes); that is acceptable for the threat
model and can be added later like the `share-revoked` broadcast.

The editor also defers two ancillary fetches behind the gate so a visitor on the
wrong password doesn't accumulate noise: the participant fetch (`apiLoadParticipant`)
skips its retry while the gate is showing, so refreshing the input doesn't replay
a 401 on every keystroke; and the `useCapabilities` hook plus the
server-preferences sync take an `enabled` flag that stays false until the gate
passes, so the AI capability check and the user's preferences PUT only fire
once the password is right. Without these defers the visitor would burn a
handful of failing requests per wrong attempt; with them the gate is the only
moving piece while it is up.

## Share dialog (owner)

The "Share this diagram" dialog gains a **Password** row in its options band
beneath the link list (see [spec/07 → Share dialog](07-live-app.md#share-dialog);
it applies to all links). It is a plain `type="text"` input that always
shows the current password in the clear (the owner asked to always see it),
with **Save** and **Remove** actions and a one-line hint: anyone opening a
share link must enter it (embed viewers are prompted inside the frame,
spec/33). Setting / clearing calls `apiSetSharePassword`.

## Telemetry (spec/22)

Owner sets a password: `track('Diagram', 'Shared', 'PasswordSet')`. Owner clears
it: `track('Diagram', 'Shared', 'PasswordCleared')`. Both reuse the existing
`Diagram` / `Shared` pair; the `type` is a preset string, never the password.
The visitor-join event is unchanged (`Diagram` / `Joined` / `Edit|View`).

## Out of scope (for now)

- Per-link passwords (one diagram-level password is the requirement).
- Hashing / encryption at rest (plain text is intentional, see Model).
- Rate-limiting password attempts and active mid-session eviction on change.
