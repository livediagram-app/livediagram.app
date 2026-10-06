# Share password

An optional **password on a document** that gates share-link access. When set,
anyone opening any share link for that document must enter the password before
they can view it, and the password rides on every subsequent API call so writes
stay gated too. The point is to stop people guessing share URLs, not to provide
cryptographic protection, though the stored value is hashed so a database
leak does not hand out every password.

Builds on [04-auth-and-guest-access](../014-identity/auth-and-guest-access.md) (hybrid
identity, share-code path) and [11-api](../015-api/api.md) (share links).

## Model

- The password is a property of the **document**, not of individual links. One
  password covers every share link the owner mints (`docs/specs/015-api/api.md` lets a document
  have many). Column: `documents.share_password TEXT` (nullable; null / empty =
  no password). Migration `0017_share_password.sql`.
- **Stored hashed.** The column holds
  `pbkdf2-sha256$<iterations>$<salt>$<hash>` (base64url salt of 16 bytes, 32-byte
  derived key), written by `hashSharePassword` (`apps/api/src/auth/share-password-hash.ts`).
  New passwords use **100,000 iterations**: measured at about 16 ms per verify
  in V8's WebCrypto (Node 22 on a loaded development machine), affordable once per isolate
  thanks to the verified cache below, and a meaningful cost to anyone holding a copy
  of the table. The iteration count is read from each stored value, so it can be
  raised later without invalidating existing passwords. A stored value outside
  1,000 to 1,000,000 iterations is refused rather than derived.
  The owner can no longer read the password back: the Share dialog shows that one
  is set and offers **Replace** and **Remove**.
- **Legacy plain-text values keep working.** A value without the `pbkdf2-sha256$`
  prefix is a password saved before hashing shipped. It is compared in constant
  time, and on the first correct entry it is rewritten as a hash, so the table
  converges without a migration (a migration cannot compute PBKDF2 in SQL).
- **Verified in constant time.** The derived key is compared with the
  timing-safe digest compare (`apps/api/src/auth/timing-safe.ts`), never `===`.
- **A verified cache.** A visitor sends the password on every request (images,
  autosave, the room), and a PBKDF2 derivation per request would be wasteful. A
  correct (stored value, SHA-256 of the provided password) pair is remembered in
  memory for 10 minutes, at most 1,000 entries per isolate. The stored value is
  part of the key, so changing or removing the password invalidates it at once.
- **Guessing is limited on every door.** Each derivation (a check the cache could
  not answer) first spends one unit of the `SHARE_RATE_LIMITER` binding under the
  key `share-pw:<network>`, where the network is the caller's IPv4 address or
  IPv6 /64 (`clientRateKey`). Over the limit, the attempt is treated as wrong
  without being checked, so the answer never reveals whether a guess was right.
  This covers every share-code door (the resolve, `canReadDocument` /
  `canEditDocument`, images, the room's `p`), not just the resolve. A correct
  visitor is answered from the cache after their first check in an isolate, so
  they spend almost nothing. The resolve read (`GET /api/share/:code`) keeps its
  own per-network request throttle on the same binding.
- It is **never** returned anywhere: not in the document DTO, and not to the
  owner either.
- The **owner always bypasses** the password (identified by `ownerId` / Clerk
  `sub`). The gate only applies to non-owner, share-code access.

## API (apps/api)

- `GET /api/documents/:id/share` (owner-only, existing): response carries
  `passwordSet: boolean` alongside `links`. This is how the Share dialog knows
  whether a password is in force.
- `PUT /api/documents/:id/share-password` (owner-only). Body
  `{ password: string | null }`. A null / empty / whitespace-only value clears
  the password; anything else is hashed and stored. Returns
  `{ passwordSet: boolean }`.
- `GET /api/share/:code` (viewer resolve): if the document has a password, return
  **401 `{ error: 'password_required' }`** when the request carries no
  `X-Share-Password`, **403 `{ error: 'password_invalid' }`** when it carries
  the wrong one, and only record the visit + return the document on a match.
- Every other share-code-authorised route is gated through
  `canReadDocument` / `canEditDocument` (`src/auth/document-access.ts`). Both gain a
  `sharePassword` argument: after the link + role check, if the document has a
  password and the provided one doesn't match, access is denied. The header is
  `X-Share-Password`, read via `sharePasswordOf(request)` (`routes/context.ts`),
  threaded at every call site (the document read/write/log routes + the image
  route). Owner-id and Clerk paths short-circuit before the password check.
- `GET /api/documents/:id/ws` (realtime upgrade): browsers can't set headers on a
  WS upgrade, so the password rides as the `p` query param next to `s` / `o`. A
  password-protected document refuses the upgrade (403) unless `p` matches; the
  owner (`o` matches) bypasses.

Helpers in `src/db/documents.ts` (the db.ts split moved them out of the
old monolithic module): `getDocumentSharePassword(env, id)` returns the stored
value (a hash, or a legacy plain-text value), `setDocumentSharePassword(env, id,
stored | null)` writes one. The password a request carries travels as a
`SharePasswordAttempt` (`{ value, rateKey }`, from `sharePasswordOf(request)`),
so the check can spend the caller's guessing budget.

## Client (apps/live)

- `api-client.ts` holds a module-level **session share password**
  (`setSessionSharePassword(pw | null)`), mirroring how the Clerk token provider
  is registered. `apiHeaders` attaches `X-Share-Password` when it is set, and
  `connectRoom` appends `&p=`. This keeps the password plumbing in one place
  instead of threading it through every call site.
- `apiLoadShared(code, ownerId)` returns a discriminated result:
  `{ document, role }` on success, `{ passwordRequired: true, invalid: boolean }`
  on 401/403, or `null` on 404 (not found / revoked). `invalid` is true only
  when a wrong password was submitted (403), so the gate can show an error.
- `apiSetSharePassword(ownerId, id, password | null)` → the PUT above,
  resolving to whether a password is now set. `apiListShareLinks` returns
  `{ links, passwordSet }`.

### Password cache

A visitor who got past the gate is not asked again on their next visit. The
accepted password is kept in `localStorage` under
`livediagram:share-password:<code>`, **one entry per share code**, in plain
text (`readCachedSharePassword` / `writeCachedSharePassword` in
`lib/api/core.ts`).

- **Keyed by share code**, not document id: the document id only resolves after
  the gate is passed, and the code is what the URL carries on arrival.
- **Read** at the start of a share-link bootstrap and set as the session share
  password, so the first `GET /api/share/:code` already carries it.
- **Written** after every successful resolve with whichever password the
  session used, the cached one or the one just typed.
- **Cleared** when the server refuses a cached password (a `401` or `403` from
  the resolve, which the owner rotating or removing the password causes): the
  entry is emptied, the session password dropped, and the gate shown afresh, so
  a stale value never loops.
- **Lifetime** is otherwise unbounded: the entry stays until it is refused or
  the visitor clears their site data. A revoked link never reaches the cache
  read (the resolve answers `404` first), so its entry is inert.
- **Plain text** in the visitor's own browser matches the threat model above:
  anyone able to read this browser's storage can already open the document in it.
- In an **embed**, browsers partition third-party iframe storage, so the cache
  is per embedding site ([Read-only embeds (`/embed`)](embeds.md)).

## Editor flow (apps/live, viewer)

When a visitor opens `/document/shared?s=<code>` and `apiLoadShared` reports
`passwordRequired`, the editor shows a **password gate** (`SharePasswordGate`, a
full-screen card with a lock, a single password input, and an error line) rather
than the canvas. On submit it calls `setSessionSharePassword(pw)` and re-runs
the bootstrap (a retry counter in the bootstrap effect's deps); the retried
`apiLoadShared` now carries the password and either hydrates the editor or
re-shows the gate with `invalid`. Once past the gate the password is on every
HTTP call (via `apiHeaders`) and the WS (`connectRoom`), so reads, writes,
images, and realtime all stay authorised.

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

The "Share this document" dialog carries a **Password Protection** switch
beneath the passes (see [Live app → Share dialog](../007-editor/live-app.md#share-dialog);
it applies to all links), hinting that everyone opening a pass must enter it,
embeds included ([Read-only embeds (`/embed`)](embeds.md)). Switched on with no
password yet, it reveals a `type="text"` input (the owner sees what they type)
with **Save** (Enter also saves). Once a password is saved the field is replaced
by a **Password Set** line with **Replace** and **Remove**: the server keeps only
a hash, so the saved password cannot be shown again. **Replace** brings back the
empty field with **Save** and **Cancel**. Switching it off with a password saved
removes the password; saving an empty field clears it and turns the switch off.
Each pass shows a Password tag while one is set. Setting / clearing calls
`apiSetSharePassword`.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

Owner sets a password: `track('Document', 'Shared', 'PasswordSet')`. Owner clears
it: `track('Document', 'Shared', 'PasswordCleared')`. Both reuse the existing
`Document` / `Shared` pair; the `type` is a preset string, never the password.
The visitor-join event is unchanged (`Document` / `Joined` / `Edit|View`).

## Out of scope (for now)

- Per-link passwords (one document-level password is the requirement).
- Active mid-session eviction when the password changes.
