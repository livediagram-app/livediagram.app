# AI keys

Owner, 2026-11-21: "We can add an AI Key, but I want to be able to use this across all apps not just
liveworkspace", and "Be very security minded, this is very sensitive information to a customer". A person can bring
their own AI provider's key once, and a team admin their team's, and every app's server can use it for that person's
model calls. The keys live in the accounts Worker, beside teams and tokens; no app keeps a copy.

A customer's AI key is the most sensitive thing the platform holds: it spends the customer's money at a third party,
and it is a credential we cannot revoke ourselves. Every rule below follows from that. The threat model and the
engineering detail are in [the blueprint](blueprints/ai-keys.md).

## What a key is

- **A personal key**, one per account, for the account's own model calls in every app.
- **A team key**, one per team, set by the team's admins. Every joined member's model calls on the team's work use
  it; no member, admin or not, ever sees it again once saved.
- Each holds a **provider** (`anthropic`, Anthropic's Claude, or `openai`), a **model** (one of the provider's,
  `@liveworkspace/ai` `MODEL_PROVIDERS`), the key itself, **sealed** (below), a **hint** (its last four characters,
  for "Key Ending 4f2a"; a value under 12 characters has no hint), **who set it** and **when**.
- Built-in AI is never a key. A person or team with no key saved uses whatever the app itself offers (liveknowledge's
  built-in AI), or nothing where the app offers none.

## Which key wins

One rule for every app, wherever a model is called for a person (owner's choice, 2026-11-21):

1. **The item's own key**, where an app keeps one (a liveknowledge knowledgebase's own key, kept in its room).
2. **The team's key**, when the item belongs to a team, the person is a joined member of it now, and the team has a
   key.
3. **The person's own key.**
4. **Built-in AI**, where the app has it; otherwise the feature says it needs a key.

Accounts answers steps 2 and 3 in one call (below); the app decides 1 and 4. A member who leaves a team, or is
removed, stops getting its key at once: membership is read on every call, never from a token's claim.

Work no person's request is behind (liveknowledge's background conflict check, an Automation's run) gets no team or
personal key: accounts answers a key only for the person a request proves, so such work uses the item's own key or
built-in AI. This is deliberate: storing a person's credential to use it later would put the key one stolen row away.

## Settings

**AI** is one of the account's categories in the Settings panel, in every app and on liveworkspace.app
([site.md](../010-site/site.md#settings)), listed under Account after Accessibility. It is drawn in place over the
host's door, as API Tokens are, for a signed-in account only (a guest, a workbench and a self-hosted editor show
none).

- **Your AI** opens with **Which AI**: two bordered rows, **Built-In AI** ("The app's own AI, where it has one. Daily
  limits apply.", an "Included" pill) and **Your Own Key** ("Anthropic or OpenAI, billed to you"). With no key saved
  Built-In AI is chosen; with one, Your Own Key. Choosing Built-In AI with a key saved asks first ("Remove Your Key?")
  and removes it.
- **Your Own Key** shows the **Provider** (two bordered rows, Anthropic (Claude) and OpenAI, a generic mark and the
  name as text, no company logo), a password field for the key (its placeholder the provider's prefix, `sk-ant-…`),
  the **Model**, and **Save Key**. Saving checks the key first ([Saving checks the key](#saving-checks-the-key)). Once
  saved: "Key Ending 4f2a", the provider, the model (a select, changed in place), when it was set, **Replace** and
  **Remove** (asked first). Two sentences say it is encrypted and never shown again, and that the provider bills the
  person for what it uses.
- **Team Keys** lists the person's teams, each with its state: "No Key", or the provider and model. A team's admins
  get the same controls as Your Own Key, and the hint; a member sees only that the team has a key and which
  provider, with "Only the team's admins can change this".
- **The typed key** is held only in its field, read once when sent and cleared in the same turn, whatever the
  answer. It is never kept in the page's state, a browser store, a log, telemetry or an error message.

## The account API

Over both doors, the session on liveworkspace.app (writes from the site's own origin) and an account's bearer
through an app's router ([Every account setting in every app](accounts.md#every-account-setting-in-every-app)). A
guest's bearer is refused (`401 signed_out`), and an API token (`lwt_…`) or an agent's credential is no bearer, so
no tool, script or agent can read the state or change a key.

| Route                                                    | Does                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/account/ai-key`                                | `{ available, key, teams, providers }`: `key` null or `{ provider, model, hint, setAt }`; never the key                   |
| `PUT /api/account/ai-key` `{ provider, model?, key }`    | checks, seals and saves it, replacing any; answers the `GET`                                                              |
| `PATCH /api/account/ai-key` `{ model }`                  | changes the model of the saved key; answers the `GET`                                                                     |
| `DELETE /api/account/ai-key`                             | removes it; answers the `GET`                                                                                             |
| `PUT` / `PATCH` / `DELETE /api/account/teams/:id/ai-key` | the same, for the team's key: its admins only (`403 admin_only`; not a joined member: `404 not_found`); answers the `GET` |

`teams` is each team the person has joined, `{ id, name, canManage, key }`, `canManage` for its admins, and `key`
the team's without `hint` for a member who is not one.

`available` is false, and every write answers `503 ai_keys_unavailable`, while this deployment has no `AI_KEY_SECRET`:
it fails closed, and keeps no key it could not seal.

Refusals: `400 invalid_provider`, `400 invalid_model`, `400 invalid_key` (empty, over 512 characters, or holding
whitespace or control characters), `422 key_rejected` (the provider refused it), `422 key_no_credit`,
`422 key_model_unavailable` (the key cannot use that model), `502 key_check_failed` (the provider could not be
reached or answered otherwise: nothing is saved, try again), `404 no_key` (a `PATCH` with none saved), `429
rate_limited`.

### Saving checks the key

Before a key is sealed, one cheap call proves it: `GET /v1/models/<model>` on the provider's own API host, with the
key as that provider expects it, given up after 8 seconds. It reads the model's record and spends nothing. A typo is
therefore never sealed, and the model is one the key can use. The host is fixed per provider in `@liveworkspace/ai`
(`api.anthropic.com`, `api.openai.com`, over HTTPS); nothing a caller sends can name another address, so the check
cannot be pointed at an internal service.

### Changes are deliberate

- Setting, replacing or removing a key needs a signed-in person: the session, or an account's bearer. Never a guest,
  an API token, an agent or an app's server: the internal door below only reads.
- A team key, only a team admin.
- Each team key change goes to the team's audit log as `team_ai_key_changed` ([Team events for the audit
  log](accounts.md#team-events-for-the-audit-log)), its detail `{ change: 'set' | 'replaced' | 'model' | 'removed',
provider }`, in the same batch as the change.
- Each change of a key (set, replaced, removed; not a model change) is emailed, after the answer: a personal key to
  the account's own verified address, a team key to each of the team's joined admins with a verified address. **Your
  AI Key Was Changed**: what changed, the provider, who did it and when, and "If this wasn't you, remove the key in
  Settings and revoke it with the provider". No email holds any part of a key, its hint included. These are account
  messages: they cannot be turned off.
- Writes are limited to 10 a minute per account (`AI_KEY_WRITE_LIMITER`), since each save calls a provider.

## How an app's server gets the key

`POST /internal/ai-key` on the accounts Worker, through the app's `ACCOUNTS` service binding only
(`aiKeyFor` in `@liveworkspace/auth-client`):

- **Reachable only over a service binding.** The path is outside every route the accounts Worker has on the zone
  (`/api/auth/*`, `/api/account/*`, the discovery documents), so no request from the internet reaches it, and outside
  every prefix an app's router forwards there. A request that carries a visitor's address anyway (`CF-Connecting-IP`,
  which Cloudflare sets on every request from the internet, or a router's `X-Liveworkspace-Proxy` or
  `X-Liveworkspace-Client-IP`) is refused with a plain `404`, as is any method but `POST`. `aiKeyFor` never falls back
  to a public route: with no binding it answers that there is no key service.
- **The caller proves the app.** Its client credentials (`Authorization: Basic`), checked as every internal call's are.
- **The caller proves the person.** The body's `token` is the person's own access token, the one the app's API was
  sent; accounts introspects it itself, and it must be live, an account's (never a guest's), and minted for this very
  client. So an app can only get the key of the person whose request it is serving. There is no way to ask for a key
  by account or team id alone.
- **A team key only for a member.** `teamId` (optional) names the item's team; accounts reads the person's membership
  itself, now. Not a joined member, and the team's key is not answered.
- **`want`**: `key` answers `{ source: 'team' | 'account', provider, model, key }`; `which` answers the same without
  `key` (for a settings view saying which applies); none applies: `{ source: null }`. A key that will not open
  answers `409 ai_key_unreadable` `{ source }`, so the app says so rather than quietly using another.
- **Limited** to 120 calls a minute per account (`AI_KEY_LIMITER`), `429 rate_limited`.
- **Not cached.** Every answer is `no-store`. The app holds the plain key in the one request's memory and drops it
  when the call ends: never in KV, a Durable Object's storage, a module global, a log or telemetry. A key removed or
  replaced stops being answered at once, so it stops working at the next call.

Unset `AI_KEY_SECRET`, the door answers `503 ai_keys_unavailable` and the app goes on as if there were no key.

## Sealing

- **AES-256-GCM**, under a key derived for each record with **HKDF-SHA-256** from the master secret
  (`AI_KEY_SECRET`), a fresh random salt per record, and the record's owner and provider, so no two records share a
  key and a key derived for one record opens no other.
- **Bound to its row.** The owner (`account:<id>` or `team:<id>`), the provider and the key version are the
  ciphertext's additional data: a sealed key copied to another account's or team's row, or relabelled to the other
  provider, does not open.
- **A key version on each record**, so the master secret can be rotated. `AI_KEY_SECRET` is `<version>:<secret>`
  (a bare secret is version 1), and `AI_KEY_SECRET_PREVIOUS` holds the one before while a rotation runs.

### Rotating the master secret

1. `wrangler secret put AI_KEY_SECRET_PREVIOUS` with the current value of `AI_KEY_SECRET`, as it is (with its
   version). Nothing changes: every record still opens under the current secret.
2. `wrangler secret put AI_KEY_SECRET` with `<n+1>:<openssl rand -hex 32>`. New keys are sealed under it; a record of
   version n opens under the previous secret.
3. The 15-minute cron re-seals every record of an older version under the current one, 50 a run, and logs how many
   are left (`[ai-keys] resealed`). A record that will not open under either is left, and counted.
4. Once the log says none are left, `wrangler secret delete AI_KEY_SECRET_PREVIOUS`.

Losing the secret makes every stored key unreadable: each person and team saves theirs again. Nothing else breaks.

## Deletion and export

- **Closing an account** deletes its personal key, in the same steps as its settings ([Closing an
  account](accounts.md#closing-an-account) step 2). Its team keys stay with their teams; their "set by" reads "Deleted
  account".
- **Deleting a team** (and the last member leaving, and a team closing with the account that ran it alone) deletes the
  team's key in the same batch.
- **Leaving or being removed** from a team ends the person's use of its key at once (above); the key stays the team's.
- **Download Your Data** never includes a key, sealed or not, nor its hint ([data-export.md](data-export.md)).

## Never readable

No route, internal or public, returns a key to a browser. No log line, telemetry event, error message or email holds
one: a provider's own error body is never passed on (each failure is one of a few kinds, told in fixed words), the
sealed form is never logged, and the request bodies that carry a key are never logged. Tests search every answer,
log line, error and email the code paths make for a planted key.

## In the apps

- **liveknowledge** uses it first: Ask, Draft a Page and Describe to Set Up follow the order above (its own
  knowledgebase key, the knowledgebase's team's, the person's, built-in AI); its background conflict check uses the
  knowledgebase's key or built-in AI only. AI Settings and Ask's Answer With say which is in use ("Uses Your Key",
  "Uses Your Team's Key", "Uses Built-In AI") and link to the shared setting
  ([search-and-ask.md](../../../../liveknowledge/docs/specs/030-knowledgebase/search-and-ask.md#which-key-answers)).
- **Every other app** shows the shared setting, and calls no model on it yet. livediagram's way in is
  [Build with AI](../../../../livediagram/docs/specs/019-marketing/build-with-ai.md#your-own-ai-key).

## What it costs

One extra service-binding call per model call, on the app's server, never on a page load: the client check (kept per
isolate for five minutes), the token's introspection, one rate-limit count, one indexed read of the key rows (and one
of the membership, with a team), and one HKDF and AES-GCM open. Settings reads the category's state in one call per open
of it: the person's key row, and their teams with their keys in one query.
