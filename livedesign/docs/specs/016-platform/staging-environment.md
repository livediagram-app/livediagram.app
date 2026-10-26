# Staging environment

A second, complete copy of the platform at **https://staging.livedesign.app**, deployed
**automatically on every merge to `main`** once CI is green. Production is manual,
`workflow_dispatch` only, and by default ships what staging runs ([Deployment](deployment.md)).

The point is to have somewhere a change is _running_ before anyone decides to ship it,
in particular somewhere a new Durable Object `[[migrations]]` tag is applied to real
remote Durable Objects before it reaches the ones holding people's designs.

## The two environments

|               | Production                                      | Staging                                    |
| ------------- | ----------------------------------------------- | ------------------------------------------ |
| Hostname      | `livedesign.app`                                | `staging.livedesign.app`                   |
| MCP host      | `mcp.livedesign.app`                            | `mcp-staging.livedesign.app`               |
| Trigger       | Manual (`workflow_dispatch`)                    | Automatic, on every green CI run on `main` |
| Workflow      | `deploy-production.yml` (**Deploy Production**) | `deploy-staging.yml` (**Deploy Staging**)  |
| Worker names  | `livedesign-<app>`                              | `livedesign-<app>-staging`                 |
| R2            | `livedesign-photo-blobs`                        | `livedesign-photo-blobs-staging`           |
| liveworkspace | `liveworkspace.app`                             | `staging.liveworkspace.app`                |
| Indexable     | Yes                                             | **No**: `X-Robots-Tag: noindex, nofollow`  |

### "live" is an app, not an environment

**`live` is the name of the editor app**: `apps/live`, the `livedesign-live` worker, the `LIVE` service binding. It is
a proper noun. The environments are **production** and **staging**, and nothing else; there is no "live environment".

Both run in the **same Cloudflare account** (the liveworkspace account every `wrangler.toml` pins), under the one
`CLOUDFLARE_API_TOKEN`. Two accounts would isolate harder, but every binding, secret and dashboard step would then
need doing twice by hand, and the thing most likely to break staging is drift between the two, so the isolation is
drawn at the **resource**, not the account.

## Wrangler environments, not a second config file

Each app's `wrangler.toml` grows an `[env.staging]` block naming its worker
explicitly — `name = "livedesign-api-staging"` and so on. Wrangler would append the
suffix on its own, but nothing in `wrangler deploy --dry-run` prints the name it
resolved, and the router's six service bindings depend on those strings being exactly
right. A name you can read beats a name you have to infer.

The catch that shapes every block below: **wrangler does not inherit bindings into a
named environment.** `vars`, `r2_buckets`, `kv_namespaces`,
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
staging frontend, production designs — so `apps/router/wrangler.toml` keeps its staging
bindings adjacent to the production ones for eyeball comparison, and the dry-run in CI
prints the resolved binding table.

## Data isolation

Staging gets its own **R2 buckets** and **KV namespace**, and points at staging
liveworkspace (`INDEX_ORIGIN`, `MEDIA_URL`, `TELEMETRY_URL`), so its designs are filed in
staging's index, not production's. Durable Objects come free: a different script is a
different DO namespace, so the staging `DESIGN_ROOM` and `WORKBENCH` are already
separate. livedesign keeps no database of its own, in either environment.

Rate-limiter namespace ids are deliberately **left identical** to production's. They are
scoped per script by Cloudflare, so the staging worker's `1001` is not production's
`1001`, and renumbering them would only invite the reader to think the number means
something.

Consequence worth stating plainly: **staging has no production data.** It starts empty
and stays a scratch environment. It is for exercising code paths and Durable Object migrations, not for
reproducing a specific user's design.

## Durable Object migrations run on staging first

livedesign has no database migrations to apply. The api's Durable Object classes are
declared through `[[migrations]]` tags in `apps/api/wrangler.toml`, restated under
`[env.staging]`, and `wrangler deploy --env staging` applies a new tag itself
([Deployment](deployment.md) "Durable Object migrations"). Every merge to `main` therefore
applies a new tag to staging's Durable Objects one manual deploy before production's.

A deploy that fails stops the staging run before the tiers after it, and the
`deployed/staging` tag stays put, so the next deploy retries it. The staging deploy is
chained to CI rather than fired in parallel with it, so only a green `main` reaches it.

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
  `livedesign.app` are, for a staging mirror, the correct answer rather than a bug:
  they name production as the real home of the page.
- **The 101 WebSocket upgrade is passed through untouched.** A `Response` carrying a
  `webSocket` cannot be reconstructed to add a header — doing so kills realtime collab
  on staging, and does so only for that one path, which is exactly the kind of bug that
  survives a smoke test. The header wrapper skips status 101.

## Build-time configuration

`NEXT_PUBLIC_*` values are baked into the static export by `next build`, so **staging is
its own build**: each deploy builds its sites for its environment. Staging's build differs
from production's in exactly one value:

| Variable                 | Production                                       | Staging                                                                                                                                        |
| ------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_MCP_ORIGIN` | empty (blank falls back to `mcp.livedesign.app`) | the staging mcp worker's `workers.dev` address (`https://livedesign-mcp-staging.<subdomain>.workers.dev`, set in the root `deploy-worker.yml`) |

Everything else matches, on purpose: `NEXT_PUBLIC_API_BASE` stays unset so staging
resolves `/api` same-origin through its own router, and
`NEXT_PUBLIC_TELEMETRY_ENABLED` (from the hosted profile, [Deployment](deployment.md)
"Hosted profile") is `true` in both so the staging build exercises the same
code as production's.

## Integrations

Each is wired to its own tenant or its own data, and all three are switched on.
`GET /api/capabilities` is the authoritative answer at any moment: with the `EMAIL` binding declared in
both environments it returns `{"emailEnabled":true}` on staging as on production.

| Integration        | Staging setup                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sign-in** — ON   | Staging is its **own OAuth client** of the liveworkspace accounts Worker (its `ACCOUNTS_CLIENT_ID` / `ACCOUNTS_CLIENT_SECRET`, set with `--env staging`) with its **own resource** (`API_RESOURCE`), so its access tokens carry an audience production's api refuses: a staging session cannot reach production data. The client's registered redirect URI is `https://staging.livedesign.app/api/auth/callback`.                                                                       |
| **Telemetry** — ON | Events go to staging liveworkspace's telemetry service (`https://staging.liveworkspace.app/api/telemetry`), so the **public** `/telemetry` dashboard on production is unaffected; staging's dashboard shows staging's own traffic, which is how you verify a new event actually lands.                                                                                                                                                                                                  |
| **Email** — ON     | Cloudflare Email Service through the `[[env.staging.send_email]]` binding `EMAIL` ([liveworkspace/docs/specs/003-accounts/email.md](../../../../liveworkspace/docs/specs/003-accounts/email.md)), restated because bindings don't inherit. `EMAIL_FROM` is production's sender, and `APP_BASE_URL` points every link back at staging. No key: the binding is the credential. Staging runs the same daily email cron as production, so it mails **real people** (see the warning below). |

> **Email warning.** Staging sends the same emails as production
> (notifications, milestones). Any address that signs into staging receives them, from
> the same sender as production's — so a staging account made with a colleague's address
> mails that colleague. Use addresses you own. To take staging's email off, drop the
> `[[env.staging.send_email]]` block and redeploy: without the binding the email feature is
> inert ([Transactional email](../014-identity/transactional-email.md)).

## Secrets

Worker secrets are per environment: staging's are set with `wrangler secret put --env staging` and are never
production's (its own accounts client and resource, its own `MEDIA_KEY` for staging liveworkspace's media service, its
own `TELEMETRY_KEY` on the api and mcp). A deploy writes no secret, so they survive every deploy
([Secrets policy](../002-project-scope/secrets-policy.md)).

Email needs no secret in either environment: the `EMAIL` binding is the credential.

## One workflow body, two callers

The monorepo's root `deploy.yml` holds the whole deploy as a reusable workflow taking the environment as an input;
`deploy-staging.yml` and `deploy-production.yml` are thin callers ([Deployment](deployment.md#deploy)). A staging
environment whose deploy has drifted from production's tests nothing.

`deploy-staging.yml` triggers on `workflow_run` (CI completing successfully for a push to `main`), not on `push`:
deploying a red `main` would mean staging's state tells you nothing. Every commit on `main` runs CI to the end
([Deployment](deployment.md#runs-on-main-are-never-cancelled)), so those runs can finish out of order: a first job
(**Still main's tip**) lets a run deploy only when its commit is still `main`'s tip. An older commit finishing last is
skipped, and the tip's run deploys both, since the plan diffs against what staging last deployed. Runs queue rather
than cancel (`cancel-in-progress: false`, for staging and production alike), so a deploy is never cut off halfway.

## One-time setup

Deploys fail loudly until these exist. Resource ids are committed to `wrangler.toml`
(they are identifiers, not secrets: [Secrets policy](../002-project-scope/secrets-policy.md)).

**Data stores** staging needs, each created once with wrangler:

| Resource | Name                             | Created with                                                            | Where the id lives                        |
| -------- | -------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------- |
| R2       | `livedesign-photo-blobs-staging` | `wrangler r2 bucket create livedesign-photo-blobs-staging`              | bound by name, no id                      |
| KV       | `livedesign-mcp-oauth-staging`   | `wrangler kv namespace create livedesign-mcp-oauth-staging` (see below) | `apps/mcp/wrangler.toml`, `[env.staging]` |

`wrangler r2 bucket list` and `wrangler kv namespace list` show whether each exists. The
KV namespace's id is in `apps/mcp/wrangler.toml`. The api's Durable Objects need no
setup: they exist once the staging api worker deploys.

Note the KV **title** is `livedesign-mcp-oauth-staging`, matching production's
`livedesign-mcp-oauth`: the product's name leads, because every liveworkspace app's
namespaces share one account (liveplanner's are `liveplanner-mcp-oauth[-staging]`).
It is not `OAUTH_KV`: that is the binding name inside `wrangler.toml`, a different
thing, and `wrangler kv namespace create OAUTH_KV --env staging` would produce
`livedesign-mcp-staging-OAUTH_KV` instead.

The **workers** are not on this list: a worker is its uploaded script, so every
`livedesign-*-staging` worker comes into existence on the first staging deploy. The tiers
bootstrap them in order: the api first, then the sites and mcp (bound to the api), then the
router (bound to the four) ([Deployment](deployment.md) "First deploy").

**Nothing to do for hostnames**: both are declared in the workers' `[env.staging]` blocks
and attached by the deploy itself, as production's are ([Deployment](deployment.md#custom-domain)):

- `staging.livedesign.app` → `livedesign-router-staging`
- `mcp-staging.livedesign.app` → `livedesign-mcp-staging`

Only those two workers get hostnames. The other six are reached exclusively over the
router's service bindings and never touch DNS, exactly as in production.

**Sign-in needs one registration**: staging's OAuth client on the accounts Worker, with
`https://staging.livedesign.app/api/auth/callback` as its redirect URI and its own
resource.

## What staging is not

- **Not a preview-per-PR environment.** One long-lived environment tracking `main`.
  Per-PR previews would need a worker per PR, their own storage and a wildcard hostname;
  that would be a different spec, not a knob on this one.
- **Not a production mirror.** No production data is copied in, ever. A staging bug must
  never be debuggable by reading a real user's design.
- **Not a rollback target.** Rolling production back is a production deploy of an
  older commit (`deploy-production.yml` with a `ref`).

## Known sharp edge, inherited

`wrangler deploy` replaces a worker's plain `[vars]` with whatever the config file
declares, so any var set **only** in the Cloudflare dashboard is wiped on the next
deploy unless `keep_vars = true`. So nothing is set only in the dashboard: a var is
either committed (`[vars]` / `[env.staging.vars]`, every fork's default too) or part of
the hosted profile, which the deploy sends with `--var` on every run and then reads back
off the live worker ([Deployment](deployment.md) "Hosted profile"). Either way the
environment is reproducible from the repo alone.

Image caps are not livedesign's to set: liveworkspace's media service keeps the images and their caps for every app.
