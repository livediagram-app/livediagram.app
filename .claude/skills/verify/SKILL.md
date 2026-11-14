---
name: verify
description: Drive a product's editor (livediagram, liveplanner, livedesign, livedocuments, livehuddle) end-to-end in a real browser to verify a change. Covers the dev servers and ports, signing in against the local accounts Worker, creating a document through the real path, and editor gotchas.
---

# Verifying editor changes in the running app

## Prerequisites (check before starting anything)

Each product runs in its own port block (AGENTS.md). Open the editor through its **router**, which
puts the api on the same origin as production does; the editor's own port can't reach `/api` unless
`NEXT_PUBLIC_API_BASE` is set in its `.env.local`.

| Product       | Router (use this) | Editor (own port)  | api worker (wrangler dev) |
| ------------- | ----------------- | ------------------ | ------------------------- |
| livediagram   | 3100              | 3102               | 8687                      |
| liveplanner   | 3200              | 3202               | 8887                      |
| livedocuments | 3300              | 3302               | 8987                      |
| livedesign    | 3400              | 3402 (`apps/live`) | 8989                      |
| livehuddle    | 3500              | 3502               | 9087                      |

- Check what's already listening first: `lsof -nP -iTCP:3100 -sTCP:LISTEN` (and the api port). The
  owner usually has the dev servers running. Never start a second `pnpm dev` over a running one, and
  never `pkill` dev servers or workers: the registry is machine-wide and other sessions use them.
  A Next app's `dev` refuses a port that is already held: it prints the holder's PID and folder and
  exits, leaving it running. Don't pass `--force` (which kills the holder) unless the holder is yours.
- To start a product only when nothing is running: `corepack pnpm dev:diagram` (or `dev:planner`,
  `dev:design`, `dev:documents`) from the monorepo root. `pnpm` is only available as `corepack pnpm`.
- Without the api worker, creating a document fails ("Couldn't create the diagram" or similar).
- Concurrent `pnpm build` is safe: dev uses `.next-dev/`, builds use `.next/`.
- Use `localhost`, not the machine's LAN address: plain http elsewhere isn't a secure context and the
  editor fails to load.

## Signing in against the local accounts Worker

Sign-in, guests and share links need the liveworkspace stack (`corepack pnpm dev:workspace`: the site on 3000,
accounts on 8787, the index on 8793, media on 8792). In a fresh checkout or worktree there is nothing to set up
(liveworkspace/docs/specs/003-accounts/sign-in.md "Local clients"):

- Each service's `dev` script makes its `.dev.vars` from `.dev.vars.example` when there is none (never over one) and
  applies its local migrations.
- The accounts `dev` script writes every product's fixed local OAuth client (`local-<product>`, secret
  `local-<product>-client-secret`) into its local database on each start (`corepack pnpm db:seed:local` runs that step
  alone). A local database copied in from another checkout gets them at the next restart.
- Each product api's `dev` script makes its `.dev.vars` from its `.dev.vars.example` (that client, the router as
  `AUTH_ORIGIN`, the local index) once accounts has a `.dev.vars`, so start `dev:workspace` before the product, or
  restart the product after. Without it the product runs with no sign-in and no guests, and its log says so.

An existing `.dev.vars` (the owner's main checkout) is left as it is, with whatever client it names; the local
clients sit beside it. Ask before editing a `.dev.vars` you didn't make.

- Codes aren't emailed locally: each sign-in code is printed in the accounts Worker's output.
- Pictures (Explorer previews, a share link's `image.svg`/`image.png`/`card`, Community card images) come from the media
  service (8792, part of `dev:workspace`), through the router's `PREVIEWS_ORIGIN`. Without it running the router answers
  `502` "the previews service ... could not be reached" and cards show a broken image: start `dev:workspace`, or a
  private media Worker with the router's `PREVIEWS_ORIGIN` pointed at it. A bare `500` "Network connection lost" from
  a router is the same thing for whichever downstream it names in its log: one of the stack's services isn't running.
- Running a second stack in another port block: give the site `ACCOUNTS_DEV_ORIGIN` (and `INDEX_DEV_ORIGIN`,
  `MEDIA_DEV_ORIGIN`), accounts `BASE_URL` and `--local-upstream` at that site, the router `--var` overrides for
  `WORKSPACE_ORIGIN`, `EDITOR_ORIGIN`, `API_ORIGIN` and `PREVIEWS_ORIGIN`, and every `wrangler` its own `WRANGLER_REGISTRY_PATH`
  and `--persist-to`, so nothing reaches the workers already running. Seed the accounts database with
  `LOCAL_CLIENT_ORIGINS=<product>.app=http://localhost:<your router port> corepack pnpm db:seed:local` (add
  `-- --persist-to <dir>` when its state is elsewhere), so the local client takes your router as a redirect. The accounts Worker accepts a sign-in on an
  app's own address only on that app's first port (3500 for livehuddle), so give it
  `SIGN_IN_ON_APP_ORIGINS=false` there: sign-in then runs on the site's address and comes back to the app.
- Running two e2e stacks (`scripts/e2e-stack.mjs`) side by side: give each its own `E2E_EDITOR_PORT`, `E2E_API_PORT`,
  `E2E_INDEX_PORT` and `E2E_MEDIA_PORT`. The wrangler inspectors of the index, media and api follow them (each port + 10),
  so no port falls outside the stack's own; set `E2E_INDEX_INSPECTOR_PORT`, `E2E_MEDIA_INSPECTOR_PORT` or `E2E_API_INSPECTOR_PORT` to place one elsewhere.
- Without the api's accounts vars the editor still opens: nobody can sign in, guests have no identity
  (`/api/auth/guest` comes straight back to `/auth/guest#error=guest_not_configured`), and share links can't be
  checked.

## Driving the app (Claude in Chrome)

- Create a document through the real user path: `http://localhost:<router>/new`, a two-step wizard
  (Template, then Theme, then Create). It lands on the document's page with `#t=<tabId>`.
- The wizard modal REFLOWS between renders, so coordinate clicks misfire. Use `find` to get element
  refs and click by ref. The template search box is the reliable way to pick a template.
- The palette defaults to the Shapes tool: a click-drag on the canvas DRAWS a square instead of
  selecting or moving. Click "Select" in the palette header first when testing drags.
- livediagram only (livedesign has no Layers panel since #1444; its photo editor has a Layers tab): the Layers panel opens from the stacked-squares dock button in the bottom-right zoom cluster. Each
  row: eye toggle, preview, name, ellipsis menu (Layer / Content / Merge; Lock lives under Content).
- Hover-to-solo: resting the pointer on a layer row for about 1 s makes the canvas render ONLY that
  layer. Move the pointer off the panel before screenshotting canvas state, or you capture the solo
  preview, not reality.
- Persistence check: full page reload; tab data (elements, layers, locks) must survive the api
  round-trip.
- Guest-owned test documents in the local dev D1 are harmless to leave behind.
