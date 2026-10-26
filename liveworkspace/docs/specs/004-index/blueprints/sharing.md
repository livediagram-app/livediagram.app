# Sharing: blueprint

Derived from [one-explorer-contracts.md "Sharing and access"](../one-explorer-contracts.md#sharing-and-access) and
["Notices"](../one-explorer-contracts.md#notices). The spec decides; this file only adds engineering precision, read
from the code. The access rule itself is in [index.md](index.md); defaults are cited as `IDXn`. Paths are relative
to the repository root.

Scope, by file:

| File                                            | Role                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/sharing.ts`       | `/items/:id/share`, `/items/:id/share-password`, `/share/:code…`, `/shared…`; `tellRevoked` |
| `liveworkspace/apps/index/src/access.ts`        | `linkFor`, `linkAccess`                                                                     |
| `liveworkspace/apps/index/src/password-hash.ts` | `hashSharePassword`, `verifySharePassword`, `isRememberedSharePassword`                     |
| `liveworkspace/apps/index/src/share-guesses.ts` | `guessVisitorOf`, `guessRefusal`                                                            |
| `liveworkspace/apps/index/src/share-expiry.ts`  | Share Link Expiring: `expiringStatements`, `sweepExpiringLinks`                             |
| `liveworkspace/apps/index/src/notices.ts`       | `tellApp`, `firstVisitStatement`, `GET /app/people/:id/count`                               |
| `liveworkspace/apps/index/src/codec.ts`         | `generateShareCode`, `isShareCode`                                                          |

## Domain and naming

| Term           | Identifier                                                                       | Meaning                                                                 |
| -------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Link           | `ShareLink { code, itemId, level, tabId, expiry, expiresAt, createdAt, public }` | One way in                                                              |
| Expiry         | `never`, `week` (7 d), `month` (30 d), `sixMonths` (183 d)                       | Chosen when made; extended from now                                     |
| Live           | `expires_at IS NULL OR expires_at > now`                                         | A lapsed link opens nothing but stays listed for its owner              |
| Public         | `public = 1`                                                                     | A Community post's link: never asks a password, closed while one is set |
| Password       | `pbkdf2-sha256$<iterations>$<salt>$<hash>`                                       | One per item, over every link                                           |
| Shared with me | `shared_with (person, item, share_code, last_seen)`                              | Items a person opened through a link                                    |

## Behaviour and state

### Managing links (owner or a joined team member: `loadItem(edit, { manage })`)

| Route                           | Request                                | Effect                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /items/:id/share`          |                                        | `{ links (≤ 100, by created_at), passwordSet }`                                                                                                                                                                                                                                                                                                                      |
| `POST /items/:id/share`         | `{ level?, tabId?, expiry?, public? }` | level default `edit` (`invalid_level`); `tabId` a part id or null (`invalid_tab`); expiry one of four (`invalid_expiry`, never read as `never`). The insert checks the 100-link cap itself (`409 share_link_limit`); `shared { level }` written only if it landed; an expiring link rewrites the warning; the app told `{ type: 'shared', actorId }`. `201 { link }` |
| `DELETE /items/:id/share`       |                                        | every link, every `shared_with` row and the warning go; `unshared` if there were any; the app told to end those codes' sessions; `204`                                                                                                                                                                                                                               |
| `PATCH /share/:code`            | `{ level?, tabId? }`                   | a changed level or tab tells the app `reason: 'rescoped'`; `{ link }`                                                                                                                                                                                                                                                                                                |
| `DELETE /share/:code`           |                                        | the link and its `shared_with` rows; `unshared`; the warning reworked; the app told; `204`                                                                                                                                                                                                                                                                           |
| `POST /share/:code/extend`      |                                        | `expires_at = now + its expiry` (live or lapsed); `400 never_expires` for `never`; `{ link }`                                                                                                                                                                                                                                                                        |
| `PUT /items/:id/share-password` | `{ password: string \| null }`         | ≤ 256 (`invalid_password`); blank or whitespace clears (`{ passwordSet: false }`); trimmed shorter than 6 is `password_too_short`; the same password again changes nothing; a new one is hashed, every `shared_with` row for the item goes, and every link's sessions are told `rescoped`; `{ passwordSet: true }`                                                   |

`tellRevoked` is `POST <app>/api/internal/items/:id/revoke { codes, reason? }` after the answer; a failure is logged
`[index] revoke not delivered`.

### Opening a link (`GET /share/:code`, public)

1. A malformed code is `404`; the code upper-cased; the link must be live and its item untrashed (`404`).
2. A delegate of another app: `404`.
3. The owner or a team member reaches it directly.
4. Else `linkAccess` with `X-Share-Password` (the code is in the path): see [index.md](index.md) step 5.
5. A person through a non-public link: `shared_with` upserted (rewritten only for a new code or after 60 s); the first
   visit tells the app `{ type: 'joined', personId, level }`.
6. `{ item, level, tabId, public }`.

### Password guesses (`share-guesses.ts`)

A password not already found right in this isolate is a guess, counted twice before it is checked:
`SHARE_GUESS_VISITOR_LIMITER` (10 a minute) keyed by the visitor and `SHARE_GUESS_ITEM_LIMITER` (30 a minute) keyed
`item:<id>`. Over either: `429 { error: 'rate_limited' }`, `Retry-After: 60`. The visitor is
`via:<address>` from `X-Liveworkspace-Client-IP` (IPv6 cut to its /64), null for a Worker subrequest (`CF-Worker`:
only the item's limit applies), else `clientRateKey`. No password sent, or one already checked, spends nothing.

### Hashing (`password-hash.ts`)

PBKDF2-SHA256, 100,000 iterations, 16-byte salt, 256 bits, base64url. A stored value outside 1,000 to 1,000,000
iterations, or malformed, is refused (`[index] malformed stored share password refused`). A right password is
remembered per isolate by a SHA-256 of stored and given (never the password), at most 1,000.

### Share Link Expiring (`share-expiry.ts`)

One event per item, `sx:<item>`, type `share_link_expiring`, dated at the soonest expiry among live links lapsing
within 7 days, detail `{ expiresAt, links }`, on the owner's scope only. Written in the batch of every link change
(dropped, then rewritten if still due) and by the daily pass: one read of `share_links_expires` for up to 2,000
items, soonest first, then two statements per 500. The daily pass only writes or moves, so a dismissed warning stays
dismissed until a link changes.

### Shared with me

`GET /shared?app=&limit=&cursor=&<filters>`: the person's `shared_with` rows whose link is live and item untrashed and
not in their own scopes, by `last_seen DESC, item_id DESC`; `{ shared: [{ item, code, level, tabId, lastSeenAt }],
nextCursor }`. `DELETE /shared/:itemId` removes the row.

### Notices to the app

`tellApp` posts `POST <app>/api/internal/items/:id/notices` after the answer: `shared` (a link made by a person) and
`joined` (a first visit through a link). The index sends no email. `GET /app/people/:id/count?limit=` (an app's key)
counts the person's items in that app, Trash included, up to `OWNED_COUNT_MAX` (1000): `{ count }`.

## Data and persistence

| Table             | Key                    | Indexes                                                                                                            | Written by                                                | Read by                           |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | --------------------------------- |
| `share_links`     | `code`                 | `share_links_item (item_id, created_at)`; `share_links_expires (expires_at) WHERE expires_at IS NOT NULL`          | link routes                                               | access, lists, Inbox, expiry pass |
| `share_passwords` | `item_id`              |                                                                                                                    | `PUT share-password`                                      | access                            |
| `shared_with`     | `(person_id, item_id)` | `shared_with_person_seen (person_id, last_seen DESC, item_id DESC)`; `shared_with_item_code (item_id, share_code)` | open, resolve, password change, link delete, merge, purge | access, lists, Inbox, `decorate`  |

`share_links` columns: `level` CHECK `view`/`participate`/`edit`, `tab_id`, `expiry` CHECK the four (default
`never`), `expires_at`, `created_at`, `public` CHECK 0/1. All three tables cascade from `items`.

## Errors and edge cases

| Case                                   | Answer                                        |
| -------------------------------------- | --------------------------------------------- |
| A 101st link                           | `409 share_link_limit`                        |
| A password set on a public link's item | the public link answers `404` while it is set |
| A wrong password                       | `403 password_invalid`                        |
| None sent where needed                 | `401 password_required`                       |
| Too many guesses                       | `429 rate_limited`, `Retry-After: 60`         |
| Extending a `never` link               | `400 never_expires`                           |

## Security and trust

- Codes: 14 characters from a 32-letter alphabet without look-alikes, one random byte each (no modulo bias).
- An item out of reach answers `404`; a link's holder never learns more than the link opens.
- A new password reaches everyone already in: their rows go and their sessions reload.

## Testing

| Test                                                    | Pins                                                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/sharing.test.ts` (25)     | share links; share passwords; a password on links already opened; guesses; what a link opens, and Shared with me |
| `liveworkspace/apps/index/src/share-expiry.test.ts` (7) | share link expiring                                                                                              |
| `liveworkspace/apps/index/src/notices.test.ts` (6)      | notices; a person's count of items made                                                                          |

## Constants and configuration

`SHARE_LINKS_PER_ITEM` 100, `SHARE_PASSWORD_MAX` 256, `SHARE_PASSWORD_MIN` 6, `SHARE_LINK_EXPIRY_MS`,
`DEFAULT_LINK_LEVEL` `'edit'`, `SHARE_EXPIRY_WARNING_MS` 7 d, `OWNED_COUNT_MAX` 1000 (`packages/index-client`);
`SHARE_CODE_LENGTH` 14 (`codec.ts`); `SHARE_PASSWORD_ITERATIONS` 100,000 (`password-hash.ts`);
`PASSWORD_MEMORY_MAX` 1,000, `SHARE_GUESS_RETRY_AFTER_S` 60 (`config.ts`); `EXPIRY_SWEEP_MAX` 2,000, `EXPIRY_CHUNK`
500 (`share-expiry.ts`). Rate limiters: `SHARE_GUESS_VISITOR_LIMITER` namespace `1107` (staging `2107`), 10 per 60 s;
`SHARE_GUESS_ITEM_LIMITER` `1108` (`2108`), 30 per 60 s. Without the bindings (tests, local) nothing is limited.

## Defaults ledger

- `IDX6`: a share password is trimmed before its length is checked, and whitespace alone clears it.
- `IDX7`: a password set before the 6-character rule keeps working; only a new one is held to it.
