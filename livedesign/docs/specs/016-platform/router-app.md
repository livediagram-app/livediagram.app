# Router app

A small Cloudflare Worker that fronts the apex domain (`livedesign.app`) and routes URL paths to the right underlying app.

- **Workspace:** `apps/router` (`@livedesign/router`).
- **Runtime:** Cloudflare Workers.
- **Production hostname:** `livedesign.app` and `www.livedesign.app`; staging's is `staging.livedesign.app`. Each is a custom domain declared in `apps/router/wrangler.toml`, attached by `wrangler deploy` ([Deployment](deployment.md#custom-domain)). Default Workers URL also remains reachable.

## The bare domain

Pages live on `www.livedesign.app`. A page load on the bare `livedesign.app` (a GET or HEAD, not under `/api` or
`/.well-known`, and not a WebSocket upgrade) answers one `301` to the same path and query on
`https://www.livedesign.app`, with `Cache-Control: public, max-age=86400` (`wwwRedirect`,
`@liveworkspace/sites/workspace-proxy`). Everything else answers on the bare domain as before: API calls, the sign-in
callback and live rooms from an older page, a CLI or an MCP client keep working, and no `Authorization` header is
lost to a cross-origin redirect. It is always one hop: `/status` and `/telemetry` go straight to liveworkspace, and a
help path missing its `/help` goes straight to `www.livedesign.app/help/…`. Only production's router does it (no
`DEPLOY_ENV`; `wrangler dev` hands a local router its production host), and `www.`, `staging.` and local hosts never
redirect, so there is no loop and neither staging nor local development leads to production.

## Routing table

In order; the first match wins.

| Path                                                                                                                                                | Forwards to                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| liveworkspace's pages and their calls (`/sign-in` with `sig`, `/explorer/*`, `/api/workspace/*`, `/api/workbench/*`, `/_liveworkspace/*`, ...)      | liveworkspace.app (`routeToWorkspace`; [Signing in](#signing-in-on-livedesignapp), [The Explorer](#the-explorer-on-livedesignapp))                         |
| previews and a share link's image and card                                                                                                          | liveworkspace's previews (`routeToPreviews`, [liveworkspace/docs/specs/006-media/previews.md](../../../../liveworkspace/docs/specs/006-media/previews.md)) |
| `/api/index`, `/api/index/*`                                                                                                                        | liveworkspace's index (`forwardToIndex`), path and query kept                                                                                              |
| the Drive mirror's paths (`isDrivePath`)                                                                                                            | liveworkspace's Drive mirror (`forwardToDrive`), cookies dropped                                                                                           |
| `/api`, `/api/*`                                                                                                                                    | api worker (`apps/api`), as-is                                                                                                                             |
| `/live/*` (the live app's `_next` assets only)                                                                                                      | live app (`apps/live`), stripped                                                                                                                           |
| `/status`, `/status/*`                                                                                                                              | `301` to liveworkspace's status page at livedesign's group (`statusRedirect`)                                                                              |
| `/telemetry`, `/telemetry/*`                                                                                                                        | `301` to the central dashboard, `?app=livedesign.app` (`telemetryRedirect`, liveworkspace/docs/specs/008-telemetry/telemetry.md)                           |
| `/help`, `/help/*`                                                                                                                                  | help app (`apps/help`), stripped                                                                                                                           |
| live page routes: `/design/*`, `/auth/*`, `/new`, `/join`, `/sign-in`, `/get-started`, `/embed/*`, `/oauth/*`, `/offline`, `/explorer`, `/icon.svg` | live app (`apps/live`), as-is                                                                                                                              |
| a help category segment with no `/help` prefix (`/canvas/*`, `/policies/*`, ...)                                                                    | 308 redirect to `/help/<path>`                                                                                                                             |
| everything else                                                                                                                                     | marketing app (`apps/marketing`)                                                                                                                           |

The live app serves at **clean URLs**: there's no `/live` prefix in the address bar. Marketing owns every other first segment (`/`, `/alternatives`, `/faq`, the legal pages), and the live app's route segments don't overlap any of them, so the router selects the live app by matching its known first segments (`LIVE_ROUTE_SEGMENTS`, exported from `@livedesign/api-schema` so the telemetry dashboard's per-app page-view split, [Page view telemetry](../017-telemetry/page-view-telemetry.md), reads the same list) and forwards those **as-is** (no strip: the live worker's `out/` files are already prefix-free).

The one thing that keeps a `/live` prefix is the live app's bundled **`_next` assets** (its prod `assetPrefix: '/live'`). Both Next static exports want `/_next`, so the live app's assets ride `/live/_next/*` to avoid colliding with marketing's `/_next`. The router **strips** `/live` from those before forwarding (the shared `forward()` helper, as for `/help/*`) so the worker serves them from `out/_next`. Only `assetPrefix` is set, on assets alone; no `basePath` prefixes the pages. A stripped app's own redirect gets its prefix back (`withPrefixedRedirect`), so a trailing-slash redirect inside `/help` stays inside it.

`/api/*` is forwarded **as-is**, with no prefix stripping: the api worker expects the full `/api/...` path. Marketing sees `/`, `/faq`, etc. as-is.

**Bare help-article paths redirect rather than 404.** A help URL that has lost its `/help` prefix (`/privacy-and-security/data-privacy/`) is unambiguous: every help article lives under one of the registry's category slugs, and none of those segments belongs to marketing. So the router matches the first segment against `HELP_CATEGORY_SEGMENTS` and answers **308** to `/help/<path>`, rather than letting marketing answer 404. Still routing, not logic: a table of segments and a destination.

**Not found.** An address no site has a page for gets that site's own not-found page, never the framework's bare
"404 | This page could not be found.": the site's header and footer around one card (`PageNotFound` in
`@livedesign/ui`) titled **Page not found**, "There is no page at this address. It may have moved, or the link may
have a typo.", with a way back to the site's home (marketing: **Go to the Home Page**; the help centre: **Browse Help
Centre** and **Troubleshooting**), then **Help Centre**. It is still a 404, so search
engines drop it. The editor answers an unknown address with its own card instead
([New design route](../007-editor/new-design-route.md) "Unknown addresses").

Two properties keep it safe. `explorer` is absent from the set: `/explorer/*` (a segment the help centre also uses) is liveworkspace's Explorer, served ahead of every route here ([The Explorer on livedesign.app](#the-explorer-on-livedesignapp)). And `index.test.ts` walks the registry's own categories and asserts each one redirects, so a new help category cannot silently stop working.

## Signing in on livedesign.app

Signing in and creating an account stay on livedesign.app's address: the router serves liveworkspace's
sign-in pages ahead of everything above, through the shared helper
(`routeToWorkspace` and `workspaceRoutes` in `@liveworkspace/sites/workspace-proxy`;
[liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md#signing-in-on-the-apps-own-address)):

| Path                                                                   | Forwards to                                                                    |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `/sign-in`, `/sign-up`, `/consent` with a signed OAuth request (`sig`) | liveworkspace.app's page, no cookies either way                                |
| `/api/workspace/auth/*`                                                | liveworkspace's accounts API at `/api/auth/*`, with the sign-in's cookies only |
| `/_liveworkspace/*`                                                    | liveworkspace.app's build assets                                               |

Without a signed request, `/sign-in` stays the app's own page (its sign-in hand-off). On the
accounts route the app's own cookies never leave; liveworkspace's cookies land here renamed
`lw_flow.<name>`, on `/api/workspace/auth` alone, for at most 15 minutes, and the hand-off to
liveworkspace.app clears them. The router names the visitor's address in
`X-Liveworkspace-Client-IP`. Once signed in, one top-level hop to liveworkspace.app sets its
session (so the other apps sign in without a click) and comes straight back to `/auth/callback`.

## The Explorer on livedesign.app

The Explorer is liveworkspace's page, served at livedesign.app's own `/explorer` with the address unchanged (path,
query and hash): the router asks the same shared helper first (`routeToWorkspace`; [liveworkspace/docs/specs/004-index/one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md#the-explorer-on-each-apps-address)).

| Path                                        | Forwards to                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `/explorer`, `/explorer/*`, `/explorer.txt` | liveworkspace.app's Explorer page and its payloads, no cookies either way |
| `/api/workspace/account/*`                  | liveworkspace's account API at `/api/account/*`, with the page's bearer   |
| `/_liveworkspace/*`                         | liveworkspace.app's build assets                                          |

`WORKSPACE_ORIGIN` names liveworkspace.app (production's when unset; staging's and `http://localhost:3000` in local
development). A redirect from there comes back as an address on livedesign.app. Every request carries
`X-Liveworkspace-Proxy: livedesign`, and a router that receives one, or whose origin is its own, answers `508` rather than
forward again. The page is `no-store`, as every page; the assets are content-hashed and cached for a year. Requests never reach the live app's own `/explorer` pages; its links to the Explorer are same-origin `/explorer` addresses.

## Implementation

In production the Worker has four **service bindings**, one to each downstream app (`MARKETING`, `LIVE`, `API`, `HELP`). liveworkspace's services (pages, index, previews, Drive) are reached by origin: `WORKSPACE_ORIGIN`, `INDEX_ORIGIN`, `PREVIEWS_ORIGIN` and `DRIVE_ORIGIN`, each production's when unset (the helpers in `@liveworkspace/sites/workspace-proxy`). `/telemetry` and `/status` are redirects, not bindings. The source is `apps/router/src/index.ts`:

- `route(request, env)` is the routing table above, in order.
- `forward(request, url, binding, origin, stripPrefix?)` resolves each target as _binding if present, else local-dev origin_ (see Local development below), strips the prefix for the assetPrefix and basePath paths (live assets and help) when forwarding to a binding, and answers 503 when it has neither.
- `telemetryRedirect(env)` builds the 301 to `TELEMETRY_DASHBOARD_URL` with `?app=livedesign.app`.
- `markNoIndex` stamps `X-Robots-Tag: noindex, nofollow` on staging's responses, leaving a WebSocket upgrade untouched ([Staging environment](staging-environment.md)).
- `withCachePolicy` applies the caching rules (`cache-policy.ts`, [Stale builds](stale-builds.md) "Caching rules") to every response but the api's.

Adding a new top-level route to the live app means adding its first segment to `LIVE_ROUTE_SEGMENTS` (in `packages/api-schema/src/page-views.ts`), or the router will send it to marketing.

The router does **not** count page views. It can't see client-side navigations inside the Next apps, and can't read the per-browser telemetry opt-out, so each frontend reports its own ([Page view telemetry](../017-telemetry/page-view-telemetry.md)).

Service bindings target deployed Workers. The downstream apps deploy as their own units; the router stitches them together.

## Local development

The router **also runs locally**, so `pnpm dev` gives you the production URL shape on one port: `http://localhost:3400` serves marketing at `/`, the editor at `/new` etc., `/help` and `/api` (and `/telemetry` redirects to the central dashboard, the local liveworkspace site at `http://localhost:3000/telemetry`), with no per-app port to remember. Each app still runs on its own port underneath and stays directly reachable:

| App       | Local URL                                                           |
| --------- | ------------------------------------------------------------------- |
| router    | `http://localhost:3400/`: everything, stitched like production      |
| marketing | `http://localhost:3401/`                                            |
| live      | `http://localhost:3402/new`, `/explorer/recent`, ... (clean routes) |
| help      | `http://localhost:3404/help` (basePath baked in)                    |
| api       | `http://localhost:8989/api/...` (wrangler dev)                      |

**How local mode works.** Service bindings only exist between deployed Workers, so the router's `wrangler.toml` carries an `[env.local]` environment that defines no service bindings and instead sets `<APP>_ORIGIN` vars (`http://127.0.0.1:<port>` for each downstream app, and the local liveworkspace services: the site on `:3000`, the index on `:8793`, previews on `:8792`, Drive on `:3011`). The worker resolves each target as _binding if present, else proxy to the origin_; `pnpm --filter @livedesign/router dev` runs `wrangler dev --env local --port 3400`, and the root `pnpm dev` includes it.

Origin mode forwards **as-is, never stripped**: unlike the deployed static-asset workers (which hold prefix-free `out/` files), the local Next dev servers serve their own prefixes themselves: `basePath` for help, and the live app's `/live` assetPrefix, which applies **in dev too** (Next's dev server serves both the prefixed and unprefixed asset paths) precisely so the local router can tell live's `/live/_next/*` apart from marketing's `/_next/*` the same way production does.

The routing decisions stay identical in both modes; only the transport (binding vs origin proxy) and the stripping differ. The router remains optional: visiting each app's own port directly still works.

## Routing infrastructure, not logic

The router is **routing infrastructure**, not application logic, holding no data and running no business rules. That separation is non-negotiable: if you find yourself adding business logic to the router, stop, the logic belongs in a service the router forwards to (marketing, live, help, api, or liveworkspace's).

Two response rules sit with the routing because every site passes through it, and they are HTTP
policy rather than business rules: on staging every response is marked `X-Robots-Tag: noindex,
nofollow` ([Staging environment](./staging-environment.md)), and every site's response follows the
caching rules (`src/cache-policy.ts`: pages `no-store`, build assets immutable, a missing asset a
plain-text 404; [Stale builds](./stale-builds.md) "Caching rules"). The api's responses are left as
the api sets them.
