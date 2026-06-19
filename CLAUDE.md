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

The help centre (`apps/help`, spec/55) has a hand-curated registry at [`apps/help/lib/articles.ts`](apps/help/lib/articles.ts) that is the **single source for the help search** (`SearchInput` → `searchArticles`) **and the category/browse listings**. The article's MDX page renders from the filesystem, but it is **invisible to search and browse unless it's in that registry** — there is no filesystem auto-discovery.

So, whenever you add (or remove/rename) a help article:

- Add (or update) its entry in the `articles` array in `apps/help/lib/articles.ts` — `slug`, `title`, `description`, `category`, `categorySlug` (the full nested path, e.g. `features/canvas`), and `parentSlug` for a sub-article — **in the same change** as the new `apps/help/app/.../page.mdx`.
- Bump the matching `categories[].articleCount` (and add a `categories` entry if it's a brand-new top-level category).
- The registry `description` is the **short search-card summary** and is intentionally separate from the MDX `helpMetadata` description (the longer SEO/OG meta) — write a concise one, don't just copy the meta.

Treat this exactly like the specs / docs rules above: a new article that isn't registered is a bug, the same way an out-of-date spec is. (`categorySlug`/`slug` in the registry must match the `page.mdx` path, so the search result link resolves.)

## Repo layout

```
apps/
  marketing/    # static marketing site (Next.js, /)
  live/         # the diagram editor app (Next.js, clean routes)
  telemetry/    # public anonymous-events dashboard (Next.js, /telemetry)
  api/          # Cloudflare Worker REST + WebSocket API (D1 + Durable Objects, /api)
  router/       # Cloudflare Worker stitching the apps under one hostname
packages/
  ui/             # shared UI primitives (Brand, etc.)
  diagram/        # diagram data model (Tab, Element types + element helpers)
  api-schema/     # wire-format DTOs the api worker emits + the live editor consumes
  eslint-config/  # shared ESLint flat config
  prettier-config/# shared Prettier config
  tailwind-config/# shared Tailwind theme (brand palette)
  vitest-config/  # shared Vitest defaults (extended per workspace)
specs/          # product specs — read these first
```

Workspaces are managed with **pnpm** (`pnpm-workspace.yaml`). Tasks are orchestrated with **Turborepo** (`turbo.json`). Node `>=22` (wrangler 4 requirement), pnpm `>=9`.

## What's built, what's still ahead

The frontend-only prototype phase ended when the API app landed (see [spec/02](specs/02-prototype-scope.md) and [spec/11](specs/11-api.md)). Today the editor talks to a Cloudflare Worker API backed by D1 (durable diagram storage) + Durable Objects (per-diagram realtime room). `apps/live/lib/api-client.ts` is the single persistence boundary; the editor never reads or writes `localStorage` for diagrams.

- **Built:** the canvas editor (shapes, arrows of every style with draggable curve / elbow handles, freehand sketches via the Pencil tool with optional shape-recognition mode, marquee + multi-select, groups, format painter, comments, links, themed templates, folders, tabs groupable into one-level collapsible folders), the api worker (REST + share links + change log + Durable Object realtime room with cursor/select/log ops), per-tab storage, anonymous first-party telemetry + the public `/telemetry` dashboard (see [spec/22](specs/22-telemetry.md)), teams with Admin/Member roles + email invites in the Explorer (see [spec/32](specs/32-teams.md), membership only — no team-shared diagrams yet).
- **Still ahead:** Resend (transactional email), team-shared diagrams / team permissions, operational-transform / CRDT edits.

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

- **Prefer small, cohesive files; extract on cohesion, not on a line count.** Don't wait for a file to get huge: pull a slice into its own module the moment it's independently meaningful (a self-contained component, hook, or helper), even when the host file is well under any threshold. A 400-line file mixing two unrelated concerns is worth splitting; size is a smell, not the trigger. **Soft target: keep source files under ~1000 lines.** This isn't a hard cap, but a file over 1k reads as neglect to a new contributor regardless of how cohesive it is, so treat crossing it as a prompt to extract a cohesive slice (a data catalogue into a sibling `*-data` module behind a barrel, a render branch into its own component, a state slice into its own hook). Never hit the target by deleting explanatory comments — that trades a real quality signal for a cosmetic one; bring the number down by moving real code. A file past ~2000 lines is almost certainly doing too much and must be broken up. This was earned: `apps/live/app/diagram/[id]/editor-page.tsx` was a 3,647-line god component, now split into `useEditorState.ts` (orchestration hook), `EditorView.tsx` (JSX), and `EditorContext.tsx` (context, `EditorContextValue = ReturnType<typeof useEditorState>`), with a ~130-line page shell. `Canvas.tsx` and `FeatureArt.tsx` were split the same way. `useEditorState.ts` and `Canvas.tsx` already sit large, so prefer extracting new slices out of them rather than adding in.
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
- **Email:** Resend — ✗

## Naming conventions

- Workspace packages: `@livediagram/<name>`.
- Apps in `apps/<name>` (e.g. `apps/marketing`, `apps/live`, `apps/telemetry`, `apps/api`, `apps/router`).
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

All deploys happen via **GitHub Actions** to **Cloudflare Workers** (with Static Assets for `marketing`, `live`, and `telemetry`). CI runs lint / format / typecheck / test / build on every PR and push. The deploy workflow is **manual-only** (`workflow_dispatch`, intentionally not chained to CI): trigger it from the Actions tab or `gh workflow run Deploy --ref main` once CI on `main` is green and you've decided to ship. It builds, then deploys `marketing` + `live` + `telemetry` + `api` in parallel, then `router` last (its service bindings depend on the other four existing).

Worker names: `livediagram-marketing`, `livediagram-live`, `livediagram-telemetry`, `livediagram-api`, `livediagram-router`, matching the service-binding targets in `apps/router/wrangler.toml`. Deploy order: marketing + live + telemetry + api in parallel, then router last (its service bindings depend on the other four existing).

Production is live at **https://livediagram.app** (`/` → marketing; `/diagram`, `/explorer`, `/new`, `/join`, ... → editor at clean routes, with only its `_next` assets under `/live`; `/telemetry` → telemetry dashboard; `/api/*` → api).

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
- **Track key new functionality** via the anonymous-events schema (see [`specs/22-telemetry.md`](specs/22-telemetry.md)): when you ship a feature that meaningfully changes user behaviour (a new element kind, a new dialog, a new mode, a new shortcut surface, a new setting toggle), add a one-liner `track(category, action, type)` at the interaction's handler. Reuse the closed `TELEMETRY_CATEGORIES` / `TELEMETRY_ACTIONS` enums in `@livediagram/api-schema`, extending them only when no existing pair fits. The `type` is a preset enum value (e.g., `Square`, `DrawToAddOn`), never user content. The editor (`apps/live`) is the only app that emits, and settings flips fire BEFORE the change is persisted so an opt-out event still reaches the wire.
