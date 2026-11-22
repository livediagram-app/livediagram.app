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

- **Your Key** opens with **Which AI**, a two-way switch: **Built-In AI** ("Included with every app, with daily
  limits. No key needed.") and **Your Own Key** ("Your Anthropic or OpenAI key, billed by the provider, with no daily
  limits."). With no key saved it starts on Built-In AI.
- **Your Own Key** shows the **Provider** (the same switch: Anthropic (Claude) or OpenAI, the name as text, no
  company logo), a masked text field for the key (its placeholder the provider's prefix, `sk-ant-…`), in no form and never a
  password field, so no browser offers to save it, **Save Key**, and the **Model** (the provider's list, its most capable first chosen). Saving
  checks the key first ([Saving checks the key](#saving-checks-the-key)); a refusal is said in words and the field is
  cleared. A sentence says it is checked, kept encrypted and never shown again, and who the provider bills.
- **Once saved** the switch gives way to the key: the provider, "Key ending 4f2a · Added 3 Nov 2026", the **Model**
  (a select, changed in place), **Replace Key** (the same form, with Cancel) and **Remove**, which asks in place
  (**Remove now** or **Keep**). Removed, it is back on Built-In AI.
- **Your Teams' Keys** lists each team the person has joined. A team's admins get the same controls, for the team
  ("bills the team Design"); a member sees only "Uses the team's OpenAI key in the team's work. Only its admins can
  change it.", or "No team key: the team's work uses your key, or built-in AI. Its admins can add one."
- **The typed key** is held only in its field's own state, read once when sent and cleared in the same turn, whatever
  the answer. It is never kept anywhere else in the page, in a browser store, a log, telemetry or an error message.
- Without the master secret on the server, a note says "AI keys can't be kept here just now. Built-in AI still
  works.", and a save is refused (`503 ai_keys_unavailable`).

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

- Setting, replacing or removing a key needs a signed-in person: the session, or an account's bearer whose session
  (`sid`) is still live, so a change never outlives Sign out (an access token alone lives out its 15 minutes). Never a
  guest, an API token or an agent: the internal door below only reads. An app's server that is sent a person's bearer
  could use it here for those 15 minutes, as for every bearer setting; the change email is the person's warning.
- A team key, only a team admin.
- Each team key change goes to the team's audit log as `team_ai_key_changed` ([Team events for the audit
  log](accounts.md#team-events-for-the-audit-log)), its detail `{ change: 'set' | 'replaced' | 'model' | 'removed',
provider }`, in the same batch as the change.
- Each change of a key (set, replaced, removed; not a model change) is emailed, after the answer: a personal key to
  the account's own verified address, a team key to each of the team's joined admins with a verified address. **Your
  AI Key Was Changed**: what changed, the provider, who did it and when, and "If this wasn't you, remove the key in
  Settings and revoke it with the provider". No email holds any part of a key, its hint included. These are account
  messages: they cannot be turned off.
- Writes are limited to 10 a minute per account and 10 a minute per network range across accounts
  (`AI_KEY_WRITE_LIMITER`), since each save calls a provider: saving is no way to test a list of stolen keys. A body
  over 4 KB is refused unread (`413 too_large`).

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
- **A key only to an app that calls a model.** `want: 'key'` is answered only to the apps listed in
  `AI_KEY_READERS` (every product: livediagram, liveplanner, livedocuments, livedesign, livehuddle and
  liveknowledge, since [Every AI feature honours the choice](#every-ai-feature-honours-the-choice); an app that
  adopts the key is added in the same change), else `403 not_a_key_reader`. Every registered app may ask `which`.
- **`want`**: `key` answers `{ source: 'team' | 'account', provider, model, key }`; `which` answers the same without
  `key` (for a settings view saying which applies); none applies: `{ source: null }`. A key that will not open
  answers `409 ai_key_unreadable` `{ source }`, so the app says so rather than quietly using another.
- **Limited** to 120 calls a minute per account for each of `key` and `which`, counted apart (`AI_KEY_LIMITER`),
  `429 rate_limited`, so a page reading which key applies never uses up the calls a model needs.
- **Not cached.** Every answer is `no-store`. The app holds the plain key in the one request's memory and drops it
  when the call ends: never in KV, a Durable Object's storage, a module global, a log or telemetry. A key removed or
  replaced stops being answered at once, so it stops working at the next call.

Unset `AI_KEY_SECRET`, the door answers `503 ai_keys_unavailable`, which `aiKeyFor` reads as no key (`none`): a
deployment that keeps no keys has none to apply, and Settings already says "Built-in AI still works". An app that cannot get an answer (accounts down,
slow, rate limited) for a signed-in person refuses the call in words ("Your AI key settings couldn't be reached just
now"), never sending the person's words to built-in AI on a guess; an app with no accounts to ask (self-hosted) has
no shared keys.

## Sealing

- **AES-256-GCM**, under a key derived for each record with **HKDF-SHA-256** from the master secret
  (`AI_KEY_SECRET`), a fresh random salt per record, and the record's owner and provider, so no two records share a
  key and a key derived for one record opens no other.
- **Bound to its row.** The owner (`account:<id>` or `team:<id>`), the provider and the key version are the
  ciphertext's additional data: a sealed key copied to another account's or team's row, or relabelled to the other
  provider, does not open.
- **A key version on each record**, so the master secret can be rotated. `AI_KEY_SECRET` is `<version>:<secret>`
  (a bare secret is version 1), and `AI_KEY_SECRET_PREVIOUS` holds the one before while a rotation runs. A secret
  under 32 characters is refused (every route fails closed), and a previous secret with the current version is
  ignored; each is said once in the log, never with the secret.

### Rotating the master secret

1. `wrangler secret put AI_KEY_SECRET_PREVIOUS` with the current value of `AI_KEY_SECRET`, as it is (with its
   version). Nothing changes: every record still opens under the current secret.
2. `wrangler secret put AI_KEY_SECRET` with `<n+1>:<openssl rand -hex 32>`. New keys are sealed under it; a record of
   version n opens under the previous secret.
3. The 15-minute cron re-seals every record of the previous version under the current one, 50 a run, and logs how
   many of any older version are left (`[ai-keys] resealed`). A record that will not open under either is left, and counted.
4. Once the log says none are left, `wrangler secret delete AI_KEY_SECRET_PREVIOUS`.

Losing the secret makes every stored key unreadable: each person and team saves theirs again. Nothing else breaks.

## Deletion and export

- **Closing an account** deletes its personal key, in the same steps as its settings ([Closing an
  account](accounts.md#closing-an-account) step 2). Its team keys stay with their teams; their "set by" reads "Deleted
  account". A team key the account set goes too (below).
- **Deleting a team** (and the last member leaving, and a team closing with the account that ran it alone) deletes the
  team's key in the same batch.
- **Leaving or being removed** from a team ends the person's use of its key at once (above). A team key the person
  set goes with them, in the same batch, written to the audit log as removed: their provider bills it, and once out
  of the team they could no longer remove it. A key another admin set stays.
- **Download Your Data** never includes a key, sealed or not, nor its hint ([data-export.md](data-export.md)).

## Never readable

No route, internal or public, returns a key to a browser. No log line, telemetry event, error message or email holds
one: a provider's own error body is never passed on (each failure is one of a few kinds, told in fixed words), the
sealed form is never logged, and the request bodies that carry a key are never logged. Tests search every answer,
log line, error and email the code paths make for a planted key.

## In the apps

### Every AI feature honours the choice

Owner, 2026-11-22: every AI touchpoint "tells the user whether it uses the built in AI or their own key, and takes
them to the settings page on the AI category so they can add their own key". So every model call an app makes for a
person follows [Which key wins](#which-key-wins), and says which AI it runs on.

- **Who has a key to use.** A request a signed-in person makes in person (their account's access token, sent as the
  bearer). An API token, a workbench session, a guest and a link visitor have no key: their calls run on built-in
  AI. So does work no person's request is behind (an Automation's AI steps, liveknowledge's conflict check), as
  above.
- **One door.** The app's server asks accounts `want: 'key'` (`aiKeyFor`) with the person's token and the item's
  team (none before an item exists, as for Describe a Plan), then hands `@liveworkspace/ai`'s `ownKeyOf` the answer:
  a key makes the call on the provider's own API through `callModel` (its address checked where it leaves,
  `providerFetch`), anything else runs on built-in AI. Accounts could not answer: the call is refused in words, as
  above. A key that is set but does not open: refused, `ai_key_unreadable`.
- **Built-in AI's allowances are built-in AI's.** Daily caps and counts (Describe a Plan's and Describe a Form's
  drafts a day, an item's AI asks a day, livediagram's photo reader's daily budget) are spent only by a call on
  built-in AI. A call on a key counts toward none of them; the per-network rate limits that keep a server up still
  apply.
- **A key that fails says so.** A call on a key the provider refuses (`bad-key`, `no-credit`,
  `model-unavailable`) or that will not open is answered `ai_key_failed` with `aiKey: { source, provider, kind }`
  and the kind's fixed words, never the provider's. It never falls back to built-in AI. Other failures on a key (busy,
  rate limited, declined) are said in the same fixed words and change nothing on the line.

### The source line (AiSource)

One shared component, `AiSource` (`@liveworkspace/settings-ui/ai-source`), drawn under the field of every AI feature:
Describe a Plan, Describe a Form, Describe a Rule, the AI steps, livediagram's photo reader and liveknowledge's Ask,
Describe to Set Up and Describe the Structure.

- **Built-in AI**: a small sparkle mark, "Built-in AI", and the feature's own allowance as its quiet second line
  ("Plans and forms share 20 drafts a day").
- **Your Key** (or **Your Team's Key**, **This Knowledgebase's Key**): a mark in the provider's tone, the provider
  and model ("Anthropic · Claude Sonnet 5.5"), never any part of the key, its hint included. "No daily limits" as the
  second line.
- **Key Needs Attention**: a warning mark and the failure's fixed words ("Claude did not accept the API key"), with
  **Fix Key**. It shows after a call answered `ai_key_failed`, until the next answer or a change of key.
- **Its action**, a quiet text button with a pointer cursor and a tooltip: **Use Your Own Key** on built-in AI,
  **Change** on a key. It opens the Settings panel on the AI category over the open dialog, which stays open
  underneath with what was typed. Escape closes Settings first.
- **Who gets the action.** Anyone who can use the feature sees the line. The action is only for someone who can
  change what applies: a signed-in account for their own key; for a team key, the team's admins (a member sees
  "Your Team's Key" with the tooltip "Only the team's admins can change it"); for a knowledgebase's own key, its
  Editors (opening its AI Settings). A guest sees no line: the features are for signed-in people.
- **Closing Settings re-reads it, with no reload.** Settings › AI announces each change it makes
  (`liveworkspace:ai-key-changed`, carrying no key), and every mounted line reads `GET /api/account/ai-key` again; the
  next request follows the new answer by itself, since the server asks accounts on every call.
- **Which line applies** is worked out in the page from the same `GET /api/account/ai-key` Settings reads: the item's
  team's key for a joined member, else the person's own, else built-in AI. liveknowledge reads its own `GET ai`
  instead, which knows the knowledgebase's key.
- **Telemetry.** `UI Opened AiSourceSettings` when the action opens Settings, and `UI Added AiSourceKey` when a line
  that opened Settings turns from built-in AI to a key. Neither carries a provider, model or key.

### Each app

- **liveknowledge**: Ask, Draft a Page and Describe to Set Up follow the order above (its own knowledgebase key, the
  knowledgebase's team's, the person's, built-in AI); its background conflict check uses the knowledgebase's key or
  built-in AI only. AI Settings and Ask's Answer With say which is in use and link to the shared setting
  ([search-and-ask.md](../../../../liveknowledge/docs/specs/030-knowledgebase/search-and-ask.md#which-key-answers)).
- **liveplanner**: Describe a Plan, Describe a Form and Describe a Rule
  ([describe-a-plan.md](../../../../liveplanner/docs/specs/026-plan/describe-a-plan.md#which-ai-drafts-it)).
- **Every app's Automations**: Describe a Rule runs on the person's key; the AI steps run on built-in AI
  ([automations.md](../018-automations/automations.md#ai)).
- **livediagram**: the photo reader ([note-reader.md](../../../../livediagram/docs/specs/021-event-storming/note-reader.md#on-your-own-key)).
  Its way in is [Build with AI](../../../../livediagram/docs/specs/019-marketing/build-with-ai.md#your-own-ai-key).

## What it costs

One extra service-binding call per model call, on the app's server, never on a page load: the client check (kept per
isolate for five minutes), the token's introspection, one rate-limit count, one indexed read of the key rows (and one
of the membership, with a team), and one HKDF and AES-GCM open. Settings reads the category's state in one call per open
of it: the person's key row, and their teams with their keys in one query.
