# GitHub pull requests: blueprint

Derived from [../github-pull-requests.md](../github-pull-requests.md). Parts 1 (the Pull Request field kind, card
mentions) and 2 (the webhook receiver and the repository connection) are built; the parts after them are laid out under [Later parts](#later-parts) and filled in as each is built.

## Domain and naming

| Spec term            | Identifier                                                       |
| -------------------- | ---------------------------------------------------------------- |
| Pull Request field   | custom field kind `pullrequest` in `CUSTOM_FIELD_KINDS`          |
| pull request         | `PullRequestRef` `{ owner, repo, number }`                       |
| short name           | `pullRequestText(ref)`: `owner/repo#42`                          |
| canonical address    | `pullRequestUrl(ref)`: `https://github.com/owner/repo/pull/42`   |
| linked pull requests | `cardPullRequests(item, type)` (fields; mentions join in part 3) |
| card mention         | `cardMentions(text, planName)`                                   |

The kind's name in the type editor is **Pull Request** (`CUSTOM_KIND_LABELS`); it is never "PR" in copy.

## Part 1: the Pull Request field

### packages/items

- `pull-request-fields.ts` (pure, no regex):
  - Constants: `PULL_REQUEST_OWNER_MAX` 39, `PULL_REQUEST_REPO_MAX` 100, `PULL_REQUEST_NUMBER_DIGITS_MAX` 10 (GitHub's
    own limits), `PULL_REQUEST_TEXT_MAX` 2,048 (a longer paste is not read), `LINKED_PULL_REQUESTS_MAX` 10, and
    `PULL_REQUEST_HINT`.
  - `parsePullRequestUrl(text: unknown): PullRequestRef | undefined`: trims; refuses a non-string, an empty text, one
    over `PULL_REQUEST_TEXT_MAX` and any whitespace inside; drops `https://` or `http://` and `www.` (case aside);
    needs `github.com` then `/`; the path ends at the first `?` or `#`; its steps are owner, repo, `pull`, number,
    then anything (`/files`, a trailing slash). Owner, repo and number are checked by character loops.
  - `pullRequestUrl`, `pullRequestText`, `pullRequestKey` (the short name lower-cased: one pull request whatever the
    case), `pullRequestValueOf(text)` (canonical address or undefined), `pullRequestValueText(value)` (short name or
    null).
  - `cardPullRequests(item, type)`: Pull Request fields then Link fields, in `type.custom` order, deduplicated by
    `pullRequestKey`, stopping at `LINKED_PULL_REQUESTS_MAX`.
- `card-mentions.ts` (pure, `indexOf` and loops): `MENTION_TEXT_MAX` 65,536, `MENTIONS_MAX` 20.
  `cardMentions(text, planName)`: the plan name's words (lower case, split on whitespace); the text's first
  `MENTION_TEXT_MAX` characters lower-cased; each `indexOf` hit of the first word not preceded by a letter or digit
  is read by `mentionAt`: each later word after at least one space, then spaces, an optional `#`, then 1 to 10 digits
  not followed by a letter or digit. A name ending in a digit needs a space or `#` before the number. Each number
  once, in first-met order, numbers from 1 only.
- Consumers: `CUSTOM_FIELD_KINDS` gains `pullrequest` after `link`; `customFieldText` reads `pullRequestValueText`;
  `board-csv.ts` `customValue` reads `pullRequestValueOf` (export writes the stored address as any string);
  `plan-names.ts` `resolveFields` stores `pullRequestValueOf` or refuses `value_invalid` with the hint; the kind
  change (`field-kind-change.ts`) needs nothing of its own: a value moving into the kind is read by `customValue`,
  and out of it as its stored text. `canBeRequired` allows it.

### apps/editor

- `PullRequestField.tsx`: a `TextInput` (`type="url"`, `inputMode="url"`, the spec's placeholder, `maxLength`
  `PULL_REQUEST_TEXT_MAX`); on blur an empty box clears, an address saves its canonical form (unchanged saves
  nothing), anything else puts the box back. After it, while the value is a pull request, an `<a target="_blank"
rel="noopener noreferrer">` to the canonical address, labelled "Open {short name} on GitHub (opens in a new tab)",
  tooltip **Open on GitHub**, the shared external-link glyph.
- `CustomFieldEditor` routes `pullrequest` to it. `CUSTOM_KIND_ICONS` gives the kind Lucide's `git-pull-request`;
  `SampleValue` draws `acme/web#42`; `item-type-display-sample.ts` samples
  `https://github.com/acme/web/pull/42`; `CUSTOM_KIND_LABELS` names it **Pull Request**; `add-field-kinds.ts`
  places it after Link in Links and Images with the spec's line and the aliases pr, github, merge request, code
  review, branch, git; `AddFieldTryIt`'s `CHECKS` refuse a non-address with `PULL_REQUEST_HINT`.
- The card face needs nothing new: a custom pill draws `CUSTOM_KIND_ICONS[kind]` and `customFieldText`.

### Agents and the api

- `plan-schema.ts` describes the kind in the `add`/`editCustom` kind enum (built from `CUSTOM_FIELD_KINDS`) and the
  listed field's kinds; the OpenAPI schema is regenerated (`gen:openapi`).
- The api's catalogue check takes the kind from `CUSTOM_FIELD_KINDS`; an older editor reads a `pullrequest` field
  read-only ([Fields from a newer version](../item-types.md#fields-from-a-newer-version)).

### Security and trust (part 1)

- Nothing calls GitHub. The panel's link is the canonical address built from checked parts, so a stored value can
  never be a `javascript:` or another site's address; it opens with `noopener noreferrer`.
- Both parsers are linear: `parsePullRequestUrl` one pass over at most 2,048 characters; `cardMentions` one
  `indexOf` scan plus a bounded read per hit over at most 65,536 characters.

### Performance and limits (part 1)

- `customFieldText` runs per card face pill render; `parsePullRequestUrl` on a stored value is a few hundred
  character comparisons. `cardMentions` runs only on a delivery (part 3), never on a render.

### Testing (part 1)

| Rule                                                                                   | Test                                                                                  |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Every accepted and refused address shape; canonical form; short name; key              | `packages/items/src/pull-request-fields.test.ts`                                      |
| Linked pull requests from Pull Request and Link fields, deduplicated and capped        | `packages/items/src/pull-request-fields.test.ts`                                      |
| Card mentions: boundaries, `#` optional, spaces, case, digit-ending names, caps        | `packages/items/src/card-mentions.test.ts`                                            |
| Both parsers stay linear on worst-case input                                           | `packages/items/src/card-mentions.test.ts`, `pull-request-fields.test.ts` (`cpuMsOf`) |
| Card text, CSV import, agent values and kind change into Pull Request                  | `packages/items/src/pull-request-fields.test.ts`                                      |
| The panel saves canonical, puts a bad paste back, opens on GitHub; Viewer is read-only | `apps/editor/components/plan/PullRequestField.test.tsx`                               |

### Constants and configuration

All part 1 constants are in `pull-request-fields.ts` and `card-mentions.ts`, named above, each from the spec's
Limits table or GitHub's own limits.

## Part 2: the receiver and the connection

### Configuration (`apps/api/src/github/github-config.ts`)

- `githubConfig(env)`: the App's settings, or null (the feature off) unless every one of `GITHUB_APP_ID`,
  `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET` and
  `GITHUB_WEBHOOK_SECRET` is a non-empty string and `GITHUB_LINKS` is bound. Every GitHub door asks it first and
  answers 404 `not_found` when null, logging nothing. `GET /api/capabilities` says `githubEnabled`.
- Constants: `WEBHOOK_BODY_MAX` 1,048,576; `REPOSITORIES_MAX` 20; `PLANS_PER_REPOSITORY_MAX` 20;
  `INSTALLATION_REPOSITORIES_LISTED` 100 (GitHub's `per_page` cap); `INSTALLATION_PLANS_MAX` 100;
  `CONNECT_STATE_TTL_MS` 600,000; `CONNECT_STATES_MAX` 20 (live states a plan keeps); `DELIVERY_KEEP_MS`
  259,200,000; `GITHUB_FETCH_TIMEOUT_MS` 10,000; `GITHUB_API` `https://api.github.com`, `GITHUB_WEB`
  `https://github.com`.

### The worker's doors (`apps/api/src/github/webhook-route.ts`)

Answered in `index.ts` before identity, as `/api/hooks` is: `segments[1] === 'github'` goes to `handleGithub`.

- `POST /api/github/webhook`: off, 404. Not POST, 405. A declared `Content-Length` over `WEBHOOK_BODY_MAX`, 413
  `github_too_large`, before a byte is read; the body read through `readCappedBody` at the same cap, 413. The
  signature (`webhook-signature.ts` `webhookSignatureOk`): `X-Hub-Signature-256` must be `sha256=` and 64 hex
  digits; the HMAC-SHA256 of the raw bytes under the secret (`crypto.subtle`), as lower-case hex, is compared with
  `timingSafeEqual`; anything else is 401 `github_signature_invalid`, with nothing parsed. Then `X-GitHub-Delivery`
  (1 to 100 of letters, digits and `-`) else 400 `github_delivery_invalid`; the body decoded as strict UTF-8 and
  `JSON.parse`d, else 400 `github_body_invalid`. `readDelivery(event, id, payload)` (`github-delivery.ts`, pure)
  reads what a plan needs: `{ id, event, action, installationId, repositoryIds }`, ids positive safe integers, or
  null for an event this part ignores (202 `{ delivered: 0 }`). `ping` answers 200 `{ ok: true }`.
  - The plans (`github-links.ts`): `pull_request` and `check_suite` list `repo:{id}:`; `installation_repositories`
    with `action: removed` lists each removed repository's prefix (at most `INSTALLATION_REPOSITORIES_LISTED`), the
    plans unioned; `installation` with `action: deleted` lists `installation:{id}:` (at most
    `INSTALLATION_PLANS_MAX`). Each listing is one `list({ prefix, limit })`.
  - Each plan's room is asked `github(planId, { kind: 'delivery', delivery })`, all at once. A plan answering
    `not_connected` to a `pull_request` or `check_suite` has its `repo:` key deleted. Every room answered: 202
    `{ delivered }` (the plans that acted); any threw: 502 `github_delivery_failed`.
  - Logs `[github] delivery` with the event, action, plans and outcome counts; never the body or a signature.
- `GET /api/github/callback?state&code&installation_id&setup_action`: off, 404. Not GET, 405. `state` must be
  `{plan id}.{43 base64url characters}` (a plan id is 1 to 200 of `A-Za-z0-9_-`), else 400
  `github_state_invalid`. `setup_action=request` (an organisation owner must approve) redirects to
  `#github=requested` without asking the room. Otherwise the room is asked
  `github(planId, { kind: 'callback', secret, code, installationId })`, and the answer is a 302 to
  `{appBaseUrl}/project/{plan id}#github=connected` or `#github=failed`, with `Cache-Control: no-store` and
  `Referrer-Policy: no-referrer` (the code is in the address).

### Talking to GitHub (`github/app-auth.ts`, `github/github-api.ts`)

- `app-auth.ts`: `pkcs8Of(pem)` reads `GITHUB_APP_PRIVATE_KEY` as GitHub gives it (PKCS#1, `BEGIN RSA PRIVATE KEY`)
  or as PKCS#8, with `\n` escapes read as line breaks, wrapping PKCS#1 in the PKCS#8 envelope for
  `crypto.subtle.importKey`. `appJwt(config, now)`: an RS256 JWT, `iat` 60 s back, `exp` 9 minutes on, `iss` the
  App id. `installationToken(config, installationId, now)`: `POST /app/installations/{id}/access_tokens` asking
  for `metadata: read` alone; the token is returned to the one caller and never stored.
- `github-api.ts`, every call with `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`,
  `User-Agent: liveplanner`, and `AbortSignal.timeout(GITHUB_FETCH_TIMEOUT_MS)`; a network failure, a timeout or a
  shape it does not expect is `null`, never a throw:
  - `exchangeCode(config, code)`: `POST {GITHUB_WEB}/login/oauth/access_token`, the person's token or null.
  - `userInstallationRepositories(token, installationId)`: `GET /user/installations/{id}/repositories?per_page=100`
    with the person's token; 404 (they can't reach the installation) is null.
  - `revokeUserToken(config, token)`: `DELETE /applications/{client id}/token`, basic auth with the client id and
    secret; best effort, its failure logged.
  - `appInstallation(config, installationId, now)`: `GET /app/installations/{id}` with the App's JWT: the account's
    login and whether it is suspended, or null.
  - `installationRepositories(config, installationId, now)`: an installation token, then
    `GET /installation/repositories?per_page=100`.
  - A repository reads as `{ id, fullName, private }`: `id` a positive safe integer, `full_name` 3 to 140
    characters with one `/`; any other entry is skipped.

### The plan's object (`plan-room/github/`)

- `github-schema.ts`, step V21: `github_connection (plan_id PK, installation_id, account, connected_by JSON
person, connected_at, rules NULL)`, `github_repositories (plan_id, repo_id, full_name, private, chosen; PK
plan_id, repo_id)`, `github_connect_states (hash PK, person, at)`, `github_deliveries (id PK, at)` with an index
  on `at`. A closed account's `connected_by` is anonymised with the rest of the plan (`plan-anonymise.ts`).
- `github-store.ts` (on `PLAN_DB`): `readConnection`, `saveConnection` (the connection and its repositories
  replaced in one batch), `chooseRepositories`, `dropRepositories`, `dropConnection`, `addConnectState` (expired
  states dropped, then the oldest past `CONNECT_STATES_MAX`), `claimConnectState` (`DELETE … RETURNING`, live only),
  `firstSight(id, now)` (deliveries past `DELIVERY_KEEP_MS` dropped; `INSERT OR IGNORE`; true when it inserted).
- `github-room.ts` `answerGithubCall`, the `PlanRoom.github(planId, call)` RPC (`plan-client.ts` `github`). An
  object with no plan schema answers `not_connected` (a callback, `failed`) and makes none.
  - `delivery`: no connection, another installation, or (for `pull_request` and `check_suite`) a repository not
    chosen: `not_connected`. A seen id: `replayed`. `installation_repositories`: the removed repositories dropped
    and their keys deleted. `installation` deleted: the connection dropped and its keys deleted. Otherwise
    `accepted` (part 3 acts here).
  - `callback` (`github-connect.ts` `finishConnect`): the state's hash claimed (none or expired: `failed`); the code
    exchanged; the person's repositories in the installation listed (null: `failed`); the token revoked; the
    installation read as the App (null or suspended: `failed`); the connection saved with up to
    `INSTALLATION_REPOSITORIES_LISTED` repositories, all chosen when there are at most `REPOSITORIES_MAX` and each
    has room (`PLANS_PER_REPOSITORY_MAX`, counted by listing its prefix); the index rewritten from the before and
    after sets. Logs `[github] connect` with the outcome only.
- `github/github-links.ts` `rewriteLinks(kv, planId, before, after)`: puts the keys `after` has and `before` lacks,
  deletes the rest, all at once.

### The plan's routes (`routes/github-routes.ts`, inside the room)

Every route: off, 404 (falls through). The gate: `requireOwner`; the plan (404); a signed-in account
(`accountUserId`), no API token, no workbench session, and `gateEdit` with no tab (so a link to one tab is refused);
else 403 `github_needs_editor`. Bodies are read by `readBody`.

- `GET /api/projects/:id/github`: `{ connection: GithubConnectionView | null }`.
- `POST /api/projects/:id/github/connect`: a new state (`{plan id}.{32 random bytes, base64url}`), its SHA-256 hash
  kept with the caller's person; 201 `{ url }`, `https://github.com/apps/{slug}/installations/new?state=…`.
- `PUT /api/projects/:id/github/repositories` `{ ids: number[] }`: no connection, 409 `github_not_connected`; not an
  array of safe integers, more than `REPOSITORIES_MAX`, or an id the plan does not list: 400 `github_invalid`; the
  installation's repositories listed as the App (null: 502 `github_unavailable`); an id it no longer sees, 409
  `github_repository_gone`; a repository at `PLANS_PER_REPOSITORY_MAX` other plans, 409 `github_repository_full`.
  Then saved, the index rewritten, and the view answered.
- `DELETE /api/projects/:id/github`: the connection dropped and its keys deleted; 204 (204 too with none).

### Security and trust (part 2)

- The signature is checked on the raw bytes before any parse, in constant time; the body is capped before it is
  read. A delivery names plans only through the index, and each plan checks the installation and repository
  against its own connection, so a forged or stale index entry acts on nothing.
- The callback carries no identity: the state is the proof that an Editor of the plan started it within 10 minutes,
  is spent before any call to GitHub (a replayed code finds none), and is kept only as a hash.
- The person's GitHub token lives for one request, in memory, and is revoked at its end. No installation token is
  stored either; the App's private key and the secrets are read from env only. Nothing logs a token, a code, a state,
  a signature or a body.
- Access: connecting, choosing and disconnecting are a signed-in whole-plan Editor's; the role tests prove a
  Participant, a Viewer, a tab-scoped Editor link, an API token, a workbench session and a guest are refused.

### Performance and limits (part 2)

- A delivery costs one HMAC over at most 1 MB, one KV list (one per removed repository), and at most 20 room
  calls (100 for an uninstall). The rooms answer from SQLite. Off, every door is one config read.
- Connecting makes at most five GitHub calls, once per connect; choosing makes two. Nothing runs on a render or a
  save.

### Testing (part 2)

| Rule                                                                                      | Test                                          |
| ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| Off with any secret or the KV missing: every door 404, no error logged, capabilities off  | `apps/api/src/github/github-webhook.test.ts`  |
| A bad or missing signature is refused before parsing; an oversized body, declared or read | `apps/api/src/github/github-webhook.test.ts`  |
| A delivery reaches only plans whose connection names it; a replay is ignored; removals    | `apps/api/src/github/github-webhook.test.ts`  |
| The connect round trip: state once, installation checked, token revoked, nothing stored   | `apps/api/src/github/github-connect.test.ts`  |
| Only a signed-in whole-plan Editor connects, chooses or disconnects                       | `apps/api/src/routes/github-routes.test.ts`   |
| The App's JWT signs with a PKCS#1 or PKCS#8 key; installation tokens are not kept         | `apps/api/src/github/app-auth.test.ts`        |
| `readDelivery` reads each event's ids and refuses odd shapes                              | `apps/api/src/github/github-delivery.test.ts` |

## Later parts

- **Part 3, state and rules**: the room's `github_pull_requests` table (key, state, checks, title, updated at);
  deliveries of `pull_request` and `check_suite` update it and run the two GitHub rules through the board's move
  checks, writing history entries by `github`; the card face's state chip; `list_items` lists states.
- **Part 4, entry points**: the plan's GitHub dialog (Connect GitHub, repositories, the two rules, Disconnect), the
  help article, telemetry (`Plan` · `Connected` · `GitHub` and the rest), and the roadmap's fold-back.
