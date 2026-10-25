# Secrets policy

**This repository is public.** Source code is visible to the world. Therefore:

> **No secret may ever live in source code.** No API keys, no tokens, no passwords, no OAuth client secrets, no signing keys, no service-account JSON.

This is non-negotiable. The same rule applies to README examples, test fixtures, comments, and commit history.

## Where secrets go

| Environment            | Mechanism                                                         |
| ---------------------- | ----------------------------------------------------------------- |
| Local development      | `.env.local` (gitignored) per app/worker                          |
| Cloudflare Workers     | `wrangler secret put` — never in `wrangler.toml`                  |
| Cloudflare Pages       | Project env vars in the Cloudflare dashboard                      |
| CI / Deploy            | GitHub repo secrets — see below                                   |
| Client-side JS bundles | **Only** values prefixed `NEXT_PUBLIC_*` that are safe to publish |

### GitHub Actions secrets

Required by the CI/CD pipeline (see [10-deployment.md](../016-platform/deployment.md)):

| Secret          | Purpose                                                                                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CF_API_TOKEN`  | Cloudflare API token scoped to the account that owns the workers. Required permissions: Workers Scripts:Edit, Workers Routes:Edit, Account Settings:Read, User Details:Read. Full list in [10-deployment.md](../016-platform/deployment.md). |
| `CF_ACCOUNT_ID` | Cloudflare account ID (not a secret per se, but kept in the same store).                                                                                                                                                                     |

The deploy workflow also **syncs** the sign-in values and `INDEX_KEY` below from GitHub repo secrets into `wrangler secret put` on every deploy, so they rotate by editing the GitHub secret: `ACCOUNTS_URL`, `API_RESOURCE`, `ACCOUNTS_CLIENT_ID`, `ACCOUNTS_CLIENT_SECRET` and `INDEX_KEY`. Each sync is guarded on the GitHub secret being non-empty, so an environment that sets none still deploys.

## Worker secrets in use today

Provisioned with `wrangler secret put` (production), `wrangler secret put --env staging` ([Staging environment](../016-platform/staging-environment.md) — worker secrets are per-environment, so staging's copy of a value is never production's), or `.dev.vars` (local dev, gitignored) — **never** `[vars]`, which is plain text in a public repo. Every one is optional: absent, its feature degrades rather than breaking (local dev, staging; see [03](open-source-and-business-model.md)).

| Secret                                          | Worker          | Absent means                                                                                                                                                                               |
| ----------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ACCOUNTS_URL` / `API_RESOURCE`                 | api             | Guest-only mode: nobody can sign in and no guest token can be had, so documents stay in This Browser ([04](../014-identity/auth-and-guest-access.md))                                      |
| `ACCOUNTS_CLIENT_ID` / `ACCOUNTS_CLIENT_SECRET` | api             | Nobody can complete sign-in (`/api/auth/*` cannot swap a code or refresh a token)                                                                                                          |
| `INDEX_KEY`                                     | api             | The document rooms cannot push summaries to the index, and API tokens cannot be given grants ([One Explorer](../../../../liveworkspace/docs/one-explorer-contracts.md#reaching-the-index)) |
| `TELEMETRY_KEY`                                 | api **and** mcp | The workers send no telemetry ([22](../017-telemetry/telemetry.md))                                                                                                                        |
| `MEDIA_KEY`                                     | api             | Images are off: every `/api/images*` route answers 503 ([Images](../009-elements/images.md))                                                                                               |

Email needs no secret: the api sends through Cloudflare Email Service's `send_email` binding `EMAIL`, declared in `wrangler.toml`, and without it all transactional email is inert ([64](../014-identity/transactional-email.md), [liveworkspace/docs/email.md](../../../../liveworkspace/docs/email.md)).

`TELEMETRY_KEY` is the only one that must hold the **same value on two workers** (and as liveworkspace's telemetry service's `TELEMETRY_KEY_LIVEDOCUMENTS`). A mismatch is silent — the posts are simply not stored — so verify with `wrangler secret list` on both rather than assuming. `MEDIA_KEY` likewise matches liveworkspace's media service's `MEDIA_KEY_LIVEDOCUMENTS`; a mismatch there is loud, as every image route answers 503. Generate it, and `GUEST_ID_HMAC_SECRET`, with `openssl rand -hex 32`.

Non-secret configuration (`TELEMETRY_ENABLED`, `TELEMETRY_URL`, `MEDIA_URL`, `EMAIL_FROM`, `APP_BASE_URL`, `CONSENT_BASE_URL`) lives in `[vars]` in the relevant `wrangler.toml`, in the open, documented alongside each entry there and in the per-app `.env.example`. What only livedocuments.app runs with (`TELEMETRY_ENABLED`, its liveworkspace service URLs) is equally public but lives in the hosted profile, `apps/api/hosted-vars.json`, so it is not every fork's default ([Deployment](../016-platform/deployment.md) "Hosted profile").

`ACCOUNTS_CLIENT_SECRET` is the only real secret of the four: the api sends it to the accounts Worker when it swaps a sign-in code or a refresh token. `ACCOUNTS_URL`, `API_RESOURCE` and the client id are not sensitive, but are synced the same way so each environment sets its own. Access tokens are verified locally against the accounts Worker's public JWKS; the api holds no admin credential for it.

## What is "safe to publish" client-side

Some keys are designed to be public; they go in `NEXT_PUBLIC_*` vars and end up in the bundle:

- Public URLs (`NEXT_PUBLIC_API_BASE`, etc.).

If a value's documentation calls it "public", "publishable", or "client", it's fine for client bundles.

## What must stay server-side

Never imported in client code, never bundled into the static export:

- Every secret in the table above.
- Durable Object storage (always via a Worker; the browser never holds storage credentials).
- Any signing / encryption key.

Workers and server-only code read these from `env` bindings — not from `process.env`-style imports in shared code.

## `.env.example`

Each app or worker that needs env vars ships a `.env.example` documenting **which variables are required** with placeholder values:

```
# Where the editor's api lives; empty means same-origin /api
NEXT_PUBLIC_API_BASE=
# (no secret keys here — those go in the Cloudflare dashboard)
```

`.env.local` is gitignored. `.env.example` is committed.

## If a secret leaks

1. **Rotate immediately** in the relevant provider (the accounts Worker's client secret, Cloudflare, etc.).
2. Update the secret in the env-var store (`wrangler secret put`, Pages dashboard).
3. Force-push and `git filter-repo` are **not** sufficient — rotation comes first because Git history is forever public.
4. Open a tracking note in specs (or wherever incidents live, TBD) to document what leaked, when, and what was rotated.

## Tooling (to be added)

- Pre-commit hook scanning for likely secrets (`gitleaks` or similar) — to be added when there are enough secrets in dev that scanning earns its keep.
- CI check that no `NEXT_PUBLIC_*`-bundled value matches a known secret-key prefix (e.g. `sk_`).
