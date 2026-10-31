# livedesign

A collaborative editor for logos, wireframes and photos that works without signing in. What you make is a **design**: tabs of pages, each page a logo artboard, a wireframe of a screen, or a photo edited in layers. Open a link, design, share, export the pages (PDF, PNG, SVG, JSON, a Logo Kit, or a photo as PNG, JPEG, WebP or PSD). Real-time presence, cursors, comments, undo and redo. The editor never sits behind an auth wall, so the friction to start is "open the link, start designing."

**Live at [livedesign.app](https://www.livedesign.app).** MIT-licensed and publicly viewable.

```
apps/        marketing site + editor + help centre + api + mcp server + router + cli
packages/    shared design model, the photo engine, wire-format types, UI primitives, icon + template catalogues + template previews, help-article registry, page backgrounds, the api client and agent verbs, the edit-operations engine, design views, the lint, telemetry client, the licences generator, configs (PNG rendering and the TypeScript source parser are the monorepo's @liveworkspace/render-png and @liveworkspace/source-ast)
scripts/     repo-wide dev tooling (shared Next.js dev launcher)
docs/        guides, product specs (docs/specs, read these before adding features) and instructions
marketing/   off-site copy + media for listings and promotion (see docs/specs/019-marketing/marketing-assets.md)
```

## Start here

| If you want to...                                    | Read                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| Understand what livedesign does and where it's going | [docs/README.md](docs/README.md)                                               |
| Run it on your machine                               | [docs/development/local-development.md](docs/development/local-development.md) |
| See the repo's shape (apps, packages, deploy)        | [docs/development/architecture.md](docs/development/architecture.md)           |
| Propose a change                                     | [docs/development/contributing.md](docs/development/contributing.md)           |
| Read the spec for a specific behaviour               | [docs/specs/README.md](docs/specs/README.md)                                   |

## The 30-second tour

- **Marketing** at `/` is the pitch and feature tour.
- **Editor** is where designs are made, served at clean routes (`/new`, `/design/<id>`, `/explorer/...`; no `/live` prefix). Guests get a per-browser identity, and their new designs start in This Browser (saved only there until shared or synced); signed-in users' designs save on livedesign and sync across devices. `/explorer` opens on **Home** ([Explorer Home](docs/specs/013-workspace/explorer-home.md)); the **Inbox** beneath it lists what is still outstanding for you (open actions assigned to or by you, comment threads you are in) across every design ([Inbox](docs/specs/013-workspace/inbox.md)), and the **Timeline** is a day-grouped feed of everything that happened across your designs, teams and account ([Timeline](docs/specs/013-workspace/timeline.md)).
- **Pages** are the editor's one mode. A page is a **logo** (the 1024 artboard, logo layouts, the markers and the Pen, and a Logo Kit export) ([Logo pages](docs/specs/007-editor/logo-pages.md)), a **wireframe** (a device frame for a phone, tablet or desktop screen) ([Wireframe pages](docs/specs/007-editor/wireframe-pages.md)) or a **photo** (pixel, adjustment, fill, text and group layers, selections, brushes, retouching, adjustments, filters, PSD in and out) ([Photo pages](docs/specs/031-photo/photo-pages.md)). New designs start from the Logos, Photos or Wireframes templates.
- **API** at `/api/*` is a Cloudflare Worker (REST + WebSocket realtime room per design; each design's content in its own SQLite-backed Durable Object, with where it is filed and who may open it in liveworkspace's index).
- **Telemetry** is liveworkspace's: events go to its central service and `/telemetry` redirects to its public dashboard, filtered to livedesign (off in OSS forks by default).
- **Help** at `/help` is the static help centre (guides, feature docs, troubleshooting).
- **MCP** at `mcp.livedesign.app` is a Cloudflare Worker that exposes the design tools to AI clients (Claude and other MCP hosts) over OAuth, on its own host, not a router path.
- **Router** stitches marketing, the editor, help and the API under one hostname.
- **CLI** (`apps/cli`) is `livedesign`, the command line agents and scripts read and change designs with, published on npm as `@livedesign/cli`. It also opens a design inside a developer tool ([CLI](docs/specs/015-api/cli.md), [Workbench embeds](docs/specs/013-workspace/workbench-embeds.md)).

The whole stack runs on Cloudflare Workers (Static Assets for the Next.js apps). There's no Node-hosted backend, no SSR, no Next.js API routes.

## The rules that keep the repo honest

- **Specs first**: every product decision lives in [`docs/specs/`](docs/specs/). Write or update the spec before the code. See [docs/development/contributing.md](docs/development/contributing.md).
- **Static-only frontends**: Next.js `output: 'export'`. Server logic goes in the api worker, never in Next.js.
- **Reuse over duplication**: shared code lives in [`packages/`](packages/), never copied across apps.
- **No secrets in source**: the repo is public. Env vars, `wrangler secret put`, GitHub Actions secrets only. See [`docs/specs/002-project-scope/secrets-policy.md`](docs/specs/002-project-scope/secrets-policy.md).

## Security

Found a vulnerability? Please report it privately through [GitHub's advisory form](https://github.com/livediagram-app/livediagram.app/security/advisories/new), never in a public issue. See [`SECURITY.md`](SECURITY.md) and the [full policy](https://www.livedesign.app/help/policies/report-a-vulnerability/).

## License

[MIT](LICENSE). It runs free at [livedesign.app](https://www.livedesign.app); there's **no paid tier and no plan to introduce one** ([`docs/specs/002-project-scope/open-source-and-business-model.md`](docs/specs/002-project-scope/open-source-and-business-model.md)). Its SaaS integrations are all optional (the liveworkspace accounts Worker (sign-in) and Cloudflare Email Service (transactional email), each gated on its own configuration), and the editor runs fully without any of them.

Icon artwork includes Lucide (ISC) and Feather (MIT); see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Every third-party work the deployed apps ship is credited, with its licence and notices, on the generated [/licences](https://www.livedesign.app/licences) page ([Third-party licences](docs/specs/002-project-scope/third-party-licences.md)).
