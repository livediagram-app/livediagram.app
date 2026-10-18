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
document id went to `/new`, so a mistyped or retired page opened the New
Document wizard with no word of what went wrong.

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
3. `/new` renders the welcome card immediately — no spinner.
4. User picks a mode, which creates the document at once, where new documents go by default
   ([One-step wizard](#one-step-wizard)). The header **X** backs out to the page that opened
   `/new`, creating nothing, as Escape does; see [Escape backs out](#escape-backs-out).
5. Page mints a UUID, POSTs `/api/documents` with the seeded tab(s),
   then `window.location.assign('/document/<id>')` to land on
   the editor with the new document already on the server.
6. On the editor route, hydration extracts the id from the pathname
   and fetches the document + tab content. No mint, no welcome gate. The empty tab
   opens on its mode's start, where its templates are
   ([Template starts](start-diagramming.md)).

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
2. An Editor sees the mode's start in the middle of the canvas (Start Diagramming,
   Start Facilitating, Start Making Pages, Start Planning; [Template starts](start-diagramming.md));
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
  `identityOnlyScreenOpen`). The per-tab template picker (Quick Start) that also lived here was removed: an empty
  tab's templates are on its mode's start.
- Everything else: autosave, room, tab management,
  document metadata, share dialog, etc.

## `/new` state

The new route owns:

- The participant-identity bootstrap (same `livediagram:v2:self-id`
  localStorage key, same `apiLoadSelf` / `apiSaveSelf` API).
- `templatePickerMode = 'welcome'` (only).
- The mode choice (as the mode's blank template) locally until the user commits.
- The "name confirmed" persistence (same
  `livediagram:v2:name-confirmed` localStorage key).
- On commit: mint a UUID, POST `/api/documents` with the
  templated tab(s) inline, navigate to `/document/<id>`.
- On Skip: mint a UUID, POST an empty-tab document, navigate to
  `/document/<id>` so the user lands on the editor with a
  fresh document already persisted.

## Escape backs out

**Escape backs you out of whatever you just clicked**, one screen at a time, and never
creates anything:

- **On `/new`:** back to the screen that opened it, at once (the step has
  no search; a `?q=` preset waits for the new document's start). When the
  browser came from another page of this site (the home page's Diagram or Brainstorm,
  the header's Choose Template, the Explorer's New Document), it goes back there,
  as the browser's Back would (`history.back()`), so that page returns as it was.
  With nothing of ours to go back to (the URL typed, or opened from another site),
  it goes to the home page (`/`). Nothing is created: Escape is not Skip, which
  still commits a blank document.
- **The header X backs out the same way:** it closes the wizard
  and goes back to the page that opened `/new` (or home), creating nothing. A
  close button and Escape mean the same thing ("Escape: Closes the dialog", and
  a close button "that closes the dialog", in the WAI-ARIA dialog pattern), so
  they never do different things.

Why. Escape is the one key every desktop user already knows as "get me out of this"
(literally: escape), and a way out that costs nothing is what makes people feel safe
clicking around. Opening the template picker from the home page was a question, not a
commitment: backing out of it must not leave a new document behind.

- Nielsen Norman Group's heuristic #3, **User control and freedom**: "Users often choose
  system functions by mistake and will need a clearly marked 'emergency exit' to leave
  the unwanted state without having to go through an extended dialogue", and "allow
  them to exit a flow or undo their last action and go back to the system's previous
  state"; "when it's easy for people to back out of a process or undo an action, it
  fosters a sense of freedom and confidence"
  ([User control and freedom](https://www.nngroup.com/articles/user-control-and-freedom/),
  [10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)).
- The W3C WAI-ARIA Authoring Practices, **Dialog (Modal) pattern**, keyboard
  interaction: "Escape: Closes the dialog"
  ([Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)).
- The HTML `<dialog>` element closes on Escape as a **cancel** (`cancel` event, return
  value unset): the platform treats Escape as "back out without choosing"
  ([MDN: `<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog)).

Every back-out logs `[new] back out <target>` (`back` or `home`) and
reports `UI` · `Closed` · `NewDocument` ([Telemetry](../017-telemetry/telemetry.md)).

## Responsive layout

The New Document wizard (`apps/live/components/palette/NewDocumentWizard.tsx`) on `/new` and the visitor name prompt (`apps/live/components/palette/IdentityPrompt.tsx`) over the editor are two cards of one build. On `sm:` and up each renders as a centred floating card (max 44rem for the wizard, 26rem for the name prompt), with rounded corners + shadow over the canvas. On mobile (below `sm`) it fills the viewport edge-to-edge: full width, full dynamic-viewport height, no border / radius / shadow, so the user can read every row and click through without zoom. The footer's Create button (the name prompt's Join and Cancel) stays reachable because the body scrolls inside the card while the header + footer remain pinned (mobile and desktop alike).

The card has no backdrop, so the editor header stays live beside it. It stacks on the `canvas-modal` rung: above every canvas surface, beneath the header, so the header's menus (the apps menu, the account menu) open in front of the card rather than behind it.

This is the only welcome surface so it sets the mobile floor for the rest of the editor's panel chrome (Palette / Context / Explorer, see [07-live-app](live-app.md)). Those are addressed separately.

## Jump Back In (recent documents card)

Returning users get a **"Jump Back In" card** pinned to the right of the
centred wizard (desktop `xl+` only — below that the wizard owns the width):
the 5 most recently-saved documents they own or that sit in a team they have
joined (the same list as the landing page's Welcome back,
[Returning visitor](../019-marketing/returning-visitor.md)), each row opening that
document directly, with a relative "saved N ago" line. A team document's name
follows the team mark (the Explorer's team icon), read out as "<team> team:". It is a side affordance,
deliberately separate from the create flow, and hidden entirely for someone
with no documents yet, of their own or their teams' (best-effort fetch — a failure just means no shortcut).
A footer link **"Open Explorer"** goes to `/explorer/recent`, the same list
uncapped, so users with more history than the card shows have a way into the
full library. Component: `apps/live/app/new/RecentDocumentsCard.tsx`.

## Choosing a mode

The wizard's first step asks **what you are making**, as the five editor modes, never a template
(`NewDocumentModeStep`, `components/palette/NewDocumentModeStep.tsx`). The templates wait on the canvas, in the
mode's own start ([Template starts](start-diagramming.md)); the marketing site's gallery is where every template is
browsed before signing up.

- **Heading:** "What are you making today?"
- **Five mode cards**, in the order every mode list shows them (`EDITOR_MODES`: Diagram, Draw, Facilitate,
  Pages, Plan), three then two from 640px (a six-track grid: the first row's cards take two tracks each, the
  second row's three, `modeCardSpan`; one column on a phone). Every card has the same build and, across both rows,
  the same height (`auto-rows-fr`), so **Diagram**, first there and where most start, leads the top row as an equal
  rather than a wide, short strip. The cards carry no template names and no "Most Popular" badge.
- **Each card:** a fan of its own templates' previews on top (`PreviewFan`, the mode's Popular shelf less its blank)
  wider on hover, then the mode's mark, its name and its **number key** (1 to 5, a small key cap at the row's end,
  hidden on a phone, which has no keys), then a line on what it makes in the words of the work ("Flowcharts, mind
  maps, org charts and architecture, snapped neatly into place."). The number is `aria-hidden`; the card carries it
  as `aria-keyshortcuts`.
- **Choosing a card creates the document at once**, as an empty tab of the mode's blank (`BLANK_TEMPLATE_FOR_MODE`),
  which opens on its start.
- **Keyboard:** the chosen (else the first) card is focused on a fine pointer; the arrow keys move between cards,
  and 1 to 5 choose one straight away.
- **`?mode=`** preselects that mode's card (and its blank for **Create**); **`?q=`** is handed to the new document's
  start as its search ([Template starts](start-diagramming.md) "Search handed over").

## One-step wizard

The welcome screen asks **one question**, what you are making, and creates the document as soon as it is
answered. It does not ask where the document goes or what it is called:

- **Mode.** [Choosing a mode](#choosing-a-mode). Footer: **Open Existing Document** on the left, then **Skip**
  and **Create**. Choosing a card creates at once; **Create** creates the chosen card (a `?mode=` preset), else a
  Blank Diagram.
- **No Location step.** The document goes where new documents go by default, so the person is never asked:
  - **Stored** where [Save Locations → The default depends on who is creating](../006-document/save-locations.md#the-default-depends-on-who-is-creating)
    says: This Browser for a guest (with sign-in enabled), livediagram for everyone else. Decided at commit by
    `resolveSaveLocation`, the same as the bypass links: a guest never waits, a browser that looks signed in waits
    for identity, so a signed-in person is never handed a document in This Browser.
  - **Filed** (livediagram) in the `/new?folder=` / `?team=` context when there is one, an explicit placement;
    otherwise the create carries no placement and the server files it in the person's
    [default folder](../013-workspace/default-folders.md) for its intent, else the root of My Documents.
  - **Named** after its template ("Untitled Diagram", `untitledNameForTemplate`); it is renamed in the editor.
  - People change where documents go in **Settings > Documents > Default Folders**, and move a document between
    livediagram and this browser afterwards ([Offline Mode](../006-document/offline-mode.md)).
  - Why: the step asked three questions (name, store, folder) most people answer with the default, before they
    have anything on the canvas. Every answer has a later, better home (the title, Default Folders, Sync Document
    or Take Offline), so asking up front only slowed the first document down.
- **No step rail.** One step needs no progress indicator.
- **There is no theme step.** A new document starts on the **Default** theme,
  and the Theme and canvas controls change it later; asking for a theme before
  anything is on the canvas was a decision most people could not yet make.
- **Skip** commits the documented defaults straight away: the **Blank** template and the **Default** theme, with
  its start closed. The header **X** backs out without creating anything ([Escape backs out](#escape-backs-out)).
- A bottom-left **Open Existing Document** button navigates to `/explorer`. The
  `/new` route therefore does **not** render an Explorer panel of its own (it
  used to float one as the escape hatch); the button is the single, unambiguous
  way out, which is less confusing.
- The **Create** button shows an inline spinner and disables while the
  create is in flight (`busy` prop, fed from the page's `submitting`
  state), so a slow network gives feedback and can't double-submit; a mode card chosen meanwhile creates nothing.

The wizard renders **immediately** with no identity spinner: the step is static
mode data, so there's nothing to wait for. Identity resolves in the
background, and the create waits for it (`resolveSelf`) only when it has to.

There is **no template picker over the editor**. An empty tab's templates are on its mode's own start
([Template starts](start-diagramming.md)); the visitor name prompt (`IdentityPrompt`) is the only card the editor
shows over the canvas. (The in-editor **Quick Start**, the whole catalogue across every mode in one modal, was
removed with the starts' **Something Else**: each start already holds every template of its mode, and the mode
switch reaches the others.)

### A choice before hydration

`/new` is a static export, so the mode cards are on screen before React attaches their handlers. A card clicked in
that gap is **kept, not lost**: an inline script in the page (`app/new/early-mode-choice.ts`), running as the HTML
parses, takes a click on a mode card until the wizard mounts, remembers the mode, and shows the progress cursor. The
wizard's first layout effect turns the script off and creates the remembered mode, exactly as if the click had landed
after hydration. The script listens on `window` in the capture phase, ahead of React's root listener, so a click it
takes never also reaches the card, and only one document is made. Before this, a click in the gap did nothing and said
nothing, and the slower the device the wider the gap (issue #238). Number keys pressed before hydration are not kept:
the cards are not focused until the wizard mounts.

### The empty-canvas hint

The **empty-canvas hint** is a calm **card in the middle of the canvas** (`EmptyCanvasBanner`), shown while the
active tab has no elements to someone who cannot edit it: an Editor gets the mode's start instead ([Template
starts](start-diagramming.md)). A **Viewer** reads "Nothing here yet. The owner can build it out, and your view
updates live."; a **Participant** is pointed at a sticky, text or an image. It shows in Diagram and Facilitate; Draw
(its dock is the hint, [Draw mode](../023-draw-mode/draw-mode.md)), Pages and Plan show none. It offers no action
of its own: an Editor's empty tab shows its start instead, and **Help** on a desktop. It goes once the
canvas has content, and a **Close** (×) in its top right corner closes it for good on that tab for this person in
this browser (a per-browser list of the last 200 closed keys, `livediagram:v2:empty-card-dismissed` in localStorage,
shared with the starts' own close). It takes presses only on itself: the canvas around it still pans. It hides while
a draw tool is armed. The card: a small picture of what the tab's mode makes, in the brand's
tints on a soft panel (`EmptyCanvasArt`), "Tab 1 is empty" (15 px semibold), then its one line, in full. **On a
phone** it is the same card, narrower (18rem). On a **short screen** (480px tall or less, a phone on its side) the card
drops its picture, so it clears the toolbars above and below instead of sliding under the Palette strip.

A soft, decorative **animated backdrop** (`AnimatedLinesBackdrop`) sits behind
the card: thick multi-colour curved lines that slowly flow along their paths via
animated `stroke-dashoffset`. It is pure SVG + CSS (no per-frame JS),
`pointer-events-none` / `aria-hidden`, and stands down under
`prefers-reduced-motion`.

## Start Blank (skip the wizard)

**Start Blank** is the name of the `?blank=1` bypass (and of Explorer Home's first-run blanks), and of the public sites' link to the wizard, `/new?start=blank` ([Start Blank after a mode](#start-blank-after-a-mode)); it was
"Just Draw" until the hero's **Drawing** came to mean a whiteboard. Its telemetry token stays
`JustDraw`, so the funnel's history reads on unbroken.

Some users don't want to choose even a mode — they want
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
  Start Blank straight into a folder or team library. A failed create shows
  the same retryable error card as the wizard path. This is the URL a
  start that wants no choice links to (Explorer Home's first-run Start Blank; the public sites'
  Start Blank asks for a mode first, see [Start Blank after a mode](#start-blank-after-a-mode)).
  - The handoff replaces the `/new?blank=1` history entry with
    `/document/<id>`, so Back from the editor returns to the page before
    `/new` (usually the marketing site), never to a page that would mint
    another blank document. Should the browser still restore a bypass
    `/new` from the back/forward cache before the handoff happened, it
    redirects to the plain `/new` wizard rather than silently minting
    another blank document or trapping the user behind a page that always
    navigates forward again.
  - The Diagram tour's welcome offer ([Diagram tour ("Getting started with Diagrams?")](editor-tour.md)) is not queued on
    this path: the create fires before the document count resolves, and a
    Start Blank user has asked to get straight to the canvas.
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
- **Where these links store the document**: the default for who is creating
  ([Save Locations → The default depends on who is creating](../006-document/save-locations.md#the-default-depends-on-who-is-creating),
  `resolveSaveLocation` in `app/new/useNewDocumentLocation.ts`). A guest gets a
  document in This Browser, created without waiting for identity at all
  ([Offline Mode → Instant open](../006-document/offline-mode.md#instant-open));
  a signed-in person's create still waits for auth to settle. A placement param
  (`folder` / `team`) names a server place, so it makes the create a cloud one
  whoever is creating.
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
- **`/new?mode=<mode>` and `/new?q=<words>`**: `mode` (any editor mode) preselects that mode's
  card, and its blank, so **Create** starts in it; `q` (trimmed, at most 60 characters)
  is handed to the new document's start as its search, so the templates it meant are the ones shown
  ([Template starts](start-diagramming.md) "Search handed over"). They compose with each other and
  with the placement params, and are not a bypass: nothing is committed until the author chooses.
  An unknown mode, or an empty `q`, is ignored. The static page's HTML is the unselected step, so a
  pre-paint guard (`data-wizard-preset`, like the bypass's) hides the wizard card (`visibility`, so
  nothing moves) until React has rendered the preset. Read by
  `wizardPresetMode` and `wizardPresetQuery` in `apps/live/lib/new-document-params.ts`. The
  marketing hero's **Build yours** buttons link here ([Marketing site](../019-marketing/marketing-site.md)).
- **`?welcome=1`** is no longer read. It marked the marketing hero's launch window, which grew
  into a blank canvas the editor then held through its load; the launch window and that quiet
  landing were removed together, so an old `/new?blank=1&welcome=1` link opens as `?blank=1` does.
- **`/new?via=<Surface>.<Slot>`**: the landing funnel's source
  ([Landing funnel](../019-marketing/landing-funnel.md)), added by a public page's CTA and
  combinable with every param above. `useCtaAttribution` reads it once,
  sends `Cta / Opened / <source>`, and strips it from the address bar with
  `history.replaceState` (keeping the other params), so a reload or Back
  can't count the arrival twice. Whichever path commits the document (Create,
  Skip or a bypass) then sends `Cta / Created / <source>`, once. An unknown
  source is stripped and ignored.
- **No "Start Blank" button inside the wizard.** The footer's **Skip** already commits the same blank defaults, and
  Start Blank now lives only on the surfaces that link to
  `/new?blank=1`.

### Start Blank after a mode

**`/new?start=blank`** is the public sites' **Start Blank** ([Marketing site](../019-marketing/marketing-site.md#start-blank)).
It is **not a bypass**: the wizard shows as usual and asks for a mode. The mode chosen (a card, a number key, a card
clicked before hydration, or **Create**) makes that mode's blank exactly as without the flag, but opens it **with its
start closed** (`closeStartForBlank`), as Skip's Blank Diagram does, so whoever asked for a blank is not shown
templates again. Plan's start cannot be closed (it is where a board or sheet is picked), so a Plan blank keeps it.

- Read by `wizardStartsBlank` (`lib/new-document-params.ts`) at the moment of the create: only the exact value
  `blank` counts; any other `start` value, or none, keeps the start.
- Composes with the placement context (`?folder=`, `?team=`) and `?via=`, and with `?mode=` (the preset card).
- `?blank=1` and `?template=` still win: with either, the wizard is bypassed and the flag has nothing to change.

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

Every create from `/new` honours the URL placement context (the `?folder` /
`?team` pre-seed): the document files there, not silently at the personal root.

### Placement rides the create

The URL's placement context travels in the create body as
`{ teamId?, folderId? }`, and the server files the document in the same write
([Folders → Placement on create](../013-workspace/folders.md#placement-on-create)). There is no
follow-up placement request, so a document asked for in a team can never be left personal
by a request that failed quietly.

The create also carries the new document's creation `intent` (its first tab's editor mode
its first tab's kind and its template family), so a create with no place chosen lands in the person's
[default folder](../013-workspace/default-folders.md) for it, resolved by the server. A mode's blank made by the
wizard is filed by its mode; the template picked later on its start screen may then move it to that template's
default ([Default folders](../013-workspace/default-folders.md) "A template picked after creation").

- **A refused placement** shows the error card with copy for the reason, eyebrow
  "Placement refused", title "Couldn't file the document there", and one action,
  **Choose another place**, which reopens `/new` without the bypass and placement params, so the
  next create goes where new documents go by default:
  - `team_forbidden`: "You're not a member of that team, so the document can't be filed in its library."
  - `folder_not_found`: "That folder no longer exists, or isn't yours."
  - `folder_scope_mismatch`: "That folder belongs to a different space from the one you chose."
  - `placement_invalid`: "That isn't a place a document can be filed."
- **Any other failure** keeps the connection copy and **Try again**.
- **Telemetry:** `Team / Added / Document` fires once a create into a team has succeeded,
  never on a refused one.

Telemetry: the Start Blank bypass (`/new?blank=1`) fires `UI / Used / JustDraw` alongside
the usual `Document / Created` event, so wizard-bypass adoption is
measurable ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).

## Custom themes

With the theme step retired, the picker no longer shows themes at all. Custom
themes ([Custom themes](../011-theme/custom-themes.md)) are applied and built from
the Tab Style dialog, which renders the same `CustomThemePicker` the theme
step used. The create path still carries a theme id (`onPick`,
`commitNewDocument`, `buildTemplatedTab` take a `string`, so a `custom:<uuid>`
passes through), now always the caller's: `brand` on `/new`, the source tab's
theme for a new tab.

## API impact

- No new endpoints. `POST /api/documents` already accepts an
  optional `tabs` array per [Per-tab storage](../006-document/per-tab-storage.md) — the new route uses it,
  and the placement `{ teamId?, folderId? }` ([Folders → Placement on create](../013-workspace/folders.md#placement-on-create)).

## Tests / sanity-check checklist

- `/live` with no params → redirects to `/new`, no flash.
- `/new` → welcome card on first paint.
- Pick a mode → Create → editor loads on `/document/<id>`, on the mode's start.
- Close the welcome via the header X → back to the page that opened `/new`
  (or home), no document created.
- `/document/<id>` (existing) → editor hydrates as before.
- `/document/shared?s=<code>` (visitor) → editor + identity-confirm modal.
- NotFound CTA → goes to `/new`.
- "New Document" from Explorer → goes to `/new`.
- `/new` from the home page, Escape → back on the home page, no document created.
- `/new` typed in, Escape → the home page.
- `/new`, choose a mode → the document is created at once, This Browser for a guest, filed in the
  signed-in person's default folder for it.
- `/new?blank=1` → no wizard; blank document created and editor loads on
  `/document/<id>`.
- `/new?blank=1&folder=<id>` → the blank document files into that folder.
- `/new?template=kanban` → no wizard; a Kanban diagram created and the
  editor loads on `/document/<id>`.
- `/new?template=not-a-kind` → the plain wizard.
- `/new?template=whiteboard` → no wizard; a document created whose tab opens
  in Draw mode ([Editor modes](editor-modes.md)), the Ink pen in hand.
- `/new?mode=draw` → the wizard, the Draw card chosen; Create makes a Draw tab.
- `/new?mode=pages&q=article` → the wizard, Pages chosen; on the new document Start Making Pages
  opens with its search reading "article".
- `/new?mode=sideways` → the plain wizard, no card chosen.
- `/new?browse=brainstorm` → the plain wizard: the Brainstorm collection (and `?browse=`) was
  removed with the landing hero's Brainstorm button, its only link; the Brainstorm category remains.

## Out of scope for V1

- Animations for the route transition. A spinner is fine.
- A dedicated `/new` landing-page mode for unauthenticated
  users. Auth lands in a future spec.
