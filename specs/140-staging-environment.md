# Staging environment

A second, complete copy of the platform at **https://staging.livediagram.app**, deployed
**automatically on every merge to `main`** once CI is green. Production stays exactly
as it is: manual, `workflow_dispatch`-only ([spec/10](10-deployment.md)).

The point is to have somewhere a change is _running_ before anyone decides to ship it —
in particular somewhere a **D1 migration runs against a real remote database** before it
runs against the one holding people's diagrams.

## The two environments

|              | Production                           | Staging                                    |
| ------------ | ------------------------------------ | ------------------------------------------ |
| Hostname     | `livediagram.app`                    | `staging.livediagram.app`                  |
| MCP host     | `mcp.livediagram.app`                | `mcp-staging.livediagram.app`              |
| Trigger      | Manual (`workflow_dispatch`)         | Automatic, on every green CI run on `main` |
| Workflow     | `deploy.yml` (**Deploy Production**) | `deploy-staging.yml` (**Deploy Staging**)  |
| Worker names | `livediagram-<app>`                  | `livediagram-<app>-staging`                |
| D1           | `livediagram`                        | `livediagram-staging`                      |
| R2           | `livediagram-images`                 | `livediagram-images-staging`               |
| Indexable    | Yes                                  | **No** — `X-Robots-Tag: noindex, nofollow` |

### "live" is an app, not an environment

Worth stating once, because the two readings collide constantly in this repo: **`live`
is the name of the editor app** — `apps/live`, the `livediagram-live` worker, the
`LIVE` service binding, the `deploy-live` job. It is a proper noun. The environments
are **production** and **staging**, and nothing else.

So `deploy-live` deploys the editor, in whichever environment the run targets; there is
no "live environment". Phrases like "goes live" are avoided in the deploy workflow for
exactly this reason — in a file that also contains `deploy-live`, the same word would
be doing two jobs.

Both run in the **same Cloudflare account**, under the same `CF_API_TOKEN` /
`CF_ACCOUNT_ID`. Two accounts would isolate harder, but every binding, secret and
dashboard step would then need doing twice by hand, and the thing most likely to break
staging is drift between the two — so the isolation is drawn at the **resource**, not
the account.

## Wrangler environments, not a second config file

Each app's `wrangler.toml` grows an `[env.staging]` block naming its worker
explicitly — `name = "livediagram-api-staging"` and so on. Wrangler would append the
suffix on its own, but nothing in `wrangler deploy --dry-run` prints the name it
resolved, and the router's five service bindings depend on those strings being exactly
right. A name you can read beats a name you have to infer.

The catch that shapes every block below: **wrangler does not inherit bindings into a
named environment.** `vars`, `d1_databases`, `r2_buckets`, `kv_namespaces`,
`durable_objects`, `migrations`, `services` and `unsafe` are all _non-inheritable_ —
absent from `[env.staging]` means **absent from the deployed staging worker**, silently.
So every staging block restates its app's bindings in full, even where the value is
identical to production's. Only `main`, `compatibility_date`, `compatibility_flags`,
`rules`, `assets` and `triggers` carry over.

This is why the staging blocks read as duplication and must stay that way: they are not
a copy of the production config, they are the whole config for a different worker that
happens to agree with production on most values. `apps/router/src/index.test.ts` and
`wrangler deploy --dry-run --env staging` (run in CI, see below) are what stop the two
drifting apart unnoticed.

### Service bindings point at staging

The router binds five workers and mcp binds one. In `[env.staging]` every `service =`
value gains the `-staging` suffix, so the staging router forwards to the staging api and
never to production's. A missed suffix here is the single worst failure mode available —
staging frontend, production database — so `apps/router/wrangler.toml` keeps its staging
bindings adjacent to the production ones for eyeball comparison, and the dry-run in CI
prints the resolved binding table.

## Data isolation

Staging gets its own **D1 database**, **R2 bucket** and **KV namespace**. Durable Objects
come free: a different script is a different DO namespace, so the staging
`DIAGRAM_ROOM` is already separate.

Rate-limiter namespace ids are deliberately **left identical** to production's. They are
scoped per script by Cloudflare, so the staging worker's `1001` is not production's
`1001`, and renumbering them would only invite the reader to think the number means
something.

Consequence worth stating plainly: **staging has no production data.** It starts empty
and stays a scratch environment. It is for exercising code paths and migrations, not for
reproducing a specific user's diagram.

## Migrations run on staging first

`deploy-staging.yml` applies `wrangler d1 migrations apply DB --remote --env staging`
before the staging api worker deploys, exactly as production does. That makes every
merge to `main` a rehearsal of the production migration step against a real remote D1,
one manual deploy earlier than the rehearsal used to happen, which was never.

A migration that fails halts the staging deploy and turns the `main` build red — which
is the whole point, and the reason the staging deploy is chained to CI rather than fired
in parallel with it.

## noindex, at the edge

Staging is public: no auth wall, no Cloudflare Access policy. Anyone with the link can
open it, which is what makes it usable for sharing a change with someone before it
ships.

Being public, it must not compete with production in search results. The router worker
sets **`X-Robots-Tag: noindex, nofollow` on every response** when its `DEPLOY_ENV` var
is `staging` — one line at the only point every app on the host passes through, rather
than a build flag threaded into four static apps.

Two deliberate non-changes:

- **`robots.txt` is not environment-aware.** Both the marketing and help apps keep
  emitting production's `robots.txt`, sitemaps and canonical URLs. `robots.txt` governs
  _crawling_, not _indexing_; `X-Robots-Tag` governs indexing and is the header a
  crawler must obey whatever `robots.txt` said. Canonical tags pointing at
  `livediagram.app` are, for a staging mirror, the correct answer rather than a bug:
  they name production as the real home of the page.
- **The 101 WebSocket upgrade is passed through untouched.** A `Response` carrying a
  `webSocket` cannot be reconstructed to add a header — doing so kills realtime collab
  on staging, and does so only for that one path, which is exactly the kind of bug that
  survives a smoke test. The header wrapper skips status 101.

## Build-time configuration

`NEXT_PUBLIC_*` values are baked into the static export by `next build`, so **staging is
its own build** — the two workflows never share an artifact. Staging's build differs
from production's in exactly two values:

| Variable                            | Production                                | Staging                               |
| ----------------------------------- | ----------------------------------------- | ------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_*` (production tenant)           | `pk_test_*` (test tenant)             |
| `NEXT_PUBLIC_MCP_ORIGIN`            | unset (defaults to `mcp.livediagram.app`) | `https://mcp-staging.livediagram.app` |

Everything else matches, on purpose: `NEXT_PUBLIC_API_BASE` stays unset so staging
resolves `/api` same-origin through its own router, and
`NEXT_PUBLIC_TELEMETRY_ENABLED` / `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED` are `true` in both
so the staging build exercises the same code as production's.

## Integrations

Each is wired to its own tenant or its own data — but **only two are switched on**.
The other two are configured and dormant, waiting on a key that is deliberately not
set. `GET /api/capabilities` is the authoritative answer at any moment; as of the
first deploy it returns `{"aiEnabled":false,"emailEnabled":false}` on staging against
`{"aiEnabled":true,"emailEnabled":true}` on production.

| Integration        | Staging setup                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Clerk** — ON     | A separate **development tenant** (`ethical-crane-19.clerk.accounts.dev`), `pk_test_*` key, its own JWKS URL. Staging sign-in cannot touch a production user. Needs **no origin configuration**: Clerk dev instances reflect any `Origin` back, which is why localhost works unconfigured. Isolation here comes from being a separate tenant, not from an allow-list. Pointing staging at a Clerk _production_ instance would change that — those do lock origins down, and `staging.livediagram.app` would need adding under Domains. |
| **Telemetry** — ON | Events land in staging's own D1, so the **public** `/telemetry` dashboard on production is unaffected; staging's dashboard shows staging's own traffic, which is how you verify a new event actually lands.                                                                                                                                                                                                                                                                                                                            |
| **Resend** — OFF   | Wired but keyless. `APP_BASE_URL` and `RESEND_FROM` are set, so setting `RESEND_API_KEY --env staging` turns it on and every link points back at staging. Left unset on purpose: staging runs the same daily lifecycle cron as production, from the same verified domain, so switching it on mails **real people** (see the warning below). Turn it on for a specific test, then take the key off again.                                                                                                                               |
| **OpenAI** — OFF   | Wired but keyless, same shape. `AI_ALLOWED_ORIGINS` already restricts the endpoint to the staging origin, so `wrangler secret put OPENAI_API_KEY --env staging` is all that is needed. Left unset because it spends real money per request and nothing about the AI path needs rehearsing continuously.                                                                                                                                                                                                                                |

> **Email warning.** Staging runs the same daily lifecycle-email cron as production
> (welcome / week-1 / week-2, token-expiry warnings). With `RESEND_API_KEY` set, any
> address that signs into staging receives them, from the same verified domain as
> production's — so a staging account made with a colleague's address mails that
> colleague. That is why the key is unset by default: absent, the email feature is inert
> and the `email_lifecycle` table is never touched ([spec/64](64-transactional-email.md)).
> Set it for a specific test, use addresses you own, and remove it afterwards.

## Secrets

Production's secrets are untouched. Staging adds a `_STAGING`-suffixed twin for each
value the deploy workflow syncs, plus the Clerk publishable key:

| GitHub secret                               | Synced to                       | Notes                                                                            |
| ------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_STAGING` | build step                      | `pk_test_*` from the Clerk test tenant.                                          |
| `CLERK_JWKS_URL_STAGING`                    | staging api                     | Test tenant's JWKS URL.                                                          |
| `GUEST_ID_HMAC_SECRET_STAGING`              | staging api                     | Own value — `openssl rand -hex 32`. Never production's.                          |
| `INTERNAL_EVENTS_KEY_STAGING`               | staging api **and** staging mcp | Same value on both or telemetry silently throttles ([spec/22](22-telemetry.md)). |

`CF_API_TOKEN` and `CF_ACCOUNT_ID` are shared — same account.

`RESEND_API_KEY` and `OPENAI_API_KEY` are **not** in the workflow for either
environment; they are provisioned once by hand with `wrangler secret put ... --env
staging`, exactly as production provisions them. Keeping the workflow's secret list
identical across the two environments is deliberate: a secret that exists in one
workflow and not the other is how the environments start to differ.

## One workflow body, two callers

`.github/workflows/deploy-reusable.yml` holds the entire deploy — build, the five parallel
app deploys, mcp, router — as a `workflow_call` reusable workflow taking the target
environment as inputs. `deploy.yml` (manual, production) and `deploy-staging.yml`
(automatic, staging) are thin callers.

This is the reuse rule applied to CI: the alternative was a second ~450-line file that
would be a faithful copy of production's deploy for about a week. A staging environment
whose deploy has drifted from production's tests nothing.

`deploy-staging.yml` triggers on `workflow_run` — CI completing successfully on `main` —
not on `push`. Deploying a red `main` to staging would mean the environment's state no
longer tells you anything. `concurrency: cancel-in-progress: true` means a rapid series
of merges deploys the last one rather than queueing all of them; production keeps
`cancel-in-progress: false`, because cancelling a half-finished production deploy is
worse than queueing.

## One-time setup

Deploys fail loudly until these exist. Resource ids are committed to `wrangler.toml`
(they are identifiers, not secrets — [spec/06](06-secrets-policy.md)).

**Done** — the three data stores exist, and their ids are committed:

| Resource | Name                         | Where the id lives       |
| -------- | ---------------------------- | ------------------------ |
| D1       | `livediagram-staging`        | `apps/api/wrangler.toml` |
| R2       | `livediagram-images-staging` | bound by name, no id     |
| KV       | `mcp-oauth-kv-staging`       | `apps/mcp/wrangler.toml` |

Both were created in `ENAM`, Cloudflare's default for the account rather than a
deliberate choice; production's region was not readable from the API to mirror. If
staging ever needs to reproduce production's read latency, that is the knob.

Note the KV **title** is `mcp-oauth-kv-staging`, matching production's `mcp-oauth-kv`.
It is not `OAUTH_KV` — that is the binding name inside `wrangler.toml`, a different
thing, and `wrangler kv namespace create OAUTH_KV --env staging` would have produced
`livediagram-mcp-staging-OAUTH_KV` instead.

The **workers** are not on this list: a worker is its uploaded script, so all seven
`livediagram-*-staging` workers come into existence on the first staging deploy. The
job graph bootstraps them in the right order — the five path-routed workers first,
then mcp (service binding to api), then router (service bindings to the five) — exactly
as production's first deploy did ([spec/10](10-deployment.md) "First deploy").

Still outstanding:

```bash
# 1. Worker secrets not carried by the workflow
cd apps/api && wrangler secret put RESEND_API_KEY --env staging
cd apps/api && wrangler secret put OPENAI_API_KEY --env staging

# 2. GitHub secrets — Settings → Secrets and variables → Actions
#    the four _STAGING entries in the table above
```

**Done** — both custom domains are attached in the Cloudflare dashboard (the deploy
token is scoped to upload worker scripts, not to manage DNS, so this step can never be
automated from the workflow — same as production, [spec/10](10-deployment.md)):

- `staging.livediagram.app` → `livediagram-router-staging`
- `mcp-staging.livediagram.app` → `livediagram-mcp-staging`

Only those two workers get hostnames. The other five are reached exclusively over the
router's service bindings and never touch DNS, exactly as in production.

**Clerk needs nothing**, contrary to what this spec first said. A development instance
is origin-permissive, so there is no allow-list to add the staging host to. That only
becomes a step if staging is ever moved to a Clerk production instance.

## What staging is not

- **Not a preview-per-PR environment.** One long-lived environment tracking `main`.
  Per-PR previews would need a worker per PR, a database per PR and a wildcard hostname;
  if that's wanted later it's a different spec, not a knob on this one.
- **Not a production mirror.** No production data is copied in, ever. A staging bug must
  never be debuggable by reading a real user's diagram.
- **Not a rollback target.** Rolling production back is still a production deploy of an
  older `main`.

## Known sharp edge, inherited

`wrangler deploy` replaces a worker's plain `[vars]` with whatever the config file
declares, so any var set **only** in the Cloudflare dashboard is wiped on the next
deploy unless `keep_vars = true`. This already applies to production
(`IMAGE_MAX_PER_OWNER`, `AI_REQUIRE_CLERK`, and friends are documented as
dashboard-settable but are not in `wrangler.toml`). Staging declares the ones it needs
**in `[env.staging.vars]`** so the environment is reproducible from the repo alone.

**This prediction came true, and it cost a security control.** `AI_ALLOWED_ORIGINS` was
documented as production-set but was measurably unset when probed — `POST /api/ai` with no
`Origin` answered `400 invalid mode` rather than `403 origin_not_allowed` — so the endpoint,
which fronts a live OpenAI key, accepted requests from any origin. Whether it was never set
or set once and wiped by a deploy is now unknowable, which is the point: a dashboard var
leaves no trace either way, and no amount of reading the repo would have revealed it.
`AI_ALLOWED_ORIGINS` is therefore now declared in production's `[vars]` too. The remaining
dashboard-only vars (`IMAGE_MAX_PER_OWNER`, `IMAGE_MAX_BYTES_PER_OWNER`, `AI_REQUIRE_CLERK`)
should be assumed absent until probed, not trusted because a comment says the hosted
deployment sets them.

The general lesson, worth more than the specific fix: **an optional guard that fails open is
untestable from the source tree.** Every file can read as though a protection is active while
production runs without it. Where a guard is config-gated, the audit step is a probe against
the deployment, not a code review.
