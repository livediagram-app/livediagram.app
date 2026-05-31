# Dedicated route for new-diagram creation

Split the welcome / template-picker flow off `/live` into its own
route at `/live/new`. The editor route becomes editor-only;
`/live/new` handles "I want to create a diagram" end-to-end.

## Motivation

`/live` currently serves two distinct experiences from one component:

1. **Editor** — `/live?d=<id>` (owner) or `/live?s=<code>` (visitor).
   State: load diagram, autosave, room broadcast, activity log, etc.
2. **Welcome / Create new** — `/live` with no params. State:
   `templatePickerMode`, `welcomeOpen`, `loadedExistingDiagram`,
   `nameConfirmed`, and the `commitDiagramId()` flow that mints a
   UUID + rewrites the URL via `history.replaceState`.

The overlap is the source of recurring state bugs:

- The "Empty Canvas" flash on `New Diagram` clicks (multiple
  iterations to land cleanly).
- `templatePickerMode = 'welcome'` showing on existing-diagram tabs.
- Hydration spinner hangs because the no-params path raced with the
  identity-API roundtrip.
- The `effectiveTemplatePickerMode` derived patch papering over
  conflicts between welcome and per-tab template states.

Each fix touched a different gate. Splitting the two surfaces lets
each one own a clean state model without conditional gates.

## Goals

- A dedicated `/live/new` route that owns the welcome / template /
  identity-mint flow end-to-end.
- `/live` becomes editor-only. Hydration only handles `?d=` /
  `?s=` URLs and never has to consider "do I mint an id?".
- Visiting `/live` with no params redirects to `/live/new` instead
  of trying to be both surfaces at once.
- "New Diagram" buttons (Explorer + NotFound CTA) navigate to
  `/live/new`. Existing share / open flows stay on `/live`.

## Non-goals

- Changing the visitor `?s=<code>` flow. Visitors still land on
  `/live/diagram/shared?s=<code>` and confirm their name there —
  the `identityOnlyScreenOpen` mini-flow stays in the editor route
  because it's about the visitor's session, not about creating a
  new diagram.
- Splitting the per-tab "Pick a template" flow (the templates
  variant of the existing picker that fires when you open an empty
  tab on an existing diagram). That stays in `/live` because the
  diagram is already loaded.
- Changing what gets persisted at "Submit" time. The new route
  still POSTs `/api/diagrams` with the chosen template tab seeded,
  same as the current `commitDiagramId()` path.

## Route map

| Route                       | Purpose                              | State                                                                                                                   |
| --------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `/live`                     | Bare entry point                     | Redirect → `/live/new` (or `/live/diagram/shared?s=<code>` if a legacy visitor query is present). Renders nothing else. |
| `/live/diagram/<id>`        | Editor for an existing owned diagram | Static placeholder file fronts every id (see "Path scheme" below). Client reads the id from `window.location.pathname`. |
| `/live/diagram/shared?s=<>` | Visitor view of a shared diagram     | Same placeholder file. Client reads the share code from the `s` query param.                                            |
| `/live/new`                 | Welcome / create-new flow            | Identity, template, theme picker. POSTs the diagram + navigates to `/live/diagram/<id>`.                                |

## Path scheme

Editor URLs use a path segment rather than a query string. `output:
'export'` can't enumerate user-minted UUIDs at build time, so:

1. Next.js builds a single placeholder at `out/diagram/placeholder/index.html`
   via `generateStaticParams = [{ id: 'placeholder' }]` on the
   dynamic-segment server page. The page wraps a client `EditorPage`
   component that owns the editor logic.
2. The live worker (`apps/live/src/worker.ts`) wraps the static-assets
   binding and rewrites any `/diagram/<anything>` request to
   `/diagram/placeholder/`. The browser URL stays `/diagram/<id>`.
3. Client code reads `window.location.pathname` to extract the real
   id. The placeholder id is treated as "no id".
4. In `next dev`, Next.js resolves the dynamic segment natively so the
   same URL works without going through the worker.

The hard cutover dropped the legacy `?d=<id>` query scheme — old
bookmarks pointing at `/live?d=<id>` no longer work.

### Pre-hydration URL swap

`output: 'export'` forces `dynamicParams=false`. The client-side
router compares the current URL against the static manifest on
hydration and treats any dynamic-segment value not enumerated in
`generateStaticParams` as a not-found state. `placeholder` is the
only enumerated id, so every real diagram URL triggers the
framework's default 404 page the instant the JS hydrates — the
editor briefly paints (loading spinner from `placeholder.html`)
then vanishes.

This isn't fixable by removing `app/not-found.tsx`: Next.js inlines
its built-in default 404 component into the same `notFound` slot
of the placeholder's flight payload. The trigger is the URL
mismatch, not the not-found component itself.

The workaround is an inline `<script>` in `apps/live/app/layout.tsx`
that runs synchronously in `<head>`, before React hydrates:

1. Stash the native `history.replaceState` on
   `window.__LD_NATIVE_REPLACE_STATE__` before Next.js's app-router
   bundle can patch it. After its bundle loads Next.js wraps both
   `history.pushState` and `history.replaceState` so every call
   notifies its routing layer — which, on a non-matching dynamic-
   segment URL, fires `notFound` and replaces the editor with the
   framework's default 404. The captured native reference lets the
   editor change the URL without that notification.
2. If the path matches `/live/diagram/<x>` and `<x> !== 'placeholder'`,
   stash `<x>` on `window.__LD_DIAGRAM_PATH_ID__`.
3. Use the captured native `replaceState` to rewrite the address
   bar to `/live/diagram/placeholder` (preserving search + hash).
4. React hydrates against a URL that matches the static manifest —
   no not-found triggered, editor renders normally.
5. The editor's bootstrap `useLayoutEffect` reads the captured id,
   clears the global, then calls the captured native `replaceState`
   to restore the real URL. Address bar updates synchronously
   (before paint); Next.js's router is NOT notified, so it doesn't
   re-evaluate the segment and notFound stays dormant.

The script is wrapped in `try/catch` so a failure degrades to the
old broken state rather than blocking the page. Other routes
(`/live/new`, `/live`, marketing) ignore the path-rewrite step but
still get the native-replaceState capture — harmless because no
other code reads it.

Adding routes under `/live/diagram/<x>/...` with deeper paths would
need the regex to be relaxed; today's routes are flat.

## Navigation flows

### Owner creates a new diagram

1. User clicks **New Diagram** in the Explorer (or lands on `/live`).
2. Browser navigates to `/live/new`.
3. `/live/new` renders the welcome card immediately — no spinner.
4. User picks (or skips) name + template + theme and clicks **Create**.
5. Page mints a UUID, POSTs `/api/diagrams` with the seeded tab(s),
   then `window.location.assign('/live/diagram/<id>')` to land on
   the editor with the new diagram already on the server.
6. On the editor route, hydration extracts the id from the pathname
   and fetches the diagram + tab content. No mint, no welcome gate.

### Owner opens an existing diagram

1. Explorer list row click → `window.location.assign('/live/diagram/<id>')`.
2. Editor route hydrates as today. The welcome / templates / identity
   modes never load.

### Visitor follows a share link

1. URL is `/live/diagram/shared?s=<code>`.
2. Editor route hydrates via the existing `apiLoadShared` branch.
3. Visitor identity confirmation (the `identityOnlyScreenOpen` mini-flow)
   stays on the editor route — it's about the visitor, not the diagram.

### Empty tab on an existing diagram

1. User clears the active tab's content (or opens a tab that was
   created empty).
2. The existing `showTemplatePicker` (templates variant) modal
   shows on the editor route. Unchanged by this refactor.

### Diagram not found

1. URL is `/live/diagram/<id>` but the API returns 404.
2. NotFound surface renders as today, but its "Create new diagram"
   CTA now navigates to `/live/new`.

## State changes in `/live`

Removed from the editor route:

- `templatePickerMode = 'welcome'` and the `effectiveTemplatePickerMode`
  derivation.
- `welcomeOpen` (the chrome-hide trigger for the New Diagram modal).
- `commitDiagramId()` and every call site (`createShareLink`,
  `skipTemplatePicker`, `chooseTemplate`).
- The "no URL params" branch of hydration. If the pathname's id
  segment resolves to the build-time placeholder and no `?s=` code
  is set, the editor route redirects to `/live/new` (via
  `window.location.assign`) and renders the spinner until the
  navigation completes.

Kept on the editor route:

- The `templates` variant of the template picker (per-tab content
  scaffolding).
- The visitor identity confirmation modal (`identityOnlyScreenOpen`).
- Everything else: autosave, room, activity, tab management,
  diagram metadata, share dialog, etc.

## `/live/new` state

The new route owns:

- The participant-identity bootstrap (same `livediagram:v2:self-id`
  localStorage key, same `apiLoadSelf` / `apiSaveSelf` API).
- `templatePickerMode = 'welcome'` (only).
- The template + theme choice locally until the user commits.
- The "name confirmed" persistence (same
  `livediagram:v2:name-confirmed` localStorage key).
- On commit: mint a UUID, POST `/api/diagrams` with the
  templated tab(s) inline, navigate to `/live/diagram/<id>`.
- On skip / X: mint a UUID, POST an empty-tab diagram, navigate to
  `/live/diagram/<id>` so the user lands on the editor with a
  fresh diagram already persisted.

## API impact

- No new endpoints. `POST /api/diagrams` already accepts an
  optional `tabs` array per spec/13 — the new route uses it.

## Tests / sanity-check checklist

- `/live` with no params → redirects to `/live/new`, no flash.
- `/live/new` → welcome card on first paint.
- Pick template → Create → editor loads on `/live/diagram/<id>`.
- Skip welcome → editor loads on `/live/diagram/<id>` with an
  empty starter tab.
- `/live/diagram/<id>` (existing) → editor hydrates as before.
- `/live/diagram/shared?s=<code>` (visitor) → editor + identity-confirm modal.
- NotFound CTA → goes to `/live/new`.
- "New Diagram" from Explorer → goes to `/live/new`.

## Out of scope for V1

- Animations for the route transition. A spinner is fine.
- A dedicated `/live/new` landing-page mode for unauthenticated
  users. Auth lands in a future spec.
