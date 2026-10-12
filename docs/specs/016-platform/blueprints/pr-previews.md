# PR previews blueprint

Derived from [PR previews](../pr-previews.md).

## Domain and naming

| Term                | Identifier                              | Meaning                                                                 |
| ------------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| PR number           | `PrNumber`, `parsePrNumber`             | A positive integer, at most `MAX_PR_NUMBER`; every name derives from it |
| Tier                | `PreviewTier`: `'preview' \| 'full'`    | Preview (staging's api) or Full preview (own api, D1, R2)               |
| Preview app         | `PreviewApp`, `TIER_APPS`               | An app a tier deploys, in deploy order                                  |
| Preview environment | `PREVIEW_ENV` = `'preview'`             | The wrangler environment name in every generated config                 |
| Preview config      | `previewConfig`, `PREVIEW_CONFIG_FILE`  | The generated `wrangler.preview.toml` beside an app's `wrangler.toml`   |
| Label               | `FULL_PREVIEW_LABEL` = `'full-preview'` | Forces a Full preview; added by the tier job when the graph matches     |
| Tier decision       | `decideTier`                            | Graph or label → tier, plus whether to add the label                    |
| Teardown scope      | `TeardownScope`: `'all' \| 'full'`      | Everything the PR owns, or only what a Full preview adds                |
| Teardown step       | `TeardownStep`                          | One deletion, in the order `teardownPlan` returns                       |
| Sweep               | `sweepTargets`                          | PR numbers that own resources but whose PR is no longer open            |

Names, all from `src/names.ts`, never assembled elsewhere:

| Function                 | Result for PR 123                |
| ------------------------ | -------------------------------- |
| `workerName(app, n)`     | `livediagram-<app>-pr-123`       |
| `stagingWorkerName(app)` | `livediagram-<app>-staging`      |
| `d1Name(n)`              | `livediagram-pr-123`             |
| `r2Name(n)`              | `livediagram-images-pr-123`      |
| `previewHost(n)`         | `pr-123.livediagram.app`         |
| `previewOrigin(n)`       | `https://pr-123.livediagram.app` |

`ownerOf(name)` is the inverse: it returns the PR number a worker, D1 or R2 name belongs
to, or `null` for any name that is not exactly one of the three shapes above (production
and staging names are therefore never matched).

## Modules

| File                                         | Responsibility                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| `packages/preview-env/package.json`          | `@livediagram/preview-env`, private, Node-only CI tooling; depends on `smol-toml` |
| `packages/preview-env/src/names.ts`          | Constants, `parsePrNumber`, every name function, `ownerOf`                        |
| `packages/preview-env/src/apps.ts`           | `PreviewApp`, `TIER_APPS`, `inTier`                                               |
| `packages/preview-env/src/config.ts`         | `previewConfig` and its rewrite rules (pure: TOML object in, TOML object out)     |
| `packages/preview-env/src/tier.ts`           | `parseTurboLs`, `decideTier`                                                      |
| `packages/preview-env/src/teardown.ts`       | `teardownPlan`, `isNotFound`                                                      |
| `packages/preview-env/src/sweep.ts`          | `sweepTargets`                                                                    |
| `packages/preview-env/src/log.ts`            | `logLine`, the one log format                                                     |
| `packages/preview-env/scripts/config.ts`     | CLI: reads `wrangler.toml`, writes `wrangler.preview.toml`                        |
| `packages/preview-env/scripts/check.ts`      | `staging:check`: dry-runs the generated api and router configs, both tiers        |
| `packages/preview-env/scripts/args.ts`       | `--name value` parsing shared by the CLIs                                         |
| `packages/preview-env/scripts/tier.ts`       | CLI: runs turbo, prints `tier=` and `add_label=` for `$GITHUB_OUTPUT`             |
| `packages/preview-env/scripts/d1.ts`         | CLI: ensures the PR's D1 exists, prints its id                                    |
| `packages/preview-env/scripts/r2.ts`         | CLI: ensures the PR's R2 bucket exists                                            |
| `packages/preview-env/scripts/cloudflare.ts` | The REST calls: list and delete workers, D1, R2 buckets and objects               |
| `packages/preview-env/scripts/teardown.ts`   | CLI: runs a teardown plan through `cloudflare.ts`                                 |
| `packages/preview-env/scripts/sweep.ts`      | CLI: lists resources and open PRs, tears down each sweep target                   |
| `apps/api/scripts/hosted-vars.mjs`           | `ENVIRONMENTS` gains `preview`; `hostedEnvironment('preview')`                    |
| `apps/api/hosted-vars.json`                  | `environments.preview`, every value `""`                                          |
| `apps/router/src/index.ts`                   | `NOINDEX_ENVS` = `staging`, `preview`                                             |
| `.github/workflows/deploy-reusable.yml`      | Inputs `preview_pr`, `preview_tier`; config generation; tier-aware job conditions |
| `.github/workflows/deploy-preview.yml`       | PR events → gate, tier, deploy, downgrade, teardown                               |
| `.github/workflows/preview-sweep.yml`        | Daily and on demand: `packages/preview-env/scripts/sweep.ts`                      |
| `apps/*/.gitignore` or root `.gitignore`     | `wrangler.preview.toml`                                                           |

## Interfaces and contracts

```ts
// src/names.ts
export const PREVIEW_ENV = 'preview';
export const PREVIEW_CONFIG_FILE = 'wrangler.preview.toml';
export const FULL_PREVIEW_LABEL = 'full-preview';
export const PREVIEW_ZONE = 'livediagram.app';
export const MAX_PR_NUMBER = 999_999;
export type PrNumber = number & { readonly __pr: true };
export function parsePrNumber(value: unknown): PrNumber; // throws PreviewError('bad-pr')
export function workerName(app: PreviewApp, pr: PrNumber): string;
export function stagingWorkerName(app: string): string;
export function d1Name(pr: PrNumber): string;
export function r2Name(pr: PrNumber): string;
export function previewHost(pr: PrNumber): string;
export function previewOrigin(pr: PrNumber): string;
export function ownerOf(name: string): PrNumber | null;

// src/apps.ts
export type PreviewApp =
  'marketing' | 'live' | 'telemetry' | 'help' | 'community' | 'api' | 'router';
export const TIER_APPS: Record<PreviewTier, readonly PreviewApp[]>;
//   preview: marketing, live, telemetry, help, community, router
//   full:    marketing, live, telemetry, help, api, community, router
export function inTier(app: string, tier: PreviewTier): app is PreviewApp;

// src/config.ts
export interface PreviewConfigInput {
  app: PreviewApp;
  pr: PrNumber;
  tier: PreviewTier;
  d1Id?: string; // required for api; a UUID
}
export function previewConfig(source: TomlTable, input: PreviewConfigInput): TomlTable;

// src/tier.ts
export const API_PACKAGE = '@livediagram/api';
export function parseTurboLs(json: string): string[]; // package names; throws PreviewError('bad-turbo')
export function decideTier(input: { affected: readonly string[]; labels: readonly string[] }): {
  tier: PreviewTier;
  addLabel: boolean; // graph matched and the label is absent
  reason: 'graph' | 'label' | 'none';
};

// src/teardown.ts
export type TeardownStep =
  | { kind: 'worker'; name: string }
  | { kind: 'r2'; name: string } // empty, then delete
  | { kind: 'd1'; name: string };
export function teardownPlan(pr: PrNumber, scope: TeardownScope): TeardownStep[];
export function isNotFound(outcome: { status: number; errors?: { code: number }[] }): boolean;

// src/sweep.ts
export function sweepTargets(
  resourceNames: readonly string[],
  openPrs: readonly number[],
): PrNumber[];

// src/log.ts
export function logLine(event: string, fields: Record<string, string | number>): string;
```

Every failure is a `PreviewError` with a `code`, so the CLIs and tests name the
rejection, never match on message text:

| Code             | Raised when                                                                            |
| ---------------- | -------------------------------------------------------------------------------------- |
| `bad-pr`         | PR number not an integer in `1..MAX_PR_NUMBER`                                         |
| `no-staging-env` | The app's `wrangler.toml` has no `[env.staging]`                                       |
| `bad-name`       | `[env.staging].name` is not `stagingWorkerName(app)`                                   |
| `unknown-key`    | `[env.staging]` holds a key outside `KNOWN_ENV_KEYS`                                   |
| `bad-service`    | A service binding's `service` is not `livediagram-<app>-staging`                       |
| `kv-in-preview`  | Any `kv_namespaces` in an app a tier deploys                                           |
| `bad-d1`         | api's D1 is not exactly one `DB` binding, or `d1Id` is missing or not a UUID           |
| `bad-r2`         | api's R2 is not exactly one `IMAGES` binding                                           |
| `missing-var`    | router lacks `vars.DEPLOY_ENV`, or api lacks `vars.AI_ALLOWED_ORIGINS`                 |
| `has-routes`     | `[env.staging]` already declares `routes`                                              |
| `not-in-tier`    | `previewConfig` asked for an app the tier does not deploy (api on a Preview, mcp ever) |
| `bad-turbo`      | `turbo ls` output is not the expected JSON                                             |

## Behaviour and state

### Config rewrite (`previewConfig`)

Input is the parsed `wrangler.toml`; `S` is its `env.staging` table. Output:

1. Every top-level key of the source except `env`, unchanged (so `main`,
   `compatibility_date`, `compatibility_flags`, `assets`, `rules`, top-level `triggers`
   stay as wrangler resolves them).
2. `env = { preview: P }`, where `P` starts as a deep copy of `S` and then:

| Key in `S`                                          | Rule                                                                                                                                                        |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                                              | Must equal `stagingWorkerName(app)` (`bad-name`); becomes `workerName(app, pr)`                                                                             |
| `services[]`                                        | Each `service` must parse as `livediagram-<target>-staging` (`bad-service`); becomes `workerName(target, pr)` when `inTier(target, tier)`, else stays as is |
| `vars.DEPLOY_ENV` (router)                          | Required (`missing-var`); becomes `'preview'`                                                                                                               |
| `vars.AI_ALLOWED_ORIGINS` (api)                     | Required (`missing-var`); becomes `previewOrigin(pr)`                                                                                                       |
| `vars.APP_BASE_URL` (api)                           | Set to `previewOrigin(pr)` (the hosted profile leaves it unset on previews)                                                                                 |
| other `vars`                                        | Unchanged                                                                                                                                                   |
| `d1_databases` (api)                                | Exactly one, `binding = "DB"` (`bad-d1`); `database_name` → `d1Name(pr)`, `database_id` → `d1Id`; `migrations_dir` kept                                     |
| `r2_buckets` (api)                                  | Exactly one, `binding = "IMAGES"` (`bad-r2`); `bucket_name` → `r2Name(pr)`                                                                                  |
| `kv_namespaces`                                     | Rejected (`kv-in-preview`)                                                                                                                                  |
| `unsafe`, `durable_objects`, `migrations`, `assets` | Unchanged (rate-limiter namespaces are per script; DO namespaces are per script)                                                                            |
| `triggers`                                          | Replaced by `{ crons: [] }`                                                                                                                                 |
| `routes`                                            | Rejected if present (`has-routes`)                                                                                                                          |
| anything else                                       | Rejected (`unknown-key`)                                                                                                                                    |

3. Always, after the table: `P.triggers = { crons: [] }` when the source has top-level
   `triggers` (it is inherited otherwise); router gains
   `P.routes = [{ pattern: previewHost(pr), custom_domain: true }]`.

`KNOWN_ENV_KEYS` = `name`, `vars`, `services`, `d1_databases`, `r2_buckets`,
`kv_namespaces`, `unsafe`, `durable_objects`, `migrations`, `triggers`, `assets`,
`routes`. A new key in any staging block fails every preview deploy until this table
says what a preview does with it; that is the intent.

The CLI writes `smol-toml`'s `stringify(previewConfig(...))` to `PREVIEW_CONFIG_FILE` in
the app's directory, so relative paths resolve as they do for `wrangler.toml`, and
prints one `logLine('config', { app, pr, tier, workers: ... })`.

### Tier decision (`decideTier`)

| `@livediagram/api` affected | `full-preview` label | Tier      | `addLabel` | `reason` |
| --------------------------- | -------------------- | --------- | ---------- | -------- |
| yes                         | absent               | `full`    | true       | `graph`  |
| yes                         | present              | `full`    | false      | `graph`  |
| no                          | present              | `full`    | false      | `label`  |
| no                          | absent               | `preview` | false      | `none`   |

The CLI runs `turbo ls --filter=...[<base>...<head>] --output=json` (base and head are
the PR's SHAs from the event, never branch names), parses it with `parseTurboLs`, and
writes `tier`, `add_label` and `reason` to `$GITHUB_OUTPUT`.

### Workflow: `deploy-preview.yml`

Trigger: `pull_request` with `opened`, `synchronize`, `reopened`, `labeled`, `unlabeled`,
`closed`. Concurrency `preview-pr-${{ github.event.number }}`, `cancel-in-progress: true`.
Top-level `permissions: contents: read`.

Every job carries the gate:
`github.repository_id == '1253158818' && github.event.pull_request.head.repo.full_name == github.repository`.

| Job         | Runs when                                    | Needs    | Does                                                                                                                                                                                                                                                                                        |
| ----------- | -------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tier`      | action is not `closed`                       |          | Checkout head (`fetch-depth: 0`, `filter: blob:none`), install, `packages/preview-env/scripts/tier.ts`, add label if `add_label`; `permissions: contents: read, pull-requests: write`                                                                                                       |
| `deploy`    | action is not `closed`                       | `tier`   | `uses: ./.github/workflows/deploy-reusable.yml` with `wrangler_env: preview`, `preview_pr`, `preview_tier`, `environment_name: preview`, `environment_url: previewOrigin`, `mcp_origin: https://mcp-staging.livediagram.app`, `ref: head sha`; secrets `CF_API_TOKEN`, `CF_ACCOUNT_ID` only |
| `downgrade` | action is not `closed` and tier is `preview` | `deploy` | `packages/preview-env/scripts/teardown.ts --pr N --scope full` (a no-op when nothing full exists)                                                                                                                                                                                           |
| `teardown`  | action is `closed`                           |          | `packages/preview-env/scripts/teardown.ts --pr N --scope all`                                                                                                                                                                                                                               |

`labeled` / `unlabeled` events for any label other than `full-preview` skip `tier` and
everything after it (`github.event.label.name == 'full-preview'` or the action is not a
label event), so labelling a PR for anything else costs nothing.

### Workflow: `deploy-reusable.yml` changes

New inputs `preview_pr` (string, default `''`) and `preview_tier` (string, default `''`).
With both empty every command expands to exactly what it is today.

| Job                                                | Change                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| all deploy jobs                                    | When `preview_pr` is set, a step runs `packages/preview-env/scripts/config.ts --app <app> --pr N --tier T` and sets `WRANGLER_CONFIG=wrangler.preview.toml`; every `wrangler` call gains `${WRANGLER_CONFIG:+--config "$WRANGLER_CONFIG"}`                                                            |
| `build`                                            | `NEXT_PUBLIC_BUILD_ID` is empty when `preview_tier == 'preview'`; the hosted profile and its build check run with `--env preview`                                                                                                                                                                     |
| `deploy-api`                                       | `if: inputs.preview_tier != 'preview'`. Full tier adds, before config generation: `packages/preview-env/scripts/d1.ts --pr N` (output `d1_id`), `packages/preview-env/scripts/r2.ts --pr N` (creates `r2Name` unless it exists), and syncs a fresh `GUEST_ID_HMAC_SECRET` from `openssl rand -hex 32` |
| `deploy-api` verify step                           | "Verify hosted vars are live" skipped when `preview_pr` is set: the generated `APP_BASE_URL` is a var the profile leaves unset                                                                                                                                                                        |
| `deploy-mcp`                                       | `if: inputs.preview_pr == ''`                                                                                                                                                                                                                                                                         |
| `deploy-live`, `deploy-community`, `deploy-router` | `if: ${{ !failure() && !cancelled() }}`, because `deploy-api` may be skipped                                                                                                                                                                                                                          |

### Teardown (`teardownPlan`)

| Scope  | Steps, in order                                                                           |
| ------ | ----------------------------------------------------------------------------------------- |
| `all`  | worker router, community, marketing, live, telemetry, help, api; r2 `r2Name`; d1 `d1Name` |
| `full` | worker api; r2 `r2Name`; d1 `d1Name`                                                      |

`TEARDOWN_ORDER` deletes a worker before anything it binds: router first (it binds
every other worker and releases the hostname), community before api. The CLI runs
each step and continues past a step that `isNotFound`, so every teardown is
idempotent and a rerun finishes what a failed one started. Any other error stops the run
non-zero after logging the step.

Every deletion is a Cloudflare REST call (`packages/preview-env/scripts/cloudflare.ts`), not a wrangler
command, so not-found is a status code rather than parsed output: `isNotFound` is a 404,
or a not-found code (`NOT_FOUND_CODES`: 10007 script, 10006 bucket, 7404 database).
Worker: `DELETE /accounts/{a}/workers/scripts/{name}?force=true`. R2: list objects
(`GET .../r2/buckets/{name}/objects`), delete each, repeat until empty (at most
`MAX_EMPTY_PASSES` = 100 passes of 1000), then
`DELETE .../r2/buckets/{name}`. D1: find the id by name (`GET .../d1/database?name=`),
then `DELETE .../d1/database/{id}`.

### Sweep

`preview-sweep.yml` runs on `schedule: '0 4 * * *'` and `workflow_dispatch`, same gate on
the repository id. `packages/preview-env/scripts/sweep.ts` lists worker scripts, D1 databases and R2 buckets
through the REST API, lists open PRs with `gh pr list --state open --json number`, and
runs `teardownPlan(pr, 'all')` for each of `sweepTargets(names, openPrs)`.

## Data and persistence

- A Full preview's D1 starts empty and receives every migration in `apps/api/migrations/`
  through `wrangler d1 migrations apply DB --remote --config wrangler.preview.toml --env preview`.
  There is no snapshot, restore or copy from staging; teardown deletes it with its data.
- A Preview stores nothing of its own; its documents are staging's.
- `wrangler.preview.toml` is generated per run and never committed.

## Errors and edge cases

| Case                                               | Handling                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Fork PR                                            | Gate false; every job skipped                                                                    |
| Push lands while a deploy runs                     | Concurrency cancels the older run                                                                |
| PR closed while a deploy runs                      | Concurrency cancels the deploy; teardown runs; anything the cancelled run created after is swept |
| PR reopened                                        | Treated as a fresh deploy; `d1.ts` and R2 creation are idempotent                                |
| Label removed from a PR that still touches the api | Tier stays `full`, label re-added                                                                |
| Label added, PR touches nothing api                | Tier `full`, `reason: label`                                                                     |
| Migration fails on a Full preview                  | api job fails; router and frontends skip (`!failure()`); the PR shows a failed deployment        |
| Account worker or D1 limit reached                 | Cloudflare's error fails the step; no retry                                                      |
| Teardown hits a missing resource                   | `isNotFound` → logged as `gone`, next step                                                       |
| `turbo ls` fails or prints something unexpected    | `bad-turbo`; the tier job fails and nothing deploys, rather than guessing a tier                 |
| Staging block gains a key                          | `unknown-key` fails the preview until `config.ts` handles it                                     |

## Security and trust

- No `pull_request_target`. Same-repo gate plus hosted repository id on every job.
- Secrets reaching a preview run: `CF_API_TOKEN`, `CF_ACCOUNT_ID`. None of the Clerk,
  Google, internal-events or `_STAGING` secrets are passed.
- `GUEST_ID_HMAC_SECRET` on a Full preview's api is generated in the job and never
  stored anywhere but the worker.
- Every resource name is built from `parsePrNumber(github.event.number)`, never from a
  branch name or PR title, so no user-controlled string reaches a wrangler argument.
- The sweep deletes only names `ownerOf` matches; production and staging names cannot
  match.

## Performance and limits

- `previewConfig` is linear in the config's size (tens of keys); `decideTier` is a set
  lookup. Neither is on a product path.
- The tier job measured `turbo ls` at 0.3 s locally; its cost is dominated by
  `pnpm install`. The deploy is the staging deploy (6 to 8 minutes measured).
- R2 emptying is linear in the bucket's objects; the hosted image caps bound them per
  owner.
- Router runtime: one `Set.has` per request.

## Observability

Every CLI line is `logLine(event, fields)`: `[preview] <event> k=v k=v`, one per decision
or deletion, so a run log greps by `[preview]`.

| Event      | Fields                                    |
| ---------- | ----------------------------------------- |
| `tier`     | `pr`, `tier`, `reason`, `add_label`       |
| `config`   | `app`, `pr`, `tier`, `services`           |
| `d1`       | `pr`, `name`, `created` or `existing`     |
| `teardown` | `pr`, `kind`, `name`, `deleted` or `gone` |
| `sweep`    | `targets`, `open`                         |

The tier job also writes the tier and the reason to the run's step summary.

## Testing

| Spec rule                                                    | Test                                                                                                                                                                                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Names derive from the PR number only                         | `names.test.ts`: each function; `parsePrNumber` rejects 0, -1, 1.5, `'12a'`, `MAX_PR_NUMBER + 1`                                                                                                                                      |
| Sweeper never touches production or staging                  | `names.test.ts`: `ownerOf` on every production and staging worker, D1, R2 name is `null`                                                                                                                                              |
| Config generated from `[env.staging]`, every app, both tiers | `config.test.ts`: reads each real `apps/*/wrangler.toml`, asserts names, services, routes, triggers                                                                                                                                   |
| A Preview binds staging's api                                | `config.test.ts`: router and community services keep `livediagram-api-staging` on `preview`                                                                                                                                           |
| A Full preview never points at staging                       | `config.test.ts`: no string ending `-staging` anywhere in api, router or community on `full`                                                                                                                                          |
| No crons on a preview api                                    | `config.test.ts`: `env.preview.triggers.crons` is `[]`                                                                                                                                                                                |
| Unknown bindings fail                                        | `config.test.ts`: one case per `PreviewError` code                                                                                                                                                                                    |
| Tier from graph or label                                     | `tier.test.ts`: the four rows of the decision table; `parseTurboLs` on real and malformed output                                                                                                                                      |
| Teardown order and idempotence                               | `teardown.test.ts`: both plans; `isNotFound` on 404s, each not-found code, and other errors                                                                                                                                           |
| Sweep targets closed PRs only                                | `sweep.test.ts`: open, closed, mixed, non-preview names                                                                                                                                                                               |
| noindex on previews                                          | `apps/router` test: `preview` stamps the header; 101 untouched                                                                                                                                                                        |
| Hosted profile has a preview entry                           | `apps/api` hosted-vars test: `preview` resolves, all per-env values unset                                                                                                                                                             |
| Generated configs stay deployable                            | `staging:check` (this package's, run by CI's existing staging config step): `wrangler deploy --dry-run` on the generated api and router configs, both tiers (the sites need a build to dry-run; `config.test.ts` pins their bindings) |
| Production and staging unchanged                             | Verify step: the reusable workflow's expanded commands diffed with empty preview inputs                                                                                                                                               |

`src/` coverage threshold 100%, as `@livediagram/licences`; `scripts/` is IO, proven by
`staging:check` and the Verify phase.

## Constants and configuration

| Constant             | Value                | Provenance                                                | Safe range                   |
| -------------------- | -------------------- | --------------------------------------------------------- | ---------------------------- |
| `PREVIEW_ENV`        | `'preview'`          | Spec, "Naming"                                            | Any name not `staging`       |
| `FULL_PREVIEW_LABEL` | `'full-preview'`     | Spec, "Two tiers"                                         | Must exist as a repo label   |
| `PREVIEW_ZONE`       | `'livediagram.app'`  | Spec, "Naming"                                            | The zone holding the cert    |
| `MAX_PR_NUMBER`      | `999_999`            | Keeps every name well under wrangler's 63-character limit | `<= 10^9`                    |
| `API_PACKAGE`        | `'@livediagram/api'` | `apps/api/package.json`                                   | Must match the package name  |
| Sweep schedule       | `0 4 * * *`          | D12                                                       | Daily, away from `0 3 * * *` |
| Repository id        | `1253158818`         | `deploy-reusable.yml` `HOSTED`                            | The hosted repository only   |

## Defaults ledger

D7 to D13 in [DEFAULTS.md](DEFAULTS.md).
