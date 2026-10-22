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
   State: load document, autosave, room broadcast, etc.
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

### Unknown addresses

A genuinely unknown address (a mistyped page, `/explorer/mine`, or a page an
older build had) reaches the editor through the same slot. It names no
document (`documentIdFromPath` reads no id off anything but
`/document/<id>`) and carries no share link, so the editor shows the in-app
`<NotFound>` card at once, titled **Page not found**
("There is no page at this address. Open a document from the Explorer or
start fresh.") with its **Open Explorer** and **New Document** buttons, and asks
the API for nothing. A document that is missing or not yours gets the same card
titled **Document not found**. The card stands alone under the app header, with
no Explorer panel beside it: its buttons are the way on (Open Explorer goes to
`/explorer`, New Document to `/new`). An embed shows the card with New Document
only, opening the app in a new tab. Only the editor's own empty route (`/document`,
`/document/placeholder`) hands off to `/new`. Before, every address without a
document id went to `/new`, so a mistyped or retired page made a new
document with no word of what went wrong.

### A failed load is not a missing document

NotFound means "this document doesn't exist, or isn't yours". A load
that FAILS — network down, 5xx, share link unresolvable — means
nothing of the sort, and showing NotFound for it tells someone their
work is gone when the server is merely unreachable. So the two are
kept apart: only a clean 404 reaches NotFound, and a thrown request
raises `loadError`, which renders `components/chrome/ApiErrorPage.tsx`
instead. That card leads with **Retry** (a reload), because unlike a
missing document the condition is expected to clear on its own. The
same card serves the failed-create path on `/new`, with one exception: a
create refused for its **placement** (`team_forbidden`, `folder_not_found`,
`folder_scope_mismatch`, `placement_invalid`, see
[Folders → Placement on create](../013-workspace/folders.md#placement-on-create)) will not clear on
a retry, so the card says why and offers **Choose another place** instead.
On `/new`, **Retry** re-runs the same create under the same document and tab
ids it first tried: a create that reached the server but whose answer was lost
is then taken as the re-commit of an id the caller already owns, never a second
document.

The distinction is made at every call site that can fail this way —
the document load and the share-link resolve in `useIdentityBootstrap`,
and the create in `/new` — rather than in one place, so it is worth
knowing about when adding another.

## Navigation flows

### Owner creates a new document

1. User clicks **New Document** in the Explorer (or lands on `/live`).
2. Browser navigates to `/new`.
3. `/new` asks nothing: it shows the opening screen at its "Creating your document" stage and makes the
   document at once, where new documents go by default ([What `/new` makes](#what-new-makes)).
4. Page mints a UUID, POSTs `/api/documents` with the seeded tab(s), then hands the document to the editor in place
   ([In-place handoff to the editor](#in-place-handoff-to-the-editor)).
5. On the editor route, hydration extracts the id from the pathname and fetches the document + tab content. No
   mint, no welcome gate. The empty tab opens on its start, where the Pages templates are
   ([Template start](start-diagramming.md)).

### Owner opens an existing document

1. Explorer list row click → `window.location.assign('/document/<id>')`.
2. Editor route hydrates as today. The create flow and identity modes never load.

### Visitor follows a share link

1. URL is `/document/shared?s=<code>`.
2. Editor route hydrates via the existing `apiLoadShared` branch.
3. Visitor identity confirmation (the `identityOnlyScreenOpen` mini-flow)
   stays on the editor route — it's about the visitor, not the document.

### Empty tab on an existing document

1. User clears the active tab's content (or opens a tab that was
   created empty).
2. An Editor sees Start Making Pages in the middle of the canvas ([Template start](start-diagramming.md));
   a Participant or Viewer the empty-canvas card ([The empty-canvas hint](#the-empty-canvas-hint)).

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

- The visitor identity confirmation modal (`IdentityPrompt`, open while `identityPromptOpen`; its chrome flag
  `identityOnlyScreenOpen`). There is no template picker over the editor: an empty tab's templates are on its start.
- Everything else: autosave, room, tab management,
  document metadata, share dialog, etc.

## `/new` state

The new route owns:

- The participant-identity bootstrap (same `livedocuments:v2:self-id`
  localStorage key, same `apiLoadSelf` / `apiSaveSelf` API).
- The "name confirmed" persistence (same
  `livedocuments:v2:name-confirmed` localStorage key).
- The create: mint a UUID, POST `/api/documents` with the
  templated tab(s) inline (or one empty tab), and hand off to the editor.

A back/forward-cache restore of `/new` never re-creates: `/new` creates as it mounts, so a restore backs out to
the page that opened it (`history.back()` when the browser came from another page of this site, else the home
page), logging `[new] restored, back out <target>`.

## What `/new` makes

`/new` asks no question: there is one editor mode, Pages, so it makes the document as it mounts
(`apps/live/app/new/page.tsx`, the URL read by `apps/live/lib/new-document-params.ts`):

- **Which document:** the template `?template=<kind>` names (`newDocumentKind`), a blank for `?blank=1`, else one
  empty tab that opens on its start (Start Making Pages). An unknown template kind is ignored rather than guessed,
  so a stale link makes a document, not a 404; a retired kind opens its replacement.
- **Stored** where [Save Locations → The default depends on who is creating](../006-document/save-locations.md#the-default-depends-on-who-is-creating)
  says: This Browser for a guest (with sign-in enabled), livedocuments for everyone else. Decided at commit by
  `resolveSaveLocation` (`app/new/useNewDocumentLocation.ts`): a guest never waits, a browser that looks signed in
  waits for identity, so a signed-in person is never handed a document in This Browser. A guest's This Browser
  document is created without waiting for identity at all ([Offline Mode → Instant
  open](../006-document/offline-mode.md#instant-open)). A placement param (`folder` / `team`) names a server place,
  so it makes the create a cloud one whoever is creating.
- **Filed** (livedocuments) in the `/new?folder=` / `?team=` context when there is one, an explicit placement;
  otherwise the create carries no placement and the server files it in the person's
  [default folder](../013-workspace/default-folders.md) for its intent, else the root of My Work.
- **Named** after its template (`untitledNameForTemplate`); it is renamed in the editor.
- **Themed** Default: the Theme and canvas controls change it later.
- People change where documents go in **Settings > Documents > Default Folders**, and move a document between
  livedocuments and this browser afterwards ([Offline Mode](../006-document/offline-mode.md)).
- Why: every answer a creation step could ask (name, store, folder, theme) has a later, better home, so asking up
  front only slowed the first document down.

### The empty-canvas hint

The **empty-canvas hint** is a calm **card in the middle of the canvas** (`EmptyCanvasBanner`), shown while the
active tab has no elements to someone who cannot edit it: an Editor gets the tab's start instead ([Template
start](start-diagramming.md)). A **Viewer** reads "Nothing here yet. The owner can build it out, and your view
updates live."; a **Participant**, who adds nothing, reads the same line. It offers no action of its own, and
**Help** on a desktop. It goes once the canvas has content, and a **Close** (×) in its top right corner closes it
for good on that tab for this person in this browser (a per-browser list of the last 200 closed keys,
`livedocuments:v2:empty-card-dismissed` in localStorage, shared with the start's own close). It takes presses only on
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
`/new?start=blank` ([Marketing site](../019-marketing/marketing-site.md#start-blank)). Both make a blank document
whose start is already closed (`newDocumentStartsBlank`, `closeStartForBlank`), so whoever asked for a blank is not
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
- **`/new?q=<words>`** (trimmed, at most 60 characters, `SEARCH_PRESET_MAX`) is handed to the new document's start
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

Every create from `/new` opens the editor **without a page load**. Once the document is persisted and
placed, the page rewrites the address bar to `/document/<id>` with
`history.replaceState` and renders the editor component (`EditorPage`, the
same component `/document/<id>` and the not-found slot render) in its own
place. The editor reads the id from `window.location.pathname` on mount, so
it cannot tell the difference from a direct visit.

- **Why:** a hard navigation paid for a second full page load: the editor's
  document, a second sign-in settle, a second identity round trip, and a
  second, visually different loading screen after "Creating…". The in-place
  swap keeps the one signed-in session, the one document, and one continuous
  opening screen.
- **The editor code is fetched ahead.** `/new` starts loading the editor's
  chunk as soon as it mounts (the create needs it within a second), so the chunk downloads in
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
- **Centrepiece:** `PageBuildAnimation`, livedocuments' own loader: a page
  whose heading and paragraphs write themselves line by line behind a caret,
  while a collaborator cursor labelled "You" drags a picture in between them;
  then the work fans out into its other shapes, an infographic to one side
  and a slide to the other, a sheen runs across the page, and it all
  dissolves before the loop restarts. livediagram keeps its diagram loader;
  each app's loader shows that app's own work.
- **Continuity:** the loop's phase is measured from the first time the
  animation mounts in the document, so a remount (the creating stage giving
  way to the editor's load) continues the drawing where it was instead of
  restarting it.
- **Progress:** the label sits under the animation with a slim indeterminate
  bar below it. After 10 seconds in the editor's load the screen adds
  "This is taking longer than usual." with a Refresh button. Past that, the
  load's watchdog takes over: one self-healing reload, then the load-error
  screen with its recovery card ([Load recovery](load-recovery.md)).
- **Reduced motion:** the page, infographic and slide sit finished; the
  cursor, caret, glows and bar are still.
- `PageBuildAnimation` stays a bare illustration (no surface of its own),
  so a card can compose it inside its own (the Clerk-era sso-callback card
  did).
- The bar is the shared `LoadingSweep`.

Every create from `/new` honours the URL placement context (the `?folder` /
`?team` pre-seed): the document files there, not silently at the personal root.

### Placement rides the create

The URL's placement context travels in the create body as
`{ teamId?, folderId? }`, and the server files the document in the same write
([Folders → Placement on create](../013-workspace/folders.md#placement-on-create)). There is no
follow-up placement request, so a document asked for in a team can never be left personal
by a request that failed quietly.

The create also carries the new document's creation `intent` (its template), so a create with no place chosen lands in the person's
[default folder](../013-workspace/default-folders.md) for it, resolved by the server. A blank is filed by its
intent; the template picked later on its start screen may then move it to that template's
default ([Default folders](../013-workspace/default-folders.md) "A template picked after creation").

- **A refused placement** shows the error card with copy for the reason, eyebrow
  "Placement refused", title "Couldn't file the document there", and one action,
  **Choose another place**, which reopens `/new` without the placement params, so the
  next create goes where new documents go by default:
  - `team_forbidden`: "You're not a member of that team, so the document can't be filed in its library."
  - `folder_not_found`: "That folder no longer exists, or isn't yours."
  - `folder_scope_mismatch`: "That folder belongs to a different space from the one you chose."
  - `placement_invalid`: "That isn't a place a document can be filed."
- **Any other failure** keeps the connection copy and **Try again**.
- **Telemetry:** `Team / Added / Document` fires once a create into a team has succeeded,
  never on a refused one.

Telemetry: Start Blank (`/new?blank=1`) fires `UI / Used / JustDraw` alongside
the usual `Document / Created` event, so its adoption is
measurable ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).

## Custom themes

`/new` shows no themes. Custom themes ([Custom themes](../011-theme/custom-themes.md)) are applied and built
from the Tab Style dialog (`CustomThemePicker`). The create path still carries a theme id (`onPick`,
`commitNewDocument`, `buildTemplatedTab` take a `string`, so a `custom:<uuid>`
passes through), now always the caller's: `brand` on `/new`, the source tab's
theme for a new tab.

## API impact

- No new endpoints. `POST /api/documents` already accepts an
  optional `tabs` array per [Per-tab storage](../006-document/per-tab-storage.md) — the new route uses it,
  and the placement `{ teamId?, folderId? }` ([Folders → Placement on create](../013-workspace/folders.md#placement-on-create)).

## Tests / sanity-check checklist

- `/live` with no params → redirects to `/new`, no flash.
- `/new` → the opening screen, then the editor on `/document/<id>`, on Start Making Pages.
- `/document/<id>` (existing) → editor hydrates as before.
- `/document/shared?s=<code>` (visitor) → editor + identity-confirm modal.
- NotFound CTA → goes to `/new`.
- "New Document" from Explorer → goes to `/new`.
- `/new` → created at once, This Browser for a guest, filed in the signed-in person's default folder for it.
- `/new?blank=1` → blank document created, its start closed.
- `/new?blank=1&folder=<id>` → the blank document files into that folder.
- `/new?template=slide-deck` → a slide deck created and the editor loads on `/document/<id>`.
- `/new?template=not-a-kind` → a document that opens on its start.
- `/new?q=article` → on the new document Start Making Pages opens with its search reading "article".

## Out of scope for V1

- Animations for the route transition. A spinner is fine.
- A dedicated `/new` landing-page mode for unauthenticated
  users. Auth lands in a future spec.
