# Local development

How to run liveplanner on your machine.

## Requirements

- **Node** `>= 22` (Wrangler 4 requires it).
- **pnpm** `>= 9` (the lockfile and workspaces depend on it).

Cloudflare is not required for local development. The api worker runs locally via Wrangler, its Durable Objects in local SQLite files; the Next.js apps run via Next's dev server.

## Clone and install

The repository is private; clone it from the URL you were given access to.

```sh
git clone <repository-url> liveplanner
cd liveplanner
pnpm install
```

This installs every workspace at once, including TypeScript 7 ([Engineering notes](engineering-notes.md#typescript)).

## Run everything

```sh
pnpm dev
```

Turbo spins up all eight dev servers in parallel:

| App              | Dev URL                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `apps/router`    | `http://localhost:3200` — **everything on one port**, stitched like production                     |
| `apps/marketing` | `http://localhost:3201`                                                                            |
| `apps/editor`    | `http://localhost:3202` (clean routes: /new, /explorer, ...)                                       |
| `apps/help`      | `http://localhost:3204/help`                                                                       |
| `apps/api`       | `http://localhost:8887/api`                                                                        |
| `apps/mcp`       | `http://localhost:8888` (MCP server, [MCP server](../specs/015-api/mcp-server.md); signed-in only) |

The `router` dev server (`wrangler dev --env local`, port 3200) gives you the production URL shape locally: `/` is marketing, `/new` and `/project/*` are the editor, plus `/telemetry`, `/help` and `/api` — no per-app port to remember. It has no service bindings in dev; the `[env.local]` environment in `apps/router/wrangler.toml` points it at the localhost origins above and it proxies plain HTTP (see [Router app](../specs/016-platform/router-app.md)).

**Use port 3200 unless you have a reason not to.** Each app's own port still serves its pages, but only the router puts the API on the same origin. The frontends call `NEXT_PUBLIC_API_BASE`, defaulting to the relative `/api` — correct in production and behind the router, and a dead end on an app's own port, where nothing serves `/api` (these are static exports; there are no Next API routes, see [Architecture](architecture.md)). So the editor on `http://localhost:3202` cannot reach the api worker until you tell it where the worker is:

```sh
# apps/editor/.env.local  (gitignored; see apps/editor/.env.example)
NEXT_PUBLIC_API_BASE=http://localhost:8887/api
```

A remote api works too, and there are now two of them: `https://staging.liveplanner.app/api`
reaches [staging](../specs/016-platform/staging-environment.md), which has its own data and is
the one to reach for; the production api reads and writes real people's projects.

Without it the editor loads, the canvas works, and the first save fails with **“Couldn’t create the plan”** — which reads like a broken api worker rather than a missing variable, so it is worth setting up front. `apps/help` reads the same variable. Telemetry is liveworkspace's (liveworkspace/docs/specs/008-telemetry/telemetry.md): to see local events, run its service (`wrangler dev` in liveworkspace/apps/telemetry, port 8790) and point the frontends at it with `NEXT_PUBLIC_TELEMETRY_URL=http://localhost:8790/api/telemetry`, and the api and mcp workers with `TELEMETRY_URL` and `TELEMETRY_KEY` in their `.dev.vars`.

The editor works in pure-guest mode without any auth setup: `pnpm dev` and open `http://localhost:3200/new`. Plans persist to the local Durable Object storage the api worker creates on first start. (On `http://localhost:3202/new` instead, set `NEXT_PUBLIC_API_BASE` first — see the note above.)

## Scoping commands to one workspace

```sh
pnpm --filter @liveplanner/editor dev
pnpm --filter @liveplanner/api test
pnpm --filter @liveplanner/marketing build
```

Workspace names follow the pattern `@liveplanner/<app-or-package-folder-name>`.

## Useful scripts

Run from the repo root:

| Command                                                        | What it does                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                                                 | Install all workspace deps.                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm dev`                                                     | Start all dev servers in parallel (`turbo run dev`).                                                                                                                                                                                                                                                                                                                                      |
| `pnpm build`                                                   | Production build across the repo (`turbo run build`).                                                                                                                                                                                                                                                                                                                                     |
| `pnpm lint`                                                    | oxlint across the repo (`turbo run lint`).                                                                                                                                                                                                                                                                                                                                                |
| `pnpm typecheck`                                               | `tsc --noEmit` across every workspace (`turbo run typecheck`).                                                                                                                                                                                                                                                                                                                            |
| `pnpm test`                                                    | Vitest across every workspace that has tests (`turbo run test`).                                                                                                                                                                                                                                                                                                                          |
| `pnpm --filter @liveplanner/editor perf:canvas`                | The canvas performance probe ([Canvas performance](../specs/008-canvas/canvas-performance.md)): builds the 1,000-element reference board, traces every gesture at 4x CPU and writes the budget table to `apps/editor/test-results/perf/`. Needs a fresh `next build`; set `E2E_EDITOR_PORT` / `E2E_API_PORT` / `E2E_BASE_URL` to run beside a `pnpm dev`. Reports, never fails on a miss. |
| `pnpm --filter @liveplanner/editor test:e2e`                   | Playwright end-to-end suite ([End-to-end tests](../specs/003-system-architecture/e2e-smoke.md)); reuses a running `pnpm dev` or boots its own stack. Set `E2E_WEBKIT=1` (after `npx playwright install webkit`) to also run the image import spec in WebKit.                                                                                                                              |
| `pnpm --filter @liveplanner/editor test:e2e:signed-in`         | The signed-in specs (`apps/editor/e2e/signed-in/`) against `.next/out-signed-in/`; run `pnpm --filter @liveplanner/editor build:signed-in` first. Boots its own stack on `:3215` / `:8225` / `:3216`.                                                                                                                                                                                     |
| `pnpm --filter @liveplanner/cli build`                         | Bundle the CLI into `apps/cli/dist/liveplanner.mjs` (see [Running the CLI from source](#running-the-cli-from-source-optional)).                                                                                                                                                                                                                                                           |
| `pnpm format`                                                  | Prettier write across the repo.                                                                                                                                                                                                                                                                                                                                                           |
| `pnpm format:check`                                            | Prettier check (this is what CI runs).                                                                                                                                                                                                                                                                                                                                                    |
| `pnpm staging:check`                                           | Dry-run the `[env.staging]` wrangler configs and print the resolved bindings (CI runs it).                                                                                                                                                                                                                                                                                                |
| `pnpm licences`                                                | Regenerate the `/licences` page data (`apps/marketing/generated/`, `public/licences/`) from what every app bundles ([Third-party licences](../specs/002-project-scope/third-party-licences.md)); the marketing build runs it itself.                                                                                                                                                      |
| `pnpm icons:vendor`                                            | Regenerate the vendored Lucide glyphs from `../packages/icons/lucide-manifest.json` ([Iconography](../specs/004-interface-design/iconography.md)).                                                                                                                                                                                                                                        |
| `pnpm icons:sheet`                                             | Render every editor icon at 1x and 4x into HTML + PNG contact sheets (`$ICON_SHEET_DIR`, default `/tmp/icon-sheet`) for review.                                                                                                                                                                                                                                                           |
| `pnpm --filter @liveplanner/project stroke-points <file.json>` | Print a stored tab or project file with every freehand's `packedPoints` expanded into readable `{ nx, ny, p }` points (`-` reads stdin).                                                                                                                                                                                                                                                  |

Turbo caches results, so re-running with no changes is a no-op.

## Signing in locally (optional)

The editor always offers sign-in, and works as a guest when the api has no accounts settings. To exercise the signed-in code paths, run liveworkspace beside it and register liveplanner with its accounts API:

1. Start liveworkspace (first-time setup is in `liveworkspace/README.md`, "Local development"): `pnpm dev:workspace` from the repo root runs the site, with the sign-in pages, on `http://localhost:3000`, and the accounts and telemetry Workers behind it, as liveworkspace.app has them. Locally the accounts Worker prints each sign-in code in its own output instead of emailing it.
2. Register liveplanner once against it. `http://localhost/api` is the one resource a development accounts Worker issues tokens for (`RESOURCES` in liveworkspace/apps/accounts/src/resources.ts), and `--app liveplanner.app` is the app the client speaks for: the accounts Worker keeps liveplanner's own settings and sign-ups under it. The secret is printed once:

   ```sh
   ADMIN_TOKEN=local-admin-token node liveworkspace/apps/accounts/scripts/register-client.ts \
     --accounts http://localhost:3000 \
     --name liveplanner-dev \
     --app liveplanner.app \
     --redirect http://localhost:3200/api/auth/callback \
     --resource http://localhost/api
   ```

3. Drop the values into the two env files:

   ```sh
   # apps/api/.dev.vars (gitignored)
   ACCOUNTS_URL=http://localhost:3000
   API_RESOURCE=http://localhost/api
   ACCOUNTS_CLIENT_ID=...
   ACCOUNTS_CLIENT_SECRET=...
   AUTH_ORIGIN=http://localhost:3200
   ```

4. Restart `pnpm dev` and open the app through the router (`http://localhost:3200`), so the sign-in cookies and the callback share one origin.

With these set, `/sign-in` hands off to the accounts site and comes back signed in, and a guest gets a liveworkspace guest token through the same site (`/api/auth/guest`, back to `/auth/guest`). The api worker verifies either token and takes the owner id from its `sub` claim.

Without these set: the api worker treats every request as a link visitor (there is no guest identity without the accounts site), and the live frontend mounts no session bridge, so it renders the editor without any auth UI.

### The index

The Explorer, sharing and access are liveworkspace's index ([One Explorer](../../../liveworkspace/docs/specs/004-index/one-explorer.md)). Run it from the monorepo (`corepack pnpm dev:index`, port 8793; [the index](../../../liveworkspace/docs/specs/004-index/index-service.md) "Running it locally"), and give the api worker `INDEX_ORIGIN=http://127.0.0.1:8793` and `INDEX_KEY=dev-liveplanner-index-key` in `apps/api/.dev.vars` (see `apps/api/.env.example`). The router forwards `/api/index/*` there. Without it, the Explorer has nothing to list and a plan cannot be opened from the server. This is the default for any deployment without sign-in configured. See [Auth + guest access](../specs/014-identity/auth-and-guest-access.md) for the full hybrid model.

## Running the CLI from source (optional)

The [CLI](../specs/015-api/cli.md) acts only with an API token, so it needs a host with sign-in: enable sign-in as
above, sign in, and create a token in Settings › API Tokens. Then build the bundle and point it at the local api:

```bash
pnpm --filter @liveplanner/cli build
export LIVEPLANNER_HOST=http://localhost:8887 LIVEPLANNER_TOKEN=lwt_...
apps/cli/dist/liveplanner.mjs project ls
```

`LIVEPLANNER_DEBUG=1` prints each decision and request as a `[cli]` line on stderr. The CLI keeps its files under
`$XDG_CONFIG_HOME/liveplanner` and `$XDG_CACHE_HOME/liveplanner` (`~/.config` and `~/.cache` by default); point
both at a scratch directory to keep a test run apart from your own sign-in.

## Running tests

```sh
pnpm test                                # everything
pnpm --filter @liveplanner/api test      # one workspace
pnpm --filter @liveplanner/editor exec vitest   # watch mode while developing
```

Tests live alongside the code they cover, as `*.test.ts` / `*.test.tsx` files. The test runner is [Vitest](https://vitest.dev) with the shared config from `@liveworkspace/vitest-config`. See [Testing](../specs/003-system-architecture/testing.md) for the testing contract.

Workbench embeds have an opt-in end-to-end run ([Workbench embeds](../specs/013-workspace/workbench-embeds.md)): `pnpm --filter @liveplanner/editor test:e2e:workbench`. It rebuilds `apps/editor/out` with the test-only session bridge (`NEXT_PUBLIC_E2E_AUTH=1`), then boots the e2e stack with `E2E_WORKBENCH=1` on its own ports (live 3221, api 8235, marketing 3222): the stack acts as the accounts Worker (as under `E2E_ACCOUNTS_STUB`, minting access tokens on `/e2e/token`) and gives the api worker `APP_BASE_URL=http://localhost:3221`, so its workbench and pairing URLs point at the live server. The spec serves a fake workbench (`apps/editor/e2e/fixtures/fake-workbench.html`) from `127.0.0.1` on a free port, pairs it on the pairing page, and frames `/embed/workbench` in it; `workbench-workspace.spec.ts` pairs it again for the whole workspace and frames `/embed/workbench/explorer`, whose places (`/embed/workbench/explorer/**`, `/embed/workbench/project/**`) the stack serves from that one page, as the editor worker does. Since pairing, tickets and sessions moved to liveworkspace's accounts Worker ([liveworkspace/docs/specs/011-workbench/workbench.md](../../../liveworkspace/docs/specs/011-workbench/workbench.md)), the run also needs that Worker and liveworkspace.app's pairing page, which the stack does not start yet: until it does, the run stops at its first mint.

## Serving the editor beside a running stack

The e2e stack (`scripts/e2e-stack.mjs`) can serve the built editor a second
time, beside a running stack:

```bash
E2E_EDITOR_PORT=3202 E2E_API_PORT=8887 E2E_EDITOR_ONLY=1 node scripts/e2e-stack.mjs
```

`E2E_EDITOR_ONLY=1` serves the static editor only, proxying to the api already
on `E2E_API_PORT`.

`E2E_EDITOR_OUT=<dir>` serves another export of the editor app (the signed-in specs use
`.next/out-signed-in`), and `E2E_ACCOUNTS_STUB=1` makes the stack stand in for the accounts Worker:
the api verifies access tokens the stack mints on `/e2e/token?sub=user_…` ([End-to-end tests](../specs/003-system-architecture/e2e-smoke.md)).

## Four gotchas

- **All three Next.js dev servers (`marketing`, `live`, `help`) run through `scripts/next-dev.mjs`.** It frees the port and points dev at an isolated `.next-dev/` cache, so a `next build` running in the same checkout can't corrupt the dev server (the recurring "unstyled help page" / `Cannot find module './NNNN.js'` failures). The cache is kept between starts: Turbopack's file-system cache reuses the last session's compilation (a warm start serves its first page in about a second) and reconciles a route restructure by itself, and `turbopackGc` keeps it from growing stale ([Next.js](../specs/016-platform/nextjs.md) "The Turbopack cache"). A cache that goes wrong is a bug to fix, not something to wipe away. All four run on Turbopack, which is also what `next build` uses under Next 16, so dev compiles the same way the deployed bundle does. Every app's settings come from `@liveworkspace/next-config` (`liveworkspaceNextConfig`), so a change to them lands in all four at once.

  `help` was pinned to webpack until the Next 16 upgrade, because Turbopack's Rust MDX pipeline ignores remark/rehype plugins handed over as imported JS functions and its pipe tables rendered as literal text. `apps/help/next.config.ts` now names `remark-gfm` as a string (`remarkPlugins: [['remark-gfm', {}]]`), which Turbopack resolves itself, so the tables survive. Keep that string form: importing the plugin back fails the build outright under Turbopack with "does not have serializable options".

  Next 16 also writes `next-env.d.ts` into whichever app you run it from, gitignored on purpose: it names the active distDir inside itself, so dev and build would otherwise rewrite it over each other, and each app's tsconfig already picks up the Next types without it being tracked. Next can also generate an `AGENTS.md` + `CLAUDE.md` pair of agent instructions; the shared config turns that off (`agentRules: false`), because the repo's agent instructions are written by hand in the root `AGENTS.md`. Any old generated pair left in an app folder stays gitignored and can be deleted.

  The webpack escape hatch is still there — `pnpm --filter @liveplanner/editor dev:webpack` boots the editor on webpack, and `scripts/next-dev.mjs` honours `--webpack` from any app. It exists for the case where Turbopack genuinely doesn't support something the app needs, and it is a diagnostic rather than a default: Turbopack became the default precisely because webpack's HMR kept desynchronising here and serving `__webpack_modules__[moduleId] is not a function` until someone wiped `.next`. If you find yourself needing the hatch, that is worth a spec note rather than a habit. The editor on webpack also runs without the React Compiler, whose native Rust port is Turbopack-only ([React state and effects](../specs/003-system-architecture/react-state-and-effects.md)), so a render bug seen only on one bundler may be the compiler.

- **`/licences` needs its generated data.** `pnpm dev` does not run the generator (it takes about 20 seconds), so the marketing dev server fails that one page with `LicencesManifestMissing` until you run `pnpm licences` once. Don't run `pnpm licences` while a `next build` of the editor, help centre or telemetry dashboard is running: Next's analyzer shares an app's Turbopack build cache (`.next/cache`), and two processes on it corrupt it. `pnpm build` orders them for you.

- **The api worker's local state lives under `apps/api/.wrangler/state/v3/`** (each plan's and each person's Durable Object). Delete the folder to start over empty.

- **Open the editor on `localhost`, not on the machine's LAN address.** Over plain `http` from any other address (`http://192.168.x.x:3202`, `http://<machine-name>:3202`) the browser is not in a secure context, withholds `crypto.randomUUID`, and the editor fails to load with "This page couldn't load". A known gap, not yet fixed: the editor calls `crypto.randomUUID` directly in about 75 places. Testing from a phone or a second laptop needs https (a tunnel, or a dev certificate) until it is.
