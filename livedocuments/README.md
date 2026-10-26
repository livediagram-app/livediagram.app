# livedocuments

A collaborative editor for documents made of pages (articles, slide decks and infographics) that works without signing in. Open a link, make pages, share, present. Real-time presence, cursors, comments, undo and redo. The editor never sits behind an auth wall, so the friction to start is "open the link, start writing."

**Live at [livedocuments.app](https://www.livedocuments.app).** MIT-licensed.

```
apps/        marketing site + editor + help centre + api + mcp server + router + cli
packages/    this product's document model, wire-format types, UI, template catalogue + template previews, help-article registry, agent verbs, the edit-operations engine, document views, the lint, telemetry facts, licence tables, brand ramps (the shared @liveworkspace/* packages sit in the monorepo's packages/)
scripts/     repo-wide dev tooling (shared Next.js dev launcher)
docs/        guides, product specs (docs/specs, read these before adding features) and instructions
marketing/   off-site copy + media for listings and promotion (see docs/specs/019-marketing/marketing-assets.md)
```

## Start here

| If you want to...                                       | Read                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Understand what livedocuments does and where it's going | [docs/README.md](docs/README.md)                                               |
| Run it on your machine                                  | [docs/development/local-development.md](docs/development/local-development.md) |
| See the repo's shape (apps, packages, deploy)           | [docs/development/architecture.md](docs/development/architecture.md)           |
| Propose a change                                        | [docs/development/contributing.md](docs/development/contributing.md)           |
| Read the spec for a specific behaviour                  | [docs/specs/README.md](docs/specs/README.md)                                   |

## The 30-second tour

- **Marketing** at `/` is the pitch and feature tour.
- **Editor** is where pages are made and presented, served at clean routes (`/new`, `/document/<id>`, `/explorer/...`; no `/live` prefix). Guests get a per-browser identity and full persistence; signed-in users get the same plus cross-device sync. `/explorer` opens on **Home** ([Explorer Home](docs/specs/013-workspace/explorer-home.md)); the **Inbox** beneath it lists what is still outstanding for you (open actions assigned to or by you, comment threads you are in) across every document ([Inbox](docs/specs/013-workspace/inbox.md)), and the **Timeline** is a day-grouped feed of everything that happened across your documents, teams and account ([Timeline](docs/specs/013-workspace/timeline.md)).
- **API** at `/api/*` is a Cloudflare Worker (REST + WebSocket realtime room per document; each document's content in its own Durable Object, no D1).
- **Telemetry** is liveworkspace's: events go to its central service and `/telemetry` redirects to its public dashboard, filtered to livedocuments (off in OSS forks by default).
- **Help** at `/help` is the static help centre (guides, feature docs, troubleshooting).
- **MCP** at `mcp.livedocuments.app` is a Cloudflare Worker that exposes the document tools to AI clients (Claude and other MCP hosts) over OAuth, on its own host, not a router path.
- **Router** stitches marketing, the editor, help and the API under one hostname.
- **CLI** (`apps/cli`) is `livedocuments`, the command line agents and scripts read and change documents with, published on npm as `@livedocuments/cli`. It also opens a document inside a developer tool ([CLI](docs/specs/015-api/cli.md), [Workbench embeds](docs/specs/013-workspace/workbench-embeds.md)).

The whole stack runs on Cloudflare Workers (Static Assets for the Next.js apps). There's no Node-hosted backend, no SSR, no Next.js API routes.

## The rules that keep the repo honest

- **Specs first**: every product decision lives in [`docs/specs/`](docs/specs/). Write or update the spec before the code. See [docs/development/contributing.md](docs/development/contributing.md).
- **Static-only frontends**: Next.js `output: 'export'`. Server logic goes in the api worker, never in Next.js.
- **Reuse over duplication**: shared code lives in [`packages/`](packages/), never copied across apps.
- **No secrets in source**: the repo is public. Env vars, `wrangler secret put`, GitHub Actions secrets only. See [`docs/specs/002-project-scope/secrets-policy.md`](docs/specs/002-project-scope/secrets-policy.md).

## Security

Found a vulnerability? Please report it privately through [GitHub's advisory form](https://github.com/livedocuments-app/livedocuments.app/security/advisories/new), never in a public issue. See [`SECURITY.md`](SECURITY.md) and the [full policy](https://www.livedocuments.app/help/policies/report-a-vulnerability/).

## License

[MIT](LICENSE). A free hosted version runs at [livedocuments.app](https://www.livedocuments.app); there's **no paid tier and no plan to introduce one** ([`docs/specs/002-project-scope/open-source-and-business-model.md`](docs/specs/002-project-scope/open-source-and-business-model.md)). Its SaaS integrations are all optional (the liveworkspace accounts Worker (sign-in, gated on its client key) and Cloudflare Email Service (transactional email, gated on its `EMAIL` binding), and the editor runs fully without either of them.

Icon artwork includes Lucide (ISC) and Feather (MIT); see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Every third-party work the deployed apps ship is credited, with its licence and notices, on the generated [/licences](https://www.livedocuments.app/licences) page ([Third-party licences](docs/specs/002-project-scope/third-party-licences.md)).
