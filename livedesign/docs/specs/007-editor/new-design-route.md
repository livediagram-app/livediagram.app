# Dedicated route for new-design creation

Split the welcome / template-picker flow off the editor into its own
route at `/new`. The editor route is editor-only; `/new` handles "I
want to create a design" end-to-end.

> **Routing note (later change, [Router app](../016-platform/router-app.md)):** the `/live` URL prefix was
> removed — the live app serves at clean routes. So today the editor is
> `/design/<id>` (not `/live/design/<id>`), `/new` is `/new`, and
> there is no bare `/live` entry point (`/` is the marketing home). The
> historical `/live...` URLs below describe the pre-cleanup scheme; map
> each to its `/live`-stripped form. The placeholder-rewrite mechanism
> and the `/new` split itself are unchanged.

## Motivation

`/live` currently serves two distinct experiences from one component:

1. **Editor** — `/live?d=<id>` (owner) or `/live?s=<code>` (visitor).
   State: load design, autosave, room broadcast, etc.
2. **Welcome / Create new** — `/live` with no params. State:
   `templatePickerMode`, `welcomeOpen`, `loadedExistingDesign`,
   `nameConfirmed`, and the `commitDesignId()` flow that mints a
   UUID + rewrites the URL via `history.replaceState`.

The overlap is the source of recurring state bugs:

- The "Empty Canvas" flash on `New Design` clicks (multiple
  iterations to land cleanly).
- `templatePickerMode = 'welcome'` showing on existing-design tabs.
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
- "New Design" buttons (Explorer + NotFound CTA) navigate to
  `/new`. Existing share / open flows stay on `/live`.

## Non-goals

- Changing the visitor `?s=<code>` flow. Visitors still land on
  `/design/shared?s=<code>` and confirm their name there —
  the `identityOnlyScreenOpen` mini-flow stays in the editor route
  because it's about the visitor's session, not about creating a
  new design.
- Splitting the per-tab "Pick a template" flow (the templates
  variant of the existing picker that fires when you open an empty
  tab on an existing design). That stays in `/live` because the
  design is already loaded.
- Changing what gets persisted at "Submit" time. The new route
  still POSTs `/api/designs` with the chosen template tab seeded,
  same as the current `commitDesignId()` path.

## Route map

| Route                 | Purpose                             | State                                                                                                                   |
| --------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `/live`               | Bare entry point                    | Redirect → `/new` (or `/design/shared?s=<code>` if a legacy visitor query is present). Renders nothing else.            |
| `/design/<id>`        | Editor for an existing owned design | Static placeholder file fronts every id (see "Path scheme" below). Client reads the id from `window.location.pathname`. |
| `/design/shared?s=<>` | Visitor view of a shared design     | Same placeholder file. Client reads the share code from the `s` query param.                                            |
| `/new`                | Welcome / create-new flow           | Identity, template, theme picker. POSTs the design + navigates to `/design/<id>`.                                       |

## Path scheme

Editor URLs use a path segment rather than a query string. `output:
'export'` can't enumerate user-minted UUIDs at build time, so:

1. Next.js builds a single placeholder at `out/design/placeholder/index.html`
   via `generateStaticParams = [{ id: 'placeholder' }]` on the
   dynamic-segment server page. The page wraps a client `EditorPage`
   component that owns the editor logic.
2. The live worker (`apps/live/src/worker.ts`) wraps the static-assets
   binding and rewrites any `/design/<anything>` request to
   `/design/placeholder/`. The browser URL stays `/design/<id>`.
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
enumerated id, so every real design URL triggers `notFound()` the
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
about), and loads the design via the API. The address bar stays
on `/design/<uuid>`; nothing about the URL needs to lie.

### Unknown addresses

A genuinely unknown address (a mistyped page, `/explorer/mine`, or a page an
older build had) reaches the editor through the same slot. It names no
design (`designIdFromPath` reads no id off anything but
`/design/<id>`) and carries no share link, so the editor shows the in-app
`<NotFound>` card at once, titled **Page not found**
("There is no page at this address. Open a design from the Explorer or
start fresh.") with its **Open Explorer** and **New Design** buttons, and asks
the API for nothing. A design that is missing or not yours gets the same card
titled **Design not found**. The card stands alone under the app header, with
no Explorer panel beside it: its buttons are the way on (Open Explorer goes to
`/explorer`, New Design to `/new`). An embed shows the card with New Design
only, opening the app in a new tab. Only the editor's own empty route (`/design`,
`/design/placeholder`) hands off to `/new`. Before, every address without a
design id went to `/new`, so a mistyped or retired page made a new
design with no word of what went wrong.

### A failed load is not a missing design

NotFound means "this design doesn't exist, or isn't yours". A load
that FAILS — network down, 5xx, share link unresolvable — means
nothing of the sort, and showing NotFound for it tells someone their
work is gone when the server is merely unreachable. So the two are
kept apart: only a clean 404 reaches NotFound, and a thrown request
raises `loadError`, which renders `components/chrome/ApiErrorPage.tsx`
instead. That card leads with **Retry** (a reload), because unlike a
missing design the condition is expected to clear on its own. The
same card serves the failed-create path on `/new`, with one exception: a
create refused for its **placement** (`team_forbidden`, `folder_not_found`,
`folder_scope_mismatch`, `placement_invalid`, see
[Folders → Placement on create](../013-workspace/folders.md#placement-on-create)) will not clear on
a retry, so the card says why and offers **Choose another place** instead.
On `/new`, **Retry** re-runs the same create under the same design and tab
ids it first tried: a create that reached the server but whose answer was lost
is then taken as the re-commit of an id the caller already owns, never a second
design.

The distinction is made at every call site that can fail this way —
the design load and the share-link resolve in `useIdentityBootstrap`,
and the create in `/new` — rather than in one place, so it is worth
knowing about when adding another.

## Navigation flows

### Owner creates a new design

1. User clicks **New Design** in the Explorer (or lands on `/live`).
2. Browser navigates to `/new`.
3. `/new` asks nothing: it shows the opening screen at its "Creating your design" stage and makes the
   design at once, where new designs go by default ([What `/new` makes](#what-new-makes)).
4. Page mints a UUID, POSTs `/api/designs` with the seeded tab(s), then hands the design to the editor in place
   ([In-place handoff to the editor](#in-place-handoff-to-the-editor)).
5. On the editor route, hydration extracts the id from the pathname and fetches the design + tab content. No
   mint, no welcome gate. The empty tab opens on its start, where the Pages templates are
   ([Template start](start-diagramming.md)).

### Owner opens an existing design

1. Explorer list row click → `window.location.assign('/design/<id>')`.
2. Editor route hydrates as today. The create flow and identity modes never load.

### Visitor follows a share link

1. URL is `/design/shared?s=<code>`.
2. Editor route hydrates via the existing `apiLoadShared` branch.
3. Visitor identity confirmation (the `identityOnlyScreenOpen` mini-flow)
   stays on the editor route — it's about the visitor, not the design.

### Empty tab on an existing design

1. User clears the active tab's content (or opens a tab that was
   created empty).
2. An Editor sees Start Making Pages in the middle of the canvas ([Template start](start-diagramming.md));
   a Participant or Viewer the empty-canvas card ([The empty-canvas hint](#the-empty-canvas-hint)).

### Design not found

1. URL is `/design/<id>` but the API returns 404.
2. NotFound surface renders as today, but its "Create new design"
   CTA now navigates to `/new`.

## State changes in `/live`

Removed from the editor route:

- `templatePickerMode = 'welcome'` and the `effectiveTemplatePickerMode`
  derivation.
- `welcomeOpen` (the chrome-hide trigger for the New Design modal).
- `commitDesignId()` and every call site (`createShareLink`,
  `skipTemplatePicker`, `chooseTemplate`).
- The "no URL params" branch of hydration. If the pathname's id
  segment resolves to the build-time placeholder and no `?s=` code
  is set, the editor route redirects to `/new` (via
  `window.location.assign`) and renders the spinner until the
  navigation completes.

Kept on the editor route:

- The visitor identity confirmation modal (`IdentityPrompt`, open while `identityPromptOpen`; its chrome flag
  `identityOnlyScreenOpen`). There is no template picker over the editor: an empty tab's templates are on its start.
- Everything else: autosave, room, tab management,
  design metadata, share dialog, etc.

## `/new` state

The new route owns:

- The participant-identity bootstrap (the same guest token under
  `livedesign:v2:guest-token`, same `apiLoadSelf` / `apiSaveSelf` API).
- The "name confirmed" persistence (same
  `livedesign:v2:name-confirmed` localStorage key).
- The create: mint a UUID, POST `/api/designs` with the
  templated tab(s) inline (or one empty tab), and hand off to the editor.

A back/forward-cache restore of `/new` never re-creates: `/new` creates as it mounts, so a restore backs out to
the page that opened it (`history.back()` when the browser came from another page of this site, else the home
page), logging `[new] restored, back out <target>`.

## What `/new` makes

`/new` asks no question: there is one editor mode, Pages, so it makes the design as it mounts
(`apps/live/app/new/page.tsx`, the URL read by `apps/live/lib/new-design-params.ts`):

- **Which design:** the template `?template=<kind>` names (`newDesignKind`), a blank for `?blank=1`, else one
  empty tab that opens on its start (Start Making Pages). An unknown template kind is ignored rather than guessed,
  so a stale link makes a design, not a 404; a retired kind opens its replacement.
- **Stored** where [Save Locations → The default depends on who is creating](../006-design/save-locations.md#the-default-depends-on-who-is-creating)
  says: This Browser for a guest, livedesign for a signed-in person. Decided at commit by
  `resolveSaveLocation` (`app/new/useNewDesignLocation.ts`): a guest never waits, a browser that looks signed in
  waits for identity, so a signed-in person is never handed a design in This Browser. A guest's This Browser
  design is created without waiting for identity at all ([Offline Mode → Instant
  open](../006-design/offline-mode.md#instant-open)). A placement param (`folder` / `team`) names a server place,
  so it makes the create a cloud one whoever is creating.
- **Filed** (livedesign) in the `/new?folder=` / `?team=` context when there is one, an explicit placement;
  otherwise the create carries no placement and the server files it in the person's
  [default folder](../013-workspace/default-folders.md) for its intent, else the root of My Work.
- **Named** after its template (`untitledNameForTemplate`); it is renamed in the editor.
- **Themed** Default: the Theme and canvas controls change it later.
- People change where designs go in **Settings > Designs > Default Folders**, and move a design between
  livedesign and this browser afterwards ([Offline Mode](../006-design/offline-mode.md)).
- Why: every answer a creation step could ask (name, store, folder, theme) has a later, better home, so asking up
  front only slowed the first design down.

### The empty-canvas hint

The **empty-canvas hint** is a calm **card in the middle of the canvas** (`EmptyCanvasBanner`), shown while the
active tab has no elements to someone who cannot edit it: an Editor gets the tab's start instead ([Template
start](start-diagramming.md)). A **Viewer** reads "Nothing here yet. The owner can build it out, and your view
updates live."; a **Participant** is pointed at a sticky, text or an image. It offers no action of its own, and
**Help** on a desktop. It goes once the canvas has content, and a **Close** (×) in its top right corner closes it
for good on that tab for this person in this browser (a per-browser list of the last 200 closed keys,
`livedesign:v2:empty-card-dismissed` in localStorage, shared with the start's own close). It takes presses only on
itself: the canvas around it still pans. The card: a small picture in the brand's tints on a soft panel
(`EmptyCanvasArt`), "Tab 1 is empty" (15 px semibold), then its one line, in full. **On a phone** it is the same
card, narrower (18rem). On a **short screen** (480px tall or less, a phone on its side) the card drops its picture,
so it clears the toolbars above and below instead of sliding under the Palette strip.

A soft, decorative **animated backdrop** (`AnimatedLinesBackdrop`) sits behind
the card: thick multi-colour curved lines that slowly flow along their paths via
animated `stroke-dashoffset`. It is pure SVG + CSS (no per-frame JS),
`pointer-events-none` / `aria-hidden`, and stands down under
`prefers-reduced-motion`.

## Start Blank

**Start Blank** is the name of the `?blank=1` link (Explorer Home's first-run blanks) and of the public sites'
`/new?start=blank` ([Marketing site](../019-marketing/marketing-site.md#start-blank)). Both make a blank design
whose start is already closed (`newDesignStartsBlank`, `closeStartForBlank`), so whoever asked for a blank is not
shown templates. Its telemetry token is `JustDraw` (`UI / Used / JustDraw`), kept so the funnel's history reads on
unbroken.

- The placement context params compose with it (`/new?blank=1&folder=<id>`, `/new?blank=1&team=<id>`), so a
  caller can Start Blank straight into a folder or team library.
- The [Pages tour](pages-tour.md)'s welcome offer is not queued on this path: a Start Blank user has asked to get
  straight to the canvas.

### The other parameters

- **`/new?template=<kind>`** makes that template. This is the URL the marketing site's template gallery links every
  card to ([Marketing site](../019-marketing/marketing-site.md)); it fires `UI / Used / TemplateLink`. `blank` wins
  when both are present.
- **`/new?q=<words>`** (trimmed, at most 60 characters, `SEARCH_PRESET_MAX`) is handed to the new design's start
  as its search ([Template start](start-diagramming.md) "Search handed over"). An empty `q` is ignored.
- **`/new?via=<Surface>.<Slot>`**: the landing funnel's source
  ([Landing funnel](../019-marketing/landing-funnel.md)), added by a public page's CTA and
  combinable with every param above. `useCtaAttribution` reads it once,
  sends `Cta / Opened / <source>`, and strips it from the address bar with
  `history.replaceState` (keeping the other params), so a reload or Back
  can't count the arrival twice. The create then sends `Cta / Created / <source>`, once. An unknown
  source is stripped and ignored.
- **`?mode=`** is not read: there is one mode. A `?mode=` from an old link is ignored.

### In-place handoff to the editor

Every create from `/new` opens the editor **without a page load**. Once the design is persisted and
placed, the page rewrites the address bar to `/design/<id>` with
`history.replaceState` and renders the editor component (`EditorPage`, the
same component `/design/<id>` and the not-found slot render) in its own
place. The editor reads the id from `window.location.pathname` on mount, so
it cannot tell the difference from a direct visit.

- **Why:** a hard navigation paid for a second full page load: the editor's
  design, a second sign-in settle, a second identity round trip, and a
  second, visually different loading screen after "Creating…". The in-place
  swap keeps the one signed-in session, the one design, and one continuous
  opening screen.
- **The editor code is fetched ahead.** `/new` starts loading the editor's
  chunk as soon as it mounts (the create needs it within a second), so the chunk downloads in
  parallel with identity and the create request. If it is not ready at
  handoff, the opening screen holds at the "Opening your design" stage
  until it is.
- **The opening screen is the editor's outermost Suspense fallback, so no lazy
  piece inside the editor may suspend up to it.** Every `next/dynamic` import
  in the live app passes `ssr: false` (or a `loading` component), which gives
  it a boundary of its own; without one, the first open of Settings or Search
  swapped the whole editor for the opening screen until the dialog's chunk
  landed. `lib/dynamic-has-boundary.test.ts` guards it.
- **`replaceState`, not `pushState`:** `/new` is a one-shot creator, so the
  editor URL takes its history entry. Reload and Back behave exactly as they
  do after a direct `/design/<id>` visit.
- **Nothing crosses the handoff but the URL and `sessionStorage`.** The
  tour's pending flag (`markTourPending`) is written before the swap and
  read by the editor on mount, as it was across the hard navigation.
- A failed create never hands off: the retryable error card shows instead.

### The opening screen

One screen covers the whole wait from the click to the editor: `/new`'s
creating stage and the editor's own load (`DesignLoading`) render the same
full-screen component, so the handoff above never visibly changes screens.
Its label moves from **"Creating your design"** (detail line "Setting up a
fresh canvas") to **"Opening your design"** ("Getting everything in place");
everything else stays put. Both name what livedesign makes, a design, and a
new one is made on the canvas, where its pages sit, whichever template it
starts from.

- **Surface:** headerless and full height, on the canvas colour
  (`slate-50` / `slate-950`) with the editor's dot grid faded out towards the
  edges and two slowly drifting, blurred brand-tinted glows behind the
  centre. Dark-aware like every screen ([Live app](live-app.md)).
- **Centrepiece:** the shared `DesignBuildAnimation`: on an artboard the
  collaborator cursor labelled "You" draws a mark with the pen, its anchors
  and handles showing; the path closes and fills, a cut-out lands, the
  cursor scales it by a corner with smart guides and picks a new colour from
  the swatches, then a sparkle and the loop restarts.
- **Continuity:** the loop's phase is measured from the first time the
  animation mounts in the design, so a remount (the creating stage giving
  way to the editor's load) continues the drawing where it was instead of
  restarting it.
- **Progress:** the label sits under the animation with a slim indeterminate
  bar below it. After 10 seconds in the editor's load the screen adds
  "This is taking longer than usual." with a Refresh button. Past that, the
  load's watchdog takes over: one self-healing reload, then the load-error
  screen with its recovery card ([Load recovery](load-recovery.md)).
- **Reduced motion:** the drawing sits finished, the cursor, pulses, glows
  and bar are still.
- `DesignBuildAnimation` stays a bare illustration (no surface of its own),
  so a card can compose it inside its own (the Clerk-era sso-callback card
  did).
- The bar is the shared `LoadingSweep`.

Every create from `/new` honours the URL placement context (the `?folder` /
`?team` pre-seed): the design files there, not silently at the personal root.

### Placement rides the create

The URL's placement context travels in the create body as
`{ teamId?, folderId? }`, and the server files the design in the same write
([Folders → Placement on create](../013-workspace/folders.md#placement-on-create)). There is no
follow-up placement request, so a design asked for in a team can never be left personal
by a request that failed quietly.

The create also carries the new design's creation `intent` (its template), so a create with no place chosen lands in the person's
[default folder](../013-workspace/default-folders.md) for it, resolved by the server. A blank is filed by its
intent; the template picked later on its start screen may then move it to that template's
default ([Default folders](../013-workspace/default-folders.md) "A template picked after creation").

- **A refused placement** shows the error card with copy for the reason, eyebrow
  "Placement refused", title "Couldn't file the design there", and one action,
  **Choose another place**, which reopens `/new` without the placement params, so the
  next create goes where new designs go by default:
  - `team_forbidden`: "You're not a member of that team, so the design can't be filed in its library."
  - `folder_not_found`: "That folder no longer exists, or isn't yours."
  - `folder_scope_mismatch`: "That folder belongs to a different space from the one you chose."
  - `placement_invalid`: "That isn't a place a design can be filed."
- **Any other failure** keeps the connection copy and **Try again**.
- **Telemetry:** `Team / Added / Design` fires once a create into a team has succeeded,
  never on a refused one.

Telemetry: Start Blank (`/new?blank=1`) fires `UI / Used / JustDraw` alongside
the usual `Design / Created` event, so its adoption is
measurable ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).

## Themes

`/new` shows no themes. Themes are picked from the Tab Style dialog (`ThemeBrowser`). The create path still
carries a theme id (`onPick`, `commitNewDesign`, `buildTemplatedTab` take a `string`), always the caller's:
`brand` on `/new`, the source tab's theme for a new tab.

## API impact

- No new endpoints. `POST /api/designs` already accepts an
  optional `tabs` array per [Per-tab storage](../006-design/per-tab-storage.md) — the new route uses it,
  and the placement `{ teamId?, folderId? }` ([Folders → Placement on create](../013-workspace/folders.md#placement-on-create)).

## Tests / sanity-check checklist

- `/live` with no params → redirects to `/new`, no flash.
- `/new` → the opening screen, then the editor on `/design/<id>`, on Start Making Pages.
- `/design/<id>` (existing) → editor hydrates as before.
- `/design/shared?s=<code>` (visitor) → editor + identity-confirm modal.
- NotFound CTA → goes to `/new`.
- "New Design" from Explorer → goes to `/new`.
- `/new` → created at once, This Browser for a guest, filed in the signed-in person's default folder for it.
- `/new?blank=1` → blank design created, its start closed.
- `/new?blank=1&folder=<id>` → the blank design files into that folder.
- `/new?template=not-a-kind` → a design that opens on its start.
- `/new?q=logo` → on the new design Start Making Pages opens with its search reading "logo".

## Out of scope for V1

- Animations for the route transition. A spinner is fine.
- A dedicated `/new` landing-page mode for unauthenticated
  users. Auth lands in a future spec.
