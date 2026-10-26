# Staging environment

A second, complete copy of livedocuments at **https://staging.livedocuments.app**, deployed **automatically** once CI
is green for a push to `main`. Production is deployed by hand ([Deployment](deployment.md)).

The point is to have somewhere a change is _running_ before anyone decides to ship it: somewhere it runs against
**real remote Workers, Durable Objects and liveworkspace's staging services** before it runs against the ones holding
people's documents.

## The two environments

|              | Production                                      | Staging                                    |
| ------------ | ----------------------------------------------- | ------------------------------------------ |
| Hostname     | `livedocuments.app`                             | `staging.livedocuments.app`                |
| MCP host     | `mcp.livedocuments.app`                         | `mcp-staging.livedocuments.app`            |
| Trigger      | By hand                                         | Automatic, on every green CI run on `main` |
| Workflow     | `deploy-production.yml` (**Deploy Production**) | `deploy-staging.yml` (**Deploy Staging**)  |
| Worker names | `livedocuments-<app>`                           | `livedocuments-<app>-staging`              |
| Index        | `liveworkspace.app`                             | `staging.liveworkspace.app`                |
| Previews     | `liveworkspace.app`                             | `staging.liveworkspace.app`                |
| Indexable    | Yes                                             | **No**: `X-Robots-Tag: noindex, nofollow`  |

### "editor" is an app, not an environment

**`editor` is the name of an app**: `apps/editor`, the `livedocuments-editor` worker, the `EDITOR` service binding. The
environments are **production** and **staging**, and nothing else. Phrases like "goes live" are avoided in deploy
copy, where the same word would be doing two jobs.

Both run in the **same Cloudflare account**, the liveworkspace account, under the same `CLOUDFLARE_API_TOKEN`. The
isolation is drawn at the **resource**, not the account: two accounts would need every binding, secret and dashboard
step done twice by hand, and drift between the two is what most often breaks a staging environment.

## Wrangler environments, not a second config file

Each app's `wrangler.toml` has an `[env.staging]` block naming its worker explicitly
(`name = "livedocuments-api-staging"` and so on). Wrangler would append the suffix on its own, but nothing in
`wrangler deploy --dry-run` prints the name it resolved, and the router's service bindings depend on those strings
being exactly right.

The catch that shapes every block: **wrangler does not inherit bindings into a named environment.** `vars`,
`durable_objects`, `migrations`, `services`, `kv_namespaces`, `send_email` and `unsafe` are all _non-inheritable_:
absent from `[env.staging]` means **absent from the deployed staging worker**, silently. So every staging block
restates its app's bindings in full, even where the value matches production's. Only `main`, `compatibility_date`,
`compatibility_flags`, `rules`, `assets` and `triggers` carry over. `apps/router/src/index.test.ts` and
`staging:check` (`wrangler deploy --dry-run --env staging`, in CI) stop the two drifting apart unnoticed.

### Service bindings point at staging

The router binds four workers (marketing, editor, api, help) and mcp binds one (api). In `[env.staging]` every
`service =` value carries the `-staging` suffix, so the staging router forwards to the staging api and never to
production's. A missed suffix is the worst failure mode available (staging frontend, production data), so
`apps/router/wrangler.toml` keeps its staging bindings beside the production ones for comparison.

## Data isolation

Staging has its own **KV namespace** (the MCP server's OAuth store), and talks to liveworkspace's staging index
(`INDEX_ORIGIN`), accounts Worker and media service (`MEDIA_URL`, which serves staging's previews). The api has no
database. Durable Objects come free: a different script is a different Durable Object namespace, so the staging
`DOCUMENT_ROOM` (every document's content) is already separate.

Rate-limiter namespace ids are **identical** to production's. Cloudflare scopes them per script, so the staging
worker's `1001` is not production's `1001`.

**Staging has no production data.** It starts empty and stays a scratch environment, for exercising code paths, not
for reproducing a specific person's document.

## Every change runs on staging first

The api has no SQL migration step: each Durable Object makes its own schema on first use, so a schema change ships in
the worker's code. Every push to `main` deploys that code to staging one manual deploy before production.

A deploy that fails stops the staging run, and the Worker is retried on the next deploy (the `deployed/staging` tag
moves only when every Worker succeeded, [Deployment](deployment.md) "Deploy").

## noindex, at the edge

Staging is public: no auth wall, no Cloudflare Access policy, so a change can be shared before it ships. Being public,
it must not compete with production in search results. The router sets **`X-Robots-Tag: noindex, nofollow` on every
response** when its `DEPLOY_ENV` var is `staging`: one line at the one point every site on the host passes through.

Two deliberate non-changes:

- **`robots.txt` is not environment-aware.** The marketing and help apps emit production's `robots.txt`, sitemaps
  and canonical URLs. `robots.txt` governs _crawling_, not _indexing_; `X-Robots-Tag` governs indexing whatever
  `robots.txt` said. Canonical tags naming `livedocuments.app` are the right answer for a staging mirror.
- **The 101 WebSocket upgrade passes untouched.** A `Response` carrying a `webSocket` cannot be rebuilt to add a
  header without killing realtime collaboration, so the header wrapper skips status 101.

## Build-time configuration

`NEXT_PUBLIC_*` values are baked into the static export by `next build`, so **staging is its own build**. It differs
from production's in one value:

| Variable                 | Production                                          | Staging                                     |
| ------------------------ | --------------------------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_MCP_ORIGIN` | empty (blank falls back to `mcp.livedocuments.app`) | the staging MCP worker's `workers.dev` host |

Everything else matches: `NEXT_PUBLIC_API_BASE` stays unset so staging resolves `/api` same-origin through its own
router, and `NEXT_PUBLIC_TELEMETRY_ENABLED` (from the hosted profile, [Deployment](deployment.md) "Hosted profile")
is `true` in both.

## Integrations

Each is wired to its own tenant or data, and all three are on. `GET /api/capabilities` is the authoritative answer at
any moment: `{"emailEnabled":true}` on both.

| Integration       | Staging setup                                                                                                                                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sign-in**: on   | Staging is its **own OAuth client** of liveworkspace's staging accounts Worker, with its **own resource** (`API_RESOURCE`), so its access tokens carry an audience production's api refuses. The client's redirect URI is `https://staging.livedocuments.app/api/auth/callback`. |
| **Telemetry**: on | Events land in liveworkspace's staging telemetry service (`TELEMETRY_URL` from the hosted profile), so production's dashboard is unaffected.                                                                                                                                     |
| **Email**: on     | The `[[env.staging.send_email]]` binding `EMAIL`, with `EMAIL_FROM` production's sender and `APP_BASE_URL` from the hosted profile, so every link points at staging. To switch it off, remove that block and redeploy.                                                           |

> **Email warning.** Staging sends the same notification and milestone emails as production, from the same domain.
> A staging account made with a colleague's address mails that colleague. Use addresses you own on staging
> ([Transactional email](../014-identity/transactional-email.md)).

## Secrets

Staging's workers carry their own values of each secret, set with `wrangler secret put --env staging`, never
production's: `ACCOUNTS_URL`, `API_RESOURCE`, `ACCOUNTS_CLIENT_ID`, `ACCOUNTS_CLIENT_SECRET` (staging's own OAuth
client), `INDEX_KEY` (staging liveworkspace's `INDEX_KEY_LIVEDOCUMENTS`), `TELEMETRY_KEY` (on api **and** mcp, the same
value, staging telemetry's `TELEMETRY_KEY_LIVEDOCUMENTS`) and `MEDIA_KEY` (staging media's `MEDIA_KEY_LIVEDOCUMENTS`;
unset, staging has no images). A deploy writes no secret, so they survive every deploy
([Secrets policy](../002-project-scope/secrets-policy.md)). Email needs no secret: the `EMAIL` binding is the credential.

## One workflow body, two callers

The monorepo's `deploy.yml` holds the whole deploy as a reusable workflow taking the environment as input;
`deploy-staging.yml` and `deploy-production.yml` are thin callers, so the two environments run identical steps. A
staging environment whose deploy has drifted from production's tests nothing.

`deploy-staging.yml` triggers on `workflow_run` (CI completing successfully for a push to `main`), not on `push`, so a
red `main` never reaches staging. Its first job, **Still main's tip**, lets a run deploy only when its commit is still
`main`'s tip; an older commit's run is skipped and the newer one deploys both. Runs queue rather than cancel
(`cancel-in-progress: false`), so a deploy is never cut off halfway, in either environment.

## One-time setup

Resource ids are committed to `wrangler.toml` (identifiers, not secrets,
[Secrets policy](../002-project-scope/secrets-policy.md)):

| Resource | Name                              | Where the id lives       |
| -------- | --------------------------------- | ------------------------ |
| KV       | `livedocuments-mcp-oauth-staging` | `apps/mcp/wrangler.toml` |

The KV **title** matches production's `livedocuments-mcp-oauth`: the product's name leads, because every
liveworkspace app's namespaces share one account. `OAUTH_KV` is the binding name inside `wrangler.toml`, a different
thing.

The **workers** need no setup: a worker is its uploaded script, so the six `livedocuments-*-staging` workers come into
existence on the first staging deploy, in tier order (api, then the sites and mcp, then the router).

**Hostnames** need none either: both are declared in the workers' `[env.staging]` blocks and attached by the deploy
([Deployment](deployment.md#custom-domain)):

- `staging.livedocuments.app` → `livedocuments-router-staging`
- `mcp-staging.livedocuments.app` → `livedocuments-mcp-staging`

The other four workers are reached only over service bindings.

**Sign-in needs one registration**: staging's OAuth client on liveworkspace's staging accounts Worker, with
`https://staging.livedocuments.app/api/auth/callback` as its redirect URI and its own resource.

## What staging is not

- **Not a preview-per-PR environment.** One long-lived environment tracking `main`. Per-PR previews would need a worker
  per PR, separate storage per PR and a wildcard hostname: a different spec.
- **Not a production mirror.** No production data is copied in, ever.
- **Not a rollback target.** Rolling production back is a production deploy of an older commit.

## Known sharp edge

`wrangler deploy` replaces a worker's plain `[vars]` with whatever the config declares, so a var set **only** in the
Cloudflare dashboard is wiped on the next deploy unless `keep_vars = true`. So nothing is set only in the dashboard: a
var is either committed (`[vars]` / `[env.staging.vars]`, every fork's default too) or part of the hosted profile,
which the deploy sends with `--var` on every run and then reads back off the api worker ([Deployment](deployment.md)
"Hosted profile"). Either way the environment is reproducible from the repo alone.

**An optional guard that fails open is untestable from the source tree.** Every file can read as though a protection
is active while production runs without it. Where a guard is config-gated, the audit is a probe against the
deployment, not a code review; for the hosted profile that probe is the deploy's verify step, on every deploy.
