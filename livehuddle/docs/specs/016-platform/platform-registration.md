# Platform registration

Status: **proposed**, awaiting the owner's approval (Work Tracker #99).

What it takes to make livehuddle a liveworkspace app: one account, the One Explorer, media, telemetry, the site
switcher, CI and deploys, and its own domain. livehuddle reuses every platform capability and adds no service of
its own (Work Tracker #99: "reuse the platform capabilities as needed").

**Specs first.** Registering an app changes platform code under `packages/` and `liveworkspace/`, which is a platform
change: it updates [liveworkspace/docs/specs](../../../../liveworkspace/docs/specs/README.md) first, then each
service's blueprint, then the code (root AGENTS.md). This PR edits no platform spec; it lists below which ones the
build changes, and in what order.

## The platform specs that change

Each is a step of its own in the [Build plan](../005-project-roadmap/build-plan.md), made before the code it covers.

| Platform spec                                                                              | What changes                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Platform](../../../../liveworkspace/docs/specs/001-platform-scope/platform.md)            | livehuddle joins the list of apps                                                                                                                                                                                                                                                                                                  |
| [Architecture](../../../../liveworkspace/docs/specs/002-architecture/architecture.md)      | The fifth app, its Workers and port block                                                                                                                                                                                                                                                                                          |
| [Sign-in](../../../../liveworkspace/docs/specs/003-accounts/sign-in.md#registering-an-app) | livehuddle's API in `RESOURCES`; the "one account signs you in to ..." line names it                                                                                                                                                                                                                                               |
| [Index](../../../../liveworkspace/docs/specs/004-index/one-explorer.md)                    | `livehuddle` in the index's apps, its noun (Space, Spaces) and its paths in the Explorer                                                                                                                                                                                                                                           |
| [Media](../../../../liveworkspace/docs/specs/006-media/media.md)                           | livehuddle among the apps that upload images                                                                                                                                                                                                                                                                                       |
| [Telemetry](../../../../liveworkspace/docs/specs/008-telemetry/telemetry.md#adding-an-app) | Its vocabulary, key and dashboard, by that spec's "Adding an app" steps                                                                                                                                                                                                                                                            |
| [Status](../../../../liveworkspace/docs/specs/009-status/README.md)                        | Its checks: the site, the api and livehuddle's MCP server (`MCP_DEV_PORTS`, `9088` locally, `mcp.livehuddle.app` live), as every app's (owner, 2026-11-02; [Open decisions](../005-project-roadmap/open-decisions.md) D3)                                                                                                          |
| [Site switcher](../../../../liveworkspace/docs/specs/010-site/site-switcher.md)            | One row: livehuddle's name, URL, pitch and colours                                                                                                                                                                                                                                                                                 |
| [Workbench](../../../../liveworkspace/docs/specs/011-workbench/workbench.md)               | livehuddle as a fifth editor on the shared workbench                                                                                                                                                                                                                                                                               |
| [Community](../../../../liveworkspace/docs/specs/007-community/community.md#adding-an-app) | **In v1** (owner, 2026-11-02; Work Tracker #184), by that spec's "Adding an app" steps: `livehuddle.app` in `COMMUNITY_APPS` with its own categories for meetings and workshops, a `COMMUNITY_KEY_LIVEHUDDLE` key (**owner only**), the api's Community routes, the `community` app's pages, and `communityPath` in its `AppItems` |
| [Drive](../../../../liveworkspace/docs/specs/005-drive/drive.md)                           | **In v1** (owner, 2026-11-02; Work Tracker #326): livehuddle among the mirrored apps, a Space as a `.livehuddle` file (`application/vnd.livehuddle+json`, its `livehuddle.document` envelope) in the person's one folder tree; signed-in people only                                                                               |

## Registration steps, by service

In the order the build makes them (code locations as on `main` today):

1. **Sites and brand.** `packages/sites/src/index.ts`: `SiteId`, `LOCAL_PORTS` (`'livehuddle.app': 3500`), an
   `APP_SITES` row, `AppName` and its `AppItems` (noun **Space**, `apiNoun: 'document'`, This Browser at
   `/explorer/offline` with its conversions, its shape libraries' `shapeLibrariesPath` (`/api/shape-libraries`, for the
   Explorer's Shape Libraries), and the Community's `communityPath`). `packages/brand/src/apps.ts`: the `BrandApp` entry with its prism tint
   ([Open decisions](../005-project-roadmap/open-decisions.md) D5).
2. **Accounts.** `liveworkspace/apps/accounts/src/resources.ts` (production and staging API resources),
   `clients.ts` (the accepted apps), `email.ts` (the sign-in email's list of apps), `telemetry.ts` (its key name).
   Then the client is registered once per environment with `register-client.ts`, and its secret set on livehuddle's
   api Worker: **owner only** ([Integrating an app](../../../../liveworkspace/docs/specs/002-architecture/integrating-an-app.md)).
3. **Index.** `packages/index-client/src/constants.ts` (`APPS` and the noun), and the index Worker's env and
   `wrangler.toml` (the app's origins and its service binding).
4. **Media.** `packages/media/src/apps.ts`, and the media Worker's env and `wrangler.toml`.
5. **Telemetry.** `packages/telemetry/src/apps.ts` (`TELEMETRY_APPS`, `TELEMETRY_APP_ORIGINS`), the telemetry
   Worker's vocabulary and env, a `TELEMETRY_KEY_LIVEHUDDLE` secret (**owner only**), and its dashboard under the
   site's `/telemetry`.
6. **Settings.** `packages/settings/src/device.ts` (`keysFor('livehuddle')`) and the Settings panel's catalogue in
   `packages/settings-ui`.
7. **Status.** `liveworkspace/packages/status/src/services.ts`: livehuddle's checks, its MCP Worker's local port
   (`9088`) in `MCP_DEV_PORTS` among them (see the Status row above).
8. **Drive.** `packages/drive/src/formats.ts` (`APP_FILE_FORMATS.livehuddle`), the drive Worker's env
   (`DRIVE_KEY_LIVEHUDDLE`, `APP_ORIGIN_LIVEHUDDLE`) and `wrangler.toml` (the origins and livehuddle's API in
   `INDEX_AUDIENCES`). The api's internal door answers the file (`handlers.export`, `format: 'file'`) and the import
   (`handlers.import`), keyed by its `DRIVE_KEY` secret (**owner only**, the service's `DRIVE_KEY_LIVEHUDDLE`). The
   editor's Explorer marks and Settings' Cloud Sync row come from `@liveworkspace/explorer` and
   `@liveworkspace/settings-ui`, shown to an account only.
9. **Community.** `packages/community/src` (`COMMUNITY_APPS`, `COMMUNITY_APP_CATEGORIES.livehuddle.app`), the
   Community Worker's `liveworkspace/apps/community/src/env.ts` and `appKey` (`COMMUNITY_KEY_LIVEHUDDLE`, **owner only**), the Share dialog's words
   in `packages/community-ui`, and `communityPath` in `packages/sites`' `AppItems`. In livehuddle, the api's
   `COMMUNITY_APP` and the `community` app's `CommunitySite` binding name `livehuddle.app`.
10. **Shared marketing and help.** `packages/marketing-site` and `packages/help-site` guards and lists that name every
    app, as the build finds them (`grep` for `livedesign` across `packages/` and `liveworkspace/` is the checklist; on
    `main` today it lists the files above plus `packages/mcp-kit` and `packages/migration`, which v1 leaves alone).

## The monorepo

- **Folder:** `livehuddle/`, in-tree beside the other products, with its own `AGENTS.md`, `docs/` and scripts.
- **Workspace:** `pnpm-workspace.yaml` gains `livehuddle`, `livehuddle/apps/*` and `livehuddle/packages/*`.
- **Scripts:** a root `dev:huddle` (`turbo run dev --filter=@livehuddle/*`), as `dev:design` is.
- **Packages:** `@livehuddle/*`.
- **Layout trees:** README.md and docs/structure.md list `livehuddle/` (this PR adds the planned entry).

## Port block 3500 to 3599

Added to the root AGENTS.md table when the fork lands (`livehuddle | 3500 onward`). As in every product, the
router takes the first port, **3500**, and the other Next.js apps the next ones, keeping livediagram's offsets so the
forked scripts change only their hundreds digit.

Wrangler's own ports sit outside the 35xx block, one range per product (the api at livediagram 8687, liveplanner
8887, livedocuments 8987, livedesign 8989; inspectors at 91xx to 95xx): livehuddle takes **9087** for the api,
**9088** for the MCP, and inspector ports **9630** onward, all free on `main` today.

## CI

**In place since the code fork (build plan step 3), held until launch:**

- **A fifth group** in `.github/scripts/ci-plan.mjs`: `livehuddle`, folder `livehuddle/`, editor
  `@livehuddle/editor` (sharded), and its CLI (`livehuddle/apps/cli`). The
  root-files pattern that reaches everything has `livehuddle` beside the other product folders.
- **Held until launch** (`held: true`): the group runs only when a change touches `livehuddle/` itself or everything
  runs, never because a shared package it uses changed; it has no E2E, and none of its Workers deploy, even with
  **all** (docs/ci.md "Deploys").
- **docs/ci.md**'s group table has the row, and says what held means.
- **The spec checks run** since the specs were forked (step 4): the help app's repo-paths check over `docs/specs/` and
  `docs/`, and the suites that pin prose to code (the router's routes against `016-platform/router-app.md`, the CLI's
  command table against `015-api/cli.md`, the preferences cap against `015-api/api.md`, and the image cap against
  `009-elements/images.md`). Each cut removes the specs of
  what it removes in the same PR, so these stay green.

**At launch (step 8, Work Tracker #189), done:**

- **The hold lifts**: `held: true` comes off, so shared-package changes reach livehuddle's suites and its Workers
  deploy.
- **Real KV namespaces** for the MCP Worker's OAuth state: `livehuddle-mcp-oauth` (production) and
  `livehuddle-mcp-oauth-staging` replace the placeholder ids in `apps/mcp/wrangler.toml`. The api has no D1 (its
  Durable Objects keep everything), so there is no database to create.
- **The bare domain** `livehuddle.app` joins the platform's `APP_BARE_HOSTS`, so the router sends its pages to
  `www.`.
- **The platform's lists**: the site switcher row (its row moves from `HELD_APP_SITES` into `APP_SITES`), which also
  lists it in the Explorer, the Settings panel, the status page and liveworkspace.app's front door, and the sign-in
  email's "one account" line.
- **E2E:** `e2e.yml` calls `e2e-product.yml` for livehuddle when its editor is reached (in place since the fork,
  now planned like any product's).
- **Canvas performance:** livehuddle's probe joins the nightly `canvas-perf.yml`, with an avatar fan-out probe of its
  own ([Build plan](../005-project-roadmap/build-plan.md#risks), R3).
- **Suites that read other workspaces** declare their `$TURBO_ROOT$` inputs in `turbo.json`, as docs/ci.md requires.

## Deploys

Through CI only, never by hand (docs/ci.md "Deploys"), to the liveworkspace Cloudflare account every `wrangler.toml`
pins (`851be7d244b76a6557bcbe6c4ded80f5`):

- First tier (the services and apis): `livehuddle-api` (Durable Objects and their migrations; no D1).
- Second tier (the sites): `livehuddle-mcp`, `livehuddle-editor`, `livehuddle-marketing`, `livehuddle-help`,
  `livehuddle-community`.
- Third tier (the routers): `livehuddle-router`.

Staging is `staging.livehuddle.app`; production is `www.livehuddle.app`, with the bare domain redirecting to `www.`
as every product's does.

## DNS, domain, secrets and billing (owner only)

None of these can be done by an agent. Each is listed in [Open decisions](../005-project-roadmap/open-decisions.md)
D8 so nothing ships waiting on one.

- **Domain:** register `livehuddle.app` (if not already held) and add it as a zone on the liveworkspace Cloudflare
  account, so the router's custom domains (`livehuddle.app`, `www.livehuddle.app`, `staging.livehuddle.app`) can
  attach.
- **Accounts client:** run `register-client.ts` per environment and set `ACCOUNTS_CLIENT_SECRET` on the api Worker.
- **Telemetry key:** set `TELEMETRY_KEY_LIVEHUDDLE` on the telemetry Worker and livehuddle's.
- **Drive key:** one value, set as `DRIVE_KEY_LIVEHUDDLE` on the drive Worker and `DRIVE_KEY` on livehuddle's api;
  and `application/vnd.livehuddle+json` (`.livehuddle`) added to the Google Cloud project's Drive UI MIME types.
- **Community key:** one value (`openssl rand -hex 32`), set as `COMMUNITY_KEY_LIVEHUDDLE` on the Community service
  and as `COMMUNITY_KEY` on livehuddle's api (the `COMMUNITY_KEY` / `COMMUNITY_KEY_STAGING` deploy secrets).
- **Any third-party keys** the fork carries over (Turnstile, Google sign-in origins), added for the new domain.
- **Billing:** Durable Object requests and duration for a fifth product on the account's Workers paid plan; later,
  TURN and SFU usage for audio and video ([Future work](../005-project-roadmap/future-work.md)).
