# Prototype scope

We are building a **frontend-only prototype** before the real product. This spec defines what's in and out so we don't accidentally over-build.

## Goal of the prototype

Prove the diagram and mindmap editing experience — the canvas, the interactions, the feel — without committing to backend infrastructure. A user should be able to open the app, build a diagram or mindmap, refresh the page, and still see their work.

## In scope

- A single Next.js web app (static export, deployable to Cloudflare Pages).
- The canvas editor: creating, moving, connecting, and styling nodes; building diagrams and mindmaps.
- Local persistence via **`localStorage`** — diagrams save automatically and reload on next visit.
- Multiple diagrams managed locally (list view, create new, rename, delete).
- The light-blue design system from `specs/01-color-scheme.md`.

## Out of scope (deferred until after prototype)

- Backend API Workers (business logic, data services).
- Real-time multiplayer / collaboration — **no live cursors, no shared sessions, no presence**. The prototype is single-user, single-device.
- Cloud sync, cross-device persistence.
- Authentication (Clerk), user accounts, teams, sharing, permissions.
- Payments (Stripe), email (Resend).
- D1 database, migrations, server-side anything.
- Server-rendered routes — the app stays statically exported.

### One Worker is in scope

The **router worker** (see [08-router-app.md](08-router-app.md)) is allowed even in the prototype. It is routing infrastructure, not backend logic — it forwards URL paths to the right app and holds no data or business rules. Without it the apps can't coexist under one hostname.

## Hard rule: keep the data layer swappable

The prototype is local-only **today**, but real-time collaboration is the whole product. To avoid a painful rewrite:

- All persistence goes through a **single store interface** (e.g. `DiagramStore`) with one method per operation (`list`, `load`, `save`, `delete`, `subscribe`).
- The prototype ships a `LocalStorageDiagramStore` implementation. The future product swaps in a Worker-backed implementation behind the same interface.
- **UI components never touch `localStorage` directly.** They consume the store via a hook/context.
- Diagram data shape (nodes, edges, metadata) is defined in a shared package so it can be reused by the future API and Worker code without redefining types.

If something can't reasonably be made swappable, document the assumption in code so we know what to revisit later.

## Reuse expectations during the prototype

Even at prototype stage, follow the [reuse principle in CLAUDE.md](../CLAUDE.md#core-principle-reuse-over-duplication):

- The canvas, node primitives, store interface, and diagram data types live in `packages/`, not in the app, so the future second app (e.g. embedded viewer, marketing demo) can reuse them on day one.
- The app in `apps/` should be thin: routing, layout, and wiring. Logic lives in packages.

## Exit criteria

The prototype is "done" (ready to layer the backend on) when:

1. A user can build non-trivial diagrams and mindmaps and persist them locally.
2. The data layer is fully behind the store interface — `localStorage` is referenced in exactly one place.
3. The diagram/mindmap data model is stable enough that we'd be confident persisting it to D1 without restructuring.
