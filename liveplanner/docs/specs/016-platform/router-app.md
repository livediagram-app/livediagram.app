# Router app

A small Cloudflare Worker that fronts the apex domain (`liveplanner.app`) and routes URL paths to the right underlying app.

- **Workspace:** `apps/router` (`@liveplanner/router`).
- **Runtime:** Cloudflare Workers.
- **Production hostname:** `liveplanner.app` (custom domain configured in the Cloudflare dashboard). Default Workers URL also remains reachable.

## Routing table

| Path                                                                                                                                     | Forwards to                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `/api`, `/api/*`                                                                                                                         | api worker (`apps/api`)                                                                  |
| `/telemetry`, `/telemetry/*`                                                                                                             | `301` to the central dashboard, `?app=liveplanner.app` (liveworkspace/docs/telemetry.md) |
| `/help`, `/help/*`                                                                                                                       | help app (`apps/help`), stripped                                                         |
| `/live/*` (the editor app's `_next` assets only)                                                                                           | editor app (`apps/editor`), stripped                                                         |
| live page routes: `/project/*`, `/explorer/*`, `/form/*`, `/new`, `/join`, `/sign-in`, `/get-started`, `/embed`, `/oauth/*`, `/icon.svg` | editor app (`apps/editor`), as-is                                                            |
| a help category segment with no `/help` prefix (`/canvas/*`, `/policies/*`, ...)                                                         | 308 redirect to `/help/<path>`                                                           |
| everything else                                                                                                                          | marketing app (`apps/marketing`)                                                         |

The editor app serves at **clean URLs** — there's no `/live` prefix in the address bar. Marketing owns every other first segment (`/`, `/alternatives`, `/faq`, the legal pages), and the editor app's route segments don't overlap any of them, so the router selects the editor app by matching its known first segments (`LIVE_ROUTE_SEGMENTS`, exported from `@liveplanner/api-schema` so the telemetry dashboard's per-app page-view split, [Page view telemetry](../017-telemetry/page-view-telemetry.md), reads the same list) and forwards those **as-is** (no strip — the editor worker's `out/` files are already prefix-free).

The one thing that keeps a `/live` prefix is the editor app's bundled **`_next` assets** (its prod `assetPrefix: '/live'`). Both Next static exports want `/_next`, so the editor app's assets ride `/live/_next/*` to avoid colliding with marketing's `/_next`. The router **strips** `/live` from those before forwarding (shared `forwardStripped()` helper, same as `/telemetry/*`) so the worker serves them from `out/_next`. (Next's `basePath` used to add the prefix to pages too; that's gone — only `assetPrefix` remains, on assets only.)

`/api/*` is forwarded **as-is** — no prefix stripping. The api worker expects the full `/api/...` path. Marketing sees `/`, `/faq`, etc. as-is.

**Bare help-article paths redirect rather than 404.** A help URL that has lost its `/help` prefix (`/privacy-and-security/data-privacy/`) used to fall through to marketing and 404, which is the wrong answer to an unambiguous address: every help article lives under one of the registry's category slugs, and none of those segments belongs to marketing. So the router matches the first segment against `HELP_CATEGORY_SEGMENTS` and answers **308** to `/help/<path>`. Still routing, not logic: a table of segments and a destination.

**Not found.** An address no site has a page for gets that site's own not-found page, never the framework's bare
"404 | This page could not be found.": the site's header and footer around one card (`PageNotFound` in
`@liveplanner/ui`) titled **Page not found**, "There is no page at this address. It may have moved, or the link may
have a typo.", with a way back to the site's home (marketing: **Go to the Home Page**; the help centre: **Browse Help
Centre** and **Troubleshooting**), then **Help Centre**. It is still a 404, so search
engines drop it. The editor answers an unknown address with its own card instead
([New project route](../007-editor/new-project-route.md) "Unknown addresses").

Two properties keep it safe. It sits **after** the live-route check, so `/explorer/*` (a segment the help centre and the editor app both use) still reaches the editor — which is why `explorer` is absent from the set. And `index.test.ts` walks the registry's own categories and asserts each one redirects, so a new help category cannot silently stop working.

## Implementation

In production the Worker has four **service bindings**, one to each downstream app (MARKETING / LIVE / API / HELP); `/telemetry` is a redirect to liveworkspace's central dashboard, not a binding (liveworkspace/docs/telemetry.md). A shared `forward()` helper resolves each target as _binding if present, else local-dev origin_ (see Local development below) and strips the prefix for the basePath/assetPrefix paths (live assets + help) when forwarding to a binding:

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
      return telemetryRedirect(env); // 301 to the central dashboard, ?app=liveplanner.app
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

The router **also runs locally**, so `pnpm dev` gives you the production URL shape on one port — `http://localhost:3100` serves marketing at `/`, the editor at `/new` etc., `/help` and `/api` (and `/telemetry` redirects to a local `wrangler dev` of liveworkspace's telemetry service on `:8790`), with no per-app port to remember. Each app still runs on its own port underneath and stays directly reachable:

| App       | Local URL                                                           |
| --------- | ------------------------------------------------------------------- |
| router    | `http://localhost:3100/` — everything, stitched like production     |
| marketing | `http://localhost:3101/`                                            |
| live      | `http://localhost:3102/new`, `/explorer/recent`, ... (clean routes) |
| help      | `http://localhost:3104/help` (basePath baked in)                    |
| api       | `http://localhost:8887/api/...` (wrangler dev)                      |

**How local mode works.** Service bindings only exist between deployed Workers, so the router's `wrangler.toml` carries an `[env.local]` environment that defines no service bindings and instead sets `<APP>_ORIGIN` vars (`http://127.0.0.1:<port>` for each downstream app). The worker resolves each target as _binding if present, else proxy to the origin_; `pnpm --filter @liveplanner/router dev` runs `wrangler dev --env local --port 3100`, and the root `pnpm dev` includes it.

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
