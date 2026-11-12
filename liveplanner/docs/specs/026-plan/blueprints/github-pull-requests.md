# GitHub pull requests: blueprint

Derived from [../github-pull-requests.md](../github-pull-requests.md). Part 1 (the Pull Request field kind, card
mentions) is built; the parts after it are laid out under [Later parts](#later-parts) and filled in as each is built.

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

## Later parts

- **Part 2, receiver and connection**: `apps/api/src/github/` with `webhook-route.ts` (`POST /api/github/webhook`:
  404 unless every secret and `GITHUB_LINKS` are set; the raw body read up to 1 MB; `X-Hub-Signature-256` checked by
  `crypto.subtle` HMAC-SHA256 and a constant-time compare before `JSON.parse`; `X-GitHub-Delivery` kept for a day in
  the plan's object to act once), `app-auth.ts` (the App's RS256 JWT from `GITHUB_APP_PRIVATE_KEY` by WebCrypto,
  installation tokens minted per delivery and never stored), `connect-route.ts` (the install and user-authorisation
  round trip; `GET /user/installations` with the person's token, then the token dropped), and the plan room's
  `github_connection` table (installation id, repositories, connected by and at, rules). `GITHUB_LINKS` is written
  `repo:{id}` → project ids on connect and disconnect. The Share roles spec names connecting as an Editor's.
- **Part 3, state and rules**: the room's `github_pull_requests` table (key, state, checks, title, updated at);
  deliveries of `pull_request` and `check_suite` update it and run the two GitHub rules through the board's move
  checks, writing history entries by `github`; the card face's state chip; `list_items` lists states.
- **Part 4, entry points**: the plan's GitHub dialog (Connect GitHub, repositories, the two rules, Disconnect), the
  help article, telemetry (`Plan` · `Connected` · `GitHub` and the rest), and the roadmap's fold-back.
