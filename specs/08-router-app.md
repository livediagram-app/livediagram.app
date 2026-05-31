# Router app

A small Cloudflare Worker that fronts the apex domain (`livediagram.app`) and routes URL paths to the right underlying app.

- **Workspace:** `apps/router` (`@livediagram/router`).
- **Runtime:** Cloudflare Workers.
- **Production hostname:** `livediagram.app` (custom domain configured in the Cloudflare dashboard). Default Workers URL also remains reachable.

## Routing table

| Path               | Forwards to                      |
| ------------------ | -------------------------------- |
| `/api`, `/api/*`   | api worker (`apps/api`)          |
| `/live`, `/live/*` | live app (`apps/live`)           |
| everything else    | marketing app (`apps/marketing`) |

The router **does** rewrite the path for `/live/*` requests: the `/live` prefix is stripped before forwarding so the live worker sees `/`, `/some-path` etc. This is because Next.js's `basePath` option rewrites URL references inside the HTML/JS bundles but does **not** shift the actual file layout — the static export still places `index.html`, `_next/`, and `404.html` at the root of `out/`. The router translates the public URL space (with `/live` prefix) to the live worker's internal URL space (no prefix).

`/api/*` is forwarded **as-is** — no prefix stripping. The api worker expects to see the full `/api/...` path and dispatches its routes from there.

Marketing sees `/`, `/pricing`, etc., as-is — no rewriting.

## Implementation

The Worker has three **service bindings** — one to each downstream app — and dispatches based on URL prefix.

```ts
// sketch — real source: apps/router/src/index.ts
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return env.API.fetch(request);
    }
    if (url.pathname === '/live' || url.pathname.startsWith('/live/')) {
      // strip the `/live` prefix before forwarding (see above).
      const rewritten = new URL(url.toString());
      rewritten.pathname = url.pathname.slice('/live'.length) || '/';
      return env.LIVE.fetch(new Request(rewritten.toString(), request));
    }
    return env.MARKETING.fetch(request);
  },
};
```

Service bindings target deployed Workers. The downstream apps deploy as their own units; the router stitches them together.

## Local development

The router worker is **not required for local dev**. Each app runs on its own port:

| App       | Local URL                                        |
| --------- | ------------------------------------------------ |
| marketing | `http://localhost:3001/`                         |
| live      | `http://localhost:3002/live` (basePath baked in) |
| api       | `http://localhost:8787/api/...` (wrangler dev)   |

Visit whichever you're working on directly. The router only matters in production where everything serves from one hostname.

## Routing infrastructure, not logic

The router is **routing infrastructure**, not application logic — it holds no data and runs no business rules. That separation is non-negotiable: if you find yourself adding business logic to the router, stop, the logic belongs in a service the router forwards to (marketing, live, or api).
