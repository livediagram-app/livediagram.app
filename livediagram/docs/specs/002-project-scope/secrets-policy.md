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

The deploy workflow also **syncs** the sign-in values and one more of the worker secrets below from GitHub repo secrets into `wrangler secret put` on every deploy, so they rotate by editing the GitHub secret: `ACCOUNTS_URL`, `API_RESOURCE`, `ACCOUNTS_CLIENT_ID`, `ACCOUNTS_CLIENT_SECRET` and `MEDIA_KEY`. Each sync is guarded on the GitHub secret being non-empty, so a fork that sets none still deploys.

## Worker secrets in use today

Provisioned with `wrangler secret put` (production), `wrangler secret put --env staging` ([Staging environment](../016-platform/staging-environment.md) — worker secrets are per-environment, so staging's copy of a value is never production's), or `.dev.vars` (local dev, gitignored) — **never** `[vars]`, which is plain text in a public repo. Every one is optional: absent, its feature degrades rather than breaking, which is what keeps other deployments viable (see [03](open-source-and-business-model.md)).

| Secret                                          | Worker          | Absent means                                                                                                                                                                                                                 |
| ----------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ACCOUNTS_URL` / `API_RESOURCE`                 | api             | No identities at all: no sign-in and no guest tokens, so nobody can own a document on the server ([04](../014-identity/auth-and-guest-access.md))                                                                            |
| `ACCOUNTS_CLIENT_ID` / `ACCOUNTS_CLIENT_SECRET` | api             | Nobody can complete sign-in (`/api/auth/*` cannot swap a code or refresh a token)                                                                                                                                            |
| `GOOGLE_AI_STUDIO_API_KEY` / `AI_API_KEY`       | api             | The photo import reads handwriting in the browser instead ([Note reader](../021-event-storming/note-reader.md))                                                                                                              |
| `TELEMETRY_KEY`                                 | api **and** mcp | No server-side telemetry reaches the liveworkspace service ([Telemetry](../017-telemetry/telemetry.md))                                                                                                                      |
| `MEDIA_KEY`                                     | api             | Images are off: every `/api/images*` route answers 503 ([Images](../009-elements/images.md))                                                                                                                                 |
| `DRIVE_KEY`                                     | api             | liveworkspace's Drive mirror cannot export canvases as files or import them ([drive.md](../../../../liveworkspace/docs/specs/005-drive/drive.md#the-apps))                                                                   |
| `MIGRATION_KEY`                                 | api             | the one-time move from the old livediagram.app cannot write this app's parts with its own key (the index's key still opens the migration door); set only while the move runs ([migration.md](../../../../docs/migration.md)) |

`TELEMETRY_KEY` is the only one that must hold the **same value on two workers** (and on the liveworkspace telemetry service, as `TELEMETRY_KEY_LIVEDIAGRAM`). A mismatch is silent — the service simply drops the batch — so verify with `wrangler secret list` on each rather than assuming. `MEDIA_KEY` likewise matches the media service's `MEDIA_KEY_LIVEDIAGRAM`; a mismatch there is loud, as every image route answers 503. Generate it with `openssl rand -hex 32`.

Non-secret configuration (`TELEMETRY_ENABLED`, `TELEMETRY_URL`, `AI_BASE_URL`, `AI_VISION_MODEL`, `AI_*`, `MEDIA_URL`, `EMAIL_FROM`, `APP_BASE_URL`, `CONSENT_BASE_URL`) lives in `[vars]` in the relevant `wrangler.toml`, in the open, documented alongside each entry there and in the per-app `.env.example`. What only livediagram.app runs with (`TELEMETRY_ENABLED`, its liveworkspace service URLs) is equally public but lives in the hosted profile, `apps/api/hosted-vars.json`, so it is not every fork's default ([Deployment](../016-platform/deployment.md) "Hosted profile"). `COMMUNITY_ENABLED` is non-secret configuration too, but unset by default: it is only set to switch the Community off ([Community](../025-community/community.md#turning-the-community-off)), as a `[vars]` entry, a dashboard variable or a secret, and is documented in `apps/api/.env.example`.

`ACCOUNTS_CLIENT_SECRET` is the only real secret of the four: the api sends it to the accounts Worker when it swaps a sign-in code or a refresh token. `ACCOUNTS_URL`, `API_RESOURCE` and the client id are not sensitive, but are synced the same way so each environment sets its own. Access tokens are verified locally against the accounts Worker's public JWKS; the api holds no admin credential for it.

## What is "safe to publish" client-side

Some keys are designed to be public; they go in `NEXT_PUBLIC_*` vars and end up in the bundle:

- `NEXT_PUBLIC_TELEMETRY_ENABLED` — whether the editor sends anonymous usage events (a flag, not a key).
- Public URLs (`NEXT_PUBLIC_API_BASE`, etc.).

If a value's documentation calls it "public", "publishable", or "client", it's fine for client bundles.

## What must stay server-side

Never imported in client code, never bundled into the static export:

- Every secret in the table above.
- Storage access (always via a Worker; the browser never holds storage credentials).
- Any signing / encryption key.

Workers and server-only code read these from `env` bindings — not from `process.env`-style imports in shared code.

## `.env.example`

Each app or worker that needs env vars ships a `.env.example` documenting **which variables are required** with placeholder values:

```
# Required for production builds
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

## Photo bytes never leave the browser

The event-storming photo import ([Event storming](../021-event-storming/event-storming.md#import-a-photo-of-the-wall) finds the stickies in a
photograph of a physical wall **in the browser**, with classical computer
vision. The photograph itself is never uploaded: only the CROPS — one sticky
each — go to `POST /api/ai/read-notes` so the model can read the handwriting,
and the route forwards them to the provider and discards them. Nothing is
persisted anywhere: not R2, not a Durable Object, not IndexedDB, not a log
line. The browser also re-encodes every crop, which drops EXIF (including the
GPS tag) after honouring the orientation flag.

A workshop wall is somebody's unreleased strategy, and the room around it is
somebody's face. The safest place for a picture of either is the machine it was
taken on.
