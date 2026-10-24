# How the monorepo is laid out, and where it's heading

## Today

```
liveworkspace/                 git root, one pnpm workspace, one lockfile, one turbo.json
├─ packages/                   shared by every product (@liveworkspace/*)
│  ├─ account-menu             the signed-in account menu, for liveworkspace.app and every app
│  ├─ auth-client              sign-in redirect, code swap, refresh, token check
│  ├─ explorer                 the One Explorer UI over the index, rendered at every app's /explorer
│  ├─ index-client             the One Explorer index contract: types, a client, the grant check
│  ├─ index-app                the server side of an app on the index: grants, internal doors, purge, outbox
│  ├─ community                the Community contract: apps, vocabulary, limits, wire shapes
│  ├─ comparisons              every app's comparison pages, built once; each app's marketing hosts its own
│  ├─ media                    the media contract: apps, upload limits, wire shapes, a client
│  ├─ render-png               SVG to PNG with resvg and the Inter fonts, for every api, mcp and cli
│  ├─ sites                    liveworkspace's sites, for every logo's site switcher
│  ├─ source-ast               parses the repo's own TypeScript, for the static guards that read code
│  ├─ style-guards             the motion tokens and the motion, optical and touch-target guards
│  ├─ telemetry                the telemetry contract: apps, batch format, dashboard summary
│  └─ trusted-types            the Trusted Types policies, boot script and header every app's pages share
├─ liveworkspace/              the platform's own apps
│  ├─ apps/site                liveworkspace.app, one static site: the front door, /telemetry, /sign-in
│  ├─ apps/accounts            liveworkspace.app/api/auth: sign-in for every product
│  ├─ apps/community           liveworkspace.app/api/community: every app's listings, own D1
│  ├─ apps/media               liveworkspace.app/api/media: every app's images, own D1 and R2
│  ├─ apps/index               liveworkspace.app/api/index: every app's items for the One Explorer, own D1
│  └─ apps/telemetry           liveworkspace.app/api/telemetry: every product's events, own D1
├─ livediagram/                imported with full history (main at 82e6ed79a); Diagram, Draw, Workshop
│  ├─ apps/                    editor, api, mcp, cli, marketing, help, community, router
│  └─ packages/                @livediagram/*
├─ liveplanner/                imported with full history (main at d5c8bed2); Plan
│  ├─ apps/                    the same set minus community
│  └─ packages/                @liveplanner/*
├─ livedocuments/              forked from livediagram in-tree (Pages mode only)
│  ├─ apps/                    the same set minus community
│  └─ packages/                @livedocuments/*
└─ livedesign/                 forked from livedocuments in-tree (logo, wireframe and photo pages)
   ├─ apps/                    live (its editor), api, mcp, cli, marketing, help, router
   └─ packages/                @livedesign/*, with photo-engine of its own
```

livedocuments (first called livepages) was forked from livediagram `main` at `82e6ed79a` on 2026-10-22
and cut down to Pages mode (livedocuments/plans/0001-livedocuments-fork.md); Phase 8 took Pages out of livediagram.

livediagram is now Diagram, Draw and Workshop. Plan (boards of cards, Sheets, dashboards and forms) lives in
liveplanner, and livediagram has no `items`, `sheets`, `forms`, `plan-art` or `page-background` packages any more
(livediagram/plans/0001-remove-plan-mode.md). A stored Plan tab opens in livediagram as an ordinary Diagram tab.

livedesign was forked from livepages (`livepages-phase-2` at `1eb2877a5`) on 2026-10-22 and cut down to
logo and wireframe pages, plus the photo pages ported from livediagram. What it makes is a design, never
a document. Logos and wireframes then left livedocuments, which keeps articles, slides and infographics.

liveplanner was forked from livediagram on 2026-10-21, so today most of it is a renamed copy.
I compared each file with the product name ignored, and these counts are from that (taken before Plan left
livediagram, so `packages/items` and `packages/sheets` are liveplanner's alone now):

|                                                                                                  | identical | changed | only in one |
| ------------------------------------------------------------------------------------------------ | --------- | ------- | ----------- |
| `apps/editor` (the editor)                                                                       | 2,718     | 1,248   | ~1,080      |
| `packages/document`                                                                              | 474       | 169     | 110         |
| `packages/ui`                                                                                    | 168       | 42      | 23          |
| `packages/templates`                                                                             | 142       | 95      | 21          |
| `packages/items`                                                                                 | 100       | 6       | 6           |
| `packages/sheets`                                                                                | 108       | 20      | 5           |
| `api-client`, `oxlint-config`, `prettier-config`, `render-png`, `source-ast`, `telemetry-client` | all       | 0       | 0           |

Every day both products change separately, so these numbers get worse. That's the case for
sharing now rather than later.

## Where it's heading

One platform with thin products. Everything both products use lives once, in `packages/`. A
product folder holds only what makes that product different.

```
liveworkspace/
├─ packages/                       @liveworkspace/*, used by every product
│  ├─ config-*                     tsconfig, oxlint, prettier, vitest, tailwind, next
│  ├─ auth-client
│  ├─ api-client, telemetry-client, render-png, source-ast, icons
│  ├─ document, document-views, edit-operations, agent-verbs, api-schema
│  ├─ templates, template-previews
│  ├─ ui                           design system: buttons, menus, dialogs, tokens
│  ├─ workbench                    NEW: the editor shell lifted out of apps/editor:
│  │                               tabs, explorer, panels, chrome, split view, start
│  │                               screen, toasts, providers. A product hands it the tab
│  │                               kinds it offers.
│  └─ api-core                     NEW: the shared API routes (documents, sharing,
│                                  teams, tokens, trash) that each product's API Worker mounts
├─ liveworkspace/apps/
│  ├─ accounts                     sign-in
│  ├─ telemetry (+ -dashboard)     every product's anonymous events (docs/telemetry.md there)
│  ├─ community                    every product's Community listings (docs/community.md there)
│  ├─ media                        every product's uploaded images (docs/media.md there)
│  └─ home (later)                 one place for all your documents across products
├─ livediagram/
│  ├─ apps/editor                  thin: workbench + mode-draw (Diagram, Draw and Workshop)
│  ├─ apps/api                     api-core + the diagram-only routes
│  ├─ apps/…                       marketing, help, mcp, cli, community: product-specific
│  └─ packages/                    mode-draw (canvas tabs), diagram, diagram-lint, sticky-*
└─ liveplanner/
   ├─ apps/editor                  thin: workbench + mode-plan
   ├─ apps/api                     api-core + the planner-only routes
   ├─ apps/…                       marketing, help, mcp, cli
   └─ packages/                    mode-plan (Board, Sheet, Dashboard and Form tab kinds), items,
                                   sheets, forms, plan-art
```

Tabs are the example you gave. The tab strip, tab state, opening, reordering and splitting all
live in `workbench`. What's _inside_ a tab is a tab kind that a mode registers: a canvas from
`mode-draw`, a board or sheet from `mode-plan`. livediagram registers only `mode-draw`, and liveplanner
only Plan's.

Each product keeps its own deployables, Cloudflare account, databases and branding. Shared
packages take the product's name, URLs and feature flags as configuration rather than
hard-coding them.

## Getting there, safest first

Each step is its own PR, and both products build and pass their tests after every one.

1. **Move the identical packages** (`api-client`, `telemetry-client` and the config packages;
   `render-png`, `source-ast` and the style guards have moved) to `packages/` as `@liveworkspace/*`, then repoint imports in both
   products. This is mechanical and checked by typecheck.
2. **Small-drift packages** (`diagram-lint`, `document-views`, `icons`; `items`, `forms`, `plan-art` and
   `sheets` are liveplanner's alone now, so they stay in liveplanner): settle each diff. For each one, decide whether it's real product
   behaviour, which becomes config, or just one side being behind, where the newer side wins.
   Then move.
3. **The big ones** (`document`, `templates`, `ui`, `api-schema`, `edit-operations`,
   `agent-verbs`), in the same way, one per PR.
4. **Carve `workbench` out of `apps/editor`** one area at a time (`lib/split`, `lib/tags`,
   `components/chrome`, the tab system, explorer, …). Each slice is moved once and deleted from
   both apps.
5. **`api-core`** out of the two `apps/api` Workers.

## Before step 1: deciding when to switch over

liveplanner has switched over: its work happens here, and the old `~/Code/liveplanner` repo is
gone (removed on 2026-10-22, after pulling its `main` at `34cc18d0`). livediagram's original repo
(`~/Code/livediagram`) is still where its work happens. Until it's cut over:

- the copy here goes stale. Refresh it with
  `git subtree pull --prefix=livediagram ../livediagram main` (from its `origin/main`);
- that only stays painless while files keep their places. Once step 1 starts moving files,
  pulls start to conflict.

So the sharing work should start just after the switch. The switch needs:

- **A home on GitHub.** Either a new `liveworkspace` repo, or turn
  `livediagram-app/livediagram.app` into this monorepo. The second keeps livediagram's PRs,
  issues, Actions secrets and history links. livediagram's open branches and worktrees would
  need merging or rebasing onto the new layout first.
- **CI and deploys moved to a root `.github/`**, with each product's workflows filtered to its
  own paths (`livediagram/**`, `liveplanner/**`, `packages/**`). liveplanner deploys to the
  liveworkspace Cloudflare account, with its own secrets and environments. Until then, the
  `.github/` folders under each product are inert here, and livediagram keeps deploying from its
  current repo.
- **The pre-push hook** rewritten for the new paths. It assumed `apps/…` at the root, so it isn't
  installed here yet.
