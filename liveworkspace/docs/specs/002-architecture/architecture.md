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
and forwards carry the visitor's address in `X-Liveworkspace-Client-IP`. The forwards to accounts and the index also
carry `X-Liveworkspace-Proxy-Secret`, the secret `WORKSPACE_PROXY_SECRET` the routers share with those two Workers:
they are publicly routed, so a named address counts as the visitor's only beside it, and a request without it is
counted by its own connection. Each router names its environment's platform with `WORKSPACE_ORIGIN`.

## Who calls whom

- **A browser** calls a service with an accounts access token or a guest token as `Authorization: Bearer`, checked
  offline against accounts' keys (`/api/auth/jwks`).
- **An app's server** calls a service with its key for that service (`INDEX_KEY`, `MEDIA_KEY`, `COMMUNITY_KEY`,
  `TELEMETRY_KEY`), over HTTPS. Each service holds one secret per app (`<SERVICE>_KEY_<APP>`).
- **A service calls another** over a service binding where both are platform Workers (accounts to the index,
  telemetry and Drive; the index to Drive; Drive and media to the index; status to livediagram's router and MCP).
- **The index and Drive call an app back** at the app's internal routes (`/api/internal/items/…`): the index with the
  app's `INDEX_KEY` to copy and purge, Drive with the app's `DRIVE_KEY` to export and import.

## When a request fails

Every Worker that owns storage (each service above but the site, and each app's api) answers a request that throws
itself, at any step from resolving who is calling to the route's own work, never leaving it to the runtime's bare
error page. One shared guard does it, `@liveworkspace/api-kit/request-failure`.

- **The storage is unavailable: `503 storage_unavailable`** with `Retry-After: 5`. It is the storage failing on its
  own side, not the request: D1 (an internal error, a lost connection, an overloaded or reset database, a storage
  timeout), or a Durable Object's infrastructure (an error it marks retryable or overloaded). The same call succeeds
  once the storage recovers, so the caller retries. Logged as `[d1] unavailable route=<route words>` or
  `[durable-object] unavailable route=<route words>` with the error.
- **Anything else: `500 internal_error`**, logged as `api error route=<route words>` with the error. A D1 error that
  names the query (a constraint, a type, SQL) and an error a Durable Object's own code threw are bugs, so they land
  here too. An app's api also counts it as a crash in its telemetry; the services only log it.
- Neither body echoes the error's text. The route words are the method and the path's known words, never an id.
- The answer carries the Worker's usual headers, CORS included where its routes have them.

## A Durable Object's alarm

A Durable Object has one alarm, and each one that re-arms it from a time it worked out (every app's room, the index's
webhook dispatcher, the Drive mirror) sets it through one shared rule, `@liveworkspace/api-kit/room-alarm`:

- **Never in the past.** The alarm goes at the earliest time due, but never sooner than a second from now
  (`roomAlarmAt`). A time already due, or one stuck in the past by a bug, waits that second rather than firing at
  once. Unfloored, such a time fired the alarm back to back, about 20 times a second, for as long as it stayed stuck
  (a closed socket's lapsed grant cost about 2.2 million billed alarms in a week); floored, the worst any such bug
  can do is one alarm a second per object.
- **Nothing people see waits on it.** What an alarm does (pushes to the index, a shared tab's copies, a Community
  check, upkeep, a lapsed grant's close, an agent's expiry, a webhook's send, a Drive pass) is already on a wait of
  seconds or more; a second more on a time that was already due changes nothing anyone can tell.
- **No write for an alarm already set.** An app's room arms its alarm on many writes, and an alarm set again at the
  same time is a storage write for nothing. The room remembers the time it last set while it is in memory and skips
  setting the same one, or deleting an alarm it already deleted (`armRoomAlarm`). A room woken from hibernation
  remembers nothing, so its first arm always writes. A room's purge deletes its alarm through the same helper
  (`disarmRoomAlarm`), which forgets the time too, so the next arm after a purge always writes.
- A request that asks for work now (a webhook queued, a Drive check or connect, an export started) still sets the
  alarm for now: it runs once per request, never in a loop. A data export's next chunk is set at once too: each chunk
  works up to 20 s, so a second's floor would only slow every export.

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
root AGENTS.md); the Workers keep their own ports (8787 and up, 3010 and 3011). Each app has a block of its own:
livediagram 3100, liveplanner 3200, livedocuments 3300, livedesign 3400 and livehuddle 3500.

## Adding an app

An app joins by registering its OAuth client and API resource with accounts
([sign-in.md](../003-accounts/sign-in.md#registering-an-app)), adding itself to each service's app list and key, and
wiring its router and api to the shared packages ([integrating-an-app.md](integrating-an-app.md)).
