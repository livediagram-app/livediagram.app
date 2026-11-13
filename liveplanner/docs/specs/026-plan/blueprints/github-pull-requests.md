# GitHub pull requests: blueprint

Derived from [../github-pull-requests.md](../github-pull-requests.md). Parts 1 (the Pull Request field kind, card
mentions), 2 (the webhook receiver and the repository connection), 3 (pull request state) and 4 (GitHub in Automations) are
built.

## Domain and naming

| Spec term            | Identifier                                                                   |
| -------------------- | ---------------------------------------------------------------------------- |
| Pull Request field   | custom field kind `pullrequest` in `CUSTOM_FIELD_KINDS`                      |
| pull request         | `PullRequestRef` `{ owner, repo, number }`                                   |
| short name           | `pullRequestText(ref)`: `owner/repo#42`                                      |
| canonical address    | `pullRequestUrl(ref)`: `https://github.com/owner/repo/pull/42`               |
| linked pull requests | `cardPullRequests(item, type)` (fields; mentions join in part 3)             |
| card mention         | `cardMentions(text, planName)`                                               |
| pull request state   | `PullRequestStatus` `{ key, url, title, state, checks?, cards? }`            |
| GitHub trigger       | `pull_request_opened` and its kin (`packages/items/src/automation/types.ts`) |
| GitHub (an author)   | `GITHUB_PERSON`, history tag `'github'`                                      |

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
  `INSTALLATION_REPOSITORIES_LISTED` 100 (GitHub's `per_page` cap); `REPOSITORY_PAGES_MAX` 10;
  `REFUSED_NETWORK_TURNED_AWAY_MS` 60,000; `REFUSED_NETWORKS_KEPT` 1,000; `INSTALLATION_PLANS_MAX` 100;
  `CONNECT_STATE_TTL_MS` 600,000; `CONNECT_STATES_MAX` 20 (live states a plan keeps); `DELIVERY_KEEP_MS`
  259,200,000; `GITHUB_FETCH_TIMEOUT_MS` 10,000; `GITHUB_API` `https://api.github.com`, `GITHUB_WEB`
  `https://github.com`.

### The worker's doors (`apps/api/src/github/webhook-route.ts`)

Answered in `index.ts` before identity, as `/api/hooks` is: `segments[1] === 'github'` goes to `handleGithub`.

- `POST /api/github/webhook`: off, 404. Not POST, 405. A network turned away (below), 429 `github_rate_limited`
  with `Retry-After: 60`, before anything else. A missing or malformed `X-Hub-Signature-256` (`signatureHex` null),
  401 `github_signature_invalid` before a byte is read. A declared `Content-Length` over `WEBHOOK_BODY_MAX`, 413
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
  - Logs `[github] delivery` with the event, action, plans and outcome counts; never the body or a signature. A room
    that threw is logged too, `[github] delivery.threw` (`console.error`) with the event, action and the error's name
    and message (cut to 500 characters), so a failure says why.
  - Refused signatures (`github/refused-signatures.ts`): the caller's network is `clientNetwork(clientIp(request))`
    (IPv4 /24, IPv6 /56), or none for GitHub's own webhook ranges (`GITHUB_HOOK_RANGES`, from GitHub's `/meta`
    `hooks`: 192.30.252.0/22, 185.199.108.0/22, 140.82.112.0/20, 143.55.64.0/20, 2a0a:a440::/29, 2606:50c0::/32),
    which are never limited. Each 401 calls `WRITE_RATE_LIMITER.limit({ key: 'github-refused:{network}' })` (absent
    binding: never limited); a refusal over it answers 429 and puts the network on the worker's turned-away list for
    `REFUSED_NETWORK_TURNED_AWAY_MS`, a Map bounded at `REFUSED_NETWORKS_KEPT` (the oldest goes). A turned-away
    network is answered 429 on arrival, its body never read or hashed. A delivery that signs right never calls the
    limiter.
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
    with the person's token, paged; 404 (they can't reach the installation) is null.
  - `revokeUserToken(config, token)`: `DELETE /applications/{client id}/token`, basic auth with the client id and
    secret; best effort, its failure logged.
  - `appInstallation(config, installationId, now)`: `GET /app/installations/{id}` with the App's JWT: the account's
    login and whether it is suspended, or null.
  - `installationRepositories(config, installationId, now)`: an installation token, then
    `GET /installation/repositories?per_page=100`, paged.
  - Paging (`listRepositories`): `&page=1`, `2`, ... while GitHub's `Link` header names a `rel="next"` page, at most
    `REPOSITORY_PAGES_MAX`; the address is always built here, never followed from the header, so a
    token only ever goes to `api.github.com`. Repositories are deduplicated by id across pages. Any page failing is
    null for the whole list (a half list would drop repositories a choice is checked against); past the last page
    allowed, the list so far is kept and `[github] repositories capped` is logged.
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
  `firstSight(id, now)` (deliveries past `DELIVERY_KEEP_MS` dropped; `INSERT OR IGNORE`; true when it inserted),
  `forgetSight(id)` (the id deleted: `deliver` calls it when acting on a delivery threw, then throws again, so the
  retry is not answered `replayed`).
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
  read. A network refused too often is turned away before its body is read; GitHub's webhook ranges never are. A delivery names plans only through the index, and each plan checks the installation and repository
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
- A turned-away network costs one Map read per call; a refusal, one limiter call. The turned-away list holds at most
  1,000 networks.
- Connecting makes at most five GitHub calls plus one per extra page of repositories (14 at 1,000), once per
  connect; choosing makes two plus the same extra pages. Nothing runs on a render or a
  save.

### Testing (part 2)

| Rule                                                                                      | Test                                          |
| ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| Off with any secret or the KV missing: every door 404, no error logged, capabilities off  | `apps/api/src/github/github-webhook.test.ts`  |
| A bad or missing signature is refused before parsing; an oversized body, declared or read | `apps/api/src/github/github-webhook.test.ts`  |
| Refused signatures are limited per network; GitHub's ranges and good deliveries never are | `apps/api/src/github/github-webhook.test.ts`  |
| An installation's repositories are read every page, bounded, a failed page failing all    | `apps/api/src/github/github-connect.test.ts`  |
| A delivery reaches only plans whose connection names it; a replay is ignored; removals    | `apps/api/src/github/github-webhook.test.ts`  |
| The connect round trip: state once, installation checked, token revoked, nothing stored   | `apps/api/src/github/github-connect.test.ts`  |
| Only a signed-in whole-plan Editor connects, chooses or disconnects                       | `apps/api/src/routes/github-routes.test.ts`   |
| The App's JWT signs with a PKCS#1 or PKCS#8 key; installation tokens are not kept         | `apps/api/src/github/app-auth.test.ts`        |
| `readDelivery` reads each event's ids and refuses odd shapes                              | `apps/api/src/github/github-delivery.test.ts` |

## Part 3: state on cards and the GitHub rules

### packages/items (`pull-request-state.ts`, pure)

- `PullRequestState` `'draft' | 'open' | 'merged' | 'closed'`; `PullRequestChecks` `'running' | 'passing' |
'failing'`; `PullRequestStatus` `{ key, url, title, state, checks?, cards?, updatedAt }`: `key` is
  `pullRequestKey`, `url` the canonical address, `cards` the ids of the cards its title or body names (absent for
  none), `updatedAt` GitHub's `updated_at` in ms.
- Constants: `PULL_REQUEST_TITLE_MAX` 256, `PULL_REQUESTS_KEPT` 500, `CHECK_SUITES_KEPT` 2,000, `RULE_MOVES_MAX` 50.
- `pullRequestStatusLabel(status)`: Draft, Open, Checks Running, Checks Passing, Checks Failing, Merged, Closed (the
  checks words only for an open pull request or a draft).
- `checksOf(results)`: the suites together, `failing` over `running` over `passing`; undefined for none.
- `PullRequestStatuses` `{ byKey, byCard }` and `pullRequestStatuses(list)`: the lookups a card reads, built once per
  change of the list.
- `cardFieldPullRequests(item, type)`: the pull requests the card's fields hold (Pull Request fields, then Link fields),
  each `{ ref, key, field }`; the part that parses addresses, kept by a screen while the card is unchanged.
- `cardLinkedPullRequests(item, type, statuses, fields?)`: those fields' pull requests, then each status whose `cards`
  holds the card, deduplicated by key, capped at `LINKED_PULL_REQUESTS_MAX`; each `{ ref, status?, field? }`, `field`
  the id of the field holding it.
- `GITHUB_PERSON` `{ id: 'github', name: 'GitHub', color: '#1f2328' }`; `ItemHistoryTag` gains `'github'` (read back
  by `readStoredHistory` as the other tags are).

### Wire (`packages/api-schema`)

- `ItemsResponse.pullRequests?: PullRequestStatus[]`: present only for a connected plan (empty when none link), so the
  editor knows a later paste may need a read. `GithubConnectionView.rules: GithubRules`; `GithubRulesRequest`
  `{ opened: string | null; merged: string | null }`.
- `PullRequestsRoomOp` `{ kind: 'pull-requests'; upserts: PullRequestStatus[]; removed: string[]; reset?: true }`
  (`reset`: every state the screen holds goes first), a system op kind. A tab-scoped session hears it emptied
  (`room-scope.ts`), and reads its tab's cards again.

### Reading a delivery (`apps/api/src/github/github-payloads.ts`, pure)

- `readPullRequest(payload)`: `{ repoId, ref, title, body, state, headSha, updatedAt }` or null: the number a
  positive safe integer; the repository's `full_name` read as `owner/repo` through `parsePullRequestUrl` of its
  address; `title` cut to `PULL_REQUEST_TITLE_MAX`, `body` to `MENTION_TEXT_MAX` (non-strings read as empty);
  `state` `merged` when `merged` (or `merged_at` is set), else `closed` when GitHub's state is closed, else `draft`
  when `draft`, else `open`; `headSha` 7 to 64 hex digits; `updatedAt` `Date.parse` of `updated_at`.
- `readCheckSuite(payload)`: `{ repoId, suiteId, headSha, checks, updatedAt }`: `checks` `running` unless `status` is
  `completed`, then `passing` for `success`, `neutral` or `skipped`, else `failing`.
- `readDelivery` carries them as `GithubDelivery.pullRequest` and `.checkSuite`; a `pull_request` or `check_suite`
  whose part does not read is ignored (202, as an event this part ignores).

### The plan's object (`plan-room/github/`)

- `github-schema.ts`, step V23 (`GITHUB_PULLS_SCHEMA`): `github_pull_requests (key PK, repo_id, url, title, state,
head_sha, cards JSON, updated_at, seen_at)` with indexes on `(repo_id, head_sha)` and `seen_at`;
  `github_check_suites (suite_id PK, repo_id, head_sha, checks, updated_at)` with an index on `(repo_id, head_sha)`.
  `github_connection.rules` holds `GithubRules` as JSON (null: both off); a connect again keeps them.
- `github-pulls-store.ts`: `upsertPull` (`INSERT … ON CONFLICT DO UPDATE … WHERE excluded.updated_at >= updated_at`,
  answering whether it wrote), `upsertSuite` (the same guard), `statusesOf(db, keys | null)` (each row with its head
  commit's suites folded by `checksOf`), `keysAtHead(db, repoId, sha)`, `dropPulls(db, repoIds | null)`, and the trims
  to `PULL_REQUESTS_KEPT` (by `seen_at`) and `CHECK_SUITES_KEPT` (by `updated_at`).
- `github-cards.ts`: `mentionedCardIds(env, planId, numbers)` by `item_key`, out of the Trash; `fieldCardIds(env,
planId, types, ref)`: the cards whose fields hold the pull request (`instr(lower(fields), ?) > 0` with
  `github.com/{owner}/{repo}/pull/{n}` lower-cased, each hit confirmed by `cardPullRequests`). Never a bound
  `LIKE` pattern: Durable Object SQLite refuses one over 50 bytes ("LIKE or GLOB pattern too complex"), and every
  repository's address is longer.
- `github-pulls.ts`: `actOnPullRequest(deps, delivery, now)` and `actOnCheckSuite`. A pull request: the plan's name
  read (`readPlanOutline`), its mentions read (`cardMentions` of title, a line break, body), the row upserted; a stale
  one (older `updated_at`) stops there. The changed status is sent (`send`). Then the rule: `opened` for `opened`,
  `reopened` or `ready_for_review` of a pull request not a draft; `merged` for `closed` when merged; the cards its
  fields and mentions link, at most `RULE_MOVES_MAX`. A check suite: upserted (stale: nothing), then every pull request
  at that commit sent.
- `github-moves.ts` `moveForRule(deps, target, cardIds, now)`: the plan's statuses read (`planOutline`); a target no
  board names logs `[github] rule.unplaced` and moves nothing; else each card read and left alone when gone, trashed,
  archived, already there or its type leaves the status out (`statusExcluded`); else `applyMove` to the column's end
  by `GITHUB_PERSON`, written at its rev (`ITEM_WRITE_RETRIES`), relayed as an `items` op and appended to history
  with tag `'github'` and source role `system`. Logs `[github] moved` with the counts.
- `github-room.ts`: `answerGithubCall` takes `relay` (items) and `send` (pull requests) from the room; a disconnect
  or an uninstall drops the states and sends `reset`, a removed repository its keys' removal.

### The routes

- `PUT /api/projects/:id/github/rules` `{ opened, merged }`, the part 2 gate (Editor in person, whole plan): no
  connection 409 `github_not_connected`; each a status of 1 to 64 characters naming a column of the plan's boards, or
  null, else 400 `github_invalid`; saved and the view answered. `GET /github` answers `rules`.
- `GET /items` (`item-routes.ts` `list`): for a connected plan, `pullRequests` holds the statuses linked to the cards
  answered (their fields' keys and the statuses naming one of them); none for a Community visitor.

### The editor

- `hooks/plan/usePullRequestStatuses.ts`: the statuses from every items read (`usePlanItems`'s `onRead`), the room's
  `pull-requests` op, and one more items read (once per key) when a card names a pull request the screen has no state
  for while the plan is connected.
- `components/plan/pull-request-store.ts`: the statuses as an external store in `PlanProvider` (`value-store.ts`, the
  store the plan's cards use too, apart from `PlanContext`); `useCardPullRequests(item, type)` picks a card's
  `cardLinkedPullRequests`, keeping its `cardFieldPullRequests` while the card is unchanged and the same array while
  the pick is, so a delivery redraws only the cards it touches; `usePullRequestStatus(ref)` reads one, for a field.
- `components/plan/PullRequestPill.tsx`: `PullRequestMark` (the state's Lucide mark: `git-pull-request` open,
  `git-pull-request-draft` draft, `git-merge` merged, `git-pull-request-closed` closed, in `PULL_REQUEST_TONES`),
  `ChecksMark` (`check`, `x`, a dot), `PullRequestPill` (a `MetaPill`: mark, short name, checks) and
  `PullRequestMarks` (the face's flags, up to 3). `PlanCardFace` draws a `pullrequest` field, or a `link` field
  holding a pull request, as a pill, and the rest as marks.
- `PullRequestField.tsx` draws the state chip and the title under the box; `CardPullRequests.tsx` lists the panel's
  **Pull Requests** for the ones no field holds, in Details after the fields.
- Activity: a `'github'` entry's run shows GitHub's mark disc and the name GitHub.

### Security and trust (part 3)

- What a delivery writes is GitHub's verified payload, read as untrusted shapes: lengths capped, ids checked, the
  address rebuilt from parsed parts, so a stored `url` is always `https://github.com/…`. The title is text, drawn as
  text.
- A pull request reaches only plans whose connection names its installation and repository (part 2); its mentions
  match only that plan's cards. A Community visitor is answered no states; a tab-scoped link only its tab's.
- GitHub's moves pass the same checks as any move (statuses a type leaves out, the Trash, the archive) and never act
  as a person: the author is GitHub.

### Performance and limits (part 3)

- Per delivery, per plan: one row upsert, one mention lookup by `item_key` (indexed, at most 20 numbers), and, only
  when a rule fires, one `instr` scan of the plan's `items.fields` in SQLite plus a read of the plan's tabs. The
  measured cost on a 2,000-card plan is in `github-pulls.perf.test.ts` (`cpuMsOf`).
- `GET /items` adds one read of the plan's kept statuses (at most 500) and `cardPullRequests` over the cards answered.
- The editor redraws only the cards whose linked statuses change. A delivery on a 2,000-card board makes the lookups
  again and re-picks each card from its kept fields; the first draw parses each field's address once
  (`packages/items/src/pull-request-state.perf.test.ts`). The unknown-key check looks only at cards that changed
  since its last pass.

### Testing (part 3)

| Rule                                                                                        | Test                                                        |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Labels, checks folding, a card's linked pull requests (fields, then mentions, deduplicated) | `packages/items/src/pull-request-state.test.ts`             |
| Payloads read as untrusted shapes: state, draft, merged, lengths, commits                   | `apps/api/src/github/github-payloads.test.ts`               |
| States kept, out of order ignored, checks per commit, a new commit's checks, trims          | `apps/api/src/github/github-pulls.test.ts`                  |
| Rules (part 4 replaced them with GitHub triggers, tested there)                             | `apps/api/src/github/github-triggers.test.ts`               |
| `GET /items` answers states to the cards' readers, a tab's alone, a Community visitor none  | `apps/api/src/github/github-pulls.test.ts`                  |
| Only a signed-in whole-plan Editor sets the rules                                           | `apps/api/src/routes/github-routes.test.ts`                 |
| A delivery's work on a 2,000-card plan                                                      | `apps/api/src/github/github-pulls.perf.test.ts`             |
| The face's pill and marks, the panel's chip and list                                        | `apps/editor/components/plan/PullRequestPill.test.tsx`      |
| The screen's states: reads, ops, a reset, a tab's empty op, one more read per unknown key   | `apps/editor/hooks/plan/usePullRequestStatuses.test.ts`     |
| A 2,000-card board's picks, first draw and a delivery                                       | `packages/items/src/pull-request-state.perf.test.ts`        |
| GitHub's moves in Activity: its disc and name, a run of their own                           | `apps/editor/components/plan/threads/CardActivity.test.tsx` |

## Part 4: GitHub in Automations

Part 3's two column rules (`GithubRules`, `PUT /github/rules`, `github-moves.ts`) are gone: no screen ever set them.
`github_connection.rules` stays in the schema, written NULL and never read.

### packages/items

- `packages/items/src/automation/types.ts`: the triggers `pull_request_opened`, `pull_request_merged`, `pull_request_closed` and
  `pull_request_checks { result: 'failing' | 'passing' }`; `GITHUB_TRIGGER_KINDS`, `isGithubTrigger`;
  `isPersonless` holds them.
- `packages/items/src/automation/github-triggers.ts` (pure): `GithubHeard` (`opened`, `merged`, `closed`, `checks_failing`,
  `checks_passing`); `heardOfPull(action, state)` (opened, reopened or ready_for_review while open; closed while
  merged or closed); `heardOfChecks(before, after)` (a change into failing or passing, open or a draft);
  `githubHears(trigger, heard)`; `heardOfTrigger(trigger)` (Test on a Card); `githubTriggerWords(heard, pr)` for the
  Audit Trail ("GitHub: acme/web#42 merged"). The run is by `GITHUB_PERSON` (`pull-request-state.ts`).
- `packages/items/src/automation/matches.ts`: the event kind `github` (`github: GithubHeard`, `pr`: the short name), heard by the four
  kinds alone. `sentence.ts` names them; `validate-conditions.ts` reads them; `pull_request_checks` needs `result`.
- `item-history.ts`: the tag `automation_github` (a GitHub-triggered rule's write: by Automation with the rule's name,
  drawn as GitHub's).

### apps/api

- `plan-room/github/github-runs.ts` `queueGithubRuns(env, heard, pr, cardIds, deliveryId, now)`: only when the plan's
  rules hear `github` (`env.AUTOMATIONS.kinds`, the hot-path check every write makes), one `github` event per card,
  id `g:{delivery}:{card}` (with the rule's id, the run's: a redelivery runs nothing twice), into
  `automation_queue` (`enqueueStatement`) and the room's wake (`queued`). By `GITHUB_PERSON`, role `system`.
- `github-pulls.ts`: `actOnPullRequest(deps, deliveryId, action, pr, now)`: as part 3, then `heardOfPull`; the cards
  its fields and mentions link (at most `RULE_MOVES_MAX`) queued. `actOnCheckSuite(deps, deliveryId, suite)`: the
  states at that commit read before (only when a rule hears `github`) and after the upsert; each pull request whose
  `heardOfChecks` fires queues its cards (its mentions and `fieldCardIds`).
- `automation-runner.ts`: a `github` event's trigger line is `githubTriggerWords`; `source.via = 'github'` makes
  `automation-writes.ts` tag the run's card writes `automation_github`. `automation-routes.ts` Test on a Card makes a
  `github` event (heard as the rule's trigger hears). `roleOfTag('automation_github')` is `automation`.
- Removed: `GithubRules`, `GithubRulesRequest`, `saveRules`, `NO_RULES`, the `rules` of `GithubConnectionView`, the
  route and its manifest entry.

### apps/editor

- `hooks/persistence/useCapabilities.ts` answers `githubEnabled` too, from the one cached capabilities read.
- `components/automations/github/`: `github-client.ts` (the four routes), `use-github-connection.ts` (the plan's
  connection, read when the screen asks, shared by the view and the trigger panel through a module cache keyed by
  plan; the view's `fresh` reads it again each time it opens, and the chooser reads it again on
  `github_repository_gone`, `github_invalid` or `github_not_connected`, counting only listed picks), `github-hash.ts` (eager and small: the `#github=` result read and dropped from the address, the rule draft
  kept in `sessionStorage` for the round trip, and the return's telemetry), `github-return.ts` (Connect GitHub and
  the return's words), `github-automations.ts` (the dialog's context: `githubEnabled`, the scope, the way to the
  view, the builder's draft), `GithubView.tsx` (the view: Not Connected, Connected, Disconnect's `ConfirmDialog`),
  `GithubRepositories.tsx` (the chooser), `GithubConnectCard.tsx` (the Not Connected card, whole in the view and
  compact in the trigger panel), `GithubTriggerFields.tsx` (a GitHub trigger's panel: Checks Finished's Failing or
  Passing, which cards it runs on, the connection's line or the card), `GithubButton.tsx` (the header's entry).
- GitHub's mark is the shared `GithubMarkIcon` (`packages/ui/src/icons/brand-marks.tsx`), which livediagram's
  repository link now uses too.
- `trigger-groups.ts`: the `github` group, offered only when `githubEnabled` (`offeredGroups`, which keeps it for a
  rule already on one), noted **Not Connected** in Pick a Trigger while the plan is not; `TriggerScene.tsx` draws its
  four scenes (a card's pull request pill turning from one state to the next).
- `AutomationsContext.tsx`: the targets `{ view: 'github'; result? }` and a new rule's `draft` with its `github`
  result; `AutomationsHost.tsx` reads the return hash as it first draws, drops it from the address, and once the
  scope is known opens the screen at the view (or at the kept draft's builder, with a toast saying how it went).
- `RuleBuilder.tsx` keeps a new rule's body in the context's draft, and its save sends `AutomationRuleGithub` too.
- Activity: an `automation_github` run shows GitHub's disc and "GitHub · {rule}"; Set by Automation counts it.

### Telemetry

`Plan · Started · GithubConnect`, `Plan · Linked · Github`, `Plan · Ended · GithubConnectFailed`,
`Plan · Ended · GithubConnectRequested`, `Plan · Unlinked · Github`, `Plan · Created · AutomationRuleGithub`: every
action from the existing vocabulary, every type a fixed token.

### Testing (part 4)

| Rule                                                                                     | Test                                                               |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| What each action and check change is heard as; words; reading and naming the triggers    | `packages/items/src/automation/github-triggers.test.ts`            |
| A delivery queues one run per linked card; replays and stale deliveries queue nothing    | `apps/api/src/github/github-triggers.test.ts`                      |
| A GitHub-triggered rule moves the card, by GitHub in history, and nothing without a rule | `apps/api/src/github/github-triggers.test.ts`                      |
| The rules route is gone; the view has no rules                                           | `apps/api/src/routes/github-routes.test.ts`                        |
| The view's states, the chooser, Disconnect's confirm, the return hash, roles             | `apps/editor/components/automations/github/GithubView.test.tsx`    |
| The GitHub group only when enabled; a trigger's panel                                    | `apps/editor/components/automations/github/GithubTrigger.test.tsx` |
| The return hash, the draft round trip and its telemetry                                  | `apps/editor/components/automations/github/github-hash.test.tsx`   |
