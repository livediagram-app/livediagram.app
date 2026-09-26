# livediagram

A collaborative diagram editor that works without signing in. Open a link, draw, share. Real-time presence, cursors, comments, per-tab activity log with surgical revert. The canvas never sits behind an auth wall, so the friction to start is "open the link, start drawing."

**Live at [livediagram.app](https://livediagram.app).** MIT-licensed and self-hostable end-to-end.

```
apps/        marketing site + editor + telemetry dashboard + help centre + api + mcp server + router
packages/    shared diagram model, wire-format types, UI primitives, icon + template catalogues + template previews, help-article registry, telemetry client, configs
scripts/     repo-wide dev tooling (shared Next.js dev launcher)
docs/        guides, product specs (docs/specs, read these before adding features) and instructions
marketing/   off-site copy + media for listings and promotion (see docs/specs/019-marketing/marketing-assets.md)
```

## Start here

| If you want to...                                     | Read                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| Understand what livediagram does and where it's going | [docs/product/what-is-livediagram.md](docs/product/what-is-livediagram.md)     |
| Run it on your machine                                | [docs/development/local-development.md](docs/development/local-development.md) |
| Host it on your own Cloudflare account                | [docs/operations/self-hosting.md](docs/operations/self-hosting.md)             |
| See the repo's shape (apps, packages, deploy)         | [docs/development/architecture.md](docs/development/architecture.md)           |
| Propose a change                                      | [docs/development/contributing.md](docs/development/contributing.md)           |
| Read the spec for a specific behaviour                | [docs/specs/README.md](docs/specs/README.md)                                   |

## The 30-second tour

- **Marketing** at `/` is the pitch and feature tour.
- **Editor** is the canvas, served at clean routes (`/new`, `/diagram/<id>`, `/explorer/...`; no `/live` prefix). Guests get a per-browser identity and full persistence; signed-in users get the same plus cross-device sync. `/explorer` opens on the **Timeline**, a day-grouped feed of everything that happened across your diagrams, teams and account ([Timeline](docs/specs/013-workspace/timeline.md)); the **Activity** section beside it lists what is still outstanding for you (open actions assigned to or by you, comment threads you are in) across every diagram ([Activity page](docs/specs/013-workspace/activity-page.md)).
- **API** at `/api/*` is a Cloudflare Worker (REST + WebSocket realtime room per diagram, backed by D1).
- **Telemetry** at `/telemetry` is the public anonymous-events dashboard (off in OSS forks by default).
- **Help** at `/help` is the static help centre (guides, feature docs, troubleshooting).
- **MCP** at `mcp.livediagram.app` is a Cloudflare Worker that exposes the diagram tools to AI clients (Claude and other MCP hosts) over OAuth — its own host, not a router path.
- **Router** stitches the five under one hostname.

The whole stack runs on Cloudflare Workers (Static Assets for the Next.js apps). There's no Node-hosted backend, no SSR, no Next.js API routes.

## The rules that keep the repo honest

- **Specs first**: every product decision lives in [`docs/specs/`](docs/specs/). Write or update the spec before the code. See [docs/development/contributing.md](docs/development/contributing.md).
- **Static-only frontends**: Next.js `output: 'export'`. Server logic goes in the api worker, never in Next.js.
- **Reuse over duplication**: shared code lives in [`packages/`](packages/), never copied across apps.
- **No secrets in source**: the repo is public. Env vars, `wrangler secret put`, GitHub Actions secrets only. See [`docs/specs/002-project-scope/secrets-policy.md`](docs/specs/002-project-scope/secrets-policy.md).

## License

[MIT](LICENSE). Anyone can self-host. A free hosted version runs alongside at [livediagram.app](https://livediagram.app); there's **no paid tier and no plan to introduce one** ([`docs/specs/002-project-scope/open-source-and-business-model.md`](docs/specs/002-project-scope/open-source-and-business-model.md)). Its SaaS integrations are all optional — Clerk (auth), Resend (transactional email), and OpenAI (the AI assistant), each gated on its own key — and the editor runs fully without any of them.
