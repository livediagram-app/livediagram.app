# Secrets policy

**This repository is public.** Source code is visible to the world. Therefore:

> **No secret may ever live in source code.** No API keys, no tokens, no passwords, no OAuth client secrets, no signing keys, no service-account JSON.

This is non-negotiable. The same rule applies to README examples, test fixtures, comments, and commit history.

## Where secrets go

| Environment             | Mechanism                                              |
| ----------------------- | ------------------------------------------------------ |
| Local development       | `.env.local` (gitignored) per app/worker               |
| Cloudflare Workers      | `wrangler secret put` — never in `wrangler.toml`       |
| Cloudflare Pages        | Project env vars in the Cloudflare dashboard           |
| CI                      | Repo secrets in the CI provider                        |
| Client-side JS bundles  | **Only** values prefixed `NEXT_PUBLIC_*` that are safe to publish |

## What is "safe to publish" client-side

Some keys are designed to be public; they go in `NEXT_PUBLIC_*` vars and end up in the bundle:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publishable key.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe publishable key.
- Public URLs (`NEXT_PUBLIC_API_URL`, etc.).

If a value's documentation calls it "public", "publishable", or "client", it's fine for client bundles.

## What must stay server-side

Never imported in client code, never bundled into the static export:

- Clerk **secret** key.
- Stripe **secret** key.
- Resend API key.
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

1. **Rotate immediately** in the relevant provider (Clerk, Stripe, Cloudflare, etc.).
2. Update the secret in the env-var store (`wrangler secret put`, Pages dashboard).
3. Force-push and `git filter-repo` are **not** sufficient — rotation comes first because Git history is forever public.
4. Open a tracking note in specs (or wherever incidents live, TBD) to document what leaked, when, and what was rotated.

## Tooling (to be added)

- Pre-commit hook scanning for likely secrets (`gitleaks` or similar) — to be added when there are enough secrets in dev that scanning earns its keep.
- CI check that no `NEXT_PUBLIC_*`-bundled value matches a known secret-key prefix (e.g. `sk_`, Resend's `re_`).
