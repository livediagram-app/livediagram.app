# Local development

How to run livedocuments on your machine.

livedocuments lives in the liveworkspace monorepo, beside the other products and the shared `packages/`. There is one
pnpm workspace and one lockfile, at the monorepo root.

## Requirements

- **Node** `>= 22` (Wrangler 4 requires it).
- **pnpm** through **corepack** (`packageManager: pnpm@9.15.0` at the root). Run every pnpm command as
  `corepack pnpm …`.

Cloudflare is not required for local development. The api worker runs locally via Wrangler, its Durable Objects (one per document) kept in Wrangler's local state; the Next.js apps run via Next's dev server.

## Clone and install

From the monorepo root:

```sh
corepack pnpm install
```

This installs every workspace of every product at once, including TypeScript 7 ([Contributing](contributing.md#typescript)).
Never install inside `livedocuments/`; add a dependency with `corepack pnpm --filter <package> add …` from the root.

## No database to set up

The api worker has no D1 database and no migrations. Each Durable Object makes its own schema the first time it is
used, so a fresh clone needs nothing applied before `corepack pnpm dev:documents`. Wrangler keeps their local state under
`apps/api/.wrangler/state/`.

## Run everything

From the monorepo root:

```sh
corepack pnpm dev:documents
```

Turbo spins up livedocuments' six dev servers in parallel, in its 3300 port block (`corepack pnpm dev` inside
`livedocuments/` does the same):

| App              | Dev URL                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `apps/router`    | `http://localhost:3300`: **everything on one port**, stitched like production                      |
| `apps/marketing` | `http://localhost:3301`                                                                            |
| `apps/editor`    | `http://localhost:3302` (clean routes: /new, /document/<id>, /offline, ...)                        |
| `apps/help`      | `http://localhost:3304/help`                                                                       |
| `apps/api`       | `http://localhost:8987/api`                                                                        |
| `apps/mcp`       | `http://localhost:8988` (MCP server, [MCP server](../specs/015-api/mcp-server.md); signed-in only) |

The `router` dev server (`wrangler dev --env local`, port 3300) gives you the production URL shape locally: `/` is marketing, `/new` and `/document/*` are the editor, plus `/help` and `/api` (`/telemetry` redirects to liveworkspace's dashboard), so there is no per-app port to remember. It has no service bindings in dev; the `[env.local]` environment in `apps/router/wrangler.toml` points it at the localhost origins above and it proxies plain HTTP (see [Router app](../specs/016-platform/router-app.md)).

**Use port 3300 unless you have a reason not to.** Each app's own port still serves its pages, but only the router puts the API on the same origin. The frontends call `NEXT_PUBLIC_API_BASE`, defaulting to the relative `/api`: correct in production and behind the router, and a dead end on an app's own port, where nothing serves `/api` (these are static exports; there are no Next API routes, see [Architecture](architecture.md)). So the editor on `http://localhost:3302` cannot reach the api worker until you tell it where the worker is:

```sh
# apps/editor/.env.local  (gitignored; see apps/editor/.env.example)
NEXT_PUBLIC_API_BASE=http://localhost:8987/api
```

A remote api works too: `https://staging.livedocuments.app/api`
reaches [staging](../specs/016-platform/staging-environment.md), which has its own storage and its own index and is
the one to reach for; the production api reads and writes real people's documents.

Without it the editor loads, the canvas works, and the first save fails with **“Couldn’t create the document”**, which reads like a broken api worker rather than a missing variable, so it is worth setting up front. `apps/help` reads the same variable. Telemetry is liveworkspace's (liveworkspace/docs/specs/008-telemetry/telemetry.md): to see local events, run its service (`wrangler dev` in liveworkspace/apps/telemetry, port 8790) and point the frontends at it with `NEXT_PUBLIC_TELEMETRY_URL=http://localhost:8790/api/telemetry`, and the api and mcp workers with `TELEMETRY_URL` and `TELEMETRY_KEY` in their `.dev.vars`. Its dashboard is liveworkspace.app's site (`corepack pnpm dev:site` from the monorepo root, `http://localhost:3000/telemetry?app=livedocuments.app`).

The editor opens without any auth setup: `corepack pnpm dev:documents` and open `http://localhost:3300/new`. Documents persist in each document's local Durable Object, with the index running locally (see [The index](#the-index) below). (On `http://localhost:3302/new` instead, set `NEXT_PUBLIC_API_BASE` first, as above.)

## Scoping commands to one workspace

```sh
corepack pnpm --filter @livedocuments/editor dev
corepack pnpm --filter @livedocuments/api test
corepack pnpm --filter @livedocuments/marketing build
```

Workspace names follow the pattern `@livedocuments/<app-or-package-folder-name>`.

## Useful scripts

Run inside `livedocuments/` (each runs this product's workspaces only; from the monorepo root the same names run
every product's):

| Command                                                                    | What it does                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm dev`                                                        | Start livedocuments' dev servers in parallel (`turbo run dev`).                                                                                                                                                                                                                                                                                                                                    |
| `corepack pnpm build`                                                      | Production build of every livedocuments workspace (`turbo run build`).                                                                                                                                                                                                                                                                                                                             |
| `corepack pnpm lint`                                                       | oxlint across livedocuments (`turbo run lint`).                                                                                                                                                                                                                                                                                                                                                    |
| `corepack pnpm typecheck`                                                  | `tsc --noEmit` across every livedocuments workspace (`turbo run typecheck`).                                                                                                                                                                                                                                                                                                                       |
| `corepack pnpm test`                                                       | Vitest across every livedocuments workspace that has tests (`turbo run test`).                                                                                                                                                                                                                                                                                                                     |
| `corepack pnpm --filter @livedocuments/editor perf:canvas`                 | The canvas performance probe ([Canvas performance](../specs/008-canvas/canvas-performance.md)): builds the 1,000-element reference board, traces every gesture at 4x CPU and writes the budget table to `apps/editor/test-results/perf/`. Needs a fresh `next build`; set `E2E_EDITOR_PORT` / `E2E_API_PORT` / `E2E_BASE_URL` to run beside a `corepack pnpm dev`. Reports, never fails on a miss. |
| `corepack pnpm --filter @livedocuments/editor test:e2e`                    | Playwright end-to-end suite ([End-to-end tests](../specs/003-system-architecture/e2e-smoke.md)); reuses a running `corepack pnpm dev` or boots its own stack.                                                                                                                                                                                                                                      |
| `corepack pnpm --filter @livedocuments/editor test:e2e:signed-in`          | The signed-in specs (`apps/editor/e2e/signed-in/`) against `.next/out-signed-in/`; run `corepack pnpm --filter @livedocuments/editor build:signed-in` first. Boots its own stack on `:3315` / `:8315` / `:3316`.                                                                                                                                                                                   |
| `corepack pnpm --filter @livedocuments/cli build`                          | Bundle the CLI into `apps/cli/dist/livedocuments.mjs` (see [Running the CLI from source](#running-the-cli-from-source-optional)).                                                                                                                                                                                                                                                                  |
| `corepack pnpm format`                                                     | Prettier write across livedocuments.                                                                                                                                                                                                                                                                                                                                                               |
| `corepack pnpm format:check`                                               | Prettier check (this is what CI runs).                                                                                                                                                                                                                                                                                                                                                             |
| `corepack pnpm staging:check`                                              | Dry-run the `[env.staging]` wrangler configs and print the resolved bindings (CI runs it).                                                                                                                                                                                                                                                                                                         |
| `corepack pnpm licences`                                                   | Regenerate the `/licences` page data (`apps/marketing/generated/`, `public/licences/`) from what every app bundles ([Third-party licences](../specs/002-project-scope/third-party-licences.md)); the marketing build runs it itself.                                                                                                                                                               |
| `corepack pnpm icons:vendor`                                               | Regenerate the vendored Lucide glyphs from `../packages/icons/lucide-manifest.json` ([Iconography](../specs/004-interface-design/iconography.md)).                                                                                                                                                                                                                                                 |
| `corepack pnpm icons:sheet`                                                | Render every editor icon at 1x and 4x into HTML + PNG contact sheets (`$ICON_SHEET_DIR`, default `/tmp/icon-sheet`) for review.                                                                                                                                                                                                                                                                    |
| `corepack pnpm --filter @livedocuments/document stroke-points <file.json>` | Print a stored tab or document file with every freehand's `packedPoints` expanded into readable `{ nx, ny, p }` points (`-` reads stdin).                                                                                                                                                                                                                                                          |

Turbo caches results, so re-running with no changes is a no-op.

## Enabling sign-in locally (optional)

The editor works without sign-in. To exercise the signed-in code paths, run liveworkspace beside it and register livedocuments with its accounts API:

1. Start liveworkspace (first-time setup is in `liveworkspace/README.md`, "Local development"): `corepack pnpm dev:workspace` from the monorepo root runs the site, with the sign-in pages, on `http://localhost:3000`, and the accounts and telemetry Workers behind it, as liveworkspace.app has them. Locally the accounts Worker prints each sign-in code in its own output instead of emailing it.
2. Register livedocuments once against it. `http://localhost/api` is the one resource a development accounts Worker issues tokens for (`RESOURCES` in liveworkspace/apps/accounts/src/resources.ts), and `--app livedocuments.app` is the app the client speaks for: the accounts Worker keeps livedocuments' own settings, sign-ups and milestones under it. The secret is printed once:

   ```sh
   ADMIN_TOKEN=local-admin-token node liveworkspace/apps/accounts/scripts/register-client.ts \
     --accounts http://localhost:3000 \
     --name livedocuments-dev \
     --app livedocuments.app \
     --redirect http://localhost:3300/api/auth/callback \
     --resource http://localhost/api
   ```

3. Drop the values into the two env files:

   ```sh
   # apps/api/.dev.vars (gitignored)
   ACCOUNTS_URL=http://localhost:3000
   API_RESOURCE=http://localhost/api
   ACCOUNTS_CLIENT_ID=...
   ACCOUNTS_CLIENT_SECRET=...
   AUTH_ORIGIN=http://localhost:3300
   ```

4. Restart `corepack pnpm dev:documents` and open the app through the router (`http://localhost:3300`), so the sign-in cookies and the callback share one origin.

With these set, `/sign-in` hands off to the accounts site and comes back signed in, and a guest gets a liveworkspace guest token through the same site (`/api/auth/guest`, back to `/auth/guest`). The api worker verifies either token and takes the owner id from its `sub` claim.

Without these set: the api worker treats every request as a link visitor (there is no guest identity without the accounts site), and the live frontend mounts no session bridge, so it renders the editor without any auth UI.

### The index

The Explorer, sharing and access are liveworkspace's index ([One Explorer](../../../liveworkspace/docs/specs/004-index/one-explorer.md)). Run it from the monorepo (`corepack pnpm dev:index`, port 8793; [the index](../../../liveworkspace/docs/specs/004-index/index-service.md) "Running it locally"), and give the api worker `INDEX_ORIGIN=http://127.0.0.1:8793` and `INDEX_KEY=dev-livedocuments-index-key` in `apps/api/.dev.vars` (see `apps/api/.env.example`). The router forwards `/api/index/*` there. Without it, the Explorer has nothing to list and a document cannot be opened from the server. This is the default for any deployment without sign-in configured. See [Auth + guest access](../specs/014-identity/auth-and-guest-access.md) for the full hybrid model.

## Running the CLI from source (optional)

The [CLI](../specs/015-api/cli.md) acts only with an API token, so it needs a host with sign-in: enable sign-in as
above, sign in, and create a token on your local liveworkspace site (Settings › API Tokens links there). Then build the bundle and point it at the local api:

```bash
corepack pnpm --filter @livedocuments/cli build
export LIVEDOCUMENTS_HOST=http://localhost:8987 LIVEDOCUMENTS_TOKEN=lwt_...
apps/cli/dist/livedocuments.mjs document ls
```

`LIVEDOCUMENTS_DEBUG=1` prints each decision and request as a `[cli]` line on stderr. The CLI keeps its files under
`$XDG_CONFIG_HOME/livedocuments` and `$XDG_CACHE_HOME/livedocuments` (`~/.config` and `~/.cache` by default); point
both at a scratch directory to keep a test run apart from your own sign-in.

## Running tests

```sh
corepack pnpm test                                # all of livedocuments, inside livedocuments/
corepack pnpm --filter @livedocuments/api test      # one workspace
corepack pnpm --filter @livedocuments/editor exec vitest   # watch mode while developing
```

Tests live alongside the code they cover, as `*.test.ts` / `*.test.tsx` files. The test runner is [Vitest](https://vitest.dev) with the shared config from `@liveworkspace/vitest-config`. See [Testing](../specs/003-system-architecture/testing.md) for the testing contract.

Workbench embeds have an opt-in end-to-end run ([Workbench embeds](../specs/013-workspace/workbench-embeds.md)): `corepack pnpm --filter @livedocuments/editor test:e2e:workbench`. It rebuilds `apps/editor/out` with the test-only session bridge (`NEXT_PUBLIC_E2E_AUTH=1`), then boots the e2e stack with `E2E_WORKBENCH=1` on its own ports (live 3321, api 8321, marketing 3322, index 8318): the stack acts as the accounts Worker (as under `E2E_ACCOUNTS_STUB`, minting access tokens on `/e2e/token`) and gives the api worker `APP_BASE_URL=http://localhost:3321`, so its workbench and pairing URLs point at the live server. The spec serves a fake workbench (`apps/editor/e2e/fixtures/fake-workbench.html`) from `127.0.0.1` on a free port, pairs it on the pairing page, and frames `/embed/workbench` in it; `workbench-workspace.spec.ts` pairs it again for the whole workspace and frames `/embed/workbench/explorer`, whose places (`/embed/workbench/explorer/**`, `/embed/workbench/document/**`) the stack serves from that one page, as the live worker does. Pairing, tickets and sessions are liveworkspace's accounts Worker's ([liveworkspace/docs/specs/011-workbench/workbench.md](../../../liveworkspace/docs/specs/011-workbench/workbench.md)), so the run also needs that Worker and liveworkspace.app's pairing page. The stack starts neither, so the run stops at its first mint.

## Serving the editor a second time

The e2e stack (`scripts/e2e-stack.mjs`) can serve the built editor a second
time, beside a running stack:

```bash
E2E_EDITOR_PORT=3303 E2E_API_PORT=8987 E2E_EDITOR_ONLY=1 node scripts/e2e-stack.mjs
```

`E2E_EDITOR_ONLY=1` serves the static editor only, proxying to the api already
on `E2E_API_PORT`.

`E2E_EDITOR_OUT=<dir>` serves another export of the editor app (the signed-in specs use
`.next/out-signed-in`), and `E2E_ACCOUNTS_STUB=1` makes the stack stand in for the accounts Worker:
the api verifies access tokens the stack mints on `/e2e/token?sub=user_…` ([End-to-end tests](../specs/003-system-architecture/e2e-smoke.md)).

## Four gotchas

- **All three Next.js dev servers (`marketing`, `editor`, `help`) run through `scripts/next-dev.mjs`.** It frees the port and points dev at an isolated `.next-dev/` cache, so a `next build` running in the same checkout can't corrupt the dev server (the recurring "unstyled help page" / `Cannot find module './NNNN.js'` failures). The cache is kept between starts: Turbopack's file-system cache reuses the last session's compilation (a warm start serves its first page in about a second) and reconciles a route restructure by itself, and `turbopackGc` keeps it from growing stale ([Next.js](../specs/016-platform/nextjs.md) "The Turbopack cache"). A cache that goes wrong is a bug to fix, not something to wipe away. All three run on Turbopack, which is also what `next build` uses under Next 16, so dev compiles the same way the deployed bundle does. Every app's settings come from `@liveworkspace/next-config` (`liveworkspaceNextConfig`), so a change to them lands in all three at once.

  Turbopack's Rust MDX pipeline ignores remark/rehype plugins handed over as imported JS functions, so `apps/help/next.config.ts` names `remark-gfm` as a string (`remarkPlugins: [['remark-gfm', {}]]`), which Turbopack resolves itself, and pipe tables render. Keep that string form: importing the plugin fails the build under Turbopack with "does not have serializable options".

  Next 16 also writes `next-env.d.ts` into whichever app you run it from, gitignored on purpose: it names the active distDir inside itself, so dev and build would otherwise rewrite it over each other, and each app's tsconfig already picks up the Next types without it being tracked. Next can also generate an `AGENTS.md` + `CLAUDE.md` pair of agent instructions; the shared config turns that off (`agentRules: false`), because the repo's agent instructions are written by hand in the root `AGENTS.md`.

  The webpack escape hatch: `corepack pnpm --filter @livedocuments/editor dev:webpack` boots the editor on webpack, and `scripts/next-dev.mjs` honours `--webpack` from any app. It exists for the case where Turbopack doesn't support something the app needs, and it is a diagnostic rather than a default: webpack's HMR desynchronises here and serves `__webpack_modules__[moduleId] is not a function` until `.next` is wiped. If you find yourself needing the hatch, that is worth a spec note rather than a habit. The editor on webpack also runs without the React Compiler, whose native Rust port is Turbopack-only ([React state and effects](../specs/003-system-architecture/react-state-and-effects.md)), so a render bug seen only on one bundler may be the compiler.

- **`/licences` needs its generated data.** `corepack pnpm dev` does not run the generator (it takes about 20 seconds), so the marketing dev server fails that one page with `LicencesManifestMissing` until you run `corepack pnpm licences` once. Don't run `corepack pnpm licences` while a `next build` of the editor or help centre is running: Next's analyzer shares an app's Turbopack build cache (`.next/cache`), and two processes on it corrupt it. `corepack pnpm build` orders them for you.

- **The api worker's local Durable Object state lives under `apps/api/.wrangler/state/`.** Delete the folder to start over with no documents.

- **Open the editor on `localhost`, not on the machine's LAN address.** Over plain `http` from any other address (`http://192.168.x.x:3302`, `http://<machine-name>:3302`) the browser is not in a secure context, withholds `crypto.randomUUID`, and the editor fails to load with "This page couldn't load". The editor calls `crypto.randomUUID` directly in 25 places in its app code, so testing from a phone or a second laptop needs https (a tunnel, or a dev certificate).
