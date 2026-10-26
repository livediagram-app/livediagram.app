---
name: verify
description: Drive a product's editor (livediagram, liveplanner, livedesign, livedocuments) end-to-end in a real browser to verify a change. Covers the dev servers and ports, creating a document through the real path, and editor gotchas.
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

- Check what's already listening first: `lsof -nP -iTCP:3100 -sTCP:LISTEN` (and the api port). The
  owner usually has the dev servers running. Never start a second `pnpm dev` over a running one, and
  never `pkill` dev servers or workers: the registry is machine-wide and other sessions use them.
- To start a product only when nothing is running: `corepack pnpm dev:diagram` (or `dev:planner`,
  `dev:design`, `dev:documents`) from the monorepo root. `pnpm` is only available as `corepack pnpm`.
- Without the api worker, creating a document fails ("Couldn't create the diagram" or similar).
- Concurrent `pnpm build` is safe: dev uses `.next-dev/`, builds use `.next/`.
- Use `localhost`, not the machine's LAN address: plain http elsewhere isn't a secure context and the
  editor fails to load.

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
