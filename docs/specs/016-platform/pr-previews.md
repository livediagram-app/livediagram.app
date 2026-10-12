# PR previews

Every pull request from a branch of this repository gets its own running copy of the
site at **`https://pr-<N>.livediagram.app`**, where `<N>` is the PR number. It is
deployed on every push to the PR, and torn down when the PR closes. Reviewers open
the link instead of checking out the branch.

Previews sit beside the two long-lived environments, production and
[staging](staging-environment.md); they never replace staging's job of rehearsing a
migration against the database `main` is heading for.

## Two tiers

|                 | Preview                                             | Full preview                                                |
| --------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| When            | Every same-repo PR                                  | PR touches the api, or carries the **`full-preview`** label |
| Own workers     | router, marketing, live, telemetry, help, community | the same, plus **api**                                      |
| api it talks to | **staging's** (`livediagram-api-staging`)           | its own (`livediagram-api-pr-<N>`)                          |
| D1 / R2         | staging's, through staging's api                    | its own `livediagram-pr-<N>` / `livediagram-images-pr-<N>`  |
| Migrations      | none run                                            | the PR's migrations, against its own empty D1               |
| Good for        | frontend, copy, help, marketing changes             | api routes, Durable Objects, migrations                     |

A **Preview** is cheap: six static-asset and routing workers, no data of its own. Its
documents are staging documents, so whatever a reviewer makes there also appears on
staging. A **Full preview** adds an api worker with its own database and bucket, so the
PR's server code and migrations run end to end in isolation.

### Choosing the tier

A PR gets a Full preview when **either** holds:

- **It touches the api.** Turbo's package graph decides: `@livediagram/api` is among the
  packages the PR changes or that depend on a changed package
  (`turbo ls --filter='...[<base>...<head>]'`). Migrations live in `apps/api/migrations/`,
  so a migration always counts, and so does a change to any shared package the api
  bundles (`document`, `templates`, `items`, ...), because that is what can break the api
  deploy after merge. Over the last 40 merges to `main` this matched 15 (38%); files under
  `apps/api/` alone would have matched 9, and migrations 1.
- **It carries the `full-preview` label**, added by hand to force one.

When the graph matches, the workflow adds the label itself, so the reason a PR has a full
preview is visible on the PR. A label added with the workflow's own token starts no new
run, so the tier is decided and deployed in the same run. The rule is "graph **or**
label", so removing an auto-added label from a PR that still touches the api has no
effect: the next push adds it back.

The tier is re-decided on every run. Adding the label upgrades the PR on that run (the
label event is itself a run). A PR that stops matching and has no label downgrades: the
router is redeployed pointing at staging's api, then the PR's api worker, D1 and R2 are
deleted.

### What a preview never includes

- **MCP.** The MCP server needs its own host, OAuth KV namespace and consent URL. A
  preview's editor points its MCP settings at `mcp-staging.livediagram.app`, which talks
  to staging's api, not the preview's.
- **Sign-in.** Previews are built with no Clerk publishable key, so they run in the
  supported guest-only mode ([Auth + guest access](../014-identity/auth-and-guest-access.md)).
  No Clerk origin needs allowing, and no preview can touch a staging or production
  account.
- **Email, AI and the Google Drive picker.** None of their keys reach a preview.
- **Crons.** A full preview's api declares no cron triggers, so the lifecycle-email and
  cleanup jobs never run there.

## Naming

Every resource a preview owns is named from the PR number, so ownership is readable from
the name alone and the sweeper (below) can find it without a lookup table.

| Resource             | Name                                                              |
| -------------------- | ----------------------------------------------------------------- |
| Worker               | `livediagram-<app>-pr-<N>`                                        |
| D1 database (full)   | `livediagram-pr-<N>`                                              |
| R2 bucket (full)     | `livediagram-images-pr-<N>`                                       |
| Hostname             | `pr-<N>.livediagram.app`, a custom domain on the preview's router |
| Wrangler environment | `preview`                                                         |

`pr-<N>` cannot collide with an existing subdomain: none of `www`, `staging`, `mcp` or
`mcp-staging` is `pr-` followed by digits. The hostname is one level under the zone, so
the zone's existing universal certificate covers it.

## Configuration is generated from staging's

Wrangler has no placeholder syntax, so a per-PR name cannot be written into
`wrangler.toml`. Rather than a third hand-kept block per app, the preview config is
**generated** at deploy time from each app's `[env.staging]` block, which is already the
complete, non-inheriting config for a non-production copy
([Staging environment](staging-environment.md), "Wrangler environments"):

- the generator reads `[env.staging]` and writes `[env.preview]` into a git-ignored
  `wrangler.preview.toml` beside the app's `wrangler.toml`, so relative paths (`main`,
  `assets.directory`, `migrations_dir`) resolve unchanged;
- every worker `name` and every service binding's `service` swaps `-staging` for
  `-pr-<N>` **when that worker is part of this tier**, and keeps `-staging` when it is
  not (a Preview's router and community bind `livediagram-api-staging`);
- the router's `DEPLOY_ENV` becomes `preview`, and it gains
  `routes = [{ pattern = "pr-<N>.livediagram.app", custom_domain = true }]`;
- a full preview's api swaps its D1 name and id for the PR's database, its R2 bucket for
  the PR's, `AI_ALLOWED_ORIGINS` for the preview origin, and declares
  `[env.preview.triggers] crons = []`, because `triggers` is one of the few keys a
  named environment **inherits** from the top level, so leaving it out would run
  production's crons.

A binding the generator does not know how to rewrite fails the generation rather than
passing through, because a `-staging` value left in a full preview's api is the same
"preview frontend, staging database" mistake the staging spec calls its worst failure.

## Build

Previews build like staging with three differences:

| Variable                            | Preview value                                    | Why                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | empty                                            | Guest-only.                                                                                                                                                                                                                                                                                                                        |
| `NEXT_PUBLIC_MCP_ORIGIN`            | `https://mcp-staging.livediagram.app`            | No MCP of its own.                                                                                                                                                                                                                                                                                                                 |
| `NEXT_PUBLIC_BUILD_ID`              | empty on a Preview; the commit on a Full preview | A Preview's editor talks to staging's api, whose `BUILD_ID` is staging's commit; with both set they never match, and the editor would treat itself as permanently stale ([Stale builds](stale-builds.md)). Empty disables that layer. A full preview's api is deployed in the same run, so the ids agree as they do in production. |

The hosted profile ([Deployment](deployment.md), "Hosted profile") gains a third
environment, `preview`, beside production and staging in `apps/api/hosted-vars.json`.
Its per-environment values are all empty: no `APP_BASE_URL` (no email leaves a preview)
and no `GOOGLE_CLIENT_ID` (the Drive mirror stays off). The shared values, telemetry on
and the per-owner image caps, apply as they do everywhere hosted. A Preview's telemetry
lands in staging's D1 through staging's api; a full preview's lands in its own. The build
check then proves a preview build carries neither production's nor staging's Google
client id.

## Lifecycle

`deploy-preview.yml` runs on `pull_request` (`opened`, `synchronize`, `reopened`,
`labeled`, `unlabeled`, `closed`):

- **Deploy** on open, push, reopen and label changes. It does not wait for CI: a preview
  is for looking at a change, and a red build that deploys is still worth seeing. It
  touches no shared data except staging's, which is a scratch environment.
- **Tear down** on close, merged or not: router first (releasing the hostname), then the
  frontends and community, then a full preview's api, R2 bucket (emptied first, as
  Cloudflare refuses to delete a non-empty bucket) and D1.
- **Concurrency** is per PR, `preview-pr-<N>`, with `cancel-in-progress: true`: a burst
  of pushes deploys the last. Teardown uses the same group, so a close cancels an
  in-flight deploy rather than racing it.
- **The link** is recorded as a GitHub deployment on the `preview` environment, so it
  shows on the PR without the workflow needing write access to comments.

A **sweeper** (`preview-sweep.yml`) runs daily and on demand. It lists workers, D1
databases and R2 buckets named `*-pr-<N>` and tears down any whose PR is closed, so a
teardown that failed or never ran (a cancelled run, an outage) does not leak resources
for ever.

The deploy itself is the same reusable workflow production and staging call
(`deploy-reusable.yml`), given the PR number and tier. A preview whose deploy steps
differ from staging's would stop telling you anything about how the change deploys.

## Trust

- Only the job that decides the tier holds `pull-requests: write`, to add the label; it runs
  turbo over the checked-out tree and nothing else. Every deploy job stays `contents: read`.
- Runs only when the PR's head repository is this repository. A fork's PR never gets a
  preview: `pull_request` runs from forks receive no secrets, and the job skips cleanly
  rather than failing. `pull_request_target` is never used.
- Anyone who can push a branch here can already reach the repository's secrets through
  any `pull_request` workflow, so previews add no new holder of `CF_API_TOKEN`. They do
  widen what that token must be allowed to do: create and delete D1 databases and R2
  buckets, and attach Workers custom domains on the `livediagram.app` zone.
- Previews are public and unauthenticated, as staging is. The router stamps
  `X-Robots-Tag: noindex, nofollow` when `DEPLOY_ENV` is `staging` **or** `preview`.
- A full preview's api gets a fresh random `GUEST_ID_HMAC_SECRET` per deploy, never
  staging's or production's, so a guest id signed on a preview is not claimable
  anywhere else.

## Limits and cost

- **Workers per account.** Production and staging hold 8 each. A Preview adds 6 workers,
  a Full preview 7. The account's script limit bounds how many PRs can hold a preview at
  once; the deploy fails with Cloudflare's own error when it is reached, and the sweeper
  is what keeps closed PRs from counting against it.
- **D1 databases per account** bound concurrent full previews the same way.
- **CI minutes.** A staging deploy, the same workflow body, takes 6 to 8 minutes
  (measured over the last four green runs, 2026-10-11/12). A preview costs about that on
  every push to an open PR, on top of CI.
- **Product runtime cost: none.** The only product code change is the router's noindex
  condition, one string comparison per request.

## Self-hosting

Previews are hosted-only plumbing. Both preview workflows gate on the hosted
repository's id (the same check as the hosted profile in [Deployment](deployment.md)),
so a fork's own PRs never try to deploy to a zone it does not hold, and nothing in the
apps depends on previews.
