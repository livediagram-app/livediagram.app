# Architecture

A pnpm + Turborepo monorepo: seven Cloudflare-deployed apps and seven shared packages. Everything runs on Cloudflare Workers (Static Assets for the Next.js apps); there's no Node-hosted backend.

```
apps/
  marketing/    static landing site (Next.js export, /)
  live/         the editor (Next.js export; clean routes)
  telemetry/    public anonymous-events dashboard (Next.js export, /telemetry)
  help/         help centre (Next.js export + MDX, /help)
  api/          REST + WebSocket worker (D1 + Durable Objects + R2, /api)
  mcp/          MCP server for AI tools (OAuth + tools, mcp.livediagram.app)
  router/       service-binding router stitching the apps under one hostname
packages/
  ui/             shared UI primitives (Brand, etc.)
  diagram/        diagram data model (Tab, Element types + helpers)
  api-schema/     wire-format DTOs the api worker emits + the live editor consumes
  eslint-config/  shared ESLint flat config
  prettier-config/shared Prettier config
  tailwind-config/shared Tailwind theme (brand palette)
  vitest-config/  shared Vitest defaults
specs/          product source of truth, read these before adding features
scripts/        repo-wide dev tooling (next-dev.mjs: shared Next.js dev launcher)
marketing/      off-site copy + media for listings and promotion (see specs/23)
  copy/         taglines, descriptions, tags, the canonical fact sheet
  media/
    desktop/    desktop product screenshots, captioned
    mobile/     mobile product screenshots, captioned
```

## The apps

| App              | What runs there                                                                                                                                                                                                                                                                                                                                                                                               | Cloudflare worker name  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `apps/marketing` | The landing site at `/`. Pure static HTML built with `next export`. Hero, per-category feature advertising blocks each linking to a detail page per category (`/features/<id>`), FAQ, legal, comparison pages.                                                                                                                                                                                                | `livediagram-marketing` |
| `apps/live`      | The editor at clean routes (`/diagram/*`, `/explorer/*`, `/new`, `/join`, ...; only its `_next` assets keep a `/live` prefix). Next.js static export plus a tiny path-rewrite worker that maps every `/diagram/<id>` to the same statically-built page.                                                                                                                                                       | `livediagram-live`      |
| `apps/telemetry` | A read-only dashboard at `/telemetry` that renders aggregate anonymous events from the api's D1 table.                                                                                                                                                                                                                                                                                                        | `livediagram-telemetry` |
| `apps/help`      | The help centre at `/help`. Next.js static export with MDX article bodies plus a TypeScript article index. Hero search, category + feature grids, article pages with auto TOC. No third-party scripts.                                                                                                                                                                                                        | `livediagram-help`      |
| `apps/api`       | The REST + WebSocket worker at `/api/*`. Holds the D1 + R2 (`IMAGES`) bindings and the per-diagram Durable Object realtime room. Plus the daily retention cron (sweeps old `change_log` + telemetry `events`, and reaps unused images older than 30 days from R2 + D1).                                                                                                                                       | `livediagram-api`       |
| `apps/mcp`       | The MCP server at its own host `mcp.livediagram.app` (spec/62). Hono + the MCP SDK over Streamable HTTP; five tools (find / read / create / add-tab / update diagrams) that wrap the api worker via a service binding, reusing `packages/diagram` for validation / layout / SVG render (rasterised to PNG with resvg-wasm). OAuth 2.1 + PKCE mints an `lvd_` API token. Signed-in only; absent without Clerk. | `livediagram-mcp`       |
| `apps/router`    | A worker that holds no business logic, only `MARKETING` / `LIVE` / `TELEMETRY` / `HELP` / `API` service bindings that forward by path prefix.                                                                                                                                                                                                                                                                 | `livediagram-router`    |

## The shared packages

Each app pulls these in via `workspace:*`:

- **`@livediagram/diagram`** owns the diagram data model: `Tab`, every `Element` type (Shape / Text / Sticky / Image / Freehand / Table / Annotation / Link card / Arrow), defaults, geometry helpers, snap math, group operations, and the pencil's shape-recognition heuristics. The single source of what a diagram IS.
- **`@livediagram/api-schema`** owns the wire format between the api worker and the live editor: every request / response shape, plus the small shared pure helpers it backs (`sha256Hex` for image-upload dedupe, `titleCase` for display-casing preset values across the editor + telemetry dashboard). Adding a field on the server without updating the client used to be routine drift; the typechecker catches it now.
- **`@livediagram/ui`** owns the cross-app UI primitives (`Brand`, the logo + wordmark, and `Tooltip`, the shared hover/focus tooltip; more arrive as common patterns emerge).
- **`@livediagram/eslint-config`** / **`prettier-config`** / **`tailwind-config`** / **`vitest-config`** own the shared lint / format / theme / test configs so every workspace stays consistent.

## Tech stack

What's running:

- **Frontend**: Next.js 15 with `output: 'export'`, React 19, TypeScript, Tailwind CSS 4.
- **API**: Cloudflare Workers (vanilla `fetch` handlers, not Hono).
- **Database**: Cloudflare D1 (SQLite-on-the-edge), accessed only via the api worker.
- **Realtime**: Cloudflare Durable Objects, one room per diagram.
- **Image storage**: Cloudflare R2, content-addressed by SHA-256, gated on owner + share-code reads (see [spec/19](../specs/19-images.md)).
- **AI assistance** (optional): the api worker proxies the OpenAI chat-completions API at `POST /api/ai` (modes ask / clean; the old generate / review modes were removed, see spec/25), with `GET /api/capabilities` reporting whether `OPENAI_API_KEY` is configured. Hidden entirely when the key is absent so OSS forks ship without AI surface (see [spec/25](../specs/25-ai-assistance.md)).
- **Auth** (optional): Clerk for sign-in; the api worker verifies JWTs against `CLERK_JWKS_URL` and silently degrades to pure-guest mode when the env var is unset.
- **Email** (optional): the api worker sends transactional + lifecycle email via Resend (`apps/api/src/email/`) — a welcome on first sign-in, week-1 / week-2 onboarding tips off the daily cron, plus team-invite and account-deleted messages, and two opt-out notifications (someone joins your shared diagram, someone responds to a team invite) configurable on the Explorer profile page. Gated on `RESEND_API_KEY`: no key, no sends, and the `email_lifecycle` table is never touched (see [spec/64](../specs/64-transactional-email.md) and [spec/65](../specs/65-profile-and-email-notifications.md)).
- **API tokens** (optional, spec/61): signed-in users mint revocable `lvd_…` tokens (Explorer → API tokens) to call the REST API from their own scripts; `Authorization: Bearer lvd_…` resolves to the owning Clerk account via a hashed-token lookup. Signed-in only (Clerk-gated, like teams), six-month expiry, stored hashed. Absent in pure-guest mode.
- **API description** (spec/37): `GET /api/openapi.json` serves a public OpenAPI 3.1 document of the whole `/api/*` surface, assembled (`apps/api/src/openapi/`) from a declarative route manifest plus component schemas generated from `@livediagram/api-schema` (`pnpm --filter @livediagram/api gen:openapi`). A drift test pins the manifest to the real dispatch and the committed schemas to the types. The human-facing companion is the help centre's **Developers** category (`apps/help`).
- **Routing edge**: a Cloudflare Worker stitching the apps under one hostname via service bindings.

## Hard constraints

The repo's shape isn't accidental. Three rules keep the stack honest:

- **Static-only frontends.** Next.js apps use `output: 'export'`. No SSR, no Node runtime, no Next.js API routes. Server logic goes in the api worker. Breaking this breaks Cloudflare Pages deploys.
- **Reuse over duplication.** Shared types, UI primitives, configs, and the diagram data model live in `packages/`, never copy-pasted across apps. If two apps need the same thing, it lives in `packages/` on first occurrence.
- **No secrets in source.** The repo is public; secrets travel via env vars (`.env.local`), `wrangler secret put`, and GitHub Actions repo secrets. See [spec/06](../specs/06-secrets-policy.md).

## Auth model in one sentence

Two equivalent identity paths: an `X-Owner-Id` header (a per-browser UUID from `localStorage`) for guests, or a Clerk Bearer token (whose `sub` claim becomes the owner id) for signed-in users. The canvas always works without signing in. See [spec/04](../specs/04-auth-and-guest-access.md) for the full hybrid model and [spec/11](../specs/11-api.md) for how the api worker resolves the owner.

## Deployment

GitHub Actions → Cloudflare Workers, manually triggered after a green CI run. Build artefacts get uploaded once, then five workers (marketing / live / telemetry / help / api) ship in parallel; the `mcp` worker deploys after `api` (it has a service binding to it), and the router deploys last because its service bindings need the others to exist.

See [Self-hosting](self-hosting.md) for the step-by-step, and [spec/10](../specs/10-deployment.md) for the deeper deployment contract.
