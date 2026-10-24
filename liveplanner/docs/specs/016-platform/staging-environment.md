# Staging environment

A second, complete copy of the platform at **https://staging.liveplanner.app**, deployed
**automatically on every merge to `main`** once CI is green. Production stays exactly
as it is: manual, `workflow_dispatch`-only ([Deployment](deployment.md)).

The point is to have somewhere a change is _running_ before anyone decides to ship it —
in particular somewhere a new plan schema step runs in real remote Durable Objects before it
runs in the ones holding people's projects.

## The two environments

|              | Production                           | Staging                                    |
| ------------ | ------------------------------------ | ------------------------------------------ |
| Hostname     | `liveplanner.app`                    | `staging.liveplanner.app`                  |
| MCP host     | `mcp.liveplanner.app`                | `mcp-staging.liveplanner.app`              |
| Trigger      | Manual (`workflow_dispatch`)         | Automatic, on every green CI run on `main` |
| Workflow     | `deploy.yml` (**Deploy Production**) | `deploy-staging.yml` (**Deploy Staging**)  |
| Worker names | `liveplanner-<app>`                  | `liveplanner-<app>-staging`                |
| Indexable    | Yes                                  | **No** — `X-Robots-Tag: noindex, nofollow` |

### "live" is an app, not an environment

Worth stating once, because the two readings collide constantly in this repo: **`live`
is the name of the editor app** — `apps/editor`, the `liveplanner-editor` worker, the
`LIVE` service binding, the `deploy-editor` job. It is a proper noun. The environments
are **production** and **staging**, and nothing else.

So `deploy-editor` deploys the editor, in whichever environment the run targets; there is
no "live environment". Phrases like "goes live" are avoided in the deploy workflow for
exactly this reason — in a file that also contains `deploy-editor`, the same word would
be doing two jobs.

Both run in the **same Cloudflare account**, under the same `CF_API_TOKEN` /
`CF_ACCOUNT_ID`. Two accounts would isolate harder, but every binding, secret and
dashboard step would then need doing twice by hand, and the thing most likely to break
staging is drift between the two — so the isolation is drawn at the **resource**, not
the account.

## Wrangler environments, not a second config file

Each app's `wrangler.toml` grows an `[env.staging]` block naming its worker
explicitly — `name = "liveplanner-api-staging"` and so on. Wrangler would append the
suffix on its own, but nothing in `wrangler deploy --dry-run` prints the name it
resolved, and the router's six service bindings depend on those strings being exactly
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

The router binds six workers and mcp binds one. In `[env.staging]` every `service =`
value gains the `-staging` suffix, so the staging router forwards to the staging api and
never to production's. A missed suffix here is the single worst failure mode available —
staging frontend, production data — so `apps/router/wrangler.toml` keeps its staging
bindings adjacent to the production ones for eyeball comparison, and the dry-run in CI
prints the resolved binding table.

## Data isolation

Staging gets its own **KV namespace**, and talks to liveworkspace's staging index, accounts and media service (its
previews). The api has no D1. Durable Objects come free: a different script is a different DO namespace, so the staging
`PLAN_ROOM` (and every plan's content in it) is already separate.

Rate-limiter namespace ids are deliberately **left identical** to production's. They are
scoped per script by Cloudflare, so the staging worker's `1001` is not production's
`1001`, and renumbering them would only invite the reader to think the number means
something.

Consequence worth stating plainly: **staging has no production data.** It starts empty
and stays a scratch environment. It is for exercising code paths and schema steps, not for
reproducing a specific user's project.

## Schema steps run on staging first

There is no migration step in the deploy: each plan's object brings its own SQLite up to date on first use
(`plan-schema.ts`). Staging is where a new step first runs against real remote objects, one manual deploy before
production, so a step that fails shows on staging plans first.

The staging deploy is chained to a green CI run rather than fired in parallel with it, so a red `main` never reaches it.

## noindex, at the edge

Staging is public: no auth wall, no Cloudflare Access policy. Anyone with the link can
open it, which is what makes it usable for sharing a change with someone before it
ships.

Being public, it must not compete with production in search results. The router worker
sets **`X-Robots-Tag: noindex, nofollow` on every response** when its `DEPLOY_ENV` var
is `staging` — one line at the only point every app on the host passes through, rather
than a build flag threaded into five static apps.

Two deliberate non-changes:

- **`robots.txt` is not environment-aware.** Both the marketing and help apps keep
  emitting production's `robots.txt`, sitemaps and canonical URLs. `robots.txt` governs
  _crawling_, not _indexing_; `X-Robots-Tag` governs indexing and is the header a
  crawler must obey whatever `robots.txt` said. Canonical tags pointing at
  `liveplanner.app` are, for a staging mirror, the correct answer rather than a bug:
  they name production as the real home of the page.
- **The 101 WebSocket upgrade is passed through untouched.** A `Response` carrying a
  `webSocket` cannot be reconstructed to add a header — doing so kills realtime collab
  on staging, and does so only for that one path, which is exactly the kind of bug that
  survives a smoke test. The header wrapper skips status 101.

## Build-time configuration

`NEXT_PUBLIC_*` values are baked into the static export by `next build`, so **staging is
its own build** — the two workflows never share an artifact. Staging's build differs
from production's in exactly one value:

| Variable                 | Production                                        | Staging                               |
| ------------------------ | ------------------------------------------------- | ------------------------------------- |
| `NEXT_PUBLIC_MCP_ORIGIN` | empty (blank falls back to `mcp.liveplanner.app`) | `https://mcp-staging.liveplanner.app` |

Everything else matches, on purpose: `NEXT_PUBLIC_API_BASE` stays unset so staging
resolves `/api` same-origin through its own router, and
`NEXT_PUBLIC_TELEMETRY_ENABLED` (from the hosted profile, [Deployment](deployment.md)
"Hosted profile") is `true` in both so the staging build exercises the same
code as production's.

## Integrations

Each is wired to its own tenant or its own data — but **only two are switched on**.
Resend is configured and dormant, waiting on a key that is deliberately not
set. `GET /api/capabilities` is the authoritative answer at any moment; as of the
first deploy it returns `{"emailEnabled":false}` on staging against
`{"emailEnabled":true}` on production.

| Integration        | Staging setup                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Sign-in** — ON   | Staging is its **own OAuth client** of the liveworkspace accounts Worker (`ACCOUNTS_CLIENT_ID_STAGING` / `ACCOUNTS_CLIENT_SECRET_STAGING`) with its **own resource** (`API_RESOURCE_STAGING`), so its access tokens carry an audience production's api refuses: a staging session cannot reach production data. The client's registered redirect URI is `https://staging.liveplanner.app/api/auth/callback`. |
| **Telemetry** — ON | Events go to liveworkspace's staging telemetry service (`TELEMETRY_URL` in the hosted profile), so the **public** `/telemetry` dashboard on production is unaffected; staging's dashboard shows staging's own traffic, which is how you verify a new event actually lands.                                                                                                                                   |
| **Resend** — OFF   | Wired but keyless. `APP_BASE_URL` and `RESEND_FROM` are set, so setting `RESEND_API_KEY --env staging` turns it on and every link points back at staging. Left unset on purpose: staging sends the same notification emails as production, from the same verified domain, so switching it on mails **real people** (see the warning below). Turn it on for a specific test, then take the key off again.     |

> **Email warning.** Staging sends the same notification emails as production (new
> comments, form responses). With `RESEND_API_KEY` set, any address that signs into
> staging receives them, from the same verified domain as
> production's — so a staging account made with a colleague's address mails that
> colleague. That is why the key is unset by default: absent, the email feature is inert
> ([Transactional email (Resend)](../014-identity/transactional-email.md)).
> Set it for a specific test, use addresses you own, and remove it afterwards.

## Secrets

Production's secrets are untouched. Staging adds a `_STAGING`-suffixed twin for each
value the deploy workflow syncs:

| GitHub secret                    | Synced to                       | Notes                                                                                                                          |
| -------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `ACCOUNTS_URL_STAGING`           | staging api                     | The accounts Worker staging signs in through.                                                                                  |
| `API_RESOURCE_STAGING`           | staging api                     | Staging's own resource (the access-token audience). Never production's.                                                        |
| `ACCOUNTS_CLIENT_ID_STAGING`     | staging api, build step         | Staging's own OAuth client; set, it also turns sign-in on in the staging build.                                                |
| `ACCOUNTS_CLIENT_SECRET_STAGING` | staging api                     | That client's secret.                                                                                                          |
| `INDEX_KEY_STAGING`              | staging api                     | liveplanner's key at the staging index: the same value as staging liveworkspace's `INDEX_KEY_LIVEPLANNER`. Never production's. |
| `MEDIA_KEY_STAGING`              | staging api                     | liveplanner's key at the staging media service, which serves its previews: the same value as its `MEDIA_KEY_LIVEPLANNER`.      |
| `TELEMETRY_KEY_STAGING`          | staging api **and** staging mcp | Same value on both, and as staging telemetry's `TELEMETRY_KEY_LIVEPLANNER` ([Telemetry](../017-telemetry/telemetry.md)).       |

`CF_API_TOKEN` and `CF_ACCOUNT_ID` are shared — same account.

`RESEND_API_KEY` is **not** in the workflow for either
environment; it is provisioned once by hand with `wrangler secret put ... --env
staging`, exactly as production provisions them. Keeping the workflow's secret list
identical across the two environments is deliberate: a secret that exists in one
workflow and not the other is how the environments start to differ.

## One workflow body, two callers

`.github/workflows/deploy-reusable.yml` holds the entire deploy — build, the six parallel
app deploys, mcp, router — as a `workflow_call` reusable workflow taking the target
environment as inputs. `deploy.yml` (manual, production) and `deploy-staging.yml`
(automatic, staging) are thin callers.

This is the reuse rule applied to CI: the alternative was a second ~450-line file that
would be a faithful copy of production's deploy for about a week. A staging environment
whose deploy has drifted from production's tests nothing.

`deploy-staging.yml` triggers on `workflow_run` — CI completing successfully on `main` —
not on `push`. Deploying a red `main` to staging would mean the environment's state no
longer tells you anything. Every commit on `main` runs CI to the end
([Deployment](deployment.md#runs-on-main-are-never-cancelled)), so those runs can finish
out of order: a first job (**Still main's tip**) lets a run deploy only when its commit
is still `main`'s tip, and an older commit finishing last is skipped rather than putting
staging behind `main`. The deploy job's own `concurrency: cancel-in-progress: true` means
a rapid series of merges deploys the last one rather than queueing all of them; it sits
on the job, not the workflow, so a skipped run never cancels the tip's deploy. Production
keeps `cancel-in-progress: false`, because cancelling a half-finished production deploy
is worse than queueing.

## One-time setup

Deploys fail loudly until these exist. Resource ids are committed to `wrangler.toml`
(they are identifiers, not secrets — [Secrets policy](../002-project-scope/secrets-policy.md)).

**Done** — the data store exists, and its id is committed:

| Resource | Name                   | Where the id lives       |
| -------- | ---------------------- | ------------------------ |
| KV       | `mcp-oauth-kv-staging` | `apps/mcp/wrangler.toml` |

It was created in `ENAM`, Cloudflare's default for the account rather than a
deliberate choice; production's region was not readable from the API to mirror. If
staging ever needs to reproduce production's read latency, that is the knob.

Note the KV **title** is `mcp-oauth-kv-staging`, matching production's `mcp-oauth-kv`.
It is not `OAUTH_KV` — that is the binding name inside `wrangler.toml`, a different
thing, and `wrangler kv namespace create OAUTH_KV --env staging` would have produced
`liveplanner-mcp-staging-OAUTH_KV` instead.

The **workers** are not on this list: a worker is its uploaded script, so all eight
`liveplanner-*-staging` workers come into existence on the first staging deploy. The
job graph bootstraps them in the right order — the six path-routed workers first,
then mcp (service binding to api), then router (service bindings to the six) — exactly
as production's first deploy did ([Deployment](deployment.md) "First deploy").

Still outstanding:

```bash
# 1. Worker secrets not carried by the workflow
cd apps/api && wrangler secret put RESEND_API_KEY --env staging

# 2. GitHub secrets — Settings → Secrets and variables → Actions
#    the four _STAGING entries in the table above
```

**Done** — both custom domains are attached in the Cloudflare dashboard (the deploy
token is scoped to upload worker scripts, not to manage DNS, so this step can never be
automated from the workflow — same as production, [Deployment](deployment.md)):

- `staging.liveplanner.app` → `liveplanner-router-staging`
- `mcp-staging.liveplanner.app` → `liveplanner-mcp-staging`

Only those two workers get hostnames. The other six are reached exclusively over the
router's service bindings and never touch DNS, exactly as in production.

**Sign-in needs one registration**: staging's OAuth client on the accounts Worker, with
`https://staging.liveplanner.app/api/auth/callback` as its redirect URI and its own
resource. (Under Clerk, staging used an origin-permissive development tenant and needed
nothing.)

## What staging is not

- **Not a preview-per-PR environment.** One long-lived environment tracking `main`.
  Per-PR previews would need a worker per PR, their own data per PR and a wildcard hostname;
  if that's wanted later it's a different spec, not a knob on this one.
- **Not a production mirror.** No production data is copied in, ever. A staging bug must
  never be debuggable by reading a real user's project.
- **Not a rollback target.** Rolling production back is still a production deploy of an
  older `main`.

## Known sharp edge, inherited

`wrangler deploy` replaces a worker's plain `[vars]` with whatever the config file
declares, so any var set **only** in the Cloudflare dashboard is wiped on the next
deploy unless `keep_vars = true`. So nothing is set only in the dashboard: a var is
either committed (`[vars]` / `[env.staging.vars]`, every environment's default too) or part of
the hosted profile, which the deploy sends with `--var` on every run and then reads back
off the editor worker ([Deployment](deployment.md) "Hosted profile"). Either way the
environment is reproducible from the repo alone.

The general lesson: **an optional guard that fails open is
untestable from the source tree.** Every file can read as though a protection is active while
production runs without it. Where a guard is config-gated, the audit step is a probe against
the deployment, not a code review, and for the hosted profile that probe runs on every deploy.
