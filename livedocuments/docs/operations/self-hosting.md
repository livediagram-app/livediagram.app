# Self-hosting

livedocuments is designed to be self-hostable end-to-end. The whole stack runs on Cloudflare Workers, so a self-hoster needs a Cloudflare account and not much else.

This guide is the practical path: provision Cloudflare resources, configure secrets, deploy. For the why-behind-the-shape, read [Deployment](../specs/016-platform/deployment.md) (deployment) and [Secrets policy](../specs/002-project-scope/secrets-policy.md) (secrets).

## What you'll provision on Cloudflare

| Resource                             | Used by           | Why                                                                                                                                                                                                                                                                        |
| ------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Workers paid plan**                | All seven workers | Durable Objects (per-document realtime room) need the paid plan.                                                                                                                                                                                                           |
| **Durable Object namespaces**        | `apps/api`        | One SQLite-backed object per document (`DocumentRoom`: its content, tabs, comments, changesets and image references, and its realtime room) and one per person (`WorkbenchStore`: their workbench pairings, tickets and sessions). Each makes its own schema on first use. |
| **Rate Limiter bindings** (optional) | `apps/api`        | Abuse throttles: per-owner writes, plus the CLI's telemetry relay, share-code lookups, link unfurls, AI calls and API-token reads. Any binding you don't provision falls through to "allow", so none are required.                                                         |
| **Custom domain**                    | `apps/router`     | The router worker serves your hostname; downstream workers don't need their own domain.                                                                                                                                                                                    |

What you do NOT need:

- Sign-in: it is optional. Without it there are no accounts and no guest identity either (guests are liveworkspace guest tokens): documents stay in This Browser, and shared documents open through their links. With sign-in configured, the api worker fetches the accounts Worker's public keys (`${ACCOUNTS_URL}/api/auth/jwks`) to check access tokens, and calls it when someone signs in or a session refreshes.
- No _required_ SaaS: no Stripe (no paid tier) and no analytics vendor. The other integration is optional and stays off until you add a key: Resend for transactional email ([Transactional email (Resend)](../specs/014-identity/transactional-email.md)), covered in its own section below. The telemetry endpoint is first-party only and off by default.
- A database: the api worker keeps its data in Durable Objects.

## One-time Cloudflare setup

1. **Create a Cloudflare account** and sign up for the Workers paid plan ($5/mo at the time of writing).
2. **No database to create.** The api worker has no D1 database and no migrations: its data lives in the Durable Objects declared in `apps/api/wrangler.toml` (`new_sqlite_classes`), which make their own schema on first use. Where documents are filed, who may open them, teams, the Trash and API tokens are liveworkspace's (the index at `INDEX_ORIGIN`, reached with `INDEX_KEY`, and the accounts Worker); without `INDEX_KEY` no document opens.

3. **No bucket to create.** Uploaded images and a document's previews (its Explorer thumbnail, live image and share card) are liveworkspace's media service's ([Previews](../../../liveworkspace/docs/previews.md)); the api draws a document for it on request through the export door, with `MEDIA_KEY`.

4. **Get an API token + account id**:
   - Account id is at the bottom-right of any Cloudflare dashboard page.
   - API token: create one with **Workers Scripts: Edit**, **Workers KV: Edit** (for Durable Objects), and **Account → Account Settings: Read** on your account. Save it.

## Required GitHub Actions secrets

If you're deploying via GitHub Actions (the default workflow), set two repo secrets:

- `CF_API_TOKEN`: the token from the step above.
- `CF_ACCOUNT_ID`: your Cloudflare account id.

Those two are the only **required** ones — the deploy workflow uses raw `pnpm exec wrangler deploy` against them. Optionally, it also syncs worker secrets from repo secrets of the same name, each skipped when unset: the four sign-in values (`ACCOUNTS_URL`, `API_RESOURCE`, `ACCOUNTS_CLIENT_ID`, `ACCOUNTS_CLIENT_SECRET`), `INDEX_KEY`, `TELEMETRY_KEY` and `MEDIA_KEY` ([Images](#images)). Setting them here rather than by hand means they rotate by editing the GitHub secret — and, for `TELEMETRY_KEY`, that the api and mcp workers can't drift apart. See [Secrets policy](../specs/002-project-scope/secrets-policy.md) for the full table.

## Optional sign-in

The hosted version signs people in with their liveworkspace account, through the liveworkspace accounts Worker. To enable sign-in on your self-host:

1. Register your deployment as an OAuth client of an accounts Worker. Its redirect URI is `https://<your-host>/api/auth/callback`, and it needs its own resource (the audience its access tokens carry). You get a client id and a client secret.
2. Set the values on the two apps:
   - **Live (build-time, browser-side)**: set `NEXT_PUBLIC_SIGN_IN_ENABLED=true` in your CI build env, or in `apps/editor/.env.production`.
   - **API (worker secrets)**:

     ```sh
     pnpm --filter @livedocuments/api exec wrangler secret put ACCOUNTS_URL
     pnpm --filter @livedocuments/api exec wrangler secret put API_RESOURCE
     pnpm --filter @livedocuments/api exec wrangler secret put ACCOUNTS_CLIENT_ID
     pnpm --filter @livedocuments/api exec wrangler secret put ACCOUNTS_CLIENT_SECRET
     ```

     Paste each value when prompted.

3. **Teams ([Teams](../specs/013-workspace/teams.md)) need nothing extra.** Invite auto-connection matches pending invites against the verified `email` claim on the access token, which the accounts Worker always includes. The worker never trusts a client-supplied email.

4. **API tokens ([Public API and API tokens](../specs/015-api/public-api-and-tokens.md)) come with sign-in.** They're a signed-in-only feature: tokens are liveworkspace account tokens (`lwt_`), made and revoked on liveworkspace.app, and the api worker checks each one with liveworkspace. A guest-only self-host has no accounts and therefore no tokens (nothing to configure).

Without the sign-in values set, no Bearer verifies, so the api worker answers every request as a link visitor's, and the live frontend mounts no session bridge, so it renders the editor without any auth UI. Self-host without sign-in is a supported path: the canvas works identically, documents stay in This Browser, and shared documents open through their links.

See [Auth + guest access](../specs/014-identity/auth-and-guest-access.md) for the hybrid auth model.

## Deploy

After the one-time Cloudflare setup:

```sh
git clone https://github.com/livedocuments-app/livedocuments.app livedocuments
cd livedocuments
pnpm install
pnpm build           # static export for marketing + live + help,
                     # plus the generated /licences page (no network needed)
# Then deploy each worker (run from the repo root):
pnpm --filter @livedocuments/marketing exec wrangler deploy
pnpm --filter @livedocuments/editor exec wrangler deploy
pnpm --filter @livedocuments/help exec wrangler deploy
pnpm --filter @livedocuments/api exec wrangler deploy
pnpm --filter @livedocuments/router exec wrangler deploy   # last, depends on the four above
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

Self-hosting needs only the production pair: staging is a second copy of the platform the hosted deployment runs for its own rehearsals (own hostname, own Durable Objects / KV), and deleting `deploy-staging.yml` costs a fork nothing. Keeping it means adding the `_STAGING` secrets and staging resources from [Staging environment](../specs/016-platform/staging-environment.md); without them the workflow simply fails on every merge.

See [Deployment](../specs/016-platform/deployment.md) for the deeper deploy mechanics, including the order the workers deploy in.

Serve the editor over HTTPS (Cloudflare does by default, on `workers.dev` and on a custom domain). It also works over plain http, on a LAN address for instance: ids and hashes fall back to plain code there, and only the clipboard buttons need HTTPS ([Secure context](../specs/016-platform/secure-context.md)).

## MCP server (optional, needs sign-in)

The `apps/mcp` worker ([MCP server](../specs/015-api/mcp-server.md)) lets people connect an AI tool (Claude, any MCP
client) to drive their documents. It's **optional** — don't deploy it and nothing
else references it — and **needs sign-in**, exactly like API tokens and teams: the
OAuth consent page authenticates the user through sign-in and the api's
`/api/oauth/exchange` requires an account identity, so a no-auth self-host can mint
nothing. To run it:

1. **Create a KV namespace** for OAuth state and put the id in `apps/mcp/wrangler.toml`:

   ```sh
   pnpm --filter @livedocuments/mcp exec wrangler kv namespace create OAUTH_KV
   ```

2. **Point it at your hosts.** Attach your MCP hostname to the worker in the
   Cloudflare dashboard (Workers → `livedocuments-mcp` → Domains & Routes → add a
   custom domain) — the same way every other worker here gets its hostname, since
   the deploy token only uploads scripts, not zone routes. Then set
   `CONSENT_BASE_URL` (in `apps/mcp/wrangler.toml`) to your editor app's origin and
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

Telemetry is off unless you set `TELEMETRY_ENABLED = "true"` under `[vars]` in `apps/api/wrangler.toml`. OSS forks send nothing by default: the committed config leaves it unset, and the deploy workflow only adds it (with the rest of the hosted profile in `apps/api/hosted-vars.json`) when it runs in livedocuments.app's own repository ([Deployment](../specs/016-platform/deployment.md) "Hosted profile"). See [Telemetry + public transparency dashboard](../specs/017-telemetry/telemetry.md).

livedocuments.app's events go to liveworkspace's telemetry service, which stores them and serves the public dashboard; this repository no longer holds an ingest or a dashboard of its own. That service only takes livedocuments.app's own pages and key, so turning telemetry on for a fork also means running a service of your own that takes the same batches, and pointing the fork at it: `TELEMETRY_URL` and the `TELEMETRY_KEY` secret on the api and mcp workers, and `NEXT_PUBLIC_TELEMETRY_URL` plus `NEXT_PUBLIC_TELEMETRY_ENABLED=true` on every frontend build. Without that, nothing is stored anywhere. Per-user opt-out via the Settings dialog ([User preferences](../specs/007-editor/user-preferences.md)) still overrides every app's emission when off, since they share one origin and one preferences key.

## Email (optional, Resend)

The api worker can send a small set of account emails via [Resend](https://resend.com) ([Transactional email (Resend)](../specs/014-identity/transactional-email.md)): notifications (someone opened, commented on or mentioned you in a document, assigned you an action, or answered your team invite) plus first-share and document-count milestone notes; and transactional team-invite (with a Decline link that needs no account), team-invite reminder (1, 7 and 21 days after an unanswered invite) and account-deleted messages. The whole feature is **off until you provide a key** — no key, no sends. It also needs liveworkspace accounts (sign-in configured with client credentials): addresses, milestone claims and notification settings live there, so without it there is no address to send to. Guests never receive email (it's authenticated-only). The onboarding series (welcome, tips, win-back) is sent by liveworkspace's accounts Worker, not by livedocuments.

To turn it on, verify a sending domain in Resend, then:

```bash
pnpm --filter @livedocuments/api exec wrangler secret put RESEND_API_KEY
```

Optional knobs (plain `[vars]`):

- `RESEND_FROM`: the From identity, e.g. `livedocuments <hello@livedocuments.app>` (the default). Must be on your verified domain.
- `APP_BASE_URL`: public origin for links in emails, defaults to `https://livedocuments.app`.

## Teams

Teams need sign-in. They are liveworkspace teams, made and run on liveworkspace.app; the api worker reads a person's
teams from their token's `teams` claim and keeps no copy ([Teams](../specs/013-workspace/teams.md)). There are no team invite emails, reminders or expiry to configure here.

## Workbenches (optional, needs sign-in)

A workbench is a developer tool that frames the editor signed in, beside an agent ([Workbench embeds](../specs/013-workspace/workbench-embeds.md)). It needs API tokens, so it exists only where sign-in is configured; without it the routes answer as for any caller without a token and nothing breaks.

- `APP_BASE_URL` (api `[vars]`): set it to your deployment's public origin. Besides the links in emails, it builds the workbench frame URLs (`/embed/workbench`, and `/embed/workbench/explorer` for the whole workspace) and the pairing URL (`/workbench/pair`) the CLI prints. Use the origin that serves the app without redirecting (for example `https://www.example.com` when the apex redirects to `www`): a workbench checks the frame's messages against the origin of that URL, and a redirect changes it. Left at its default, those links point at livedocuments.app.
- `WORKBENCH_TICKET_RATE_LIMITER` (optional binding, declared in `apps/api/wrangler.toml`): caps ticket mints and pairing requests per token. Without the binding every request is allowed.
- Each person's workbench is their own Durable Object (`WORKBENCH`, declared in `apps/api/wrangler.toml`); its alarm checks their tokens with liveworkspace and sweeps spent rows, so there is nothing to schedule.

## Images

Images live in liveworkspace's media service ([liveworkspace/docs/media.md](../../../liveworkspace/docs/media.md)), which keeps the bytes, the gallery and its caps (100 images and 100 MB per person). The api worker reaches it with a `MEDIA_KEY` secret, and `MEDIA_URL` when it isn't production's. Without `MEDIA_KEY` every `/api/images*` endpoint answers 503 and the editor hides the Image entry ([Image element + per-owner gallery](../specs/009-elements/images.md) "Self-host degradation").

## Custom domain

Add a custom-domain route to the router worker (`apps/router/wrangler.toml`) and point your DNS at Cloudflare. The router stitches all paths under one hostname:

- `/` → marketing
- `/document/*`, `/explorer/*`, `/new`, `/join`, `/sign-in`, `/get-started`, `/embed`, `/sso-callback` → live editor (clean routes; `/live/*` carries only its `_next` assets)
- `/telemetry` → a redirect to liveworkspace's telemetry dashboard (set `TELEMETRY_DASHBOARD_URL` on the router to point it elsewhere)
- `/help` → help centre
- `/api/*` → api worker

The five downstream workers don't need their own domain; the router fans out via service bindings.

## What can break, and how to debug

- **`account not authorized` from wrangler**: the API token is missing a scope. See the token list above; most often it's missing **Account → Account Settings: Read**, which wrangler uses to look up your account.
- **`Durable Object class is not exported`**: the api worker's `wrangler.toml` references `DocumentRoom` as the DO class. It IS exported from `apps/api/src/index.ts`; if you've forked + renamed, keep the export name in step with the binding.
- **Editor loads but every request 403s**: the resolved owner doesn't match the document's stored owner. A guest's documents belong to their guest id until they sign in, when liveworkspace's index moves them to the account; see [Auth + guest access](../specs/014-identity/auth-and-guest-access.md).
