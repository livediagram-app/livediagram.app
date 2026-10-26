# New design route (`/new`)

Status: shipped

`/new` creates a design and opens it; the editor route, `/design/<id>`, only edits. `/new` asks nothing: there is
one editor mode, Pages, so it makes the design as it mounts (`apps/live/app/new/page.tsx`, the URL read by
`apps/live/lib/new-design-params.ts`) and hands it to the editor in place.

## Route map

| Route                 | Purpose                         | State                                                                                                                   |
| --------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `/design/<id>`        | Editor for an existing design   | Static placeholder file fronts every id (see "Path scheme" below). Client reads the id from `window.location.pathname`. |
| `/design/shared?s=<>` | Visitor view of a shared design | Same placeholder file. Client reads the share code from the `s` query param.                                            |
| `/new`                | Create a design and open it     | Identity, the create, the in-place handoff to the editor.                                                               |
| `/design`             | The editor's own empty route    | Hands off to `/new`.                                                                                                    |

## Path scheme

Editor URLs use a path segment rather than a query string. `output: 'export'` can't enumerate user-minted UUIDs
at build time, so:

1. Next.js builds a single placeholder at `out/design/placeholder/index.html` via
   `generateStaticParams = [{ id: 'placeholder' }]` on the dynamic-segment server page. The page wraps a client
   `EditorPage` component that owns the editor logic.
2. The live worker (`apps/live/src/worker.ts`) wraps the static-assets binding and rewrites any
   `/design/<anything>` request to `/design/placeholder/`. The browser URL stays `/design/<id>`.
3. Client code reads `window.location.pathname` to extract the real id (`designIdFromPath` in
   `apps/live/lib/legacy-editor-path.ts`). The placeholder id and `shared` are treated as "no id". The editor also
   serves the `/diagram/<id>` path (the editor route of designs made in livediagram) and corrects the address bar
   to `/design/<id>`.
4. In `next dev`, Next.js resolves the dynamic segment natively so the same URL works without going through the
   worker.

### Not-found slot renders the editor

`output: 'export'` forces `dynamicParams=false`. The client-side router compares the current URL against the static
manifest on hydration and fires `notFound()` for any dynamic-segment value not enumerated in
`generateStaticParams`. `placeholder` is the only enumerated id, so every real design URL triggers `notFound()` the
instant the JS hydrates, and nothing can prevent it: the static export bakes the framework default 404 into the
`notFound` slot of the layout's flight payload.

So the editor **embraces the trigger**: `apps/live/app/not-found.tsx` renders `<EditorPage />`. When the client
router fires `notFound()` for an unrecognised id, the layout swaps from `children` to the `notFound` slot, which is
the editor. The editor mounts, reads the real id from `window.location.pathname` (never swapped), and loads the
design via the API. The address bar stays on `/design/<uuid>`. The slot loads the editor lazily (`next/dynamic`,
the `OpeningScreen` as its fallback), because Next ships the root not-found slot's code with every route.

### Unknown addresses

A genuinely unknown address (a mistyped page, `/explorer/mine`, a page an older build had) reaches the editor
through the same slot. It names no design and carries no share link, so the editor shows the in-app `<NotFound>`
card at once, titled **Page not found** ("There is no page at this address. Open a design from the Explorer or
start fresh.") with its **Open Explorer** and **New Design** buttons, and asks the API for nothing. A design that is
missing or not yours gets the same card titled **Design not found**, and a design whose share ended **No Longer
Shared With You**. The card stands alone under the app header, with no Explorer panel beside it: Open Explorer goes
to `/explorer`, New Design to `/new`. An embed shows the card with New Design only, opening the app in a new tab.
Only the editor's own empty route (`/design`, `/design/placeholder`) hands off to `/new`, so a mistyped page never
makes a design.

### A failed load is not a missing design

NotFound means "this design doesn't exist, or isn't yours". A load that FAILS (network down, 5xx, share link
unresolvable) means nothing of the sort, so the two are kept apart: only a clean 404 reaches NotFound, and a thrown
request raises `loadError`, which renders `../packages/workbench/src/components/chrome/ApiErrorPage.tsx` instead.
That card leads with **Retry** (a reload). The same card serves the failed create on `/new`, with one exception: a
create refused for its **placement** (below) will not clear on a retry, so the card says why and offers **Choose
another place** instead. On `/new`, **Retry** re-runs the same create under the same design and tab ids it first
tried: a create that reached the server but whose answer was lost is then taken as the re-commit of an id the
caller already owns, never a second design.

The distinction is made at every call site that can fail this way (the design load and the share-link resolve in
`useIdentityBootstrap`, and the create in `/new`) rather than in one place, so it is worth knowing about when
adding another.

## Navigation flows

- **Owner creates a design:** New Design (the Explorer, the NotFound card, a public page's CTA) navigates to
  `/new`, which shows the opening screen at its "Creating your design" stage, makes the design where new designs
  go by default, and hands it to the editor in place. The empty tab opens on its start, where the Pages templates
  are ([Template start](start-diagramming.md)).
- **Owner opens a design:** an Explorer row opens `/design/<id>`; the create never loads.
- **Visitor follows a share link:** `/design/shared?s=<code>` hydrates the editor's share branch; the visitor's
  name prompt (`IdentityPrompt`, while `identityPromptOpen`) is the editor's, since it is about the visitor's
  session, not about creating a design.
- **Empty tab:** an Editor sees the template start in the middle of the canvas
  ([Template start](start-diagramming.md)); a Participant or Viewer sees the empty canvas, since the start is
  never offered to a read-only session (`templateStartMode`).

## `/new` state

The route owns:

- The participant-identity bootstrap (the guest token under `livedesign:v2:guest-token`, `apiLoadSelf` /
  `apiSaveSelf`) and the "name confirmed" flag (`livedesign:v2:name-confirmed`).
- The create: mint the design and tab ids, write the design with its tab(s), and hand off to the editor.

A back/forward-cache restore of `/new` never re-creates: `/new` creates as it mounts, so a restore backs out to the
page that opened it (`history.back()` when the browser came from another page of this site, else the home page),
logging `[new] restored, back out <target>`.

## What `/new` makes

- **Which design:** the template `?template=<kind>` names (`newDesignKind`), a blank for `?blank=1`, else one empty
  tab that opens on its start. An unknown template kind is ignored rather than guessed, so a stale link makes a
  design, not a 404; a retired kind opens its replacement (`templateKindOf`). `blank` wins when both are present.
- **Stored** where [Save Locations → The default depends on who is creating](../006-design/save-locations.md#the-default-depends-on-who-is-creating)
  says: This Browser for a guest, livedesign for a signed-in person. Decided at commit by `resolveSaveLocation`
  (`app/new/useNewDesignLocation.ts`): a guest never waits, a browser that looks signed in waits for identity, so a
  signed-in person is never handed a design in This Browser. A guest's This Browser design is created without
  waiting for identity at all (`offlineCreateDesign`, [Offline Mode → Instant
  open](../006-design/offline-mode.md#instant-open)). A placement param (`folder` / `team`) names a server place, so
  it makes the create a cloud one whoever is creating.
- **Filed** in the `/new?folder=` / `?team=` context when there is one (an explicit placement); otherwise the create
  carries no placement and liveworkspace's index files it in the person's
  [default folder](../013-workspace/default-folders.md) for its intent, else the root of My Work.
- **Named** after its template (`untitledNameForTemplate`); it is renamed in the editor.
- **Themed** Default (`NEW_DESIGN_THEME_ID`, `brand`): the Tab Style dialog changes it later. `/new` shows no themes.
- People change where designs go in **Settings › Designs › Default Folders**, and move a design between livedesign
  and this browser afterwards ([Offline Mode](../006-design/offline-mode.md)).

Every answer a creation step could ask (name, store, folder, theme) has a later, better home, so `/new` asks none.

## Start Blank

**Start Blank** is the name of the `?blank=1` link (Explorer Home's first-run blanks) and of the public sites'
`/new?start=blank` ([Marketing site](../019-marketing/marketing-site.md#start-blank)). Both make a blank design whose
start is already closed (`newDesignStartsBlank`, `closeStartForBlank`), so whoever asked for a blank is not shown
templates.

- The placement context params compose with it (`/new?blank=1&folder=<id>`, `/new?blank=1&team=<id>`), so a caller
  can Start Blank straight into a folder or team.
- No tour is queued on this path or any other: the [Pages tour](pages-tour.md) waits on the footer's Start Tour
  button.

### The other parameters

- **`/new?template=<kind>`** makes that template. This is the URL the marketing site's template gallery links every
  card to ([Marketing site](../019-marketing/marketing-site.md)); it fires `UI / Used / TemplateLink`.
- **`/new?q=<words>`** (trimmed, at most 60 characters, `SEARCH_PRESET_MAX`) is handed to the new design's start as
  its search ([Template start](start-diagramming.md) "Search handed over"). An empty `q` is ignored.
- **`/new?via=<Surface>.<Slot>`**: the landing funnel's source ([Landing funnel](../019-marketing/landing-funnel.md)),
  added by a public page's CTA and combinable with every param above. `useCtaAttribution` reads it once, sends
  `Cta / Opened / <source>`, and strips it from the address bar with `history.replaceState` (keeping the other
  params), so a reload or Back can't count the arrival twice. The create then sends `Cta / Created / <source>`,
  once. An unknown source is stripped and ignored.
- **`?mode=`** is not read: there is one mode.

### In-place handoff to the editor

Every create from `/new` opens the editor **without a page load**. Once the design is persisted and placed, the page
rewrites the address bar to `/design/<id>` with `history.replaceState` and renders the editor component
(`EditorPage`, the same component `/design/<id>` and the not-found slot render) in its own place. The editor reads
the id from `window.location.pathname` on mount, so it cannot tell the difference from a direct visit.

- **Why:** a hard navigation would pay for a second full page load (the editor's design, a second sign-in settle, a
  second identity round trip, a second loading screen). The in-place swap keeps one signed-in session, one design
  and one continuous opening screen.
- **The editor code is fetched ahead.** `/new` starts loading the editor's chunk as soon as it mounts, so the chunk
  downloads in parallel with identity and the create request. If it is not ready at handoff, the opening screen
  holds at the "Opening your design" stage until it is.
- **The opening screen is the editor's outermost Suspense fallback, so no lazy piece inside the editor may suspend
  up to it.** Every `next/dynamic` import in the live app passes `ssr: false` (or a `loading` component), which gives
  it a boundary of its own; `lib/dynamic-has-boundary.test.ts` guards it.
- **`replaceState`, not `pushState`:** `/new` is a one-shot creator, so the editor URL takes its history entry.
  Reload and Back behave exactly as they do after a direct `/design/<id>` visit.
- **Nothing crosses the handoff but the URL and `sessionStorage`** (the start's handed search, `handStartQuery`, and
  the template-pick note, `handTemplatePick`).
- A failed create never hands off: the error card shows instead.

### The opening screen

One screen covers the whole wait from the click to the editor: `/new`'s creating stage and the editor's own load
(`DesignLoading`) render the same full-screen component, so the handoff never visibly changes screens. Its label
moves from **"Creating your design"** (detail line "Setting up a fresh canvas") to **"Opening your design"**
("Getting everything in place"); everything else stays put.

- **Surface:** headerless and full height, on the canvas colour (`slate-50` / `slate-950`) with the editor's dot grid
  faded out towards the edges and two slowly drifting, blurred brand-tinted glows behind the centre. Dark-aware like
  every screen ([Live app](live-app.md)).
- **Centrepiece:** the shared `DesignBuildAnimation` (`@livedesign/ui`): on an artboard the collaborator cursor
  labelled "You" draws a mark with the pen, its anchors and handles showing; the path closes and fills, a cut-out
  lands, the cursor scales it by a corner with smart guides and picks a new colour from the swatches, then a sparkle
  and the loop restarts.
- **Continuity:** the loop's phase is measured from the first time the animation mounts in the page, so a remount
  (the creating stage giving way to the editor's load) continues the drawing where it was.
- **Progress:** the label sits under the animation with a slim indeterminate bar (the shared `LoadingSweep`) below
  it. After 10 seconds in the editor's load the screen adds "This is taking longer than usual." with a Refresh
  button. Past that, the load's watchdog takes over: one self-healing reload, then the load-error screen with its
  recovery card ([Load recovery](load-recovery.md)).
- **Reduced motion:** the drawing sits finished; the cursor, pulses, glows and bar are still.
- `DesignBuildAnimation` is a bare illustration (no surface of its own), so a card can compose it inside its own.

### Placement rides the create

The URL's placement context travels in the create body as `{ teamId?, folderId? }`, with the new design's creation
`intent` (`creationIntentOf`), and the index files the design in the same write
([Folders → Placement on create](../013-workspace/folders.md#placement-on-create)). There is no follow-up placement
request, so a design asked for in a team can never be left personal by a request that failed quietly. With no place
chosen, the index files it in the person's [default folder](../013-workspace/default-folders.md) for its intent. A
blank is filed by its intent; the template picked later on its start may then move it to that template's default
([Default folders](../013-workspace/default-folders.md) "A template picked after creation").

- **A refused placement** shows the error card (`app/new/create-failure.ts`) with copy for the reason, eyebrow
  "Placement refused", title "Couldn't file the design there", and one action, **Choose another place**, which reopens
  `/new` without the placement params (`choosePlacementAgainUrl`), so the next create goes where new designs go by
  default:
  - `team_forbidden`: "You're not a member of that team, so the design can't be filed in its library."
  - `folder_not_found`: "That folder no longer exists, or isn't yours."
  - `folder_scope_mismatch`: "That folder belongs to a different space from the one you chose."
  - `placement_invalid`: "That isn't a place a design can be filed."
- **Any other failure** keeps the connection copy and **Try again**.

### Telemetry

A successful create sends `Document / Created / Cloud|Offline`, `Theme / Changed / <theme>`, `Template / Used /
<kind>` when a template was named, `Cta / Created / <source>` after a CTA arrival, and `Team / Added / Design` once a
create into a team has succeeded, never on a refused one ([Telemetry](../017-telemetry/telemetry.md)).

## Tests

- `/new` → the opening screen, then the editor on `/design/<id>`, on its start.
- `/design/<id>` (existing) → the editor hydrates.
- `/design/shared?s=<code>` (visitor) → the editor and the name prompt.
- An unknown address → Page not found, no API call; a missing design → Design not found.
- `/new` → created at once, This Browser for a guest, filed in the signed-in person's default folder for it.
- `/new?blank=1` → a blank design, its start closed; `/new?blank=1&folder=<id>` files it into that folder.
- `/new?template=not-a-kind` → a design that opens on its start.
- `/new?q=logo` → the new design's start opens with its search reading "logo".
- A refused placement → the Placement refused card; Choose another place → `/new` without the placement.
