# Local development

How to run livediagram on your machine.

## Requirements

- **Node** `>= 22` (Wrangler 4 requires it).
- **pnpm** `>= 9` (the lockfile and workspaces depend on it).

Cloudflare is not required for local development. The api worker runs locally via Wrangler, its Durable Objects (one per document, one per person) kept in Wrangler's local state; the Next.js apps run via Next's dev server.

## Clone and install

```sh
git clone https://github.com/livediagram-app/livediagram.app livediagram
cd livediagram
pnpm install
```

This installs every workspace at once, including TypeScript 7 ([Contributing](contributing.md#typescript)).

## No database to set up

The api worker has no D1 database and no migrations. Each Durable Object makes its own schema the first time it is
used, so a fresh clone needs nothing applied before `pnpm dev`. Wrangler keeps their local state under
`apps/api/.wrangler/state/`.

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

The `router` dev server (`wrangler dev --env local`, port 3100) gives you the production URL shape locally: `/` is marketing, `/new` and `/document/*` are the editor, plus `/telemetry`, `/help`, `/community`, and `/api` — no per-app port to remember. It has no service bindings in dev; the `[env.local]` environment in `apps/router/wrangler.toml` points it at the localhost origins above and it proxies plain HTTP (see [Router app](../specs/016-platform/router-app.md)).

**Use port 3100 unless you have a reason not to.** Each app's own port still serves its pages, but only the router puts the API on the same origin. The frontends call `NEXT_PUBLIC_API_BASE`, defaulting to the relative `/api` — correct in production and behind the router, and a dead end on an app's own port, where nothing serves `/api` (these are static exports; there are no Next API routes, see [Architecture](architecture.md)). So the editor on `http://localhost:3102` cannot reach the api worker until you tell it where the worker is:

```sh
# apps/editor/.env.local  (gitignored; see apps/editor/.env.example)
NEXT_PUBLIC_API_BASE=http://localhost:8687/api
```

A remote api works too, and there are now two of them: `https://staging.livediagram.app/api`
reaches [staging](../specs/016-platform/staging-environment.md), which keeps its own data and is
the one to reach for; the production api reads and writes real people's documents.

Without it the editor loads, the canvas works, and the first save fails with **“Couldn’t create the document”** — which reads like a broken api worker rather than a missing variable, so it is worth setting up front. `apps/help` and `apps/community` read the same variable: the Community needs it for My Shares on `:3105` (its gallery reads liveworkspace's Community service: see below), and the help centre only loses its telemetry posts without it.

The editor works in pure-guest mode without any auth setup: `pnpm dev` and open `http://localhost:3100/new`. Documents persist in each document's local Durable Object, with the index running locally (see [The index](#the-index) below). (On `http://localhost:3102/new` instead, set `NEXT_PUBLIC_API_BASE` first — see the note above.)

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
| `pnpm --filter @livediagram/editor test:e2e:signed-in`                    | The signed-in specs (`apps/editor/e2e/signed-in/`) against `.next/out-signed-in/`; run `pnpm --filter @livediagram/editor build:signed-in` first. Boots its own stack on `:3115` / `:8115` / `:3116`.                                                                                                                                                                                     |
| `cd apps/editor && bun scripts/ms-whiteboard-verify.mts <folder or .zip>` | Runs the [Microsoft Whiteboard import](../specs/020-import-export/whiteboard-import.md) over real board exports outside the repo and prints counts only (boards, replay stats, items per kind, report notes, timings, largest tab), never their content.                                                                                                                                  |
| `pnpm --filter @livediagram/cli build`                                    | Bundle the CLI into `apps/cli/dist/livediagram.mjs` (see [Running the CLI from source](#running-the-cli-from-source-optional)).                                                                                                                                                                                                                                                           |
| `pnpm format`                                                             | Prettier write across the repo.                                                                                                                                                                                                                                                                                                                                                           |
| `pnpm format:check`                                                       | Prettier check (this is what CI runs).                                                                                                                                                                                                                                                                                                                                                    |
| `pnpm staging:check`                                                      | Dry-run the `[env.staging]` wrangler configs and print the resolved bindings (CI runs it).                                                                                                                                                                                                                                                                                                |
| `pnpm licences`                                                           | Regenerate the `/licences` page data (`apps/marketing/generated/`, `public/licences/`) from what every app bundles ([Third-party licences](../specs/002-project-scope/third-party-licences.md)); the marketing build runs it itself.                                                                                                                                                      |
| `pnpm icons:vendor`                                                       | Regenerate the vendored Lucide glyphs from `../packages/icons/lucide-manifest.json` ([Iconography](../specs/004-interface-design/iconography.md)).                                                                                                                                                                                                                                        |
| `pnpm icons:sheet`                                                        | Render every editor icon at 1x and 4x into HTML + PNG contact sheets (`$ICON_SHEET_DIR`, default `/tmp/icon-sheet`) for review.                                                                                                                                                                                                                                                           |
| `pnpm demo:sticky-vision`                                                 | Bundle + serve the sticky-detection demo at <http://localhost:4199> ([Event storming](../specs/021-event-storming/event-storming.md)).                                                                                                                                                                                                                                                    |
| `pnpm bench:stroke-points`                                                | Measure packed stroke points against the former `{ nx, ny }` shape on a synthesised board: tab bytes, allocations, parse and draw time, accuracy ([Stroke points](../specs/006-document/stroke-points.md)).                                                                                                                                                                               |
| `pnpm --filter @livediagram/document stroke-points <file.json>`           | Print a stored tab or document file with every freehand's `packedPoints` expanded into readable `{ nx, ny, p }` points (`-` reads stdin).                                                                                                                                                                                                                                                 |

Turbo caches results, so re-running with no changes is a no-op.

## Signing in locally (optional)

The editor always offers sign-in, but signing in (and a guest identity) needs an accounts Worker. To exercise the signed-in code paths, run liveworkspace beside it and register livediagram with its accounts API:

1. Start liveworkspace (first-time setup is in `liveworkspace/README.md`, "Local development"): `pnpm dev:workspace` from the repo root runs the site, with the sign-in pages, on `http://localhost:3000`, and the accounts and telemetry Workers behind it, as liveworkspace.app has them. Locally the accounts Worker prints each sign-in code in its own output instead of emailing it.
2. Register livediagram once against it. `http://localhost/api` is the one resource a development accounts Worker issues tokens for (`RESOURCES` in liveworkspace/apps/accounts/src/resources.ts). The secret is printed once:

   ```sh
   ADMIN_TOKEN=local-admin-token node liveworkspace/apps/accounts/scripts/register-client.ts \
     --accounts http://localhost:3000 \
     --name livediagram-dev \
     --app livediagram.app \
     --redirect http://localhost:3100/api/auth/callback \
     --resource http://localhost/api
   ```

3. Drop the values into the api's env file:

   ```sh
   # apps/api/.dev.vars (gitignored)
   ACCOUNTS_URL=http://localhost:3000
   API_RESOURCE=http://localhost/api
   ACCOUNTS_CLIENT_ID=...
   ACCOUNTS_CLIENT_SECRET=...
   AUTH_ORIGIN=http://localhost:3100
   ```

4. Restart `pnpm dev` and open the app through the router (`http://localhost:3100`), so the sign-in cookies and the callback share one origin.

With these set, `/sign-in` hands off to the accounts site and comes back signed in. The api worker verifies the access token and derives the owner id from the `sub` claim. The same accounts Worker mints guests their guest tokens, through `/api/auth/guest`. `--app livediagram.app` names the app the client is for: the accounts Worker keeps livediagram's settings, sign-ups and milestone emails under it. With the client registered, every person's preferences, display name and colour live in the accounts Worker's local D1 (`liveworkspace/apps/accounts`), guests' included; without it, the preferences stay in the browser and names are not kept on the server.

Without these set: nobody can sign in, and there are no guests either, because a guest's identity is a guest token the accounts Worker mints (`/api/auth/guest` returns to `/auth/guest#error=guest_not_configured`). The editor still opens and documents in This Browser work, but no document can be kept on the server. Run the accounts Worker locally for anything beyond that. See [Auth + guest access](../specs/014-identity/auth-and-guest-access.md) for the full hybrid model.

### The index

The Explorer, sharing, access, the Trash and the Timeline are liveworkspace's index ([One Explorer](../../../liveworkspace/docs/one-explorer.md)). Run it from the monorepo (`corepack pnpm dev:index`, port 8793; [the index](../../../liveworkspace/docs/index-service.md) "Running it locally"), and give the api worker `INDEX_ORIGIN=http://127.0.0.1:8793` and `INDEX_KEY=dev-livediagram-index-key` in `apps/api/.dev.vars` (see `apps/api/.env.example`). The router forwards `/api/index/*` there. Without it, the Explorer has nothing to list and a document cannot be opened from the server.

## Running the CLI from source (optional)

The [CLI](../specs/015-api/cli.md) acts only with an API token, so it needs a host with sign-in: enable sign-in as
above, sign in, and create a token on your local liveworkspace site (Settings › API Tokens links there). Then build the bundle and point it at the local api:

```bash
pnpm --filter @livediagram/cli build
export LIVEDIAGRAM_HOST=http://localhost:8687 LIVEDIAGRAM_TOKEN=lwt_...
apps/cli/dist/livediagram.mjs document ls
```

`LIVEDIAGRAM_DEBUG=1` prints each decision and request as a `[cli]` line on stderr. The CLI keeps its files under
`$XDG_CONFIG_HOME/livediagram` and `$XDG_CACHE_HOME/livediagram` (`~/.config` and `~/.cache` by default); point
both at a scratch directory to keep a test run apart from your own sign-in.

## Enabling the photo reader locally (optional)

The event-storming photo import reads the handwriting on each sticky in the browser unless the api worker has a model key, in which case a hosted model reads it instead, markedly better ([Note reader](../specs/021-event-storming/note-reader.md)). To turn the server reader on locally:

```sh
# apps/api/.dev.vars (gitignored).
GOOGLE_AI_STUDIO_API_KEY=...   # the reader defaults to gemini-2.5-flash-lite
# AI_API_KEY=...               # or any other OpenAI-compatible provider, used only when
# AI_BASE_URL=http://127.0.0.1:8080/v1  # the Google key is not set; needs both of these
# AI_VISION_MODEL=...          # the reader's model; required for AI_API_KEY, optional on Google
```

Restart `pnpm dev`. `GET /api/capabilities` will start reporting `{ aiEnabled: true }` and the photo import sends its crops to the server reader. The two spend-DoS knobs `AI_ALLOWED_ORIGINS` and `AI_REQUIRE_SIGN_IN` are hosted-only; leave them unset locally so the guest path keeps working. Production declares `AI_ALLOWED_ORIGINS` in `apps/api/wrangler.toml` `[vars]`, which `wrangler dev` also reads, so the api's `dev` script (and the e2e stack) blank it with `--var AI_ALLOWED_ORIGINS:`; without that, every reader request from a localhost editor answers 403 `origin_not_allowed`. See `apps/api/.env.example` for the full set of vars the worker reads.

## Running tests

```sh
pnpm test                                # everything
pnpm --filter @livediagram/api test      # one workspace
pnpm --filter @livediagram/editor exec vitest   # watch mode while developing
```

Tests live alongside the code they cover, as `*.test.ts` / `*.test.tsx` files. The test runner is [Vitest](https://vitest.dev) with the shared config from `@liveworkspace/vitest-config`. See [Testing](../specs/003-system-architecture/testing.md) for the testing contract.

The Google Drive mirror has an opt-in end-to-end run against the fake Google ([Google Drive mirror](../specs/022-drive-mirror/drive-mirror.md)): `pnpm --filter @livediagram/editor test:e2e:drive`. It rebuilds `apps/editor/out` with the test-only session bridge (`NEXT_PUBLIC_E2E_AUTH=1`) and a test client id, then boots the e2e stack with `E2E_DRIVE=1`, which gives the api worker test values for `ACCOUNTS_URL`, `API_RESOURCE`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DRIVE_TOKEN_KEY` and `GOOGLE_OAUTH_BASE_URL`. The test stands in for the accounts Worker's JWKS (port 8795) and the fake Google (8796) itself. Rebuild the editor app normally before running the ordinary e2e again, and stop any `pnpm dev` on port 3102 first (or set `E2E_EDITOR_PORT`, `E2E_API_PORT`, `E2E_MARKETING_PORT` and `E2E_BASE_URL`), since Playwright reuses a running server.

`pnpm --filter @livediagram/editor test:e2e:drive-shots` uses the same build and stack to screenshot every Drive state (Settings > Account > Cloud Sync in every phase, Open with, the Explorer following a change made in Drive) in light and dark at 1280 x 800 (`E2E_DRIVE_SHOTS_SCALE=2` for 2x, `E2E_DRIVE_SHOTS_NARROW=1` for the phone layout), into `E2E_DRIVE_PR_SHOTS` (default `/tmp/ld-drive-pr-shots`) with a `README.md` naming each file. Run it on its own: it serves the same fake Google port as `test:e2e:drive`.

Workbench embeds have an opt-in end-to-end run ([Workbench embeds](../specs/013-workspace/workbench-embeds.md)): `pnpm --filter @livediagram/editor test:e2e:workbench`. It rebuilds `apps/editor/out` with the test-only session bridge (`NEXT_PUBLIC_E2E_AUTH=1`), then boots the e2e stack with `E2E_WORKBENCH=1` on its own ports (editor 3121, api 8121, marketing 3122): the stack acts as the accounts Worker (as under `E2E_ACCOUNTS_STUB`, minting access tokens on `/e2e/token`) and gives the api worker `APP_BASE_URL=http://localhost:3121`, so its workbench and pairing URLs point at the editor server. The spec serves a fake workbench (`apps/editor/e2e/fixtures/fake-workbench.html`) from `127.0.0.1` on a free port, pairs it on the pairing page, and frames `/embed/workbench` in it; `workbench-workspace.spec.ts` pairs it again for the whole workspace and frames `/embed/workbench/explorer`, whose places (`/embed/workbench/explorer/**`, `/embed/workbench/document/**`) the stack serves from that one page, as the editor worker does. Since pairing, tickets and sessions moved to liveworkspace's accounts Worker ([liveworkspace/docs/workbench.md](../../../liveworkspace/docs/workbench.md)), the run also needs that Worker and liveworkspace.app's pairing page, which the stack does not start yet: until it does, the run stops at its first mint.

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
E2E_EDITOR_PORT=3110 E2E_API_PORT=8687 E2E_EDITOR_ONLY=1 E2E_NO_AI=1 node scripts/e2e-stack.mjs
```

`E2E_EDITOR_ONLY=1` serves the static editor only, proxying to the api already
on `E2E_API_PORT`; `E2E_NO_AI=1` answers `/api/capabilities` with
`aiEnabled: false`.

`E2E_EDITOR_OUT=<dir>` serves another export of the editor app (the signed-in specs use
`.next/out-signed-in`). The stack stands in for the accounts Worker unless `E2E_ACCOUNTS_STUB=0`
(the Drive run serves its own): it keeps settings and profiles in memory, and the api verifies access
tokens the stack mints on `/e2e/token?sub=user_…` ([End-to-end tests](../specs/003-system-architecture/e2e-smoke.md)).

To try a hosted reader whose free budget is spent, swap `E2E_NO_AI=1` for
`E2E_AI_BUDGET_SPENT=1`: the api still reports a model, every
`/api/ai/read-notes` call answers 429 `ai_quota`, and the import fails over
to the in-browser model and says so ([Event storming](../specs/021-event-storming/event-storming.md) Phase 9).

## Four gotchas

- **All four Next.js dev servers (`marketing`, `editor`, `help`, `community`) run through `scripts/next-dev.mjs`.** It frees the port and points dev at an isolated `.next-dev/` cache, so a `next build` running in the same checkout can't corrupt the dev server (the recurring "unstyled help page" / `Cannot find module './NNNN.js'` failures). The cache is kept between starts: Turbopack's file-system cache reuses the last session's compilation (a warm start serves its first page in about a second) and reconciles a route restructure by itself, and `turbopackGc` keeps it from growing stale ([Next.js](../specs/016-platform/nextjs.md) "The Turbopack cache"). A cache that goes wrong is a bug to fix, not something to wipe away. All four run on Turbopack, which is also what `next build` uses under Next 16, so dev compiles the same way the deployed bundle does. Every app's settings come from `@liveworkspace/next-config` (`liveworkspaceNextConfig`), so a change to them lands in all four at once.

  `help` was pinned to webpack until the Next 16 upgrade, because Turbopack's Rust MDX pipeline ignores remark/rehype plugins handed over as imported JS functions and its pipe tables rendered as literal text. `apps/help/next.config.ts` now names `remark-gfm` as a string (`remarkPlugins: [['remark-gfm', {}]]`), which Turbopack resolves itself, so the tables survive. Keep that string form: importing the plugin back fails the build outright under Turbopack with "does not have serializable options".

  Next 16 also writes `next-env.d.ts` into whichever app you run it from, gitignored on purpose: it names the active distDir inside itself, so dev and build would otherwise rewrite it over each other, and each app's tsconfig already picks up the Next types without it being tracked. Next can also generate an `AGENTS.md` + `CLAUDE.md` pair of agent instructions; the shared config turns that off (`agentRules: false`), because the repo's agent instructions are written by hand in the root `AGENTS.md`. Any old generated pair left in an app folder stays gitignored and can be deleted.

  The webpack escape hatch is still there — `pnpm --filter @livediagram/editor dev:webpack` boots the editor on webpack, and `scripts/next-dev.mjs` honours `--webpack` from any app. It exists for the case where Turbopack genuinely doesn't support something the app needs, and it is a diagnostic rather than a default: Turbopack became the default precisely because webpack's HMR kept desynchronising here and serving `__webpack_modules__[moduleId] is not a function` until someone wiped `.next`. If you find yourself needing the hatch, that is worth a spec note rather than a habit. The editor on webpack also runs without the React Compiler, whose native Rust port is Turbopack-only ([React state and effects](../specs/003-system-architecture/react-state-and-effects.md)), so a render bug seen only on one bundler may be the compiler.

- **`/licences` needs its generated data.** `pnpm dev` does not run the generator (it takes about 20 seconds), so the marketing dev server fails that one page with `LicencesManifestMissing` until you run `pnpm licences` once. Don't run `pnpm licences` while a `next build` of the editor or help centre is running: Next's analyzer shares an app's Turbopack build cache (`.next/cache`), and two processes on it corrupt it. `pnpm build` orders them for you.

- **The api worker's local Durable Object state lives at `apps/api/.wrangler/state/`.** Delete the folder to start over with no documents (their index entries live in the local index's own state).

- **Open the editor on `localhost`, not on the machine's LAN address.** Over plain `http` from any other address (`http://192.168.x.x:3102`, `http://<machine-name>:3102`) the browser is not in a secure context, withholds `crypto.randomUUID`, and the editor fails to load with "This page couldn't load". A known gap, not yet fixed: the editor calls `crypto.randomUUID` directly in about 75 places. Testing from a phone or a second laptop needs https (a tunnel, or a dev certificate) until it is.
