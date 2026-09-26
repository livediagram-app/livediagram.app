# Architecture

A pnpm + Turborepo monorepo: seven Cloudflare-deployed apps and thirteen shared packages. Everything runs on Cloudflare Workers (Static Assets for the Next.js apps); there's no Node-hosted backend.

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
  ui/             shared UI primitives + chrome icons (Brand, Timeline, CloseIcon, etc.)
  diagram/        diagram data model (Tab, Element types + helpers)
  icons/          icon catalogues (line-art + Technology marks) + SVG markup builders
  templates/      template catalogue + pure element builders (editor Quick Start + MCP)
  template-previews/ per-template preview SVGs (editor picker + marketing template gallery)
  help-registry/  help-centre article/category registry + search keywords (help app + editor search)
  api-schema/     wire-format DTOs the api worker emits + the live editor consumes
  sticky-vision/  finds sticky notes in a photo of a wall (classical CV, no DOM)
  sticky-model/   the learned boundary model's pure parts (cues, decode) + its training scripts
  telemetry-client/ shared browser telemetry emitter (buffer / flush / page-hide beacon)
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

| App              | What runs there                                                                                                                                                                                                                                                                                                                                                                                                                                          | Cloudflare worker name  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `apps/marketing` | The landing site at `/`. Pure static HTML built with `next export`. Hero, per-category feature advertising blocks each linking to a detail page per category (`/features/<id>`), FAQ, legal, comparison pages.                                                                                                                                                                                                                                           | `livediagram-marketing` |
| `apps/live`      | The editor at clean routes (`/diagram/*`, `/explorer/*`, `/new`, `/join`, ...; only its `_next` assets keep a `/live` prefix). Next.js static export plus a tiny path-rewrite worker that maps every `/diagram/<id>` to the same statically-built page.                                                                                                                                                                                                  | `livediagram-live`      |
| `apps/telemetry` | A read-only dashboard at `/telemetry` that renders aggregate anonymous events from the api's D1 table.                                                                                                                                                                                                                                                                                                                                                   | `livediagram-telemetry` |
| `apps/help`      | The help centre at `/help`. Next.js static export with MDX article bodies plus a TypeScript article index. Hero search, category + feature grids, article pages with auto TOC. No third-party scripts.                                                                                                                                                                                                                                                   | `livediagram-help`      |
| `apps/api`       | The REST + WebSocket worker at `/api/*`. Holds the D1 + R2 (`IMAGES`) bindings and the per-diagram Durable Object realtime room. Plus the daily retention cron (sweeps old `change_log`, `timeline_events`, and telemetry `events`, reaps unused images older than 30 days from R2 + D1, and emits the Timeline's forward-dated expiry warnings).                                                                                                        | `livediagram-api`       |
| `apps/mcp`       | The MCP server at its own host `mcp.livediagram.app` (spec/62). Hono + the MCP SDK over Streamable HTTP; nine tools (find / read / list-templates / create / add-tab / update / share / rename / delete diagrams) that wrap the api worker via a service binding, reusing `packages/diagram` for validation / layout / SVG render (rasterised to PNG with resvg-wasm). OAuth 2.1 + PKCE mints an `lvd_` API token. Signed-in only; absent without Clerk. | `livediagram-mcp`       |
| `apps/router`    | A worker that holds no business logic, only `MARKETING` / `LIVE` / `TELEMETRY` / `HELP` / `API` service bindings that forward by path prefix. In local dev the bindings are replaced by `*_ORIGIN` vars (`wrangler dev --env local`) so the same worker proxies the localhost dev servers on one port (spec/08).                                                                                                                                         | `livediagram-router`    |

## The shared packages

Each app pulls these in via `workspace:*`:

- **`@livediagram/diagram`** owns the diagram data model: `Tab`, every `Element` type (Shape / Text / Sticky / Image / Freehand / Table / Annotation / Link card / Arrow), defaults, geometry helpers, snap math, layer ordering, the web components' layouts, the load-time migration of diagrams saved with groups, and the Shape Pen's shape-recognition heuristics. The single source of what a diagram IS.
- **`@livediagram/sticky-vision`** finds the sticky notes in a photograph of an event-storming wall (spec/139 Phase 8): colour classification against the notation catalogue, connected components, box fitting and row clustering, over a plain RGBA buffer. It is deliberately classical rather than a vision model — the notation IS colour, a hue histogram knows colour exactly, and the whole photo then never has to leave the browser (only crops of individual notes go to the model, to read the handwriting). See `packages/sticky-vision/README.md` and `docs/vision/sticky-detection.md`. A small learned boundary model (**`@livediagram/sticky-model`**, trained on synthetic walls only) may correct its boxes: the editor runs it in a Web Worker on TensorFlow.js (WebGPU, else WASM), loaded on demand from the live app's own static assets, and hands its cues to the detector; without it, the classical detector runs alone (`apps/live/lib/photo-model/`, `docs/vision/experiments/m-editor-model.md`).
- **`@livediagram/sticky-model`** is the learned boundary model the photo import runs beside the classical detector (spec/139 Phase 9): a tiny U-Net (note core / seam / background) trained ONLY on procedurally generated walls, so nothing in it derives from anyone's photograph. Its browser-safe entry (cues, decode) runs in a Web Worker the editor loads lazily when a photo import starts (TensorFlow.js, WebGPU falling back to WASM, falling back to the classical detector on any failure); its uint8 weights (~83 KB) ship as a static asset of `apps/live`. The synthetic wall generator and the Node training scripts live beside it. See [the boundary model](vision/experiments/e-model.md) and [the hybrid](vision/experiments/j-hybrid.md).
- **`@livediagram/api-schema`** owns the wire format between the api worker and the live editor: every request / response shape, plus the small shared pure helpers it backs (`sha256Hex` for image-upload dedupe, `titleCase` for display-casing preset values across the editor + telemetry dashboard, and the page-view path normaliser + the live app's route-segment list, shared by every frontend, the router and the dashboard, spec/150). Adding a field on the server without updating the client used to be routine drift; the typechecker catches it now.
- **`@livediagram/ui`** owns the cross-app UI primitives. The chrome (`Brand`, `SiteHeader`, `SiteFooter`, `ProductNav`), the form + feedback controls (`Button`, `TextInput`, `Select`, `EmptyState`, `Tooltip`), the shared behaviour hooks (`useMediaQuery`, `useCopiedFlash`, and the dismiss / focus trio `useClickOutside`, `useEscape`, `useFocusTrap` the editor's dialogs and the public sites' popovers share) plus the popover-clamping helpers. It also holds the public sites' shared plumbing: the site constants (`SITE_URL`, `SITE_NAME`, `REPO_URL`, the `BRAND_ICONS` favicon set, the `PUBLIC_VIEWPORT`), the SEO builders (`pageMetadata` for per-page metadata, `breadcrumbJsonLd`, rendered by `JsonLd`), and `PageViewBoot`, the page-view tracker wired to the shared `siteTrack` emitter. Reach for these before re-typing a class list: a control that exists here and is rebuilt in an app is the drift this package was made to stop. The package also owns the **chrome icons** (`src/icons/`): a `Glyph` base (square viewBox, `currentColor` stroke, round caps, `aria-hidden`) and named React icons (`CloseIcon`, `TrashIcon`, `ChevronDownIcon`, `SearchIcon`, `LinkIcon`, `SharedDotIcon`, ...) that take `size` / `strokeWidth` / `className` overrides, so a glyph the editor, marketing hero and telemetry dashboard all draw is one path, not a copy per file. These are app-chrome components; the canvas's own icon catalogue (SVG markup strings for diagram elements) is `@livediagram/icons`.
- **`@livediagram/icons`** owns the three catalogues (the line-art glyphs, the Technology brand marks, and the stickers of spec/116) plus pure SVG-markup builders for them, and `xmlEscape`, the one XML escaper every SVG builder in the monorepo shares (`@livediagram/diagram` re-exports it). The editor dynamic-imports the data modules through its icon registry so they stay out of its first-load JS; the api + mcp workers static-import `@livediagram/icons/resolve` so headless renders (the live image, Explorer thumbnails, MCP inline images) draw the real glyphs.
- **`@livediagram/templates`** owns the template library: the catalogue (kinds, titles, categories, per-template canvas overrides) and the pure per-template element builders. Two callers: the editor's Quick Start picker (which layers its theme recolour on top in `apps/live/lib/template-builders.ts`) and the mcp worker's `list_templates` / `template` tools (spec/62), so the scaffolds can't drift between them.
- **`@livediagram/template-previews`** owns the per-template preview illustrations: one static SVG per `TemplateKind`, rendered by the editor's template picker and by the marketing site's template gallery, so a template's card looks the same wherever it is offered and a new kind gets its artwork in one place. Its tests assert every listed template has a preview and that each drawing stays inside its viewBox.
- **`@livediagram/help-registry`** owns the help-centre article + category registry: slugs, titles, descriptions, and per-article search keywords, plus the pure href/search helpers. Two callers: the help app's browse + search (`apps/help/lib/articles.ts` re-exports it) and the live editor's search-panel Help group (`apps/live/lib/help-search.ts`), so adding an article once makes it findable in both.
- **`@livediagram/eslint-config`** / **`prettier-config`** / **`tailwind-config`** / **`vitest-config`** own the shared lint / format / theme / test configs so every workspace stays consistent.

## Tech stack

What's running:

- **Frontend**: Next.js 16 (Turbopack) with `output: 'export'`, React 19, TypeScript 7 (the Go compiler; the tools that need a compiler API still get 6.0 through an alias, see [contributing](contributing.md#two-typescripts)), Tailwind CSS 4.
- **API**: Cloudflare Workers (vanilla `fetch` handlers, not Hono).
- **Database**: Cloudflare D1 (SQLite-on-the-edge), accessed only via the api worker.
- **Local persistence** (optional per diagram, spec/76): Offline Mode stores a diagram only in the browser's IndexedDB, never the api. It is opt-in at create time (or by taking a cloud diagram offline) and dispatched behind the single `apps/live/lib/api-client.ts` persistence boundary on `isOfflineId(id)`, so the rest of the editor takes the same code path either way. Convertible both directions: Sync Diagram uploads it to D1, Take Offline downloads it and deletes the server copy. See [spec/76](../specs/76-offline-mode.md).
- **Realtime**: Cloudflare Durable Objects, one room per diagram. Edits sync as granular, id-addressed element ops, so concurrent edits to _different_ elements merge instead of clobbering, and the room stamps each mutation with a per-`epoch` sequence so peers converge and a reconnecting client catches up from a bounded op log (see [spec/75](../specs/75-realtime-conflict-resolution.md)). Two people editing the _same_ element at once is prevented upstream by the selection lock (spec/07).
- **Image storage**: Cloudflare R2, content-addressed by SHA-256, gated on owner + share-code reads (see [spec/19](../specs/19-images.md)).
- **AI assistance** (optional): the api worker proxies ANY OpenAI-compatible chat-completions endpoint (`AI_BASE_URL`, default OpenAI's; the hosted site points at Gemini) at `POST /api/ai` (modes ask / clean; the old generate / review modes were removed, see spec/25), with `GET /api/capabilities` reporting whether a model key resolves to a provider. A second route, `POST /api/ai/read-notes`, reads the handwriting on sticky-note CROPS that the browser cut out of a wall photograph (spec/139 Phase 8) through the same gate and an optional `AI_VISION_MODEL`; the crops are forwarded to the provider and discarded, never stored, and the whole photo never leaves the browser — the stickies are found there by `packages/sticky-vision`. Both routes are hidden entirely when the key is absent so OSS forks ship without AI surface (see [spec/25](../specs/25-ai-assistance.md)).
- **Auth** (optional): Clerk for sign-in; the api worker verifies JWTs against `CLERK_JWKS_URL` and silently degrades to pure-guest mode when the env var is unset.
- **Email** (optional): the api worker sends transactional + lifecycle email via Resend (`apps/api/src/email/`) — a welcome on first sign-in, week-1 / week-2 onboarding tips off the daily cron, plus team-invite and account-deleted messages, and two opt-out notifications (someone joins your shared diagram, someone responds to a team invite) configurable on the Explorer profile page. Gated on `RESEND_API_KEY`: no key, no sends, and the `email_lifecycle` table is never touched (see [spec/64](../specs/64-transactional-email.md) and [spec/65](../specs/65-profile-and-email-notifications.md)).
- **Timeline** (spec/138): the Explorer's landing view is a day-grouped feed of everything that happened — diagram lifecycle and a daily-coalesced "worked on" event, comments, assigned actions, team membership and invites, plus forward-dated expiry warnings for tokens and share links. Events are written inline by the api worker on the write path that caused them (`apps/api/src/timeline/`), into `timeline_events` + a `timeline_event_scopes` join so one row can reach a whole team; `scope_type` is open, so a later per-diagram or per-team feed needs a renderer rather than a migration. Read at `GET /api/timeline`, rendered by the shared `@livediagram/ui` Timeline components; a reader can drop one card from their own feed via `DELETE /api/timeline/events/:id` (or a whole stack via `POST /api/timeline/events/dismiss`), which soft-marks their membership rows. The feed re-reads itself after any of the reader's own api writes (the api client's `write-signal`), so an action taken on a card shows without a refresh. Guests included, and their history migrates on sign-up.
- **Activity** (spec/142): the Explorer's cross-diagram inbox of what is still outstanding for the reader — open assigned actions (to them or by them) and unresolved comment threads they are in. Actions and threads live inside element JSON on `tabs`, which stays the source of truth; the api worker keeps a SQL-filterable projection of them (`collab_actions` + `collab_threads`, keyed by tab) written in the same D1 batch as every tab write (`apps/api/src/db/collab-index.ts`), seeded lazily for dormant tabs on an owner's first read, and reads it at `GET /api/activity` scoped to the diagrams the caller can open. `owner_aliases` records a guest id when it migrates to an account so identities inside old blobs still match. A row links into the editor with `#t=<tab>&el=<element>&open=action|comments`, which selects the element and opens its popover.
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

GitHub Actions → Cloudflare Workers. Build artefacts get uploaded once, then five workers (marketing / live / telemetry / help / api) ship in parallel; the `mcp` worker deploys after `api` (it has a service binding to it), and the router deploys last because its service bindings need the others to exist.

Two environments run that same sequence, from one reusable workflow (`deploy-reusable.yml`) so they cannot drift:

|         | Production                                 | Staging                                                |
| ------- | ------------------------------------------ | ------------------------------------------------------ |
| Host    | `livediagram.app`                          | `staging.livediagram.app`                              |
| Trigger | Manual, after a green CI run               | Automatic, on every green CI run on `main`             |
| Workers | `livediagram-<app>`                        | `livediagram-<app>-staging` (wrangler `[env.staging]`) |
| Data    | `livediagram` D1 + `livediagram-images` R2 | Its own D1 / R2 / KV — no production data, ever        |

Staging exists mainly so a D1 migration runs against a real remote database one deploy before it reaches the one holding people's diagrams. It is public but `noindex` (the router stamps `X-Robots-Tag` when its `DEPLOY_ENV` is `staging`). See [spec/140](../specs/140-staging-environment.md).

See [Self-hosting](self-hosting.md) for the step-by-step, and [spec/10](../specs/10-deployment.md) for the deeper deployment contract.
