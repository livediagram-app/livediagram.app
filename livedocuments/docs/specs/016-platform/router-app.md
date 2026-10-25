# Router app

A small Cloudflare Worker that fronts the apex domain (`livedocuments.app`) and routes URL paths to the right underlying app.

- **Workspace:** `apps/router` (`@livedocuments/router`).
- **Runtime:** Cloudflare Workers.
- **Production hostname:** `livedocuments.app` (custom domain configured in the Cloudflare dashboard). Default Workers URL also remains reachable.

## Routing table

| Path                                                                                                                                       | Forwards to                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `/api/index`, `/api/index/*`                                                                                                               | liveworkspace's index (`INDEX_ORIGIN`, `https://liveworkspace.app` when unset), as-is      |
| `/api`, `/api/*`                                                                                                                           | api worker (`apps/api`)                                                                    |
| `/telemetry`, `/telemetry/*`                                                                                                               | `301` to the central dashboard, `?app=livedocuments.app` (liveworkspace/docs/telemetry.md) |
| `/help`, `/help/*`                                                                                                                         | help app (`apps/help`), stripped                                                           |
| `/live/*` (the editor app's `_next` assets only)                                                                                           | editor app (`apps/editor`), stripped                                                       |
| live page routes: `/document/*`, `/auth/*`, `/new`, `/join`, `/sign-in`, `/get-started`, `/embed`, `/oauth/*`, `/workbench/*`, `/icon.svg` | editor app (`apps/editor`), as-is                                                          |
| a help category segment with no `/help` prefix (`/canvas/*`, `/policies/*`, ...)                                                           | 308 redirect to `/help/<path>`                                                             |
| everything else                                                                                                                            | marketing app (`apps/marketing`)                                                           |

The editor app serves at **clean URLs** — there's no `/live` prefix in the address bar. Marketing owns every other first segment (`/`, `/alternatives`, `/faq`, the legal pages), and the editor app's route segments don't overlap any of them, so the router selects the editor app by matching its known first segments (`LIVE_ROUTE_SEGMENTS`, exported from `@livedocuments/api-schema` so the telemetry dashboard's per-app page-view split, [Page view telemetry](../017-telemetry/page-view-telemetry.md), reads the same list) and forwards those **as-is** (no strip — the editor worker's `out/` files are already prefix-free).

The one thing that keeps a `/live` prefix is the editor app's bundled **`_next` assets** (its prod `assetPrefix: '/live'`). Both Next static exports want `/_next`, so the editor app's assets ride `/live/_next/*` to avoid colliding with marketing's `/_next`. The router **strips** `/live` from those before forwarding (shared `forwardStripped()` helper, same as `/telemetry/*`) so the worker serves them from `out/_next`. (Next's `basePath` used to add the prefix to pages too; that's gone — only `assetPrefix` remains, on assets only.)

`/api/*` is forwarded **as-is** — no prefix stripping. The api worker expects the full `/api/...` path. The one exception is `/api/index/*`, liveworkspace's index ([one-explorer.md](../../../../liveworkspace/docs/one-explorer.md)): the Explorer and the editor call it on livedocuments's own origin, and the router passes it, path unchanged, to `INDEX_ORIGIN` (production's `https://liveworkspace.app` when unset; staging and local development name their own), so the browser needs no CORS and no liveworkspace.app cookie. Marketing sees `/`, `/faq`, etc. as-is.

**Bare help-article paths redirect rather than 404.** A help URL that has lost its `/help` prefix (`/privacy-and-security/data-privacy/`) used to fall through to marketing and 404, which is the wrong answer to an unambiguous address: every help article lives under one of the registry's category slugs, and none of those segments belongs to marketing. So the router matches the first segment against `HELP_CATEGORY_SEGMENTS` and answers **308** to `/help/<path>`. Still routing, not logic: a table of segments and a destination.

**Not found.** An address no site has a page for gets that site's own not-found page, never the framework's bare
"404 | This page could not be found.": the site's header and footer around one card (`PageNotFound` in
`@livedocuments/ui`) titled **Page not found**, "There is no page at this address. It may have moved, or the link may
have a typo.", with a way back to the site's home (marketing: **Go to the Home Page**; the help centre: **Browse Help
Centre** and **Troubleshooting**), then **Help Centre**. It is still a 404, so search
engines drop it. The editor answers an unknown address with its own card instead
([New document route](../007-editor/new-document-route.md) "Unknown addresses").

Two properties keep it safe. `explorer` is absent from the set: `/explorer/*` (a segment the help centre also uses) is liveworkspace's Explorer, served ahead of every route here ([The Explorer on livedocuments.app](#the-explorer-on-livedocumentsapp)). And `index.test.ts` walks the registry's own categories and asserts each one redirects, so a new help category cannot silently stop working.

## Signing in on livedocuments.app

Signing in and creating an account stay on livedocuments.app's address: the router serves liveworkspace's
sign-in pages ahead of everything above, through the shared helper
(`routeToWorkspace` and `workspaceRoutes` in `@liveworkspace/sites/workspace-proxy`;
[liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md#signing-in-on-the-apps-own-address)):

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

## The Explorer on livedocuments.app

The Explorer is liveworkspace's page, served at livedocuments.app's own `/explorer` with the address unchanged (path,
query and hash): the router asks the same shared helper first (`routeToWorkspace`, its switch
`EXPLORER_ON_APP_ORIGIN` on for livedocuments; [liveworkspace/docs/one-explorer.md](../../../../liveworkspace/docs/one-explorer.md#the-explorer-on-each-apps-address)).

| Path                                        | Forwards to                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `/explorer`, `/explorer/*`, `/explorer.txt` | liveworkspace.app's Explorer page and its payloads, no cookies either way |
| `/api/workspace/account/*`                  | liveworkspace's account API at `/api/account/*`, with the page's bearer   |
| `/_liveworkspace/*`                         | liveworkspace.app's build assets                                          |

`WORKSPACE_ORIGIN` names liveworkspace.app (production's when unset; staging's and `http://localhost:3000` in local
development). A redirect from there comes back as an address on livedocuments.app. Every request carries
`X-Liveworkspace-Proxy: livedocuments`, and a router that receives one, or whose origin is its own, answers `508` rather than
forward again. The page is `no-store`, as every page; the assets are content-hashed and cached for a year. Requests never reach the editor app's own `/explorer` pages; its links to the Explorer are same-origin `/explorer` addresses.

## Implementation

In production the Worker has four **service bindings**, one to each downstream app (MARKETING / EDITOR / API / HELP); `/telemetry` is a redirect to liveworkspace's central dashboard, not a binding (liveworkspace/docs/telemetry.md). A shared `forward()` helper resolves each target as _binding if present, else local-dev origin_ (see Local development below) and strips the prefix for the basePath/assetPrefix paths (live assets + help) when forwarding to a binding:

```ts
// sketch, real source: apps/router/src/index.ts
const LIVE_ROUTE_SEGMENTS = new Set([
  'diagram',
  'embed',
  'explorer',
  'get-started',
  'join',
  'new',
  'oauth',
  'sign-in',
]);
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return forward(request, url, env.API, env.API_ORIGIN); // /api/* as-is; api worker wants the full path
    }
    // /live/* is now ONLY the editor app's _next assets — strip and forward.
    if (url.pathname === '/live' || url.pathname.startsWith('/live/')) {
      return forward(request, url, env.EDITOR, env.EDITOR_ORIGIN, '/live');
    }
    if (url.pathname === '/telemetry' || url.pathname.startsWith('/telemetry/')) {
      return telemetryRedirect(env); // 301 to the central dashboard, ?app=livedocuments.app
    }
    // Clean live-app page routes + its root icon: forward as-is (no strip).
    if (LIVE_ROUTE_SEGMENTS.has(url.pathname.split('/')[1]) || url.pathname === '/icon.svg') {
      return forward(request, url, env.EDITOR, env.EDITOR_ORIGIN);
    }
    return forward(request, url, env.MARKETING, env.MARKETING_ORIGIN);
  },
};
```

Adding a new top-level route to the editor app means adding its first segment to `LIVE_ROUTE_SEGMENTS` (in `packages/api-schema/src/page-views.ts`), or the router will send it to marketing.

The router does **not** count page views. It can't see client-side navigations inside the Next apps, and can't read the per-browser telemetry opt-out, so each frontend reports its own ([Page view telemetry](../017-telemetry/page-view-telemetry.md)).

Service bindings target deployed Workers. The downstream apps deploy as their own units; the router stitches them together.

## Local development

The router **also runs locally**, so `pnpm dev` gives you the production URL shape on one port — `http://localhost:3300` serves marketing at `/`, the editor at `/new` etc., `/help` and `/api` (and `/telemetry` redirects to the central dashboard, a local liveworkspace site on `:3000` in dev), with no per-app port to remember. Each app still runs on its own port underneath and stays directly reachable:

| App       | Local URL                                                       |
| --------- | --------------------------------------------------------------- |
| router    | `http://localhost:3300/` — everything, stitched like production |
| marketing | `http://localhost:3301/`                                        |
| live      | `http://localhost:3302/new`, `/offline`, ... (clean routes)     |
| help      | `http://localhost:3304/help` (basePath baked in)                |
| api       | `http://localhost:8987/api/...` (wrangler dev)                  |

**How local mode works.** Service bindings only exist between deployed Workers, so the router's `wrangler.toml` carries an `[env.local]` environment that defines no service bindings and instead sets `<APP>_ORIGIN` vars (`http://127.0.0.1:<port>` for each downstream app). The worker resolves each target as _binding if present, else proxy to the origin_; `pnpm --filter @livedocuments/router dev` runs `wrangler dev --env local --port 3300`, and the root `pnpm dev` includes it.

Origin mode forwards **as-is, never stripped**: unlike the deployed static-asset workers (which hold prefix-free `out/` files), the local Next dev servers serve their own prefixes themselves — `basePath` for telemetry/help, and the editor app's `/live` assetPrefix, which applies **in dev too** (Next's dev server serves both the prefixed and unprefixed asset paths) precisely so the local router can tell live's `/live/_next/*` apart from marketing's `/_next/*` the same way production does.

The routing decisions stay identical in both modes — only the transport (binding vs origin proxy) and the stripping differ. The router remains optional: visiting each app's own port directly still works.

## Routing infrastructure, not logic

The router is **routing infrastructure**, not application logic, holding no data and running no business rules. That separation is non-negotiable: if you find yourself adding business logic to the router, stop, the logic belongs in a service the router forwards to (marketing, live, telemetry, help, or api).

Two response rules sit with the routing because every site passes through it, and they are HTTP
policy rather than business rules: on staging every response is marked `X-Robots-Tag: noindex,
nofollow` ([Staging environment](./staging-environment.md)), and every site's response follows the
caching rules (`src/cache-policy.ts`: pages `no-store`, build assets immutable, a missing asset a
plain-text 404; [Stale builds](./stale-builds.md) "Caching rules"). The api's responses are left as
the api sets them.
