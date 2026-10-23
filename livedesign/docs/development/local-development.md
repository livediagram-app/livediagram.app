# Local development

How to run livedesign on your machine.

## Requirements

- **Node** `>= 22` (Wrangler 4 requires it).
- **pnpm** `>= 9` (the lockfile and workspaces depend on it).

Cloudflare is not required for local development. The api worker runs locally via Wrangler against a local D1 SQLite file; the Next.js apps run via Next's dev server.

## Clone and install

```sh
git clone https://github.com/livedesign-app/livedesign.app livedesign
cd livedesign
pnpm install
```

This installs every workspace at once, including TypeScript 7 ([Contributing](contributing.md#typescript)).

## Apply the local database migrations (once, before first `pnpm dev`)

`wrangler dev` does NOT auto-apply migrations: a fresh local D1 starts empty. Run this once after cloning, and again whenever a new migration lands under `apps/api/migrations/`:

```sh
pnpm --filter @livedesign/api db:migrate:local
```

It applies every SQL file in `apps/api/migrations/` to the local SQLite file Wrangler keeps at `apps/api/.wrangler/state/v3/d1/`. The production deploy runs the equivalent `db:migrate:remote` step automatically in CI (see [Self-hosting](../operations/self-hosting.md)).

## Run everything

```sh
pnpm dev
```

Turbo spins up all seven dev servers in parallel:

| App              | Dev URL                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `apps/router`    | `http://localhost:3400` — **everything on one port**, stitched like production                     |
| `apps/marketing` | `http://localhost:3401`                                                                            |
| `apps/live`      | `http://localhost:3402` (clean routes: /new, /explorer, ...)                                       |
| `apps/telemetry` | `http://localhost:3403/telemetry`                                                                  |
| `apps/help`      | `http://localhost:3404/help`                                                                       |
| `apps/api`       | `http://localhost:8989/api`                                                                        |
| `apps/mcp`       | `http://localhost:8990` (MCP server, [MCP server](../specs/015-api/mcp-server.md); signed-in only) |

The `router` dev server (`wrangler dev --env local`, port 3200) gives you the production URL shape locally: `/` is marketing, `/new` and `/design/*` are the editor, plus `/telemetry`, `/help` and `/api` — no per-app port to remember. It has no service bindings in dev; the `[env.local]` environment in `apps/router/wrangler.toml` points it at the localhost origins above and it proxies plain HTTP (see [Router app](../specs/016-platform/router-app.md)).

**Use port 3200 unless you have a reason not to.** Each app's own port still serves its pages, but only the router puts the API on the same origin. The frontends call `NEXT_PUBLIC_API_BASE`, defaulting to the relative `/api` — correct in production and behind the router, and a dead end on an app's own port, where nothing serves `/api` (these are static exports; there are no Next API routes, see [Architecture](architecture.md)). So the editor on `http://localhost:3402` cannot reach the api worker until you tell it where the worker is:

```sh
# apps/live/.env.local  (gitignored; see apps/live/.env.example)
NEXT_PUBLIC_API_BASE=http://localhost:8989/api
```

A remote api works too, and there are now two of them: `https://staging.livedesign.app/api`
reaches [staging](../specs/016-platform/staging-environment.md), which has its own database and is
the one to reach for; the production api reads and writes real people's designs.

Without it the editor loads, the canvas works, and the first save fails with **“Couldn’t create the design”** — which reads like a broken api worker rather than a missing variable, so it is worth setting up front. `apps/telemetry` and `apps/help` read the same variable: the dashboard needs it to show anything on `:3103`, and the help centre only loses its telemetry posts without it. To work on the dashboard against real numbers without seeding a local database, point it at production's summary instead: `NEXT_PUBLIC_API_BASE=https://www.livedesign.app/api` in `apps/telemetry/.env.local`. `GET /api/telemetry/summary` is public, read-only and allows any origin, and the dashboard only sends events itself when `NEXT_PUBLIC_TELEMETRY_ENABLED=true`, which local builds leave unset.

The editor works in pure-guest mode without any auth setup: `pnpm dev` and open `http://localhost:3400/new`. Designs persist to the local D1 file the api worker creates on first start. (On `http://localhost:3402/new` instead, set `NEXT_PUBLIC_API_BASE` first — see the note above.)

## Scoping commands to one workspace

```sh
pnpm --filter @livedesign/live dev
pnpm --filter @livedesign/api test
pnpm --filter @livedesign/marketing build
```

Workspace names follow the pattern `@livedesign/<app-or-package-folder-name>`.

## Useful scripts

Run from the repo root:

| Command                                                      | What it does                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                                               | Install all workspace deps.                                                                                                                                                                                                                                                                                                                                                           |
| `pnpm dev`                                                   | Start all dev servers in parallel (`turbo run dev`).                                                                                                                                                                                                                                                                                                                                  |
| `pnpm build`                                                 | Production build across the repo (`turbo run build`).                                                                                                                                                                                                                                                                                                                                 |
| `pnpm lint`                                                  | oxlint across the repo (`turbo run lint`).                                                                                                                                                                                                                                                                                                                                            |
| `pnpm typecheck`                                             | `tsc --noEmit` across every workspace (`turbo run typecheck`).                                                                                                                                                                                                                                                                                                                        |
| `pnpm test`                                                  | Vitest across every workspace that has tests (`turbo run test`).                                                                                                                                                                                                                                                                                                                      |
| `pnpm --filter @livedesign/live perf:canvas`                 | The canvas performance probe ([Canvas performance](../specs/008-canvas/canvas-performance.md)): builds the 1,000-element reference board, traces every gesture at 4x CPU and writes the budget table to `apps/live/test-results/perf/`. Needs a fresh `next build`; set `E2E_LIVE_PORT` / `E2E_API_PORT` / `E2E_BASE_URL` to run beside a `pnpm dev`. Reports, never fails on a miss. |
| `pnpm --filter @livedesign/live test:e2e`                    | Playwright end-to-end suite ([End-to-end tests](../specs/003-system-architecture/e2e-smoke.md)); reuses a running `pnpm dev` or boots its own stack. Set `E2E_WEBKIT=1` (after `npx playwright install webkit`) to also run the image import spec in WebKit.                                                                                                                          |
| `pnpm --filter @livedesign/live test:e2e:signed-in`          | The signed-in specs (`apps/live/e2e/signed-in/`) against `.next/out-signed-in/`; run `pnpm --filter @livedesign/live build:signed-in` first. Boots its own stack on `:3315` / `:8998` / `:3316`.                                                                                                                                                                                      |
| `pnpm --filter @livedesign/live test:e2e:armed`              | The armed guest-signature specs (`apps/live/e2e/armed/`) with guest signature enforcement on, against the guest-mode `out/`. Boots its own stack on `:3117` / `:8789` / `:3118`.                                                                                                                                                                                                      |
| `pnpm --filter @livedesign/cli build`                        | Bundle the CLI into `apps/cli/dist/livedesign.mjs` (see [Running the CLI from source](#running-the-cli-from-source-optional)).                                                                                                                                                                                                                                                        |
| `pnpm format`                                                | Prettier write across the repo.                                                                                                                                                                                                                                                                                                                                                       |
| `pnpm format:check`                                          | Prettier check (this is what CI runs).                                                                                                                                                                                                                                                                                                                                                |
| `pnpm staging:check`                                         | Dry-run the `[env.staging]` wrangler configs and print the resolved bindings (CI runs it).                                                                                                                                                                                                                                                                                            |
| `pnpm licences`                                              | Regenerate the `/licences` page data (`apps/marketing/generated/`, `public/licences/`) from what every app bundles ([Third-party licences](../specs/002-project-scope/third-party-licences.md)); the marketing build runs it itself.                                                                                                                                                  |
| `pnpm icons:vendor`                                          | Regenerate the vendored Lucide glyphs from `packages/icons/lucide-manifest.json` ([Iconography](../specs/004-interface-design/iconography.md)).                                                                                                                                                                                                                                       |
| `pnpm icons:sheet`                                           | Render every editor icon at 1x and 4x into HTML + PNG contact sheets (`$ICON_SHEET_DIR`, default `/tmp/icon-sheet`) for review.                                                                                                                                                                                                                                                       |
| `pnpm bench:stroke-points`                                   | Measure packed stroke points against the former `{ nx, ny }` shape on a synthesised board: tab bytes, allocations, parse and draw time, accuracy ([Stroke points](../specs/006-design/stroke-points.md)).                                                                                                                                                                             |
| `pnpm --filter @livedesign/design stroke-points <file.json>` | Print a stored tab or design file with every freehand's `packedPoints` expanded into readable `{ nx, ny, p }` points (`-` reads stdin).                                                                                                                                                                                                                                               |

Turbo caches results, so re-running with no changes is a no-op.

## Enabling sign-in locally (optional)

The editor works without sign-in. To exercise the signed-in code paths, run liveworkspace beside it and register livedesign with its accounts API:

1. Start liveworkspace (first-time setup is in `liveworkspace/README.md`, "Local development"): `pnpm dev:workspace` from the repo root runs the site, with the sign-in pages, on `http://localhost:3000`, and the accounts and telemetry Workers behind it, as liveworkspace.app has them. Locally the accounts Worker prints each sign-in code in its own output instead of emailing it.
2. Register livedesign once against it. `http://localhost/api` is the one resource a development accounts Worker issues tokens for (`RESOURCES` in liveworkspace/apps/accounts/src/resources.ts). The secret is printed once:

   ```sh
   ADMIN_TOKEN=local-admin-token node liveworkspace/apps/accounts/scripts/register-client.ts \
     --accounts http://localhost:3000 \
     --name livedesign-dev \
     --redirect http://localhost:3300/api/auth/callback \
     --resource http://localhost/api
   ```

3. Drop the values into the two env files:

   ```sh
   # apps/live/.env.local (gitignored)
   NEXT_PUBLIC_SIGN_IN_ENABLED=true

   # apps/api/.dev.vars (gitignored)
   ACCOUNTS_URL=http://localhost:3000
   API_RESOURCE=http://localhost/api
   ACCOUNTS_CLIENT_ID=...
   ACCOUNTS_CLIENT_SECRET=...
   AUTH_ORIGIN=http://localhost:3300
   ```

4. Restart `pnpm dev` and open the app through the router (`http://localhost:3300`), so the sign-in cookies and the callback share one origin.

With these set, `/sign-in` hands off to the accounts site and comes back signed in. The api worker verifies the access token and derives the owner id from the `sub` claim instead of falling back to the `X-Owner-Id` header.

Without these set: the api worker silently treats every request as a guest (the `X-Owner-Id` header path), and the live frontend mounts no session bridge, so it renders the editor without any auth UI. This is the self-host default. See [Auth + guest access](../specs/014-identity/auth-and-guest-access.md) for the full hybrid model.

## Running the CLI from source (optional)

The [CLI](../specs/015-api/cli.md) acts only with an API token, so it needs a host with sign-in: enable sign-in as
above, sign in, and create a token in Settings › API Tokens. Then build the bundle and point it at the local api:

```bash
pnpm --filter @livedesign/cli build
export LIVEDESIGN_HOST=http://localhost:8989 LIVEDESIGN_TOKEN=lvd_...
apps/cli/dist/livedesign.mjs design ls
```

`LIVEDESIGN_DEBUG=1` prints each decision and request as a `[cli]` line on stderr. The CLI keeps its files under
`$XDG_CONFIG_HOME/livedesign` and `$XDG_CACHE_HOME/livedesign` (`~/.config` and `~/.cache` by default); point
both at a scratch directory to keep a test run apart from your own sign-in.

## Enabling AI assistance locally (optional)

The AI panel ([AI Assistance](../specs/007-editor/ai-assistance.md)) is hidden entirely unless the api worker has a model key. To turn it on locally:

```sh
# apps/api/.dev.vars (gitignored).
OPENAI_API_KEY=...             # or GOOGLE_AI_STUDIO_API_KEY=...
# AI_API_KEY=...               # any other OpenAI-compatible provider, used only when
# AI_BASE_URL=http://127.0.0.1:8080/v1  # neither named key is set; needs both of these
# AI_MODEL=gpt-4o              # the assistant's model; optional for the named keys
```

Restart `pnpm dev`. `GET /api/capabilities` will start reporting `{ aiEnabled: true }`, the Settings dialog grows an "AI Assistant" toggle, and the editor surfaces the panel once the user opts in. The two spend-DoS knobs `AI_ALLOWED_ORIGINS` and `AI_REQUIRE_SIGN_IN` are hosted-only; leave them unset locally so the guest path keeps working. Production declares `AI_ALLOWED_ORIGINS` in `apps/api/wrangler.toml` `[vars]`, which `wrangler dev` also reads, so the api's `dev` script (and the e2e stack) blank it with `--var AI_ALLOWED_ORIGINS:`; without that, every AI request from a localhost editor answers 403 `origin_not_allowed`. See `apps/api/.env.example` for the full set of vars the worker reads.

## Running tests

```sh
pnpm test                                # everything
pnpm --filter @livedesign/api test      # one workspace
pnpm --filter @livedesign/live exec vitest   # watch mode while developing
```

Tests live alongside the code they cover, as `*.test.ts` / `*.test.tsx` files. The test runner is [Vitest](https://vitest.dev) with the shared config from `@livedesign/vitest-config`. See [Testing](../specs/003-system-architecture/testing.md) for the testing contract.

Workbench embeds have an opt-in end-to-end run ([Workbench embeds](../specs/013-workspace/workbench-embeds.md)): `pnpm --filter @livedesign/live test:e2e:workbench`. It rebuilds `apps/live/out` with the test-only session bridge (`NEXT_PUBLIC_E2E_AUTH=1`), then boots the e2e stack with `E2E_WORKBENCH=1` on its own ports (live 3021, api 8791, marketing 3022): the stack acts as the accounts Worker (as under `E2E_ACCOUNTS_STUB`, minting access tokens on `/e2e/token`) and gives the api worker `APP_BASE_URL=http://localhost:3121`, so its workbench and pairing URLs point at the live server. The spec serves a fake workbench (`apps/live/e2e/fixtures/fake-workbench.html`) from `127.0.0.1` on a free port, pairs it on the pairing page, and frames `/embed/workbench` in it; `workbench-workspace.spec.ts` pairs it again for the whole workspace and frames `/embed/workbench/explorer`, whose places (`/embed/workbench/explorer/**`, `/embed/workbench/design/**`) the stack serves from that one page, as the live worker does.

## Trying the editor without an AI key

The e2e stack (`scripts/e2e-stack.mjs`) can serve the built editor a second
time, beside a running stack, as a deployment WITHOUT an AI key runs it:

```bash
E2E_LIVE_PORT=3402 E2E_API_PORT=8887 E2E_LIVE_ONLY=1 E2E_NO_AI=1 node scripts/e2e-stack.mjs
```

`E2E_LIVE_ONLY=1` serves the static editor only, proxying to the api already
on `E2E_API_PORT`; `E2E_NO_AI=1` answers `/api/capabilities` with
`aiEnabled: false`.

`E2E_LIVE_OUT=<dir>` serves another export of the live app (the signed-in specs use
`.next/out-signed-in`), and `E2E_ACCOUNTS_STUB=1` makes the stack stand in for the accounts Worker:
the api verifies access tokens the stack mints on `/e2e/token?sub=user_…` ([End-to-end tests](../specs/003-system-architecture/e2e-smoke.md)).

## Four gotchas

- **All four Next.js dev servers (`marketing`, `live`, `telemetry`, `help`) run through `scripts/next-dev.mjs`.** It frees the port and points dev at an isolated `.next-dev/` cache, so a `next build` running in the same checkout can't corrupt the dev server (the recurring "unstyled help page" / `Cannot find module './NNNN.js'` failures). The cache is kept between starts: Turbopack's file-system cache reuses the last session's compilation (a warm start serves its first page in about a second) and reconciles a route restructure by itself, and `turbopackGc` keeps it from growing stale ([Next.js](../specs/016-platform/nextjs.md) "The Turbopack cache"). A cache that goes wrong is a bug to fix, not something to wipe away. All four run on Turbopack, which is also what `next build` uses under Next 16, so dev compiles the same way the deployed bundle does. Every app's settings come from `@livedesign/next-config` (`livedesignNextConfig`), so a change to them lands in all four at once.

  `help` was pinned to webpack until the Next 16 upgrade, because Turbopack's Rust MDX pipeline ignores remark/rehype plugins handed over as imported JS functions and its pipe tables rendered as literal text. `apps/help/next.config.ts` now names `remark-gfm` as a string (`remarkPlugins: [['remark-gfm', {}]]`), which Turbopack resolves itself, so the tables survive. Keep that string form: importing the plugin back fails the build outright under Turbopack with "does not have serializable options".

  Next 16 also writes `next-env.d.ts` into whichever app you run it from, gitignored on purpose: it names the active distDir inside itself, so dev and build would otherwise rewrite it over each other, and each app's tsconfig already picks up the Next types without it being tracked. Next can also generate an `AGENTS.md` + `CLAUDE.md` pair of agent instructions; the shared config turns that off (`agentRules: false`), because the repo's agent instructions are written by hand in the root `AGENTS.md`. Any old generated pair left in an app folder stays gitignored and can be deleted.

  The webpack escape hatch is still there — `pnpm --filter @livedesign/live dev:webpack` boots the editor on webpack, and `scripts/next-dev.mjs` honours `--webpack` from any app. It exists for the case where Turbopack genuinely doesn't support something the app needs, and it is a diagnostic rather than a default: Turbopack became the default precisely because webpack's HMR kept desynchronising here and serving `__webpack_modules__[moduleId] is not a function` until someone wiped `.next`. If you find yourself needing the hatch, that is worth a spec note rather than a habit. The editor on webpack also runs without the React Compiler, whose native Rust port is Turbopack-only ([React state and effects](../specs/003-system-architecture/react-state-and-effects.md)), so a render bug seen only on one bundler may be the compiler.

- **`/licences` needs its generated data.** `pnpm dev` does not run the generator (it takes about 20 seconds), so the marketing dev server fails that one page with `LicencesManifestMissing` until you run `pnpm licences` once. Don't run `pnpm licences` while a `next build` of the editor, help centre or telemetry dashboard is running: Next's analyzer shares an app's Turbopack build cache (`.next/cache`), and two processes on it corrupt it. `pnpm build` orders them for you.

- **The api worker's local D1 file lives at `apps/api/.wrangler/state/v3/d1/`.** Delete the folder to start over with an empty database.

- **Open the editor on `localhost`, not on the machine's LAN address.** Over plain `http` from any other address (`http://192.168.x.x:3002`, `http://<machine-name>:3002`) the browser is not in a secure context, withholds `crypto.randomUUID`, and the editor fails to load with "This page couldn't load". A known gap, not yet fixed: the editor calls `crypto.randomUUID` directly in about 75 places. Testing from a phone or a second laptop needs https (a tunnel, or a dev certificate) until it is.
