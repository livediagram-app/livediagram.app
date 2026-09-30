# Dedicated route for new-document creation

Split the welcome / template-picker flow off the editor into its own
route at `/new`. The editor route is editor-only; `/new` handles "I
want to create a document" end-to-end.

> **Routing note (later change, [Router app](../016-platform/router-app.md)):** the `/live` URL prefix was
> removed — the live app serves at clean routes. So today the editor is
> `/document/<id>` (not `/live/document/<id>`), `/new` is `/new`, and
> there is no bare `/live` entry point (`/` is the marketing home). The
> historical `/live...` URLs below describe the pre-cleanup scheme; map
> each to its `/live`-stripped form. The placeholder-rewrite mechanism
> and the `/new` split itself are unchanged.

## Motivation

`/live` currently serves two distinct experiences from one component:

1. **Editor** — `/live?d=<id>` (owner) or `/live?s=<code>` (visitor).
   State: load document, autosave, room broadcast, activity log, etc.
2. **Welcome / Create new** — `/live` with no params. State:
   `templatePickerMode`, `welcomeOpen`, `loadedExistingDocument`,
   `nameConfirmed`, and the `commitDocumentId()` flow that mints a
   UUID + rewrites the URL via `history.replaceState`.

The overlap is the source of recurring state bugs:

- The "Empty Canvas" flash on `New Document` clicks (multiple
  iterations to land cleanly).
- `templatePickerMode = 'welcome'` showing on existing-document tabs.
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
- "New Document" buttons (Explorer + NotFound CTA) navigate to
  `/new`. Existing share / open flows stay on `/live`.

## Non-goals

- Changing the visitor `?s=<code>` flow. Visitors still land on
  `/document/shared?s=<code>` and confirm their name there —
  the `identityOnlyScreenOpen` mini-flow stays in the editor route
  because it's about the visitor's session, not about creating a
  new document.
- Splitting the per-tab "Pick a template" flow (the templates
  variant of the existing picker that fires when you open an empty
  tab on an existing document). That stays in `/live` because the
  document is already loaded.
- Changing what gets persisted at "Submit" time. The new route
  still POSTs `/api/documents` with the chosen template tab seeded,
  same as the current `commitDocumentId()` path.

## Route map

| Route                   | Purpose                               | State                                                                                                                   |
| ----------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `/live`                 | Bare entry point                      | Redirect → `/new` (or `/document/shared?s=<code>` if a legacy visitor query is present). Renders nothing else.          |
| `/document/<id>`        | Editor for an existing owned document | Static placeholder file fronts every id (see "Path scheme" below). Client reads the id from `window.location.pathname`. |
| `/document/shared?s=<>` | Visitor view of a shared document     | Same placeholder file. Client reads the share code from the `s` query param.                                            |
| `/new`                  | Welcome / create-new flow             | Identity, template, theme picker. POSTs the document + navigates to `/document/<id>`.                                   |

## Path scheme

Editor URLs use a path segment rather than a query string. `output:
'export'` can't enumerate user-minted UUIDs at build time, so:

1. Next.js builds a single placeholder at `out/document/placeholder/index.html`
   via `generateStaticParams = [{ id: 'placeholder' }]` on the
   dynamic-segment server page. The page wraps a client `EditorPage`
   component that owns the editor logic.
2. The live worker (`apps/live/src/worker.ts`) wraps the static-assets
   binding and rewrites any `/document/<anything>` request to
   `/document/placeholder/`. The browser URL stays `/document/<id>`.
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
enumerated id, so every real document URL triggers `notFound()` the
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
about), and loads the document via the API. The address bar stays
on `/document/<uuid>`; nothing about the URL needs to lie.

Behaviour for genuinely-unknown routes (e.g. `/live/typo`) is
benign: the editor mounts, tries to load a document with id `typo`,
the API 404s, the in-app `<NotFound>` card surfaces — branded with
a "Create a new document" CTA.

### A failed load is not a missing document

NotFound means "this document doesn't exist, or isn't yours". A load
that FAILS — network down, 5xx, share link unresolvable — means
nothing of the sort, and showing NotFound for it tells someone their
work is gone when the server is merely unreachable. So the two are
kept apart: only a clean 404 reaches NotFound, and a thrown request
raises `loadError`, which renders `components/chrome/ApiErrorPage.tsx`
instead. That card leads with **Retry** (a reload), because unlike a
missing document the condition is expected to clear on its own. The
same card serves the failed-create path on `/new`.

The distinction is made at every call site that can fail this way —
the document load and the share-link resolve in `useIdentityBootstrap`,
and the create in `/new` — rather than in one place, so it is worth
knowing about when adding another.

## Navigation flows

### Owner creates a new document

1. User clicks **New Document** in the Explorer (or lands on `/live`).
2. Browser navigates to `/new`.
3. `/new` renders the welcome card immediately — no spinner.
4. User picks name + template + theme and clicks **Create** (the welcome
   screen has no Skip button; the header **X** still dismisses to a blank
   canvas).
5. Page mints a UUID, POSTs `/api/documents` with the seeded tab(s),
   then `window.location.assign('/document/<id>')` to land on
   the editor with the new document already on the server.
6. On the editor route, hydration extracts the id from the pathname
   and fetches the document + tab content. No mint, no welcome gate.

### Owner opens an existing document

1. Explorer list row click → `window.location.assign('/document/<id>')`.
2. Editor route hydrates as today. The welcome / templates / identity
   modes never load.

### Visitor follows a share link

1. URL is `/document/shared?s=<code>`.
2. Editor route hydrates via the existing `apiLoadShared` branch.
3. Visitor identity confirmation (the `identityOnlyScreenOpen` mini-flow)
   stays on the editor route — it's about the visitor, not the document.

### Empty tab on an existing document

1. User clears the active tab's content (or opens a tab that was
   created empty).
2. The existing `showTemplatePicker` (templates variant) modal
   shows on the editor route. Unchanged by this refactor.

### Document not found

1. URL is `/document/<id>` but the API returns 404.
2. NotFound surface renders as today, but its "Create new document"
   CTA now navigates to `/new`.

## State changes in `/live`

Removed from the editor route:

- `templatePickerMode = 'welcome'` and the `effectiveTemplatePickerMode`
  derivation.
- `welcomeOpen` (the chrome-hide trigger for the New Document modal).
- `commitDocumentId()` and every call site (`createShareLink`,
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
  document metadata, share dialog, etc.

## `/new` state

The new route owns:

- The participant-identity bootstrap (same `livediagram:v2:self-id`
  localStorage key, same `apiLoadSelf` / `apiSaveSelf` API).
- `templatePickerMode = 'welcome'` (only).
- The template + theme choice locally until the user commits.
- The "name confirmed" persistence (same
  `livediagram:v2:name-confirmed` localStorage key).
- On commit: mint a UUID, POST `/api/documents` with the
  templated tab(s) inline, navigate to `/document/<id>`.
- On skip / X: mint a UUID, POST an empty-tab document, navigate to
  `/document/<id>` so the user lands on the editor with a
  fresh document already persisted.

## Responsive layout

The TemplatePicker card (`apps/live/components/palette/TemplatePicker.tsx`) is the welcome / template / identity surface used by `/new` AND by per-tab template picks in the editor. On `sm:` and up it renders as a centred floating card (max 44rem for templates, 26rem for identity), with rounded corners + shadow over the canvas. On mobile (below `sm`) it fills the viewport edge-to-edge: full width, full dynamic-viewport height, no border / radius / shadow, so the user can read every row and click through without zoom. The footer's Create button (plus a Cancel button in the in-editor template / identity modes — the welcome screen drops it, leaving only Create and the header X) stays reachable because the body scrolls inside the card while the header + footer remain pinned (mobile and desktop alike).

The card has no backdrop, so the editor header stays live beside it. It stacks on the `canvas-modal` rung: above every canvas surface, beneath the header, so the header's menus (the apps menu, the account menu) open in front of the card rather than behind it.

This is the only welcome surface so it sets the mobile floor for the rest of the editor's panel chrome (Palette / Context / Explorer / Activity, see [07-live-app](live-app.md)). Those are addressed separately.

## Jump back in (recent documents card)

Returning users get a **"Jump back in" card** pinned to the right of the
centred wizard (desktop `xl+` only — below that the wizard owns the width):
the 5 most recently-saved documents they own, each row opening that document
directly, with a relative "saved N ago" line. It is a side affordance,
deliberately separate from the create flow, and hidden entirely for someone
with no documents yet (best-effort fetch — a failure just means no shortcut).
A footer link **"Open Explorer"** goes to `/explorer/recent`, the same list
uncapped, so users with more history than the card shows have a way into the
full library. Component: `apps/live/app/new/RecentDocumentsCard.tsx`.

## Shuffled template + theme order

The template and theme grids shuffle their order **once per open** of
the picker, so returning users keep meeting options they have not
explored instead of always seeing the same curated first rows.

- **Pinned defaults stay first.** Blank Canvas (templates) and the
  `brand` scheme, labelled "Default" (theme), are always pinned to index
  0 — they are the sensible starting points, so they never get
  shuffled away. Everything else is randomised.
- **The shuffle sets the order, not what is visible.** Both grids
  browse by category now ([Canvas and palette](../008-canvas/canvas-and-palette.md)), so the
  whole catalogue is reachable and nothing hides behind a "Show more"
  toggle. Shuffling decides which options lead a category and the
  search results, and the pinned default still opens the list.
  ("Show more" survives only in the Tab Look & Feel dialog's
  background-pattern picker, the one caller `useShowMoreList` still
  has.)
- **Stable within a session.** The shuffle is computed when the picker
  mounts and held for that open, so clicking around never reshuffles
  the grid underfoot. Re-opening the picker reshuffles.

Implementation: `lib/shuffle.ts` (`shufflePinned`, a pinned-first
Fisher-Yates) feeds `components/palette/TemplatePicker.tsx`, which drives the
count-based mode of `hooks/ui/useShowMoreList.ts`. The theme and pattern
grids keep their stable, flag-gated order wherever they render (the
theme browse of `components/palette/ThemeCategoryBrowser.tsx`, shared
with the right-click Theme dialog per [42](../011-theme/canvas-and-theme-dialog.md),
and the pattern controls in `components/palette/palette-controls.tsx`)
— only the new-document / template picker shuffles.

## Two-step wizard

The welcome screen is a **two-step wizard** rather than one long page:

- **Step 1: Template.** The template browse (search, one open category's carousel, the other categories folded as tiles beneath it).
  Footer: **Skip** and **Next**. Clicking a template card advances to step 2.
- **Step 2: Location.** Where the document lives (the Settings step in code:
  name, save location, placement). Footer: **Create**.
- **There is no theme step.** A new document starts on the **Default** theme,
  and the Theme and canvas controls change it later; asking for a theme before
  anything is on the canvas was a decision most people could not yet make. (It
  was step 2 of three, with a two-level theme browse and the custom-theme
  builder; retired.)
- A **two-segment progress rail** at the top shows the current step; clicking
  either segment ("1 Template" / "2 Location") jumps straight to that step.
  The step number and each category card's template-count badge centre the
  digit's ink in their circle / pill (`text-optical-centre`,
  [Optical alignment](../004-interface-design/optical-alignment.md)), in both
  appearances: a digit centred by its line box sits visibly high. The current
  step sits in a soft pill whose round cap is concentric with the step circle:
  4px from the circle to the pill's left edge, the same as top and bottom
  ([Colour scheme](../004-interface-design/color-scheme.md#usage-rules)). The
  rail's first circle lines up with the dialog heading.
- **Skip** (on the template step) commits the documented defaults straight away: the
  **Blank** template and the **Default** theme. (This is why the welcome screen now
  has a Skip control where it previously had none.) The header **X** still
  dismisses.
- A bottom-left **Open Existing Document** button navigates to `/explorer`. The
  `/new` route therefore does **not** render an Explorer panel of its own (it
  used to float one as the escape hatch); the button is the single, unambiguous
  way out, which is less confusing.
- The **Create Document** button shows an inline spinner and disables while the
  create POST is in flight (`busy` prop, fed from the page's `submitting`
  state), so a slow network gives feedback and can't double-submit.

The wizard renders **immediately** with no identity spinner: step 1 is static
template data, so there's nothing to wait for. Identity resolves in the
background and the picker is keyed on the resolved id so the participant name
isn't the placeholder. (The template-order shuffle moved to a mount effect, off
the lazy `useState` initializer, so the statically-prerendered HTML matches
hydration.)

The in-editor template flow — titled **Quick Start** — is a **single page**: the
same template browse, no step rail, and picking a template applies it straight
away, keeping the tab's current theme (a new tab carries its source tab's). Its
footer is **Cancel** and **Apply** (which applies the selected card). The visitor
identity prompt is the other single-section surface.

**Quick Start opens only on an explicit request** — adding a tab
(`useTabActions.addTab`) or the empty-canvas banner's **Quick Start** button,
both of which set `templatePickerMode='templates'` (`templateGridOpen`). It no
longer auto-opens just because a tab has no elements, so a freshly-created
(truly blank) document lands on the canvas rather than behind the picker.

**Quick Start belongs to the tab it was opened on, and closes if you leave
it.** Applying a template REPLACES the active tab's elements, and both entry
points above only fire for an empty tab — so the picker must not outlive that
tab. It used to: adding Tab 2 opened the picker, switching back to Tab 1 left
it open, and confirming a template there wiped Tab 1's work. `useTemplateFlow`
records the tab the picker opened on and dismisses the picker when the active
tab changes (a ref, not an activeId diff — `addTab` switches tab and opens the
picker in one commit, which a naive diff would close immediately).
`chooseTemplate` carries the matching backstop: a confirm that would land on a
tab with elements dismisses the picker and writes nothing.

**Quick Start closes when you reach past it.** It is a panel over the canvas,
not a blocking modal: the palette, the Explorer, the bottom toolbars and the
canvas stay live around it, and what they open or add would land hidden behind
it. So a press anywhere outside the card (the shared `useClickOutside`) closes
it exactly as Cancel does, and the press still reaches what it landed on (a
palette tool arms as normal). Presses inside the card, including its search
and carousel, keep it open. The first-run welcome and the name prompt ask for
an answer and never close this way.

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

## Just Draw (skip the wizard)

Some users don't want a template, a theme, or a settings step — they want
an empty canvas right now. Two affordances serve them, both committing the
documented Skip defaults (Blank template, Default theme, the template's
default document name) without walking the wizard:

- **`/new?blank=1`** — the query param bypasses the wizard entirely. The
  page renders the opening screen (below) at its "Creating your document"
  stage instead of the wizard, commits the blank document as soon as
  identity resolves, and hands off to the editor in place (below). Any
  truthy presence of `blank` counts.
  The placement context params compose with it
  (`/new?blank=1&folder=<id>`, `/new?blank=1&team=<id>`), so a caller can
  Just Draw straight into a folder or team library. A failed create shows
  the same retryable error card as the wizard path. This is the URL that
  outside surfaces link to (the marketing header + hero "Just Draw"
  buttons, see [Marketing site](../019-marketing/marketing-site.md)).
  - The handoff replaces the `/new?blank=1` history entry with
    `/document/<id>`, so Back from the editor returns to the page before
    `/new` (usually the marketing site), never to a page that would mint
    another blank document. Should the browser still restore a bypass
    `/new` from the back/forward cache before the handoff happened, it
    redirects to the plain `/new` wizard rather than silently minting
    another blank document or trapping the user behind a page that always
    navigates forward again.
  - The interactive tour's welcome offer ([Interactive editor tour ("Show me around")](editor-tour.md)) is not queued on
    this path: the create fires before the document count resolves, and a
    "just draw" user has asked to get straight to the canvas. The hero's
    `?welcome=1` variant (below) is the one exception.
  - **The wizard must never paint on this path, not even for a frame.**
    `/new` is a static export, so its prerendered HTML is the wizard and
    the query param is only knowable in the browser. A React-side check
    alone runs after hydration — the static wizard HTML would flash first
    (and a window-reading state initializer would additionally make the
    hydration render disagree with the server HTML). So the page ships a
    tiny inline script ahead of the wizard markup that reads
    `location.search` **before first paint** and flags
    `<html data-just-draw>`; a matching style rule hides the wizard-only
    content under that flag, and React then swaps in the opening screen at
    hydration (detected pre-paint in a layout effect, so the trees always
    match).
- **`/new?template=<kind>`** — the same bypass for a named template: the
  page commits that template (Default theme, the template's default name)
  the moment identity resolves and lands on the editor, with the same
  opening screen, in-place handoff, bfcache-restore redirect, placement params and error card
  as `?blank=1`. `blank` wins when both are present. An unknown kind is
  ignored and the plain wizard shows (the pre-hydration guard can't
  validate a kind, so the layout effect lifts it), so a stale link never
  strands anyone. Both params are read by one helper,
  `wizardBypassKind` in `apps/live/lib/new-document-params.ts`, so the
  page, its restore cleanup and the guard agree on what counts. This is
  the URL the marketing site's template gallery links every card to
  ([Marketing site](../019-marketing/marketing-site.md)); it fires `UI / Used / TemplateLink`.
- **`/new?blank=1&welcome=1`**: Just Draw from the marketing hero's **launch
  window** ([Marketing site](../019-marketing/marketing-site.md)), which grows
  into a full-screen blank canvas before navigating here. It commits the blank
  document exactly as `?blank=1` does, with two differences:
  - **A quiet landing.** Nothing but that blank canvas shows from the page's
    first frame until the editor has loaded over it: the Default scheme's
    paper and dots, in place of the opening screen below. A pre-paint guard in
    the root layout's `<head>` (`lib/quiet-landing-boot.ts`, in the head
    because the body can paint before a script inside it has run) flags
    `<html>`, hides the body and paints the canvas on `<html>` itself; `/new`
    then renders the same canvas (`BlankCanvasScreen`) and lifts the flag.
    Across the handoff a `sessionStorage` flag (`lib/quiet-landing.ts`,
    written just before it, as the tour flag is) makes the editor's own waits
    (the editor chunk loading, then the document) hold that canvas too
    (`OpeningScreen`); the editor clears the flag once the document has
    loaded, so a later load in the tab shows the usual opening screen.
  - **The welcome offer.** The tour's welcome offer
    ([Interactive editor tour ("Show me around")](editor-tour.md)) is queued,
    though the create fires before the document count is known: whoever
    clicks the hero's canvas is most likely new, and the synced `tourSeen`
    gate keeps the offer from anyone who has already answered it.
    Quick Start does not open; the visitor asked for a canvas. `welcome` alone
    (no `blank`) does nothing, and the bfcache restore strips it with the bypass
    params.
- **`/new?via=<Surface>.<Slot>`**: the landing funnel's source
  ([Landing funnel](../019-marketing/landing-funnel.md)), added by a public page's CTA and
  combinable with every param above. `useCtaAttribution` reads it once,
  sends `Cta / Opened / <source>`, and strips it from the address bar with
  `history.replaceState` (keeping the other params), so a reload or Back
  can't count the arrival twice. Whichever path commits the document (Create,
  Skip or a bypass) then sends `Cta / Created / <source>`, once. An unknown
  source is stripped and ignored.
- **No "Just Draw" button inside the wizard.** It used to sit on the step
  rail; the footer's **Skip** already commits the same blank defaults, and
  Just Draw now lives only on the outside surfaces that link to
  `/new?blank=1`.

### In-place handoff to the editor

Every commit from `/new` (Create, Skip, and both bypass URLs)
opens the editor **without a page load**. Once the document is persisted and
placed, the page rewrites the address bar to `/document/<id>` with
`history.replaceState` and renders the editor component (`EditorPage`, the
same component `/document/<id>` and the not-found slot render) in its own
place. The editor reads the id from `window.location.pathname` on mount, so
it cannot tell the difference from a direct visit.

- **Why:** a hard navigation paid for a second full page load: the editor's
  document, a second Clerk settle, a second identity round trip, and a
  second, visually different loading screen after "Creating…". The in-place
  swap keeps the one Clerk session, the one document, and one continuous
  opening screen.
- **The editor code is fetched ahead.** `/new` starts loading the editor's
  chunk as soon as it mounts (a bypass needs it within a second; a wizard
  visitor almost always goes on to create), so the chunk downloads in
  parallel with identity and the create request. If it is not ready at
  handoff, the opening screen holds at the "Opening your document" stage
  until it is.
- **The opening screen is the editor's outermost Suspense fallback, so no lazy
  piece inside the editor may suspend up to it.** Every `next/dynamic` import
  in the live app passes `ssr: false` (or a `loading` component), which gives
  it a boundary of its own; without one, the first open of Settings or Search
  swapped the whole editor for the opening screen until the dialog's chunk
  landed. `lib/dynamic-has-boundary.test.ts` guards it.
- **`replaceState`, not `pushState`:** `/new` is a one-shot creator, so the
  editor URL takes its history entry. Reload and Back behave exactly as they
  do after a direct `/document/<id>` visit.
- **Nothing crosses the handoff but the URL and `sessionStorage`.** The
  tour's pending flag (`markTourPending`) is written before the swap and
  read by the editor on mount, as it was across the hard navigation.
- A failed create never hands off: the retryable error card shows instead.

### The opening screen

One screen covers the whole wait from the click to the editor: `/new`'s
creating stage and the editor's own load (`DocumentLoading`) render the same
full-screen component, so the handoff above never visibly changes screens.
Its label moves from **"Creating your document"** to **"Opening your
document"**; everything else stays put.

- **Surface:** headerless and full height, on the canvas colour
  (`slate-50` / `slate-950`) with the editor's dot grid faded out towards the
  edges and two slowly drifting, blurred brand-tinted glows behind the
  centre. Dark-aware like every screen ([Live app](live-app.md)).
- **Centrepiece:** the shared `DiagramBuildAnimation`, a small live diagram
  being drawn by a collaborator cursor labelled "You": the cursor places a
  card, drags a connector that draws under it to the next card, and so on
  until three cards are wired; a pulse of light then runs along each
  connector before the whole diagram dissolves and the loop restarts. The
  cards are white (dark: slate) with a coloured accent each, and the
  connectors blend from their source colour to their target colour.
- **Continuity:** the loop's phase is measured from the first time the
  animation mounts in the document, so a remount (the creating stage giving
  way to the editor's load) continues the drawing where it was instead of
  restarting it.
- **Progress:** the label sits under the animation with a slim indeterminate
  bar below it. After 10 seconds in the editor's load the screen adds
  "This is taking longer than usual." with a Refresh button.
- **Reduced motion:** the drawing sits finished, the cursor, pulses, glows
  and bar are still.
- `DiagramBuildAnimation` stays a bare illustration (no surface of its own),
  so the sso-callback and OAuth consent cards keep composing it inside their
  own card.

Skip and the `?blank=1` bypass honour the URL placement context (the `?folder` /
`?team` pre-seed): the blank document files where the Settings step's
picker would have defaulted, not silently into personal Unsorted.

Telemetry: the Just Draw bypass (`/new?blank=1`) fires `UI / Used / JustDraw` alongside
the usual `Document / Created` event, so wizard-bypass adoption is
measurable ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).

## Custom themes

With the theme step retired, the picker no longer shows themes at all. Custom
themes ([Custom themes](../011-theme/custom-themes.md)) are applied and built from
the Tab Look & Feel dialog, which renders the same `CustomThemePicker` the theme
step used. The create path still carries a theme id (`onPick`,
`commitNewDocument`, `buildTemplatedTab` take a `string`, so a `custom:<uuid>`
passes through), now always the caller's: `brand` on `/new`, the source tab's
theme for a new tab.

## API impact

- No new endpoints. `POST /api/documents` already accepts an
  optional `tabs` array per [Per-tab storage](../006-document/per-tab-storage.md) — the new route uses it.

## Tests / sanity-check checklist

- `/live` with no params → redirects to `/new`, no flash.
- `/new` → welcome card on first paint.
- Pick template → Create → editor loads on `/document/<id>`.
- Dismiss welcome via the header X → editor loads on `/document/<id>`
  with an empty starter tab (the welcome screen has no Skip button).
- `/document/<id>` (existing) → editor hydrates as before.
- `/document/shared?s=<code>` (visitor) → editor + identity-confirm modal.
- NotFound CTA → goes to `/new`.
- "New Document" from Explorer → goes to `/new`.
- `/new?blank=1` → no wizard; blank document created and editor loads on
  `/document/<id>`.
- `/new?blank=1&folder=<id>` → the blank document files into that folder.
- `/new?template=kanban` → no wizard; a Kanban diagram created and the
  editor loads on `/document/<id>`.
- `/new?template=not-a-kind` → the plain wizard.

## Out of scope for V1

- Animations for the route transition. A spinner is fine.
- A dedicated `/new` landing-page mode for unauthenticated
  users. Auth lands in a future spec.
