# User preferences

Per-user editor preference flags that toggle behaviour without
changing diagram content. Most are exposed through a small
Settings dialog launched from the footer (the **Application settings**
gear button to the left
of the dark-mode toggle); a small number are per-tool toggles
that live next to the tool they affect (see the UI placement
section below) rather than in Settings. Either way the
persistence model is the same. Replaces the earlier
per-diagram-settings shape: preferences are about the user's
editor experience, not about any particular diagram, so they live
once per account / device and apply everywhere.

## Where preferences live

Preferences live in **D1** as the source of truth, with
`localStorage` as a fast warm cache so the editor never blocks on
a network round-trip at boot.

- **D1 table** `user_preferences` (migration `0016_user_preferences.sql`),
  one row per owner (Clerk userId for signed-in users, the per-
  browser participant id for guests). Columns: `owner_id TEXT
PRIMARY KEY`, `prefs TEXT NOT NULL` (serialised JSON blob),
  `updated_at INTEGER NOT NULL` (Unix ms). The JSON blob shape
  keeps the migration count low when new flags arrive: adding a
  field never requires altering the table.
- **localStorage cache** keyed `livediagram:user-preferences:v1`
  (legacy key, unchanged). Read synchronously at page-load so the
  Settings dialog and gate caches (telemetry, draw-to-add, etc.)
  have a value to read before the network fetch returns.

### Sync flow

- **On editor open**: read the localStorage cache synchronously
  (zero-blocking), then fire-and-forget `GET /api/preferences`.
  When the server response arrives, merge it over the cache
  (server wins for any key present on both sides), persist back
  to localStorage, and dispatch the existing
  `livediagram:preferences-changed` window event so in-process
  listeners refresh. If the fetch fails the cache value stays
  authoritative for the session.
- **On toggle**: update localStorage immediately (so the UI
  reflects the change without waiting for the network), then
  fire-and-forget `PUT /api/preferences` with the full updated
  blob. If the PUT fails the local change still applies; the
  next page load picks the cache again. Last-write-wins per
  device.
- **Cross-tab updates**: the browser's native `storage` event on
  the preferences key still fires across tabs in the same
  browser, so toggling in one tab updates every open editor.

### Why D1 instead of localStorage-only

The original v1 shape was localStorage-only on the grounds that
flags were UI-only and a server round-trip per toggle was
overkill. That trade-off was wrong for the user experience:
signed-in users who use livediagram on a laptop and a phone had
to re-flip every setting on each device. Per-account sync is the
expected behaviour for an account-bound app.

Guests get the same persistence model (the api keys them by
their `X-Owner-Id` participant id), so server-side storage is
effectively a remote copy of localStorage for that device, but
with a cross-browser bonus: a guest who clears localStorage but
keeps the same browser session still recovers their preferences.

**Panel corner layout is the deliberate exception.** Which corner
each floating panel docks into ([spec/63](63-panel-docking.md)) is a
per-device ergonomic choice (screen size, handedness, monitor), so it
lives in its own **device-local** `localStorage` store
(`livediagram:panel-layout:v1`) and is **not** part of this synced
blob. Don't fold panel placement into `UserPreferences`.

### Sign-up migration

`POST /api/migrate` (spec/04) moves `user_preferences.owner_id`
along with the diagrams + folders + shared-with rows, so a guest
who signs up keeps the settings they'd already chosen. Idempotent
in the same shape as the existing migrations: a second call with
the same `guestOwnerId` moves zero rows.

### Self-host degradation

When the api worker is unset (pure-guest self-host without a D1
binding configured) the client treats the fetch as a no-op
failure: the localStorage cache acts as the only persistence,
which is the same behaviour as the original v1 design and works
exactly like it did before. No required SaaS calls, self-hosting
stays viable.

## Schema

```ts
type UserPreferences = {
  // When true, the live editor runs the "re-pin connected arrow
  // anchors as elements move" pass implemented in packages/diagram's
  // `rebindArrowAnchorsAfterMove` (pinned in
  // packages/diagram/src/geometry.test.ts). Defaults to OFF: arrow
  // anchors stay where the user chose them at draw time unless they
  // opt in. (Flipped from a true default in July 2026: the
  // auto-chosen faces surprised users more often than they helped,
  // e.g. a midpoint-to-midpoint slant crossing a hand-anchored arrow
  // between the same two boxes.)
  autoRebindArrows?: boolean;

  // When false, the live editor's `track()` helper is a no-op:
  // nothing leaves the browser. Distinct from the build-time
  // NEXT_PUBLIC_TELEMETRY_ENABLED gate and from the api worker's
  // TELEMETRY_ENABLED gate (both still apply). This is the user's
  // own opt-out lever, surfaced in the Settings dialog so the
  // "first-party, no creepy tracking" claim on the landing page
  // and /telemetry is honest. Defaults to true (telemetry on);
  // setting it to false is the only state that changes behaviour.
  // See spec/22 for the rest of the telemetry contract.
  telemetryEnabled?: boolean;
  // Pencil tool's shape-recognition toggle (spec/09 Pencil
  // subsection). When true, every freehand commit while the
  // pencil banner is up runs through recogniseShape and may
  // mint a primitive instead of a FreehandElement. Deliberately
  // DEAD as of spec/115. Shape recognition is now which pen you
  // picked — Freehand or Shape Pen — rather than a persisted mode,
  // so nothing reads this. It stays in the type because it is
  // already stored for existing users and removing it would make a
  // stored preference fail to parse rather than be ignored.
  recogniseShapes?: boolean;

  // When true, the AI Assistant panel renders in the editor.
  // Defaults to false (opt-in). Only surfaced in the Settings
  // dialog when the api worker reports aiEnabled:true (an
  // OPENAI_API_KEY is configured). See spec/25.
  aiAssistanceEnabled?: boolean;

  // Show the AI panel's quick suggested-prompt chips (spec/25).
  // Toggled from the Settings dialog's AI category; they take vertical
  // space, so it can hide them. Undefined / true === shown.
  aiSuggestedPrompts?: boolean;

  // When true, the floating Explorer / Palette / AI panels
  // are replaced by a compact dock of buttons that open each panel
  // as a popover on click — the "minimal panel layout". Defaults to
  // false (floating panels) on desktop. The dock layout is ALWAYS
  // active on mobile regardless of this flag, because the floating
  // panels don't fit a phone viewport; the preference only changes
  // desktop behaviour. See spec/09. Legacy since spec/148: still written
  // (as `panelLayout !== 'floating'`) so older readers keep working, but
  // `panelLayout` is the source of truth when set.
  minimalPanels?: boolean;

  // The desktop panel layout (spec/148): 'floating' (the default),
  // 'minimal' (the dock, spec/09) or 'toolbar' (the Palette as one strip
  // across the top of the canvas, no Explorer panel). Missing → derived
  // from `minimalPanels`. Mobile is always docked whatever this says.
  panelLayout?: 'floating' | 'minimal' | 'toolbar';

  // Opacity (0..1) of the FULL floating panels at rest, so the canvas
  // shows through them; they snap back to fully opaque while hovered or
  // focused so they stay readable in use. Applied via the
  // `--lvd-panel-opacity` custom property (usePanelOpacity), which only
  // the full panels read (the `data-panel-translucent` tag is on
  // MovablePanel's floating branch, not the minimal dock) — so this is
  // scoped to floating panels and never touches the minimal layout.
  // Defaults to 1 (fully opaque). See spec/09's Palette settings.
  panelOpacity?: number;

  // When false, the editor suppresses the faint alignment guide
  // lines drawn along the edges / centres a dragged or resized
  // element shares with its neighbours. The snap itself is
  // unaffected; only the visual hint is hidden. Defaults to true
  // (guides on). See spec/09's Alignment guides subsection.
  alignmentGuides?: boolean;

  // When true, the editor adds `.reduce-motion` to <html> so globals.css
  // collapses decorative animations + transitions to ~instant
  // (accessibility). Independent of the OS `prefers-reduced-motion` media
  // query, which globals.css always honours; this lets a user force the
  // calm UI on regardless of their OS setting, synced across devices.
  // Defaults to false (full motion, subject to the OS setting).
  reduceMotion?: boolean;

  // Email notification preferences (spec/65). Account-level email
  // settings that share this synced blob rather than a parallel store,
  // surfaced in the Settings dialog's Notifications category (only when the deployment has
  // email configured — capabilities.emailEnabled). The api worker reads
  // these server-side before sending the matching transactional email
  // (spec/64), so a missing key === undefined === notify (opt-out, not
  // opt-in). Distinct from `notificationsEnabled`, which gates in-editor
  // toasts, not email.
  //
  // When false, suppress the "someone first opened one of my shared
  // diagrams" email. Defaults to true (notify).
  notifyDiagramJoin?: boolean;
  // When false, suppress the "someone accepted/declined a team invite I
  // sent" email (sent to the team's admins). Defaults to true (notify).
  notifyInviteResponse?: boolean;

  // The interactive editor tour's seen-guard (spec/79). True once the
  // tour's welcome offer has been answered (taken, skipped, or declined),
  // so the offer never re-appears for this user on any device. Surfaced
  // in Settings as "Welcome Tour Completed"; unchecking it and closing
  // Settings replays the tour. Missing / undefined === not seen.
  tourSeen?: boolean;
  // Colours you have used that the active theme did not already offer
  // (spec/09 Colours). Picking one off the OS picker or the pipette adds it;
  // right-clicking a swatch removes it. Newest first, capped at 12, synced
  // like every other preference so a palette you have built follows you
  // between devices.
  customSwatches?: string[];
};
```

Stored as serialised JSON on both sides of the wire. Unknown keys
are preserved on read so a forward-rolled client doesn't strip
another version's flags.

## Defaults

Missing key === undefined === default behaviour. Concretely:

- `autoRebindArrows` undefined → arrows do NOT rebind (the default:
  anchors stay where they were drawn). Setting it to `true` is the
  only state that changes behaviour. The derivation lives in ONE
  place, `autoRebindArrowsEnabled(prefs)` in
  `apps/live/lib/user-preferences.ts`, shared by the Settings
  dialog's row and the editor-preferences hook so the default
  can't drift between consumers.
  - Per-endpoint override: dragging an arrow's endpoint onto an
    anchor by hand marks that endpoint `manual` (a flag on the
    pinned `Endpoint` in `packages/diagram`). `rebindArrowAnchorsAfterMove`
    leaves a manual endpoint's face fixed even when auto-rebind is
    on, so a deliberate correction sticks; the other (auto) end of
    the same arrow still re-anchors. This is independent of the
    global `autoRebindArrows` toggle — it's a local opt-out for one
    endpoint, not a preference.
- `telemetryEnabled` undefined → telemetry on (the default).
  Setting it to `false` is the only state that opts out.
- `recogniseShapes` is ignored whatever its value (spec/115): the
  Shape Pen recognises, Freehand does not, and no stored flag
  changes either.
- `aiAssistanceEnabled` undefined → AI panel hidden (the default).
  Setting it to `true` shows the panel; the toggle only appears in
  Settings when the api worker advertises AI capability.
- `minimalPanels` undefined → floating panels on desktop (the
  default). Setting it to `true` switches desktop to the dock /
  popover layout. Mobile ignores the flag — it is always docked. In
  this layout the Collaborate panel (the cheat sheet of threads +
  actions) joins the dock as its own **Collaborate** button — shown
  only while the active tab has at least one comment thread or action,
  the same gate as the floating panel (spec/68 §5) — and opens as a
  popover like the other panels.
- `alignmentGuides` undefined → guides on (the default). Setting it
  to `false` hides the faint guide lines during a move / resize; the
  snap behaviour itself is unchanged.
- `panelOpacity` undefined / 1 → floating panels fully opaque (the
  default). A value below 1 makes the full floating panels translucent
  at rest (snapping back to opaque on hover / focus) via the
  `--lvd-panel-opacity` custom property; the minimal dock never reads
  the var, so the minimal layout is unaffected. The popover slider is
  hidden while `minimalPanels` is on. Emits `UI`/`Changed`/`PanelOpacity`
  on release (spec/22).
- `quickAddOnHover` undefined / false → click to open an element's quick-add
  `+` menu (the default; hover-open can feel twitchy, so it's opt-in). `true`
  opens it on hover instead, closing a beat after the pointer leaves both the
  `+` and the menu. A click still opens it either way, and the `+` buttons
  still appear only on the selected element (spec/09). Emits
  `UI`/`Toggled`/`QuickAddHover{On,Off}`.
- `reduceMotion` undefined / false → full motion (the default), still
  subject to the OS `prefers-reduced-motion` media query which
  `globals.css` always honours. Setting it to `true` adds
  `.reduce-motion` to `<html>` (via `useReduceMotion`), collapsing every
  decorative animation + transition to ~instant for motion-sensitive
  users who want it on regardless of their OS setting.
- `notifyDiagramJoin` / `notifyInviteResponse` undefined / true → the
  matching email notification is on (the default; spec/65). Setting
  either to `false` is the only state that suppresses its email. Read
  server-side by the api worker before sending; flipped from the
  Settings dialog. Emit `UI`/`Toggled`/`NotifyDiagramJoin{On,Off}`
  and `NotifyInviteResponse{On,Off}` (spec/22).
- `notificationsEnabled` undefined / true → notifications on (the
  default). Setting it to `false` suppresses the success + info toasts
  the editor shows for consequential, otherwise-silent actions (a
  diagram moved to a folder, duplicated, or deleted from a long list; a
  tab linked into another diagram). **Error toasts are never gated by
  this** — a failure the user would otherwise never see still surfaces,
  so turning notifications off quiets the chatter without hiding
  breakage. The gate is read fresh on each toast push (a synchronous
  `readUserPreferences()` call in `hooks/ui/useToast.tsx`), so a flip
  applies immediately with no subscription.

Empty (or missing entirely) localStorage entry, AND no row in
`user_preferences` for this owner, is therefore the "everything
on" state.

## UI placement

**Every preference lives in the Settings dialog**, and for almost all of them
that is the only control.

- The **Settings dialog** lists all of them, grouped and searchable by eye.
  It is the answer to "I half-remember a setting about layer previews" from
  someone who does not know which panel owns it, and the place a new reader
  goes to see what the editor can be told to do.
- **One setting, one control.** The Palette / Layers / Activity / AI / Map
  gear popovers that used to carry a subset each are gone: once every
  preference had a row in the dialog, those were five second homes for
  settings that already had one. A handful of preferences DO keep a second,
  in-context control where that control is the thing itself rather than a
  settings menu: the Appearance cycle button in the footer, the Explorer's
  its API Tokens page, and each of those rows says
  **"Also in ..."** so the pair reads as deliberate.
- There are no per-tool preferences left: the one there was
  (`recogniseShapes`, flipped from the pencil's banner) became two palette
  tiles instead (spec/115), which is that idea taken to its end: the setting
  is not near the tool, it IS the tool.

This **replaces the earlier plan to retire the Settings dialog entirely** by
pushing every setting out to its own surface. That plan solved the wrong
problem: a setting is easy to flip when you are already looking at its
surface, and impossible to find when you are not. Contextual controls stay,
and the dialog stays as the one complete, browsable index of them.

- **Panel settings popovers**: removed. The Palette, Layers, Activity, AI and
  Map panels each carried a gear popover holding their own preferences plus a
  Reset-position row. Every one of those preferences now has a row in the
  Settings dialog, so the popovers were five second homes for settings that
  already had one: the duplication the reuse principle exists to stop. The
  panels kept the standard **Reset position** button in their header
  (`MovablePanel`'s `onReset`, shown once the panel has left its default
  corner), which is the only non-preference thing the popovers held.

  The **Slide Deck** popover stays: its contents (auto-advance, speed,
  transition, slide size, loop, hide pointer) are deck state rather than user
  preferences, so they have no home in Settings and should not get one.

- **Settings dialog**: `apps/live/components/dialogs/SettingsDialog.tsx`,
  lazy-loaded via `next/dynamic` (matches the other on-demand
  modals: ShareDialog, ExportTabDialog, ShortcutsDialog,
  ImagePicker). Trigger: a gear-icon button in the TabBar footer,
  sitting between the existing Shortcuts button and the dark-mode
  toggle. Visible in every role: view-role visitors can still
  flip their own telemetry preference and (harmlessly) their own
  auto-rebind preference, even though they can't edit elements.
  **Shaped like the iOS Settings app**, in both of that app's forms, because
  it had outgrown a single scrolling accordion: six groups of long paragraphs
  on one screen, where finding a setting meant opening groups until one held
  it.

  - **Desktop** takes the iPadOS split view: the categories in a fixed left
    rail, the selected category's settings in the pane beside it. A category
    is always selected (Editor on open) - the pane is never empty. The dialog
    is capped at `42rem` tall; unbounded, a long category stretched it from
    the top of the screen to the bottom and read as a page, not a modal.
  - **Phone** (below the `sm:` breakpoint, via `useIsMobileViewport`) takes
    the iPhone push navigation: a root list of the same categories, each a
    tappable row, which pushes that category's pane with a back control in
    the header. One screen at a time.

  Crossing the breakpoint mid-session re-selects a category, so a resize
  never leaves the desktop layout with an empty pane. The backdrop is the
  see-through `desktop-light` one, not the default dim+blur: this is where
  you flip things whose effect is on the canvas behind it.

  **It is the central place to find every preference.** Categories:
  **Editor** (quick-add on hover, alignment guides, auto-attach arrows),
  **Appearance** (theme; minimal panel layout, minimap, panel opacity),
  **Controls** (middle-mouse pan), **Panels** (Layers, Activity and minimap
  settings), **Notifications** (in-editor, plus the six email preferences),
  **Accessibility** (reduce motion, show welcome tour), **AI Tools** (assistant,
  suggested prompts, API tokens), **Account** (identity, delete account, see
  spec/65), **Privacy** (telemetry). Editor leads because it is what most
  people came to change; Account and Privacy sit at the end, where the
  account-shaped things belong. Preferences whose
  day-to-day home used to be a panel's own gear popover live here now, and
  only here - see **UI placement** below.

  Within a category, rows carry an optional **`section`** so a category
  holding several clusters (Panels covers Layers, Activity and the minimap)
  gets a sub-heading per cluster. Sections group CONSECUTIVE runs, so one
  cannot be split and silently re-headed further down.

  Each category row carries a **coloured, rounded icon tile**, iOS-style -
  the thing the eye navigates by once the labels blur together. Colour is a
  second channel, never the only one: every category has its own glyph too.

  A setting renders as a **one-line row** (label + control), with its
  long-form explanation as a **grey footnote below the row**. Labels are
  **Title Case**. Row kinds: `toggle`, `choice` (a segmented control, e.g.
  the theme and the minimap size), `slider` (panel opacity, committing on
  release so one drag is not one PUT per pixel), `appearance` (the one row
  backed by the device-local store, not `UserPreferences`), and `tokens` (a
  read-only listing of the account's API tokens plus a link to the Explorer's
  page; minting and revoking stay there, where they have room to confirm).
  A row is one `role="switch"` button described by its footnote; the
  `ToggleSwitch` inside is wrapped `aria-hidden`, because `presentational`
  still exposes `role="switch"` and would otherwise offer a screen reader two
  nested switches of the same name.

  Settings whose effect is **visual** carry a small **before/after
  illustration** drawn from the real editor, which **rings the state
  currently in force** so the picture doubles as a readout: the minimap,
  alignment guides, layer thumbnails, and the minimap's dimming.

  Pick-one settings whose options LOOK different draw **one picture per
  option** instead, side by side with no arrow, the one in force ringed
  (`settings-choice-illustrations.tsx`): **Panel Layout** (Floating /
  Minimal / Toolbar, spec/148) and **Theme** (Light / Dark / System, the
  last drawn half light and half dark). Theme's pictures are drawn in their
  own fixed colours and are never dimmed, since their colour is the point: a
  dimmed light editor reads grey on a dark dialog. A test holds every
  illustrated choice row to drawing exactly its options.

  A choice option can be **desktop only** (`desktopOnly` in the catalogue).
  On a phone-sized viewport it stays visible but can't be picked, and a note
  under the row says why. Panel Layout's Floating and Toolbar are desktop
  only: a phone always uses the button bar.

  **Show Welcome Tour** is inverted against the stored `tourSeen`: the row
  asks "show me the tour?", the preference records "already seen". Because
  `tourSeen !== true` is necessary but NOT sufficient for the offer (TourHost
  also needs the per-tab pending flag, which only `/new` sets), closing the
  dialog with the row on **marks that flag**, so the row's promise is true
  for a reader who had simply never taken the tour. Turning it on from off
  additionally relaunches in place. Its telemetry tokens still describe the
  PREFERENCE, so the dashboard series keeps its meaning.

  The dialog is **data-driven**: `settings-catalogue.ts` declares the
  categories and, per row, its label, description, help article, section,
  illustration, availability, how to `read` and `write` itself, and its
  telemetry tokens (unchanged from before this rework, so history stays
  continuous). Adding a setting is a catalogue entry, not another JSX block
  in a file that only grows. Picking a category emits `UI` / `Opened` with a
  `Settings<Category>` type.

  Email rows are **absent, not disabled**, unless BOTH Resend is configured
  (spec/64) and the reader is signed in - a guest has no address, so those
  switches could never apply. A category left with no applicable rows drops
  out entirely rather than becoming a row that pushes a blank pane.

  (Element add is a single always-on tap-or-drag gesture with no setting, see
  [spec/09](09-canvas-and-palette.md).) The
  **Controls** group holds `middleMousePan` (default on): holding the
  middle mouse button drags the canvas in both axes from anywhere, over
  empty space or elements, whatever tool is active — off leaves the middle
  button to the browser. The
  Notifications group holds `notificationsEnabled`, whose description
  notes that errors are always shown regardless. The
  Accessibility group holds `reduceMotion`, noting the OS setting is
  always respected and this only adds a user-forced override.

- **Per-tool surfaces**: none today. The pencil's ModeBanner used to
  carry a `recogniseShapes` toggle; spec/115 replaced it with two
  palette tiles, so no preference is set from a tool's own chrome any
  more. The Highlighter Panel's Colour + Strength (spec/81) are the
  closest thing, and those are session-local editor state setting the
  next stroke's style rather than a persisted preference.

## Read / write helpers

Live in `apps/live/lib/user-preferences.ts`:

- `readUserPreferences(): UserPreferences` returns the current
  cached preferences, parsing the stored JSON and defaulting any
  missing key. Returns `{}` on parse failure (graceful). Sync,
  reads localStorage only, so the editor can use it during render.
- `writeUserPreferences(prefs, ownerId?): void` serialises and
  writes back to localStorage AND, when `ownerId` is supplied,
  fires a non-blocking `PUT /api/preferences` so the value
  round-trips to D1. Also dispatches a
  `livediagram:preferences-changed` window event so same-tab
  listeners (notably `lib/telemetry.ts`) can refresh their cached
  gate without polling. Callers without an `ownerId` (unit tests,
  the editor before identity resolves) skip the network step and
  still get the localStorage write; the next call with an
  ownerId catches D1 up.
- `fetchUserPreferences(ownerId): Promise<UserPreferences | null>`
  does a single `GET /api/preferences` for the resolved owner,
  merges the server's value over the localStorage cache (server
  wins on conflict), writes the merged blob back to localStorage,
  and dispatches `livediagram:preferences-changed`. Returns the
  merged preferences, or null on failure / when the api worker
  is unreachable (the caller can treat that as "stick with the
  cache"). Called once at editor mount.

Cross-tab updates are picked up via the browser's native `storage`
event on the preferences key.

## API

- **`GET /api/preferences`** — returns `{ prefs: UserPreferences }`
  for the resolved owner. Empty object when no row exists. Auth:
  the standard hybrid identity (Clerk Bearer OR `X-Owner-Id`).
- **`PUT /api/preferences`** — body `{ prefs: UserPreferences }`,
  upserts the row for the resolved owner. Returns 204. The blob
  is opaque to the api worker beyond a size cap (4 KB; defends
  against runaway clients). No per-field validation: the client
  is responsible for the shape, and a malformed client just
  reflects malformed prefs back to itself.
