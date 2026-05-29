# Live app

The diagram editor — where users actually build diagrams and mindmaps.

- **Workspace:** `apps/live` (`@livediagram/live`).
- **Public URL path:** `/live` (via the [router app](08-router-app.md)).
- **Tech:** Next.js (static export), React, TypeScript, Tailwind. `basePath: '/live'` in `next.config.ts` so its internal URLs and asset paths are correctly prefixed.

## Always available without sign-in

A guest can open `/live`, create a diagram, and use the full canvas without an account. See [04-auth-and-guest-access.md](04-auth-and-guest-access.md).

## Persistence

Per [02-prototype-scope.md](02-prototype-scope.md), persistence in the prototype goes through a `DiagramStore` interface with a `localStorage` implementation. The editor UI never touches `localStorage` directly.

The diagram shape follows [05-diagram-structure.md](05-diagram-structure.md) — a diagram has tabs, and elements can link across tabs.

## Initial shell

The first version of the app is a layout shell — three regions stacked vertically, filling the viewport:

```
┌────────────────────────────────────────────────────┐
│ Header                                             │
├────────────────────────────────────────────────────┤
│                                                    │
│                                                    │
│                Canvas area                         │
│           (placeholder for now)                    │
│                                                    │
│                                                    │
├────────────────────────────────────────────────────┤
│  [ Tab 1 ] [ Tab 2 ] [ + ]            Tab bar      │
└────────────────────────────────────────────────────┘
```

### Header (top, fixed height)

- **Left:** `Brand` from `@livediagram/ui` (the `live[diagram]` wordmark).
- **Center:** current diagram name (defaults to "Untitled diagram"; renameable later).
- **Right:** action slot — placeholder for future Share / Account / Sign in buttons.

### Canvas area (middle, fills remaining space)

- Takes all vertical space between header and tab bar.
- Renders the **active tab's** content.
- A floating **command palette** is pinned to the top of the canvas — see [09-canvas-and-command-palette.md](09-canvas-and-command-palette.md). It is the entry point for adding shapes (square, circle) and will grow over time.
- Shapes render as positioned elements inside the canvas; the dot-grid background is preserved.

### Tab bar (bottom, fixed height)

- Horizontal row of tabs belonging to the current diagram.
- Active tab visually distinct.
- Click a tab to make it active.
- A `+` button at the end adds a new tab and makes it active.
- Future: rename (double-click), reorder (drag), close, context menu — out of scope for the initial shell.

## Out of scope for the initial shell

- Actual canvas rendering (nodes, edges, connecting, dragging).
- Cross-tab link UI (the data model supports it per [05](05-diagram-structure.md), but no creation UI yet).
- Diagram list / dashboard / "open another diagram".
- Auth UI.
- Sharing, presence, multiplayer.
- Export (PNG / SVG / JSON).
