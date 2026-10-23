# Self-hosting

livediagram is designed to be self-hostable end-to-end. The whole stack runs on Cloudflare Workers, so a self-hoster needs a Cloudflare account and not much else.

This guide is the practical path: provision Cloudflare resources, configure secrets, deploy. For the why-behind-the-shape, read [Deployment](../specs/016-platform/deployment.md) (deployment) and [Secrets policy](../specs/002-project-scope/secrets-policy.md) (secrets).

## What you'll provision on Cloudflare

| Resource                             | Used by           | Why                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Workers paid plan**                | All eight workers | Durable Objects (per-document realtime room) need the paid plan.                                                                                                                                                                                                                                                                           |
| **D1 database**                      | `apps/api`        | Documents, tabs, comments, folders, share links, shared-with index, image metadata, teams + membership + team library, telemetry rows. People's preferences, display names and colours are kept by the accounts Worker when sign-in is on, and in each browser otherwise.                                                                  |
| **Durable Object namespace**         | `apps/api`        | One stateful room per document for realtime presence + ops.                                                                                                                                                                                                                                                                                |
| **R2 bucket** (optional)             | `apps/api`        | Image uploads ([Image element + per-owner gallery](../specs/009-elements/images.md)) + document SVG snapshots ([Document SVG snapshots](../specs/006-document/document-snapshots.md): Explorer thumbnails + the live image share). Without it, image endpoints `503` and snapshot endpoints `404` (the Explorer row shows a generic icon). |
| **Rate Limiter bindings** (optional) | `apps/api`        | Abuse throttles: per-owner writes, plus telemetry ingest, share-code lookups, link unfurls, AI calls, API-token reads, and Community likes and reports. Any binding you don't provision falls through to "allow", so none are required.                                                                                                    |
| **Custom domain**                    | `apps/router`     | The router worker serves your hostname; downstream workers don't need their own domain.                                                                                                                                                                                                                                                    |

What you do NOT need:

- Sign-in: it is optional. Without it, every user is a guest (a per-browser id stored in `localStorage`, carried as `X-Owner-Id`). With sign-in configured, the api worker fetches the accounts Worker's public keys (`${ACCOUNTS_URL}/api/auth/jwks`) to check access tokens, and calls it when someone signs in or a session refreshes.
- No _required_ SaaS: no Stripe (no paid tier) and no analytics vendor. The other integrations are all optional and stay off until you add a key: Resend for transactional email ([Transactional & lifecycle email (Resend)](../specs/014-identity/transactional-email.md)), a model key for the event-storming photo reader ([Note reader](../specs/021-event-storming/note-reader.md)), and a Google OAuth client for the Google Drive mirror ([Google Drive mirror](../specs/022-drive-mirror/drive-mirror.md)), each covered in its own section below. The telemetry endpoint is first-party only and off by default.
- A separate database host: D1 covers everything.

## One-time Cloudflare setup

1. **Create a Cloudflare account** and sign up for the Workers paid plan ($5/mo at the time of writing).
2. **Create a D1 database**:

   ```sh
   pnpm exec wrangler d1 create livediagram
   ```

   Copy the `database_id` from the output into `apps/api/wrangler.toml` under the `[[d1_databases]]` block (it already has the binding name `DB`; you only need to update the id).

3. **Apply migrations to the new D1**:

   ```sh
   pnpm --filter @livediagram/api db:migrate:remote
   ```

   (this runs `wrangler d1 migrations apply livediagram --remote` — note it takes the database **name**, `livediagram`, not the binding name `DB`).

   This creates every table the worker expects. The same command runs in the deploy workflow on every release, so you only need it once for the first deploy.

4. **Create an R2 bucket** (optional, for images):

   ```sh
   pnpm exec wrangler r2 bucket create livediagram-images
   ```

   The bucket name is bound to `IMAGES` in `apps/api/wrangler.toml`.

5. **Get an API token + account id**:
   - Account id is at the bottom-right of any Cloudflare dashboard page.
   - API token: create one with **Workers Scripts: Edit**, **D1: Edit**, **R2: Edit** (only if using images), **Workers KV: Edit** (for Durable Objects), and **Account → Account Settings: Read** on your account. Save it.

## Required GitHub Actions secrets

If you're deploying via GitHub Actions (the default workflow), set two repo secrets:

- `CF_API_TOKEN`: the token from the step above.
- `CF_ACCOUNT_ID`: your Cloudflare account id.

Those two are the only **required** ones — the deploy workflow uses raw `pnpm exec wrangler deploy` against them. Optionally, it also syncs worker secrets from repo secrets of the same name, each skipped when unset: the four sign-in values (`ACCOUNTS_URL`, `API_RESOURCE`, `ACCOUNTS_CLIENT_ID`, `ACCOUNTS_CLIENT_SECRET`), `GUEST_ID_HMAC_SECRET`, and `TELEMETRY_KEY`. Setting them here rather than by hand means they rotate by editing the GitHub secret — and, for `TELEMETRY_KEY`, that the api and mcp workers can't drift apart. See [Secrets policy](../specs/002-project-scope/secrets-policy.md) for the full table.

## Optional sign-in

The hosted version signs people in with their liveworkspace account, through the liveworkspace accounts Worker. To enable sign-in on your self-host:

1. Register your deployment as an OAuth client of an accounts Worker. Its redirect URI is `https://<your-host>/api/auth/callback`, and it needs its own resource (the audience its access tokens carry). Register it for the app `livediagram.app` (`register-client.ts --app livediagram.app`), under which the accounts Worker keeps its settings, sign-ups and milestone emails. You get a client id and a client secret.
2. Set the values on the apps:
   - **Editor and Community (build-time, browser-side)**: set `NEXT_PUBLIC_SIGN_IN_ENABLED=true` in your CI build env, or in `apps/editor/.env.production` and `apps/community/.env.production` (Community uses it only for My Shares).
   - **API (worker secrets)**:

     ```sh
     pnpm --filter @livediagram/api exec wrangler secret put ACCOUNTS_URL
     pnpm --filter @livediagram/api exec wrangler secret put API_RESOURCE
     pnpm --filter @livediagram/api exec wrangler secret put ACCOUNTS_CLIENT_ID
     pnpm --filter @livediagram/api exec wrangler secret put ACCOUNTS_CLIENT_SECRET
     ```

     Paste each value when prompted.

3. **Teams ([Teams](../specs/013-workspace/teams.md)) need nothing extra.** Invite auto-connection matches pending invites against the verified `email` claim on the access token, which the accounts Worker always includes. The worker never trusts a client-supplied email.

4. **Recommended when sign-in is on — sign guest ids.** Set a random HMAC secret so the worker mints signed guest ids and `POST /api/migrate` requires a valid signature before moving a guest's data into an account. Without it, anyone who observed a guest's id (it appears in shared-document DTOs / presence) could claim that guest's data at sign-up. Generate and set:

   ```sh
   openssl rand -hex 32 | pnpm --filter @livediagram/api exec wrangler secret put GUEST_ID_HMAC_SECRET
   ```

   Leaving it unset keeps the legacy unsigned migrate, which is fine for a single-user self-host (no one else to claim from). See [Auth + guest access](../specs/014-identity/auth-and-guest-access.md).

   With the secret set, you can also require a valid signature on the guest `X-Owner-Id` REST path ([Public API and API tokens](../specs/015-api/public-api-and-tokens.md) §4), which closes the "observe a guest id, use it as a credential" hole for shared documents. Two plain vars in `apps/api/wrangler.toml` `[vars]` control it, and **the file ships the hosted values, so edit both for your deployment** (or delete both lines to leave enforcement off):

   - `GUEST_SIGNING_LIVE_AT`: epoch ms when your deployment first had `GUEST_ID_HMAC_SECRET`. A guest id created before it can still make its one-time upgrade onto a signed id after enforcement starts, so returning pre-signing guests keep their documents.
   - `GUEST_SIG_ENFORCE_AFTER`: epoch ms from which owner-scoped routes, the realtime room's owner leg and the upgrade itself require a valid signature.

   Arm it only on a build where every entry path signs first: before that, `/new` minted a local unsigned id, and with enforcement armed a first-time visitor who opened it could not create a document ([Public API and API tokens](../specs/015-api/public-api-and-tokens.md) §6). Every entry path now signs first, and every e2e stack runs with enforcement on, so a regression of that kind fails the suite.

   Set them in the file rather than the Cloudflare dashboard: every `wrangler deploy` replaces plain vars with the ones the file declares. Both are no-ops without `GUEST_ID_HMAC_SECRET`. `pnpm dev` blanks `GUEST_SIG_ENFORCE_AFTER`, so local guests made before your local secret keep working; every e2e stack enforces it.

5. **API tokens ([Public API and API tokens](../specs/015-api/public-api-and-tokens.md)) come with sign-in.** They're a signed-in-only feature: tokens are liveworkspace account tokens (`lwt_`), made and revoked on liveworkspace.app, and the api worker checks each one with liveworkspace. A guest-only self-host has no accounts and therefore no tokens (nothing to configure).

Without the sign-in values set, the api worker treats every request as a guest (resolves owner from `X-Owner-Id`), and the live frontend mounts no session bridge, so it renders the editor without any auth UI. Self-host without sign-in is a fully-supported path; the canvas works identically (and guest-id signing is moot, since there's no migrate without accounts). Preferences and display names are the accounts Worker's to keep, so without it they stay in each browser: Settings work and persist there, and a person's name shows to others live in the room, but a name is not stored on the server, so places that read it later (a document's owner, comment authors in the api, team members) show their placeholder instead (a team member's email address, "Anonymous" for a comment author).

See [Auth + guest access](../specs/014-identity/auth-and-guest-access.md) for the hybrid auth model.

## Deploy

After the one-time Cloudflare setup:

```sh
git clone https://github.com/livediagram-app/livediagram.app livediagram
cd livediagram
pnpm install
pnpm build           # static export for marketing + live + telemetry + help + community,
                     # plus the generated /licences page (no network needed)
# Then deploy each worker (run from the repo root):
pnpm --filter @livediagram/marketing exec wrangler deploy
pnpm --filter @livediagram/editor exec wrangler deploy
pnpm --filter @livediagram/telemetry exec wrangler deploy
pnpm --filter @livediagram/help exec wrangler deploy
pnpm --filter @livediagram/community exec wrangler deploy
pnpm --filter @livediagram/api exec wrangler deploy
pnpm --filter @livediagram/router exec wrangler deploy   # last, depends on the six above
```

Deploying by hand, give the editor build and the api the same build id so an open tab knows when a newer build is live ([Stale builds](../specs/016-platform/stale-builds.md)): `NEXT_PUBLIC_BUILD_ID=$(git rev-parse HEAD) pnpm build`, then `--var "BUILD_ID:$(git rev-parse HEAD)"` on the api's `wrangler deploy`. The workflow does this for you; leaving both unset only turns that detection off.

Deploy order matters: the router's service bindings reference six other workers, so it can't deploy until they exist; `live`, `community` and the optional `mcp` worker deploy after `api` (each binds to it; `live` and `community` only for link previews and work without it). The GitHub Actions deploy workflow encodes this as job dependencies.

Or just push to `main` and use the bundled GitHub Actions workflows:

- `.github/workflows/ci.yml` runs lint / format / typecheck / test / build on every PR and every push to `main`.
- `.github/workflows/codeql.yml` runs CodeQL security scanning in one job; a fork needs CodeQL default setup off.
- `.github/workflows/canvas-perf.yml` runs the canvas performance probe nightly and reports through one issue; optional, disable it in a fork that does not want it.
- `.github/workflows/deploy-reusable.yml` holds the deploy itself — build, then all eight workers (marketing, live, telemetry, help, community, api, mcp, router) in the right order. The `deploy-mcp` job always runs, so a fork without the MCP server removes it or provisions its KV namespace first. It is a reusable workflow, not directly triggerable.
- `.github/workflows/deploy.yml` calls it for **production**, **manually** from the Actions tab.
- `.github/workflows/deploy-staging.yml` calls it for **staging**, automatically, whenever CI goes green on `main`.

Self-hosting needs only the production pair: staging is a second copy of the platform the hosted deployment runs for its own rehearsals (own hostname, own D1 / R2 / KV), and deleting `deploy-staging.yml` costs a fork nothing. Keeping it means adding the `_STAGING` secrets and staging resources from [Staging environment](../specs/016-platform/staging-environment.md); without them the workflow simply fails on every merge.

See [Deployment](../specs/016-platform/deployment.md) for the deeper deploy mechanics, including how D1 migrations run BEFORE the worker deploy so the new code never briefly runs against the old schema.

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
   pnpm --filter @livediagram/mcp exec wrangler kv namespace create OAUTH_KV
   ```

2. **Point it at your hosts.** Attach your MCP hostname to the worker in the
   Cloudflare dashboard (Workers → `livediagram-mcp` → Domains & Routes → add a
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

Telemetry is off unless you set `TELEMETRY_ENABLED = "true"` under `[vars]` in `apps/api/wrangler.toml`. OSS forks send nothing by default: the committed config leaves it unset, and the deploy workflow only adds it (with the rest of the hosted profile in `apps/api/hosted-vars.json`) when it runs in livediagram.app's own repository ([Deployment](../specs/016-platform/deployment.md) "Hosted profile"). See [Telemetry + public transparency dashboard](../specs/017-telemetry/telemetry.md).

livediagram.app's events go to liveworkspace's telemetry service, which stores them and serves the public dashboard; this repository no longer holds an ingest or a dashboard of its own. That service only takes livediagram.app's own pages and key, so turning telemetry on for a fork also means running a service of your own that takes the same batches, and pointing the fork at it: `TELEMETRY_URL` and the `TELEMETRY_KEY` secret on the api and mcp workers, and `NEXT_PUBLIC_TELEMETRY_URL` plus `NEXT_PUBLIC_TELEMETRY_ENABLED=true` on every frontend build. Without that, nothing is stored anywhere. Per-user opt-out via the Settings dialog ([User preferences](../specs/007-editor/user-preferences.md)) still overrides every app's emission when off, since they share one origin and one preferences key.

## Photo reader: optional, needs a model key

The event-storming photo import ([Event storming](../specs/021-event-storming/event-storming.md)) finds the sticky notes in a wall photograph in the browser, then reads the handwriting on each one. Without a model key the browser reads it too, so a fork that provisions nothing still has the import and sends nothing anywhere: `GET /api/capabilities` reports `{ aiEnabled: false }` and `POST /api/ai/read-notes` returns 503. With a key, the api worker sends the crops of individual notes (never the photograph) to a hosted model, which reads handwriting markedly better ([Note reader](../specs/021-event-storming/note-reader.md)). livediagram has no in-editor AI assistant; AI tools connect through the MCP server instead.

To turn the server reader on, set the key as a worker secret:

```bash
pnpm --filter @livediagram/api exec wrangler secret put GOOGLE_AI_STUDIO_API_KEY
# or AI_API_KEY, with AI_BASE_URL + AI_VISION_MODEL as [vars].
```

The provider is inferred from WHICH key you set ([Note reader](../specs/021-event-storming/note-reader.md)): a Google AI Studio
key means Google, and `AI_API_KEY` means "anything else that speaks the OpenAI wire", which needs
`AI_BASE_URL` and `AI_VISION_MODEL` too (a local llama.cpp is `http://127.0.0.1:8080/v1`). The Google
key outranks the generic one.

Optional knobs (all plain `[vars]` in `apps/api/wrangler.toml`, the dashboard, or `.dev.vars`):

- `AI_VISION_MODEL`: the reader's model id. On Google this defaults to `gemini-2.5-flash-lite`, which reads
  handwriting better AND costs less than a bigger model (docs/research/vision/handwriting-readers.md).
  Required when using `AI_API_KEY`.
- `AI_ALLOWED_ORIGINS`: comma-separated `Origin` allow-list for `POST /api/ai/read-notes` (e.g. `https://your-host,http://localhost:3102`). Unset = no origin check. Matched verbatim, case-sensitive. `apps/api/wrangler.toml` commits livediagram.app's origins here, so a fork sets its own or deletes the line, or every reader request answers 403.
- `AI_REQUIRE_SIGN_IN`: set to `"true"` to reject the guest (`X-Owner-Id`) path on the reader only, requiring a verified access token. Unset = guests can use the server reader (so a fork without sign-in still works).

The last two are the spend-DoS defence: on a public deployment they stop a third-party site from minting fresh owner ids to drain your model budget. The hosted livediagram.app sets `AI_ALLOWED_ORIGINS` and deliberately leaves `AI_REQUIRE_SIGN_IN` unset so guests keep the server reader; a private fork, or one without sign-in, can leave both unset. A further defence lives alongside them: the `AI_RATE_LIMITER` binding (declared in `apps/api/wrangler.toml` as a Cloudflare rate-limit binding, 20 requests / 60 s per IP) caps how fast one client can drive the endpoint; absent binding falls through to "allow" so a self-host without the paid Cloudflare feature still works.

## Email (optional, Resend)

The api worker can send a small set of account emails via [Resend](https://resend.com) ([Transactional & lifecycle email (Resend)](../specs/014-identity/transactional-email.md)): notifications (someone opened, commented on or mentioned you in a document, or assigned you an action), first-share and document-count milestone notes, and the account-deleted confirmation. It needs sign-in, since the addresses are the accounts Worker's: it answers each account's verified address and keeps which milestone notes have gone. The welcome, onboarding tips and team-invite emails are the accounts Worker's own, sent once for every liveworkspace app. The whole feature is **off until you provide a key** — no key, no sends. Guests never receive email (it's authenticated-only).

To turn it on, verify a sending domain in Resend, then:

```bash
pnpm --filter @livediagram/api exec wrangler secret put RESEND_API_KEY
```

Optional knobs (plain `[vars]`):

- `RESEND_FROM`: the From identity, e.g. `livediagram <hello@livediagram.app>` (the default). Must be on your verified domain.
- `APP_BASE_URL`: public origin for links in emails, defaults to `https://livediagram.app`.

## Teams

Teams need sign-in. They are liveworkspace teams, made and run on liveworkspace.app; the api worker keeps a copy of
the ones its people are in, following liveworkspace's change feed every five minutes
([Teams](../specs/013-workspace/teams.md)). There are no team invite emails, reminders or expiry to configure here.

## Workbenches (optional, needs sign-in)

A workbench is a developer tool that frames the editor signed in, beside an agent ([Workbench embeds](../specs/013-workspace/workbench-embeds.md)). It needs API tokens, so it exists only where sign-in is configured; without it the routes answer as for any caller without a token and nothing breaks.

- `APP_BASE_URL` (api `[vars]`): set it to your deployment's public origin. Besides the links in emails, it builds the workbench frame URLs (`/embed/workbench`, and `/embed/workbench/explorer` for the whole workspace) and the pairing URL (`/workbench/pair`) the CLI prints. Use the origin that serves the app without redirecting (for example `https://www.example.com` when the apex redirects to `www`): a workbench checks the frame's messages against the origin of that URL, and a redirect changes it. Left at its default, those links point at livediagram.app.
- `WORKBENCH_TICKET_RATE_LIMITER` (optional binding, declared in `apps/api/wrangler.toml`): caps ticket mints and pairing requests per token. Without the binding every request is allowed.
- Migration `0077_workbench.sql` creates the four workbench tables; it runs with the others.

## Plan's tables

Plan mode (boards, Sheets and forms) moved to liveplanner. The migrations that made its tables (`items`, `sheets`,
`sheet_cells`, the form tables) stay in the chain and the tables stay in D1, unread; nothing needs setting up for
them, and `FORM_RATE_LIMITER` is no longer read.

## Google Drive mirror (optional, needs sign-in)

Signed-in users can mirror My Work to their own Google Drive ([Google Drive mirror](../specs/022-drive-mirror/drive-mirror.md)). It is **off until you set a Google OAuth client id**; with none, Settings has no Cloud Sync section and every `/api/drive` route answers `503 drive_not_configured`. The Drive traffic goes from each user's browser straight to Google; your worker only brokers tokens and stores a few small rows in D1.

1. In Google Cloud, create a project, enable the **Google Drive API**, and create an OAuth client of type **Web application**. Add `https://<your-host>/drive/connected` as an authorised redirect URI and `https://<your-host>` as a JavaScript origin. The consent screen needs only the non-sensitive scopes `drive.file` and `drive.install`, so no verification or security assessment is required.
2. For **Open with**, configure the Drive API's **Drive UI integration**: Open URL `https://<your-host>/drive/open`, default MIME type `application/vnd.livediagram+json`, default extension `livediagram`.
3. Set the client id on the api worker as a `[vars]` entry `GOOGLE_CLIENT_ID`, and build the editor app with the same value as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
4. For syncing without a click every hour, also set two worker secrets (without them the browser holds hour-long tokens and asks the user to **Resume sync**):

```sh
pnpm --filter @livediagram/api exec wrangler secret put GOOGLE_CLIENT_SECRET
pnpm --filter @livediagram/api exec wrangler secret put DRIVE_TOKEN_KEY   # openssl rand -base64 32
```

5. Optional: `NEXT_PUBLIC_GOOGLE_API_KEY`, a browser API key (restricted by HTTP referrer) for the Google Picker, which lets users show livediagram a folder they made in Drive. Without it the mirror works and that one step is not offered.

**More than one environment** (a staging beside production): give each its **own Google Cloud project**. A project has one Drive UI integration Open URL, so a shared project could only ever open files on one host; `drive.file` access is per project, so files stay apart; and consent screens and test users stay apart. Each environment then has its own client id (worker var and live build, the same value within an environment), client secret, `DRIVE_TOKEN_KEY` and Picker key. livediagram.app does exactly this: its client ids sit per environment in `apps/api/hosted-vars.json` (`environments.production` / `environments.staging`, empty until set, which keeps the mirror off there), its Picker keys are the `NEXT_PUBLIC_GOOGLE_API_KEY` and `NEXT_PUBLIC_GOOGLE_API_KEY_STAGING` GitHub secrets, and every deploy checks that the worker and the live build carry the same client id.

If your site redirects one host to another (livediagram.app sends the apex to `www`), register both as JavaScript origins with `/drive/connected` redirect URIs: the consent flow uses whichever host the app actually runs on.

The mirror's root folder in each user's Drive is named **`livediagram (self-hosted)`** on your deployment (livediagram.app's own is `livediagram`, its staging and local development `livediagram (staging)`), so a user of both never gets two folders of the same name. There is no setting: the name comes from the host, is given only when the folder is created, and users may rename or move it freely.

`DRIVE_TOKEN_KEY` seals the stored refresh tokens; changing it turns every connection into **Needs reconnecting**. Files a different deployment's Google project created are foreign to yours and import as copies. Your privacy policy must describe the Google user data you handle; livediagram.app's is in the help centre under Policies.

## Images

Images live in liveworkspace's media service ([liveworkspace/docs/media.md](../../../liveworkspace/docs/media.md)), which keeps the bytes, the gallery and its caps (100 images and 100 MB per person). The api worker reaches it with a `MEDIA_KEY` secret, and `MEDIA_URL` when it isn't production's. Without `MEDIA_KEY` every `/api/images*` endpoint answers 503 and the editor hides the Image entry ([Image element + per-owner gallery](../specs/009-elements/images.md) "Self-host degradation").

## Custom domain

Add a custom-domain route to the router worker (`apps/router/wrangler.toml`) and point your DNS at Cloudflare. The router stitches all paths under one hostname:

- `/` → marketing
- `/document/*`, `/explorer/*`, `/new`, `/join`, `/sign-in`, `/get-started`, `/embed`, `/sso-callback` → live editor (clean routes; `/live/*` carries only its `_next` assets)
- `/telemetry` → a redirect to liveworkspace's telemetry dashboard (edit `telemetryDashboardUrl` in the router to point it elsewhere, or drop it)
- `/help` → help centre
- `/community` → Community, the public gallery of shared documents
- `/api/*` → api worker

The Community's listings live in liveworkspace's Community service
([liveworkspace/docs/community.md](../../../liveworkspace/docs/community.md)). Without a `COMMUNITY_KEY` secret the api
reports the Community off; to have one, run that service (or use liveworkspace.app's with a key it gives you), set
the api's `COMMUNITY_URL` and `COMMUNITY_KEY`, and build the pages with `NEXT_PUBLIC_COMMUNITY_API`. To switch it off, set the api worker's `COMMUNITY_ENABLED` to
`false` (a `[vars]` entry or `wrangler secret put COMMUNITY_ENABLED`): every Community route and link closes and it
disappears from every app, with nothing deleted ([Community](../specs/025-community/community.md#turning-the-community-off)).

The six downstream workers don't need their own domain; the router fans out via service bindings.

## What can break, and how to debug

- **`account not authorized` from wrangler**: the API token is missing a scope. See the token list above; most often it's missing **Account → Account Settings: Read**, which wrangler uses to look up your account.
- **`Durable Object class is not exported`**: the api worker's `wrangler.toml` references `DocumentRoom` as the DO class. It IS exported from `apps/api/src/index.ts`; if you've forked + renamed, keep the export name in step with the binding.
- **Editor loads but every request 403s**: the resolved owner doesn't match the document's stored owner. If you migrated from one auth setup to another (added sign-in after running guest-only), the old guest documents still belong to the old guest id. The `/api/migrate` endpoint moves rows from a guest id to an account id after sign-up; see [Auth + guest access](../specs/014-identity/auth-and-guest-access.md).
