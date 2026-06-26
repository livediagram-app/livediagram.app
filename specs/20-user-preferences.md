# User preferences

Per-user editor preference flags that toggle behaviour without
changing diagram content. Most are exposed through a small
Settings dialog launched from the footer (gear button to the left
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
  // When false, the live editor skips the "re-pin connected arrow
  // anchors as elements move" pass implemented in packages/diagram's
  // `rebindArrowAnchorsAfterMove` (pinned in
  // packages/diagram/src/geometry.test.ts). Defaults to true so
  // users see the magic by default; flipping it off freezes arrow
  // anchors at whatever the user chose at draw time.
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
  // NOT surfaced in the Settings dialog: the flag is a per-tool
  // toggle, set + read from the pencil ModeBanner's icon button,
  // and Settings is reserved for global editor preferences. The
  // toggle's state still persists here so flipping it once
  // sticks across sessions.
  recogniseShapes?: boolean;

  // When true, the AI Assistant panel renders in the editor.
  // Defaults to false (opt-in). Only surfaced in the Settings
  // dialog when the api worker reports aiEnabled:true (an
  // OPENAI_API_KEY is configured). See spec/25.
  aiAssistanceEnabled?: boolean;

  // When true, the floating Explorer / Palette / AI panels
  // are replaced by a compact dock of buttons that open each panel
  // as a popover on click — the "minimal panel layout". Defaults to
  // false (floating panels) on desktop. The dock layout is ALWAYS
  // active on mobile regardless of this flag, because the floating
  // panels don't fit a phone viewport; the preference only changes
  // desktop behaviour. See spec/09.
  minimalPanels?: boolean;

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
};
```

Stored as serialised JSON on both sides of the wire. Unknown keys
are preserved on read so a forward-rolled client doesn't strip
another version's flags.

## Defaults

Missing key === undefined === default behaviour. Concretely:

- `autoRebindArrows` undefined → arrows rebind (the default
  behaviour). Setting it to `false` is the only state that
  changes behaviour.
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
- `recogniseShapes` undefined → raw-sketch pencil (the default).
  Setting it to `true` makes every pencil commit attempt
  classification first. Flipped from the pencil ModeBanner icon
  button rather than from the Settings dialog.
- `aiAssistanceEnabled` undefined → AI panel hidden (the default).
  Setting it to `true` shows the panel; the toggle only appears in
  Settings when the api worker advertises AI capability.
- `minimalPanels` undefined → floating panels on desktop (the
  default). Setting it to `true` switches desktop to the dock /
  popover layout. Mobile ignores the flag — it is always docked. In
  this layout the floating comments panel (the cheat sheet of threads)
  is suppressed entirely; the per-element comment popover stays
  available for viewing and replying.
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
- `notificationsEnabled` undefined / true → notifications on (the
  default). Setting it to `false` suppresses the success + info toasts
  the editor shows for consequential, otherwise-silent actions (a
  diagram moved to a folder, duplicated, or deleted from a long list; a
  tab linked into another diagram). **Error toasts are never gated by
  this** — a failure the user would otherwise never see still surfaces,
  so turning notifications off quiets the chatter without hiding
  breakage. The gate is read fresh on each toast push (a synchronous
  `readUserPreferences()` call in `hooks/useToast.tsx`), so a flip
  applies immediately with no subscription.

Empty (or missing entirely) localStorage entry, AND no row in
`user_preferences` for this owner, is therefore the "everything
on" state.

## UI placement

Global preferences (draw-to-add, minimal-panels, AI, telemetry) sit
in the Settings dialog. Canvas-behaviour preferences (`autoRebindArrows`,
`alignmentGuides`) sit in a Palette settings popover, next to the canvas
they affect. Per-tool preferences (today: `recogniseShapes` for the
pencil) sit next to the tool they affect, because walking the user back
to a separate dialog to flip a per-tool behaviour is friction the tool's
banner already solves.

The Palette popover is the first step in retiring the Settings dialog
entirely: settings move out to the surfaces they govern, so the user
flips them where they see their effect rather than in a context-free
modal.

- **Palette settings popover**: `apps/live/components/PaletteSettingsPopover.tsx`.
  Trigger: a sliders (gear) icon button in the Palette header — the only
  header affordance besides minimise (desktop floating panel only; the
  mobile dock palette has no header). Opens a small portal-rendered popover
  anchored under the button with iOS-style switches (`ToggleSwitch` from
  `palette-controls`) and concise labels:
  - "Auto-attach arrows" (`autoRebindArrows`) and "Alignment guides"
    (`alignmentGuides`) — reads / writes the lifted `userPreferences` state
    in editor-page through the same `setUserPreferences` +
    `writeUserPreferences` round-trip as the Settings dialog, emitting the
    same `AutoRebind*` / `AlignmentGuides*` telemetry before persisting.
  - "Quick-add on hover" (`quickAddOnHover`) — same round-trip; off by
    default. Threads through `CanvasElementsLayer` to `QuickConnectRing` as
    `openOnHover`, which opens the `+` menu on pointer-enter and closes it a
    beat after the pointer leaves both the `+` and the menu. Emits
    `UI`/`Toggled`/`QuickAddHover{On,Off}`.
  - "Panel opacity" (`panelOpacity`) — a slider (not a toggle), shown only
    while `minimalPanels` is off (it does nothing in the dock layout). The
    drag previews live by writing the `--lvd-panel-opacity` custom property
    imperatively; the persisted value is committed on release (one
    `writeUserPreferences` / D1 PUT, not one per tick) and emits
    `UI`/`Changed`/`PanelOpacity`.
  - "Minimal panels" (`minimalPanels`) — the panel-layout toggle that used
    to be its own header button. Turning it on docks the panels (and so
    hides this popover); the Settings dialog's Interface group remains the
    way back out, since the docked palette has no header to reopen the
    popover from.
  - A "Reset position" action (not a toggle) that snaps the Palette back to
    its default corner, replacing the old reset-position header button. It
    is disabled when the panel is already at the default corner, and closes
    the popover when fired.

  Closes on outside click or Escape.

- **Settings dialog**: `apps/live/components/SettingsDialog.tsx`,
  lazy-loaded via `next/dynamic` (matches the other on-demand
  modals: ShareDialog, ExportTabDialog, ShortcutsDialog,
  ImagePicker). Trigger: a gear-icon button in the TabBar footer,
  sitting between the existing Shortcuts button and the dark-mode
  toggle. Visible in every role: view-role visitors can still
  flip their own telemetry preference and (harmlessly) their own
  auto-rebind preference, even though they can't edit elements.
  Toggles are organised into collapsible groups (Canvas, Interface,
  Notifications, Accessibility, AI, Privacy) so the growing list stays scannable; only
  the first group (Canvas) is open by default and the rest start
  collapsed, so the dialog opens compact and the user expands what they
  need. (`autoRebindArrows` and `alignmentGuides` have moved out to the
  Palette settings popover described above; element add is a single
  always-on tap-or-drag gesture with no setting — see
  [spec/09](09-canvas-and-palette.md).) The Interface group holds `minimalPanels`, whose
  description notes the dock layout is always on for mobile. The
  Notifications group holds `notificationsEnabled`, whose description
  notes that errors are always shown regardless. The
  Accessibility group holds `reduceMotion`, noting the OS setting is
  always respected and this only adds a user-forced override.
- **Per-tool surfaces**: today only the pencil's ModeBanner (a
  sparkle / magic-wand icon button to the left of Cancel) carries
  the `recogniseShapes` toggle. The button reads the value from
  the lifted `userPreferences` state in editor-page and writes
  through `writeUserPreferences` with the resolved owner id, so
  the round-trip is identical to a Settings dialog flip. See
  spec/09's Shape-recognition subsection for the user-visible
  contract.

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
