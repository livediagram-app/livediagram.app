# Architecture: blueprint

Derived from [architecture.md](../architecture.md) and [integrating-an-app.md](../integrating-an-app.md). The spec decides; this file only adds engineering precision, read from the code. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md). Paths are relative to the repository root.

## Domain and naming

| Term             | Identifier                             | Meaning                                                                   |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| Origin           | `https://liveworkspace.app`            | Production; staging is `https://staging.liveworkspace.app`                |
| Path route       | `routes` in `wrangler.toml`            | A Worker on a path of the zone; wins over the site's custom domain        |
| Router           | `<app>/apps/router`                    | An app's front Worker; forwards the platform's paths on the app's address |
| Workspace proxy  | `@liveworkspace/sites/workspace-proxy` | The routers' one shared forwarding table                                  |
| Workspace origin | `WORKSPACE_ORIGIN`                     | Which platform a router forwards to                                       |
| Service binding  | `[[services]]`                         | A direct Worker-to-Worker call, inside the account                        |

## Interfaces and contracts

The tables below are read from each `wrangler.toml`, the root `package.json`, `apps/site/next.config.ts` and
`packages/sites/src/workspace-proxy.ts`.

## Security and trust

Forwarded requests from a router carry the visitor's address in `X-Liveworkspace-Client-IP`, set from
`CF-Connecting-IP` and never copied from the caller. The Explorer's, the index's and Drive's forwards drop the app's
cookies, so no app cookie reaches the platform.

## Performance and limits

One origin means no CORS preflight for the site's own calls. Each service's blueprint holds its budgets.

## Observability

Each Worker's own logs are in its blueprint. The status service checks every service hourly
([009-status](../../009-status/README.md)).

## The services

Production names and bindings (staging adds `-staging` to every Worker, database and bucket name and routes on
`staging.liveworkspace.app`), from each `apps/<service>/wrangler.toml`:

| Service   | Worker                    | Routes                                                                                                            | D1                        | R2                    | Durable Objects  | Service bindings                                     | Crons                        | Dev port |
| --------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------- | ---------------- | ---------------------------------------------------- | ---------------------------- | -------- |
| accounts  | `liveworkspace-accounts`  | `/api/auth/*`, `/api/account/*`, `/.well-known/openid-configuration*`, `/.well-known/oauth-authorization-server*` | `liveworkspace-accounts`  |                       | `WorkbenchStore` | `INDEX`, `TELEMETRY`, `DRIVE`                        | `17 9 * * *`, `*/15 * * * *` | 8787     |
| index     | `liveworkspace-index`     | `/api/index*`                                                                                                     | `liveworkspace-index`     |                       |                  | `DRIVE`                                              | `23 4 * * *`, `*/15 * * * *` | 8793     |
| drive     | `liveworkspace-drive`     | `/api/drive*`                                                                                                     |                           |                       | `DriveMirror`    | `INDEX`                                              | (alarms per Durable Object)  | 3011     |
| media     | `liveworkspace-media`     | `/api/media*`, `/api/previews*`                                                                                   | `liveworkspace-media`     | `liveworkspace-media` |                  | `INDEX`                                              | `41 3 * * *`                 | 8792     |
| community | `liveworkspace-community` | `/api/community*`                                                                                                 | `liveworkspace-community` |                       |                  |                                                      |                              | 8791     |
| telemetry | `liveworkspace-telemetry` | `/api/telemetry*`                                                                                                 | `liveworkspace-telemetry` |                       |                  |                                                      | `17 3 * * *`                 | 8790     |
| status    | `liveworkspace-status`    | `/api/status*`                                                                                                    | `liveworkspace-status`    |                       |                  | `LIVEDIAGRAM_ROUTER`, `LIVEDIAGRAM_MCP` (production) | `7 * * * *`                  | 3010     |
| site      | `liveworkspace-site`      | `liveworkspace.app`, `www.liveworkspace.app` (custom domains)                                                     |                           |                       |                  |                                                      |                              | 3000     |

Every route is on the `liveworkspace.app` zone and every `wrangler.toml` pins `account_id =
"851be7d244b76a6557bcbe6c4ded80f5"`. `apps/migrate` has no `wrangler.toml`: it is never deployed.

## Root scripts

From the root `package.json`:

| Script          | Runs                                                                                   |
| --------------- | -------------------------------------------------------------------------------------- |
| `dev:workspace` | `turbo run dev` for the site and all seven services                                    |
| `dev:site`      | `@liveworkspace/site` alone (`next dev --port 3000`)                                   |
| `dev:accounts`  | `@liveworkspace/accounts` (`wrangler dev --port 8787 --local-upstream localhost:3000`) |
| `dev:telemetry` | `@liveworkspace/telemetry-service` (`--port 8790`)                                     |
| `dev:community` | `@liveworkspace/community-service` (`--port 8791`)                                     |
| `dev:media`     | `@liveworkspace/media-service` (`--port 8792`)                                         |
| `dev:index`     | `@liveworkspace/index-service` (`--port 8793`)                                         |
| `dev:status`    | `@liveworkspace/status-service` (`--port 3010`)                                        |
| `dev:drive`     | `@liveworkspace/drive-service` (`--port 3011`)                                         |

Inspector ports, one per Worker: 9130 accounts, 9131 telemetry, 9132 community, 9133 media, 9134 index, 9135 status, 9136 drive. Status runs with `--test-scheduled`, `ENVIRONMENT=development` and `PLATFORM_ORIGIN=http://localhost:3000`; accounts with `--local-upstream localhost:3000`.

## The site's dev forwards

`apps/site/next.config.ts` rewrites, in development only, each path to its Worker, each origin overridable by an
env var:

| Path                                                          | Default target          | Override               |
| ------------------------------------------------------------- | ----------------------- | ---------------------- |
| `/api/auth/*`, `/api/account/*`, `/.well-known/*`             | `http://localhost:8787` | `ACCOUNTS_DEV_ORIGIN`  |
| `/api/telemetry/*`                                            | `http://localhost:8790` | `TELEMETRY_DEV_ORIGIN` |
| `/api/community/*`                                            | `http://localhost:8791` | `COMMUNITY_DEV_ORIGIN` |
| `/api/previews/*` (not `/api/media/*`: no site page calls it) | `http://localhost:8792` | `MEDIA_DEV_ORIGIN`     |
| `/api/index/*`                                                | `http://localhost:8793` | `INDEX_DEV_ORIGIN`     |
| `/api/status/*`                                               | `http://localhost:3010` | `STATUS_DEV_ORIGIN`    |
| `/api/drive/*`                                                | `http://localhost:3011` | `DRIVE_DEV_ORIGIN`     |

## The routers' forwards

`packages/sites/src/workspace-proxy.ts`, used by all four routers:

| On the app's address                                              | Goes to on liveworkspace.app       | Constant                                   |
| ----------------------------------------------------------------- | ---------------------------------- | ------------------------------------------ |
| `/explorer`, `/explorer/*`                                        | the same path                      | the explorer route (`prefix: '/explorer'`) |
| `/_liveworkspace/*`                                               | the site's build assets            | `SITE_ASSET_PREFIX`                        |
| `/sign-in`, `/sign-up`, `/consent`                                | the same pages                     | the sign-in page list                      |
| `/api/workspace/auth/*`                                           | `/api/auth/*`                      | `ACCOUNTS_ON_APP_PATH`                     |
| `/api/workspace/account/*`                                        | `/api/account/*`                   | the account route                          |
| `/api/workbench/*`                                                | `/api/account/workbench/*`         | the workbench route                        |
| `/api/drive/*`                                                    | the same path, cookies dropped     | `DRIVE_PATH`, `forwardToDrive`             |
| `/api/previews/*`, `/api/share/<code>/image.svg\|image.png\|card` | `/api/previews/…`                  | `PREVIEWS_PATH`, `previewsTargetFor`       |
| `/status`                                                         | the status page at the app's group | `STATUS_PATH`, `statusPageUrl`             |

The visitor's address travels as `X-Liveworkspace-Client-IP` (`WORKSPACE_CLIENT_IP_HEADER`), set from
`CF-Connecting-IP`, never from what the caller sent. `workspace-proxy.test.ts` holds all four routers to this.
