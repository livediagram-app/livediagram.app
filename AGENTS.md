# livediagram

Monorepo for the livediagram product. Multiple apps share code through internal packages.

## Before you start

- `git fetch` latest from origin

## Organisation process

This section describes the process of organising and layering empirical information.
It guides the engineering efforts by having agents specify with sufficient detail.
The goal is for agents to become increasingly self-sufficient when working on systems they already know.

This is achieved by iteratively capturing contextual information about the domain and documenting intentions from humans.

This section is exclusively human-hand-written; agents MUST NOT edit this section directly.

### Structure

Use the following structure and rationale.

- `AGENTS.md` instructs us about **how we work**.
- `plans/` contains plans; **exhaustive list of checkboxed steps**.
- `docs/` holds all **documentation** files.
- `docs/README.md` is the entry point.

Within `docs/` are the following special categories:

- `specs/` contains **specifications**: _what a thing IS_.
- `specs/[...]/blueprints/` contains **blueprints**: _exhaustively documented implementation details_.
- `instructions/` contains **instruction sets**: _empirically built repeatable processes_.

**Indexes** are held inside `README.md` files. Entries look like: `- ./<file>.md - when <trigger>`.
`README.md` files open with `Follow the references below only as needed; never upfront.`

Further details below.

### Docs

- Docs are structured as `docs/<category>/<topic>.md`
- They are indexed under `docs/README.md`.
- The docs index includes entry points to `specs` and `instructions`.
- Docs convey information in scope of the project.
- All docs SHOULD be treated as persistent documents that can be iterated on.
- Stay cognizant of the deltas of each change.
- Reuse documents where it makes sense.
- Folders of substance SHOULD hold a `README.md` with an index.
- Docs, indexes and references **MUST be continuously kept-up-to-date** throughout all work.

### Plans

- Plans live as a single Markdown file in the project's `plans/` folder, numbered `0001-<topic>.md`.
- They live inside the `plans/` folder, which MAY be **gitignored** (recommended).
- Plans describe **work**, split into sequenced **phases** of checkboxed **steps**:.
  - **work** includes research, specification, building, testing, verification, definition of done, and anything else that's needed.
  - **phases** are logical increments, warranting a commit each.
  - **steps** MUST be performed with full focus, and in the highest qualitative and idiomatic way.
  - **checkboxes** MUST be checked off immediately upon completion of any step, and before starting the next step.
- A plan MAY link to blueprints and specs (encouraged), but SHALL NOT restate them.
- The last step of every plan MUST be **fold-back**; to let the documentation reflect reality, and to verify all symbols/files/references.
- Fold-back reconciles the spec to what actually shipped, then re-derives the blueprint from it.
- Plans SHALL NOT be renumbered.

**When to use plans?**

- Default to no plan. Just do the work for tasks that fit in a single sitting.
- Create a plan when asked or when work is likely to exceed one or two days.
- Surface ambiguities and gaps before implementing, and keep refining the plan as new information arrives.

**Work plans one task at a time**

1. Read the step,
2. Do it the best, highest qualitative and idiomatic way possible
3. Upon completion immediately tick the checkbox; never batch ticks at the end.
4. Then move to the next step.

_Note:_ There is no need to stop in between phases; just keep going.

### Specs

- Specs live inside numbered **category folders** `docs/specs/NNN-<category>/`.
- They are indexed under `docs/specs/README.md`.
- Specs are where design decisions are made and recorded.
- Specs describe **what a thing IS** within the domain; the definitions and specifications of **systems** or **domain concepts**.
- Specs are written in the present tense.
- Specs themselves are unnumbered.
- Specs are never task lists and carry no checkboxes.
- Spec files SHOULD be unnumbered and named by subject; a category MAY hold several related specs.
- Write the spec BEFORE implementing anything non-trivial, and keep it true afterwards.
- Iterate the existing spec rather than adding a new one on the same subject; stay cognizant of the delta each change makes.

**Category folders**

- The first five categories are reserved:
  - `001-project-vision` - the "why": problem, target audience, value proposition.
  - `002-project-scope` - the "what" and "what-not": features, high-level outline, technical constraints, non-goals.
  - `003-system-architecture` - the "how" under the hood: data flow, infrastructure, state management, and the language and runtime boundaries.
  - `004-interface-design` - the "how" at the surface: UX/UI, wireframes, user journeys, visual language.
  - `005-project-roadmap` - the "when": milestones as outcomes, phases, launch strategy.
- Further category folders MUST BE named after a **system** or, preferably, a **domain concept**.
- Renumbering is discouraged, but allowed when every reference to it is updated in the same change.

### Blueprints

- Blueprints live in a `blueprints/` folder inside their spec's category folder `docs/specs/NNN-<category>/blueprints/`,
- They are indexed under `docs/specs/NNN-<category>/blueprints/README.md`.
- Blueprints are the meticulously detailed natural language source holding all implementation details, written before the code exists.
- Derive the blueprint mechanically from the spec before building; it adds engineering precision, not new design.
- Derivation is one-directional and deterministic: the spec is the input, the blueprint the output.
- Change flows in one-direction and is deterministic: a spec change updates the blueprint and then the code.
- Any changes outside that are folded back into the spec and blueprint.
- Blueprints do not invent design; if the spec is ambiguous, fix the spec first rather than guess.
- Iterate the existing blueprints rather than rewriting them: change only what the spec changed, and stay cognizant of the delta.
- Blueprints SHOULD apply documented defaults, recorded as one row per default in the category's `blueprints/DEFAULTS.md`.
- A blueprint is complete only when every applicable **completeness category** is covered and checked off in `blueprints/COMPLETENESS.md`

**Completeness categories**

- **Domain and naming** - every domain term maps to one canonical identifier; synonyms are banned.
- **Behaviour and state** - every state, transition, guard, and invariant is named and reachable.
- **Interfaces and contracts** - every input and output is typed and validated, with a named rejection per failure.
- **Data and persistence** - every field is classified; snapshot, restore, and migration are defined.
- **Errors and edge cases** - every failure mode and boundary case is named with its handling; no silent path.
- **Security and trust** - trust boundaries, abuse cases, guards, rate limits etc. are stated.
- **Performance and limits** - worst-case sizes and hot-path budgets are computed against the platform limits.
- **Presentation and UX** (UI only) - layout, empty, loading, and error states, and final copy are defined.
- **Accessibility** (UI only) - contrast, ARIA, keyboard, and reduced motion meet WCAG 2.2 AA.
- **Web Experience** (Web only) - Core Web Vitals, including LCP, INP and CLS are explicitly addressed.
- **Observability** - every decision point and failure emits a log with a recognisable fingerprint.
- **Testing** - every spec rule maps to a deterministic test, traceably.
- **Constants and configuration** - every magic number is a named constant with provenance and a safe range.
- **Assets and external resources** - every asset has a source, a licence, a path, and reproducible generation.
- **Defaults ledger** - every default applied for a silent or qualitative spec has a ledger row.

For each blueprint, record the applicable categories in the topic's committed `blueprints/COMPLETENESS.md`, a simple list, one line each:

- [x] Domain and naming
- [x] Behaviour and state
- [x] Testing
- [x] Defaults

Leave out any category that does not apply; unchecked means applicable but not covered.

### Instruction sets

- Instruction sets live in `docs/instructions/<process>.md`, unnumbered and named after the process they encode.
- They are indexed under `docs/instructions/README.md`.
- Instruction sets are **reusable process memory**: _how a process is done_, not scoped to one piece of work like a plan.
- Instruction sets carry no checkboxes; a plan MAY link to one, and progress is ticked in the plan.
- Steps are **chronological**; ordered the way the work is actually done, not grouped by theme.
- Steps are **granular**; each is small enough that "did it happen?" has a yes or no answer.
- Steps are **opinionated**; taste, preferences and domain specifics are woven in, not left to model defaults.
- Only **genuine forks** (taste, preference, business knowledge) are surfaced; every other decision is written down once.
- Instruction sets grow **empirically**; gotchas, hard gained knowledge, user input or missed steps are folded back in.

## Specs are the source of truth

Before building or proposing anything, **check `docs/specs/`**. Every product decision, feature, constraint, and rule lives there. The index is at [`docs/specs/README.md`](docs/specs/README.md).

Workflow:

- New feature, scope change, or rule → write or update a spec **first**, code second.
- When a user request lands, capture it in a spec before writing code, and keep specs organised in their category folders (see Organisation process above).
- Reference specs by filename in PRs and discussions.
- If specs and code disagree, that's a bug — usually the spec is right; if not, fix the spec first.

## Keep docs and the README current

The root [`README.md`](README.md) and the [`docs/`](docs/) folder (indexed in [`docs/README.md`](docs/README.md)) are developer- and user-facing documentation, distinct from the product specs in `docs/specs/`.

Treat them as part of the change, not an afterthought:

- After any change, check whether it makes the README or a `docs/` file **incorrect** (commands, ports, file paths, env vars, app/package names, architecture, deploy steps) or **lacking key information** (a new app, package, env var, command, route, or workflow that a reader would now expect to find). If so, update the affected doc in the **same change** as the code.
- Adding or removing an app, package, env var, command, route, or build/deploy step is a strong signal that `README.md`, `docs/development/architecture.md`, `docs/development/local-development.md`, and `docs/operations/self-hosting.md` may need a matching edit.
- Don't let docs drift: an out-of-date doc is worse than a missing one. If you can't fully update it now, note the gap explicitly rather than leaving a confidently wrong instruction.
- Specs (`docs/specs/`) remain the source of truth for product decisions; `docs/` explains how to understand, run, and contribute to the code. Keep both honest.

## Help centre articles must stay registered

Whenever you add, remove or rename a help article, follow [`docs/instructions/register-a-help-article.md`](docs/instructions/register-a-help-article.md) in the same change; an unregistered article is a bug.

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
  ui/             # shared UI primitives (Brand, SiteHeader, Button, TextInput, Select, Tooltip, hooks) + chrome icons (src/icons)
  diagram/        # diagram data model (Tab, Element types + element helpers)
  icons/          # icon catalogues (line-art + Technology + stickers) + SVG markup builders + xmlEscape
  templates/      # template catalogue + pure element builders (editor Quick Start + MCP)
  template-previews/ # per-template preview SVGs (editor picker + marketing template gallery)
  help-registry/  # help-centre article/category registry + keywords (help app + editor search)
  api-schema/     # wire-format DTOs the api worker emits + the live editor consumes
  sticky-vision/  # finds sticky notes in a wall photo (classical CV, no DOM) for the event-storming photo import
  telemetry-client/ # shared browser telemetry emitter (buffer/flush/beacon engine)
  eslint-config/  # shared ESLint flat config
  prettier-config/# shared Prettier config
  tailwind-config/# shared Tailwind theme (brand palette)
  vitest-config/  # shared Vitest defaults (extended per workspace)
docs/           # developer docs, indexed in docs/README.md
  specs/        # product specs — read these first
  instructions/ # repeatable processes (e.g. registering a help article)
```

Workspaces are managed with **pnpm** (`pnpm-workspace.yaml`). Tasks are orchestrated with **Turborepo** (`turbo.json`). Node `>=22` (wrangler 4 requirement), pnpm `>=9`.

## What's built, what's still ahead

The frontend-only prototype phase ended when the API app landed (see [Build phase](docs/specs/005-project-roadmap/prototype-scope.md) and [API app](docs/specs/015-api/api.md)). Today the editor talks to a Cloudflare Worker API backed by D1 (durable diagram storage) + Durable Objects (per-diagram realtime room). A diagram can also live **only in the browser**, in IndexedDB, if the author picks Offline Mode ([Offline Mode](docs/specs/006-diagram/offline-mode.md)) — so there are two stores, not one.

`apps/live/lib/api-client.ts` is the single persistence boundary over both: `lib/api/*` sends each load / save / delete to the api or to `lib/offline/offline-store.ts` on `isOfflineId(id)`, so the rest of the editor takes the same code path either way. Listing is the exception that isn't a dispatch — the Explorer shows both sets, so it MERGES them, and still returns the offline ones when the cloud fetch fails. The one caller-decided branch is **create**, which has no registered id to dispatch on yet: the New Diagram wizard calls `offlineCreateDiagram` directly when the author chose offline, and that call is what registers the id every later operation routes on. The editor never reads or writes `localStorage` for diagrams — that is IndexedDB's job, and `localStorage` holds only the participant id and device-local preferences.

- **Built:** the canvas editor (shapes including code blocks + checklists, arrows of every style with draggable curve / elbow handles, freehand sketches via the Freehand + Shape Pen tools (the Shape Pen recognises a rough shape on release; see [Two pens instead of a pen and a mode](docs/specs/008-canvas/two-pens.md)) plus the Highlighter, which is a held canvas mode rather than a palette tile (see [Highlighter](docs/specs/008-canvas/highlighter.md)), a multi-point polygon / polyline tool, marquee + multi-select, format painter, web components that lay themselves out (banner / callout / stat row / process / header / hero, see [Web components are elements; groups are gone](docs/specs/009-elements/web-components-and-no-groups.md), which also removed groups), element drop shadows (see [Element shadows](docs/specs/008-canvas/element-shadows.md)), comments, assigned actions (assign element-level work to a teammate, with an Actions panel + optional email; see [Assigned actions](docs/specs/012-collaboration/assigned-actions.md)), links, themed templates, folders, tabs groupable into one-level collapsible folders, per-tab Photoshop-style layers with a dockable Layers panel (see [Layers](docs/specs/006-diagram/layers.md)), presentation mode: full-screen slide decks built from element sets that can span tabs, run from a Slide Deck panel (see [Presentation mode](docs/specs/012-collaboration/presentation-mode.md)), and per-tab import/export covering JSON, Mermaid, Markdown, and Excalidraw (see [Mermaid import & export](docs/specs/020-import-export/mermaid.md), [Excalidraw import & export](docs/specs/020-import-export/excalidraw-import-export.md))), the api worker (REST + share links + change log + Durable Object realtime room with cursor/select/log ops), per-tab storage, Offline Mode (a diagram kept only in this browser's IndexedDB, convertible both ways with Sync Diagram / Take Offline; see [Offline Mode](docs/specs/006-diagram/offline-mode.md)), anonymous first-party telemetry + the public `/telemetry` dashboard (see [Telemetry + public transparency dashboard](docs/specs/017-telemetry/telemetry.md)), teams with Admin/Member roles + email invites in the Explorer (see [Teams](docs/specs/013-workspace/teams.md)) plus a per-team shared library of diagrams + folders any member can manage (see [Team shared diagrams](docs/specs/013-workspace/team-shared-diagrams.md)), signed-in-only API tokens for external / programmatic callers (see [Public API and API tokens](docs/specs/015-api/public-api-and-tokens.md)), an MCP server (`apps/mcp`) that connects the editor to AI tools over OAuth (see [MCP server](docs/specs/015-api/mcp-server.md)), and optional transactional + lifecycle email via Resend (welcome / week-1 / week-2 onboarding series + team-invite + account-deleted, gated on `RESEND_API_KEY`; see [Transactional & lifecycle email (Resend)](docs/specs/014-identity/transactional-email.md)).
- **Still ahead:** finer-grained team permissions (today every member can edit every team diagram). Realtime conflict resolution shipped (granular element-op merge so concurrent edits to different elements don't clobber + an ordered room with reconnect catch-up; see [Realtime conflict resolution](docs/specs/012-collaboration/realtime-conflict-resolution.md)). A full field-level CRDT for same-element concurrent editing was scoped and deliberately dropped: the selection lock ([Live app](docs/specs/007-editor/live-app.md)) already prevents two people editing the same element, so it wasn't worth the dependency + second sync path.

## Open source

See [Open source + distribution](docs/specs/002-project-scope/open-source-and-business-model.md).

- The codebase is **MIT-licensed** and **publicly viewable**. Anyone can self-host.
- A free hosted version runs alongside at livediagram.app. **No paid tier and no plan to introduce one.**
- Don't add code that breaks self-hosting (no required SaaS calls, no license checks gating the core editor). Clerk auth is optional: when unset the api worker and live frontend degrade to pure-guest mode.
- No "Pro features" flags, no billing integration. If we ship it, every user gets it.

## Secrets policy

See [Secrets policy](docs/specs/002-project-scope/secrets-policy.md). **Repo is public — no secrets in source. Ever.**

- All secrets via env vars: `.env.local` (gitignored) for dev, `wrangler secret put` for Workers, dashboard env vars for Pages.
- Client bundles only carry values explicitly prefixed `NEXT_PUBLIC_*` and only when documented as publishable (e.g. Clerk publishable key).
- Server-only secrets (Clerk secret key, Resend, D1 access) never appear in client code.
- Each app/worker that needs env vars ships a `.env.example` documenting what's required.

## Auth model

See [Auth + guest access](docs/specs/014-identity/auth-and-guest-access.md).

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
- A new dialog / page / overlay → its **own component file** (e.g. `components/chrome/ApiErrorPage.tsx`), not another branch inside an existing screen.
- New behaviour or a slice of state → its **own hook** (`useXxx.ts`), then composed in. Editor state lives in domain slices, not piled into one hook.
- When you add to an existing file, confirm it's the _cohesive_ home, not just the convenient one. Wire new pieces in with the smallest edit to the host file.
- If a file is drifting toward a "kitchen sink", stop and extract — the same way duplication gets extracted on first sight (see the reuse principle above).

## Hard constraints

- **All websites must be static and deployable to Cloudflare Pages.** Next.js apps use `output: 'export'` — no SSR, no Node runtime, no Next API routes (use a Cloudflare Worker), no server-required image loader.
- Server-side logic lives in Cloudflare Workers, **not** in Next.js. Frontends call those Workers.
- Database access goes through a Worker that holds the D1 binding — never from the browser.

## Tech stack

What the product runs on. Items marked ✗ haven't shipped yet — see "What's built, what's still ahead".

- **Frontend:** Next.js (`output: 'export'`), React, TypeScript 7 (native/Go compiler), Tailwind CSS — ✓
- **APIs:** Cloudflare Workers — ✓
- **Routing edge:** Cloudflare Workers (the router app) — ✓
- **Database:** Cloudflare D1 (via the api worker only) — ✓
- **Realtime:** Cloudflare Durable Objects (per-diagram room) — ✓
- **Auth:** Clerk (optional), ✓ (frontend ClerkProvider; api worker JWT verification + hybrid `X-Owner-Id` fallback)
- **Email:** Resend (optional) — ✓ (transactional + lifecycle email via the api worker; off without `RESEND_API_KEY`, see [Transactional & lifecycle email (Resend)](docs/specs/014-identity/transactional-email.md))

## Naming conventions

- Workspace packages: `@livediagram/<name>`.
- Apps in `apps/<name>` (e.g. `apps/marketing`, `apps/live`, `apps/telemetry`, `apps/help`, `apps/api`, `apps/mcp`, `apps/router`).
- Cross-workspace deps use `"@livediagram/foo": "workspace:*"`.

## Shared config

- **TypeScript:** every workspace's `tsconfig.json` extends `../../tsconfig.base.json`. Two TypeScripts are installed on purpose: `@typescript/native` (an alias for `typescript@7`, the Go compiler) provides the `tsc` that `pnpm typecheck` runs, while `typescript` aliases `@typescript/typescript6` because 7.0 ships no compiler API and typescript-eslint / Next.js / Prettier import one. See [`docs/development/contributing.md`](docs/development/contributing.md#two-typescripts).
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

See [Deployment](docs/specs/016-platform/deployment.md).

All deploys happen via **GitHub Actions** to **Cloudflare Workers** (with Static Assets for `marketing`, `live`, `telemetry`, and `help`). CI runs lint / format / typecheck / test / build / `staging:check` on every PR and push.

Either environment builds once, then deploys `marketing` + `live` + `telemetry` + `help` + `api` in parallel, `mcp` once `api` is up, then `router` last (its service bindings depend on the five path-routed workers existing; mcp is its own host).

**Two environments** ([Staging environment](docs/specs/016-platform/staging-environment.md)), both running those same jobs out of the reusable `deploy-reusable.yml` so they can't drift:

- **Production** (`livediagram.app`) — `deploy.yml`, **manual-only** (`workflow_dispatch`, intentionally not chained to CI): trigger it from the Actions tab (it appears as **Deploy Production**) or `gh workflow run deploy.yml --ref main` once CI on `main` is green and you've decided to ship.
- **Staging** (`staging.livediagram.app`) — `deploy-staging.yml`, **automatic** on every green CI run on `main`. Wrangler `[env.staging]` blocks give it `-staging` worker names and its own D1 / R2 / KV, so a migration runs against a real remote database one deploy before it reaches the one holding real diagrams. Public but `noindex`, stamped by the router.

When you touch a worker's bindings, **add the same change to its `[env.staging]` block** — wrangler does not inherit `vars` / `d1_databases` / `r2_buckets` / `kv_namespaces` / `durable_objects` / `services` / `unsafe` into a named environment, so a binding added only at the top level is silently absent from staging. `pnpm staging:check` (in CI) dry-runs the staging configs and prints the resolved bindings.

Worker names: `livediagram-marketing`, `livediagram-live`, `livediagram-telemetry`, `livediagram-help`, `livediagram-api`, `livediagram-mcp`, `livediagram-router`, matching the service-binding targets in `apps/router/wrangler.toml` (staging's are the same names suffixed `-staging`). Deploy order: marketing + live + telemetry + help + api in parallel, then `mcp` after api (it has a service binding to api; its own host `mcp.livediagram.app`, not a router path), then router last (its service bindings depend on the other five existing).

Production is live at **https://livediagram.app** (`/` → marketing; `/diagram`, `/explorer`, `/new`, `/join`, ... → editor at clean routes, with only its `_next` assets under `/live`; `/telemetry` → telemetry dashboard; `/help` → help centre; `/api/*` → api).

Secrets needed in the GitHub repo: `CF_API_TOKEN`, `CF_ACCOUNT_ID`. See [secrets policy](docs/specs/002-project-scope/secrets-policy.md).

## Common commands

Run from the repo root:

| Command              | What it does                                      |
| -------------------- | ------------------------------------------------- |
| `pnpm install`       | Install all workspace deps                        |
| `pnpm dev`           | `turbo run dev` across workspaces                 |
| `pnpm build`         | `turbo run build`                                 |
| `pnpm lint`          | `turbo run lint`                                  |
| `pnpm typecheck`     | `turbo run typecheck`                             |
| `pnpm test`          | `turbo run test`                                  |
| `pnpm format`        | Prettier write across the repo                    |
| `pnpm format:check`  | Prettier check (CI)                               |
| `pnpm staging:check` | Dry-run the `[env.staging]` wrangler configs (CI) |

Run a script in a single workspace: `pnpm --filter @livediagram/<name> <script>`.

## Guidelines

- Don't add SSR, Next.js API routes, or Node-only runtime code to a frontend app — it will break Cloudflare Pages deploys.
- Put any logic shared by two or more apps in `packages/` rather than copying it.
- Worker apps target the Cloudflare Workers runtime — prefer Web APIs (`fetch`, `Request`, `Response`, `crypto.subtle`) over Node-only APIs.
- D1 schemas and migrations (when they arrive) live with the Worker that owns the binding.
- The router worker (`apps/router`) holds **no business logic** — only routing. If you're tempted to add logic to it, that logic belongs in the service it forwards to.
- **Track key new functionality** via the anonymous-events schema (see [`docs/specs/017-telemetry/telemetry.md`](docs/specs/017-telemetry/telemetry.md)): when you ship a feature that meaningfully changes user behaviour (a new element kind, a new dialog, a new mode, a new shortcut surface, a new setting toggle), add a one-liner `track(category, action, type)` at the interaction's handler. Reuse the closed `TELEMETRY_CATEGORIES` / `TELEMETRY_ACTIONS` enums in `@livediagram/api-schema`, extending them only when no existing pair fits. The `type` is a preset enum value (e.g., `Square`, `DrawToAddOn`), never user content. The editor (`apps/live`) and the help centre (`apps/help`) emit, both through the shared `@livediagram/telemetry-client` engine with app-owned enable/opt-out policy; settings flips fire BEFORE the change is persisted so an opt-out event still reaches the wire.
