# Local development

How to run livediagram on your machine.

## Requirements

- **Node** `>= 22` (Wrangler 4 requires it).
- **pnpm** `>= 9` (the lockfile and workspaces depend on it).

Cloudflare is not required for local development. The api worker runs locally via Wrangler against a local D1 SQLite file; the Next.js apps run via Next's dev server.

## Clone and install

```sh
git clone https://github.com/livediagram-app/monorepo livediagram
cd livediagram
pnpm install
```

This installs every workspace at once.

## Apply the local database migrations (once, before first `pnpm dev`)

`wrangler dev` does NOT auto-apply migrations: a fresh local D1 starts empty. Run this once after cloning, and again whenever a new migration lands under `apps/api/migrations/`:

```sh
pnpm --filter @livediagram/api db:migrate:local
```

It applies every SQL file in `apps/api/migrations/` to the local SQLite file Wrangler keeps at `apps/api/.wrangler/state/v3/d1/`. The production deploy runs the equivalent `db:migrate:remote` step automatically in CI (see [Self-hosting](self-hosting.md)).

## Run everything

```sh
pnpm dev
```

Turbo spins up all four dev servers in parallel:

| App              | Dev URL                                                             |
| ---------------- | ------------------------------------------------------------------- |
| `apps/marketing` | `http://localhost:3001`                                             |
| `apps/live`      | `http://localhost:3002` (clean routes: /new, /explorer/recent, ...) |
| `apps/telemetry` | `http://localhost:3003/telemetry`                                   |
| `apps/api`       | `http://localhost:8787/api`                                         |

The `router` app has no dev server: it's a one-file production worker holding service bindings, not application logic. In dev you call each app on its own port.

The editor works in pure-guest mode without any auth setup: `pnpm dev` and open `http://localhost:3002/new`. Diagrams persist to the local D1 file the api worker creates on first start.

## Scoping commands to one workspace

```sh
pnpm --filter @livediagram/live dev
pnpm --filter @livediagram/api test
pnpm --filter @livediagram/marketing build
```

Workspace names follow the pattern `@livediagram/<app-or-package-folder-name>`.

## Useful scripts

Run from the repo root:

| Command             | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `pnpm install`      | Install all workspace deps.                                      |
| `pnpm dev`          | Start all dev servers in parallel (`turbo run dev`).             |
| `pnpm build`        | Production build across the repo (`turbo run build`).            |
| `pnpm lint`         | ESLint across the repo (`turbo run lint`).                       |
| `pnpm typecheck`    | `tsc --noEmit` across every workspace (`turbo run typecheck`).   |
| `pnpm test`         | Vitest across every workspace that has tests (`turbo run test`). |
| `pnpm format`       | Prettier write across the repo.                                  |
| `pnpm format:check` | Prettier check (this is what CI runs).                           |

Turbo caches results, so re-running with no changes is a no-op.

## Enabling Clerk auth locally (optional)

The editor works without Clerk. To exercise the signed-in code paths:

1. Create a Clerk application in the [Clerk dashboard](https://dashboard.clerk.com).
2. Copy the **publishable key** and the **JWKS URL**.
3. Drop them into the two env files:

   ```sh
   # apps/live/.env.local (gitignored)
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

   # apps/api/.dev.vars (gitignored)
   CLERK_JWKS_URL=https://<your-instance>.clerk.accounts.dev/.well-known/jwks.json
   ```

4. Restart `pnpm dev`.

To also show the **"Continue with Google"** button on `/sign-in` and `/get-started`, enable the Google SSO connection in the Clerk dashboard (dev instances can use Clerk's shared Google credentials with no Google Cloud setup) and add to `apps/live/.env.local`:

```sh
NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true
```

It only takes effect when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is also set, and like any `NEXT_PUBLIC_*` change it needs a `pnpm dev` restart to bake in. Leave it unset to keep just the email-code flow.

With these set the editor's sign-in flow at `/sign-in` becomes functional. The api worker verifies the Bearer JWT and derives the owner id from the `sub` claim instead of falling back to the `X-Owner-Id` header.

Without these set: the api worker silently treats every request as a guest (the `X-Owner-Id` header path), and the live frontend's ClerkProvider becomes a pass-through that renders the editor without any auth UI. This is the self-host default. See [spec/04](../specs/04-auth-and-guest-access.md) for the full hybrid model.

## Enabling AI assistance locally (optional)

The AI panel (spec/25) is hidden entirely unless the api worker has an OpenAI key. To turn it on locally:

```sh
# apps/api/.dev.vars (gitignored)
OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o   # optional; defaults to gpt-4o
```

Restart `pnpm dev`. `GET /api/capabilities` will start reporting `{ aiEnabled: true }`, the Settings dialog grows an "AI Assistant" toggle, and the editor surfaces the panel once the user opts in. The two spend-DoS knobs `AI_ALLOWED_ORIGINS` and `AI_REQUIRE_CLERK` are hosted-only by default; leave them unset locally so the guest path keeps working. See `apps/api/.env.example` for the full set of vars the worker reads.

## Running tests

```sh
pnpm test                                # everything
pnpm --filter @livediagram/api test      # one workspace
pnpm --filter @livediagram/live exec vitest   # watch mode while developing
```

Tests live alongside the code they cover, as `*.test.ts` / `*.test.tsx` files. The test runner is [Vitest](https://vitest.dev) with the shared config from `@livediagram/vitest-config`. See [spec/18](../specs/18-testing.md) for the testing contract.

## Two gotchas

- **Don't run `pnpm build` while `pnpm dev` is alive on `apps/live`.** They both write to `apps/live/.next/` and race on `_buildManifest.tmp.*`. The dev server uses `.next-dev/` to avoid the collision in most cases, but anything invoking `next build` from the same checkout (a CI-style `pnpm build` at the repo root, for instance) will still trip. Stop `dev`, run `build`, restart `dev`.
- **The api worker's local D1 file lives at `apps/api/.wrangler/state/v3/d1/`.** Delete the folder to start over with an empty database.
