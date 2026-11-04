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
- To start a product only when nothing is running: `corepack pnpm dev:diagram` (or `dev:planner`,
  `dev:design`, `dev:documents`) from the monorepo root. `pnpm` is only available as `corepack pnpm`.
- Without the api worker, creating a document fails ("Couldn't create the diagram" or similar).
- Concurrent `pnpm build` is safe: dev uses `.next-dev/`, builds use `.next/`.
- Use `localhost`, not the machine's LAN address: plain http elsewhere isn't a secure context and the
  editor fails to load.

## Signing in against the local accounts Worker

Sign-in, guests and share links need the liveworkspace stack (`corepack pnpm dev:workspace`: the site on 3000,
accounts on 8787, the index on 8793, media on 8792) and an OAuth client for the product in the local accounts
database. Each D1 service's `dev` script applies its local migrations before it starts, so a database built before
a migration catches up on its own.

1. Register the product once per local accounts database (`ADMIN_TOKEN` is the one in accounts' `.dev.vars`):

   ```sh
   cd liveworkspace/apps/accounts
   ADMIN_TOKEN=local-admin-token node scripts/register-client.ts \
     --name livehuddle-dev --app livehuddle.app \
     --redirect http://localhost:3500/api/auth/callback --redirect http://localhost:3500/auth/guest \
     --resource http://localhost/api
   ```

   Use the product's router port and site id (`livediagram.app`, `liveplanner.app`, ...). The resource is always
   `http://localhost/api` locally.

2. Put the printed id and secret in the product api's `.dev.vars` beside `ACCOUNTS_URL=http://localhost:3000`,
   `API_RESOURCE=http://localhost/api` and `AUTH_ORIGIN=http://localhost:<router>` (the product's
   `apps/api/.env.example` lists them), then restart the api worker. Ask before editing a `.dev.vars` you didn't make.

- `500 client_app_refused` from registration means the accounts database doesn't take that app yet (behind on its
  migrations, as before `0018_livehuddle.sql`): restart `dev:accounts`, or run `corepack pnpm db:migrate:local` in
  `liveworkspace/apps/accounts`, and register again.
- Codes aren't emailed locally: each sign-in code is printed in the accounts Worker's output.
- Running a second stack in another port block: give the site `ACCOUNTS_DEV_ORIGIN` (and `INDEX_DEV_ORIGIN`,
  `MEDIA_DEV_ORIGIN`), accounts `BASE_URL` and `--local-upstream` at that site, the router `--var` overrides for
  `WORKSPACE_ORIGIN`, `EDITOR_ORIGIN` and `API_ORIGIN`, and every `wrangler` its own `WRANGLER_REGISTRY_PATH`
  and `--persist-to`, so nothing reaches the workers already running. The accounts Worker accepts a sign-in on an
  app's own address only on that app's first port (3500 for livehuddle), so give it
  `SIGN_IN_ON_APP_ORIGINS=false` there: sign-in then runs on the site's address and comes back to the app.
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
- The Layers panel opens from the stacked-squares dock button in the bottom-right zoom cluster. Each
  row: eye toggle, preview, name, ellipsis menu (Layer / Content / Merge; Lock lives under Content).
- Hover-to-solo: resting the pointer on a layer row for about 1 s makes the canvas render ONLY that
  layer. Move the pointer off the panel before screenshotting canvas state, or you capture the solo
  preview, not reality.
- Persistence check: full page reload; tab data (elements, layers, locks) must survive the api
  round-trip.
- Guest-owned test documents in the local dev D1 are harmless to leave behind.
