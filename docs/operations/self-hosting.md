# Self-hosting

livediagram is designed to be self-hostable end-to-end. The whole stack runs on Cloudflare Workers, so a self-hoster needs a Cloudflare account and not much else.

This guide is the practical path: provision Cloudflare resources, configure secrets, deploy. For the why-behind-the-shape, read [Deployment](../specs/016-platform/deployment.md) (deployment) and [Secrets policy](../specs/002-project-scope/secrets-policy.md) (secrets).

## What you'll provision on Cloudflare

| Resource                             | Used by           | Why                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Workers paid plan**                | All eight workers | Durable Objects (per-document realtime room) need the paid plan.                                                                                                                                                                                                                                                                           |
| **D1 database**                      | `apps/api`        | Documents, tabs, comments, folders, share links, shared-with index, image metadata, user preferences, teams + membership + team library, custom themes, telemetry rows.                                                                                                                                                                    |
| **Durable Object namespace**         | `apps/api`        | One stateful room per document for realtime presence + ops.                                                                                                                                                                                                                                                                                |
| **R2 bucket** (optional)             | `apps/api`        | Image uploads ([Image element + per-owner gallery](../specs/009-elements/images.md)) + document SVG snapshots ([Document SVG snapshots](../specs/006-document/document-snapshots.md): Explorer thumbnails + the live image share). Without it, image endpoints `503` and snapshot endpoints `404` (the Explorer row shows a generic icon). |
| **Rate Limiter bindings** (optional) | `apps/api`        | Abuse throttles: per-owner writes, plus telemetry ingest, share-code lookups, link unfurls, AI calls, API-token reads, and Community likes and reports. Any binding you don't provision falls through to "allow", so none are required.                                                                                                    |
| **Custom domain**                    | `apps/router`     | The router worker serves your hostname; downstream workers don't need their own domain.                                                                                                                                                                                                                                                    |

What you do NOT need:

- Clerk: auth is optional. Without it, every user is a guest (a per-browser id stored in `localStorage`, carried as `X-Owner-Id`). With Clerk configured, the api worker reaches `CLERK_JWKS_URL` to verify Bearer tokens — an outbound call only on the auth path.
- No _required_ SaaS: no Stripe (no paid tier) and no analytics vendor. The other integrations are all optional and stay off until you add a key: Resend for transactional email ([Transactional & lifecycle email (Resend)](../specs/014-identity/transactional-email.md)), OpenAI for the AI assistant ([AI Assistance](../specs/007-editor/ai-assistance.md)), and a Google OAuth client for the Google Drive mirror ([Google Drive mirror](../specs/022-drive-mirror/drive-mirror.md)), each covered in its own section below. The telemetry endpoint is first-party only and off by default.
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

Those two are the only **required** ones — the deploy workflow uses raw `pnpm exec wrangler deploy` against them. Optionally, it also syncs three worker secrets from repo secrets of the same name, each skipped when unset: `CLERK_JWKS_URL`, `GUEST_ID_HMAC_SECRET`, and `INTERNAL_EVENTS_KEY`. Setting them here rather than by hand means they rotate by editing the GitHub secret — and, for `INTERNAL_EVENTS_KEY`, that the api and mcp workers can't drift apart. See [Secrets policy](../specs/002-project-scope/secrets-policy.md) for the full table.

## Optional Clerk auth

The hosted version uses Clerk for sign-in. To enable on your self-host:

1. Create a Clerk application in the [Clerk dashboard](https://dashboard.clerk.com).
2. Copy the publishable key and the JWKS URL.
3. Set them on the two workers / apps:
   - **Live and Community (build-time, browser-side)**: set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in your CI build env, or in `apps/live/.env.production` and `apps/community/.env.production` (Community uses it only for My Shares).
   - **API (worker secret)**:

     ```sh
     pnpm --filter @livediagram/api exec wrangler secret put CLERK_JWKS_URL
     ```

     Paste the JWKS URL when prompted.

4. **For Teams ([Teams](../specs/013-workspace/teams.md)) — add the email claim to the session token.** Invite auto-connection matches pending invites against the verified `email` claim in the Clerk JWT, which the default session token doesn't carry. In the Clerk dashboard, customise the session token (Sessions → Customize session token) to include:

   ```json
   { "email": "{{user.primary_email_address}}" }
   ```

   Without it, teams still work (create / roles / member management), but an invited address only connects when an admin re-invites after the claim is configured; the worker never trusts a client-supplied email.

5. **Recommended when Clerk is on — sign guest ids.** Set a random HMAC secret so the worker mints signed guest ids and `POST /api/migrate` requires a valid signature before moving a guest's data into a Clerk account. Without it, anyone who observed a guest's id (it appears in shared-document DTOs / presence) could claim that guest's data at sign-up. Generate and set:

   ```sh
   openssl rand -hex 32 | pnpm --filter @livediagram/api exec wrangler secret put GUEST_ID_HMAC_SECRET
   ```

   Leaving it unset keeps the legacy unsigned migrate, which is fine for a single-user self-host (no one else to claim from). See [Auth + guest access](../specs/014-identity/auth-and-guest-access.md).

   With the secret set, you can also require a valid signature on the guest `X-Owner-Id` REST path ([Public API and API tokens](../specs/015-api/public-api-and-tokens.md) §4), which closes the "observe a guest id, use it as a credential" hole for shared documents. Two plain vars in `apps/api/wrangler.toml` `[vars]` control it, and **the file ships the hosted values, so edit both for your deployment** (or delete both lines to leave enforcement off):

   - `GUEST_SIGNING_LIVE_AT`: epoch ms when your deployment first had `GUEST_ID_HMAC_SECRET`. A guest id created before it can still make its one-time upgrade onto a signed id after enforcement starts, so returning pre-signing guests keep their documents.
   - `GUEST_SIG_ENFORCE_AFTER`: epoch ms from which owner-scoped routes, the realtime room's owner leg and the upgrade itself require a valid signature.

   Arm it only on a build where every entry path signs first: before that, `/new` minted a local unsigned id, and with enforcement armed a first-time visitor who opened it could not create a document ([Public API and API tokens](../specs/015-api/public-api-and-tokens.md) §6). Every entry path now signs first, and every e2e stack runs with enforcement on, so a regression of that kind fails the suite.

   Set them in the file rather than the Cloudflare dashboard: every `wrangler deploy` replaces plain vars with the ones the file declares. Both are no-ops without `GUEST_ID_HMAC_SECRET`. `pnpm dev` blanks `GUEST_SIG_ENFORCE_AFTER`, so local guests made before your local secret keep working; every e2e stack enforces it.

6. **API tokens ([Public API and API tokens](../specs/015-api/public-api-and-tokens.md)) come with Clerk.** They're a signed-in-only feature, so a self-host with Clerk configured gets the API Tokens category in Settings automatically; a guest-only self-host has no accounts and therefore no tokens (nothing to configure). Each token lasts six months and is stored hashed.

7. **Optional — "Continue with Google" button.** To surface Google OAuth on `/sign-in` and `/get-started`, enable the Google SSO connection in the Clerk dashboard (a production `pk_live_*` instance needs your own Google Cloud OAuth client registered against Clerk's redirect URI, `https://clerk.<domain>/v1/oauth_callback`, shown verbatim in the dashboard), then set the build-time flag on the live app alongside the publishable key:

   ```sh
   NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true
   ```

   Like the publishable key it's baked in at build time (CI env or `apps/live/.env.production`). It's gated on Clerk being configured, so it's a no-op in guest-only mode. Unset keeps just the email-code sign-in.

Without the Clerk vars set, the api worker treats every request as a guest (resolves owner from `X-Owner-Id`), and the live frontend's ClerkProvider becomes a pass-through that renders the editor without any auth UI. Self-host without Clerk is a fully-supported path; the canvas works identically (and guest-id signing is moot, since there's no migrate without Clerk accounts).

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
pnpm --filter @livediagram/live exec wrangler deploy
pnpm --filter @livediagram/telemetry exec wrangler deploy
pnpm --filter @livediagram/help exec wrangler deploy
pnpm --filter @livediagram/community exec wrangler deploy
pnpm --filter @livediagram/api exec wrangler deploy
pnpm --filter @livediagram/router exec wrangler deploy   # last, depends on the six above
```

Deploying by hand, give the editor build and the api the same build id so an open tab knows when a newer build is live ([Stale builds](../specs/016-platform/stale-builds.md)): `NEXT_PUBLIC_BUILD_ID=$(git rev-parse HEAD) pnpm build`, then `--var "BUILD_ID:$(git rev-parse HEAD)"` on the api's `wrangler deploy`. The workflow does this for you; leaving both unset only turns that detection off.

Deploy order matters: the router's service bindings reference six other workers, so it can't deploy until they exist; the optional `mcp` worker deploys after `api` (it binds to it). The GitHub Actions deploy workflow encodes this as job dependencies.

Or just push to `main` and use the bundled GitHub Actions workflows:

- `.github/workflows/ci.yml` runs lint / format / typecheck / test / build on every PR and push.
- `.github/workflows/codeql.yml` runs CodeQL security scanning in one job; a fork needs CodeQL default setup off.
- `.github/workflows/canvas-perf.yml` runs the canvas performance probe nightly and reports through one issue; optional, disable it in a fork that does not want it.
- `.github/workflows/deploy-reusable.yml` holds the deploy itself — build, then all eight workers (marketing, live, telemetry, help, community, api, mcp, router) in the right order. It is a reusable workflow, not directly triggerable.
- `.github/workflows/deploy.yml` calls it for **production**, **manually** from the Actions tab.
- `.github/workflows/deploy-staging.yml` calls it for **staging**, automatically, whenever CI goes green on `main`.

Self-hosting needs only the production pair: staging is a second copy of the platform the hosted deployment runs for its own rehearsals (own hostname, own D1 / R2 / KV), and deleting `deploy-staging.yml` costs a fork nothing. Keeping it means adding the `_STAGING` secrets and staging resources from [Staging environment](../specs/016-platform/staging-environment.md); without them the workflow simply fails on every merge.

See [Deployment](../specs/016-platform/deployment.md) for the deeper deploy mechanics, including how D1 migrations run BEFORE the worker deploy so the new code never briefly runs against the old schema.

## MCP server (optional, needs Clerk)

The `apps/mcp` worker ([MCP server](../specs/015-api/mcp-server.md)) lets people connect an AI tool (Claude, any MCP
client) to drive their documents. It's **optional** — don't deploy it and nothing
else references it — and **needs Clerk**, exactly like API tokens and teams: the
OAuth consent page authenticates the user via Clerk and the api's
`/api/oauth/exchange` requires a Clerk identity, so a no-auth self-host can mint
nothing. To run it:

1. **Create a KV namespace** for OAuth state and put the id in `apps/mcp/wrangler.toml`:

   ```sh
   pnpm --filter @livediagram/mcp exec wrangler kv namespace create OAUTH_KV
   ```

2. **Point it at your hosts.** Attach your MCP hostname to the worker in the
   Cloudflare dashboard (Workers → `livediagram-mcp` → Domains & Routes → add a
   custom domain) — the same way every other worker here gets its hostname, since
   the deploy token only uploads scripts, not zone routes. Then set
   `CONSENT_BASE_URL` (in `apps/mcp/wrangler.toml`) to your live app's origin and
   `NEXT_PUBLIC_MCP_ORIGIN` (live build env) to the MCP origin, so the consent
   page posts the minted token only to your trusted host.

3. **Deploy after the api worker** (it reaches api over a service binding). The
   deploy workflow already orders `mcp` after `api`. Tokens minted via the MCP
   are ordinary `lvd_` API tokens — they appear in the API Tokens category of
   Settings and are revocable there.

4. **Only if you've turned telemetry on:** set the same `INTERNAL_EVENTS_KEY` on
   both workers — see [Telemetry](#telemetry-off-by-default-for-self-hosters)
   below. Skip it otherwise; it affects nothing else.

The MCP carries no model of its own and makes no LLM calls; the connected AI
tool does the thinking. See [MCP server](../specs/015-api/mcp-server.md).

## Telemetry: off by default for self-hosters

The api worker's telemetry ingest (`/api/events`) is off unless you set `TELEMETRY_ENABLED = "true"` under `[vars]` in `apps/api/wrangler.toml`. OSS forks ingest nothing by default: the committed config leaves it unset, and the deploy workflow only adds it (with the rest of the hosted profile in `apps/api/hosted-vars.json`) when it runs in livediagram.app's own repository ([Deployment](../specs/016-platform/deployment.md) "Hosted profile"). If you DO turn it on, the public `/telemetry` dashboard renders aggregate counts from your own D1; there's no third-party analytics involved. See [Telemetry + public transparency dashboard](../specs/017-telemetry/telemetry.md).

Turning telemetry on end-to-end takes BOTH the server gate above AND a build-time gate on the frontends. The api flag is the authoritative gate (ingest + summary refuse to serve without it), but every emitting frontend (the editor, the help centre, the Community, and the page-view counters on marketing and the dashboard, [Page view telemetry](../specs/017-telemetry/page-view-telemetry.md)) also reads `NEXT_PUBLIC_TELEMETRY_ENABLED` at build time and skips emission entirely when it isn't `"true"`. So a fork that only flips the api flag will see "ingest on" but no events flow. To turn it fully on, set `NEXT_PUBLIC_TELEMETRY_ENABLED=true` in your CI build env (or each frontend's `.env.production`) alongside the api flag. The `/telemetry` dashboard's data has no client-side gate of its own: it just reads `/api/telemetry/summary`, and the api worker returns an empty `enabled: false` payload until you flip `TELEMETRY_ENABLED` (the build flag only governs its own page-view count). Per-user opt-out via the Settings dialog ([User preferences](../specs/007-editor/user-preferences.md)) still overrides every app's emission when off, since they share one origin and one preferences key.

If you also deploy the MCP worker, set the **same** `INTERNAL_EVENTS_KEY` secret on both `apps/api` and `apps/mcp` (`wrangler secret put INTERNAL_EVENTS_KEY` in each). The MCP worker reaches the api over a service binding, which carries no `CF-Connecting-IP`, so without a matching key its telemetry lands in the anonymous per-IP rate-limit bucket and throttles itself. Leaving it unset is safe and needs no configuration — you just get the shared-bucket behaviour.

## AI assistance: off by default, needs an OpenAI key

The in-editor AI panel ([AI Assistance](../specs/007-editor/ai-assistance.md)) is hidden entirely unless the api worker has a model key. Forks that don't want it provision nothing and get zero AI surface: `GET /api/capabilities` reports `{ aiEnabled: false }`, `POST /api/ai` returns 503, and the editor never renders the toggle or panel.

To turn it on, set the key as a worker secret:

```bash
# One key serves every AI feature:
pnpm --filter @livediagram/api exec wrangler secret put GOOGLE_AI_STUDIO_API_KEY
# or OPENAI_API_KEY, or AI_API_KEY (with AI_BASE_URL + AI_MODEL as [vars]).
# Set both named keys to split them: the assistant on OpenAI, the reader on Google.
```

Optional knobs (all plain `[vars]` in `apps/api/wrangler.toml`, the dashboard, or `.dev.vars`):

The provider is inferred from WHICH key you set ([AI Assistance](../specs/007-editor/ai-assistance.md)): a Google AI Studio
key means Google, an OpenAI key means OpenAI, and `AI_API_KEY` means "anything
else that speaks the OpenAI wire" — which needs `AI_BASE_URL` too (a local
llama.cpp is `http://127.0.0.1:8080/v1`). Each AI feature picks its own
provider from the keys you set: the assistant prefers OpenAI, the sticky-note
reader prefers Google, each falling back to whichever key exists, and
`AI_API_KEY` is used only when neither named key is set.

- `AI_MODEL`: the assistant's model, overriding its preset default
  (`gemini-3.6-flash` for Google, `gpt-4o` for OpenAI). The reader uses it
  too when both features run on the same provider. Required when using
  `AI_API_KEY`.
- `AI_VISION_MODEL`: model id for reading sticky-note crops
  (`POST /api/ai/read-notes`, [Event storming](../specs/021-event-storming/event-storming.md)). On Google this defaults to
  `gemini-2.5-flash-lite` rather than the assistant's model — it reads
  handwriting better AND costs less (docs/research/vision/handwriting-readers.md). On a
  single provider, setting `AI_MODEL` moves the reader too unless you set this.
- `AI_ALLOWED_ORIGINS`: comma-separated `Origin` allow-list for `POST /api/ai` (e.g. `https://your-host,http://localhost:3002`). Unset = no origin check. Matched verbatim, case-sensitive.
- `AI_REQUIRE_CLERK`: set to `"true"` to reject the guest (`X-Owner-Id`) path on `/api/ai` only, requiring a verified Clerk JWT. Unset = guests can use AI (so a Clerk-less fork still works).

The last two are the spend-DoS defence: on a public deployment they stop a third-party site from minting fresh owner ids to drain your OpenAI budget. The hosted livediagram.app sets both; a private or Clerk-less fork can leave them unset. Two further defences live alongside them: the `AI_RATE_LIMITER` binding (declared in `apps/api/wrangler.toml` as a Cloudflare rate-limit binding, 20 requests / 60 s per IP) caps how fast one client can drive the endpoint; absent binding falls through to "allow" so a self-host without the paid Cloudflare feature still works. AI is also per-user opt-in via the Settings dialog even once the key is present.

## Email (optional, Resend)

The api worker can send a small set of account emails via [Resend](https://resend.com) ([Transactional & lifecycle email (Resend)](../specs/014-identity/transactional-email.md)): a welcome on first sign-in, week-1 (Explorer) and week-2 (Teams) onboarding tips off the daily cron, plus transactional team-invite and account-deleted messages. The whole feature is **off until you provide a key** — no key, no sends, and the `email_lifecycle` table is never touched. Guests never receive email (it's authenticated-only).

To turn it on, verify a sending domain in Resend, then:

```bash
pnpm --filter @livediagram/api exec wrangler secret put RESEND_API_KEY
```

Optional knobs (plain `[vars]`):

- `RESEND_FROM`: the From identity, e.g. `livediagram <hello@livediagram.app>` (the default). Must be on your verified domain.
- `APP_BASE_URL`: public origin for links in emails, defaults to `https://livediagram.app`.

If you enable this on a deployment that already has signed-in users, run the one-time backfill in [Transactional & lifecycle email (Resend) §4](../specs/014-identity/transactional-email.md) first, so existing users aren't "welcomed" on their next sign-in.

## Google Drive mirror (optional, needs Clerk)

Signed-in users can mirror My documents to their own Google Drive ([Google Drive mirror](../specs/022-drive-mirror/drive-mirror.md)). It is **off until you set a Google OAuth client id**; with none, Settings has no Cloud Sync section and every `/api/drive` route answers `503 drive_not_configured`. The Drive traffic goes from each user's browser straight to Google; your worker only brokers tokens and stores a few small rows in D1.

1. In Google Cloud, create a project, enable the **Google Drive API**, and create an OAuth client of type **Web application**. Add `https://<your-host>/drive/connected` as an authorised redirect URI and `https://<your-host>` as a JavaScript origin. The consent screen needs only the non-sensitive scopes `drive.file` and `drive.install`, so no verification or security assessment is required.
2. For **Open with**, configure the Drive API's **Drive UI integration**: Open URL `https://<your-host>/drive/open`, default MIME type `application/vnd.livediagram+json`, default extension `livediagram`.
3. Set the client id on the api worker as a `[vars]` entry `GOOGLE_CLIENT_ID`, and build the live app with the same value as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
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

## Per-owner image gallery caps

The api worker honours two optional `[vars]` that cap how much one owner can keep in the image gallery ([Image element + per-owner gallery](../specs/009-elements/images.md)), surfaced as a 403 `{ error: "gallery_full", reason, limit, current }` on `POST /api/images`:

- `IMAGE_MAX_PER_OWNER`: maximum image rows per owner (decimal string).
- `IMAGE_MAX_BYTES_PER_OWNER`: maximum summed `byte_size` per owner (decimal byte count).
- `IMAGE_MAX_PER_NETWORK_DAY` and `IMAGE_MAX_BYTES_PER_NETWORK_DAY`: images and stored bytes per caller network (IPv4 address, IPv6 /64) per UTC day, whatever identity uploads them, so uploading under many guest ids buys nothing. Over either, 429 `{ error: "upload_limit_reached" }`. Hosted: `2000` and `1073741824` (1 GiB). The network is stored only as a keyed hash, for at most two days.

Both default to "no limit" when unset, blank, `0`, or non-numeric, which is the OSS self-host default where the operator runs their own R2 budget. To cap, declare them under `[vars]` in `apps/api/wrangler.toml`, not in the Cloudflare dashboard: every `wrangler deploy` replaces the worker's plain vars with the ones it declares, so a dashboard-only cap is silently gone after the next deploy. The hosted livediagram.app sets them to `100` and `104857600` (100 MB) through its hosted profile, which a fork's deploy does not apply. The worker also honours an early `X-Image-Sha256` dedupe check sent by the live editor: if the header matches an existing row at `(owner, sha256)` the upload short-circuits before the body parse, the cap check, or the R2 write, so re-uploading bytes the user already has costs almost nothing.

## Custom domain

Add a custom-domain route to the router worker (`apps/router/wrangler.toml`) and point your DNS at Cloudflare. The router stitches all paths under one hostname:

- `/` → marketing
- `/document/*`, `/explorer/*`, `/new`, `/join`, `/sign-in`, `/get-started`, `/embed`, `/sso-callback` → live editor (clean routes; `/live/*` carries only its `_next` assets)
- `/telemetry` → telemetry dashboard
- `/help` → help centre
- `/community` → Community, the public gallery of shared documents
- `/api/*` → api worker

The Community is on by default and needs nothing. To switch it off, set the api worker's `COMMUNITY_ENABLED` to
`false` (a `[vars]` entry or `wrangler secret put COMMUNITY_ENABLED`): every Community route and link closes and it
disappears from every app, with nothing deleted ([Community](../specs/025-community/community.md#turning-the-community-off)).

The six downstream workers don't need their own domain; the router fans out via service bindings.

## What can break, and how to debug

- **`account not authorized` from wrangler**: the API token is missing a scope. See the token list above; most often it's missing **Account → Account Settings: Read**, which wrangler uses to look up your account.
- **`Durable Object class is not exported`**: the api worker's `wrangler.toml` references `DocumentRoom` as the DO class. It IS exported from `apps/api/src/index.ts`; if you've forked + renamed, keep the export name in step with the binding.
- **Editor loads but every request 403s**: the resolved owner doesn't match the document's stored owner. If you migrated from one auth setup to another (added Clerk after running guest-only), the old guest documents still belong to the old guest id. The `/api/migrate` endpoint moves rows from a guest id to a Clerk userId after sign-up; see [Auth + guest access](../specs/014-identity/auth-and-guest-access.md).
