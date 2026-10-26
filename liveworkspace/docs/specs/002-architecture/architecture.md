# Architecture

How the platform's services fit together. Each service's own spec says what it does; this one says where it runs,
how it is reached, and how it ships.

## One origin

Every service is a Cloudflare Worker on a path route of liveworkspace.app (`staging.liveworkspace.app` for staging).
Path routes win over the site's custom domain, so Cloudflare sends each service its paths and the static site
everything else:

| Path                                                     | Worker                    | Spec                                              |
| -------------------------------------------------------- | ------------------------- | ------------------------------------------------- |
| `/api/auth/*`, `/api/account/*`, the two `/.well-known/` | accounts                  | [sign-in.md](../003-accounts/sign-in.md)          |
| `/api/index*`                                            | index                     | [index-service.md](../004-index/index-service.md) |
| `/api/drive*`                                            | drive                     | [drive.md](../005-drive/drive.md)                 |
| `/api/media*`, `/api/previews*`                          | media                     | [media.md](../006-media/media.md)                 |
| `/api/community*`                                        | community                 | [community.md](../007-community/community.md)     |
| `/api/telemetry*`                                        | telemetry                 | [telemetry.md](../008-telemetry/telemetry.md)     |
| `/api/status*`                                           | status                    | [status.md](../009-status/status.md)              |
| everything else                                          | site (static assets only) | [site.md](../010-site/site.md)                    |

The site's pages therefore call `/api/…` on their own origin, with no cross-site requests and no CORS.

## On an app's address

Each app's router (`<app>/apps/router`) puts the platform's pages and the calls they make on the app's own address,
through one shared helper, `@liveworkspace/sites/workspace-proxy`, so all four routers forward the same paths the
same way: the Explorer (`/explorer/*` and the site's assets under `/_liveworkspace`), the sign-in pages
(`/sign-in`, `/sign-up`, `/consent`, and `/api/workspace/auth` to `/api/auth`), the account API
(`/api/workspace/account` to `/api/account`), workbench pairing (`/api/workbench` to `/api/account/workbench`),
the index (`/api/index`), Drive (`/api/drive`), previews (`/api/previews` and the share-link picture doors), and the
old `/status` page to liveworkspace.app's. The Explorer's, the index's and Drive's forwards drop the app's cookies,
and forwards carry the visitor's address in `X-Liveworkspace-Client-IP`. Each router names its environment's platform with `WORKSPACE_ORIGIN`.

## Who calls whom

- **A browser** calls a service with an accounts access token or a guest token as `Authorization: Bearer`, checked
  offline against accounts' keys (`/api/auth/jwks`).
- **An app's server** calls a service with its key for that service (`INDEX_KEY`, `MEDIA_KEY`, `COMMUNITY_KEY`,
  `TELEMETRY_KEY`), over HTTPS. Each service holds one secret per app (`<SERVICE>_KEY_<APP>`).
- **A service calls another** over a service binding where both are platform Workers (accounts to the index,
  telemetry and Drive; the index to Drive; Drive and media to the index; status to livediagram's router and MCP).
- **The index and Drive call an app back** at the app's internal routes (`/api/internal/items/…`): the index with the
  app's `INDEX_KEY` to copy and purge, Drive with the app's `DRIVE_KEY` to export and import.

## Environments and the account

Two environments, production and staging, each a `wrangler.toml` environment with its own Worker name (`-staging`),
routes, D1 databases and R2 buckets. Every Worker, the platform's and every app's, runs on the liveworkspace
Cloudflare account (`851be7d244b76a6557bcbe6c4ded80f5`), which each `wrangler.toml` pins as `account_id`.

## Deploys

CI deploys every Worker ([docs/ci.md](../../../../docs/ci.md#deploys) at the repository root): staging follows
`main`, production is a manual gate that ships what staging runs, and only the Workers a change reaches are rebuilt.
The services and apis deploy first, each applying its D1 migrations before its code; then the sites and MCP Workers;
then the routers. No one applies a remote migration or deploys by hand. Secrets are set once per Worker and
environment with `wrangler secret put` and survive every deploy; each service's spec lists its own.

## Locally

`corepack pnpm dev:workspace` runs the site and every service, each on a fixed port, and the site's dev server
forwards each service's paths, so `http://localhost:3000` works as liveworkspace.app does
([README](../../../README.md#local-development)). The site takes 3000, the first port of liveworkspace's block (the
root AGENTS.md); the Workers keep their own ports (8787 and up, 3010 and 3011).

## Adding an app

An app joins by registering its OAuth client and API resource with accounts
([sign-in.md](../003-accounts/sign-in.md#registering-an-app)), adding itself to each service's app list and key, and
wiring its router and api to the shared packages ([integrating-an-app.md](integrating-an-app.md)).
