# Dedicated route for new-diagram creation

Split the welcome / template-picker flow off the editor into its own
route at `/new`. The editor route is editor-only; `/new` handles "I
want to create a diagram" end-to-end.

> **Routing note (later change, spec/08):** the `/live` URL prefix was
> removed — the live app serves at clean routes. So today the editor is
> `/diagram/<id>` (not `/live/diagram/<id>`), `/new` is `/new`, and
> there is no bare `/live` entry point (`/` is the marketing home). The
> historical `/live...` URLs below describe the pre-cleanup scheme; map
> each to its `/live`-stripped form. The placeholder-rewrite mechanism
> and the `/new` split itself are unchanged.

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

- A dedicated `/new` route that owns the welcome / template /
  identity-mint flow end-to-end.
- `/live` becomes editor-only. Hydration only handles `?d=` /
  `?s=` URLs and never has to consider "do I mint an id?".
- Visiting `/live` with no params redirects to `/new` instead
  of trying to be both surfaces at once.
- "New Diagram" buttons (Explorer + NotFound CTA) navigate to
  `/new`. Existing share / open flows stay on `/live`.

## Non-goals

- Changing the visitor `?s=<code>` flow. Visitors still land on
  `/diagram/shared?s=<code>` and confirm their name there —
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

| Route                  | Purpose                              | State                                                                                                                   |
| ---------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `/live`                | Bare entry point                     | Redirect → `/new` (or `/diagram/shared?s=<code>` if a legacy visitor query is present). Renders nothing else.           |
| `/diagram/<id>`        | Editor for an existing owned diagram | Static placeholder file fronts every id (see "Path scheme" below). Client reads the id from `window.location.pathname`. |
| `/diagram/shared?s=<>` | Visitor view of a shared diagram     | Same placeholder file. Client reads the share code from the `s` query param.                                            |
| `/new`                 | Welcome / create-new flow            | Identity, template, theme picker. POSTs the diagram + navigates to `/diagram/<id>`.                                     |

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

### Not-found slot renders the editor

`output: 'export'` forces `dynamicParams=false`. The client-side
router compares the current URL against the static manifest on
hydration and fires `notFound()` for any dynamic-segment value not
enumerated in `generateStaticParams`. `placeholder` is the only
enumerated id, so every real diagram URL triggers `notFound()` the
instant the JS hydrates.

Earlier attempts tried to _prevent_ the trigger — a route-level
`not-found.tsx`, a pre-hydration URL swap to `placeholder`, then
the same swap using the captured native `replaceState` so Next's
patched version wouldn't re-notify the router. None of them held
up: Next.js's static export bakes the framework default 404 into
the `notFound` slot of the layout's flight payload and the client
router reaches it before any of those interventions can finish.

Working approach: **embrace the trigger**. `apps/live/app/not-found.tsx`
exports `<EditorPage />` directly. When the client router fires
`notFound()` for an unrecognised id, the layout swaps from
`children` to the `notFound` slot — which is now the editor. The
editor mounts, reads the real id from `window.location.pathname`
(unchanged throughout — no URL swap means no restoration to fight
about), and loads the diagram via the API. The address bar stays
on `/diagram/<uuid>`; nothing about the URL needs to lie.

Behaviour for genuinely-unknown routes (e.g. `/live/typo`) is
benign: the editor mounts, tries to load a diagram with id `typo`,
the API 404s, the in-app `<NotFound>` card surfaces — branded with
a "Create a new diagram" CTA.

## Navigation flows

### Owner creates a new diagram

1. User clicks **New Diagram** in the Explorer (or lands on `/live`).
2. Browser navigates to `/new`.
3. `/new` renders the welcome card immediately — no spinner.
4. User picks name + template + theme and clicks **Create** (the welcome
   screen has no Skip button; the header **X** still dismisses to a blank
   canvas).
5. Page mints a UUID, POSTs `/api/diagrams` with the seeded tab(s),
   then `window.location.assign('/diagram/<id>')` to land on
   the editor with the new diagram already on the server.
6. On the editor route, hydration extracts the id from the pathname
   and fetches the diagram + tab content. No mint, no welcome gate.

### Owner opens an existing diagram

1. Explorer list row click → `window.location.assign('/diagram/<id>')`.
2. Editor route hydrates as today. The welcome / templates / identity
   modes never load.

### Visitor follows a share link

1. URL is `/diagram/shared?s=<code>`.
2. Editor route hydrates via the existing `apiLoadShared` branch.
3. Visitor identity confirmation (the `identityOnlyScreenOpen` mini-flow)
   stays on the editor route — it's about the visitor, not the diagram.

### Empty tab on an existing diagram

1. User clears the active tab's content (or opens a tab that was
   created empty).
2. The existing `showTemplatePicker` (templates variant) modal
   shows on the editor route. Unchanged by this refactor.

### Diagram not found

1. URL is `/diagram/<id>` but the API returns 404.
2. NotFound surface renders as today, but its "Create new diagram"
   CTA now navigates to `/new`.

## State changes in `/live`

Removed from the editor route:

- `templatePickerMode = 'welcome'` and the `effectiveTemplatePickerMode`
  derivation.
- `welcomeOpen` (the chrome-hide trigger for the New Diagram modal).
- `commitDiagramId()` and every call site (`createShareLink`,
  `skipTemplatePicker`, `chooseTemplate`).
- The "no URL params" branch of hydration. If the pathname's id
  segment resolves to the build-time placeholder and no `?s=` code
  is set, the editor route redirects to `/new` (via
  `window.location.assign`) and renders the spinner until the
  navigation completes.

Kept on the editor route:

- The `templates` variant of the template picker (per-tab content
  scaffolding).
- The visitor identity confirmation modal (`identityOnlyScreenOpen`).
- Everything else: autosave, room, activity, tab management,
  diagram metadata, share dialog, etc.

## `/new` state

The new route owns:

- The participant-identity bootstrap (same `livediagram:v2:self-id`
  localStorage key, same `apiLoadSelf` / `apiSaveSelf` API).
- `templatePickerMode = 'welcome'` (only).
- The template + theme choice locally until the user commits.
- The "name confirmed" persistence (same
  `livediagram:v2:name-confirmed` localStorage key).
- On commit: mint a UUID, POST `/api/diagrams` with the
  templated tab(s) inline, navigate to `/diagram/<id>`.
- On skip / X: mint a UUID, POST an empty-tab diagram, navigate to
  `/diagram/<id>` so the user lands on the editor with a
  fresh diagram already persisted.

## Responsive layout

The TemplatePicker card (`apps/live/components/palette/TemplatePicker.tsx`) is the welcome / template / identity surface used by `/new` AND by per-tab template picks in the editor. On `sm:` and up it renders as a centred floating card (max 44rem for templates, 26rem for identity), with rounded corners + shadow over the canvas. On mobile (below `sm`) it fills the viewport edge-to-edge: full width, full dynamic-viewport height, no border / radius / shadow, so the user can read every row and click through without zoom. The footer's Create button (plus a Cancel button in the in-editor template / identity modes — the welcome screen drops it, leaving only Create and the header X) stays reachable because the body scrolls inside the card while the header + footer remain pinned (mobile and desktop alike).

This is the only welcome surface so it sets the mobile floor for the rest of the editor's panel chrome (Palette / Context / Explorer / Activity, see [07-live-app](07-live-app.md)). Those are addressed separately.

## Jump back in (recent diagrams card)

Returning users get a **"Jump back in" card** pinned to the right of the
centred wizard (desktop `xl+` only — below that the wizard owns the width):
the 5 most recently-saved diagrams they own, each row opening that diagram
directly, with a relative "saved N ago" line. It is a side affordance,
deliberately separate from the create flow, and hidden entirely for someone
with no diagrams yet (best-effort fetch — a failure just means no shortcut).
A footer link **"Open Explorer"** goes to `/explorer/recent`, the same list
uncapped, so users with more history than the card shows have a way into the
full library. Component: `apps/live/app/new/RecentDiagramsCard.tsx`.

## Shuffled template + theme order

The template and theme grids shuffle their order **once per open** of
the picker, so returning users keep meeting options they have not
explored instead of always seeing the same curated first rows.

- **Pinned defaults stay first.** Blank diagram (templates) and Brand
  (theme) are always pinned to index 0 — they are the sensible
  starting points, so they never get shuffled away. Everything else is
  randomised.
- **The first batch stays compact.** The grids still open to the same
  number of visible cards as the curated default set (8 templates, 12
  themes), with the rest behind "Show more". Shuffling changes _which_
  options fill those slots, not how many — so a template or theme that
  used to live behind "Show more" can now greet the user up front, and
  vice versa.
- **Stable within a session.** The shuffle is computed when the picker
  mounts and held for that open, so clicking around never reshuffles
  the grid underfoot. Re-opening the picker reshuffles.

Implementation: `lib/shuffle.ts` (`shufflePinned`, a pinned-first
Fisher-Yates) feeds `components/TemplatePicker.tsx`, which drives the
count-based mode of `hooks/useShowMoreList.ts`. The per-tab Current Tab
theme/pattern grids (`components/TabSection.tsx`) keep their stable,
flag-gated order — only the new-diagram / template picker shuffles.

## Two-step wizard

The welcome screen is a **two-step wizard** rather than one long page:

- **Step 1: Template.** The template browse (search, categories, drill-in).
  Footer: **Skip** and **Next**. Double-clicking a template card advances to
  step 2 (it does not commit the whole wizard, so the user still picks a theme).
- **Step 2: Theme.** The theme browse (below). Footer: **Back** (left arrow),
  **Skip**, and **Create Diagram**.
- A **two-segment progress rail** at the top shows the current step; clicking
  either segment ("1 Template" / "2 Theme") jumps straight to that step.
- **Skip** (either step) commits the documented defaults straight away: the
  **Blank** template and the **Basic** theme. (This is why the welcome screen now
  has a Skip control where it previously had none.) The header **X** still
  dismisses.
- A bottom-left **Open Existing Diagram** button navigates to `/explorer`. The
  `/new` route therefore does **not** render an Explorer panel of its own (it
  used to float one as the escape hatch); the button is the single, unambiguous
  way out, which is less confusing.
- The **Create Diagram** button shows an inline spinner and disables while the
  create POST is in flight (`busy` prop, fed from the page's `submitting`
  state), so a slow network gives feedback and can't double-submit.

The wizard renders **immediately** with no identity spinner: step 1 is static
template data, so there's nothing to wait for. Identity resolves in the
background and the picker is keyed on the resolved id so the participant name
isn't the placeholder. (The template-order shuffle moved to a mount effect, off
the lazy `useState` initializer, so the statically-prerendered HTML matches
hydration.)

The in-editor template flow — titled **Quick Start** — uses the **same two-step
wizard**, with mode-appropriate controls: its far-left escape is **Cancel** (not
Open Existing), it has no Skip, and its primary action is **Apply** (not Create
Diagram). Only the visitor identity prompt stays a single-section, non-wizard
surface.

**Quick Start opens only on an explicit request** — adding a tab
(`useTabActions.addTab`) or the empty-canvas banner's **Quick Start** button,
both of which set `templatePickerMode='templates'` (`templateGridOpen`). It no
longer auto-opens just because a tab has no elements, so a freshly-created
(truly blank) diagram lands on the canvas rather than behind the picker.

The **empty-canvas hint** is a subdued **bottom banner** (`EmptyCanvasBanner`),
shown while the active tab has no elements — not the old centre-of-canvas card,
which read as a half-finished modal. It is **not dismissible** (it simply goes
away once the canvas has content). It shares the bottom-banner slot with the
sign-in / theme banners (yielding to the sign-in one) and hides while a draw
tool is armed or Quick Start is open. Editors get a **Quick Start** button on
it; viewers get a passive "nothing here yet" line.

A soft, decorative **animated backdrop** (`AnimatedLinesBackdrop`) sits behind
the card: thick multi-colour curved lines that slowly flow along their paths via
animated `stroke-dashoffset`. It is pure SVG + CSS (no per-frame JS),
`pointer-events-none` / `aria-hidden`, and stands down under
`prefers-reduced-motion`.

## Custom themes in the picker

The theme step shows the owner's **custom themes** ([spec/44](44-custom-themes.md))
as a **Custom** category in the browse, alongside the built-in colour categories.
Its drill-in lists the saved themes (apply / edit / delete) plus a **+ New theme**
card that opens the builder in place. This is the same `CustomThemePicker` the
right-click Tab Appearance dialog renders, so the two surfaces (and the
create/edit flow) stay identical. The `/new` route mounts a `CustomThemeProvider`
so the saved themes load here. The chosen theme (built-in or `custom:<uuid>`)
flows through the unchanged create path; the theme-id types along it (`onPick`,
`commitNewDiagram`, `buildTemplatedTab`) are `string` rather than `ThemeId` to
carry the custom id.

Inside a category drill-in, each built-in theme card shows a short **description**
under its label (now that the theme step has room), sourced from an exhaustive
`Record<ThemeId, string>` (`themeDescription`) so the compiler forces every theme
to carry one. Custom theme cards show just the saved name.

## API impact

- No new endpoints. `POST /api/diagrams` already accepts an
  optional `tabs` array per spec/13 — the new route uses it.

## Tests / sanity-check checklist

- `/live` with no params → redirects to `/new`, no flash.
- `/new` → welcome card on first paint.
- Pick template → Create → editor loads on `/diagram/<id>`.
- Dismiss welcome via the header X → editor loads on `/diagram/<id>`
  with an empty starter tab (the welcome screen has no Skip button).
- `/diagram/<id>` (existing) → editor hydrates as before.
- `/diagram/shared?s=<code>` (visitor) → editor + identity-confirm modal.
- NotFound CTA → goes to `/new`.
- "New Diagram" from Explorer → goes to `/new`.

## Out of scope for V1

- Animations for the route transition. A spinner is fine.
- A dedicated `/new` landing-page mode for unauthenticated
  users. Auth lands in a future spec.
