# Live app

The diagram editor — where users actually build diagrams and mindmaps.

- **Workspace:** `apps/live` (`@livediagram/live`).
- **Public URL:** `https://livediagram.app/live` (via the [router app](08-router-app.md)).
- **Tech:** Next.js (static export), React, TypeScript, Tailwind. `basePath: '/live'` in `next.config.ts` so internal URLs and asset paths are correctly prefixed.

## Always available without sign-in

A guest can open `/live`, create a diagram, and use the full canvas without an account. See [04-auth-and-guest-access.md](04-auth-and-guest-access.md).

## Routes

- `/live/new` — welcome / template-picker flow for creating a new diagram. See [14-new-diagram-route.md](14-new-diagram-route.md).
- `/live/diagram/<id>` — the editor itself, scoped to one diagram id. Static-exports a single `/diagram/placeholder` page that the router rewrites all `/diagram/<id>` paths to at the edge.
- `/live/` — landing redirect into the welcome flow.

## Persistence

The editor talks to the Cloudflare Worker API documented in [11-api.md](11-api.md). `apps/live/lib/api-client.ts` is the single boundary — the editor never reads or writes diagram state to `localStorage`. D1 holds the durable snapshot; per-tab content is split into its own rows (see [13-per-tab-storage.md](13-per-tab-storage.md)) so autosave scope shrinks to the tab being edited.

`localStorage` is still used for **identity bootstrap only** — a `crypto.randomUUID()` participant id under `livediagram:v2:self-id`, plus a `livediagram:v2:name-confirmed` flag once the user has named themselves. Everything else flows through the API.

The diagram shape follows [05-diagram-structure.md](05-diagram-structure.md) — a diagram has tabs, and elements can link across tabs.

## Layout

Three regions stacked vertically, filling the viewport:

```
┌────────────────────────────────────────────────────┐
│ Header — brand + diagram name + Share              │
├────────────────────────────────────────────────────┤
│                                                    │
│   Canvas area — viewport with zoom + pan + the     │
│   floating Command Palette, Explorer, Context,     │
│   Activity, and selection chrome on top.           │
│                                                    │
├────────────────────────────────────────────────────┤
│  [ Tab 1 ] [ Tab 2 ] [ + ]            Tab bar      │
└────────────────────────────────────────────────────┘
```

- **Header:** brand wordmark, diagram-name field (click to rename), and the Share button. The private/shared badge sits next to the title.
- **Canvas:** owns most of the viewport. See [09-canvas-and-command-palette.md](09-canvas-and-command-palette.md) for the full surface — shapes, arrows, marquee, multi-select, floating palettes, plus the activity / context panels.
- **Tab bar:** horizontal row of tabs with `+` to add. Click to switch, double-click to rename, drag to reorder.

## What the editor supports today

- Boxed elements (shape, text, sticky), arrows (straight / curved / angled, optional label, configurable line thickness + arrowhead size), groups, multi-select via marquee + plain-click + shift-click.
- Per-element format painter, lock, link-to-tab, comment threads.
- Real-time presence + selection + cursor broadcast via the per-diagram Durable Object room (see [11-api.md](11-api.md)).
- Per-tab activity log + surgical revert (see [12-activity-and-audit.md](12-activity-and-audit.md)).
- Folders in the Explorer (see [15-folders.md](15-folders.md)).
- Themed templates (chosen on the new-diagram route).

## Out of scope (next iterations)

- **Auth UI** — Clerk integration. Today the api carries owner identity in `X-Owner-Id` only.
- **Export** — PNG / SVG / JSON. The data model is JSON-serialisable already; an export route just needs to surface it.
- **Operational transform / CRDT edits** — realtime is LWW broadcast; concurrent edits to the same element clobber.
- **Comments inbox / mentions** — comment threads exist per-element but there's no aggregated view yet.
