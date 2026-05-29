# Router app

A small Cloudflare Worker that fronts the apex domain and routes URL paths to the right underlying app.

- **Workspace:** `apps/router` (`@livediagram/router`).
- **Runtime:** Cloudflare Workers.

## Routing table

| Path               | Forwards to                      |
| ------------------ | -------------------------------- |
| `/live`, `/live/*` | live app (`apps/live`)           |
| everything else    | marketing app (`apps/marketing`) |

The router **does** rewrite the path for `/live/*` requests: the `/live` prefix is stripped before forwarding so the live worker sees `/`, `/some-path` etc. This is because Next.js's `basePath` option rewrites URL references inside the HTML/JS bundles but does **not** shift the actual file layout — the static export still places `index.html`, `_next/`, and `404.html` at the root of `out/`. The router translates the public URL space (with `/live` prefix) to the live worker's internal URL space (no prefix).

Marketing sees `/`, `/pricing`, etc., as-is — no rewriting.

## Implementation

The Worker has two **service bindings** — one to each downstream app — and dispatches based on URL prefix.

```ts
// sketch
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/live' || url.pathname.startsWith('/live/')) {
      return env.LIVE.fetch(request);
    }
    return env.MARKETING.fetch(request);
  },
};
```

Service bindings target deployed Workers (or Pages projects exposed via Workers). The downstream apps deploy as their own units; the router stitches them together.

## Local development

The router worker is **not required for local dev**. Each app runs on its own port:

| App       | Local URL                                        |
| --------- | ------------------------------------------------ |
| marketing | `http://localhost:3001/`                         |
| live      | `http://localhost:3002/live` (basePath baked in) |

Visit whichever you're working on directly. The router only matters in production where everything serves from one hostname.

## Why this is in the prototype scope

[02-prototype-scope.md](02-prototype-scope.md) excludes backend / API Workers. The router is an exception: it's **routing infrastructure**, not application logic. It holds no data, runs no business rules, and is required for the apps to coexist under one hostname even at prototype stage.

If you find yourself adding business logic to the router, stop — that logic belongs in a service the router forwards to.
