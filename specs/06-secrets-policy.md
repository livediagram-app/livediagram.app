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

Required by the CI/CD pipeline (see [10-deployment.md](10-deployment.md)):

| Secret          | Purpose                                                                                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CF_API_TOKEN`  | Cloudflare API token scoped to the account that owns the workers. Required permissions: Workers Scripts:Edit, D1:Edit, Workers Routes:Edit, Account Settings:Read, User Details:Read. Full list in [10-deployment.md](10-deployment.md). |
| `CF_ACCOUNT_ID` | Cloudflare account ID (not a secret per se, but kept in the same store).                                                                                                                                                                 |

The deploy workflow also **syncs** two of the worker secrets below from GitHub repo secrets into `wrangler secret put` on every deploy, so they rotate by editing the GitHub secret: `CLERK_JWKS_URL` and `GUEST_ID_HMAC_SECRET`. Each sync step is guarded on the GitHub secret being non-empty, so a fork that sets neither still deploys.

## Worker secrets in use today

Provisioned with `wrangler secret put` (production) or `.dev.vars` (local dev, gitignored) — **never** `[vars]`, which is plain text in a public repo. Every one is optional: absent, its feature degrades rather than breaking, which is what keeps self-hosting viable (see [03](03-open-source-and-business-model.md)).

| Secret                 | Worker          | Absent means                                                                                 |
| ---------------------- | --------------- | -------------------------------------------------------------------------------------------- |
| `CLERK_JWKS_URL`       | api             | Pure-guest mode: `X-Owner-Id` is trusted exclusively ([04](04-auth-and-guest-access.md))     |
| `GUEST_ID_HMAC_SECRET` | api             | Legacy unsigned guest ids; `/api/migrate` accepts any id ([04](04-auth-and-guest-access.md)) |
| `OPENAI_API_KEY`       | api             | The AI surface hides entirely ([25](25-ai-assistance.md))                                    |
| `RESEND_API_KEY`       | api             | All transactional + lifecycle email is inert ([64](64-transactional-email.md))               |
| `INTERNAL_EVENTS_KEY`  | api **and** mcp | MCP telemetry falls back to the shared anonymous rate-limit bucket ([22](22-telemetry.md))   |

`INTERNAL_EVENTS_KEY` is the only one that must hold the **same value on two workers**. A mismatch is silent — the caller simply lands back in the throttled bucket — so verify with `wrangler secret list` on both rather than assuming. Generate it, and `GUEST_ID_HMAC_SECRET`, with `openssl rand -hex 32`.

Non-secret configuration (`TELEMETRY_ENABLED`, `OPENAI_MODEL`, `AI_*`, `IMAGE_MAX_*`, `RESEND_FROM`, `APP_BASE_URL`, `CONSENT_BASE_URL`) lives in `[vars]` in the relevant `wrangler.toml`, in the open, documented alongside each entry there and in the per-app `.env.example`.

`CLERK_SECRET_KEY` is **not** used: the api verifies session JWTs against the public JWKS and makes no Clerk Admin API calls.

## What is "safe to publish" client-side

Some keys are designed to be public; they go in `NEXT_PUBLIC_*` vars and end up in the bundle:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publishable key.
- Public URLs (`NEXT_PUBLIC_API_BASE`, etc.).

If a value's documentation calls it "public", "publishable", or "client", it's fine for client bundles.

## What must stay server-side

Never imported in client code, never bundled into the static export:

- Every secret in the table above.
- D1 database access (always via a Worker; the browser never holds DB credentials).
- Any signing / encryption key.

Workers and server-only code read these from `env` bindings — not from `process.env`-style imports in shared code.

## `.env.example`

Each app or worker that needs env vars ships a `.env.example` documenting **which variables are required** with placeholder values:

```
# Required for production builds
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
# (no secret keys here — those go in the Cloudflare dashboard)
```

`.env.local` is gitignored. `.env.example` is committed.

## If a secret leaks

1. **Rotate immediately** in the relevant provider (Clerk, Cloudflare, etc.).
2. Update the secret in the env-var store (`wrangler secret put`, Pages dashboard).
3. Force-push and `git filter-repo` are **not** sufficient — rotation comes first because Git history is forever public.
4. Open a tracking note in specs (or wherever incidents live, TBD) to document what leaked, when, and what was rotated.

## Tooling (to be added)

- Pre-commit hook scanning for likely secrets (`gitleaks` or similar) — to be added when there are enough secrets in dev that scanning earns its keep.
- CI check that no `NEXT_PUBLIC_*`-bundled value matches a known secret-key prefix (e.g. `sk_`, Resend's `re_`).
