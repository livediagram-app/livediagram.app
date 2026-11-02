# Staging environment

A second, complete copy of the platform at **https://staging.livediagram.app**, deployed
**automatically** once CI passes for a push to `main`. Production is deployed by hand, and by
default ships what staging runs ([Deployment](deployment.md)).

The point is to have somewhere a change is _running_ before anyone decides to ship it:
against real remote Workers, Durable Objects and liveworkspace's staging index before it
reaches people's documents.

## The two environments

|              | Production                                      | Staging                                    |
| ------------ | ----------------------------------------------- | ------------------------------------------ |
| Hostname     | `livediagram.app`                               | `staging.livediagram.app`                  |
| MCP host     | `mcp.livediagram.app`                           | `mcp-staging.livediagram.app`              |
| Trigger      | By hand                                         | Automatic, on every green CI run on `main` |
| Workflow     | `deploy-production.yml` (**Deploy Production**) | `deploy-staging.yml` (**Deploy Staging**)  |
| Worker names | `livediagram-<app>`                             | `livediagram-<app>-staging`                |
| Index        | `liveworkspace.app`                             | `staging.liveworkspace.app`                |
| Indexable    | Yes                                             | **No**: `X-Robots-Tag: noindex, nofollow`  |

### "live" is a path, not an environment

Worth stating once, because the two readings collide: **`/live` is where the editor is
served**: `apps/editor`, the `livediagram-editor` worker, the router's `EDITOR` service
binding. The environments are **production** and **staging**, and nothing else; there is
no "live environment". Phrases like "goes live" are avoided in deploy copy for exactly this
reason: the same word would be doing two jobs.

Both run in the **same Cloudflare account**, the liveworkspace account every `wrangler.toml`
pins, under the one `CLOUDFLARE_API_TOKEN`. Two accounts would isolate harder, but every
binding, secret and dashboard step would then need doing twice by hand, and the thing most
likely to break staging is drift between the two, so the isolation is drawn at the
**resource**, not the account.

## Wrangler environments, not a second config file

Each app's `wrangler.toml` grows an `[env.staging]` block naming its worker
explicitly: `name = "livediagram-api-staging"` and so on. Wrangler would append the
suffix on its own, but nothing in `wrangler deploy --dry-run` prints the name it
resolved, and the router's five service bindings depend on those strings being exactly
right. A name you can read beats a name you have to infer.

The catch that shapes every block below: **wrangler does not inherit bindings into a
named environment.** `vars`, `d1_databases`, `r2_buckets`, `kv_namespaces`,
`durable_objects`, `migrations`, `services` and `unsafe` are all _non-inheritable_:
absent from `[env.staging]` means **absent from the deployed staging worker**, silently.
So every staging block restates its app's bindings in full, even where the value is
identical to production's. Only `main`, `compatibility_date`, `compatibility_flags`,
`rules`, `assets` and `triggers` carry over.

This is why the staging blocks read as duplication and must stay that way: they are not
a copy of the production config, they are the whole config for a different worker that
happens to agree with production on most values. `apps/router/src/index.test.ts` and
`staging:check` (`wrangler deploy --dry-run --env staging`, run in CI) are what stop the two
drifting apart unnoticed.

### Service bindings point at staging

The router binds five workers (marketing, editor, api, help, community) and mcp binds one (api). In `[env.staging]` every `service =`
value gains the `-staging` suffix, so the staging router forwards to the staging api and
never to production's. A missed suffix here is the single worst failure mode available:
staging frontend, production data, so `apps/router/wrangler.toml` keeps its staging
bindings adjacent to the production ones for eyeball comparison, and the dry-run in CI
prints the resolved binding table.

## Data isolation

Staging gets its own **KV namespace**, and talks to liveworkspace's
staging services (`staging.liveworkspace.app`: the index, media, Community and telemetry).
Durable Objects come free: a different script is a different DO namespace, so the staging
`DOCUMENT_ROOM` (and every document's content in it), `PERSON_STORE` and `WORKBENCH` are
already separate.

Rate-limiter namespace ids are deliberately **left identical** to production's. They are
scoped per script by Cloudflare, so the staging worker's `1001` is not production's
`1001`, and renumbering them would only invite the reader to think the number means
something.

Consequence worth stating plainly: **staging has no production data.** It starts empty
and stays a scratch environment. It is for exercising code paths, not for
reproducing a specific user's document.

## Staging runs first

Every push to `main` deploys to staging before anyone deploys production, and production
by default ships exactly what staging runs. There is no database migration step: each
Durable Object makes its own schema the first time it is used, so the staging deploy
rehearses the same Workers and Durable Object classes production will run.

A deploy that fails stops the staging run, and the Worker is retried on the next deploy
(the `deployed/staging` tag moves only when every Worker succeeded,
[Deployment](deployment.md) "Deploy").

## noindex, at the edge

Staging is public: no auth wall, no Cloudflare Access policy. Anyone with the link can
open it, which is what makes it usable for sharing a change with someone before it
ships.

Being public, it must not compete with production in search results. The router worker
sets **`X-Robots-Tag: noindex, nofollow` on every response** when its `DEPLOY_ENV` var
is `staging`: one line at the only point every app on the host passes through, rather
than a build flag threaded into five static apps.

Two deliberate non-changes:

- **`robots.txt` is not environment-aware.** Both the marketing and help apps keep
  emitting production's `robots.txt`, sitemaps and canonical URLs. `robots.txt` governs
  _crawling_, not _indexing_; `X-Robots-Tag` governs indexing and is the header a
  crawler must obey whatever `robots.txt` said. Canonical tags pointing at
  `livediagram.app` are, for a staging mirror, the correct answer rather than a bug:
  they name production as the real home of the page.
- **The 101 WebSocket upgrade is passed through untouched.** A `Response` carrying a
  `webSocket` cannot be reconstructed to add a header: doing so kills realtime collab
  on staging, and does so only for that one path, which is exactly the kind of bug that
  survives a smoke test. The header wrapper skips status 101.

## Build-time configuration

`NEXT_PUBLIC_*` values are baked into the static export by `next build`, so **staging is
its own build**: each environment's deploy builds its own sites. Staging's build differs
from production's in exactly one value:

| Variable                 | Production                                        | Staging                                     |
| ------------------------ | ------------------------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_MCP_ORIGIN` | empty (blank falls back to `mcp.livediagram.app`) | the staging MCP worker's `workers.dev` host |

Everything else matches, on purpose: `NEXT_PUBLIC_API_BASE` stays unset so staging
resolves `/api` same-origin through its own router, and
`NEXT_PUBLIC_TELEMETRY_ENABLED` (from the hosted profile, [Deployment](deployment.md)
"Hosted profile") is `true` in both so the staging build exercises the same
code as production's.

## Integrations

Each is wired to its own tenant or its own data, and all four are switched on.
`GET /api/capabilities` is the authoritative answer at any moment: with email on
Cloudflare Email Service it reports `emailEnabled: true` on staging as on production.

| Integration       | Staging setup                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Sign-in**: ON   | Staging is its **own OAuth client** of the liveworkspace accounts Worker (its own `ACCOUNTS_CLIENT_ID` / `ACCOUNTS_CLIENT_SECRET`) with its **own resource** (`API_RESOURCE`), so its access tokens carry an audience production's api refuses: a staging session cannot reach production data. The client's registered redirect URI is `https://staging.livediagram.app/api/auth/callback`.                                                                             |
| **Telemetry**: ON | Events land in liveworkspace's staging telemetry service, so the **public** `/telemetry` dashboard on production is unaffected; staging's dashboard shows staging's own traffic, which is how you verify a new event actually lands.                                                                                                                                                                                                                                     |
| **Email**: ON     | Cloudflare Email Service, through the `[[env.staging.send_email]]` binding `EMAIL` ([Email](../../../../liveworkspace/docs/specs/003-accounts/email.md)), restated because bindings don't inherit. No key. `APP_BASE_URL` and `EMAIL_FROM` are set, so every link points back at staging. Staging sends the same notification emails as production, from the same sender, so it mails **real people** (see the warning below). To turn it off, drop the staging binding. |
| **AI models**: ON | Keyed by hand, as production is: `wrangler secret put GOOGLE_AI_STUDIO_API_KEY --env staging`, which turns on the server reader for the event-storming photo import ([Note reader](../021-event-storming/note-reader.md)). `AI_ALLOWED_ORIGINS` restricts the endpoint to the staging origin. It spends real money per request; `GET /api/capabilities` reports whether it is on.                                                                                        |

> **Email warning.** Staging sends the same notification emails as production (comments,
> mentions, assigned actions, first-share and milestone notes). With the `EMAIL` binding in
> place, any address that signs into staging receives them, from the same sender as
> production's, so a staging account made with a colleague's address mails that
> colleague. Use addresses you own on staging. Without the binding the email feature is inert ([Transactional & lifecycle email](../014-identity/transactional-email.md)).

## Secrets

Production's secrets are untouched. Staging's workers carry their own value of each
secret, set with `wrangler secret put --env staging`, never production's:
`ACCOUNTS_URL` (the accounts Worker staging signs in through), `API_RESOURCE` (staging's
own resource, the access-token audience), `ACCOUNTS_CLIENT_ID` and
`ACCOUNTS_CLIENT_SECRET` (staging's own OAuth client), `TELEMETRY_KEY` (on the staging api
**and** staging mcp, the same value on both and on the staging telemetry service, or
server-side counts silently go missing,
[Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)), and
`COMMUNITY_KEY`, `MEDIA_KEY`, `DRIVE_KEY` and the model key (`GOOGLE_AI_STUDIO_API_KEY`)
for staging liveworkspace's services and the note reader.

A deploy writes no secret, so they survive every deploy
([Secrets policy](../002-project-scope/secrets-policy.md)). The one CI credential,
`CLOUDFLARE_API_TOKEN`, is shared: same account.

## One workflow body, two callers

The monorepo's root `deploy.yml` holds the whole deploy as a reusable workflow taking the
environment as an input, each Worker through `deploy-worker.yml`; `deploy-staging.yml`
and `deploy-production.yml` are thin callers ([Deployment](deployment.md) "Deploy"). A
staging environment whose deploy has drifted from production's tests nothing.

`deploy-staging.yml` triggers on `workflow_run` (CI completing successfully for a push to
`main`), not on `push`. Deploying a red `main` to staging would mean the environment's
state no longer tells you anything. Every commit on `main` runs CI to the end
([Deployment](deployment.md#runs-on-main-are-never-cancelled)), so those runs can finish
out of order, and while merges keep landing `main`'s tip rarely has a finished run. A
first job (**Newest green commit**) therefore deploys the newest commit on `main` whose CI
passed, whichever run asked, and skips only when staging already runs it or something
newer. Staging never goes behind `main`, never waits for `main` to sit still, and one run
deploys every green commit since the last deploy, since the plan diffs against what
staging last deployed. (It used to deploy only a commit still at `main`'s tip; on
2026-10-30 a steady stream of merges skipped every run for eight hours, and production,
shipping what staging runs, shipped nothing new.) Runs queue rather than cancel
(`cancel-in-progress: false`, for staging and production alike), so a deploy is never cut
off halfway; a queued run that a newer one replaces loses nothing, as the newer one looks
up the newest green commit when it starts.

## One-time setup

Deploys fail loudly until these exist. Resource ids are committed to `wrangler.toml`
(they are identifiers, not secrets; [Secrets policy](../002-project-scope/secrets-policy.md)).

**Done**: the data store exists:

| Resource | Name                            | Where the id lives       |
| -------- | ------------------------------- | ------------------------ |
| KV       | `livediagram-mcp-oauth-staging` | `apps/mcp/wrangler.toml` |

Note the KV **title** is `livediagram-mcp-oauth-staging`, matching production's
`livediagram-mcp-oauth`: the product's name leads, because every liveworkspace app's
namespaces share one account (liveplanner's are `liveplanner-mcp-oauth[-staging]`).
It is not `OAUTH_KV`; that is the binding name inside `wrangler.toml`, a different
thing, and `wrangler kv namespace create OAUTH_KV --env staging` would have produced
`livediagram-mcp-staging-OAUTH_KV` instead.

The **workers** are not on this list: a worker is its uploaded script, so all seven
`livediagram-*-staging` workers come into existence on the first staging deploy. The
tiers bootstrap them in the right order: the api first, then the sites and mcp (bound to
the api), then the router (bound to the five), exactly as production's first deploy did
([Deployment](deployment.md) "Deploy").

**Secrets** are set once per worker with `wrangler secret put <NAME> --env staging` (the
list under [Secrets](#secrets)), for example
`cd apps/api && wrangler secret put GOOGLE_AI_STUDIO_API_KEY --env staging` for the note
reader.

**Hostnames**: only two workers get one:

- `staging.livediagram.app` → `livediagram-router-staging`
- `mcp-staging.livediagram.app` → `livediagram-mcp-staging`

Each is declared as a custom domain in its worker's `[env.staging]` block and attached by
the deploy ([Deployment](deployment.md#custom-domain)).
The other five are reached exclusively over the router's service bindings and never
touch DNS, exactly as in production.

**Sign-in needs one registration**: staging's OAuth client on the accounts Worker, with
`https://staging.livediagram.app/api/auth/callback` as its redirect URI and its own
resource. (Under Clerk, staging used an origin-permissive development tenant and needed
nothing.)

## What staging is not

- **Not a preview-per-PR environment.** One long-lived environment tracking `main`.
  Per-PR previews would need a worker per PR, its own storage per PR and a wildcard hostname;
  if that's wanted later it's a different spec, not a knob on this one.
- **Not a production mirror.** No production data is copied in, ever. A staging bug must
  never be debuggable by reading a real user's document.
- **Not a rollback target.** Rolling production back is a production deploy of an
  older commit.

## Known sharp edge, inherited

`wrangler deploy` replaces a worker's plain `[vars]` with whatever the config file
declares, so any var set **only** in the Cloudflare dashboard is wiped on the next
deploy unless `keep_vars = true`. So nothing is set only in the dashboard: a var is
either committed (`[vars]` / `[env.staging.vars]`, every fork's default too) or part of
the hosted profile, which the deploy sends with `--var` on every run and then reads back
off the api worker ([Deployment](deployment.md) "Hosted profile"). Either way the
environment is reproducible from the repo alone.

So `AI_ALLOWED_ORIGINS` (which guards the note reader, `POST /api/ai/read-notes`) is declared in production's
`[vars]` and staging's, and the deploy's verify step is the probe that fails when a hosted-profile value is not live.
The image caps are liveworkspace's media service's, which keeps them for every app; the hosted profile carries the
media service's URL. `AI_REQUIRE_SIGN_IN` is deliberately unset in **both** environments (the note reader serves
guests; see the comment above production's `AI_ALLOWED_ORIGINS`), since a difference there is exactly the drift this
environment exists to catch.

The rule: **an optional guard that fails open is
untestable from the source tree.** Every file can read as though a protection is active while
production runs without it. Where a guard is config-gated, the audit step is a probe against
the deployment, not a code review, and for the hosted profile that probe runs on every deploy.
