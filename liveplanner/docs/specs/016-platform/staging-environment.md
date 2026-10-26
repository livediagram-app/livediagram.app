# Staging environment

A second, complete copy of liveplanner at **https://staging.liveplanner.app**, deployed **automatically** when CI
passes for a push to `main`. Production stays a manual gate ([Deployment](deployment.md)).

The point is to have somewhere a change is _running_ before anyone decides to ship it, in particular somewhere a new
plan schema step runs in real remote Durable Objects before it runs in the ones holding people's plans.

## The two environments

|              | Production                                            | Staging                                               |
| ------------ | ----------------------------------------------------- | ----------------------------------------------------- |
| Hostname     | `liveplanner.app`                                     | `staging.liveplanner.app`                             |
| MCP host     | `mcp.liveplanner.app`                                 | `mcp-staging.liveplanner.app`                         |
| Trigger      | Manual (`workflow_dispatch`)                          | Automatic, after CI passes for a push to `main`       |
| Workflow     | `deploy-production.yml` (**Deploy Production**)       | `deploy-staging.yml` (**Deploy Staging**)             |
| Ships        | What staging runs (the `deployed/staging` tag)        | `main`'s tip                                          |
| Worker names | `liveplanner-<app>`                                   | `liveplanner-<app>-staging`                           |
| Indexable    | Yes                                                   | **No**: `X-Robots-Tag: noindex, nofollow`             |
| Platform     | liveworkspace.app (index, accounts, media, telemetry) | staging.liveworkspace.app, the platform's own staging |

Both run in the **same Cloudflare account** (the liveworkspace account every `wrangler.toml` pins), under the one
`CLOUDFLARE_API_TOKEN`. The isolation is drawn at the **resource**, not the account: two accounts would double every
binding, secret and dashboard step, and drift between the two is what most often breaks a staging environment.

## Wrangler environments, not a second config file

Each app's `wrangler.toml` has an `[env.staging]` block naming its worker explicitly
(`name = "liveplanner-api-staging"` and so on). Wrangler would append the suffix on its own, but nothing in
`wrangler deploy --dry-run` prints the name it resolved, and the router's four service bindings depend on those
strings being exactly right.

The catch that shapes every block: **wrangler does not inherit bindings into a named environment.** `vars`,
`durable_objects`, `migrations`, `kv_namespaces`, `services`, `send_email` and `unsafe` are all _non-inheritable_:
absent from `[env.staging]` means **absent from the deployed staging worker**, silently. So every staging block
restates its app's bindings in full, even where the value is identical to production's. Only `main`,
`compatibility_date`, `compatibility_flags`, `rules`, `assets` and `triggers` carry over.

`apps/router/src/index.test.ts` and `staging:check` (`wrangler deploy --dry-run --env staging` for api, mcp and
router, run in CI's Build job) stop the two drifting apart unnoticed.

### Service bindings point at staging

The router binds four workers (`MARKETING`, `EDITOR`, `API`, `HELP`) and mcp binds one (`API`). In `[env.staging]`
every `service =` value carries the `-staging` suffix, so the staging router forwards to the staging api and never
to production's. A missed suffix is the worst failure available (staging frontend, production data), so
`apps/router/wrangler.toml` keeps its staging bindings beside the production ones, and the dry run prints the
resolved binding table.

## Data isolation

- **Durable Objects** come free: a different script is a different namespace, so the staging `PLAN_ROOM` (and every
  plan's content in it) is separate.
- **KV**: the mcp worker's `OAUTH_KV` has its own staging namespace (`mcp-oauth-kv-staging`).
- **The platform**: the staging api talks to staging liveworkspace (`INDEX_ORIGIN`, `MEDIA_URL`, the accounts
  Worker and telemetry), so its plans are indexed, previewed and signed into there.
- **Rate limiters** keep production's namespace ids on purpose. They are scoped per script by Cloudflare, so the
  staging worker's `1001` is not production's `1001`.

**Staging has no production data.** It starts empty and stays a scratch environment, for exercising code paths and
schema steps, not for reproducing a specific person's plan.

## Schema steps run on staging first

There is no migration step in the deploy: each plan's object brings its own SQLite schema up to date on first use
(`plan-schema.ts`). Staging is where a new step first runs against real remote objects, one deploy before
production, so a step that fails shows on staging plans first. The staging deploy follows a passing CI run rather
than running beside it, so a red `main` never reaches it.

## noindex, at the edge

Staging is public: no auth wall, no Cloudflare Access policy, so a change can be shared with someone before it ships.
Being public, it must not compete with production in search results. The router sets
**`X-Robots-Tag: noindex, nofollow` on every response** when its `DEPLOY_ENV` var is `staging`: one line at the only
point every app on the host passes through.

- **`robots.txt` is not environment-aware.** The marketing and help apps emit production's `robots.txt`, sitemaps and
  canonical URLs on staging too. `robots.txt` governs crawling, not indexing; `X-Robots-Tag` governs indexing.
  Canonical tags naming `liveplanner.app` are right for a mirror: they name production as the page's real home.
- **The 101 WebSocket upgrade is passed through untouched.** A `Response` carrying a `webSocket` cannot be rebuilt to
  add a header, and doing so would break realtime on staging on that one path. The wrapper skips status 101.

## Build-time configuration

`NEXT_PUBLIC_*` values are baked into the static export by `next build`, so **staging is its own build**. Staging's
sites differ from production's in their build id, their hosted build vars (the staging entries of the hosted
profile, [Deployment](deployment.md#hosted-profile)) and one more value:

| Variable                 | Production                                        | Staging                                        |
| ------------------------ | ------------------------------------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_MCP_ORIGIN` | unset (blank falls back to `mcp.liveplanner.app`) | the staging mcp worker's `workers.dev` address |

`NEXT_PUBLIC_API_BASE` stays unset in both, so staging resolves `/api` same-origin through its own router, and
`NEXT_PUBLIC_TELEMETRY_ENABLED` is `true` in both, so the staging build runs the same code as production's.

## Integrations

Each is wired to its own tenant or its own data, and all three are on. `GET /api/capabilities` is the authoritative
answer at any moment.

| Integration   | Staging setup                                                                                                                                                                                                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sign-in**   | Staging is its **own OAuth client** of staging liveworkspace's accounts Worker, with its **own resource** (the access-token audience), so a staging session cannot reach production data. The client's redirect URI is `https://staging.liveplanner.app/api/auth/callback` ([Auth and guest access](../014-identity/auth-and-guest-access.md)). |
| **Telemetry** | Events go to liveworkspace's staging telemetry service (`TELEMETRY_URL` in the hosted profile), so production's public dashboard is unaffected; staging's shows staging's own traffic, which is how a new event is checked to land ([liveworkspace/docs/telemetry.md](../../../../liveworkspace/docs/telemetry.md)).                            |
| **Email**     | Cloudflare Email Service through staging's own `[[env.staging.send_email]]` `EMAIL` binding, with `EMAIL_FROM` in `[env.staging.vars]` and `APP_BASE_URL` from the hosted profile, so every link points back at staging. No key: the binding is the credential ([liveworkspace/docs/email.md](../../../../liveworkspace/docs/email.md)).        |

> **Email warning.** Staging sends the same notification emails as production (new comments, form responses), from
> the same onboarded domain, to any address that signs into staging. A staging account made with a colleague's
> address mails that colleague, so use addresses you own. Without the `[[env.staging.send_email]]` block the email
> feature is inert ([Transactional email](../014-identity/transactional-email.md)).

## Secrets

Worker secrets are per environment: each staging worker's are set on it with `wrangler secret put --env staging`
and survive every deploy, as production's do. Staging holds its own value for each, never production's: its accounts
client id and secret, its resource, its `INDEX_KEY` and `MEDIA_KEY` at the staging platform, and a `TELEMETRY_KEY`
shared by the staging api and staging mcp ([Secrets policy](../002-project-scope/secrets-policy.md)).

## One workflow body, two callers

`deploy.yml` holds the whole deploy as a reusable workflow taking the environment as an input;
`deploy-production.yml` and `deploy-staging.yml` call it. A staging deploy that has drifted from production's tests
nothing, so the two run byte-identical steps.

`deploy-staging.yml` triggers on `workflow_run` (CI completing on `main`), not on `push`. Every commit on `main`
runs CI to the end ([Deployment](deployment.md#runs-on-main-are-never-cancelled)), so runs can finish out of order: a
first job (**Still main's tip**) lets a run deploy only when its commit is still `main`'s tip, and the newer
commit's run deploys both, since the plan diffs against what staging last deployed. Both callers queue
(`cancel-in-progress: false`), so a deploy is never cut off halfway.

## Hostnames

Both are declared in the workers' `[env.staging]` blocks and attached by the deploy itself, as production's are
([Deployment](deployment.md#custom-domain)):

- `staging.liveplanner.app` → `liveplanner-router-staging`
- `mcp-staging.liveplanner.app` → `liveplanner-mcp-staging`

The other staging workers are reached only over the router's service bindings and never touch DNS.

## What staging is not

- **Not a preview-per-PR environment.** One long-lived environment tracking `main`.
- **Not a production mirror.** No production data is copied in, ever.
- **Not a rollback target.** Rolling production back is a production deploy of an older `ref`.

## Plain vars are never dashboard-only

`wrangler deploy` replaces a worker's plain `[vars]` with whatever the deploy declares, so a var set **only** in
the Cloudflare dashboard is wiped on the next deploy. So nothing is set only in the dashboard: a var is either
committed (`[vars]` / `[env.staging.vars]`, every environment's default too) or part of the hosted profile, which the
deploy sends with `--var` on every run and then reads back off the live api ([Deployment](deployment.md#hosted-profile)).
Either way the environment is reproducible from the repo alone.
