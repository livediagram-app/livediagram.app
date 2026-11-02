# API tokens: blueprint

Derived from [accounts.md "API tokens"](../accounts.md#api-tokens) and ["Expiry warnings"](../accounts.md#expiry-warnings).
The spec decides; this file only adds engineering precision, read from the code. Defaults are cited as `ACCn`. Paths
are relative to the repository root.

Scope, by file:

| File                                                  | Role                                                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `liveworkspace/apps/accounts/src/tokens.ts`           | Mint, list, revoke, verify, revoke by secret, live ids, the token Timeline events       |
| `liveworkspace/apps/accounts/src/token-expiry.ts`     | The week-ahead email and the Timeline note                                              |
| `liveworkspace/apps/accounts/src/bench-accounts.ts`   | `POST /api/auth/internal/bench-accounts` (development)                                  |
| `liveworkspace/apps/accounts/src/workbench/revoke.ts` | `endTokenWorkbench`: a revoked token's pairings end                                     |
| `packages/auth-client/src/account.ts`                 | Each app's side: `verifyApiToken` (cached 60 s valid, 10 s invalid), mint, revoke, live |

## Domain and naming

| Term      | Identifier                                    | Meaning                                                         |
| --------- | --------------------------------------------- | --------------------------------------------------------------- |
| Secret    | `lwt_` + 32 random bytes base64url (47 chars) | Shown once                                                      |
| Legacy    | `lvd_…`                                       | Copied from the old livediagram.app; verifies and revokes alike |
| Hash      | SHA-256 hex of the whole secret               | The only stored form (`tokenHash`, unique)                      |
| Lifetime  | six calendar months from `createdAt` (UTC)    | The only one                                                    |
| Read-only | `readOnly` 0/1                                | The app caps what the token may do                              |

A secret passes `isApiTokenFormat` when it has either prefix and more than 24 characters.

## Behaviour and state

### The routes

| Route                                                                 | Door                                              | Effect                                                                                                                             |
| --------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/account/tokens`                                             | session                                           | `{ tokens }`: live (not revoked, not expired), newest first                                                                        |
| `POST /api/account/tokens { name?, readOnly? }`                       | session                                           | name trimmed to 80, default `API token`; `409 token_limit_reached` at 20 live; `201 { …ApiToken, secret }`; `Token·Created·Manual` |
| `DELETE /api/account/tokens/:id`                                      | session                                           | `404`; revoked; its workbench pairings end; `{ id }`; `Token·Removed`                                                              |
| `POST /api/account/internal/tokens/verify { token }`                  | client                                            | `{ tokenId, userId, name, email, readOnly, expiresAt, teams }` or `404 invalid_token`                                              |
| `POST /api/account/internal/tokens { accessToken, name?, readOnly? }` | client                                            | for the person the access token names (introspected, minted for this client): default name `MCP client`; `201` or `409`            |
| `POST /api/account/internal/tokens/revoke { token }`                  | client                                            | the secret is the authority (a CLI signing out); pairings end; `{ ok: true }` or `404`                                             |
| `POST /api/account/internal/tokens/live { ids }`                      | client                                            | `{ live }`: which of up to 100 ids still work; `400 ids_required`, `400 too_many_ids`                                              |
| `POST /api/auth/internal/bench-accounts { count, name? }`             | `ADMIN_TOKEN`, development only (`404` elsewhere) | `count` 1 to 200 accounts `<id>@bench.invalid` with one token each: `201 { accounts: [{ userId, token }] }`                        |

### Minting and revoking

- Mint: one batch. The insert is `INSERT … SELECT … WHERE (live count) < 20`, so two at once can't pass the cap;
  `token_created:<id>` is queued only `WHERE EXISTS` the row.
- Revoke: read the name, then one batch: `UPDATE … SET revokedAt` where not revoked, and `token_revoked:<id>` guarded
  on that exact `revokedAt`.
- Verify: an indexed lookup by hash, joined to the user; `lastUsedAt` stamped only when older than a minute (`AND
(lastUsedAt IS NULL OR lastUsedAt < ?)`); the email only when verified.

### The expiry steps

1. `sweepExpiringTokens` (hourly): up to 100 live, unwarned tokens expiring within 7 days whose owner's address is
   verified and whose owner is inside the send window (`u.timeZone`, [email.md](email.md) "The send window"),
   soonest first (`api_token_expiry_warning_idx`). Sent one at a time; a failure is logged and left for the next run;
   those that went stamped `expiryWarnedAt` in one update; each counted `Email·Sent·TokenExpiring` under the
   owner's sign-up app. Logged `[tokens] expiry warnings { sent, failed }`.
2. `noteExpiringTokens` (in the 09:17 UTC run, after step 1): up to 500 live tokens expiring within 7 days not yet noted
   (`api_token_expiry_note_idx`), verified or not; one batch of `token_expiring:<id>` events dated at the expiry (so
   they show under Upcoming) and the `expiryNotedAt` stamps; then a Timeline flush.

Token events: scope `p:<owner>`, title the token's name, detail `{ tokenId }`; `actorId` the owner (none for an
expiry).

## Data and persistence

| Table       | Key  | Indexes                                                                                                                                                                                                                            | Written by                         | Read by                    |
| ----------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------- |
| `api_token` | `id` | `tokenHash` UNIQUE; `api_token_user_idx`; `api_token_expiry_warning_idx (expiresAt) WHERE revokedAt IS NULL AND expiryWarnedAt IS NULL`; `api_token_expiry_note_idx (expiresAt) WHERE revokedAt IS NULL AND expiryNotedAt IS NULL` | mint, revoke, verify stamp, sweeps | list, verify, live, sweeps |

Columns: `userId` (`ON DELETE CASCADE`), `name`, `readOnly` (default 0), `createdAt`, `lastUsedAt`, `expiresAt`,
`revokedAt`, `expiryWarnedAt`, `expiryNotedAt`.

## Errors and edge cases

| Case                              | Answer                                 |
| --------------------------------- | -------------------------------------- |
| A 21st live token                 | `409 token_limit_reached`              |
| An expired or revoked token       | `404 invalid_token` to the app         |
| A token revoked twice             | the second `404`                       |
| The warning email fails           | not stamped; retried while in its week |
| An owner with no verified address | no email; the Timeline note still goes |

## Security and trust

- 256 random bits, kept only as a SHA-256, so an indexed lookup leaks nothing a timing attack could use.
- An app can mint only for someone signed in to it: its access token, introspected, minted for its own client.
- Revoking a token ends the workbench pairings hanging off it.

## Testing

| Test                                                          | Pins                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| `liveworkspace/apps/accounts/src/tokens.test.ts` (9)          | API tokens; tokens carried over from the old livediagram.app |
| `liveworkspace/apps/accounts/src/token-expiry.test.ts` (8)    | the expiring-token warning and note                          |
| `liveworkspace/apps/accounts/src/bench-accounts.test.ts` (3)  | bench accounts                                               |
| `liveworkspace/apps/accounts/src/index-timeline.test.ts` (16) | API token events                                             |
| `packages/auth-client/src/account.test.ts`                    | the app's verify cache and calls                             |

## Constants and configuration

`API_TOKEN_PREFIX` `lwt_`, `LEGACY_API_TOKEN_PREFIX` `lvd_`, `TOKEN_RANDOM_BYTES` 32, `MAX_API_TOKENS_PER_ACCOUNT`
20, `TOKEN_NAME_MAX_LENGTH` 80, `LAST_USED_STAMP_WINDOW_MS` 60 s, `MAX_LIVE_TOKEN_IDS` 100 (`tokens.ts`);
`TOKEN_EXPIRY_WARNING_MS` 7 d, `TOKEN_EXPIRY_SWEEP_LIMIT` 100, `TOKEN_EXPIRY_NOTE_LIMIT` 500 (`token-expiry.ts`);
`BENCH_ACCOUNTS_MAX` 200 (`bench-accounts.ts`); `TOKEN_VALID_FOR_MS` 60 s, `TOKEN_INVALID_FOR_MS` 10 s
(`packages/auth-client/src/account.ts`).

## Defaults ledger

- `ACC11`: a token's last use is stamped at most once a minute, so a burst of MCP calls costs one write.
- `ACC12`: an expiry warning is sent only to a verified address; the Timeline note goes regardless.
