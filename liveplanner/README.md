# liveplanner

A free, real-time planner for teams. A **project** (a **plan**, as people see it) holds Board, Sheet, Dashboard and Form tabs: boards of cards for the work, spreadsheets for the numbers, dashboards that show both side by side, and forms whose responses land as cards. Share one link and everyone plans it together, live, with presence, cursors, comments and assigned actions. Nothing sits behind a sign-in wall: open a link and start planning.

liveplanner is free to use, with no trackers and no ads. It runs at liveplanner.app, deployed from the monorepo's root workflows ([CI](../docs/ci.md)).

```
apps/        marketing site + editor + help centre + api + mcp server + router + cli
packages/    the project model, wire-format types, UI, template catalogues + template previews, help-article registry, Form tabs, items and the Plan board projection, Plan images, the Sheet engine, agent verbs, the edit-operations engine, tab views, telemetry facts, licence tables, the brand ramps (code every product shares is in the monorepo's packages/ as @liveworkspace/*)
scripts/     dev tooling (the shared Next.js dev launcher, the e2e stack, coverage and CI test filters, git hooks)
docs/        guides, product specs (docs/specs, read these before adding features) and instructions
marketing/   off-site copy + media for listings and promotion (see docs/specs/019-marketing/marketing-assets.md)
```

## Start here

| If you want to...                                     | Read                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| Understand what liveplanner does and where it's going | [docs/README.md](docs/README.md)                                               |
| Run it on your machine                                | [docs/development/local-development.md](docs/development/local-development.md) |
| See the repo's shape (apps, packages, deploy)         | [docs/development/architecture.md](docs/development/architecture.md)           |
| Change the code                                       | [docs/development/engineering-notes.md](docs/development/engineering-notes.md) |
| Read the spec for a specific behaviour                | [docs/specs/README.md](docs/specs/README.md)                                   |

## The 30-second tour

| App                              | What it is                                                                                                                                                                                                                                                                                                                                             | Dev port |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| **router** (`apps/router`)       | A Cloudflare Worker that stitches the web apps and the api under one hostname. Holds no business logic.                                                                                                                                                                                                                                                | 3200     |
| **marketing** (`apps/marketing`) | The pitch and feature tour at `/`.                                                                                                                                                                                                                                                                                                                     | 3201     |
| **editor** (`apps/editor`)       | The planner itself, at clean routes (`/new`, `/project/<id>`, `/explorer/...`). Guests get a per-browser identity and full persistence; signed-in people get the same plus cross-device sync, teams and email. `/explorer` opens on [Home](docs/specs/013-workspace/explorer-home.md), with the [Inbox](docs/specs/013-workspace/inbox.md) beneath it. | 3202     |
| **help** (`apps/help`)           | The static help centre at `/help`.                                                                                                                                                                                                                                                                                                                     | 3204     |
| **api** (`apps/api`)             | A Cloudflare Worker at `/api/*`: REST plus one Durable Object per project (its content and realtime room).                                                                                                                                                                                                                                             | 8887     |
| **mcp** (`apps/mcp`)             | A Cloudflare Worker at its own host, `mcp.liveplanner.app`, that gives AI clients the project tools (boards, cards, sheets, forms) over OAuth.                                                                                                                                                                                                         | 8888     |
| **cli** (`apps/cli`)             | `liveplanner`, the command line agents and scripts read and change projects with ([CLI](docs/specs/015-api/cli.md)).                                                                                                                                                                                                                                   | n/a      |

The whole stack runs on Cloudflare Workers (Static Assets for the Next.js apps). There's no Node-hosted backend, no SSR and no Next.js API routes. The wrangler configs pin the liveworkspace Cloudflare account, which also holds liveplanner.app ([Deployment](docs/specs/016-platform/deployment.md)).

## The rules that keep the repo honest

- **Specs first**: every product decision lives in [`docs/specs/`](docs/specs/). Write or update the spec before the code. See [docs/development/engineering-notes.md](docs/development/engineering-notes.md).
- **Static-only frontends**: Next.js `output: 'export'`. Server logic goes in the api worker, never in Next.js.
- **Reuse over duplication**: shared code lives in [`packages/`](packages/), never copied across apps.
- **No secrets in source**, ever. Env vars and `wrangler secret put` only. See [`docs/specs/002-project-scope/secrets-policy.md`](docs/specs/002-project-scope/secrets-policy.md).

## Security

Found a vulnerability? Please report it privately to [security@liveplanner.app](mailto:security@liveplanner.app). See [`SECURITY.md`](SECURITY.md).

## Licence

[MIT](LICENSE). The source is not public. liveplanner is free to use; there's **no paid tier and no plan to introduce one** ([`docs/specs/002-project-scope/business-model-and-licence.md`](docs/specs/002-project-scope/business-model-and-licence.md)). Its SaaS integrations are all optional (the liveworkspace accounts Worker for sign-in and Cloudflare Email Service for transactional email, each gated on its own key or binding), and the planner runs fully without either of them.

Third-party components keep their own licences. Icon artwork includes Lucide (ISC) and Feather (MIT); see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Every third-party work the apps ship is credited, with its licence and notices, on the generated `/licences` page ([Third-party licences](docs/specs/002-project-scope/third-party-licences.md)).
