# Dedicated route for new-document creation

Creating a document has its own route, `/new`, apart from the editor. The editor route (`/document/<id>`,
`/document/shared?s=<code>`) is editor-only; `/new` handles "I want to create a document" end-to-end. Each surface
owns its own state model, so neither needs gates for the other's states (a welcome screen showing on an existing
document, a mint racing the identity round trip).

## Goals

- `/new` owns the create flow end-to-end, and asks nothing: the new tab's start asks what you are making.
- The editor route only hydrates a document id or a share code and never has to consider minting an id.
- "New Canvas" buttons (the Explorer, the not-found card) navigate to `/new`. Share and open flows stay on the editor
  route.

## Non-goals

- The visitor `?s=<code>` flow: visitors land on `/document/shared?s=<code>` and confirm their name there; the
  identity confirmation (`identityOnlyScreenOpen`) stays on the editor route because it is about the visitor's
  session, not about creating a document.
- An empty tab on an existing document: its templates are on its mode's start, on the editor route, because the
  document is already loaded ([Template starts](start-diagramming.md)).
- What is persisted on create: `/new` POSTs `/api/documents` with the chosen tab seeded.

## Route map

| Route                   | Purpose                               | State                                                                                                                   |
| ----------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `/document/<id>`        | Editor for an existing owned document | Static placeholder file fronts every id (see "Path scheme" below). Client reads the id from `window.location.pathname`. |
| `/document/shared?s=<>` | Visitor view of a shared document     | Same placeholder file. Client reads the share code from the `s` query param.                                            |
| `/new`                  | Create-new flow                       | Identity, then POSTs the document at once and opens the editor in place on `/document/<id>`.                            |

## Path scheme

Editor URLs use a path segment rather than a query string. `output:
'export'` can't enumerate user-minted UUIDs at build time, so:

1. Next.js builds a single placeholder at `out/document/placeholder/index.html`
   via `generateStaticParams = [{ id: 'placeholder' }]` on the
   dynamic-segment server page. The page wraps a client `EditorPage`
   component that owns the editor logic.
2. The editor worker (`apps/editor/src/worker.ts`) wraps the static-assets
   binding and rewrites any `/document/<anything>` request to
   `/document/placeholder/`. The browser URL stays `/document/<id>`.
3. Client code reads `window.location.pathname` to extract the real
   id. The placeholder id is treated as "no id".
4. In `next dev`, Next.js resolves the dynamic segment natively so the
   same URL works without going through the worker.

There is no `?d=<id>` query scheme; `/live/*` carries only the editor app's `_next` assets
([Router app](../016-platform/router-app.md)).

### Not-found slot renders the editor

`output: 'export'` forces `dynamicParams=false`. The client-side
router compares the current URL against the static manifest on
hydration and fires `notFound()` for any dynamic-segment value not
enumerated in `generateStaticParams`. `placeholder` is the only
enumerated id, so every real document URL triggers `notFound()` the
instant the JS hydrates.

Earlier attempts tried to _prevent_ the trigger: a route-level
`not-found.tsx`, a pre-hydration URL swap to `placeholder`, then
the same swap using the captured native `replaceState` so Next's
patched version wouldn't re-notify the router. None of them held
up: Next.js's static export bakes the framework default 404 into
the `notFound` slot of the layout's flight payload and the client
router reaches it before any of those interventions can finish.

Working approach: **embrace the trigger**. `apps/editor/app/not-found.tsx`
exports `<EditorPage />` directly. When the client router fires
`notFound()` for an unrecognised id, the layout swaps from
`children` to the `notFound` slot, which is now the editor. The
editor mounts, reads the real id from `window.location.pathname`
(unchanged throughout: no URL swap means no restoration to fight
about), and loads the document via the API. The address bar stays
on `/document/<uuid>`; nothing about the URL needs to lie.

### Unknown addresses

A genuinely unknown address (a mistyped page, `/explorer/mine`, or a page an
older build had) reaches the editor through the same slot. It names no
document (`documentIdFromPath` reads no id off anything but
`/document/<id>`) and carries no share link, so the editor shows the in-app
`<NotFound>` card at once, titled **Page Not Found**
("There is no page at this address. Open a document from the Explorer or
start fresh.") with its **Open Explorer** and **New Canvas** buttons, and asks
the API for nothing. A document that is missing or not yours gets the same card
titled **Canvas Not Found**. The card stands alone under the app header, with
no Explorer panel beside it: its buttons are the way on (Open Explorer goes to
`/explorer`, New Canvas to `/new`). An embed shows the card with New Canvas
only, opening the app in a new tab. Only the editor's own empty route (`/document`,
`/document/placeholder`) hands off to `/new`. Before, every address without a
document id went to `/new`, so a mistyped or retired page made a new canvas with no word of what went wrong.

### Which not-found card

Every refusal the api answers 404 is the same card; what it says depends only on what the visitor brought and who
they are, never on whether the canvas exists, so a missing canvas and a private one always read alike. In order (the
first that fits wins; `notFoundReason`, `@liveworkspace/workbench/lib/not-found-reason`):

| Case         | When                                                                                               | Title                         | Says                                                                                                                                                                                                        | Buttons                    |
| ------------ | -------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Page         | the address names no canvas                                                                        | **Page Not Found**            | "There is no page at this address. Open a canvas from the Explorer or start fresh."                                                                                                                         | Open Explorer, New Canvas  |
| Access ended | the canvas was open a moment ago and access ended ([Share roles](../013-workspace/share-roles.md)) | **No Longer Shared With You** | "Your access to this canvas was removed while you had it open. Ask its owner to share it with you again."                                                                                                   | Open Explorer, New Canvas  |
| Dead link    | the address carries a share code (`?s=`) the api refused: unknown, revoked or expired alike        | **Link Not Valid**            | "This link isn’t valid. It may have been turned off or copied incompletely. Ask whoever shared it for a new one."                                                                                           | Open Explorer, New Canvas  |
| Sign in      | the visitor is signed out (a guest, or nobody)                                                     | **Canvas Not Found**          | "This canvas doesn’t exist, or you don’t have access to it.", then on its own line "If you are joining a colleague on this canvas, ask them to share a URL via the Share button."                           | Open Explorer, **Sign In** |
| Missing      | anyone else                                                                                        | **Canvas Not Found**          | "This canvas doesn’t exist or isn’t yours. Open one from the Explorer or start fresh.", then on its own line "If you are joining a colleague on this canvas, ask them to share a URL via the Share button." | Open Explorer, New Canvas  |

Sign In goes to `/sign-in/?redirect_url=<this address>`, so signing in comes straight back to the same canvas
(`useAuthHrefs`). A signed-in visitor without access keeps the plain Missing copy: signing in again would not help.
The dead link and access-ended cards carry no "404" line; the others do.

**In an embed** ([Embeds](../013-workspace/embeds.md)) the same cases hold with two differences: a refused share
code reads **No Longer Shared** ("This canvas is no longer shared at this link. Ask whoever shared it for a new one.")
with no buttons at all, since a New Canvas button inside someone else's page leads nowhere they meant to go; and an
embed never offers Sign In (it has no sign-in of its own), so a signed-out embed reads as Missing. The other cases keep
New Canvas, opening the app in a new tab. The embed's browser tab names the card too ("No Longer Shared |
livediagram"), never "Untitled canvas".

### Archived

A canvas its owner moved to Archived ([one-explorer.md "Archived"](../../../../liveworkspace/docs/specs/004-index/one-explorer.md#archived))
never opens. The index refuses its grant as `archived` (to its owner; anyone else hears it is missing, and gets
**Canvas Not Found**), or this browser holds it archived ([offline-mode.md "Archived Offline"](../006-document/offline-mode.md#archived-offline)).
Either way the editor shows the same card in place of the canvas, titled **Canvas Archived** ("This canvas is archived, so it
can't be opened or edited. Move it out of Archived with Change Folder to work on it again.") with a slate archive-box
tile and no 404. **Change Folder** goes to `/explorer/archived?move=<id>`, where the Explorer opens Change Folder on
it; **Open Explorer** goes to `/explorer`. An embed or a workbench frame shows the card with Open Explorer only (a step
back, in a workspace frame), since nothing inside a frame moves it out. The code is
`@liveworkspace/workbench/lib/archived` and the card's `archived` variant.

The owner opening an archived canvas's address directly gets this card, never the load-error screen: the api relays the index's refusal as `409 archived`, which the arrival (`openOwnAddress`, `@liveworkspace/workbench/lib/editor-arrival`) takes as the archived answer (`isArchivedLoadError`), not a failed load. Only that exact answer: any other failure keeps its error screen.

### The tab title

The browser tab names what the page shows. An open canvas names it and the tab open in it ("<name> | <tab> | livediagram", owner 2026-11-17, `editorTabTitle`; "<name> | livediagram" until the tab is known), following renames and tab switches; a status screen in its place names the screen instead, in Title Case: **Canvas Not Found**, **Page Not Found**, **Link Not Valid**, **No Longer Shared With You**, **Canvas Archived**, **Canvas Deleted**, **Couldn’t Load Canvas**, **Password Required** ("Canvas Not Found | livediagram"), so a missing canvas's tab never reads as an empty one (`useBrowserTabTitle`'s `status`, held by the editor page's status shell). A load that ends on a status screen pins no tab on the address: the `#t=<tab>` pin waits for a tab whose content has loaded (`useTabEntryEffects`), so the placeholder tab's id never lands on the address of an item that never opened.

### A failed load is not a missing document

NotFound means "this document doesn't exist, or isn't yours". A load
that FAILS (network down, 5xx, share link unresolvable) means
nothing of the sort, and showing NotFound for it tells someone their
work is gone when the server is merely unreachable. So the two are
kept apart: only a clean 404 reaches NotFound, and a thrown request
raises `loadError`, which renders `../packages/workbench/src/components/chrome/ApiErrorPage.tsx`
instead. That card leads with **Retry** (a reload), because unlike a
missing document the condition is expected to clear on its own. The
same card serves the failed-create path on `/new`, with one exception: a
create refused for its **placement** (`team_forbidden`, `folder_not_found`,
`folder_scope_mismatch`, `placement_invalid`, see
[Folders → Placement on create](../013-workspace/folders.md)) will not clear on
a retry, so the card says why and offers **Choose another place** instead.
On `/new`, **Retry** re-runs the same create under the same document and tab
ids it first tried: a create that reached the server but whose answer was lost
is then taken as the re-commit of an id the caller already owns, never a second
document. The same holds one step earlier: the index makes the item before the api
makes its content, so when the content's create is what failed, the Retry finds the
item already there (`409 item_exists`). `apiCreateDocument` makes the item through
`createOrResumeItem` (`@liveworkspace/index-client`, [One Explorer: contracts](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "A create that
resumes"), which then asks for the item's grant and, when it is an edit grant (the caller's own item), carries
the create on with it, so the Retry opens the new canvas; any other answer fails as before (Work Tracker #397).

The distinction is made at every call site that can fail this way:
the document load and the share-link resolve in `useIdentityBootstrap`,
and the create in `/new`, rather than in one place, so it is worth
knowing about when adding another.

## Navigation flows

### Owner creates a new document

1. User clicks **New Canvas** in the Explorer.
2. Browser navigates to `/new`.
3. `/new` shows the opening screen at its "Creating your canvas" stage from first paint, and asks nothing
   ([No welcome step](#no-welcome-step)).
4. Page mints a UUID, POSTs `/api/documents` with the seeded tab(s),
   then `window.location.assign('/document/<id>')` to land on
   the editor with the new document already on the server.
5. On the editor route, hydration extracts the id from the pathname
   and fetches the document + tab content. No mint, no welcome gate. The empty tab
   opens on its mode's start, where the mode is chosen and its templates are
   ([Template starts](start-diagramming.md)).

### Owner opens an existing document

1. Explorer list row click → `window.location.assign('/document/<id>')`.
2. The editor route hydrates the document. The welcome and create flow never load.

### Visitor follows a share link

1. URL is `/document/shared?s=<code>`.
2. Editor route hydrates via the existing `apiLoadShared` branch.
3. Visitor identity confirmation (the `identityOnlyScreenOpen` mini-flow)
   stays on the editor route: it's about the visitor, not the document.

### Empty tab on an existing document

1. User clears the active tab's content (or opens a tab that was
   created empty).
2. An Editor sees the mode's start in the middle of the canvas (Start Diagramming,
   Start Drawing, Start a Workshop; [Template starts](start-diagramming.md));
   a Participant or Viewer the empty-canvas card ([The empty-canvas hint](#the-empty-canvas-hint)).

### Canvas Not Found

1. URL is `/document/<id>` but the API returns 404.
2. The not-found surface renders ("Which not-found card" above); its New Canvas button navigates to `/new`, and a
   signed-out visitor's Sign In comes back to the same address.

## Editor route state

The editor route has no welcome state and mints no id. When the pathname's id segment is the build-time placeholder
and no `?s=` code is set, it redirects to `/new` (via `window.location.assign`) and shows the spinner until the
navigation completes. It keeps:

- The visitor identity confirmation (`IdentityPrompt`, open while `identityPromptOpen`; its chrome flag
  `identityOnlyScreenOpen`). Its name field takes at most `MAX_PARTICIPANT_NAME_LEN` (120) characters, the participant route's own cap, so a typed
  name is always one the route saves.
- Everything else: autosave, room, tab management, document metadata, the Share dialog.

## `/new` state

The route owns:

- The participant-identity bootstrap (the `livediagram:v2:self-id` localStorage key, `apiLoadSelf` / `apiSaveSelf`).
- The "name confirmed" persistence (the `livediagram:v2:name-confirmed` localStorage key).
- On arrival: mint a UUID, POST `/api/documents` with the tab the URL asks for ([No welcome step](#no-welcome-step)),
  and hand off to the editor in place.

## No welcome step

`/new` asks nothing. It creates the document the moment it loads and opens it in the editor, where the new tab's
start already asks what you are making: the start's mode switch and that mode's templates
([Template starts](start-diagramming.md)). The page used to ask for a mode first (a one-step wizard of mode cards),
and the start then asked again; one question is enough, and the start is the better place for it, beside the
templates the answer leads to.

- **What it creates**: an empty tab of the `?mode=` preset's blank (`BLANK_TEMPLATE_FOR_MODE`), else a Blank Diagram,
  on the **Default** theme, opening on its start. `?q=` (trimmed, at most 60 characters) is handed to that start as
  its search ([Template starts](start-diagramming.md) "Search handed over"). An unknown `?mode=` reads as none (and
  `pages`, `illustrate` or `infographic` as Diagram, `parseEditorMode`). Read by `newDocumentKind`
  (`apps/editor/lib/new-document-params.ts`).
- **`/new?start=blank`** (the public sites' and Explorer Home's Start Blank) opens it with its start closed
  (`closeStartForBlank`), so whoever asked for a blank is not shown templates. Only the exact value `blank` counts.
- **Stored** where [Save Locations → The default depends on who is creating](../006-document/save-locations.md#the-default-depends-on-who-is-creating)
  says: Offline for a guest (with sign-in enabled), livediagram for everyone else. Decided at commit by
  `resolveSaveLocation`: a guest never waits, a browser that looks signed in waits for identity, so a signed-in
  person is never handed a document kept Offline.
- **Filed** (livediagram) in the `/new?folder=` / `?team=` context when there is one, an explicit placement; otherwise
  the create carries no placement and the server files it in the person's
  [default folder](../013-workspace/default-folders.md) for its intent, else the root of My Work.
- **Named** after its template ("Untitled Diagram", `untitledNameForTemplate`); it is renamed in the editor.
- People change where documents go in **Settings > Explorer > Default Folders**, and move a document between
  livediagram and this browser afterwards ([Offline Mode](../006-document/offline-mode.md)).
- **Nothing to back out of.** The handoff replaces `/new`'s history entry with `/document/<id>`, so Back from the
  editor returns to the page before `/new`, never to a page that would mint another document. Should the browser
  restore an unfinished `/new` from the back/forward cache, it goes back again (or home, `backOutTarget`) rather
  than minting another document or trapping the person behind a page that always navigates forward.
- **The opening screen paints first, prerender included.** `/new` is a static export and its HTML is the opening
  screen at "Creating your canvas", so nothing else flashes before React reads the URL.
- No tour is queued: tours start only from the footer's Get Started button
  ([Diagram tour ("Start Diagram Tour")](editor-tour.md) "Handoff").

## Responsive layout

The visitor name prompt (`apps/editor/components/palette/IdentityPrompt.tsx`) over the editor renders on `sm:` and up
as a centred floating card (max 26rem), with rounded corners + shadow over the canvas. On mobile (below `sm`) it fills
the viewport edge-to-edge: full width, full dynamic-viewport height, no border / radius / shadow. Its Join and Cancel
stay reachable because the body scrolls inside the card while the header + footer remain pinned. It stacks on the
`canvas-modal` rung: above every canvas surface, beneath the header.

### The empty-canvas hint

The **empty-canvas hint** is a calm **card in the middle of the canvas** (`EmptyCanvasBanner`), shown while the
active tab has no elements to someone who cannot edit it: an Editor gets the mode's start instead ([Template
starts](start-diagramming.md)). A **Viewer** reads "Nothing here yet. The owner can build it out, and your view
updates live."; a **Participant** is pointed at a sticky, text or an image. It shows in Diagram and Workshop; Draw
(its dock is the hint, [Draw mode](../023-draw-mode/draw-mode.md)) shows none. It offers no action
of its own: an Editor's empty tab shows its start instead, and **Help** on a desktop. It goes once the
canvas has content, and a **Close** (×) in its top right corner closes it for good on that tab for this person in
this browser (a per-browser list of the last 200 closed keys, `livediagram:v2:empty-card-dismissed` in localStorage,
shared with the starts' own close). It takes presses only on itself: the canvas around it still pans. It hides while
a draw tool is armed. The card: a small picture of what the tab's mode makes, in the brand's
tints on a soft panel (`EmptyCanvasArt`), "Tab 1 is empty" (15 px semibold), then its one line, in full. **On a
phone** it is the same card, narrower (18rem). On a **short screen** (480px tall or less, a phone on its side) the card
drops its picture, so it clears the toolbars above and below instead of sliding under the Palette strip.

## Start Blank and template links

**Start Blank** is the name of the `?blank=1` link (and of Explorer Home's first-run blanks); it was "Just Draw" until
the hero's **Drawing** came to mean a whiteboard. Its telemetry token stays `JustDraw`, so the funnel's history reads
on unbroken. The public sites' Start Blank is `/new?start=blank` ([No welcome step](#no-welcome-step)).

- **`/new?blank=1`** creates a Blank Diagram with its start closed. Any truthy presence of `blank` counts. It sends
  `UI / Used / JustDraw`.
- **`/new?template=<kind>`** creates that template (Default theme, the template's default name), its start closed. It
  is the URL the marketing site's template gallery links every card to
  ([Marketing site](../019-marketing/marketing-site.md)) and sends `UI / Used / TemplateLink`. `blank` wins when both
  are present. An unknown kind (a retired one too) is ignored and the default blank is made, so a stale link never
  strands anyone. Both are read by `wizardBypassKind` in `apps/editor/lib/new-document-params.ts`.
- Both compose with the placement context (`/new?blank=1&folder=<id>`, `&team=<id>`), and with `?via=`; a failed
  create shows the same retryable error card as any create.
- **Where they store the document**: the default for who is creating, as every `/new` create
  (`resolveSaveLocation` in `app/new/useNewDocumentLocation.ts`). A guest gets a document kept Offline, created
  without waiting for identity at all ([Offline Mode → Instant open](../006-document/offline-mode.md#instant-open)).
  A placement param names a server place, so it makes the create a cloud one whoever is creating.
- **`?welcome=1`** is not read.
- **`/new?via=<Surface>.<Slot>`**: the landing funnel's source
  ([Landing funnel](../019-marketing/landing-funnel.md)), added by a public page's CTA and
  combinable with every param above. `useCtaAttribution` reads it once,
  sends `Cta / Opened / <source>`, and strips it from the address bar with
  `history.replaceState` (keeping the other params), so a reload or Back
  can't count the arrival twice. The create then sends `Cta / Created / <source>`, once. An unknown
  source is stripped and ignored.

### In-place handoff to the editor

Every commit from `/new` (Create, Skip, and both bypass URLs)
opens the editor **without a page load**. Once the document is persisted and
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
  chunk as soon as it mounts (every visit creates within a second), so the chunk downloads in
  parallel with identity and the create request. If it is not ready at
  handoff, the opening screen holds at the "Opening your canvas" stage
  until it is.
- **The opening screen is the editor's outermost Suspense fallback, so no lazy
  piece inside the editor may suspend up to it.** Every `next/dynamic` import
  in the editor app passes `ssr: false` (or a `loading` component), which gives
  it a boundary of its own; without one, the first open of Settings or Search
  swapped the whole editor for the opening screen until the dialog's chunk
  landed. `lib/dynamic-has-boundary.test.ts` guards it.
- **`replaceState`, not `pushState`:** `/new` is a one-shot creator, so the
  editor URL takes its history entry. Reload and Back behave exactly as they
  do after a direct `/document/<id>` visit.
- **Nothing crosses the handoff but the URL and `sessionStorage`.**
- A failed create never hands off: the retryable error card shows instead.

### The opening screen

One screen covers the whole wait from the click to the editor: `/new`'s
creating stage and the editor's own load (`DocumentLoading`) render the same
full-screen component, so the handoff above never visibly changes screens.
Its label moves from **"Creating your canvas"** to **"Opening your
canvas"**; everything else stays put.

- **Surface:** headerless and full height, on the canvas colour
  (`slate-50` / `slate-950`) with the editor's dot grid faded out towards the
  edges and two slowly drifting, blurred brand-tinted glows behind the
  centre. Dark-aware like every screen ([Editor app](editor-app.md)).
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
  "This is taking longer than usual." with a Refresh button. Past that, the
  load's watchdog takes over: one self-healing reload, then the load-error
  screen with its recovery card ([Load recovery](load-recovery.md)).
- **Reduced motion:** the drawing sits finished, the cursor, pulses, glows
  and bar are still.
- `DiagramBuildAnimation` stays a bare illustration (no surface of its own),
  so a card can compose it inside its own (the Clerk-era sso-callback card
  did).

Every create from `/new` honours the URL placement context (the `?folder` /
`?team` pre-seed): the document files there, not silently at the personal root.

### Placement rides the create

The URL's placement context travels in the create body as
`{ teamId?, folderId? }`, and the server files the document in the same write
([Folders → Placement on create](../013-workspace/folders.md)). There is no
follow-up placement request, so a document asked for in a team can never be left personal
by a request that failed quietly.

The create also carries the new document's creation `intent` (its first tab's editor mode
its first tab's kind and its template family), so a create with no place chosen lands in the person's
[default folder](../013-workspace/default-folders.md) for it, resolved by the server. A mode's blank made by `/new` is filed by its mode; the template picked later on its start screen may then move it to that template's
default ([Default folders](../013-workspace/default-folders.md) "A template picked after creation").

- **A refused placement** shows the error card with copy for the reason, eyebrow
  "Placement refused", title "Couldn't file the canvas there", and one action,
  **Choose another place**, which reopens `/new` without the link and placement params, so the
  next create goes where new documents go by default:
  - `team_forbidden`: "You're not a member of that team, so the canvas can't be filed in its library."
  - `folder_not_found`: "That folder no longer exists, or isn't yours."
  - `folder_scope_mismatch`: "That folder belongs to a different space from the one you chose."
  - `placement_invalid`: "That isn't a place a canvas can be filed."
- **Any other failure** keeps the connection copy and **Try again**.
- **Telemetry:** `Team / Added / Document` fires once a create into a team has succeeded,
  never on a refused one.

Telemetry: the Start Blank bypass (`/new?blank=1`) fires `UI / Used / JustDraw` alongside
the usual `Document / Created` event, so Start Blank's adoption is
measurable ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).

## Themes

The picker shows no themes. Themes are
picked from the Tab Style dialog's `ThemeBrowser`. The create path carries a theme id (`onPick`,
`commitNewDocument`, `buildTemplatedTab` take a `string`), always the
caller's: `brand` on `/new`, the source tab's theme for a new tab.

## API impact

- No new endpoints. `POST /api/documents` already accepts an
  optional `tabs` array per [Per-tab storage](../006-document/per-tab-storage.md); the new route uses it,
  and the placement `{ teamId?, folderId? }` ([Folders → Placement on create](../013-workspace/folders.md)).

## Tests / sanity-check checklist

- `/document/placeholder` with no `?s=` → redirects to `/new`, no flash.
- `/new` → the opening screen on first paint, then the editor on `/document/<id>`, a Blank Diagram on its start.
- `/document/<id>` (existing) → editor hydrates as before.
- `/document/shared?s=<code>` (visitor) → editor + identity-confirm modal.
- NotFound CTA → goes to `/new`.
- "New Canvas" from Explorer → goes to `/new`.
- `/new` → the document is created at once, Offline for a guest, filed in the signed-in person's default folder.
- `/new`, then Back from the editor → the page before `/new`, no second document.
- `/new?start=blank` → a Blank Diagram with its start closed.
- `/new?blank=1` → blank document created, start closed; `/new?blank=1&folder=<id>` files it into that folder.
- `/new?template=flowchart` → a Flowchart diagram created and the editor loads on `/document/<id>`.
- `/new?template=not-a-kind` (a retired one, such as `kanban`, too) → the default Blank Diagram on its start.
- `/new?template=whiteboard` → a document whose tab opens in Draw mode ([Editor modes](editor-modes.md)), the Ink
  pen in hand.
- `/new?mode=draw` → a Draw tab on its start.
- `/new?mode=workshop&q=retro` → a Workshop tab; Start a Workshop opens with its search reading "retro".
- `/new?mode=pages` (or `illustrate`, `infographic`) → a Diagram tab: livediagram has no Pages mode.
- `/new?mode=sideways` → a Blank Diagram.

## Out of scope for V1

- Animations for the route transition. A spinner is fine.
- A dedicated `/new` landing-page mode for unauthenticated
  users. Auth lands in a future spec.
