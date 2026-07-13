# Router app

A small Cloudflare Worker that fronts the apex domain (`livediagram.app`) and routes URL paths to the right underlying app.

- **Workspace:** `apps/router` (`@livediagram/router`).
- **Runtime:** Cloudflare Workers.
- **Production hostname:** `livediagram.app` (custom domain configured in the Cloudflare dashboard). Default Workers URL also remains reachable.

## Routing table

| Path                                                                                                                                           | Forwards to                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `/api`, `/api/*`                                                                                                                               | api worker (`apps/api`)          |
| `/telemetry`, `/telemetry/*`                                                                                                                   | telemetry app (`apps/telemetry`) |
| `/help`, `/help/*`                                                                                                                             | help app (`apps/help`), stripped |
| `/live/*` (the live app's `_next` assets only)                                                                                                 | live app (`apps/live`), stripped |
| live page routes: `/diagram/*`, `/explorer/*`, `/new`, `/join`, `/sign-in`, `/get-started`, `/embed`, `/oauth/*`, `/sso-callback`, `/icon.svg` | live app (`apps/live`), as-is    |
| everything else                                                                                                                                | marketing app (`apps/marketing`) |

The live app serves at **clean URLs** — there's no `/live` prefix in the address bar. Marketing owns every other first segment (`/`, `/alternatives`, `/faq`, the legal pages), and the live app's route segments don't overlap any of them, so the router selects the live app by matching its known first segments (`LIVE_ROUTE_SEGMENTS` in the source) and forwards those **as-is** (no strip — the live worker's `out/` files are already prefix-free).

The one thing that keeps a `/live` prefix is the live app's bundled **`_next` assets** (its prod `assetPrefix: '/live'`). Both Next static exports want `/_next`, so the live app's assets ride `/live/_next/*` to avoid colliding with marketing's `/_next`. The router **strips** `/live` from those before forwarding (shared `forwardStripped()` helper, same as `/telemetry/*`) so the worker serves them from `out/_next`. (Next's `basePath` used to add the prefix to pages too; that's gone — only `assetPrefix` remains, on assets only.)

`/api/*` is forwarded **as-is** — no prefix stripping. The api worker expects the full `/api/...` path. Marketing sees `/`, `/faq`, etc. as-is.

## Implementation

In production the Worker has five **service bindings**, one to each downstream app (MARKETING / LIVE / API / TELEMETRY / HELP). A shared `forward()` helper resolves each target as _binding if present, else local-dev origin_ (see Local development below) and strips the prefix for the basePath/assetPrefix paths (live assets + telemetry + help) when forwarding to a binding:

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
  'sso-callback',
]);
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return forward(request, url, env.API, env.API_ORIGIN); // /api/* as-is; api worker wants the full path
    }
    // /live/* is now ONLY the live app's _next assets — strip and forward.
    if (url.pathname === '/live' || url.pathname.startsWith('/live/')) {
      return forward(request, url, env.LIVE, env.LIVE_ORIGIN, '/live');
    }
    if (url.pathname === '/telemetry' || url.pathname.startsWith('/telemetry/')) {
      return forward(request, url, env.TELEMETRY, env.TELEMETRY_ORIGIN, '/telemetry');
    }
    // Clean live-app page routes + its root icon: forward as-is (no strip).
    if (LIVE_ROUTE_SEGMENTS.has(url.pathname.split('/')[1]) || url.pathname === '/icon.svg') {
      return forward(request, url, env.LIVE, env.LIVE_ORIGIN);
    }
    return forward(request, url, env.MARKETING, env.MARKETING_ORIGIN);
  },
};
```

Adding a new top-level route to the live app means adding its first segment to `LIVE_ROUTE_SEGMENTS` here, or the router will send it to marketing.

Service bindings target deployed Workers. The downstream apps deploy as their own units; the router stitches them together.

## Local development

The router **also runs locally**, so `pnpm dev` gives you the production URL shape on one port — `http://localhost:3000` serves marketing at `/`, the editor at `/new` etc., `/telemetry`, `/help`, and `/api`, with no per-app port to remember. Each app still runs on its own port underneath and stays directly reachable:

| App       | Local URL                                                           |
| --------- | ------------------------------------------------------------------- |
| router    | `http://localhost:3000/` — everything, stitched like production     |
| marketing | `http://localhost:3001/`                                            |
| live      | `http://localhost:3002/new`, `/explorer/recent`, ... (clean routes) |
| telemetry | `http://localhost:3003/telemetry` (basePath baked in)               |
| help      | `http://localhost:3004/help` (basePath baked in)                    |
| api       | `http://localhost:8787/api/...` (wrangler dev)                      |

**How local mode works.** Service bindings only exist between deployed Workers, so the router's `wrangler.toml` carries an `[env.local]` environment that defines no service bindings and instead sets `<APP>_ORIGIN` vars (`http://127.0.0.1:<port>` for each downstream app). The worker resolves each target as _binding if present, else proxy to the origin_; `pnpm --filter @livediagram/router dev` runs `wrangler dev --env local --port 3000`, and the root `pnpm dev` includes it.

Origin mode forwards **as-is, never stripped**: unlike the deployed static-asset workers (which hold prefix-free `out/` files), the local Next dev servers serve their own prefixes themselves — `basePath` for telemetry/help, and the live app's `/live` assetPrefix, which applies **in dev too** (Next's dev server serves both the prefixed and unprefixed asset paths) precisely so the local router can tell live's `/live/_next/*` apart from marketing's `/_next/*` the same way production does.

The routing decisions stay identical in both modes — only the transport (binding vs origin proxy) and the stripping differ. The router remains optional: visiting each app's own port directly still works.

## Routing infrastructure, not logic

The router is **routing infrastructure**, not application logic, holding no data and running no business rules. That separation is non-negotiable: if you find yourself adding business logic to the router, stop, the logic belongs in a service the router forwards to (marketing, live, telemetry, help, or api).
