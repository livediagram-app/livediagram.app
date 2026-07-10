# livediagram

Monorepo for the livediagram product. Multiple apps share code through internal packages.

## Specs are the source of truth

Before building or proposing anything, **check `specs/`**. Every product decision, feature, constraint, and rule lives there. The index is at [`specs/README.md`](specs/README.md).

Workflow:

- New feature, scope change, or rule → write or update a spec **first**, code second.
- When a user request lands, capture it in a spec before writing code, and keep specs organised under their numbered prefixes.
- Reference specs by filename in PRs and discussions.
- If specs and code disagree, that's a bug — usually the spec is right; if not, fix the spec first.

## Keep docs and the README current

The root [`README.md`](README.md) and the [`docs/`](docs/) folder (`architecture.md`, `contributing.md`, `local-development.md`, `self-hosting.md`, `what-is-livediagram.md`) are developer- and user-facing documentation, distinct from the product specs in `specs/`.

Treat them as part of the change, not an afterthought:

- After any change, check whether it makes the README or a `docs/` file **incorrect** (commands, ports, file paths, env vars, app/package names, architecture, deploy steps) or **lacking key information** (a new app, package, env var, command, route, or workflow that a reader would now expect to find). If so, update the affected doc in the **same change** as the code.
- Adding or removing an app, package, env var, command, route, or build/deploy step is a strong signal that `README.md`, `docs/architecture.md`, `docs/local-development.md`, and `docs/self-hosting.md` may need a matching edit.
- Don't let docs drift: an out-of-date doc is worse than a missing one. If you can't fully update it now, note the gap explicitly rather than leaving a confidently wrong instruction.
- Specs (`specs/`) remain the source of truth for product decisions; `docs/` explains how to understand, run, and contribute to the code. Keep both honest.

## Help centre articles must stay registered

The help centre (`apps/help`, spec/55) has a hand-curated registry in the [`@livediagram/help-registry`](packages/help-registry/src/index.ts) package (re-exported by `apps/help/lib/articles.ts` so the help app keeps its `@/lib/articles` import path). It is the **single source for the help search** (`SearchInput` → `searchArticles`), **the category/browse listings**, **and the live editor's search-panel Help group** (`apps/live/lib/help-search.ts` derives its catalogue from it). The article's MDX page renders from the filesystem, but it is **invisible to search and browse unless it's in that registry** — there is no filesystem auto-discovery.

So, whenever you add (or remove/rename) a help article:

- Add (or update) its entry in the `articles` array in `packages/help-registry/src/index.ts` — `slug`, `title`, `description`, `keywords`, `category`, `categorySlug` (the full nested path, e.g. `canvas/the-canvas`), and `parentSlug` for a sub-article — **in the same change** as the new `apps/help/app/.../page.mdx`.
- Bump the matching `categories[].articleCount` (and add a `categories` entry if it's a brand-new top-level category).
- The registry `description` is the **short search-card summary** and is intentionally separate from the MDX `helpMetadata` description (the longer SEO/OG meta) — write a concise one, don't just copy the meta.
- `keywords` is **required**: space-separated, lowercase search synonyms — the words a user would type when they don't know the title ("transparency" for opacity, "hotkey" for keyboard shortcuts), plus adjacent spellings ("color" beside "colour"). Both the help search and the editor's search panel match on them; a test fails if they're missing.

Treat this exactly like the specs / docs rules above: a new article that isn't registered is a bug, the same way an out-of-date spec is. (`categorySlug`/`slug` in the registry must match the `page.mdx` path, so the search result link resolves.)

## Repo layout

```
apps/
  marketing/    # static marketing site (Next.js, /)
  live/         # the diagram editor app (Next.js, clean routes)
  telemetry/    # public anonymous-events dashboard (Next.js, /telemetry)
  help/         # help centre (Next.js export + MDX, /help)
  api/          # Cloudflare Worker REST + WebSocket API (D1 + Durable Objects, /api)
  mcp/          # Cloudflare Worker MCP server for AI tools (OAuth + tools, mcp.livediagram.app)
  router/       # Cloudflare Worker stitching the apps under one hostname
packages/
  ui/             # shared UI primitives (Brand, etc.)
  diagram/        # diagram data model (Tab, Element types + element helpers)
  icons/          # icon catalogues (line-art + Technology marks) + SVG markup builders
  templates/      # template catalogue + pure element builders (editor Quick Start + MCP)
  help-registry/  # help-centre article/category registry + keywords (help app + editor search)
  api-schema/     # wire-format DTOs the api worker emits + the live editor consumes
  telemetry-client/ # shared browser telemetry emitter (buffer/flush/beacon engine)
  eslint-config/  # shared ESLint flat config
  prettier-config/# shared Prettier config
  tailwind-config/# shared Tailwind theme (brand palette)
  vitest-config/  # shared Vitest defaults (extended per workspace)
specs/          # product specs — read these first
```

Workspaces are managed with **pnpm** (`pnpm-workspace.yaml`). Tasks are orchestrated with **Turborepo** (`turbo.json`). Node `>=22` (wrangler 4 requirement), pnpm `>=9`.

## What's built, what's still ahead

The frontend-only prototype phase ended when the API app landed (see [spec/02](specs/02-prototype-scope.md) and [spec/11](specs/11-api.md)). Today the editor talks to a Cloudflare Worker API backed by D1 (durable diagram storage) + Durable Objects (per-diagram realtime room). `apps/live/lib/api-client.ts` is the single persistence boundary; the editor never reads or writes `localStorage` for diagrams.

- **Built:** the canvas editor (shapes, arrows of every style with draggable curve / elbow handles, freehand sketches via the Pencil tool with optional shape-recognition mode, marquee + multi-select, groups, format painter, comments, assigned actions (assign element-level work to a teammate, with an Actions panel + optional email; see [spec/68](specs/68-assigned-actions.md)), links, themed templates, folders, tabs groupable into one-level collapsible folders, per-tab Photoshop-style layers with a dockable Layers panel; see [spec/74](specs/74-layers.md)), the api worker (REST + share links + change log + Durable Object realtime room with cursor/select/log ops), per-tab storage, anonymous first-party telemetry + the public `/telemetry` dashboard (see [spec/22](specs/22-telemetry.md)), teams with Admin/Member roles + email invites in the Explorer (see [spec/32](specs/32-teams.md)) plus a per-team shared library of diagrams + folders any member can manage (see [spec/35](specs/35-team-shared-diagrams.md)), signed-in-only API tokens for external / programmatic callers (see [spec/61](specs/61-public-api-and-tokens.md)), an MCP server (`apps/mcp`) that connects the editor to AI tools over OAuth (see [spec/62](specs/62-mcp-server.md)), and optional transactional + lifecycle email via Resend (welcome / week-1 / week-2 onboarding series + team-invite + account-deleted, gated on `RESEND_API_KEY`; see [spec/64](specs/64-transactional-email.md)).
- **Still ahead:** finer-grained team permissions (today every member can edit every team diagram). Realtime conflict resolution shipped (granular element-op merge so concurrent edits to different elements don't clobber + an ordered room with reconnect catch-up; see [spec/75](specs/75-realtime-conflict-resolution.md)). A full field-level CRDT for same-element concurrent editing was scoped and deliberately dropped: the selection lock (spec/07) already prevents two people editing the same element, so it wasn't worth the dependency + second sync path.

## Open source

See [specs/03-open-source-and-business-model.md](specs/03-open-source-and-business-model.md).

- The codebase is **MIT-licensed** and **publicly viewable**. Anyone can self-host.
- A free hosted version runs alongside at livediagram.app. **No paid tier and no plan to introduce one.**
- Don't add code that breaks self-hosting (no required SaaS calls, no license checks gating the core editor). Clerk auth is optional: when unset the api worker and live frontend degrade to pure-guest mode.
- No "Pro features" flags, no billing integration. If we ship it, every user gets it.

## Secrets policy

See [specs/06-secrets-policy.md](specs/06-secrets-policy.md). **Repo is public — no secrets in source. Ever.**

- All secrets via env vars: `.env.local` (gitignored) for dev, `wrangler secret put` for Workers, dashboard env vars for Pages.
- Client bundles only carry values explicitly prefixed `NEXT_PUBLIC_*` and only when documented as publishable (e.g. Clerk publishable key).
- Server-only secrets (Clerk secret key, Resend, D1 access) never appear in client code.
- Each app/worker that needs env vars ships a `.env.example` documenting what's required.

## Auth model

See [specs/04-auth-and-guest-access.md](specs/04-auth-and-guest-access.md).

- **The canvas always works without signing in.** Friction-free engagement is the acquisition strategy. Never put a sign-in wall in front of the editor.
- **Hybrid identity** — the api accepts two equivalent ways of identifying the owner of a request:
  - **Guest path**: a per-browser participant id (`livediagram:v2:self-id` in `localStorage`) carried as `X-Owner-Id`. Default for unsigned visitors. Full feature set (persistence, share links, real-time collab).
  - **Authed path**: a Clerk session JWT in `Authorization: Bearer <token>`. The api worker verifies via `CLERK_JWKS_URL` (`apps/api/src/auth/clerk.ts`) and uses the `sub` claim as the owner id. Required for per-account sync and future team workspaces.
- The two paths coexist forever — a signed-in user can still hand a share link to a guest who edits without auth.
- Sign-in lives at `/sign-in/` and sign-up at `/get-started/` (custom UI; email-code or Google OAuth). On sign-up, guest diagrams migrate from the localStorage id to the Clerk user id via `POST /api/migrate`.

## Core principle: reuse over duplication

**Avoid duplication. Build things in reusable ways from the start.** Non-negotiable.

- Before writing something new, check `packages/` for an existing shared module — extend it rather than recreating it.
- If two apps need the same thing (UI component, util, type, schema, API client, validator, config), it lives in `packages/`, not copied into each app.
- If you find yourself copy-pasting code across apps or packages, stop and extract it. "I'll dedupe later" is how drift starts.
- Design package APIs to be consumed by multiple callers — generic enough to reuse, specific enough to be useful.
- Tailwind theme, ESLint, Prettier, TS config, and shared UI primitives all live in `packages/` for exactly this reason.

When the right place for code is genuinely unclear, default to `packages/`.

## Core principle: no god files, plan placement first

**Decide where code belongs before you write it. Never accrete into god files.** Non-negotiable.

- **Prefer small, cohesive files; extract on cohesion, not on a line count.** Don't wait for a file to get huge: pull a slice into its own module the moment it's independently meaningful (a self-contained component, hook, or helper), even when the host file is well under any threshold. A 200-line file mixing two unrelated concerns is worth splitting; size is a smell, not the trigger. **Soft target: keep source files under ~400 lines.** This isn't a hard cap, but a file over 400 lines reads as neglect to a new contributor regardless of how cohesive it is, so treat crossing it as a prompt to extract a cohesive slice (a render branch into its own component, a state slice into its own hook). Never hit the target by deleting explanatory comments — that trades a real quality signal for a cosmetic one; bring the number down by moving real code. A file past ~1000 lines is almost certainly doing too much and must be broken up. **Pure data is exempt from the line target.** A flat catalogue — one (or a few) exported array/record of data with no logic, like an icon set, a tech-icon catalogue, or the help-article registry — stays a single file however long it gets. The target measures _code_, where length signals cognitive load and tangled concerns; a data array has neither, so chopping it into `*-data-1/2/3` parts at arbitrary entry boundaries only scatters the catalogue across files and adds churn with no readability gain. Split a data file only when it genuinely holds two _different_ catalogues that deserve separate homes, not to chase a number. This was earned: `apps/live/app/diagram/[id]/editor-page.tsx` was a 3,647-line god component, now split into `useEditorState.ts` (orchestration hook), `EditorView.tsx` (JSX), and `EditorContext.tsx` (context, `EditorContextValue = ReturnType<typeof useEditorState>`), with a ~130-line page shell. `Canvas.tsx` and `FeatureArt.tsx` were split the same way. `useEditorState.ts` and `Canvas.tsx` already sit large, so prefer extracting new slices out of them rather than adding in. **A fully-decomposed orchestration root is exempt like pure data.** `useEditorState.ts` is the clearest case: it has already been split into ~30 domain sub-hooks, so what remains is irreducible — wiring (calling each hook and threading its deps) plus the assembled return view-model (`EditorContextValue`). Pushing such a root under the target would mean bundling hook-calls into meta-hooks (pure indirection) or splitting the return object (awkward), churn that doesn't improve the code. Keep pulling a genuinely-cohesive slice out of it whenever one appears (an inline effect, a self-contained handler group), but don't force the line count — for an orchestration root the bar is cohesion, not the number.
- A new dialog / page / overlay → its **own component file** (e.g. `components/ApiErrorPage.tsx`), not another branch inside an existing screen.
- New behaviour or a slice of state → its **own hook** (`useXxx.ts`), then composed in. Editor state lives in domain slices, not piled into one hook.
- When you add to an existing file, confirm it's the _cohesive_ home, not just the convenient one. Wire new pieces in with the smallest edit to the host file.
- If a file is drifting toward a "kitchen sink", stop and extract — the same way duplication gets extracted on first sight (see the reuse principle above).

## Hard constraints

- **All websites must be static and deployable to Cloudflare Pages.** Next.js apps use `output: 'export'` — no SSR, no Node runtime, no Next API routes (use a Cloudflare Worker), no server-required image loader.
- Server-side logic lives in Cloudflare Workers, **not** in Next.js. Frontends call those Workers.
- Database access goes through a Worker that holds the D1 binding — never from the browser.

## Tech stack

What the product runs on. Items marked ✗ haven't shipped yet — see "What's built, what's still ahead".

- **Frontend:** Next.js (`output: 'export'`), React, TypeScript, Tailwind CSS — ✓
- **APIs:** Cloudflare Workers — ✓
- **Routing edge:** Cloudflare Workers (the router app) — ✓
- **Database:** Cloudflare D1 (via the api worker only) — ✓
- **Realtime:** Cloudflare Durable Objects (per-diagram room) — ✓
- **Auth:** Clerk (optional), ✓ (frontend ClerkProvider; api worker JWT verification + hybrid `X-Owner-Id` fallback)
- **Email:** Resend (optional) — ✓ (transactional + lifecycle email via the api worker; off without `RESEND_API_KEY`, see [spec/64](specs/64-transactional-email.md))

## Naming conventions

- Workspace packages: `@livediagram/<name>`.
- Apps in `apps/<name>` (e.g. `apps/marketing`, `apps/live`, `apps/telemetry`, `apps/help`, `apps/api`, `apps/mcp`, `apps/router`).
- Cross-workspace deps use `"@livediagram/foo": "workspace:*"`.

## Shared config

- **TypeScript:** every workspace's `tsconfig.json` extends `../../tsconfig.base.json`.
- **ESLint:** flat config. Each workspace has `eslint.config.js`:
  ```js
  import config from '@livediagram/eslint-config';
  export default config;
  ```
- **Prettier:** root `prettier.config.js` re-exports `@livediagram/prettier-config`; resolves automatically for all workspaces.
- **Tailwind:** each app's `globals.css` imports the shared theme:
  ```css
  @import 'tailwindcss';
  @import '@livediagram/tailwind-config';
  ```

## Deployment

See [specs/10-deployment.md](specs/10-deployment.md).

All deploys happen via **GitHub Actions** to **Cloudflare Workers** (with Static Assets for `marketing`, `live`, `telemetry`, and `help`). CI runs lint / format / typecheck / test / build on every PR and push. The deploy workflow is **manual-only** (`workflow_dispatch`, intentionally not chained to CI): trigger it from the Actions tab or `gh workflow run Deploy --ref main` once CI on `main` is green and you've decided to ship. It builds, then deploys `marketing` + `live` + `telemetry` + `help` + `api` in parallel, `mcp` once `api` is up, then `router` last (its service bindings depend on the five path-routed workers existing; mcp is its own host).

Worker names: `livediagram-marketing`, `livediagram-live`, `livediagram-telemetry`, `livediagram-help`, `livediagram-api`, `livediagram-mcp`, `livediagram-router`, matching the service-binding targets in `apps/router/wrangler.toml`. Deploy order: marketing + live + telemetry + help + api in parallel, then `mcp` after api (it has a service binding to api; its own host `mcp.livediagram.app`, not a router path), then router last (its service bindings depend on the other five existing).

Production is live at **https://livediagram.app** (`/` → marketing; `/diagram`, `/explorer`, `/new`, `/join`, ... → editor at clean routes, with only its `_next` assets under `/live`; `/telemetry` → telemetry dashboard; `/help` → help centre; `/api/*` → api).

Secrets needed in the GitHub repo: `CF_API_TOKEN`, `CF_ACCOUNT_ID`. See [secrets policy](specs/06-secrets-policy.md).

## Common commands

Run from the repo root:

| Command             | What it does                      |
| ------------------- | --------------------------------- |
| `pnpm install`      | Install all workspace deps        |
| `pnpm dev`          | `turbo run dev` across workspaces |
| `pnpm build`        | `turbo run build`                 |
| `pnpm lint`         | `turbo run lint`                  |
| `pnpm typecheck`    | `turbo run typecheck`             |
| `pnpm test`         | `turbo run test`                  |
| `pnpm format`       | Prettier write across the repo    |
| `pnpm format:check` | Prettier check (CI)               |

Run a script in a single workspace: `pnpm --filter @livediagram/<name> <script>`.

## Guidelines

- Don't add SSR, Next.js API routes, or Node-only runtime code to a frontend app — it will break Cloudflare Pages deploys.
- Put any logic shared by two or more apps in `packages/` rather than copying it.
- Worker apps target the Cloudflare Workers runtime — prefer Web APIs (`fetch`, `Request`, `Response`, `crypto.subtle`) over Node-only APIs.
- D1 schemas and migrations (when they arrive) live with the Worker that owns the binding.
- The router worker (`apps/router`) holds **no business logic** — only routing. If you're tempted to add logic to it, that logic belongs in the service it forwards to.
- **Track key new functionality** via the anonymous-events schema (see [`specs/22-telemetry.md`](specs/22-telemetry.md)): when you ship a feature that meaningfully changes user behaviour (a new element kind, a new dialog, a new mode, a new shortcut surface, a new setting toggle), add a one-liner `track(category, action, type)` at the interaction's handler. Reuse the closed `TELEMETRY_CATEGORIES` / `TELEMETRY_ACTIONS` enums in `@livediagram/api-schema`, extending them only when no existing pair fits. The `type` is a preset enum value (e.g., `Square`, `DrawToAddOn`), never user content. The editor (`apps/live`) and the help centre (`apps/help`) emit, both through the shared `@livediagram/telemetry-client` engine with app-owned enable/opt-out policy; settings flips fire BEFORE the change is persisted so an opt-out event still reaches the wire.
