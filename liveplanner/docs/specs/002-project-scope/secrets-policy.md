# Secrets policy

The repository is private, but source code is copied to every machine, CI runner and tool that builds it, and its history is permanent. Therefore:

> **No secret may ever live in source code.** No API keys, no tokens, no passwords, no OAuth client secrets, no signing keys, no service-account JSON.

This is non-negotiable. The same rule applies to README examples, test fixtures, comments, and commit history.

## Where secrets go

| Environment            | Mechanism                                                          |
| ---------------------- | ------------------------------------------------------------------ |
| Local development      | `.dev.vars` (Workers) or `.env.local` (Next apps), both gitignored |
| Cloudflare Workers     | `wrangler secret put`, never in `wrangler.toml`                    |
| CI / Deploy            | The one repository secret, `CLOUDFLARE_API_TOKEN` (below)          |
| Client-side JS bundles | **Only** values prefixed `NEXT_PUBLIC_*` that are safe to publish  |

### The deploy credential

The root workflows hold one repository secret, **`CLOUDFLARE_API_TOKEN`**: a token for the liveworkspace Cloudflare
account with Workers Scripts and D1 edit rights ([Deployment](../016-platform/deployment.md#credentials-and-secrets)).
Every `wrangler.toml` pins the account id, which is an identifier, not a secret. Deploys write code and plain vars
only; they never write a Worker secret.

## Worker secrets

Provisioned with `wrangler secret put` (production), `wrangler secret put --env staging` ([Staging environment](../016-platform/staging-environment.md): worker secrets are per environment, so staging's copy of a value is never production's), or `.dev.vars` (local dev, gitignored), and **never** `[vars]`, which is plain text in source. Every one is optional: absent, its feature degrades rather than breaking, which keeps local development and previews working without them (see [Business model + licence](business-model-and-licence.md)).

| Secret                                          | Worker          | Absent means                                                                                                                                                                                                     |
| ----------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ACCOUNTS_URL` / `API_RESOURCE`                 | api             | Guest-only mode: nobody can sign in and no guest token can be had, so plans stay in This Browser ([Auth and guest access](../014-identity/auth-and-guest-access.md))                                             |
| `ACCOUNTS_CLIENT_ID` / `ACCOUNTS_CLIENT_SECRET` | api             | Nobody can complete sign-in (`/api/auth/*` cannot swap a code or refresh a token)                                                                                                                                |
| `INDEX_KEY`                                     | api             | The plan rooms cannot push summaries to the index, and API tokens cannot be given grants ([One Explorer](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md#reaching-the-index))           |
| `MEDIA_KEY`                                     | api             | liveworkspace's media service cannot draw the plans' previews through the export door, and a purge leaves a plan's previews to lapse ([previews.md](../../../../liveworkspace/docs/specs/006-media/previews.md)) |
| `DRIVE_KEY`                                     | api             | liveworkspace's Drive mirror cannot export plans as files or import them ([drive.md](../../../../liveworkspace/docs/specs/005-drive/drive.md#the-apps))                                                          |
| `DATA_EXPORT_KEY`                               | api             | liveworkspace's data export cannot read plans' boards, Sheets and comments ([data-export.md](../../../../liveworkspace/docs/specs/003-accounts/data-export.md))                                                  |
| `MIGRATION_KEY`                                 | api             | The migrate tool cannot open the migration door with its own key (the index's key still opens it); set only while a migration runs ([migration.md](../../../../docs/migration.md))                               |
| `TELEMETRY_KEY`                                 | api **and** mcp | The workers send no telemetry ([Telemetry](../017-telemetry/telemetry.md))                                                                                                                                       |

`TELEMETRY_KEY` is the only one that must hold the **same value on two workers** (and as liveworkspace's telemetry service's `TELEMETRY_KEY_LIVEPLANNER`). A mismatch is silent (the posts are simply not stored), so verify with `wrangler secret list` on both rather than assuming. Generate it with `openssl rand -hex 32`.

Email has no secret at all: the api sends through Cloudflare Email Service's `send_email` binding, `EMAIL`, which is the credential ([Transactional email](../014-identity/transactional-email.md), [liveworkspace/docs/specs/003-accounts/email.md](../../../../liveworkspace/docs/specs/003-accounts/email.md)). Without the binding, all transactional email is inert.

Non-secret configuration (`EMAIL_FROM`, `INDEX_ORIGIN`, `MEDIA_URL`, `OAUTH_ISSUER`, the mcp worker's `CONSENT_BASE_URL`) lives in `[vars]` in the relevant `wrangler.toml`, in plain text, documented alongside each entry there and in the per-app `.env.example`. What only liveplanner.app runs with (`TELEMETRY_ENABLED`, and per environment `APP_BASE_URL` and `TELEMETRY_URL`) is equally non-secret but lives in the hosted profile, `apps/api/hosted-vars.json`, so it is not every environment's default ([Deployment](../016-platform/deployment.md) "Hosted profile").

`ACCOUNTS_CLIENT_SECRET` is the only real secret of the four: the api sends it to the accounts Worker when it swaps a sign-in code or a refresh token. `ACCOUNTS_URL`, `API_RESOURCE` and the client id are not sensitive, but are synced the same way so each environment sets its own. Access tokens are verified locally against the accounts Worker's public JWKS; the api holds no admin credential for it.

## What is "safe to publish" client-side

Some keys are designed to be public; they go in `NEXT_PUBLIC_*` vars and end up in the bundle:

- Public URLs (`NEXT_PUBLIC_API_BASE`, etc.).

If a value's documentation calls it "public", "publishable", or "client", it's fine for client bundles.

## What must stay server-side

Never imported in client code, never bundled into the static export:

- Every secret in the table above.
- Stored data (each plan's Durable Object, liveworkspace's services) is reached only through a Worker; the browser never holds storage credentials.
- Any signing / encryption key.

Workers and server-only code read these from `env` bindings, not from `process.env`-style imports in shared code.

## `.env.example`

The apps that read env vars ship a `.env.example` (`apps/editor`, `apps/mcp`) documenting each variable with an
example value and no secret. `.env.local` and `.dev.vars` are gitignored; `.env.example` is committed.

## If a secret leaks

1. **Rotate immediately** in the relevant provider (the accounts Worker's client secret, Cloudflare, and so on).
2. Set the new value on each Worker that holds it (`wrangler secret put`, with `--env staging` for staging).
3. Force-push and `git filter-repo` are **not** sufficient: rotation comes first because Git history is permanent.
4. Record what leaked, when, and what was rotated.
