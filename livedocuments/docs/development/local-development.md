# Local development

How to run livedocuments on your machine.

## Requirements

- **Node** `>= 22` (Wrangler 4 requires it).
- **pnpm** `>= 9` (the lockfile and workspaces depend on it).

Cloudflare is not required for local development. The api worker runs locally via Wrangler against a local D1 SQLite file; the Next.js apps run via Next's dev server.

## Clone and install

```sh
git clone https://github.com/livedocuments-app/livedocuments.app livedocuments
cd livedocuments
pnpm install
```

This installs every workspace at once, including TypeScript 7 ([Contributing](contributing.md#typescript)).

## Apply the local database migrations (once, before first `pnpm dev`)

`wrangler dev` does NOT auto-apply migrations: a fresh local D1 starts empty. Run this once after cloning, and again whenever a new migration lands under `apps/api/migrations/`:

```sh
pnpm --filter @livedocuments/api db:migrate:local
```

It applies every SQL file in `apps/api/migrations/` to the local SQLite file Wrangler keeps at `apps/api/.wrangler/state/v3/d1/`. The production deploy runs the equivalent `db:migrate:remote` step automatically in CI (see [Self-hosting](../operations/self-hosting.md)).

## Run everything

```sh
pnpm dev
```

Turbo spins up all seven dev servers in parallel:

| App              | Dev URL                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `apps/router`    | `http://localhost:3200` — **everything on one port**, stitched like production                     |
| `apps/marketing` | `http://localhost:3201`                                                                            |
| `apps/live`      | `http://localhost:3202` (clean routes: /new, /explorer, ...)                                       |
| `apps/telemetry` | `http://localhost:3203/telemetry`                                                                  |
| `apps/help`      | `http://localhost:3204/help`                                                                       |
| `apps/api`       | `http://localhost:8987/api`                                                                        |
| `apps/mcp`       | `http://localhost:8988` (MCP server, [MCP server](../specs/015-api/mcp-server.md); signed-in only) |

The `router` dev server (`wrangler dev --env local`, port 3200) gives you the production URL shape locally: `/` is marketing, `/new` and `/document/*` are the editor, plus `/telemetry`, `/help` and `/api` — no per-app port to remember. It has no service bindings in dev; the `[env.local]` environment in `apps/router/wrangler.toml` points it at the localhost origins above and it proxies plain HTTP (see [Router app](../specs/016-platform/router-app.md)).

**Use port 3200 unless you have a reason not to.** Each app's own port still serves its pages, but only the router puts the API on the same origin. The frontends call `NEXT_PUBLIC_API_BASE`, defaulting to the relative `/api` — correct in production and behind the router, and a dead end on an app's own port, where nothing serves `/api` (these are static exports; there are no Next API routes, see [Architecture](architecture.md)). So the editor on `http://localhost:3202` cannot reach the api worker until you tell it where the worker is:

```sh
# apps/live/.env.local  (gitignored; see apps/live/.env.example)
NEXT_PUBLIC_API_BASE=http://localhost:8987/api
```

A remote api works too, and there are now two of them: `https://staging.livedocuments.app/api`
reaches [staging](../specs/016-platform/staging-environment.md), which has its own database and is
the one to reach for; the production api reads and writes real people's documents.

Without it the editor loads, the canvas works, and the first save fails with **“Couldn’t create the document”** — which reads like a broken api worker rather than a missing variable, so it is worth setting up front. `apps/telemetry` and `apps/help` read the same variable: the dashboard needs it to show anything on `:3003`, and the help centre only loses its telemetry posts without it. To work on the dashboard against real numbers without seeding a local database, point it at production's summary instead: `NEXT_PUBLIC_API_BASE=https://www.livedocuments.app/api` in `apps/telemetry/.env.local`. `GET /api/telemetry/summary` is public, read-only and allows any origin, and the dashboard only sends events itself when `NEXT_PUBLIC_TELEMETRY_ENABLED=true`, which local builds leave unset.

The editor works in pure-guest mode without any auth setup: `pnpm dev` and open `http://localhost:3200/new`. Documents persist to the local D1 file the api worker creates on first start. (On `http://localhost:3202/new` instead, set `NEXT_PUBLIC_API_BASE` first — see the note above.)

## Scoping commands to one workspace

```sh
pnpm --filter @livedocuments/live dev
pnpm --filter @livedocuments/api test
pnpm --filter @livedocuments/marketing build
```

Workspace names follow the pattern `@livedocuments/<app-or-package-folder-name>`.

## Useful scripts

Run from the repo root:

| Command                                                           | What it does                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                                                    | Install all workspace deps.                                                                                                                                                                                                                                                                                                                                                           |
| `pnpm dev`                                                        | Start all dev servers in parallel (`turbo run dev`).                                                                                                                                                                                                                                                                                                                                  |
| `pnpm build`                                                      | Production build across the repo (`turbo run build`).                                                                                                                                                                                                                                                                                                                                 |
| `pnpm lint`                                                       | oxlint across the repo (`turbo run lint`).                                                                                                                                                                                                                                                                                                                                            |
| `pnpm typecheck`                                                  | `tsc --noEmit` across every workspace (`turbo run typecheck`).                                                                                                                                                                                                                                                                                                                        |
| `pnpm test`                                                       | Vitest across every workspace that has tests (`turbo run test`).                                                                                                                                                                                                                                                                                                                      |
| `pnpm --filter @livedocuments/live perf:canvas`                   | The canvas performance probe ([Canvas performance](../specs/008-canvas/canvas-performance.md)): builds the 1,000-element reference board, traces every gesture at 4x CPU and writes the budget table to `apps/live/test-results/perf/`. Needs a fresh `next build`; set `E2E_LIVE_PORT` / `E2E_API_PORT` / `E2E_BASE_URL` to run beside a `pnpm dev`. Reports, never fails on a miss. |
| `pnpm --filter @livedocuments/live test:e2e`                      | Playwright end-to-end suite ([End-to-end tests](../specs/003-system-architecture/e2e-smoke.md)); reuses a running `pnpm dev` or boots its own stack. Set `E2E_WEBKIT=1` (after `npx playwright install webkit`) to also run the image import spec in WebKit.                                                                                                                          |
| `pnpm --filter @livedocuments/live test:e2e:clerk-stub`           | The signed-in specs (`apps/live/e2e/clerk-stub/`) against `.next/out-clerk-stub/`; run `pnpm --filter @livedocuments/live build:clerk-stub` first. Boots its own stack on `:3015` / `:8788` / `:3016`.                                                                                                                                                                                |
| `pnpm --filter @livedocuments/live test:e2e:armed`                | The armed guest-signature specs (`apps/live/e2e/armed/`) with guest signature enforcement on, against the guest-mode `out/`. Boots its own stack on `:3017` / `:8789` / `:3018`.                                                                                                                                                                                                      |
| `pnpm --filter @livedocuments/cli build`                          | Bundle the CLI into `apps/cli/dist/livedocuments.mjs` (see [Running the CLI from source](#running-the-cli-from-source-optional)).                                                                                                                                                                                                                                                     |
| `pnpm format`                                                     | Prettier write across the repo.                                                                                                                                                                                                                                                                                                                                                       |
| `pnpm format:check`                                               | Prettier check (this is what CI runs).                                                                                                                                                                                                                                                                                                                                                |
| `pnpm staging:check`                                              | Dry-run the `[env.staging]` wrangler configs and print the resolved bindings (CI runs it).                                                                                                                                                                                                                                                                                            |
| `pnpm licences`                                                   | Regenerate the `/licences` page data (`apps/marketing/generated/`, `public/licences/`) from what every app bundles ([Third-party licences](../specs/002-project-scope/third-party-licences.md)); the marketing build runs it itself.                                                                                                                                                  |
| `pnpm icons:vendor`                                               | Regenerate the vendored Lucide glyphs from `packages/icons/lucide-manifest.json` ([Iconography](../specs/004-interface-design/iconography.md)).                                                                                                                                                                                                                                       |
| `pnpm icons:sheet`                                                | Render every editor icon at 1x and 4x into HTML + PNG contact sheets (`$ICON_SHEET_DIR`, default `/tmp/icon-sheet`) for review.                                                                                                                                                                                                                                                       |
| `pnpm bench:stroke-points`                                        | Measure packed stroke points against the former `{ nx, ny }` shape on a synthesised board: tab bytes, allocations, parse and draw time, accuracy ([Stroke points](../specs/006-document/stroke-points.md)).                                                                                                                                                                           |
| `pnpm --filter @livedocuments/document stroke-points <file.json>` | Print a stored tab or document file with every freehand's `packedPoints` expanded into readable `{ nx, ny, p }` points (`-` reads stdin).                                                                                                                                                                                                                                             |

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

Without these set: the api worker silently treats every request as a guest (the `X-Owner-Id` header path), and the live frontend's ClerkProvider becomes a pass-through that renders the editor without any auth UI. This is the self-host default. See [Auth + guest access](../specs/014-identity/auth-and-guest-access.md) for the full hybrid model.

## Running the CLI from source (optional)

The [CLI](../specs/015-api/cli.md) acts only with an API token, so it needs a host with sign-in: enable Clerk as
above, sign in, and create a token in Settings › API Tokens. Then build the bundle and point it at the local api:

```bash
pnpm --filter @livedocuments/cli build
export LIVEDOCUMENTS_HOST=http://localhost:8987 LIVEDOCUMENTS_TOKEN=lvd_...
apps/cli/dist/livedocuments.mjs document ls
```

`LIVEDOCUMENTS_DEBUG=1` prints each decision and request as a `[cli]` line on stderr. The CLI keeps its files under
`$XDG_CONFIG_HOME/livedocuments` and `$XDG_CACHE_HOME/livedocuments` (`~/.config` and `~/.cache` by default); point
both at a scratch directory to keep a test run apart from your own sign-in.

## Running tests

```sh
pnpm test                                # everything
pnpm --filter @livedocuments/api test      # one workspace
pnpm --filter @livedocuments/live exec vitest   # watch mode while developing
```

Tests live alongside the code they cover, as `*.test.ts` / `*.test.tsx` files. The test runner is [Vitest](https://vitest.dev) with the shared config from `@livedocuments/vitest-config`. See [Testing](../specs/003-system-architecture/testing.md) for the testing contract.

Workbench embeds have an opt-in end-to-end run ([Workbench embeds](../specs/013-workspace/workbench-embeds.md)): `pnpm --filter @livedocuments/live test:e2e:workbench`. It rebuilds `apps/live/out` with the test-only session bridge (`NEXT_PUBLIC_E2E_AUTH=1`), then boots the e2e stack with `E2E_WORKBENCH=1` on its own ports (live 3021, api 8791, marketing 3022): the stack acts as Clerk (as under `E2E_CLERK_JWKS`, minting session tokens on `/e2e/token`) and gives the api worker `APP_BASE_URL=http://localhost:3021`, so its workbench and pairing URLs point at the live server. The spec serves a fake workbench (`apps/live/e2e/fixtures/fake-workbench.html`) from `127.0.0.1` on a free port, pairs it on the pairing page, and frames `/embed/workbench` in it; `workbench-workspace.spec.ts` pairs it again for the whole workspace and frames `/embed/workbench/explorer`, whose places (`/embed/workbench/explorer/**`, `/embed/workbench/document/**`) the stack serves from that one page, as the live worker does.

## Serving the editor a second time

The e2e stack (`scripts/e2e-stack.mjs`) can serve the built editor a second
time, beside a running stack:

```bash
E2E_LIVE_PORT=3402 E2E_API_PORT=8887 E2E_LIVE_ONLY=1 node scripts/e2e-stack.mjs
```

`E2E_LIVE_ONLY=1` serves the static editor only, proxying to the api already
on `E2E_API_PORT`.

`E2E_LIVE_OUT=<dir>` serves another export of the live app (the signed-in specs use
`.next/out-clerk-stub`), and `E2E_CLERK_JWKS=1` makes the stack stand in for Clerk: the api
verifies session tokens the stack mints on `/e2e/token?sub=user_…` ([End-to-end tests](../specs/003-system-architecture/e2e-smoke.md)).

## Four gotchas

- **All four Next.js dev servers (`marketing`, `live`, `telemetry`, `help`) run through `scripts/next-dev.mjs`.** It frees the port and points dev at an isolated `.next-dev/` cache, so a `next build` running in the same checkout can't corrupt the dev server (the recurring "unstyled help page" / `Cannot find module './NNNN.js'` failures). The cache is kept between starts: Turbopack's file-system cache reuses the last session's compilation (a warm start serves its first page in about a second) and reconciles a route restructure by itself, and `turbopackGc` keeps it from growing stale ([Next.js](../specs/016-platform/nextjs.md) "The Turbopack cache"). A cache that goes wrong is a bug to fix, not something to wipe away. All four run on Turbopack, which is also what `next build` uses under Next 16, so dev compiles the same way the deployed bundle does. Every app's settings come from `@livedocuments/next-config` (`livedocumentsNextConfig`), so a change to them lands in all four at once.

  `help` was pinned to webpack until the Next 16 upgrade, because Turbopack's Rust MDX pipeline ignores remark/rehype plugins handed over as imported JS functions and its pipe tables rendered as literal text. `apps/help/next.config.ts` now names `remark-gfm` as a string (`remarkPlugins: [['remark-gfm', {}]]`), which Turbopack resolves itself, so the tables survive. Keep that string form: importing the plugin back fails the build outright under Turbopack with "does not have serializable options".

  Next 16 also writes `next-env.d.ts` into whichever app you run it from, gitignored on purpose: it names the active distDir inside itself, so dev and build would otherwise rewrite it over each other, and each app's tsconfig already picks up the Next types without it being tracked. Next can also generate an `AGENTS.md` + `CLAUDE.md` pair of agent instructions; the shared config turns that off (`agentRules: false`), because the repo's agent instructions are written by hand in the root `AGENTS.md`. Any old generated pair left in an app folder stays gitignored and can be deleted.

  The webpack escape hatch is still there — `pnpm --filter @livedocuments/live dev:webpack` boots the editor on webpack, and `scripts/next-dev.mjs` honours `--webpack` from any app. It exists for the case where Turbopack genuinely doesn't support something the app needs, and it is a diagnostic rather than a default: Turbopack became the default precisely because webpack's HMR kept desynchronising here and serving `__webpack_modules__[moduleId] is not a function` until someone wiped `.next`. If you find yourself needing the hatch, that is worth a spec note rather than a habit. The editor on webpack also runs without the React Compiler, whose native Rust port is Turbopack-only ([React state and effects](../specs/003-system-architecture/react-state-and-effects.md)), so a render bug seen only on one bundler may be the compiler.

- **`/licences` needs its generated data.** `pnpm dev` does not run the generator (it takes about 20 seconds), so the marketing dev server fails that one page with `LicencesManifestMissing` until you run `pnpm licences` once. Don't run `pnpm licences` while a `next build` of the editor, help centre or telemetry dashboard is running: Next's analyzer shares an app's Turbopack build cache (`.next/cache`), and two processes on it corrupt it. `pnpm build` orders them for you.

- **The api worker's local D1 file lives at `apps/api/.wrangler/state/v3/d1/`.** Delete the folder to start over with an empty database.

- **Open the editor on `localhost`, not on the machine's LAN address.** Over plain `http` from any other address (`http://192.168.x.x:3002`, `http://<machine-name>:3002`) the browser is not in a secure context, withholds `crypto.randomUUID`, and the editor fails to load with "This page couldn't load". A known gap, not yet fixed: the editor calls `crypto.randomUUID` directly in about 75 places. Testing from a phone or a second laptop needs https (a tunnel, or a dev certificate) until it is.
