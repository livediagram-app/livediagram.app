# Sharing: blueprint

Derived from [one-explorer-contracts.md "Sharing and access"](../one-explorer-contracts.md#sharing-and-access) and
["Notices"](../one-explorer-contracts.md#notices). The spec decides; this file only adds engineering precision, read
from the code. The access rule itself is in [index.md](index.md); defaults are cited as `IDXn`. Paths are relative
to the repository root.

Scope, by file:

| File                                               | Role                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/sharing.ts`          | `/items/:id/share`, `/items/:id/share-password`, `/share/:code…`, `/shared…`; `tellRevoked` |
| `liveworkspace/apps/index/src/share-sign-in.ts`    | `/items/:id/share-sign-in`; `signInRefusal`, `suggestedDomainOf`                            |
| `liveworkspace/apps/index/src/access.ts`           | `linkFor`, `linkAccess`                                                                     |
| `packages/index-client/src/share-domains.ts`       | `parseShareDomains`, `emailDomainOf`, `PUBLIC_MAIL_DOMAINS`, `isPublicMailDomain`           |
| `liveworkspace/apps/index/src/password-hash.ts`    | `hashSharePassword`, `verifySharePassword`, `isRememberedSharePassword`                     |
| `liveworkspace/apps/index/src/share-guesses.ts`    | `guessVisitorOf`, `guessRefusal`                                                            |
| `liveworkspace/apps/index/src/notices.ts`          | `tellApp`, `firstVisitStatement`, `GET /app/people/:id/count`                               |
| `liveworkspace/apps/index/src/community-states.ts` | `POST /app/community/states`: `communityStatesOf`, where each Community post's item stands  |
| `liveworkspace/apps/index/src/codec.ts`            | `generateShareCode`, `isShareCode`                                                          |

## Domain and naming

| Term           | Identifier                                                                       | Meaning                                                                 |
| -------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Link           | `ShareLink { code, itemId, level, tabId, expiry, expiresAt, createdAt, public }` | One way in                                                              |
| Expiry         | `never`, `week` (7 d), `month` (30 d), `sixMonths` (183 d)                       | Chosen when made; extended from now                                     |
| Live           | `expires_at IS NULL OR expires_at > now`                                         | A lapsed link opens nothing but stays listed for its owner              |
| Public         | `public = 1`                                                                     | A Community post's link: never asks a password, closed while one is set |
| Password       | `pbkdf2-sha256$<iterations>$<salt>$<hash>`                                       | One per item, over every link                                           |
| Sign-in rule   | `ShareSignInRule { requireAccount, domains }`                                    | One per item, over every link: accounts only, or only these domains     |
| Shared with me | `shared_with (person, item, share_code, last_seen)`                              | Items a person opened through a link                                    |

## Behaviour and state

### Managing links (owner or a joined team member: `loadItem(edit, { manage })`)

| Route                           | Request                                | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /items/:id/share`          |                                        | `{ links (≤ 100, by created_at), passwordSet, signIn, suggestedDomain }`                                                                                                                                                                                                                                                                                                                                                                                              |
| `POST /items/:id/share`         | `{ level?, tabId?, expiry?, public? }` | level default `APP_DEFAULT_LINK_LEVEL[app]` (`invalid_level`; a non-public level outside `APP_LINK_LEVELS[app]` is `level_not_offered`); `tabId` a part id or null (`invalid_tab`); expiry one of four (`invalid_expiry`, never read as `never`). The insert checks the 100-link cap itself (`409 share_link_limit`); `shared { level }` written only if it landed; an expiring link rewrites the warning; the app told `{ type: 'shared', actorId }`. `201 { link }` |
| `DELETE /items/:id/share`       |                                        | every link, every `shared_with` row and the warning go; `unshared` if there were any; the app told to end those codes' sessions; `204`                                                                                                                                                                                                                                                                                                                                |
| `PATCH /share/:code`            | `{ level?, tabId? }`                   | a changed level outside `APP_LINK_LEVELS[app]` is `level_not_offered` (the link's own level always passes); a changed level or tab tells the app `reason: 'rescoped'`; `{ link }`                                                                                                                                                                                                                                                                                     |
| `DELETE /share/:code`           |                                        | the link and its `shared_with` rows; `unshared`; the warning reworked; the app told; `204`                                                                                                                                                                                                                                                                                                                                                                            |
| `POST /share/:code/extend`      |                                        | `expires_at = now + its expiry` (live or lapsed); `400 never_expires` for `never`; `{ link }`                                                                                                                                                                                                                                                                                                                                                                         |
| `PUT /items/:id/share-password` | `{ password: string \| null }`         | ≤ 256 (`invalid_password`); blank or whitespace clears (`{ passwordSet: false }`); trimmed shorter than 6 is `password_too_short`; the same password again changes nothing; a new one is hashed, every `shared_with` row for the item goes, and every link's sessions are told `rescoped`; `{ passwordSet: true }`                                                                                                                                                    |

| `PUT /items/:id/share-sign-in` | `{ requireAccount, domains }` | `requireAccount` a boolean (`invalid_sign_in`); `domains` a list of strings or one string of typed text, read by `parseShareDomains` (`invalid_domain` naming the first bad one, `too_many_domains` over 20); domains force `require_account = 1`; off and no domains deletes the row; a rule other than the stored one (and not off) deletes every `shared_with` row of the item and tells every link `rescoped`; `{ signIn }` |

`tellRevoked` is `POST <app>/api/internal/items/:id/revoke { codes, reason? }` after the answer; a failure is logged
`[index] revoke not delivered`.

### Opening a link (`GET /share/:code`, public)

1. A malformed code is `404`; the code upper-cased; the link must be live and its item untrashed (`404`).
2. A delegate of another app: `404`.
3. The owner or a team member reaches it directly, except through a public link, which opens at its level for them too.
4. Else `linkAccess` with `X-Share-Password` (the code is in the path): see [index.md](index.md) step 5. Its first
   check is the item's sign-in rule (`signInRefusal`): with one, a guest or no person is `401 sign_in_required`, and
   with domains an account whose verified email is not at one of them `403 domain_not_allowed`, both carrying
   `domains`; then the password.
5. A person through a non-public link: `shared_with` upserted (rewritten only for a new code or after 60 s); the first
   visit tells the app `{ type: 'joined', personId, level }`.
6. `{ item, level, tabId, public }`.

### Password guesses (`share-guesses.ts`)

A password not already found right in this isolate is a guess (`linkAccess` with `guessRefusal` and
`wrongGuessRefusal`). Over a limit the answer is `429 { error: 'rate_limited' }`, `Retry-After: 60`.

1. A visitor's guess counts against `SHARE_GUESS_VISITOR_LIMITER` (10 a minute) keyed by the visitor, before PBKDF2:
   over it, 429 and nothing derived.
2. It is checked. Right: the item opens, whatever the item's own count. Wrong: it counts against
   `SHARE_GUESS_ITEM_LIMITER` (30 a minute) keyed `item:<id>`, and over that is 429 instead of 403 `password_invalid`.
3. A guess with no visitor (a Worker subrequest, `CF-Worker`) counts against the item before it is checked, its only
   bound: over it, 429 even for the right password.

The visitor is `via:<address>` from `X-Liveworkspace-Client-IP` (IPv6 cut to its /64, an IPv4-mapped one
unwrapped to its IPv4 address: api-kit's `addressRateKey`) when it is trusted
(`trustedClientAddress`, `@liveworkspace/sites/network`: the index's `WORKSPACE_PROXY_SECRET` matches the request's
`X-Liveworkspace-Proxy-Secret`, or is unset), null for a Worker subrequest, else `clientRateKey`. No password sent, or
one already checked, spends nothing. The same trusted address is what a copy names to its app (`clientIpOf`).

### Hashing (`password-hash.ts`)

PBKDF2-SHA256, 100,000 iterations, 16-byte salt, 256 bits, base64url. A stored value outside 1,000 to 1,000,000
iterations, or malformed, is refused (`[index] malformed stored share password refused`). A right password is
remembered per isolate by a SHA-256 of stored and given (never the password), at most 1,000.

### Shared with me

Archiving an item deletes its links, its share password and every `shared_with` row for it
([archive.md](archive.md), IDX42); the link and password routes answer `409 archived` while it is archived.

`GET /shared?app=&limit=&cursor=&<filters>`: the person's `shared_with` rows whose link is live and item untrashed and
not in their own scopes, by `last_seen DESC, item_id DESC`; `{ shared: [{ item, code, level, tabId, lastSeenAt }],
nextCursor }`. `DELETE /shared/:itemId` removes the row.

### Notices to the app

`tellApp` posts `POST <app>/api/internal/items/:id/notices` after the answer: `shared` (a link made by a person) and
`joined` (a first visit through a link). The index sends no email. `GET /app/people/:id/count?limit=` (an app's key)
counts the person's items in that app, Trash included, up to `OWNED_COUNT_MAX` (1000): `{ count }`.

### The sign-in rule (`share-sign-in.ts`)

- Stored as `share_sign_in (item_id, require_account, domains, updated_at)`, `domains` the normalised names joined by
  one space, null for none. Read beside the password in every link query (`linkFor`, `resolveShare`, `lookup.ts`).
- A person's email is the access token's `email`, lower-cased, kept only when `email_verified` is true
  (`auth.ts personOf`). A guest token, a delegated person (`X-Index-Person`) and the Drive mirror carry none.
- `signInRefusal(rule, person)`: no rule, null. A guest or none: 401. Domains and an email whose domain
  (`emailDomainOf`, after the last `@`) is in them: null; otherwise 403. Require Sign In alone and an account: null.
- `suggestedDomainOf(row, person)`: only for a team item, the person's email domain unless `isPublicMailDomain`.
- Archiving deletes the rule with the password (archive.md). A public link with a rule answers 404 (`linkAccess`), and
  `community-states.ts` reads the item as locked as it does behind a password.
- `parseShareDomains(text)`: one pass left to right, splitting at spaces, tabs, new lines and commas; each token drops
  one leading `@` and one trailing `.`, is lower-cased and checked label by label in the same pass. No regular
  expression; linear in the text, capped at `SHARE_DOMAINS_TEXT_MAX` (8,000 characters, `too_many_domains` beyond).

## Data and persistence

| Table             | Key                    | Indexes                                                                                                            | Written by                                                | Read by                           |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | --------------------------------- |
| `share_links`     | `code`                 | `share_links_item (item_id, created_at)`; `share_links_expires (expires_at) WHERE expires_at IS NOT NULL`          | link routes                                               | access, lists, Inbox, expiry pass |
| `share_passwords` | `item_id`              |                                                                                                                    | `PUT share-password`                                      | access                            |
| `share_sign_in`   | `item_id`              |                                                                                                                    | `PUT share-sign-in`                                       | access, lookup, Community states  |
| `shared_with`     | `(person_id, item_id)` | `shared_with_person_seen (person_id, last_seen DESC, item_id DESC)`; `shared_with_item_code (item_id, share_code)` | open, resolve, password change, link delete, merge, purge | access, lists, Inbox, `decorate`  |

`share_links` columns: `level` CHECK `view`/`participate`/`edit`, `tab_id`, `expiry` CHECK the four (default
`never`), `expires_at`, `created_at`, `public` CHECK 0/1. `share_sign_in` (migration `0026_share_sign_in.sql`):
`require_account` CHECK 0/1, `domains` TEXT or null. All four tables cascade from `items`.

## Errors and edge cases

| Case                                   | Answer                                         |
| -------------------------------------- | ---------------------------------------------- |
| A 101st link                           | `409 share_link_limit`                         |
| A password set on a public link's item | the public link answers `404` while it is set  |
| A wrong password                       | `403 password_invalid`                         |
| None sent where needed                 | `401 password_required`                        |
| None sent, reached through Shared      | `401 password_required` with `link` (the code) |
| Too many guesses                       | `429 rate_limited`, `Retry-After: 60`          |
| Extending a `never` link               | `400 never_expires`                            |
| A guest or nobody, through a rule      | `401 sign_in_required` with `domains`          |
| An account at another domain           | `403 domain_not_allowed` with `domains`        |
| A domain that is not one               | `400 invalid_domain` with `domain`             |
| More than 20 domains                   | `400 too_many_domains`                         |

## Security and trust

- Codes: 14 characters from a 32-letter alphabet without look-alikes, one random byte each (no modulo bias).
- An item out of reach answers `404`; a link's holder never learns more than the link opens.
- A new password reaches everyone already in: their rows go and their sessions reload. So does a changed sign-in rule.
- The sign-in rule trusts only the index's own check of the access token, never a header or body the client sends;
  only a verified address counts, and only an exact domain, so `acme.com.evil.io` or `evil-acme.com` never pass.
- A password refusal names the link's code only to a person reaching it through their own `shared_with` row (they
  opened that link before); it never names the item's details, and nobody without a live link learns the item exists.

## Testing

| Test                                                 | Pins                                                                                                                                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/sharing.test.ts` (29)  | share links; share passwords; a password on links already opened; guesses; what a link opens, and Shared with me; a public link at its own level for its owner              |
| `liveworkspace/apps/index/src/notices.test.ts` (6)   | notices; a person's count of items made                                                                                                                                     |
| `liveworkspace/apps/index/src/share-sign-in.test.ts` | the rule's route; Require Sign In and domains on open, grant, reopen and lookup for each level; unverified and other-domain emails; guests; public links; sessions reloaded |
| `packages/index-client/src/share-domains.test.ts`    | parsing, normalising and refusing domains; a worst-case text inside a CPU budget                                                                                            |

## Constants and configuration

`SHARE_LINKS_PER_ITEM` 100, `SHARE_PASSWORD_MAX` 256, `SHARE_PASSWORD_MIN` 6, `SHARE_LINK_EXPIRY_MS`,
`DEFAULT_LINK_LEVEL` `'edit'`, `APP_LINK_LEVELS` (livehuddle `['edit', 'participate']`, the rest all three), `APP_DEFAULT_LINK_LEVEL` (livehuddle `'participate'`, the rest `'edit'`), `OWNED_COUNT_MAX` 1000 (`packages/index-client`);
`SHARE_DOMAINS_MAX` 20, `SHARE_DOMAIN_MAX` 253, `SHARE_DOMAINS_TEXT_MAX` 8,000 (`packages/index-client`);
`SHARE_CODE_LENGTH` 14 (`codec.ts`); `SHARE_PASSWORD_ITERATIONS` 100,000 (`password-hash.ts`);
`PASSWORD_MEMORY_MAX` 1,000, `SHARE_GUESS_RETRY_AFTER_S` 60 (`config.ts`). Rate limiters: `SHARE_GUESS_VISITOR_LIMITER` namespace `1107` (staging `2107`), 10 per 60 s;
`SHARE_GUESS_ITEM_LIMITER` `1108` (`2108`), 30 per 60 s. Without the bindings (tests, local) nothing is limited.

## Defaults ledger

- `IDX6`: a share password is trimmed before its length is checked, and whitespace alone clears it.
- `IDX7`: a password set before the 6-character rule keeps working; only a new one is held to it.
- `IDX58`: a domain matches exactly; a subdomain of a listed domain is not admitted.
- `IDX59`: any change to the sign-in rule but turning it off sends everyone already in back through the check.
