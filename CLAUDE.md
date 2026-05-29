# livediagram

Monorepo for the livediagram product. Multiple apps share code through internal packages.

## Specs are the source of truth

Before building or proposing anything, **check `specs/`**. Every product decision, feature, constraint, and rule lives there. The index is at [`specs/README.md`](specs/README.md).

Workflow:

- New feature, scope change, or rule → write or update a spec **first**, code second.
- When a user request lands, capture it in a spec before writing code, and keep specs organised under their numbered prefixes.
- Reference specs by filename in PRs and discussions.
- If specs and code disagree, that's a bug — usually the spec is right; if not, fix the spec first.

## Repo layout

```
apps/
  marketing/    # static marketing site (Next.js, /)
  live/         # the diagram editor app (Next.js, /live)
  router/       # Cloudflare Worker stitching the apps under one hostname
packages/
  ui/             # shared UI primitives (Brand, etc.)
  eslint-config/  # shared ESLint flat config
  prettier-config/# shared Prettier config
  tailwind-config/# shared Tailwind theme (brand palette)
specs/          # product specs — read these first
```

Workspaces are managed with **pnpm** (`pnpm-workspace.yaml`). Tasks are orchestrated with **Turborepo** (`turbo.json`). Node `>=20`, pnpm `>=9`.

## Current phase: frontend prototype

See [specs/02-prototype-scope.md](specs/02-prototype-scope.md).

- **In scope:** Next.js (static export), React, TypeScript, Tailwind. The router Worker. Local-only state. Persist diagrams to **`localStorage`** through a `DiagramStore` interface.
- **Out of scope (for now):** backend API Workers, real-time collaboration, multi-user sync, auth, payments, email, D1.
- Write code that is **ready to swap** the persistence/data layer for an API later. Put storage behind an interface; the `localStorage` implementation now, a Workers/D1 implementation later — no UI changes needed.
- Don't scaffold backend Workers, Clerk, Resend, Stripe, or D1 migrations during this phase.

## Open source + commercial

See [specs/03-open-source-and-business-model.md](specs/03-open-source-and-business-model.md).

- The codebase is **MIT-licensed** and **publicly viewable**. Anyone can self-host.
- A hosted version with a **Pro subscription** runs alongside (benefits TBD).
- Don't add code that breaks self-hosting (no required SaaS calls, no license checks gating the core editor).
- Pro features should be cleanly separable from the OSS core.

## Secrets policy

See [specs/06-secrets-policy.md](specs/06-secrets-policy.md). **Repo is public — no secrets in source. Ever.**

- All secrets via env vars: `.env.local` (gitignored) for dev, `wrangler secret put` for Workers, dashboard env vars for Pages.
- Client bundles only carry values explicitly prefixed `NEXT_PUBLIC_*` and only when documented as publishable (e.g. Clerk publishable key, Stripe publishable key).
- Server-only secrets (Clerk secret key, Stripe secret key, Resend, D1 access) never appear in client code.
- Each app/worker that needs env vars ships a `.env.example` documenting what's required.

## Auth model

See [specs/04-auth-and-guest-access.md](specs/04-auth-and-guest-access.md).

- **The canvas always works without signing in.** Friction-free engagement is the acquisition strategy. Never put a sign-in wall in front of the editor.
- Clerk handles auth (post-prototype). Auth unlocks sync / sharing / collab — it doesn't gate the basic experience.
- Guests' local diagrams should migrate into their account on sign-up.

## Core principle: reuse over duplication

**Avoid duplication. Build things in reusable ways from the start.** Non-negotiable.

- Before writing something new, check `packages/` for an existing shared module — extend it rather than recreating it.
- If two apps need the same thing (UI component, util, type, schema, API client, validator, config), it lives in `packages/`, not copied into each app.
- If you find yourself copy-pasting code across apps or packages, stop and extract it. "I'll dedupe later" is how drift starts.
- Design package APIs to be consumed by multiple callers — generic enough to reuse, specific enough to be useful.
- Tailwind theme, ESLint, Prettier, TS config, and shared UI primitives all live in `packages/` for exactly this reason.

When the right place for code is genuinely unclear, default to `packages/`.

## Hard constraints

- **All websites must be static and deployable to Cloudflare Pages.** Next.js apps use `output: 'export'` — no SSR, no Node runtime, no Next API routes (use a Cloudflare Worker), no server-required image loader.
- Server-side logic lives in Cloudflare Workers, **not** in Next.js. Frontends call those Workers.
- Database access goes through a Worker that holds the D1 binding — never from the browser.

## Target tech stack (post-prototype)

This is what the full product runs on. Most of it is **not built yet** — see "Current phase".

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **APIs:** Cloudflare Workers
- **Routing edge:** Cloudflare Workers (the router app)
- **Database:** Cloudflare D1
- **Auth:** Clerk
- **Email:** Resend
- **Payments:** Stripe

## Naming conventions

- Workspace packages: `@livediagram/<name>`.
- Apps in `apps/<name>` (e.g. `apps/marketing`, `apps/live`, `apps/router`).
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

## Common commands

Run from the repo root:

| Command             | What it does                              |
| ------------------- | ----------------------------------------- |
| `pnpm install`      | Install all workspace deps                |
| `pnpm dev`          | `turbo run dev` across workspaces         |
| `pnpm build`        | `turbo run build`                         |
| `pnpm lint`         | `turbo run lint`                          |
| `pnpm typecheck`    | `turbo run typecheck`                     |
| `pnpm test`         | `turbo run test`                          |
| `pnpm format`       | Prettier write across the repo            |
| `pnpm format:check` | Prettier check (CI)                       |

Run a script in a single workspace: `pnpm --filter @livediagram/<name> <script>`.

## Guidelines

- Don't add SSR, Next.js API routes, or Node-only runtime code to a frontend app — it will break Cloudflare Pages deploys.
- Put any logic shared by two or more apps in `packages/` rather than copying it.
- Worker apps target the Cloudflare Workers runtime — prefer Web APIs (`fetch`, `Request`, `Response`, `crypto.subtle`) over Node-only APIs.
- D1 schemas and migrations (when they arrive) live with the Worker that owns the binding.
- The router worker (`apps/router`) holds **no business logic** — only routing. If you're tempted to add logic to it, that logic belongs in the service it forwards to.
