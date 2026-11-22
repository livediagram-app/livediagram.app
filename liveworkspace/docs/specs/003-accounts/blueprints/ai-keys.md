# AI keys: blueprint

Derived from [ai-keys.md](../ai-keys.md). The spec decides; this file adds engineering precision and the threat model.
Paths are relative to the repository root.

Scope, by file:

| File                                                      | Role                                                                                           |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/accounts/migrations/0025_ai_keys.sql` | The `ai_key` table                                                                             |
| `liveworkspace/apps/accounts/src/ai-keys/seal.ts`         | `sealAiKey`, `openAiKey`, `aiKeySecrets`, `AiKeySealError`: HKDF per record, AES-GCM, versions |
| `liveworkspace/apps/accounts/src/ai-keys/store.ts`        | The rows: read, save, model, remove, the team and account deletes, the reseal sweep            |
| `liveworkspace/apps/accounts/src/ai-keys/routes.ts`       | The account API's `ai-key` routes on both doors                                                |
| `liveworkspace/apps/accounts/src/ai-keys/internal.ts`     | `POST /internal/ai-key`: the binding-only door                                                 |
| `liveworkspace/apps/accounts/src/ai-keys/notify.ts`       | The audit event and the "Your AI Key Was Changed" email                                        |
| `packages/ai`                                             | `@liveworkspace/ai`: providers, models, `callModel`, `checkProviderKey`, `providerFetch`       |
| `packages/auth-client/src/ai-key.ts`                      | `aiKeyFor`: an app's server asking over its binding                                            |
| `packages/settings-ui/src/account-panels/ai/`             | The Settings panel's AI category                                                               |

## Domain and naming

| Term          | Identifier                                      | Meaning                                                                      |
| ------------- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| Owner         | `account:<user id>`, `team:<team id>`           | Whose key a row is; one row per owner                                        |
| Master secret | `AI_KEY_SECRET` = `<version>:<secret>`          | A bare secret is version 1; the secret is any string, `openssl rand -hex 32` |
| Previous      | `AI_KEY_SECRET_PREVIOUS`                        | The secret before the current one, while a rotation runs                     |
| Envelope      | `<version>.<salt>.<iv>.<ciphertext>`, base64url | What `ai_key.sealed` holds                                                   |
| Hint          | the key's last 4 characters, `''` under 12      | `ai_key.hint`                                                                |
| Source        | `team`, `account`                               | Which key the internal door answered                                         |

## Data and persistence

```sql
CREATE TABLE ai_key (
  owner_kind  TEXT NOT NULL CHECK (owner_kind IN ('account', 'team')),
  owner_id    TEXT NOT NULL,
  provider    TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai')),
  model       TEXT NOT NULL CHECK (length(model) BETWEEN 1 AND 100),
  sealed      TEXT NOT NULL CHECK (length(sealed) <= 2048),
  key_version INTEGER NOT NULL CHECK (key_version >= 1),
  hint        TEXT NOT NULL CHECK (length(hint) <= 4),
  set_by      TEXT NOT NULL,
  set_at      INTEGER NOT NULL,
  PRIMARY KEY (owner_kind, owner_id)
) WITHOUT ROWID;
CREATE INDEX ai_key_version ON ai_key (key_version);
```

No foreign key: an account's row is deleted explicitly with its settings (`deleteAccountAiKey`), a team's in
`deleteTeamRows`' batch (`deleteTeamAiKeyStatement`). `set_by` is an account id kept as text; the read names it with
`"user".name`, "Deleted account" for none.

## Sealing (`seal.ts`)

- `aiKeySecrets(env)`: `{ current: { version, secret }, previous?: { version, secret } }`, or null without
  `AI_KEY_SECRET`. A value `^(\d{1,4}):(.+)$` is that version; anything else is version 1. A previous of the same
  version as the current is ignored.
- `sealAiKey(secrets, owner, provider, apiKey)`: salt 16 random bytes; HKDF-SHA-256 over the secret's UTF-8 bytes,
  `info` = `liveworkspace ai key|v<version>|<owner>|<provider>`, to an AES-256-GCM key (not extractable); IV 12
  random bytes; additional data = the same string as `info`. Answers `{ sealed, version }`.
- `openAiKey(secrets, owner, provider, sealed)`: the envelope's version picks the secret (current or previous); any
  other version, a wrong secret, another owner or provider, a changed or cut envelope: one `AiKeySealError` ("The
  stored key could not be read."), whatever WebCrypto said. Its message holds no key, secret or envelope.
- `MAX_AI_KEY_CHARS` 512; a key with whitespace or a control character (`/[\s\u0000-\u001f\u007f]/`) is refused
  before sealing (`invalid_key`).

## Behaviour and state

### The routes (`routes.ts`)

`aiKeyRoutes(request, env, actor, parts, waitUntil)` answers `['ai-key']` and `['teams', id, 'ai-key']` on both doors
(`handleSignedIn`, `handleBearer`, after their account checks; the session's writes already passed the same-origin
check). Null for any other path.

- `GET ai-key`: two reads, `readAccountKey` (primary key) and `readTeamKeys` (the person's joined, undeleted teams left
  joined to their `ai_key` rows, one query, at most 50 teams).
- `PUT`: secrets (else `503`), the write limiter (`write:<user id>`, else `429`), body checks, the provider check
  (`checkProviderKey`, 8 s, through `providerFetch`), then `saveAiKey` (an upsert) and, for a team, the audit event in
  the same batch. Then the email, after the answer (`waitUntil`).
- `PATCH { model }`: `isProviderModel(stored provider, model)` else `400 invalid_model`; no provider call; a team's
  audit event `model`.
- `DELETE`: the row goes (`404 no_key` with none), the audit event and the email.

A provider's failure kinds map to: `bad-key` `422 key_rejected`; `no-credit` `422 key_no_credit`;
`model-unavailable` `422 key_model_unavailable`; every other kind (rate-limited, overloaded, other, a timeout)
`502 key_check_failed`.

### The internal door (`internal.ts`)

`index.ts` routes `POST /internal/ai-key` (exactly) to `handleAiKeyInternal` before its 404; any other method there is
the plain 404. In order, each refusal before any database read:

1. `fromBinding(request)`: no `CF-Connecting-IP`, `X-Liveworkspace-Proxy` or `X-Liveworkspace-Client-IP` header,
   else `404` (the same `Not found` as an unknown path, so a probe learns nothing).
2. `aiKeySecrets(env)`, else `503 ai_keys_unavailable`.
3. `verifiedClient` (the internal door's own client check, kept per isolate for five minutes), else `401
invalid_client`.
4. `vouchedPerson(request, auth, clientId, body.token)`: introspection, live, `client_id` this client's; then
   `USER_ID.test(sub)`, else `401 invalid_token`.
5. `AI_KEY_LIMITER` on `use:<user id>`, else `429`.
6. `teamId`, when sent, must be a string of 1 to 100 characters, else `400 invalid_team`; `want` `key` or `which`,
   else `400 invalid_want`.
7. One read (`readApplyingKeys`): the person's row and, with a team, the team's row if the person is a joined member
   of that undeleted team (a `JOIN` on `team_member` and `team`). The team's wins.
8. `want: 'key'`: open it; `AiKeySealError` answers `409 ai_key_unreadable` `{ source }`, logged as
   `[ai-keys] unreadable { source, version }`.

### The reseal sweep (`store.ts` `resealAiKeys`)

In the 15-minute cron, with `previous` set only: up to 50 rows whose `key_version` is the previous secret's version,
oldest first (a row of any older version opens under neither, and taking it would stall the sweep behind it); each opened and sealed again under the current secret, written back only if its `sealed` is still the
one read (a key replaced meanwhile is left as it is). Logs `{ resealed, unreadable, left }`.

## Security and trust: the threat model

| Threat                                                       | What stops it                                                                                                                                                                             |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Someone on the internet calls the internal door              | Not on any zone route; `CF-Connecting-IP` refused; client credentials; the person's own token                                                                                             |
| A router forwards a crafted public request to it             | Routers forward only `/api/auth` and `/api/account` targets to accounts; a forwarded request carries the visitor's headers and the proxy's, refused                                       |
| An app (or a compromised app's secret) asks for anyone's key | Needs a live access token minted for that same client, for that person: only a person signed in to that app now, while their token lasts (15 min)                                         |
| An app asks for a team's key for a non-member                | Membership read in accounts on each call; the token's team claim is never trusted                                                                                                         |
| A stolen access token, used on the account API               | Reads only the hint and state; a change needs the token's session live (no use after Sign out), emails the owner (or admins), lands in the audit log for a team, and needs a working key  |
| A stolen API token or an agent                               | Not a bearer: refused on every key route; the internal door takes only an access token minted for the calling client                                                                      |
| The database is read (a backup, a D1 query log, an export)   | Keys are sealed under a secret D1 never holds; the hint is four characters; no route or export reads `sealed` out                                                                         |
| A sealed key is moved to another row                         | Owner, provider and version are AES-GCM additional data and HKDF info: it does not open                                                                                                   |
| The master secret leaks                                      | Rotation (spec "Rotating the master secret") re-seals every row; a leak of D1 and the secret together is a breach of every key, so both stay apart                                        |
| A key ends up in logs, telemetry, errors or emails           | Bodies with keys are never logged; provider bodies are never passed on (`ModelCallError` kinds); emails name the provider only; tests plant a key                                         |
| Server-side request forgery through the key check            | The provider's host is fixed in `@liveworkspace/ai`; `providerFetch` refuses any other URL; no caller-supplied URL exists                                                                 |
| A key outlives its removal                                   | No cache anywhere: every call reads the row; apps hold the plain key in one request's memory only                                                                                         |
| Someone floods the doors                                     | `AI_KEY_LIMITER` 120 a minute per account for `key` and for `which` apart; `AI_KEY_WRITE_LIMITER` 10 a minute per account and per network range; a write body over 4 KB is refused unread |
| Saving used to test stolen keys                              | The write limit per network range across accounts, besides the one per account                                                                                                            |
| An app that calls no model reads a key                       | `AI_KEY_READERS`: only liveknowledge is answered `want: 'key'`; every other client `403 not_a_key_reader`                                                                                 |
| Accounts can't answer, and the words go to built-in AI       | The app refuses the call for a signed-in asker (`shared-unavailable`), never guessing built-in AI                                                                                         |
| A former admin's key keeps billing them                      | A team key goes with the member who set it, when they leave, are removed or close the account, written to the audit log                                                                   |
| The browser saves the key as a password                      | No `<form>` and no password field: masked text (`-webkit-text-security`), sent by the button or Enter                                                                                     |
| A weak or misrotated master secret                           | Under 32 characters refused (fail closed); a previous secret of the current version ignored; each said once in the log, never the secret                                                  |
| Someone changes a team's key without being its admin         | `getMembership` role check inside the route; the audit log and the admins' email                                                                                                          |
| A guest or a closed account keeps a key                      | Guests have no key routes; closing deletes the personal key; a deleted team's key goes in the same batch                                                                                  |

What is accepted, after the security review (2026-11-21):

- The binding-only guarantee rests on Cloudflare setting `CF-Connecting-IP` on every request from the internet (a
  client cannot strip or forge it): a public path that normalises onto `/internal/ai-key` carries it and is refused.
  A named `WorkerEntrypoint` method for the door would make it structural; it needs every reader's binding changed,
  so it waits for the second app that reads keys.
- An app's server sent a person's bearer could change their key (or, for an admin, the team's) on the bearer door
  for that token's 15 minutes, as it could any bearer setting; the change is emailed and, for a team, audited.
- Firefox shows the key as typed (it has no `-webkit-text-security`); it is still never saved, kept or sent back.

And: an app's server that holds its client secret and a person's live access token can read that
person's key (and their team's, while they are a member), for as long as the token lasts. That is what the feature
is: the app calls the model for that person.

## Performance and limits

Measured locally against the test D1 (node, `ai-keys/internal.test.ts` "costs"): the door's own work, with the client
check and introspection stubbed, under 5 ms a call; HKDF plus AES-GCM open under 1 ms. In production the
introspection is Better Auth's own (a JWT check), the same as every vouched internal call.

| Limit                    | Value                                           |
| ------------------------ | ----------------------------------------------- |
| `AI_KEY_LIMITER`         | 120 / 60 s per account, `key` and `which` apart |
| `AI_KEY_WRITE_LIMITER`   | 10 / 60 s per account, and per network range    |
| `MAX_AI_KEY_CHARS`       | 512                                             |
| `KEY_CHECK_TIMEOUT_MS`   | 8,000                                           |
| `RESEAL_BATCH`           | 50 a cron run                                   |
| `AI_KEY_CALL_TIMEOUT_MS` | 5,000 (`aiKeyFor`)                              |

## Observability

Log lines name the owner kind, the provider, the outcome and counts; never the key, the hint, the envelope or a request
body. `[ai-keys] saved|removed|model { kind, provider }`, `[ai-keys] check failed { provider, kind }`,
`[ai-keys] unreadable { source, version }`, `[ai-keys] resealed { resealed, unreadable, left }`. No telemetry event.

## Testing

- `seal.test.ts`: round trip; another owner, provider or version does not open; a changed envelope; the previous
  secret; no secret; the key in no error.
- `store.test.ts`, `routes.test.ts`: set, replace, model, remove; team admin and member; guests and API tokens
  refused; fail closed; the audit event and the email (no key, no hint in either); account close and team delete.
- `internal.test.ts`: every refusal in order; team precedence; a non-member; a removed key stops at once; the
  planted key in no log line; the costs.
- `@liveworkspace/ai`: 100% coverage.

## Constants and configuration

`AI_KEY_SECRET`, `AI_KEY_SECRET_PREVIOUS` (secrets, accounts, production and staging); `AI_KEY_LIMITER` (namespace
1111, staging 2111) and `AI_KEY_WRITE_LIMITER` (1112, 2112) in `wrangler.toml`.
