# Local development

How to run livediagram on your machine.

## Requirements

- **Node** `>= 22` (Wrangler 4 requires it).
- **pnpm** `>= 9` (the lockfile and workspaces depend on it).

Cloudflare is not required for local development. The api worker runs locally via Wrangler against a local D1 SQLite file; the Next.js apps run via Next's dev server.

## Clone and install

```sh
git clone https://github.com/livediagram-app/livediagram.app livediagram
cd livediagram
pnpm install
```

This installs every workspace at once, including TypeScript 7 ([Contributing](contributing.md#typescript)).

## Apply the local database migrations (once, before first `pnpm dev`)

`wrangler dev` does NOT auto-apply migrations: a fresh local D1 starts empty. Run this once after cloning, and again whenever a new migration lands under `apps/api/migrations/`:

```sh
pnpm --filter @livediagram/api db:migrate:local
```

It applies every SQL file in `apps/api/migrations/` to the local SQLite file Wrangler keeps at `apps/api/.wrangler/state/v3/d1/`. The production deploy runs the equivalent `db:migrate:remote` step automatically in CI (see [Self-hosting](../operations/self-hosting.md)).

## Run everything

```sh
pnpm dev
```

Turbo spins up all seven dev servers in parallel:

| App              | Dev URL                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `apps/router`    | `http://localhost:3100` — **everything on one port**, stitched like production                     |
| `apps/marketing` | `http://localhost:3101`                                                                            |
| `apps/editor`    | `http://localhost:3102` (clean routes: /new, /explorer, ...)                                       |
| `apps/help`      | `http://localhost:3104/help`                                                                       |
| `apps/community` | `http://localhost:3105/community`                                                                  |
| `apps/api`       | `http://localhost:8687/api`                                                                        |
| `apps/mcp`       | `http://localhost:8788` (MCP server, [MCP server](../specs/015-api/mcp-server.md); signed-in only) |

The telemetry dashboard is not one of them: it is liveworkspace's (`liveworkspace/apps/telemetry`, [Telemetry](../specs/017-telemetry/telemetry.md)), and `localhost:3100/telemetry` redirects to the local service. To see events locally, run that service and set `NEXT_PUBLIC_TELEMETRY_URL`, `TELEMETRY_URL` and `TELEMETRY_KEY` as the `.env.example` files describe.

The `router` dev server (`wrangler dev --env local`, port 3000) gives you the production URL shape locally: `/` is marketing, `/new` and `/document/*` are the editor, plus `/telemetry`, `/help`, `/community`, and `/api` — no per-app port to remember. It has no service bindings in dev; the `[env.local]` environment in `apps/router/wrangler.toml` points it at the localhost origins above and it proxies plain HTTP (see [Router app](../specs/016-platform/router-app.md)).

**Use port 3000 unless you have a reason not to.** Each app's own port still serves its pages, but only the router puts the API on the same origin. The frontends call `NEXT_PUBLIC_API_BASE`, defaulting to the relative `/api` — correct in production and behind the router, and a dead end on an app's own port, where nothing serves `/api` (these are static exports; there are no Next API routes, see [Architecture](architecture.md)). So the editor on `http://localhost:3102` cannot reach the api worker until you tell it where the worker is:

```sh
# apps/editor/.env.local  (gitignored; see apps/editor/.env.example)
NEXT_PUBLIC_API_BASE=http://localhost:8687/api
```

A remote api works too, and there are now two of them: `https://staging.livediagram.app/api`
reaches [staging](../specs/016-platform/staging-environment.md), which has its own database and is
the one to reach for; the production api reads and writes real people's documents.

Without it the editor loads, the canvas works, and the first save fails with **“Couldn’t create the document”** — which reads like a broken api worker rather than a missing variable, so it is worth setting up front. `apps/telemetry`, `apps/help` and `apps/community` read the same variable: the dashboard needs it to show anything on `:3103`, the Community needs it for My Shares on `:3105` (its gallery reads liveworkspace's Community service: see below), and the help centre only loses its telemetry posts without it. To work on the dashboard against real numbers without seeding a local database, point it at production's summary instead: `NEXT_PUBLIC_API_BASE=https://www.livediagram.app/api` in `apps/telemetry/.env.local`. `GET /api/telemetry/summary` is public, read-only and allows any origin, and the dashboard only sends events itself when `NEXT_PUBLIC_TELEMETRY_ENABLED=true`, which local builds leave unset.

The editor works in pure-guest mode without any auth setup: `pnpm dev` and open `http://localhost:3100/new`. Documents persist to the local D1 file the api worker creates on first start. (On `http://localhost:3102/new` instead, set `NEXT_PUBLIC_API_BASE` first — see the note above.)

## The Community locally

The Community's listings live in liveworkspace's Community service, not this api
([liveworkspace/docs/community.md](../../../liveworkspace/docs/community.md)). Run it with
`corepack pnpm dev:community` from the monorepo root (`:8791`, after its `db:migrate:local`), then:

```sh
# apps/api/.dev.vars
COMMUNITY_URL=http://localhost:8791/api/community
COMMUNITY_KEY=dev-livediagram-community-key

# apps/community/.env.local, apps/editor/.env.local and apps/marketing/.env.local
NEXT_PUBLIC_COMMUNITY_API=http://localhost:8791/api/community
```

Without `COMMUNITY_KEY` the api reports the Community off and Share to Community doesn't show.

## Scoping commands to one workspace

```sh
pnpm --filter @livediagram/editor dev
pnpm --filter @livediagram/api test
pnpm --filter @livediagram/marketing build
```

Workspace names follow the pattern `@livediagram/<app-or-package-folder-name>`.

## Useful scripts

Run from the repo root:

| Command                                                                   | What it does                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                                                            | Install all workspace deps.                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm dev`                                                                | Start all dev servers in parallel (`turbo run dev`).                                                                                                                                                                                                                                                                                                                                      |
| `pnpm build`                                                              | Production build across the repo (`turbo run build`).                                                                                                                                                                                                                                                                                                                                     |
| `pnpm lint`                                                               | oxlint across the repo (`turbo run lint`).                                                                                                                                                                                                                                                                                                                                                |
| `pnpm typecheck`                                                          | `tsc --noEmit` across every workspace (`turbo run typecheck`).                                                                                                                                                                                                                                                                                                                            |
| `pnpm test`                                                               | Vitest across every workspace that has tests (`turbo run test`).                                                                                                                                                                                                                                                                                                                          |
| `pnpm --filter @livediagram/editor perf:canvas`                           | The canvas performance probe ([Canvas performance](../specs/008-canvas/canvas-performance.md)): builds the 1,000-element reference board, traces every gesture at 4x CPU and writes the budget table to `apps/editor/test-results/perf/`. Needs a fresh `next build`; set `E2E_EDITOR_PORT` / `E2E_API_PORT` / `E2E_BASE_URL` to run beside a `pnpm dev`. Reports, never fails on a miss. |
| `pnpm --filter @livediagram/editor test:e2e`                              | Playwright end-to-end suite ([End-to-end tests](../specs/003-system-architecture/e2e-smoke.md)); reuses a running `pnpm dev` or boots its own stack. Set `E2E_WEBKIT=1` (after `npx playwright install webkit`) to also run the image import spec in WebKit.                                                                                                                              |
| `pnpm --filter @livediagram/editor test:e2e:signed-in`                    | The signed-in specs (`apps/editor/e2e/signed-in/`) against `.next/out-signed-in/`; run `pnpm --filter @livediagram/editor build:signed-in` first. Boots its own stack on `:3115` / `:8115` / `:3116`.                                                                                                                                                                                  |
| `pnpm --filter @livediagram/editor test:e2e:armed`                        | The armed guest-signature specs (`apps/editor/e2e/armed/`) with guest signature enforcement on, against the guest-mode `out/`. Boots its own stack on `:3117` / `:8117` / `:3118`.                                                                                                                                                                                                        |
| `cd apps/editor && bun scripts/ms-whiteboard-verify.mts <folder or .zip>` | Runs the [Microsoft Whiteboard import](../specs/020-import-export/whiteboard-import.md) over real board exports outside the repo and prints counts only (boards, replay stats, items per kind, report notes, timings, largest tab), never their content.                                                                                                                                  |
| `pnpm --filter @livediagram/cli build`                                    | Bundle the CLI into `apps/cli/dist/livediagram.mjs` (see [Running the CLI from source](#running-the-cli-from-source-optional)).                                                                                                                                                                                                                                                           |
| `pnpm format`                                                             | Prettier write across the repo.                                                                                                                                                                                                                                                                                                                                                           |
| `pnpm format:check`                                                       | Prettier check (this is what CI runs).                                                                                                                                                                                                                                                                                                                                                    |
| `pnpm staging:check`                                                      | Dry-run the `[env.staging]` wrangler configs and print the resolved bindings (CI runs it).                                                                                                                                                                                                                                                                                                |
| `pnpm licences`                                                           | Regenerate the `/licences` page data (`apps/marketing/generated/`, `public/licences/`) from what every app bundles ([Third-party licences](../specs/002-project-scope/third-party-licences.md)); the marketing build runs it itself.                                                                                                                                                      |
| `pnpm icons:vendor`                                                       | Regenerate the vendored Lucide glyphs from `packages/icons/lucide-manifest.json` ([Iconography](../specs/004-interface-design/iconography.md)).                                                                                                                                                                                                                                           |
| `pnpm icons:sheet`                                                        | Render every editor icon at 1x and 4x into HTML + PNG contact sheets (`$ICON_SHEET_DIR`, default `/tmp/icon-sheet`) for review.                                                                                                                                                                                                                                                           |
| `pnpm demo:sticky-vision`                                                 | Bundle + serve the sticky-detection demo at <http://localhost:4199> ([Event storming](../specs/021-event-storming/event-storming.md)).                                                                                                                                                                                                                                                    |
| `pnpm bench:stroke-points`                                                | Measure packed stroke points against the former `{ nx, ny }` shape on a synthesised board: tab bytes, allocations, parse and draw time, accuracy ([Stroke points](../specs/006-document/stroke-points.md)).                                                                                                                                                                               |
| `pnpm --filter @livediagram/document stroke-points <file.json>`           | Print a stored tab or document file with every freehand's `packedPoints` expanded into readable `{ nx, ny, p }` points (`-` reads stdin).                                                                                                                                                                                                                                                 |

Turbo caches results, so re-running with no changes is a no-op.

## Enabling sign-in locally (optional)

The editor works without sign-in. To exercise the signed-in code paths, run liveworkspace beside it and register livediagram with its accounts API:

1. Start liveworkspace (first-time setup is in `liveworkspace/README.md`, "Local development"): `pnpm dev:workspace` from the repo root runs the site, with the sign-in pages, on `http://localhost:3300`, and the accounts and telemetry Workers behind it, as liveworkspace.app has them. Locally the accounts Worker prints each sign-in code in its own output instead of emailing it.
2. Register livediagram once against it. `http://localhost/api` is the one resource a development accounts Worker issues tokens for (`RESOURCES` in liveworkspace/apps/accounts/src/resources.ts). The secret is printed once:

   ```sh
   ADMIN_TOKEN=local-admin-token node liveworkspace/apps/accounts/scripts/register-client.ts \
     --accounts http://localhost:3300 \
     --name livediagram-dev \
     --redirect http://localhost:3100/api/auth/callback \
     --resource http://localhost/api
   ```

3. Drop the values into the two env files:

   ```sh
   # apps/editor/.env.local (gitignored)
   NEXT_PUBLIC_SIGN_IN_ENABLED=true

   # apps/community/.env.local (gitignored), optional: turns on My Shares
   NEXT_PUBLIC_SIGN_IN_ENABLED=true

   # apps/api/.dev.vars (gitignored)
   ACCOUNTS_URL=http://localhost:3300
   API_RESOURCE=http://localhost/api
   ACCOUNTS_CLIENT_ID=...
   ACCOUNTS_CLIENT_SECRET=...
   AUTH_ORIGIN=http://localhost:3100
   ```

4. Restart `pnpm dev` and open the app through the router (`http://localhost:3100`), so the sign-in cookies and the callback share one origin.

With these set, `/sign-in` hands off to the accounts site and comes back signed in. The api worker verifies the access token and derives the owner id from the `sub` claim instead of falling back to the `X-Owner-Id` header.

Without these set: the api worker silently treats every request as a guest (the `X-Owner-Id` header path), and the editor mounts no session bridge, so it renders the editor without any auth UI. This is the self-host default. See [Auth + guest access](../specs/014-identity/auth-and-guest-access.md) for the full hybrid model.

## Running the CLI from source (optional)

The [CLI](../specs/015-api/cli.md) acts only with an API token, so it needs a host with sign-in: enable sign-in as
above, sign in, and create a token in Settings › API Tokens. Then build the bundle and point it at the local api:

```bash
pnpm --filter @livediagram/cli build
export LIVEDIAGRAM_HOST=http://localhost:8687 LIVEDIAGRAM_TOKEN=lvd_...
apps/cli/dist/livediagram.mjs document ls
```

`LIVEDIAGRAM_DEBUG=1` prints each decision and request as a `[cli]` line on stderr. The CLI keeps its files under
`$XDG_CONFIG_HOME/livediagram` and `$XDG_CACHE_HOME/livediagram` (`~/.config` and `~/.cache` by default); point
both at a scratch directory to keep a test run apart from your own sign-in.

## Enabling AI assistance locally (optional)

The AI panel ([AI Assistance](../specs/007-editor/ai-assistance.md)) is hidden entirely unless the api worker has a model key. To turn it on locally:

```sh
# apps/api/.dev.vars (gitignored). One key serves every AI feature.
OPENAI_API_KEY=...             # or GOOGLE_AI_STUDIO_API_KEY=..., or both:
#                              # the assistant then runs on OpenAI, the reader on Google
# AI_API_KEY=...               # any other OpenAI-compatible provider, used only when
# AI_BASE_URL=http://127.0.0.1:8080/v1  # neither named key is set; needs both of these
# AI_MODEL=gpt-4o              # the assistant's model; optional for the named keys
# AI_VISION_MODEL=...          # optional; reads sticky crops (docs/specs/021-event-storming/event-storming.md).
#                              # On Google this defaults to gemini-2.5-flash-lite,
#                              # which reads handwriting better than the big model.
```

Restart `pnpm dev`. `GET /api/capabilities` will start reporting `{ aiEnabled: true }`, the Settings dialog grows an "AI Assistant" toggle, and the editor surfaces the panel once the user opts in. The two spend-DoS knobs `AI_ALLOWED_ORIGINS` and `AI_REQUIRE_SIGN_IN` are hosted-only; leave them unset locally so the guest path keeps working. Production declares `AI_ALLOWED_ORIGINS` in `apps/api/wrangler.toml` `[vars]`, which `wrangler dev` also reads, so the api's `dev` script (and the e2e stack) blank it with `--var AI_ALLOWED_ORIGINS:`; without that, every AI request from a localhost editor answers 403 `origin_not_allowed`. See `apps/api/.env.example` for the full set of vars the worker reads.

## Running tests

```sh
pnpm test                                # everything
pnpm --filter @livediagram/api test      # one workspace
pnpm --filter @livediagram/editor exec vitest   # watch mode while developing
```

Tests live alongside the code they cover, as `*.test.ts` / `*.test.tsx` files. The test runner is [Vitest](https://vitest.dev) with the shared config from `@livediagram/vitest-config`. See [Testing](../specs/003-system-architecture/testing.md) for the testing contract.

The Google Drive mirror has an opt-in end-to-end run against the fake Google ([Google Drive mirror](../specs/022-drive-mirror/drive-mirror.md)): `pnpm --filter @livediagram/editor test:e2e:drive`. It rebuilds `apps/editor/out` with the test-only session bridge (`NEXT_PUBLIC_E2E_AUTH=1`) and a test client id, then boots the e2e stack with `E2E_DRIVE=1`, which gives the api worker test values for `ACCOUNTS_URL`, `API_RESOURCE`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DRIVE_TOKEN_KEY` and `GOOGLE_OAUTH_BASE_URL`. The test stands in for the accounts Worker's JWKS (port 8795) and the fake Google (8796) itself. Rebuild the editor app normally before running the ordinary e2e again, and stop any `pnpm dev` on port 3102 first (or set `E2E_EDITOR_PORT`, `E2E_API_PORT`, `E2E_MARKETING_PORT` and `E2E_BASE_URL`), since Playwright reuses a running server.

`pnpm --filter @livediagram/editor test:e2e:drive-shots` uses the same build and stack to screenshot every Drive state (Settings > Account > Cloud Sync in every phase, Open with, the Explorer following a change made in Drive) in light and dark at 1280 x 800 (`E2E_DRIVE_SHOTS_SCALE=2` for 2x, `E2E_DRIVE_SHOTS_NARROW=1` for the phone layout), into `E2E_DRIVE_PR_SHOTS` (default `/tmp/ld-drive-pr-shots`) with a `README.md` naming each file. Run it on its own: it serves the same fake Google port as `test:e2e:drive`.

Workbench embeds have an opt-in end-to-end run ([Workbench embeds](../specs/013-workspace/workbench-embeds.md)): `pnpm --filter @livediagram/editor test:e2e:workbench`. It rebuilds `apps/editor/out` with the test-only session bridge (`NEXT_PUBLIC_E2E_AUTH=1`), then boots the e2e stack with `E2E_WORKBENCH=1` on its own ports (live 3021, api 8791, marketing 3022): the stack acts as the accounts Worker (as under `E2E_ACCOUNTS_STUB`, minting access tokens on `/e2e/token`) and gives the api worker `APP_BASE_URL=http://localhost:3121`, so its workbench and pairing URLs point at the live server. The spec serves a fake workbench (`apps/editor/e2e/fixtures/fake-workbench.html`) from `127.0.0.1` on a free port, pairs it on the pairing page, and frames `/embed/workbench` in it; `workbench-workspace.spec.ts` pairs it again for the whole workspace and frames `/embed/workbench/explorer`, whose places (`/embed/workbench/explorer/**`, `/embed/workbench/document/**`) the stack serves from that one page, as the editor worker does.

## Enabling the Google Drive mirror locally (optional)

The mirror needs a Google Cloud OAuth client (web application) with `http://localhost:3100/drive/connected` as an authorised redirect URI and `http://localhost:3100` as a JavaScript origin, and the Drive API enabled:

```sh
# apps/api/.dev.vars (gitignored)
GOOGLE_CLIENT_ID=123456789012-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
DRIVE_TOKEN_KEY=...        # openssl rand -base64 32

# apps/editor/.env.local (gitignored)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789012-abc.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_API_KEY=... # optional: the Picker's browser key, for adopting a folder
```

It is signed-in only, so sign-in must be enabled too (above). Without these Settings has no Cloud Sync section and every `/api/drive` route answers `503 drive_not_configured`.

## Trying the photo import without an AI key

The e2e stack (`scripts/e2e-stack.mjs`) can serve the built editor a second
time, beside a running stack, as a deployment WITHOUT an AI key runs it — so
the photo import reads the handwriting with the in-browser model (and shows
its download the first time):

```bash
E2E_EDITOR_PORT=3402 E2E_API_PORT=8887 E2E_EDITOR_ONLY=1 E2E_NO_AI=1 node scripts/e2e-stack.mjs
```

`E2E_EDITOR_ONLY=1` serves the static editor only, proxying to the api already
on `E2E_API_PORT`; `E2E_NO_AI=1` answers `/api/capabilities` with
`aiEnabled: false`.

`E2E_EDITOR_OUT=<dir>` serves another export of the editor app (the signed-in specs use
`.next/out-signed-in`), and `E2E_ACCOUNTS_STUB=1` makes the stack stand in for the accounts Worker:
the api verifies access tokens the stack mints on `/e2e/token?sub=user_…` ([End-to-end tests](../specs/003-system-architecture/e2e-smoke.md)).

To try a hosted reader whose free budget is spent, swap `E2E_NO_AI=1` for
`E2E_AI_BUDGET_SPENT=1`: the api still reports a model, every
`/api/ai/read-notes` call answers 429 `ai_quota`, and the import fails over
to the in-browser model and says so ([Event storming](../specs/021-event-storming/event-storming.md) Phase 9).

## Four gotchas

- **All five Next.js dev servers (`marketing`, `live`, `telemetry`, `help`, `community`) run through `scripts/next-dev.mjs`.** It frees the port and points dev at an isolated `.next-dev/` cache, so a `next build` running in the same checkout can't corrupt the dev server (the recurring "unstyled help page" / `Cannot find module './NNNN.js'` failures). The cache is kept between starts: Turbopack's file-system cache reuses the last session's compilation (a warm start serves its first page in about a second) and reconciles a route restructure by itself, and `turbopackGc` keeps it from growing stale ([Next.js](../specs/016-platform/nextjs.md) "The Turbopack cache"). A cache that goes wrong is a bug to fix, not something to wipe away. All five run on Turbopack, which is also what `next build` uses under Next 16, so dev compiles the same way the deployed bundle does. Every app's settings come from `@livediagram/next-config` (`livediagramNextConfig`), so a change to them lands in all five at once.

  `help` was pinned to webpack until the Next 16 upgrade, because Turbopack's Rust MDX pipeline ignores remark/rehype plugins handed over as imported JS functions and its pipe tables rendered as literal text. `apps/help/next.config.ts` now names `remark-gfm` as a string (`remarkPlugins: [['remark-gfm', {}]]`), which Turbopack resolves itself, so the tables survive. Keep that string form: importing the plugin back fails the build outright under Turbopack with "does not have serializable options".

  Next 16 also writes `next-env.d.ts` into whichever app you run it from, gitignored on purpose: it names the active distDir inside itself, so dev and build would otherwise rewrite it over each other, and each app's tsconfig already picks up the Next types without it being tracked. Next can also generate an `AGENTS.md` + `CLAUDE.md` pair of agent instructions; the shared config turns that off (`agentRules: false`), because the repo's agent instructions are written by hand in the root `AGENTS.md`. Any old generated pair left in an app folder stays gitignored and can be deleted.

  The webpack escape hatch is still there — `pnpm --filter @livediagram/editor dev:webpack` boots the editor on webpack, and `scripts/next-dev.mjs` honours `--webpack` from any app. It exists for the case where Turbopack genuinely doesn't support something the app needs, and it is a diagnostic rather than a default: Turbopack became the default precisely because webpack's HMR kept desynchronising here and serving `__webpack_modules__[moduleId] is not a function` until someone wiped `.next`. If you find yourself needing the hatch, that is worth a spec note rather than a habit. The editor on webpack also runs without the React Compiler, whose native Rust port is Turbopack-only ([React state and effects](../specs/003-system-architecture/react-state-and-effects.md)), so a render bug seen only on one bundler may be the compiler.

- **`/licences` needs its generated data.** `pnpm dev` does not run the generator (it takes about 20 seconds), so the marketing dev server fails that one page with `LicencesManifestMissing` until you run `pnpm licences` once. Don't run `pnpm licences` while a `next build` of the editor, help centre or telemetry dashboard is running: Next's analyzer shares an app's Turbopack build cache (`.next/cache`), and two processes on it corrupt it. `pnpm build` orders them for you.

- **The api worker's local D1 file lives at `apps/api/.wrangler/state/v3/d1/`.** Delete the folder to start over with an empty database.

- **Open the editor on `localhost`, not on the machine's LAN address.** Over plain `http` from any other address (`http://192.168.x.x:3102`, `http://<machine-name>:3102`) the browser is not in a secure context, withholds `crypto.randomUUID`, and the editor fails to load with "This page couldn't load". A known gap, not yet fixed: the editor calls `crypto.randomUUID` directly in about 75 places. Testing from a phone or a second laptop needs https (a tunnel, or a dev certificate) until it is.
