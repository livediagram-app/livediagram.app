# Router app

A small Cloudflare Worker that fronts the apex domain (`livediagram.app`) and routes URL paths to the right underlying app.

- **Workspace:** `apps/router` (`@livediagram/router`).
- **Runtime:** Cloudflare Workers.
- **Production hostname:** `livediagram.app` (custom domain configured in the Cloudflare dashboard). Default Workers URL also remains reachable.

## Routing table

| Path                                                                                                                               | Forwards to                      |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `/api`, `/api/*`                                                                                                                   | api worker (`apps/api`)          |
| `/telemetry`, `/telemetry/*`                                                                                                       | telemetry app (`apps/telemetry`) |
| `/live/*` (the live app's `_next` assets only)                                                                                     | live app (`apps/live`), stripped |
| live page routes: `/diagram/*`, `/explorer/*`, `/new`, `/join`, `/sign-in`, `/get-started`, `/embed`, `/sso-callback`, `/icon.svg` | live app (`apps/live`), as-is    |
| everything else                                                                                                                    | marketing app (`apps/marketing`) |

The live app serves at **clean URLs** — there's no `/live` prefix in the address bar. Marketing owns every other first segment (`/`, `/alternatives`, `/faq`, the legal pages), and the live app's route segments don't overlap any of them, so the router selects the live app by matching its known first segments (`LIVE_ROUTE_SEGMENTS` in the source) and forwards those **as-is** (no strip — the live worker's `out/` files are already prefix-free).

The one thing that keeps a `/live` prefix is the live app's bundled **`_next` assets** (its prod `assetPrefix: '/live'`). Both Next static exports want `/_next`, so the live app's assets ride `/live/_next/*` to avoid colliding with marketing's `/_next`. The router **strips** `/live` from those before forwarding (shared `forwardStripped()` helper, same as `/telemetry/*`) so the worker serves them from `out/_next`. (Next's `basePath` used to add the prefix to pages too; that's gone — only `assetPrefix` remains, on assets only.)

`/api/*` is forwarded **as-is** — no prefix stripping. The api worker expects the full `/api/...` path. Marketing sees `/`, `/faq`, etc. as-is.

## Implementation

The Worker has four **service bindings**, one to each downstream app (MARKETING / LIVE / API / TELEMETRY). `forwardStripped()` is shared by the two prefix-stripped paths (live assets + telemetry):

```ts
// sketch, real source: apps/router/src/index.ts
const LIVE_ROUTE_SEGMENTS = new Set([
  'diagram',
  'embed',
  'explorer',
  'get-started',
  'join',
  'new',
  'sign-in',
  'sso-callback',
]);
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return env.API.fetch(request); // /api/* as-is; api worker wants the full path
    }
    // /live/* is now ONLY the live app's _next assets — strip and forward.
    if (url.pathname === '/live' || url.pathname.startsWith('/live/')) {
      return forwardStripped(request, url, '/live', env.LIVE);
    }
    if (url.pathname === '/telemetry' || url.pathname.startsWith('/telemetry/')) {
      return forwardStripped(request, url, '/telemetry', env.TELEMETRY);
    }
    // Clean live-app page routes + its root icon: forward as-is (no strip).
    if (LIVE_ROUTE_SEGMENTS.has(url.pathname.split('/')[1]) || url.pathname === '/icon.svg') {
      return env.LIVE.fetch(request);
    }
    return env.MARKETING.fetch(request);
  },
};
```

Adding a new top-level route to the live app means adding its first segment to `LIVE_ROUTE_SEGMENTS` here, or the router will send it to marketing.

Service bindings target deployed Workers. The downstream apps deploy as their own units; the router stitches them together.

## Local development

The router worker is **not required for local dev**. Each app runs on its own port:

| App       | Local URL                                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| marketing | `http://localhost:3001/`                                                                                             |
| live      | `http://localhost:3002/new`, `/explorer/recent`, ... (clean routes; no router, so assets serve at `/_next` directly) |
| telemetry | `http://localhost:3003/telemetry` (basePath baked in)                                                                |
| api       | `http://localhost:8787/api/...` (wrangler dev)                                                                       |

Visit whichever you're working on directly. The router only matters in production where everything serves from one hostname.

## Routing infrastructure, not logic

The router is **routing infrastructure**, not application logic, holding no data and running no business rules. That separation is non-negotiable: if you find yourself adding business logic to the router, stop, the logic belongs in a service the router forwards to (marketing, live, telemetry, or api).
