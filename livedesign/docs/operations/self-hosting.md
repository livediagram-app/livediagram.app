# Self-hosting

livedesign is designed to be self-hostable. Its own stack runs on Cloudflare Workers, and it builds on a **liveworkspace deployment** for the things every liveworkspace app shares: sign-in and guests (the accounts Worker), the index where every design is filed, and the media service that keeps uploaded images. So a self-hoster needs a Cloudflare account and a liveworkspace deployment to point it at, either liveworkspace.app's or one of their own.

This guide is the practical path: provision Cloudflare resources, connect liveworkspace, configure secrets, deploy. For the why-behind-the-shape, read [Deployment](../specs/016-platform/deployment.md) (deployment) and [Secrets policy](../specs/002-project-scope/secrets-policy.md) (secrets).

## What you'll provision on Cloudflare

| Resource                               | Used by           | Why                                                                                                                                                                                                                                                   |
| -------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Workers paid plan**                  | All seven workers | Durable Objects need the paid plan.                                                                                                                                                                                                                   |
| **Durable Objects**                    | `apps/api`        | `DESIGN_ROOM` (`DesignRoom`): one per design, holding its content in its own SQLite and running its realtime room. `WORKBENCH` (`WorkbenchStore`): one per person, holding their workbench pairings, tickets and sessions. Both come with the deploy. |
| **R2 bucket `PHOTO_BLOBS`** (optional) | `apps/api`        | Photo pages' tiles, sources and previews ([Photo store](../specs/031-photo/photo-store.md)). Without it, every photo blob route answers `503`.                                                                                                        |
| **Rate Limiter bindings** (optional)   | `apps/api`        | Abuse throttles: per-owner writes, plus the CLI's telemetry relay, share-code lookups, link unfurls, API-token reads and workbench tickets. Any binding you don't provision falls through to "allow", so none are required.                           |
| **Custom domain**                      | `apps/router`     | The router worker serves your hostname; downstream workers don't need their own domain.                                                                                                                                                               |

The api worker also runs one cron, `0 3 * * *`, which tells the media service each day which images its designs still use. It is declared in `apps/api/wrangler.toml` and needs nothing provisioned.

## What you need from liveworkspace

livedesign keeps no database of its own: each design's content lives in its Durable Object, and everything about where a design is and who may open it lives in liveworkspace. A self-host connects to these three services:

- **The accounts Worker** (`ACCOUNTS_URL`, `API_RESOURCE`, `ACCOUNTS_CLIENT_ID`, `ACCOUNTS_CLIENT_SECRET`): signing in, and guests. A guest is a liveworkspace guest, the same person in every liveworkspace app, carried as a signed guest token the accounts Worker hands out; the api worker checks it against the accounts Worker's public keys, as it does an account's access token. See [Sign-in and guests](#sign-in-and-guests).
- **The index** (`INDEX_ORIGIN` in `apps/api/wrangler.toml` `[vars]`, and the `INDEX_KEY` secret): where every design is filed, plus sharing, share links, folders, Trash and teams. The api worker checks the grants it signs (`${INDEX_ORIGIN}/api/index/jwks`) and pushes each design's summary to it with `INDEX_KEY`, which the index holds as `INDEX_KEY_LIVEDESIGN` ([liveworkspace/docs/index-service.md](../../../liveworkspace/docs/index-service.md)). Without `INDEX_KEY` the design endpoints answer as missing.
- **The media service** (`MEDIA_URL`, and the `MEDIA_KEY` secret): uploaded images, and every design's previews (the Explorer thumbnail, the live image and the share card), which it draws through the api's export door ([liveworkspace/docs/previews.md](../../../liveworkspace/docs/previews.md)). See [Images](#images).

`INDEX_ORIGIN` ships as `https://liveworkspace.app`; point it at your own liveworkspace deployment if you run one.

What you do NOT need:

- A database. There is no database to create, no migration to apply and no separate database host: Durable Objects and R2 hold livedesign's own data, and liveworkspace holds the rest.
- No _required_ SaaS beyond liveworkspace: no Stripe (no paid tier) and no analytics vendor. The other integration is optional and stays off until you add a key: Resend for transactional email ([Transactional email (Resend)](../specs/014-identity/transactional-email.md)), covered in its own section below. The telemetry endpoint is first-party only and off by default.

## One-time Cloudflare setup

1. **Create a Cloudflare account** and sign up for the Workers paid plan ($5/mo at the time of writing).
2. **Create the R2 bucket** (optional, for photo pages):

   ```sh
   pnpm exec wrangler r2 bucket create livedesign-photo-blobs
   ```

   It is bound to `PHOTO_BLOBS` in `apps/api/wrangler.toml`. To run without it, remove its `[[r2_buckets]]` block.

3. **Nothing else to create for the api.** Its Durable Object classes are declared through the `[[migrations]]` tag in `apps/api/wrangler.toml`, and `wrangler deploy` applies it itself on the first deploy. Each design's tables are made inside its Durable Object on first use.

4. **Get an API token + account id**:
   - Account id is at the bottom-right of any Cloudflare dashboard page.
   - API token: create one with **Workers Scripts: Edit**, **R2: Edit** (only if using the R2 buckets), **Workers KV Storage: Edit** (only for the optional MCP server's KV namespace), and **Account → Account Settings: Read** on your account. Save it.

5. **Set the liveworkspace keys** on the api worker (see [What you need from liveworkspace](#what-you-need-from-liveworkspace)):

   ```sh
   pnpm --filter @livedesign/api exec wrangler secret put INDEX_KEY
   pnpm --filter @livedesign/api exec wrangler secret put MEDIA_KEY
   ```

   Each is the value liveworkspace holds for livedesign (`INDEX_KEY_LIVEDESIGN` on the index, `MEDIA_KEY_LIVEDESIGN` on the media service). `INDEX_KEY` is set by hand and persists across deploys; `MEDIA_KEY` can also come from the deploy workflow (below).

## Required GitHub Actions secrets

If you're deploying via GitHub Actions (the default workflow), set two repo secrets:

- `CF_API_TOKEN`: the token from the step above.
- `CF_ACCOUNT_ID`: your Cloudflare account id.

Those two are the only **required** ones — the deploy workflow uses raw `pnpm exec wrangler deploy` against them. It also syncs worker secrets from repo secrets of the same name, each skipped when unset: the four sign-in values (`ACCOUNTS_URL`, `API_RESOURCE`, `ACCOUNTS_CLIENT_ID`, `ACCOUNTS_CLIENT_SECRET`), `MEDIA_KEY` ([Images](#images)), and `TELEMETRY_KEY`. Setting them here rather than by hand means they rotate by editing the GitHub secret — and, for `TELEMETRY_KEY`, that the api and mcp workers can't drift apart. See [Secrets policy](../specs/002-project-scope/secrets-policy.md) for the full table.

## Sign-in and guests

Everyone who uses livedesign is either signed in to their liveworkspace account or a liveworkspace guest, and both identities come from the liveworkspace accounts Worker. To connect your self-host to one:

1. Register your deployment as an OAuth client of the accounts Worker. Its redirect URI is `https://<your-host>/api/auth/callback`, and it needs its own resource (the audience its access tokens carry). You get a client id and a client secret.
2. Set the values on the two apps:
   - **Live (build-time, browser-side)**: set `NEXT_PUBLIC_SIGN_IN_ENABLED=true` in your CI build env, or in `apps/live/.env.production`. The deploy workflow sets it for you when the `ACCOUNTS_CLIENT_ID` repo secret is set.
   - **API (worker secrets)**:

     ```sh
     pnpm --filter @livedesign/api exec wrangler secret put ACCOUNTS_URL
     pnpm --filter @livedesign/api exec wrangler secret put API_RESOURCE
     pnpm --filter @livedesign/api exec wrangler secret put ACCOUNTS_CLIENT_ID
     pnpm --filter @livedesign/api exec wrangler secret put ACCOUNTS_CLIENT_SECRET
     ```

     Paste each value when prompted.

3. **Guests need nothing extra.** The first time a browser needs an identity, the editor goes through `GET /api/auth/guest` to the accounts Worker, which hands back a signed guest token; the editor sends it as the Bearer, and the api worker checks it like an access token. When a guest signs in, liveworkspace moves their designs to the account in the index, so nothing on the api worker is involved ([Auth + guest access](../specs/014-identity/auth-and-guest-access.md)).

4. **Teams ([Teams](../specs/013-workspace/teams.md)) need nothing extra.** They are liveworkspace's: made and run on liveworkspace.app, carried in each access token, and granted through the index (see [Teams](#teams) below).

5. **API tokens ([Public API and API tokens](../specs/015-api/public-api-and-tokens.md)) come with sign-in.** Tokens are liveworkspace account tokens (`lwt_`), made and revoked on liveworkspace.app, and the api worker checks each one with liveworkspace.

Without `ACCOUNTS_URL` and `API_RESOURCE`, the api worker can verify no one: every request reaches it with no identity, as a link visitor's does, so nobody can create or own a design. A working self-host therefore always has the accounts Worker connected.

See [Auth + guest access](../specs/014-identity/auth-and-guest-access.md) for the identity model.

## Deploy

After the one-time Cloudflare setup:

```sh
git clone https://github.com/livedesign-app/livedesign.app livedesign
cd livedesign
pnpm install
pnpm build           # static export for marketing + live + help,
                     # plus the generated /licences page (no network needed)
# Then deploy each worker (run from the repo root):
pnpm --filter @livedesign/marketing exec wrangler deploy
pnpm --filter @livedesign/live exec wrangler deploy
pnpm --filter @livedesign/help exec wrangler deploy
pnpm --filter @livedesign/api exec wrangler deploy
pnpm --filter @livedesign/router exec wrangler deploy   # last, depends on the four above
```

Deploying by hand, give the editor build and the api the same build id so an open tab knows when a newer build is live ([Stale builds](../specs/016-platform/stale-builds.md)): `NEXT_PUBLIC_BUILD_ID=$(git rev-parse HEAD) pnpm build`, then `--var "BUILD_ID:$(git rev-parse HEAD)"` on the api's `wrangler deploy`. The workflow does this for you; leaving both unset only turns that detection off.

Deploy order matters: the router's service bindings reference five other workers, so it can't deploy until they exist; `live` and the optional `mcp` worker deploy after `api` (each binds to it; `live` only for link previews and works without it). The GitHub Actions deploy workflow encodes this as job dependencies.

Or just push to `main` and use the bundled GitHub Actions workflows:

- `.github/workflows/ci.yml` runs lint / format / typecheck / test / build on every PR and every push to `main`.
- `.github/workflows/codeql.yml` runs CodeQL security scanning in one job; a fork needs CodeQL default setup off.
- `.github/workflows/canvas-perf.yml` runs the canvas performance probe nightly and reports through one issue; optional, disable it in a fork that does not want it.
- `.github/workflows/deploy-reusable.yml` holds the deploy itself — build, then all six workers (marketing, live, help, api, mcp, router) in the right order. The `deploy-mcp` job always runs, so a fork without the MCP server removes it or provisions its KV namespace first. It is a reusable workflow, not directly triggerable.
- `.github/workflows/deploy.yml` calls it for **production**, **manually** from the Actions tab.
- `.github/workflows/deploy-staging.yml` calls it for **staging**, automatically, whenever CI goes green on `main`.

Self-hosting needs only the production pair: staging is a second copy of the platform the hosted deployment runs for its own rehearsals (own hostname, own Durable Objects / R2 / KV, and staging liveworkspace), and deleting `deploy-staging.yml` costs a fork nothing. Keeping it means adding the `_STAGING` secrets and staging resources from [Staging environment](../specs/016-platform/staging-environment.md); without them the workflow simply fails on every merge.

See [Deployment](../specs/016-platform/deployment.md) for the deeper deploy mechanics, including how `wrangler deploy` applies the Durable Object `[[migrations]]` tags itself, so there is no migration step before it.

Serve the editor over HTTPS (Cloudflare does by default, on `workers.dev` and on a custom domain). It also works over plain http, on a LAN address for instance: ids and hashes fall back to plain code there, and only the clipboard buttons need HTTPS ([Secure context](../specs/016-platform/secure-context.md)).

## MCP server (optional, needs sign-in)

The `apps/mcp` worker ([MCP server](../specs/015-api/mcp-server.md)) lets people connect an AI tool (Claude, any MCP
client) to drive their designs. It's **optional** — don't deploy it and nothing
else references it — and **needs sign-in**, exactly like API tokens and teams: the
OAuth consent page authenticates the user through sign-in and the api's
`/api/oauth/exchange` requires an account identity, so a guest can mint
nothing. To run it:

1. **Create a KV namespace** for OAuth state and put the id in `apps/mcp/wrangler.toml`:

   ```sh
   pnpm --filter @livedesign/mcp exec wrangler kv namespace create OAUTH_KV
   ```

2. **Point it at your hosts.** Attach your MCP hostname to the worker in the
   Cloudflare dashboard (Workers → `livedesign-mcp` → Domains & Routes → add a
   custom domain) — the same way every other worker here gets its hostname, since
   the deploy token only uploads scripts, not zone routes. Then set
   `CONSENT_BASE_URL` (in `apps/mcp/wrangler.toml`) to your live app's origin and
   `NEXT_PUBLIC_MCP_ORIGIN` (live and marketing build env) to the MCP origin, so the
   consent page posts the minted token only to your trusted host and the Build
   with AI page (`/ai`) gives AI tools your address, not the hosted one.

3. **Deploy after the api worker** (it reaches api over a service binding). The
   deploy workflow already orders `mcp` after `api`. Tokens minted via the MCP
   are ordinary `lwt_` API tokens — they appear with the account's other tokens on
   liveworkspace.app and are revocable there.

4. **Only if you've turned telemetry on:** set the same `TELEMETRY_KEY` on
   both workers — see [Telemetry](#telemetry-off-by-default-for-self-hosters)
   below. Skip it otherwise; it affects nothing else.

The MCP carries no model of its own and makes no LLM calls; the connected AI
tool does the thinking. See [MCP server](../specs/015-api/mcp-server.md).

## Telemetry: off by default for self-hosters

Telemetry is off unless you set `TELEMETRY_ENABLED = "true"` under `[vars]` in `apps/api/wrangler.toml`. OSS forks send nothing by default: the committed config leaves it unset, and the deploy workflow only adds it (with the rest of the hosted profile in `apps/api/hosted-vars.json`) when it runs in livedesign.app's own repository ([Deployment](../specs/016-platform/deployment.md) "Hosted profile"). See [Telemetry + public transparency dashboard](../specs/017-telemetry/telemetry.md).

livedesign.app's events go to liveworkspace's telemetry service, which stores them and serves the public dashboard; this repository no longer holds an ingest or a dashboard of its own. That service only takes livedesign.app's own pages and key, so turning telemetry on for a fork also means running a service of your own that takes the same batches, and pointing the fork at it: `TELEMETRY_URL` and the `TELEMETRY_KEY` secret on the api and mcp workers, and `NEXT_PUBLIC_TELEMETRY_URL` plus `NEXT_PUBLIC_TELEMETRY_ENABLED=true` on every frontend build. Without that, nothing is stored anywhere. Per-user opt-out via the Settings dialog ([User preferences](../specs/007-editor/user-preferences.md)) still overrides every app's emission when off, since they share one origin and one preferences key.

## Email (optional, Resend)

The api worker can send a small set of account emails via [Resend](https://resend.com) ([Transactional email (Resend)](../specs/014-identity/transactional-email.md)): notifications (someone opened, commented on or mentioned you in a design, or assigned you an action) plus first-share and design-count milestone notes, and the account-deleted message. Team invitations, their reminders and answers, and API-token expiry warnings are the accounts Worker's to send. The whole feature is **off until you provide a key** — no key, no sends. Addresses come from liveworkspace accounts, so email also needs sign-in configured; the onboarding series (welcome, tips, win-back) is liveworkspace's accounts Worker's, not the api's. Guests never receive email (it's authenticated-only).

To turn it on, verify a sending domain in Resend, then:

```bash
pnpm --filter @livedesign/api exec wrangler secret put RESEND_API_KEY
```

Optional knobs (plain `[vars]`):

- `RESEND_FROM`: the From identity, e.g. `livedesign <hello@livedesign.app>` (the default). Must be on your verified domain.
- `APP_BASE_URL`: public origin for links in emails, defaults to `https://livedesign.app`.

## Teams

Teams need sign-in. They are liveworkspace teams, made and run on liveworkspace.app: each access token carries the
teams its person is in, and the index grants access to team designs
([Teams](../specs/013-workspace/teams.md)). Team invitations and their emails are the accounts Worker's, so there is nothing to configure here.

## Workbenches (optional, needs sign-in)

A workbench is a developer tool that frames the editor signed in, beside an agent ([Workbench embeds](../specs/013-workspace/workbench-embeds.md)). It needs API tokens, so it exists only where sign-in is configured; without it the routes answer as for any caller without a token and nothing breaks.

- `APP_BASE_URL` (api `[vars]`): set it to your deployment's public origin. Besides the links in emails, it builds the workbench frame URLs (`/embed/workbench`, and `/embed/workbench/explorer` for the whole workspace) and the pairing URL (`/workbench/pair`) the CLI prints. Use the origin that serves the app without redirecting (for example `https://www.example.com` when the apex redirects to `www`): a workbench checks the frame's messages against the origin of that URL, and a redirect changes it. Left at its default, those links point at livedesign.app.
- `WORKBENCH_TICKET_RATE_LIMITER` (optional binding, declared in `apps/api/wrangler.toml`): caps ticket mints and pairing requests per token. Without the binding every request is allowed.
- Each person's workbench lives in their own `WorkbenchStore` Durable Object (the `WORKBENCH` binding), which comes with the deploy; there is nothing to create.

## Images

Images live in liveworkspace's media service ([liveworkspace/docs/media.md](../../../liveworkspace/docs/media.md)), which keeps the bytes, the gallery and its caps (100 images and 100 MB per person). The api worker reaches it with a `MEDIA_KEY` secret, and `MEDIA_URL` when it isn't production's. Without `MEDIA_KEY` every `/api/images*` endpoint answers 503 and the editor hides the Image entry ([Image element + per-owner gallery](../specs/009-elements/images.md) "Self-host degradation").

## Photo store cap

The api worker honours an optional `[vars]` entry, `PHOTO_MAX_BYTES_PER_TAB`: the most bytes of photo page pixels one tab may hold ([Photo store](../specs/031-photo/photo-store.md) "Limits"), answered as a 403 `{ error: "photo_full", limit, current }` on an upload past it. Photo pages store their pixels in the `PHOTO_BLOBS` bucket; without the binding every photo blob route answers 503 and photo pages are offered in Offline Mode designs only.

It defaults to "no limit" when unset, blank, `0`, or non-numeric, which is the OSS self-host default where the operator runs their own R2 budget. To cap, declare it under `[vars]` in `apps/api/wrangler.toml`, not in the Cloudflare dashboard: every `wrangler deploy` replaces the worker's plain vars with the ones it declares, so a dashboard-only cap is silently gone after the next deploy. The hosted livedesign.app sets it to `536870912` (512 MB) through its hosted profile, which a fork's deploy does not apply.

## Custom domain

Add a custom-domain route to the router worker (`apps/router/wrangler.toml`) and point your DNS at Cloudflare. The router stitches all paths under one hostname:

- `/` → marketing
- `/design/*`, `/explorer/*`, `/new`, `/join`, `/sign-in`, `/get-started`, `/embed`, `/oauth/*` → live editor (clean routes; `/live/*` carries only its `_next` assets)
- `/telemetry` → a redirect to liveworkspace's telemetry dashboard (set `TELEMETRY_DASHBOARD_URL` on the router to point it elsewhere)
- `/help` → help centre
- `/api/*` → api worker

The five downstream workers don't need their own domain; the router fans out via service bindings.

## What can break, and how to debug

- **`account not authorized` from wrangler**: the API token is missing a scope. See the token list above; most often it's missing **Account → Account Settings: Read**, which wrangler uses to look up your account.
- **`Durable Object class is not exported`**: the api worker's `wrangler.toml` references `DesignRoom` and `WorkbenchStore` as its DO classes. Both are exported from `apps/api/src/index.ts`; if you've forked + renamed one, keep the export name in step with the binding, and add a new `[[migrations]]` tag with `renamed_classes` rather than editing the existing tag.
- **Editor loads but no design opens or saves**: the api worker can't reach liveworkspace. Check that `ACCOUNTS_URL` and `API_RESOURCE` are set (without them no one has an identity), that `INDEX_ORIGIN` names your liveworkspace deployment, and that `INDEX_KEY` matches the index's `INDEX_KEY_LIVEDESIGN` (without it the design endpoints answer as missing). See [What you need from liveworkspace](#what-you-need-from-liveworkspace).
