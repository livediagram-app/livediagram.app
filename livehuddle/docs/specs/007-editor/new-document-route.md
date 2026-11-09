# Dedicated route for new-document creation

Creating a document has its own route, `/new`, apart from the editor. The editor route (`/document/<id>`,
`/document/shared?s=<code>`) is editor-only; `/new` handles "I want to create a document" end-to-end. Each surface
owns its own state model, so neither needs gates for the other's states (a welcome screen showing on an existing
document, a mint racing the identity round trip).

## Goals

- `/new` makes a new Space end-to-end, with no screen of its own: it creates the Space at once and opens it on
  Start a Space, where the templates are.
- The editor route only hydrates a document id or a share code and never has to consider minting an id.
- "New Space" buttons (the Explorer, the not-found card) navigate to `/new`. Share and open flows stay on the editor
  route.

## Non-goals

- The visitor `?s=<code>` flow: visitors land on `/document/shared?s=<code>` and confirm their name there; the
  identity confirmation (`identityOnlyScreenOpen`) stays on the editor route because it is about the visitor's
  session, not about creating a document.
- An empty tab on an existing document: its templates are on Start a Space, on the editor route, because the
  document is already loaded ([Template starts](start-diagramming.md)).
- What is persisted on create: `/new` POSTs `/api/documents` with the chosen tab seeded.

## Route map

| Route                   | Purpose                               | State                                                                                                                   |
| ----------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `/document/<id>`        | Editor for an existing owned document | Static placeholder file fronts every id (see "Path scheme" below). Client reads the id from `window.location.pathname`. |
| `/document/shared?s=<>` | Visitor view of a shared document     | Same placeholder file. Client reads the share code from the `s` query param.                                            |
| `/new`                  | Create a new Space                    | Identity, then POSTs a Blank Space (or a linked template) and opens the editor in place on `/document/<id>`.            |

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
`<NotFound>` card at once, titled **Page not found**
("There is no page at this address. Open a document from the Explorer or
start fresh.") with its **Open Explorer** and **New Space** buttons, and asks
the API for nothing. A document that is missing or not yours gets the same card
titled **Space not found**. The card stands alone under the app header, with
no Explorer panel beside it: its buttons are the way on (Open Explorer goes to
`/explorer`, New Space to `/new`). An embed shows the card with New Space
only, opening the app in a new tab. Only the editor's own empty route (`/document`,
`/document/placeholder`) hands off to `/new`. Before, every address without a
document id went to `/new`, so a mistyped or retired page made a new
Space with no word of what went wrong.

### Archived

A space its owner moved to Archived ([one-explorer.md "Archived"](../../../../liveworkspace/docs/specs/004-index/one-explorer.md#archived))
never opens. The index refuses its grant as `archived` (to its owner; anyone else hears it is missing, and gets
**Space not found**), or this browser holds it archived ([offline-mode.md "Archived in This Browser"](../006-document/offline-mode.md#archived-in-this-browser)).
Either way the editor shows the same card in place of the space, titled **Space Archived** ("This space is archived, so it
can't be opened or edited. Move it out of Archived with Change Folder to work on it again.") with a slate archive-box
tile and no 404. **Change Folder** goes to `/explorer/archived?move=<id>`, where the Explorer opens Change Folder on
it; **Open Explorer** goes to `/explorer`. An embed or a workbench frame shows the card with Open Explorer only (a step
back, in a workspace frame), since nothing inside a frame moves it out. The code is
`@liveworkspace/workbench/lib/archived` and the card's `archived` variant.

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
a retry, so the card says why and offers **Use Default Place** instead.
On `/new`, **Retry** re-runs the same create under the same document and tab
ids it first tried: a create that reached the server but whose answer was lost
is then taken as the re-commit of an id the caller already owns, never a second
document. The same holds one step earlier: the index makes the item before the api
makes its content, so when the content's create is what failed, the Retry finds the
item already there (`409 item_exists`). `apiCreateDocument` makes the item through
`createOrResumeItem` (`@liveworkspace/index-client`, shared by every editor since Work Tracker #397), which then
asks for the item's grant and, when it is an edit grant (the caller's own item), carries the create on
with it; any other answer fails as before (issue #330: Retry used to fail every time).

The distinction is made at every call site that can fail this way:
the document load and the share-link resolve in `useIdentityBootstrap`,
and the create in `/new`, rather than in one place, so it is worth
knowing about when adding another.

## Navigation flows

### Owner creates a new document

1. User clicks **New Space** in the Explorer.
2. Browser navigates to `/new`.
3. `/new` shows the opening screen ([The opening screen](#the-opening-screen)) on first paint and creates a Blank
   Space at once, where new documents go by default ([No welcome screen](#no-welcome-screen)).
4. Page mints a UUID, POSTs `/api/documents` with the blank tab, then hands off to the editor in place
   ([In-place handoff](#in-place-handoff-to-the-editor)).
5. The editor reads the id from the pathname and fetches the document. No mint, no welcome gate. The empty tab
   opens on Start a Space, where its templates are ([Template starts](start-diagramming.md)), on Recommended.

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
2. An Editor sees Start a Space in the middle of the canvas ([Template starts](start-diagramming.md));
   a Participant or Viewer the empty-canvas card ([The empty-canvas hint](#the-empty-canvas-hint)).

### Space not found

1. URL is `/document/<id>` but the API returns 404.
2. The not-found surface renders; its "Create new document" CTA navigates to `/new`.

## Editor route state

The editor route has no welcome state and mints no id. When the pathname's id segment is the build-time placeholder
and no `?s=` code is set, it redirects to `/new` (via `window.location.assign`) and shows the spinner until the
navigation completes. It keeps:

- The visitor identity confirmation (`IdentityPrompt`, open while `identityPromptOpen`; its chrome flag
  `identityOnlyScreenOpen`).
- Everything else: autosave, room, tab management, document metadata, the Share dialog.

## `/new` state

The route owns:

- The participant-identity bootstrap (the `livehuddle:v2:self-id` localStorage key, `apiLoadSelf` / `apiSaveSelf`).
- The "name confirmed" persistence (the `livehuddle:v2:name-confirmed` localStorage key).
- On mount: mint a UUID, POST `/api/documents` with the blank tab (or a linked template's), and open the editor on
  `/document/<id>`.

## No welcome screen

`/new` has **no screen of its own**: no wizard, no Create button. Opening it makes a **Blank Space**
(`blank-session`) straight away and opens it on **Start a Space** ([Template starts](start-diagramming.md)), where
the person picks a template, searches, or closes the start for a blank space. The tab is made **empty**
(`newDocumentTab`'s `blankOpensOnStart`), since the start shows only on an empty tab; the blank's
[Avatar Pad](../009-elements/avatar-pad.md#every-space-and-blank-tab-has-one) lands with whatever is chosen there.

Why: the welcome card asked no question. livehuddle has one mode, there is no theme or location step, and its body
only described what Create would make before sending the person to Start a Space anyway. A screen whose only action
is "continue" is a step between the person and what they came for; Start a Space already holds the templates, the
search and the Sync Space to Server switch ([Save Locations → On the start screen](../006-document/save-locations.md#on-the-start-screen)).

- **Stored** where [Save Locations → The default depends on who is creating](../006-document/save-locations.md#the-default-depends-on-who-is-creating)
  says: This Browser for a guest (with sign-in enabled), livehuddle for everyone else. Decided at commit by
  `resolveSaveLocation`: a guest never waits, a browser that looks signed in waits for identity, so a signed-in
  person is never handed a document in This Browser. Start a Space's footer switch moves it while it is empty.
- **Filed** (livehuddle) in the `/new?folder=` / `?team=` context when there is one, an explicit placement;
  otherwise the create carries no placement and the server files it in the person's
  [default folder](../013-workspace/default-folders.md) for its intent, else the root of My Work.
- **Once, on a first visit too.** A guest's first visit leaves `/new` for the guest token's handoff and comes back
  to it, so a create bound for This Browser first waits for the token (`ensureGuestToken`): with none, the page leaves
  before anything is made and creates on its return. A guest who holds a token waits for nothing.
- **Named** after its template ("Untitled Space", `untitledNameForTemplate`); it is renamed in the editor.
- **Themed** Default; the Tab Style dialog changes it later.
- **No way back without a Space.** Opening `/new` is the commitment, as "New document" is in any editor: Back from
  the editor returns to the page before `/new`, since the handoff replaces `/new`'s history entry. A Space left
  empty is an ordinary empty Space, deleted from the Explorer like any other.
- **Recent Spaces** are on Explorer Home and in the Explorer; `/new` no longer shows a Jump Back In card.
- The page renders the opening screen in its prerendered HTML, so nothing else ever paints first, and no inline
  pre-hydration script is needed.

The visitor name prompt (`apps/editor/components/palette/IdentityPrompt.tsx`) is the only card the editor shows over
the canvas. On `sm:` and up it is a centred floating card (max 26rem); below `sm` it fills the viewport, its body
scrolling between a pinned header and footer. It stacks on the `canvas-modal` rung, beneath the header. Its name field takes at
most `MAX_PARTICIPANT_NAME_LEN` (120) characters, the participant route's own cap, so a typed name is always one the
route saves.

### The empty-canvas hint

The **empty-canvas hint** is a calm **card in the middle of the canvas** (`EmptyCanvasBanner`), shown while the
active tab has no elements to someone who cannot edit it: an Editor gets the start instead ([Template
starts](start-diagramming.md)). A **Viewer** reads "Nothing here yet. The owner can build it out, and your view
updates live."; a **Participant** reads the same, since it adds nothing ([Share
roles](../013-workspace/share-roles.md#a-participant-walks)). It offers no action
of its own: an Editor's empty tab shows its start instead, and **Help** on a desktop. It goes once the
canvas has content, and a **Close** (×) in its top right corner closes it for good on that tab for this person in
this browser (a per-browser list of the last 200 closed keys, `livehuddle:v2:empty-card-dismissed` in localStorage,
shared with the starts' own close). It takes presses only on itself: the canvas around it still pans. It hides while
a draw tool is armed. The card: a small picture of a session board, in the brand's
tints on a soft panel (`EmptyCanvasArt`), "Tab 1 is empty" (15 px semibold), then its one line, in full. **On a
phone** it is the same card, narrower (18rem). On a **short screen** (480px tall or less, a phone on its side) the card
drops its picture, so it clears the toolbars above and below instead of sliding under the Palette strip.

The card has no animated backdrop behind it (the old `AnimatedLinesBackdrop` was deleted unused, Work Tracker #583).

## What a /new link can ask for

Every `/new` creates; the query only says what and where. All params are read by one module,
`apps/editor/lib/new-document-params.ts`, so the page and its bfcache cleanup agree on what counts.

- **Plain `/new`**: a Blank Space that opens on Start a Space. The header's New Space, the Explorer's New Space, the
  not-found card and the marketing site's template links without a kind all land here.
- **`/new?template=<kind>`**: that template instead of the blank (Default theme, the template's default name; a
  template with floors makes one tab per floor, [Templates by mode](templates-by-mode.md#a-template-with-floors)),
  opening on the canvas with the template on it. This is the URL the marketing site's template gallery links every
  card to ([Marketing site](../019-marketing/marketing-site.md)); it fires `UI / Used / TemplateLink`. An unknown or
  retired kind (`kanban`, livediagram's `blank` and `whiteboard`) is ignored: the plain Blank Space is made, so a
  stale link never strands anyone.
- **`/new?blank=1`** and **`/new?start=blank`**: **Start Blank**, a Blank Space that opens **with its start closed**
  (`closeStartForBlank`), so whoever asked for a blank is not shown templates. It is made with the Blank Space's
  [Avatar Pad](../009-elements/avatar-pad.md#every-space-and-blank-tab-has-one) already on it, a little below the
  middle of the view. `?blank=1` is Explorer Home's
  first-run Start Blank; `?start=blank` the public sites' ([Marketing site](../019-marketing/marketing-site.md#start-blank)).
  Only the exact `start` value `blank` counts. Either fires `UI / Used / JustDraw` (the token kept from the old "Just
  Draw" name, so the funnel's history reads on unbroken). `blank` wins over `template`.
- **`/new?q=<words>`**: `q` (trimmed, at most 60 characters) is handed to the new Space's start as its search, so the
  templates it meant are the ones shown ([Template starts](start-diagramming.md) "Search handed over"). An empty `q`
  is ignored. The marketing hero's **Build yours** buttons link here. A `mode` param (`/new?mode=draw`) is ignored:
  there is one mode. `?welcome=1` is not read.
- **`?folder=<id>`** / **`?team=<id>`**: the placement context, composing with every param above; it names a server
  place, so the create is a cloud one whoever is creating ([Placement rides the create](#placement-rides-the-create)).
- **`/new?via=<Surface>.<Slot>`**: the landing funnel's source ([Landing funnel](../019-marketing/landing-funnel.md)),
  added by a public page's CTA. `useCtaAttribution` reads it once, sends `Cta / Opened / <source>`, and strips it from
  the address bar with `history.replaceState` (keeping the other params). The create then sends
  `Cta / Created / <source>`, once. An unknown source is stripped and ignored.

**A restore from the back/forward cache** that finds `/new` before its handoff (the person left mid-create) does not
create again, which would trap Back behind a page that always moves forward: it backs out to the page that opened
`/new` (`history.back()`), or home when there is none (`backOutTarget`). No tour is queued on any path: tours start
only from the footer's Start Tour button ([Tours](editor-tour.md)).

### In-place handoff to the editor

Every create from `/new`
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
  chunk as soon as it mounts (it is needed within a second), so the chunk downloads in
  parallel with identity and the create request. If it is not ready at
  handoff, the opening screen holds at the "Opening your space" stage
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
Its label moves from **"Creating your space"** to **"Opening your
space"**; everything else stays put.

- **Surface:** headerless and full height, on the canvas colour
  (`slate-50` / `slate-950`) with the editor's dot grid faded out towards the
  edges and two slowly drifting, blurred brand-tinted glows behind the
  centre. Dark-aware like every screen ([Editor app](editor-app.md)).
- **Centrepiece:** livehuddle's own `SpaceBuildAnimation`, a Space coming to
  life, drawn in the house art: the canvas's room and furniture pieces (warm
  floor, ten-unit walls with a slate outline, slate-tinted furniture, the
  marketing hero's line weights) and the Avatar's pixel character
  ([Avatar mode](../008-canvas/avatar-mode.md) "The character"). One loop of
  nine seconds, front-loaded because most loads finish within a second or two:
  the room draws, the door opens and the furniture lands in the first second,
  overlapping, and the first character is already walking in by about 0.6
  seconds, so even a fast load shows people arriving, never an empty box. In
  order:
  1. **The room draws:** the floor fades up, then the walls draw in quick
     overlapping strokes round the room (top, right, the two halves of the bottom wall either side
     of the doorway, left), and the room's name band, **Huddle Room**, settles in
     along the top wall.
  2. **It is furnished:** a rug, a meeting table with two chairs on each long side,
     a bookshelf, a coffee machine and two plants pop in, one after another,
     while the people are already on their way in.
  3. **The door opens:** the door leaf swings inward on its hinge, its dashed
     swing arc fading in behind it, as on the canvas.
  4. **People arrive:** two characters walk in through the doorway, one a beat
     behind the other: you (brand-cyan shirt, no name chip, as your own
     character has none on the canvas) and a teammate, **Sam** (violet shirt,
     with a name chip in its colour). Each walks up, along, up the side of the table and across
     to a chair, facing the way it walks (back view going up, profile going
     sideways) with the house two-frame stride, and sits.
  5. **They meet:** seated side by side at the table, they are in earshot: a
     soft pool of brand light settles round the pair and each shows the talking
     equaliser (three small bars in its shirt colour,
     [Proximity audio](../012-collaboration/proximity-audio.md)), taking turns.
  6. **It resets:** the whole Space dissolves and the loop starts again.
- **Continuity:** the loop's phase is measured from the first time the
  animation mounts in the document, so a remount (the creating stage giving
  way to the editor's load) continues the scene where it was instead of
  restarting it.
- **Progress:** the label sits under the animation with a slim indeterminate
  bar below it. After 10 seconds in the editor's load the screen adds
  "This is taking longer than usual." with a Refresh button. Past that, the
  load's watchdog takes over: one self-healing reload, then the load-error
  screen with its recovery card ([Load recovery](load-recovery.md)).
- **Reduced motion:** a calm still frame: the finished room, the door open,
  both characters seated at the table in their pool of light, their
  equalisers at rest. Glows and bar are still.
- **Accessibility:** the picture is one image named "A Space coming to life";
  the label and its messages are the live status.
- **Cost:** pure SVG and CSS keyframes generated once at module load, no
  canvas code and no avatar sprite module (the characters are drawn from the
  shared Avatar palette). Every animated property is `transform` or
  `opacity`, so the loop stays on the compositor
  ([blueprint](blueprints/opening-screen.md)).
- `SpaceBuildAnimation` stays a bare illustration (no surface of its own).
  The shared `DiagramBuildAnimation` is livediagram's; livehuddle no longer
  uses it.

Every create from `/new` honours the URL placement context (the `?folder` /
`?team` pre-seed): the document files there, not silently at the personal root.

### Placement rides the create

The URL's placement context travels in the create body as
`{ teamId?, folderId? }`, and the server files the document in the same write
([Folders → Placement on create](../013-workspace/folders.md)). There is no
follow-up placement request, so a document asked for in a team can never be left personal
by a request that failed quietly.

The create also carries the new document's creation `intent` (its first tab's editor mode, always Workshop,
its first tab's kind and its template family), so a create with no place chosen lands in the person's
[default folder](../013-workspace/default-folders.md) for it, resolved by the server. The blank made by
`/new` is filed as a Workshop; the template picked later on its start screen may then move it to that template's
default ([Default folders](../013-workspace/default-folders.md) "A template picked after creation").

- **A refused placement** shows the error card with copy for the reason, eyebrow
  "Placement refused", title "Couldn't file the canvas there", and one action,
  **Use Default Place**, which reopens `/new` without the template and placement params, so the
  next create goes where new documents go by default:
  - `team_forbidden`: "You're not a member of that team, so the canvas can't be filed in its library."
  - `folder_not_found`: "That folder no longer exists, or isn't yours."
  - `folder_scope_mismatch`: "That folder belongs to a different space from the one you chose."
  - `placement_invalid`: "That isn't a place a canvas can be filed."
- **Any other failure** keeps the connection copy and **Try again**.
- **Telemetry:** `Team / Added / Document` fires once a create into a team has succeeded,
  never on a refused one.

Telemetry: Start Blank (`?blank=1`, `?start=blank`) fires `UI / Used / JustDraw` alongside
the usual `Document / Created` event, so its adoption is
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
- `/new` → the opening screen on first paint, then the editor on `/document/<id>`, on Start a Space, on Recommended.
- `/new` → the document is created at once, This Browser for a guest, filed in the signed-in person's default folder
  for it.
- Back from the editor after `/new` → the page before `/new`.
- `/document/<id>` (existing) → editor hydrates as before.
- `/document/shared?s=<code>` (visitor) → editor + identity-confirm modal.
- NotFound CTA → goes to `/new`. "New Space" from the Explorer → goes to `/new`.
- `/new?blank=1`, `/new?start=blank` → a blank document, its start closed.
- `/new?blank=1&folder=<id>` → the blank document files into that folder.
- `/new?template=team-pod` → a Team Pod created and the editor loads on it.
- `/new?template=not-a-kind` (a retired one, such as `kanban`, too) → a Blank Space on Start a Space.
- `/new?q=bar` → on the new document Start a Space opens with its search reading "bar".
- `/new?mode=draw` → a Blank Space: the mode is ignored.

## Out of scope for V1

- Animations for the route transition. A spinner is fine.
- A dedicated `/new` landing-page mode for unauthenticated
  users. Auth lands in a future spec.
