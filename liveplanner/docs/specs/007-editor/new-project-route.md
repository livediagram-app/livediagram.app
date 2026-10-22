# Dedicated route for new-project creation

`/new` is a creator URL with no screen of its own: visiting it makes a new project (blank, or the template its
`?template=` names), files it where the URL's placement context says, and replaces the address with the new
project's editor, whose empty first tab opens on Start Planning ([Plan mode](../026-plan/plan-mode.md)). Nothing is
asked. The editor route is editor-only.

> **Routing note (later change, [Router app](../016-platform/router-app.md)):** the `/live` URL prefix was
> removed — the live app serves at clean routes. So today the editor is
> `/project/<id>` (not `/live/project/<id>`), `/new` is `/new`, and
> there is no bare `/live` entry point (`/` is the marketing home). The
> historical `/live...` URLs below describe the pre-cleanup scheme; map
> each to its `/live`-stripped form. The placeholder-rewrite mechanism
> and the `/new` split itself are unchanged.

## Motivation

`/live` currently serves two distinct experiences from one component:

1. **Editor** — `/live?d=<id>` (owner) or `/live?s=<code>` (visitor).
   State: load project, autosave, room broadcast, etc.
2. **Welcome / Create new** — `/live` with no params. State:
   `templatePickerMode`, `welcomeOpen`, `loadedExistingProject`,
   `nameConfirmed`, and the `commitProjectId()` flow that mints a
   UUID + rewrites the URL via `history.replaceState`.

The overlap is the source of recurring state bugs:

- The "Empty Canvas" flash on `New Project` clicks (multiple
  iterations to land cleanly).
- `templatePickerMode = 'welcome'` showing on existing-project tabs.
- Hydration spinner hangs because the no-params path raced with the
  identity-API roundtrip.
- The `effectiveTemplatePickerMode` derived patch papering over
  conflicts between welcome and per-tab template states.

Each fix touched a different gate. Splitting the two surfaces lets
each one own a clean state model without conditional gates.

## Goals

- A dedicated `/new` route that owns the identity-mint and create flow end-to-end, and asks nothing.
- `/live` becomes editor-only. Hydration only handles `?d=` /
  `?s=` URLs and never has to consider "do I mint an id?".
- Visiting `/live` with no params redirects to `/new` instead
  of trying to be both surfaces at once.
- "New Project" buttons (Explorer + NotFound CTA) navigate to
  `/new`. Existing share / open flows stay on `/live`.

## Non-goals

- Changing the visitor `?s=<code>` flow. Visitors still land on
  `/project/shared?s=<code>` and confirm their name there —
  the `identityOnlyScreenOpen` mini-flow stays in the editor route
  because it's about the visitor's session, not about creating a
  new project.
- Choosing a template on `/new`. An empty tab's Start Planning holds the Plan templates, in the editor, where the
  project is already loaded.

## Route map

| Route                   | Purpose                               | State                                                                                                                   |
| ----------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `/live`                 | Bare entry point                      | Redirect → `/new` (or `/project/shared?s=<code>` if a legacy visitor query is present). Renders nothing else.          |
| `/project/<id>`        | Editor for an existing owned project | Static placeholder file fronts every id (see "Path scheme" below). Client reads the id from `window.location.pathname`. |
| `/project/shared?s=<>` | Visitor view of a shared project     | Same placeholder file. Client reads the share code from the `s` query param.                                            |
| `/new`                  | Creator URL, no screen of its own     | Identity, then POSTs the project and hands off to `/project/<id>` in place.                                           |

## Path scheme

Editor URLs use a path segment rather than a query string. `output:
'export'` can't enumerate user-minted UUIDs at build time, so:

1. Next.js builds a single placeholder at `out/project/placeholder/index.html`
   via `generateStaticParams = [{ id: 'placeholder' }]` on the
   dynamic-segment server page. The page wraps a client `EditorPage`
   component that owns the editor logic.
2. The live worker (`apps/live/src/worker.ts`) wraps the static-assets
   binding and rewrites any `/project/<anything>` request to
   `/project/placeholder/`. The browser URL stays `/project/<id>`.
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
enumerated id, so every real project URL triggers `notFound()` the
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
about), and loads the project via the API. The address bar stays
on `/project/<uuid>`; nothing about the URL needs to lie.

### Unknown addresses

A genuinely unknown address (a mistyped page, `/explorer/mine`, or a page an
older build had) reaches the editor through the same slot. It names no
project (`projectIdFromPath` reads no id off anything but
`/project/<id>`) and carries no share link, so the editor shows the in-app
`<NotFound>` card at once, titled **Page not found**
("There is no page at this address. Open a project from the Explorer or
start fresh.") with its **Open Explorer** and **New Project** buttons, and asks
the API for nothing. A project that is missing or not yours gets the same card
titled **Project not found**. The card stands alone under the app header, with
no Explorer panel beside it: its buttons are the way on (Open Explorer goes to
`/explorer`, New Project to `/new`). An embed shows the card with New Project
only, opening the app in a new tab. Only the editor's own empty route (`/project`,
`/project/placeholder`) hands off to `/new`. Before, every address without a
project id went to `/new`, so a mistyped or retired page made a new project with no word of what went wrong.

### A failed load is not a missing project

NotFound means "this project doesn't exist, or isn't yours". A load
that FAILS — network down, 5xx, share link unresolvable — means
nothing of the sort, and showing NotFound for it tells someone their
work is gone when the server is merely unreachable. So the two are
kept apart: only a clean 404 reaches NotFound, and a thrown request
raises `loadError`, which renders `components/chrome/ApiErrorPage.tsx`
instead. That card leads with **Retry** (a reload), because unlike a
missing project the condition is expected to clear on its own. The
same card serves the failed-create path on `/new`, with one exception: a
create refused for its **placement** (`team_forbidden`, `folder_not_found`,
`folder_scope_mismatch`, `placement_invalid`, see
[Folders → Placement on create](../013-workspace/folders.md#placement-on-create)) will not clear on
a retry, so the card says why and offers **Use the default place** instead.
On `/new`, **Retry** re-runs the same create under the same project and tab
ids it first tried: a create that reached the server but whose answer was lost
is then taken as the re-commit of an id the caller already owns, never a second
project.

The distinction is made at every call site that can fail this way —
the project load and the share-link resolve in `useIdentityBootstrap`,
and the create in `/new` — rather than in one place, so it is worth
knowing about when adding another.

## Navigation flows

### Owner creates a new project

1. User clicks **New Project** in the Explorer (or lands on `/live`), or follows a link to `/new` from a public page.
2. Browser navigates to `/new`, which shows the opening screen at its "creating" stage at once
   ([The opening screen](#the-opening-screen)).
3. The page mints the project and tab ids and creates the project as soon as it mounts
   ([Creating on arrival](#creating-on-arrival)), where new projects go by default.
4. It hands off to the editor in place ([In-place handoff](#in-place-handoff-to-the-editor)): the address becomes
   `/project/<id>` and the editor opens the new project, its empty first tab on Start Planning.

### Owner opens an existing project

1. Explorer list row click → `window.location.assign('/project/<id>')`.
2. Editor route hydrates as today; `/new` never loads.

### Visitor follows a share link

1. URL is `/project/shared?s=<code>`.
2. Editor route hydrates via the existing `apiLoadShared` branch.
3. Visitor identity confirmation (the `identityOnlyScreenOpen` mini-flow)
   stays on the editor route — it's about the visitor, not the project.

### Empty tab on an existing project

1. User clears the active tab's content (or opens a tab that was created empty).
2. An Editor sees Start Planning in the middle of the canvas ([Plan mode](../026-plan/plan-mode.md)).

### Project not found

1. URL is `/project/<id>` but the API returns 404.
2. NotFound surface renders, and its new-project CTA navigates to `/new`.

## State changes in `/live`

Removed from the editor route:

- `templatePickerMode = 'welcome'` and the `effectiveTemplatePickerMode`
  derivation.
- `welcomeOpen` (the chrome-hide trigger for the old New Project modal).
- `commitProjectId()` and every call site (`createShareLink`,
  `skipTemplatePicker`, `chooseTemplate`).
- The "no URL params" branch of hydration. If the pathname's id
  segment resolves to the build-time placeholder and no `?s=` code
  is set, the editor route redirects to `/new` (via
  `window.location.assign`) and renders the spinner until the
  navigation completes.

Kept on the editor route:

- The visitor identity confirmation modal (`IdentityPrompt`, open while `identityPromptOpen`; its chrome flag
  `identityOnlyScreenOpen`).
- Everything else: autosave, room, tab management,
  project metadata, share dialog, etc.

## `/new` state

The route (`apps/live/app/new/page.tsx`) owns:

- The participant-identity bootstrap (same `liveplanner:v2:self-id`
  localStorage key, same `apiLoadSelf` / `apiSaveSelf` API).
- The "name confirmed" persistence (same `liveplanner:v2:name-confirmed` localStorage key).
- The create: mint a UUID, POST `/api/projects` (or create in This Browser) with the template's tabs inline, or one
  blank tab, then hand off to the editor in place.

## Creating on arrival

`/new` asks **nothing**. It creates the project the URL names the moment it mounts, once only (a ref holds Strict
Mode's second effect off):

- **What:** `?template=<kind>` makes that template (`templateKindOf`); anything
  else, a `?template=` naming no known kind included, makes a blank project: one empty tab in the Default theme, in
  Plan, which opens on Start Planning. Read by `newProjectKind` in `apps/live/lib/new-project-params.ts`, which the
  workspace frame's create in place reads too. A template link fires `UI / Used / TemplateLink`. The marketing site's
  template gallery links every card here ([Marketing site](../019-marketing/marketing-site.md)).
- **Stored** where [Save Locations → The default depends on who is creating](../006-project/save-locations.md#the-default-depends-on-who-is-creating)
  says: This Browser for a guest (with sign-in enabled), liveplanner for everyone else. Decided at the create by
  `resolveSaveLocation` (`app/new/useNewProjectLocation.ts`): a guest never waits, and is created without waiting
  for identity at all ([Offline Mode → Instant open](../006-project/offline-mode.md#instant-open)); a browser that
  looks signed in waits for identity, so a signed-in person is never handed a project in This Browser.
- **Filed** (liveplanner) in the `/new?folder=` / `?team=` context when there is one, an explicit placement that makes
  the create a cloud one whoever is creating; otherwise the create carries no placement and the server files it in
  the person's [default folder](../013-workspace/default-folders.md) for its intent, else the root of My Projects.
  People change where projects go in **Settings > Projects > Default Folders**.
- **Named** after its template (`untitledNameForTemplate`); it is renamed in the editor.
- **Themed** Default (`brand`); the Theme and canvas controls change it later.
- **`?q=<words>`** (trimmed, at most 60 characters, `newProjectQuery`) is handed to the new project's Start Planning
  as its search ([Start Planning](start-diagramming.md) "Search handed over").
- **`?via=<Surface>.<Slot>`**: the landing funnel's source ([Landing funnel](../019-marketing/landing-funnel.md)),
  added by a public page's CTA. `useCtaAttribution` reads it once, sends `Cta / Opened / <source>`, and strips it from
  the address bar with `history.replaceState` (keeping the other params), so a reload can't count the arrival twice.
  The create then sends `Cta / Created / <source>`, once. An unknown source is stripped and ignored.
- Older links keep working: `?blank=1`, `?start=blank`, `?mode=` and `?welcome=1` are no longer read, so each makes a
  blank project (or the `?template=` beside it).

### Back from a restored page

`/new` creates as it mounts, so a back/forward-cache restore of it (before its handoff) backs out instead of creating
again or stranding the person on a frozen screen: to the page of ours that opened it (`history.back()`), else to the
home page (`backOutTarget`, `apps/live/lib/back-out.ts`), logging `[new] restored, back out <target>`.

### In-place handoff to the editor

Every create from `/new` opens the editor **without a page load**. Once the project is persisted and
placed, the page rewrites the address bar to `/project/<id>` with
`history.replaceState` and renders the editor component (`EditorPage`, the
same component `/project/<id>` and the not-found slot render) in its own
place. The editor reads the id from `window.location.pathname` on mount, so
it cannot tell the difference from a direct visit.

- **Why:** a hard navigation paid for a second full page load: the editor's
  project, a second Clerk settle, a second identity round trip, and a
  second, visually different loading screen after "Creating…". The in-place
  swap keeps the one Clerk session, the one project, and one continuous
  opening screen.
- **The editor code is fetched ahead.** `/new` starts loading the editor's chunk as soon as it mounts, so the chunk
  downloads in parallel with identity and the create request. If it is not ready at handoff, the opening screen holds
  at its "opening" stage until it is.
- **The opening screen is the editor's outermost Suspense fallback, so no lazy
  piece inside the editor may suspend up to it.** Every `next/dynamic` import
  in the live app passes `ssr: false` (or a `loading` component), which gives
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
Its label moves from **"Creating your project"** to **"Opening your
project"**; everything else stays put.

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
  animation mounts in the project, so a remount (the creating stage giving
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
  so the sso-callback and OAuth consent cards keep composing it inside their
  own card.
- **The family:** a loading Sheet shows its sibling `SheetBuildAnimation`
  ([Sheet](../029-sheets/sheet.md#the-sheet-element), "Loading"), the same
  cursor, timing and colours typing data into a small table, with the same
  label and bar. The two share `build-animation-kit` (the ease, the cursor,
  the loop's phase) and the bar is the shared `LoadingSweep`, so they stay
  alike.

### Placement rides the create

The URL's placement context travels in the create body as
`{ teamId?, folderId? }`, and the server files the project in the same write
([Folders → Placement on create](../013-workspace/folders.md#placement-on-create)). There is no
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

## Custom themes

`/new` shows no themes. Custom themes ([Custom themes](../011-theme/custom-themes.md)) are applied and built from
the Tab Style dialog. The create path still carries a theme id (`commitNewProject`, `buildTemplatedTab` take a
`string`, so a `custom:<uuid>` passes through), always the caller's: `brand` on `/new`, the source tab's theme for a
new tab.

## API impact

- No new endpoints. `POST /api/projects` already accepts an
  optional `tabs` array per [Per-tab storage](../006-project/per-tab-storage.md) — the route uses it,
  and the placement `{ teamId?, folderId? }` ([Folders → Placement on create](../013-workspace/folders.md#placement-on-create)).

## Tests / sanity-check checklist

- `/live` with no params → redirects to `/new`.
- `/new` → the opening screen, then the editor on `/project/<id>`, its empty tab on Start Planning; This Browser for
  a guest, filed in the signed-in person's default folder for it.
- `/new?folder=<id>` → the project files into that folder.
- `/new?template=kanban` → a Kanban project, the editor on `/project/<id>`.
- `/new?template=not-a-kind`, `/new?blank=1`, `/new?mode=draw` → a blank project.
- `/new?q=retro` → Start Planning opens with its search reading "retro".
- Back from the editor → the page before `/new`.
- `/project/<id>` (existing) → editor hydrates as before.
- `/project/shared?s=<code>` (visitor) → editor + identity-confirm modal.
- NotFound CTA and the Explorer's New Project → go to `/new`.
