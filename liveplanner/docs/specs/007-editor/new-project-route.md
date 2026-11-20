# Dedicated route for new-project creation

`/new` is a creator URL with no screen of its own: visiting it makes a new project (blank, or the template its
`?template=` names), files it where the URL's placement context says, and replaces the address with the new
project's editor, whose empty first tab opens on Start Planning ([Plan mode](../026-plan/plan-mode.md)). Nothing is
asked. The editor route is editor-only.

## Why a route of its own

Creating a project and editing one are different surfaces with different state, so they are different routes. The
editor route only ever opens a project that has an id (`/project/<id>`) or a share code (`/project/shared?s=`), and
never has to decide whether to mint one. `/new` owns the identity settle and the create, end to end, and asks
nothing.

## Goals

- `/new` mints, creates, files and hands off; nothing on it is a choice.
- The editor route is editor-only. Its index (`app/page.tsx`, reached only through the editor app directly, since the
  router serves the marketing home at `/`) forwards a `?s=<code>` to `/project/shared?s=<code>` and anything else to
  `/new`.
- **New Project** (the Explorer, the NotFound card) and every public CTA go to `/new`.

## Non-goals

- The visitor `?s=<code>` flow. A visitor lands on `/project/shared?s=<code>` and confirms their name there; the
  `identityOnlyScreenOpen` mini-flow is the editor's, because it is about the visitor's session, not a new project.
- Choosing a template on `/new`. An empty tab's Start Planning holds the Plan templates, in the editor, where the
  project is already loaded.

## Route map

| Route                  | Purpose                              | State                                                                                                                   |
| ---------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| editor index           | The editor app's own `/`             | Redirect → `/new` (or `/project/shared?s=<code>` when a `?s=` is present). Renders nothing else.                        |
| `/project/<id>`        | Editor for an existing owned project | Static placeholder file fronts every id (see "Path scheme" below). Client reads the id from `window.location.pathname`. |
| `/project/shared?s=<>` | Visitor view of a shared project     | Same placeholder file. Client reads the share code from the `s` query param.                                            |
| `/new`                 | Creator URL, no screen of its own    | Identity, then POSTs the project and hands off to `/project/<id>` in place.                                             |

## Path scheme

Editor URLs use a path segment rather than a query string. `output:
'export'` can't enumerate user-minted UUIDs at build time, so:

1. Next.js builds a single placeholder at `out/project/placeholder/index.html`
   via `generateStaticParams = [{ id: 'placeholder' }]` on the
   dynamic-segment server page. The page wraps a client `EditorPage`
   component that owns the editor logic.
2. The editor worker (`apps/editor/src/worker.ts`) wraps the static-assets
   binding and rewrites any `/project/<anything>` request to
   `/project/placeholder/`. The browser URL stays `/project/<id>`.
3. Client code reads `window.location.pathname` to extract the real
   id. The placeholder id is treated as "no id".
4. In `next dev`, Next.js resolves the dynamic segment natively so the
   same URL works without going through the worker.

There is no `?d=<id>` query scheme.

### Not-found slot renders the editor

`output: 'export'` forces `dynamicParams=false`. The client-side
router compares the current URL against the static manifest on
hydration and fires `notFound()` for any dynamic-segment value not
enumerated in `generateStaticParams`. `placeholder` is the only
enumerated id, so every real project URL triggers `notFound()` the
instant the JS hydrates.

Preventing the trigger does not hold: the static export bakes the framework's default 404 into the `notFound`
slot of the layout's flight payload, and the client router reaches it before any intervention can finish.

So the editor **embraces the trigger**. `apps/editor/app/not-found.tsx`
exports `<EditorPage />` directly. When the client router fires
`notFound()` for an unrecognised id, the layout swaps from
`children` to the `notFound` slot, which is now the editor. The
editor mounts, reads the real id from `window.location.pathname`
(unchanged throughout; no URL swap means no restoration to fight
about), and loads the project via the API. The address bar stays
on `/project/<uuid>`; nothing about the URL needs to lie.

### Unknown addresses

A genuinely unknown address (a mistyped page, `/explorer/mine`, or a page an
older build had) reaches the editor through the same slot. It names no
project (`projectIdFromPath` reads no id off anything but
`/project/<id>`) and carries no share link, so the editor shows the in-app
`<NotFound>` card at once, titled **Page Not Found**
("There is no page at this address. Open a project from the Explorer or
start fresh.") with its **Open Explorer** and **New Project** buttons, and asks
the API for nothing. A project that is missing or not yours gets the same card
titled **Project not found**. The card stands alone under the app header, with
no Explorer panel beside it: its buttons are the way on (Open Explorer goes to
`/explorer`, New Project to `/new`). An embed shows the card with New Project
only, opening the app in a new tab. Only the editor's own empty route (`/project`,
`/project/placeholder`) hands off to `/new`.
A mistyped or retired page never makes a new project.

### Which not-found card

Every refusal the api answers 404 is the same card; what it says depends only on what the visitor brought and who
they are, never on whether the plan exists, so a missing plan and a private one always read alike. The first case that
fits wins (`notFoundReason`, `@liveworkspace/workbench/lib/not-found-reason`, the same in every editor):

- **Page Not Found**: the address names no plan.
- **No Longer Shared With You**: the plan was open a moment ago and access ended.
- **Link Not Valid** ("This link isn’t valid. It may have been turned off or copied incompletely. Ask whoever shared
  it for a new one."): the address carries a share code (`?s=`) the api refused, unknown, revoked or expired alike.
  No "404" line.
- **Plan Not Found** with **Sign In to Request Access** ("This plan doesn’t exist, or you don’t have access to it.", then on its own line "Joining a colleague on this plan? Sign in to request access, and whoever runs it is asked to share it with you."): a signed-out
  visitor. It signs in and comes back to the same address with the request's note open
  ([Request Access](../../../../liveworkspace/docs/specs/004-index/request-access.md#on-screen)).
- **Plan Not Found** ("This plan doesn’t exist or isn’t yours.", then on its own line "Joining a colleague on this plan? Request access, and whoever runs it is asked to share it with you."): anyone else.

**Request Access** ([Request Access](../../../../liveworkspace/docs/specs/004-index/request-access.md#on-screen)) is on the Missing card alone, on this app's own address: a signed-in visitor asks whoever runs the plan to share it with them, with an optional note, and the button then says **Requested** ("If its owner shares it with you, you'll get an email."). The answer is the same for every address, so it tells them nothing about whether the plan exists. Never in an embed or a workbench frame, and never to someone signed out, who signs in first. Where it is not offered (an embed) the Missing card keeps "ask them to share a URL via the Share button."

In an embed a refused share code reads **No Longer Shared** ("This plan is no longer shared at this link. Ask whoever
shared it for a new one.") with no buttons, and the embed's browser tab names the card ("No Longer Shared | liveplanner").
An embed never offers Sign In to Request Access.

### Archived

A plan its owner moved to Archived ([one-explorer.md "Archived"](../../../../liveworkspace/docs/specs/004-index/one-explorer.md#archived))
never opens. The index refuses its grant as `archived` (to its owner; anyone else hears it is missing, and gets
**Plan Not Found**), or this browser holds it archived ([offline-mode.md "Archived Offline"](../006-project/offline-mode.md#archived-offline)).
Either way the editor shows the same card in place of the plan, titled **Plan Archived** ("This plan is archived, so it
can't be opened or edited. Move it out of Archived with Change Folder to work on it again.") with a slate archive-box
tile and no 404. **Change Folder** goes to `/explorer/archived?move=<id>`, where the Explorer opens Change Folder on
it; **Open Explorer** goes to `/explorer`. An embed or a workbench frame shows the card with Open Explorer only (a step
back, in a workspace frame), since nothing inside a frame moves it out. The code is
`@liveworkspace/workbench/lib/archived` and the card's `archived` variant.

The owner opening an archived plan's address directly gets this card, never the load-error screen: the api relays the index's refusal as `409 archived`, which the arrival (`openOwnAddress`, `@liveworkspace/workbench/lib/editor-arrival`) takes as the archived answer (`isArchivedLoadError`), not a failed load. Only that exact answer: any other failure keeps its error screen.

### The tab title

The browser tab names what the page shows. An open plan names it and the tab open in it ("<name> | <tab> | liveplanner", owner 2026-11-17, `editorTabTitle`; "<name> | liveplanner" until the tab is known), following renames and tab switches; a status screen in its place names the screen instead, in Title Case: **Plan Not Found**, **Page Not Found**, **Link Not Valid**, **No Longer Shared With You**, **Plan Archived**, **Plan Deleted**, **Couldn’t Load Plan**, **Password Required** ("Plan Not Found | liveplanner"), so a missing plan's tab never reads as an empty one (`useBrowserTabTitle`'s `status`, held by the editor page's status shell). A load that ends on a status screen pins no tab on the address: the `#t=<tab>` pin waits for a tab whose content has loaded (`useTabEntryEffects`), so the placeholder tab's id never lands on the address of an item that never opened.

### A failed load is not a missing project

NotFound means "this project doesn't exist, or isn't yours". A load
that FAILS (network down, 5xx, share link unresolvable) means
nothing of the sort, and showing NotFound for it tells someone their
work is gone when the server is merely unreachable. So the two are
kept apart: only a clean 404 reaches NotFound, and a thrown request
raises `loadError`, which renders `../packages/workbench/src/components/chrome/ApiErrorPage.tsx`
instead. That card leads with **Retry** (a reload), because unlike a
missing project the condition is expected to clear on its own. The
same card serves the failed-create path on `/new`, with one exception: a
create refused for its **placement** (`team_forbidden`, `folder_not_found`,
`folder_scope_mismatch`, `placement_invalid`, see
[Folders → Placement on create](../013-workspace/folders.md)) will not clear on
a retry, so the card says why and offers **Use the default place** instead.
On `/new`, **Retry** re-runs the same create under the same project and tab
ids it first tried: a create that reached the server but whose answer was lost
is then taken as the re-commit of an id the caller already owns, never a second
project. The same holds one step earlier: the index makes the item before the api
makes its content, so when the content's create is what failed, the Retry finds the
item already there (`409 item_exists`). `apiCreateProject` makes the item through
`createOrResumeItem` (`@liveworkspace/index-client`, [One Explorer: contracts](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "A create that
resumes"), which then asks for the item's grant and, when it is an edit grant (the caller's own item), carries
the create on with it, so the Retry opens the new plan; any other answer fails as before (Work Tracker #397).

The distinction is made at every call site that can fail this way,
the project load and the share-link resolve in `useIdentityBootstrap` (`openOwnAddress` and
`openShareLink`, in `@liveworkspace/workbench/lib/editor-arrival`, with the plan's side in `bootstrap-arrivals.ts`
beside the hook),
and the create in `/new`, rather than in one place, so it is worth
knowing about when adding another.

## Navigation flows

### Owner creates a new project

1. User clicks **New Project** in the Explorer, or follows a link to `/new` from a public page.
2. Browser navigates to `/new`, which shows the opening screen at its "creating" stage at once
   ([The opening screen](#the-opening-screen)).
3. The page mints the project and tab ids and creates the project as soon as it mounts
   ([Creating on arrival](#creating-on-arrival)), where new projects go by default.
4. It hands off to the editor in place ([In-place handoff](#in-place-handoff-to-the-editor)): the address becomes
   `/project/<id>` and the editor opens the new project, its empty first tab on Start Planning.

### Owner opens an existing project

1. Explorer list row click → `window.location.assign('/project/<id>')`.
2. The editor route hydrates; `/new` never loads.

### Visitor follows a share link

1. URL is `/project/shared?s=<code>`.
2. The editor route hydrates through `apiLoadShared`.
3. Visitor identity confirmation (the `identityOnlyScreenOpen` mini-flow)
   stays on the editor route; it's about the visitor, not the project.

### Empty tab on an existing project

1. User clears the active tab's content (or opens a tab that was created empty).
2. An Editor sees Start Planning in the middle of the canvas ([Plan mode](../026-plan/plan-mode.md)).

### Project not found

1. URL is `/project/<id>` but the API returns 404.
2. NotFound surface renders, and its new-project CTA navigates to `/new`.

## Editor route state

The editor route holds no create state: no welcome or template-picker mode and no id mint. A path whose id segment is
the build-time placeholder (`/project`, `/project/placeholder`) with no `?s=` code hands off to `/new` (via
`window.location.assign`) and shows the spinner until the navigation completes.

The editor route keeps:

- The visitor identity confirmation modal (`IdentityPrompt`, open while `identityPromptOpen`; its chrome flag
  `identityOnlyScreenOpen`). Its name field takes at most `MAX_PARTICIPANT_NAME_LEN` (120) characters, the participant route's own cap, so a typed
  name is always one the route saves.
- Everything else: autosave, room, tab management,
  project metadata, share dialog, etc.

## `/new` state

The route (`apps/editor/app/new/page.tsx`) owns:

- The participant-identity bootstrap (same `liveplanner:v2:self-id`
  localStorage key, same `apiLoadSelf` / `apiSaveSelf` API).
- The "name confirmed" persistence (same `liveplanner:v2:name-confirmed` localStorage key).
- The create: mint a UUID, POST `/api/projects` (or create Offline) with the template's tabs inline, or one
  blank tab, then hand off to the editor in place.

## Creating on arrival

`/new` asks **nothing**. It creates the project the URL names the moment it mounts, once only (a ref holds Strict
Mode's second effect off):

- **What:** `?template=<kind>` makes that template (`templateKindOf`); anything
  else, a `?template=` naming no known kind included, makes a blank project: one empty tab in the Default theme, in
  Plan, which opens on Start Planning. Read by `newProjectKind` in `apps/editor/lib/new-project-params.ts`, which the
  workspace frame's create in place reads too. A template link fires `UI / Used / TemplateLink`. The marketing site's
  template gallery links every card here ([Marketing site](../019-marketing/marketing-site.md)).
- **Stored** where [Save Locations → The default depends on who is creating](../006-project/save-locations.md#the-default-depends-on-who-is-creating)
  says: Offline for a guest, liveplanner for a signed-in person. Decided at the create by
  `resolveSaveLocation` (`app/new/useNewProjectLocation.ts`): a guest never waits, and is created without waiting
  for identity at all, a first visit's guest token aside ([Offline Mode → Instant open](../006-project/offline-mode.md#instant-open)); a browser that
  looks signed in waits for identity, so a signed-in person is never handed a project kept Offline.
- **Filed** (liveplanner) in the `/new?folder=` / `?team=` context when there is one, an explicit placement that makes
  the create a cloud one whoever is creating; otherwise the create carries no placement and the server files it in
  the person's [default folder](../013-workspace/default-folders.md) for its intent, else the root of My Work.
  People change where projects go in **Settings > Projects > Default Folders**.
- **Named** after its template (`untitledNameForTemplate`); it is renamed in the editor.
- **Themed** Default (`brand`); the Theme and canvas controls change it later.
- **`?q=<words>`** (trimmed, at most 60 characters, `newProjectQuery`) is handed to the new project's Start Planning
  as its search ([Start Planning](start-panel.md) "Search handed over").
- **`?via=<Surface>.<Slot>`**: the landing funnel's source ([Landing funnel](../019-marketing/landing-funnel.md)),
  added by a public page's CTA. `useCtaAttribution` reads it once, sends `Cta / Opened / <source>`, and strips it from
  the address bar with `history.replaceState` (keeping the other params), so a reload can't count the arrival twice.
  The create then sends `Cta / Created / <source>`, once. An unknown source is stripped and ignored.
- `?blank=1`, `?start=blank`, `?mode=` and `?welcome=1` are not read, so a link carrying one makes a blank project
  (or the `?template=` beside it). Start Blank's link is `/new?start=blank`.

### Back from a restored page

`/new` creates as it mounts, so a back/forward-cache restore of it (before its handoff) backs out instead of creating
again or stranding the person on a frozen screen: to the page of ours that opened it (`history.back()`), else to the
home page (`backOutTarget`, `../packages/workbench/src/lib/back-out.ts`), logging `[new] restored, back out <target>` (the shared `../packages/workbench/src/hooks/ui/useBackOutOnRestore.ts`).

### In-place handoff to the editor

Every create from `/new` opens the editor **without a page load**. Once the project is persisted and
placed, the page rewrites the address bar to `/project/<id>` with
`history.replaceState` and renders the editor component (`EditorPage`, the
same component `/project/<id>` and the not-found slot render) in its own
place. The editor reads the id from `window.location.pathname` on mount, so
it cannot tell the difference from a direct visit.

- **Why:** a hard navigation paid for a second full page load: the editor's
  project, a second sign-in settle, a second identity round trip, and a
  second, visually different loading screen after "Creating…". The in-place
  swap keeps the one signed-in session, the one project, and one continuous
  opening screen.
- **The editor code is fetched ahead.** `/new` starts loading the editor's chunk as soon as it mounts, so the chunk
  downloads in parallel with identity and the create request. If it is not ready at handoff, the opening screen holds
  at its "opening" stage until it is.
- **One wait reads as one screen, however many copies of it mount.** A visit shows the prerendered opening screen,
  then the route's fallback or the editor's own copy while the project loads; each is a fresh mount. None restarts
  its motion: the board drawing and the progress sweep keep their loop's phase from the page's first paint (when the
  prerendered copy, which runs no script, began), the backdrop glows too, and the label plays its entrance only when
  it changes ("Creating" to "Opening"), never for the same label mounting again.
- **The opening screen is the editor's outermost Suspense fallback, so no lazy
  piece inside the editor may suspend up to it.** Every `next/dynamic` import
  in the editor app passes `ssr: false` (or a `loading` component), which gives
  it a boundary of its own; without one, the first open of Settings or Search
  swapped the whole editor for the opening screen until the dialog's chunk
  landed. `lib/dynamic-has-boundary.test.ts` guards it.
- **`replaceState`, not `pushState`:** `/new` is a one-shot creator, so the editor URL takes its history entry. Back
  from the editor returns to the page before `/new`, never to a page that would make another project.
- **Nothing crosses the handoff but the URL.** The editor reads the id from the rewritten path on mount, exactly as
  a direct visit would.
- A failed create never hands off: the retryable error card shows instead.

### The opening screen

One screen covers the whole wait from arrival to the editor: `/new`'s
creating stage and the editor's own load (`ProjectLoading`) render the same
full-screen component, so the handoff above never visibly changes screens.
Its label moves from **"Creating your plan"** to **"Opening your
plan"**; everything else stays put.

- **Surface:** headerless and full height, on the canvas colour
  (`slate-50` / `slate-950`) with the editor's dot grid faded out towards the
  edges and two slowly drifting, blurred brand-tinted glows behind the
  centre. Dark-aware like every screen ([Editor app](editor-app.md)).
- **Centrepiece:** `BoardBuildAnimation`, liveplanner's own loader: a small
  three-column board (To do, Doing, Done) whose cards settle in, then a
  collaborator cursor labelled "You" picks a card up from To do and carries it
  to Doing while the cards below close the gap, moves the Doing card on to
  Done where it gets its tick, and presses "+ Add card" for a fresh card; the
  column counts keep up, then the cards dissolve and the loop restarts. The
  cards are white (dark: slate) with a coloured accent each. livediagram keeps
  its diagram loader; each app's loader shows that app's own work.
- **Continuity:** the loop's phase is measured from the first time the
  animation mounts in the project, so a remount (the creating stage giving
  way to the editor's load) continues the drawing where it was instead of
  restarting it.
- **Progress:** the label sits under the animation with a slim indeterminate
  bar below it. After 10 seconds in the editor's load the screen adds
  "This is taking longer than usual." with a Refresh button. Past that, the
  load's watchdog takes over: one self-healing reload, then the load-error
  screen with its recovery card ([Load recovery](load-recovery.md)).
- **Reduced motion:** the board sits at rest; the cursor, glows
  and bar are still.
- `BoardBuildAnimation` stays a bare illustration (no surface of its own),
  so a card can compose it inside its own.
- **The family:** a loading Sheet shows its sibling `SheetBuildAnimation`
  ([Sheet](../029-sheets/sheet.md#the-sheet-element), "Loading"), the same
  cursor, timing and colours typing data into a small table, with the same
  label and bar. They share `build-animation-kit` (the ease, the cursor,
  the loop's phase) and the bar is the shared `LoadingSweep`, so they stay
  alike.

### Placement rides the create

The URL's placement context travels in the create body as
`{ teamId?, folderId? }`, and the server files the project in the same write
([Folders → Placement on create](../013-workspace/folders.md)). There is no
follow-up placement request, so a project asked for in a team can never be left personal
by a request that failed quietly.

The create also carries the new project's creation `intent` (its first tab's kind and its template family), so a
create with no place chosen lands in the person's [default folder](../013-workspace/default-folders.md) for it,
resolved by the server. The template picked later on a blank's Start Planning may then move it to that template's
default ([Default folders](../013-workspace/default-folders.md) "A template picked after creation").

- **A refused placement** shows the error card (under the app header, titled "New project") with copy for the
  reason, eyebrow "Placement refused", title "Couldn't file the project there", and one action, **Use the default
  place**, which opens `/new` again without the placement params, so the next create goes where new projects go by
  default:
  - `team_forbidden`: "You're not a member of that team, so the project can't be filed in its library."
  - `folder_not_found`: "That folder no longer exists, or isn't yours."
  - `folder_scope_mismatch`: "That folder belongs to a different space from the one you chose."
  - `placement_invalid`: "That isn't a place a project can be filed."
- **Any other failure** keeps the connection copy and **Try again**.
- **Telemetry:** `Team / Added / Project` fires once a create into a team has succeeded,
  never on a refused one.

## Themes

`/new` shows no themes; themes are chosen from the Tab Style dialog. The create path carries a theme id
(`commitNewProject`, `buildTemplatedTab`), always the caller's: `brand` on `/new`, the source tab's theme for a new tab.

## API impact

- No endpoint of its own. `POST /api/projects` accepts an
  optional `tabs` array per [Per-tab storage](../006-project/per-tab-storage.md); the route uses it,
  and the placement `{ teamId?, folderId? }` ([Folders → Placement on create](../013-workspace/folders.md)).

## Tests / sanity-check checklist

- The editor index with no params → redirects to `/new`.
- `/new` → the opening screen, then the editor on `/project/<id>`, its empty tab on Start Planning; Offline for
  a guest, filed in the signed-in person's default folder for it.
- `/new?folder=<id>` → the project files into that folder.
- `/new?template=kanban` → a Kanban project, the editor on `/project/<id>`.
- `/new?template=not-a-kind`, `/new?blank=1`, `/new?mode=draw` → a blank project.
- `/new?q=retro` → Start Planning opens with its search reading "retro".
- Back from the editor → the page before `/new`.
- `/project/<id>` (existing) → the editor hydrates.
- `/project/shared?s=<code>` (visitor) → editor + identity-confirm modal.
- NotFound CTA and the Explorer's New Project → go to `/new`.
