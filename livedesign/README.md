# livedesign

A collaborative editor for logos, wireframes and photos that works without signing in. What you make is a **design**: tabs of pages, each page a logo artboard, a wireframe of a screen, or a photo edited in layers. Open a link, design, share, present the pages, export them (PDF, PNG, SVG, JSON, a Logo Kit, or a photo as PNG, JPEG, WebP or PSD). Real-time presence, cursors, comments, undo and redo. The editor never sits behind an auth wall, so the friction to start is "open the link, start designing."

**Live at [livedesign.app](https://livedesign.app).** MIT-licensed and self-hostable end-to-end.

```
apps/        marketing site + editor + telemetry dashboard + help centre + api + mcp server + router + cli
packages/    shared design model, the photo engine, wire-format types, UI primitives, icon + template catalogues + template previews, help-article registry, the Explorer filter lens, page backgrounds, the api client and agent verbs, the edit-operations engine, design views, the lint, PNG rendering, telemetry client, the TypeScript source parser for static guards, the licences generator, configs
scripts/     repo-wide dev tooling (shared Next.js dev launcher)
docs/        guides, product specs (docs/specs, read these before adding features) and instructions
marketing/   off-site copy + media for listings and promotion (see docs/specs/019-marketing/marketing-assets.md)
```

## Start here

| If you want to...                                    | Read                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| Understand what livedesign does and where it's going | [docs/README.md](docs/README.md)                                               |
| Run it on your machine                               | [docs/development/local-development.md](docs/development/local-development.md) |
| Host it on your own Cloudflare account               | [docs/operations/self-hosting.md](docs/operations/self-hosting.md)             |
| See the repo's shape (apps, packages, deploy)        | [docs/development/architecture.md](docs/development/architecture.md)           |
| Propose a change                                     | [docs/development/contributing.md](docs/development/contributing.md)           |
| Read the spec for a specific behaviour               | [docs/specs/README.md](docs/specs/README.md)                                   |

## The 30-second tour

- **Marketing** at `/` is the pitch and feature tour.
- **Editor** is where designs are made and presented, served at clean routes (`/new`, `/design/<id>`, `/explorer/...`; no `/live` prefix). Guests get a per-browser identity and full persistence; signed-in users get the same plus cross-device sync. `/explorer` opens on **Home** ([Explorer Home](docs/specs/013-workspace/explorer-home.md)); the **Inbox** beneath it lists what is still outstanding for you (open actions assigned to or by you, comment threads you are in) across every design ([Inbox](docs/specs/013-workspace/inbox.md)), and the **Timeline** is a day-grouped feed of everything that happened across your designs, teams and account ([Timeline](docs/specs/013-workspace/timeline.md)).
- **Pages** are the editor's one mode. A page is a **logo** (the 1024 artboard, logo layouts, the markers and the Pen, and a Logo Kit export) ([Logo pages](docs/specs/007-editor/logo-pages.md)), a **wireframe** (a device frame for a phone, tablet or desktop screen) ([Wireframe pages](docs/specs/007-editor/wireframe-pages.md)) or a **photo** (pixel, adjustment, fill, text and group layers, selections, brushes, retouching, adjustments, filters, PSD in and out) ([Photo pages](docs/specs/031-photo/photo-pages.md)). New designs start from the Logos, Photos or Wireframes templates. The **Slides** view steps through a tab's pages full screen to present them ([Presentation mode](docs/specs/012-collaboration/presentation-mode.md)).
- **API** at `/api/*` is a Cloudflare Worker (REST + WebSocket realtime room per design, backed by D1).
- **Telemetry** at `/telemetry` is the public anonymous-events dashboard (off in OSS forks by default).
- **Help** at `/help` is the static help centre (guides, feature docs, troubleshooting).
- **MCP** at `mcp.livedesign.app` is a Cloudflare Worker that exposes the design tools to AI clients (Claude and other MCP hosts) over OAuth — its own host, not a router path.
- **Router** stitches marketing, the editor, telemetry, help and the API under one hostname.
- **CLI** (`apps/cli`) is `livedesign`, the command line agents and scripts read and change designs with, published on npm as `@livedesign/cli`. It also opens a design inside a developer tool ([CLI](docs/specs/015-api/cli.md), [Workbench embeds](docs/specs/013-workspace/workbench-embeds.md)).

The whole stack runs on Cloudflare Workers (Static Assets for the Next.js apps). There's no Node-hosted backend, no SSR, no Next.js API routes.

## The rules that keep the repo honest

- **Specs first**: every product decision lives in [`docs/specs/`](docs/specs/). Write or update the spec before the code. See [docs/development/contributing.md](docs/development/contributing.md).
- **Static-only frontends**: Next.js `output: 'export'`. Server logic goes in the api worker, never in Next.js.
- **Reuse over duplication**: shared code lives in [`packages/`](packages/), never copied across apps.
- **No secrets in source**: the repo is public. Env vars, `wrangler secret put`, GitHub Actions secrets only. See [`docs/specs/002-project-scope/secrets-policy.md`](docs/specs/002-project-scope/secrets-policy.md).

## Security

Found a vulnerability? Please report it privately through [GitHub's advisory form](https://github.com/livedesign-app/livedesign.app/security/advisories/new), never in a public issue. See [`SECURITY.md`](SECURITY.md) and the [full policy](https://livedesign.app/help/policies/report-a-vulnerability/).

## License

[MIT](LICENSE). Anyone can self-host. A free hosted version runs alongside at [livedesign.app](https://livedesign.app); there's **no paid tier and no plan to introduce one** ([`docs/specs/002-project-scope/open-source-and-business-model.md`](docs/specs/002-project-scope/open-source-and-business-model.md)). Its SaaS integrations are all optional — Clerk (auth), Resend (transactional email), and OpenAI (the AI assistant), each gated on its own key — and the editor runs fully without any of them.

Icon artwork includes Lucide (ISC) and Feather (MIT); see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Every third-party work the deployed apps ship is credited, with its licence and notices, on the generated [/licences](https://livedesign.app/licences) page ([Third-party licences](docs/specs/002-project-scope/third-party-licences.md)).
