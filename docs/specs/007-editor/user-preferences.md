# User preferences

Per-user editor preference flags that toggle behaviour without
changing document content. Most are exposed through a small
Settings dialog launched from the footer (the **Application settings**
gear button to the left
of the dark-mode toggle); a small number are per-tool toggles
that live next to the tool they affect (see the UI placement
section below) rather than in Settings. Either way the
persistence model is the same. Replaces the earlier
per-document-settings shape: preferences are about the user's
editor experience, not about any particular document, so they live
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
each floating panel docks into ([Panel corner docking](panel-docking.md)) is a
per-device ergonomic choice (screen size, handedness, monitor), so it
lives in its own **device-local** `localStorage` store
(`livediagram:panel-layout:v1`) and is **not** part of this synced
blob. Don't fold panel placement into `UserPreferences`.

### Sign-up migration

`POST /api/migrate` ([Auth + guest access](../014-identity/auth-and-guest-access.md)) moves `user_preferences.owner_id`
along with the documents + folders + shared-with rows, so a guest
who signs up keeps the settings they'd already chosen. Idempotent
in the same shape as the existing migrations: a second call with
the same `guestOwnerId` moves zero rows.

<!-- legacy-names -->

### Renamed keys

- **Renamed key.** `notifyDiagramJoin` became `notifyDocumentJoin` when the container became a
  document. Migration 0055 renames it in D1; `upgradeLegacyPreferences`
  (`packages/api-schema/src/legacy-preferences.ts`) renames it wherever an older copy can still
  arrive: the browser's cache on read, the server's copy before the merge, and the api's
  notification check. An opt-out is never lost; when both keys exist, the new one wins.

<!-- /legacy-names -->

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
  // When false, the live editor skips the auto-rebind that moves a
  // pinned arrow end to the side facing the other end once its drawn
  // path runs through a shape after a move (packages/document's
  // `rebindArrowAnchorsAfterMove`, see ../008-canvas/arrow-anchors.md).
  // Defaults to ON.
  autoRebindArrows?: boolean;

  // When false, the live editor's `track()` helper is a no-op:
  // nothing leaves the browser. Distinct from the build-time
  // NEXT_PUBLIC_TELEMETRY_ENABLED gate and from the api worker's
  // TELEMETRY_ENABLED gate (both still apply). This is the user's
  // own opt-out lever, surfaced in the Settings dialog so the
  // "first-party, no creepy tracking" claim on the landing page
  // and /telemetry is honest. Defaults to true (telemetry on);
  // setting it to false is the only state that changes behaviour.
  // See docs/specs/017-telemetry/telemetry.md for the rest of the telemetry contract.
  telemetryEnabled?: boolean;
  // Pencil tool's shape-recognition toggle (docs/specs/008-canvas/canvas-and-palette.md Pencil
  // subsection). When true, every freehand commit while the
  // pencil banner is up runs through recogniseShape and may
  // mint a primitive instead of a FreehandElement. Deliberately
  // DEAD as of docs/specs/008-canvas/two-pens.md. Shape recognition is now which pen you
  // picked — Freehand or Shape Pen — rather than a persisted mode,
  // so nothing reads this. It stays in the type because it is
  // already stored for existing users and removing it would make a
  // stored preference fail to parse rather than be ignored.
  recogniseShapes?: boolean;

  // When true, the AI Assistant panel renders in the editor.
  // Defaults to false (opt-in). Only surfaced in the Settings
  // dialog when the api worker reports aiEnabled:true (an
  // a model key is configured). See docs/specs/007-editor/ai-assistance.md.
  aiAssistanceEnabled?: boolean;

  // Show the AI panel's quick suggested-prompt chips (docs/specs/007-editor/ai-assistance.md).
  // Toggled from the Settings dialog's AI category; they take vertical
  // space, so it can hide them. Undefined / true === shown.
  aiSuggestedPrompts?: boolean;

  // The panel layout (docs/specs/007-editor/toolbar-layout.md): 'floating' (the desktop
  // default, corner panels, docs/specs/008-canvas/canvas-and-palette.md) or 'toolbar' (the
  // Palette as one strip across the top of the canvas, no Explorer panel).
  // Missing → Floating on desktop. A phone always uses Toolbar whatever
  // this says. A stored value outside the union (a legacy 'minimal')
  // resolves like a missing one, and the retired `minimalPanels` flag
  // some stored blobs still carry is ignored.
  panelLayout?: 'floating' | 'toolbar';

  // Opacity (0..1) of EVERY panel at rest, so the canvas shows through
  // them; they snap back to fully opaque while hovered or focused so they
  // stay readable in use. Applied via the `--lvd-panel-opacity` custom
  // property (usePanelOpacity), read by every surface tagged
  // `data-panel-translucent`: MovablePanel in both its floating and its
  // popover branch (so the Explorer, Layers and Collaborate
  // popovers follow it too), the Map, the Quick style panel in every
  // layout and the Toolbar layout's strip. Buttons are not panels: the
  // bottom-right cluster buttons and the zoom controls stay opaque.
  // Defaults to 1 (fully opaque).
  panelOpacity?: number;

  // UI scale (docs/specs/007-editor/ui-scale.md): the factor (0.8..1.2, 0.05
  // steps) the panels, the toolbar and the bottom-right corner buttons are
  // drawn at, via CSS `zoom` on each surface. `uiScale` is the master; each
  // part's key overrides it for that part, and setting the master clears
  // them. Desktop only: a phone always draws at 1. Defaults to 1.
  uiScale?: number;
  uiScalePanels?: number;
  uiScaleToolbar?: number;
  uiScaleCornerButtons?: number;

  // Panel switches (the Panels sub-categories, see "Settings dialog"
  // below). Each defaults ON via `!== false`, so an existing user's editor
  // is unchanged; `false` is the only state that turns its panel off.
  // Turning a panel off removes the panel and every piece of chrome that
  // exists to reach or mirror it, but never the feature underneath:
  //
  // `layersPanelEnabled` false: no Layers panel, no Layers cluster button,
  // no "Move to layer" tiles in the element menus, no "Hidden layers" row
  // in the image export. Layers keep working: a tab's layers, their
  // order, visibility, lock and opacity still shape the canvas, and new
  // elements still land on the active layer.
  layersPanelEnabled?: boolean;
  // `collaboratePanelEnabled` false: no Collaborate panel and no
  // Collaborate cluster button, even while the tab has comment threads or
  // actions (the only time either shows when on). Comments and actions
  // keep working from the elements themselves.
  collaboratePanelEnabled?: boolean;
  // `quickStylePanelEnabled` false: the Quick style panel never appears
  // beside a selection. Style memory (../008-canvas/quick-style-panel.md)
  // still remembers what you pick in the context menu.
  quickStylePanelEnabled?: boolean;

  // When false, the editor suppresses the faint alignment guide
  // lines drawn along the edges / centres a dragged or resized
  // element shares with its neighbours. The snap itself is
  // unaffected; only the visual hint is hidden. Defaults to true
  // (guides on). See docs/specs/008-canvas/canvas-and-palette.md's Alignment guides subsection.
  alignmentGuides?: boolean;

  // When true, the editor adds `.reduce-motion` to <html> so globals.css
  // collapses decorative animations + transitions to ~instant
  // (accessibility). Independent of the OS `prefers-reduced-motion` media
  // query, which globals.css always honours; this lets a user force the
  // calm UI on regardless of their OS setting, synced across devices.
  // Defaults to false (full motion, subject to the OS setting).
  reduceMotion?: boolean;

  // Settings › Experimental › Infographic Mode (editor-modes.md
  // "Experimental modes"): offers Infographic mode. Defaults to false.
  infographicModeEnabled?: boolean;

  // Email notification preferences (docs/specs/014-identity/profile-and-email-notifications.md). Account-level email
  // settings that share this synced blob rather than a parallel store,
  // surfaced in the Settings dialog's Notifications category (only when the deployment has
  // email configured — capabilities.emailEnabled). The api worker reads
  // these server-side before sending the matching transactional email
  // (docs/specs/014-identity/transactional-email.md), so a missing key === undefined === notify (opt-out, not
  // opt-in). Distinct from `notificationsEnabled`, which gates in-editor
  // toasts, not email.
  //
  // When false, suppress the "someone first opened one of my shared
  // documents" email. Defaults to true (notify).
  notifyDocumentJoin?: boolean;
  // "Show my profile picture" (docs/specs/014-identity/profile-picture.md §4): whether signed-in
  // collaborators see this account's picture. Missing = SHOW_PROFILE_PICTURE_DEFAULT (on).
  showProfilePicture?: boolean;
  // When false, suppress the "someone accepted/declined a team invite I
  // sent" email (sent to the team's admins). Defaults to true (notify).
  notifyInviteResponse?: boolean;

  // The interactive editor tour's seen-guard (docs/specs/007-editor/editor-tour.md). True once the
  // tour's welcome offer has been answered (taken, skipped, or declined),
  // so the offer never re-appears for this user on any device. Surfaced
  // in Settings as "Welcome Tour Completed"; unchecking it and closing
  // Settings replays the tour. Missing / undefined === not seen.
  tourSeen?: boolean;
  // Colours you have used that the active theme did not already offer
  // (docs/specs/008-canvas/canvas-and-palette.md Colours). Picking one off the OS picker or the pipette adds it;
  // right-clicking a swatch removes it. Newest first, capped at 12, synced
  // like every other preference so a palette you have built follows you
  // between devices.
  customSwatches?: string[];
  // The quick style panel's custom swatches (../008-canvas/quick-style-panel.md
  // "Custom swatches"): per theme, newest-edited first, which of a row's six
  // slots you replaced with your own colour. `t` is the theme id, `s` the
  // Stroke row and `f` the Background row, slot (1-6) to lower-case #rrggbb.
  // Short keys because the blob shares the 4 KB cap; at most 8 themes and
  // 800 bytes, oldest-edited dropped first. Validated on read in the client
  // (lib/swatch-overrides), like every field here.
  quickSwatchOverrides?: {
    t: string;
    s?: Record<1 | 2 | 3 | 4 | 5 | 6, string>;
    f?: Record<1 | 2 | 3 | 4 | 5 | 6, string>;
  }[];
  // The whiteboard dock (../023-draw-mode/draw-mode.md "Shape slots"): up to
  // seven pinned shape keys (unset is the default pins, an empty list an
  // emptied side), and per shape key [times picked, last picked ms] for the
  // Shapes flyout's slots, at most 20 kept. Keys outside the whiteboard's
  // shape catalogue are dropped on read (lib/whiteboard-dock-prefs).
  whiteboardPinnedShapes?: string[];
  whiteboardShapePicks?: Record<string, [number, number]>;
  // The whiteboard markers' Your colours (../023-draw-mode/draw-mode.md "The
  // colour picker"): up to eight custom #rrggbb, most recently used first; Remove
  // takes one out. Junk is dropped on read (lib/pen-colour-memory).
  whiteboardYourColours?: string[];
  // Where a whiteboard's dock sits (../023-draw-mode/draw-mode.md "Where the
  // dock sits"): 'top' or 'bottom'. Unset, or anything but 'bottom', is the
  // top (lib/whiteboard-dock-prefs).
  whiteboardDockPosition?: 'top' | 'bottom';
  // Draw mode's pattern, the person's own (./editor-modes.md "One look"): Plain, Dots
  // or Grid, as last chosen from the dock's Settings; never stored on a tab. Unset, or
  // anything else, is Grid (lib/whiteboard-dock-prefs).
  drawPattern?: 'blank' | 'grid' | 'graph';

  // Power user mode (docs/specs/007-editor/power-user-mode.md). True while the mode is on.
  // Switching it on applies the preset once; see powerUserBaseline.
  powerUserMode?: boolean;
  // What switching the mode on changed, per preset setting: the values
  // before (a key absent here was absent then) and the values written.
  // Switching off restores `before` for every setting whose current
  // values still equal `applied`, then deletes this. Present only while
  // the mode is on.
  powerUserBaseline?: Record<
    string,
    { before: Partial<UserPreferences>; applied: Partial<UserPreferences> }
  >;
  // Minimal chrome, a power-user-only setting. Honoured only while
  // powerUserMode is on; the preset writes true.
  minimalChrome?: boolean;
  // True once the power user mode offer has been shown, answered or not,
  // so it is made once per account.
  powerUserOfferShown?: boolean;
};
```

Stored as serialised JSON on both sides of the wire. Unknown keys
are preserved on read so a forward-rolled client doesn't strip
another version's flags.

## Defaults

Missing key === undefined === default behaviour. Concretely:

- `autoRebindArrows` undefined → the auto-rebind runs (the default,
  [Arrow anchors and auto-rebind](../008-canvas/arrow-anchors.md)).
  Setting it to `false` is the only state that turns it off, and then
  a move never changes an anchor. The rule is the same for every
  pinned end, including ends the user placed by hand. The derivation
  lives in ONE place, `autoRebindArrowsEnabled(prefs)` in
  `apps/live/lib/user-preferences.ts`, shared by the Settings
  dialog's row and the editor-preferences hook so the default
  can't drift between consumers.
- `telemetryEnabled` undefined → telemetry on (the default).
  Setting it to `false` is the only state that opts out.
- `recogniseShapes` is ignored whatever its value ([Two pens instead of a pen and a mode](../008-canvas/two-pens.md)): the
  Shape Pen recognises, Freehand does not, and no stored flag
  changes either.
- `aiAssistanceEnabled` undefined → AI panel hidden (the default).
  Setting it to `true` shows the panel; the toggle only appears in
  Settings when the api worker advertises AI capability.
- `panelLayout` undefined (or a legacy `'minimal'`) → Floating on desktop
  (the default), Toolbar on a phone. `'toolbar'` switches desktop to the
  [Toolbar layout](toolbar-layout.md); a phone is always Toolbar. Emits `UI`/`Changed`/
  `PanelLayoutFloating` or `PanelLayoutToolbar`.
- `whiteboardDockPosition` undefined → a whiteboard's dock at the top (the
  default). Only `'bottom'` moves it to the bottom.
- `drawPattern` undefined → Grid (`graph`) behind every tab the person works
  on in Draw mode. The dock's Background row writes it; it emits the same
  Background events as before and changes nothing on the tab.
- `alignmentGuides` undefined → guides on (the default). Setting it
  to `false` hides the faint guide lines during a move / resize; the
  snap behaviour itself is unchanged.
- `panelOpacity` undefined / 1 → every panel fully opaque (the
  default). A value below 1 makes every panel translucent at rest
  (snapping back to opaque on hover / focus) via the
  `--lvd-panel-opacity` custom property, in every layout: floating,
  popover (the Explorer and cluster popovers), the Map, Quick style
  and the Toolbar strip. Buttons stay opaque. Emits
  `UI`/`Changed`/`PanelOpacity` on release ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).
- `uiScale` undefined / 1 → the chrome at its design size (the default).
  Any other value in 0.8..1.2 draws the panels, the toolbar and the
  bottom-right corner buttons at that factor on desktop; a phone always draws
  at 1. `uiScalePanels` / `uiScaleToolbar` / `uiScaleCornerButtons` undefined
  → that part follows `uiScale`; a value overrides it for that part. Junk
  reads as 1, out-of-range values clamp ([UI scale](ui-scale.md)). Emits
  `UI`/`Changed`/`UiScale` (or `UiScalePanels`, `UiScaleToolbar`,
  `UiScaleCornerButtons`) on release.
- `layersPanelEnabled` / `collaboratePanelEnabled` /
  `quickStylePanelEnabled` undefined / true → the panel is on (the
  default). `false` removes it and the chrome that reaches it, leaving the
  feature working (see the data model). Emits `UI`/`Toggled`/
  `LayersPanel{On,Off}`, `CollaboratePanel{On,Off}`
  and `QuickStylePanel{On,Off}`.
- **Retired keys.** `activityPanelEnabled` and the Activity panel's revert
  hover preview went with the Activity panel (removed 2026-10-03). A value
  still stored under either is ignored on read and dropped on the next
  write; Undo and Redo always show in the bottom-right cluster.
- `quickAddOnHover` undefined / false → click to open an element's quick-add
  `+` menu (the default; hover-open can feel twitchy, so it's opt-in). `true`
  opens it on hover instead, closing a beat after the pointer leaves both the
  `+` and the menu. A click still opens it either way, and the `+` buttons
  still appear only on the selected element ([Canvas and palette](../008-canvas/canvas-and-palette.md)). Emits
  `UI`/`Toggled`/`QuickAddHover{On,Off}`.
- `reduceMotion` undefined / false → full motion (the default), still
  subject to the OS `prefers-reduced-motion` media query which
  `globals.css` always honours. Setting it to `true` adds
  `.reduce-motion` to `<html>` (via `useReduceMotion`), collapsing every
  decorative animation + transition to ~instant for motion-sensitive
  users who want it on regardless of their OS setting. Full motion is
  itself bounded for everyone: chrome settles within 250ms and hovers
  within 150ms ([Motion](../004-interface-design/motion.md)); reduce
  motion is the stricter of the two and wins.
- `notifyDocumentJoin` / `notifyInviteResponse` undefined / true → the
  matching email notification is on (the default; [Account settings & email notifications](../014-identity/profile-and-email-notifications.md)). Setting
  either to `false` is the only state that suppresses its email. Read
  server-side by the api worker before sending; flipped from the
  Settings dialog. Emit `UI`/`Toggled`/`NotifyDocumentJoin{On,Off}`
  and `NotifyInviteResponse{On,Off}` ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).
- `notificationsEnabled` undefined / true → notifications on (the
  default). Setting it to `false` suppresses the success + info toasts
  the editor shows for consequential, otherwise-silent actions (a
  document moved to a folder, duplicated, or deleted from a long list; a
  tab linked into another document). **Error toasts are never gated by
  this** — a failure the user would otherwise never see still surfaces,
  so turning notifications off quiets the chatter without hiding
  breakage. The gate is read fresh on each toast push (a synchronous
  `readUserPreferences()` call in `hooks/ui/useToast.tsx`), so a flip
  applies immediately with no subscription.

- `powerUserMode` undefined / false → the mode is off (the default). Switching it
  on applies the preset and records `powerUserBaseline`; switching it off restores
  every preset setting the user did not change and deletes the baseline
  ([Power user mode](power-user-mode.md)). Emits `UI`/`Toggled`/`PowerUserMode{On,Off}`.
- `minimalChrome` → honoured only while `powerUserMode` is on, where undefined /
  true is on. Off the mode it has no effect whatever its value. Emits
  `UI`/`Toggled`/`MinimalChrome{On,Off}`.
- `powerUserOfferShown` undefined → the offer may still be made, once its
  thresholds are met.

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
  settings menu: the Appearance cycle button in the footer, and each of those rows says
  **"Also in ..."** so the pair reads as deliberate.
- There are no per-tool preferences left: the one there was
  (`recogniseShapes`, flipped from the pencil's banner) became two palette
  tiles instead ([Two pens instead of a pen and a mode](../008-canvas/two-pens.md)), which is that idea taken to its end: the setting
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
  modals: ShareDialog, ExportTabDialog, ImagePicker). Trigger: a
  gear-icon button in the TabBar footer, sitting between Search and the
  dark-mode toggle. The "Keyboard shortcuts" command in search
  ([Command palette (⌘K)](command-palette.md)) opens it on the **Keyboard** category; that category replaced the standalone
  Shortcuts dialog and the footer's keyboard button. Settings can also open on a **section**
  of a category (the Google Drive connect flow returns to Account > Cloud Sync): the section
  scrolls into view and its heading takes focus. The Explorer and the editor both take
  `?settings=<category>&section=<section>` in their URL: it opens Settings there on load, and
  stays in the URL while Settings is open (removed when it closes), so a page left for
  another site and reached again with Back reopens it. Visible in every role: view-role visitors can still
  flip their own telemetry preference and (harmlessly) their own
  auto-rebind preference, even though they can't edit elements.
  **Shaped like the iOS Settings app**, in both of that app's forms, because
  it had outgrown a single scrolling accordion: six groups of long paragraphs
  on one screen, where finding a setting meant opening groups until one held
  it.

  - **Desktop** takes the iPadOS split view: the categories in a fixed left
    rail, the selected category's settings in the pane beside it. A category
    is always selected (Editor, unless it reopens where it was left) - the pane
    is never empty. The dialog
    is a fixed `42rem` tall (less on a short window), whichever category is
    open: sized to content, the frame jumped between categories, and
    unbounded, a long category stretched it from the top of the screen to
    the bottom and read as a page, not a modal. A long category scrolls
    inside the pane; a short one leaves space below it.
  - **Phone** (below the `sm:` breakpoint, via `useIsMobileViewport`) takes
    the iPhone push navigation: a root list of the same categories, each a
    tappable row, which pushes that category's pane with a back control in
    the header. One screen at a time.

  The desktop pane is never empty: with no category chosen (the phone's root
  list, carried across a resize or rotate), or one not (yet) among the
  visible ones, it shows the first category without forgetting the choice,
  so a remembered category appears once capabilities load.

  **It reopens where you left it.** Reopening Settings lands on the category
  last open and scrolls its pane so the same row sits at the same height as
  when the dialog closed. The position is kept as a **scroll anchor**: the
  topmost visible row's key plus how far its top sat from the pane's top
  edge, not a pixel offset. A resize reflows every footnote, so a raw
  `scrollTop` would land on a different row; the anchor brings the same row
  back at any window size. Rows that change height after the restore (the
  token list loading) are re-anchored until the reader scrolls, taps or
  types in the pane. The offset is measured in layout pixels, not rendered
  ones: re-anchoring starts while the dialog still scales in from 0.96, and
  a rendered measure would land short by 4% of the offset. A pane scrolled
  to its very top keeps no anchor.
  Picking another category always starts its pane at the top.

  - A targeted open (a search result, the `?settings=` deep link) wins over
    the memory and restores no scroll.
  - On a phone, closing from the root list reopens on the root list.
  - A remembered category or row that no longer exists falls back to the
    default category, or the top of the pane.
  - The search box always opens empty.
  - Stored device-local in `localStorage` under
    `livediagram:settings-view:v1` and never synced: where you were in a
    dialog belongs to this screen, not the account. Unreadable or malformed
    storage is ignored with a `[settings-view]` warning.
  - Written when the dialog unmounts and on `pagehide`, never per scroll
    event. The backdrop is the
    see-through `desktop-light` one, not the default dim+blur: this is where
    you flip things whose effect is on the canvas behind it.

  **It is the central place to find every preference.** Categories:
  **Editor** (quick-add on hover, alignment guides, auto-attach arrows,
  middle-mouse pan, then a **Power User** section: power user mode, and
  Minimal chrome while the mode is on; with the sub-category **Draw**: dock
  position, Top or Bottom), **Appearance** (theme, UI scale with a slider per part), **Keyboard**
  (the Keyboard Shortcuts on/off switch, then the full shortcut catalogue as
  collapsible groups), **Panels** (panel layout, panel opacity; with the
  sub-categories **Layers**, **Map**, **Collaborate** and
  **Quick Style**, one per panel),
  **Accessibility** (reduce motion, show welcome tour), **AI Tools** (assistant,
  suggested prompts, and a **Manage API Tokens** link row that opens the API
  Tokens sub-category), **Documents** (a **Where New Documents Go** section: one row per
  [default folder](../013-workspace/default-folders.md#settings) entry, with Change and Clear; not a
  preference, it reads and writes `/api/placement-defaults`), **Account** (identity, Trash, **Cloud Sync** (the cloud providers the
  deployment offers, [Google Drive mirror](../022-drive-mirror/drive-mirror.md)), delete account, see
  [Account settings & email notifications](../014-identity/profile-and-email-notifications.md); with the
  sub-categories **Notifications** (in-editor, plus the six email preferences) and **API Tokens** (create, view and
  revoke API tokens, see [Public API and tokens §3.6](../015-api/public-api-and-tokens.md#36-management--the-settings-dialogs-api-tokens-category);
  only when sign-in is enabled on the deployment)), **Privacy** (telemetry).
  Editor leads because it is what most
  people came to change; Account and Privacy sit at the end, where the
  account-shaped things belong.

  **A link row** (`kind: 'link'`) opens another category of the same dialog
  in place, the way the power user preset readout goes to a row: it names the
  category it opens and never navigates the page.

  **Every signed-out message links to sign in.** Wherever a Settings row says
  something needs an account (the guest identity card, Delete Account, the
  email stand-in card, the API Tokens manager), the message ends with a
  **Sign In** link to `/sign-in/` that returns to the current page. On a
  deployment without sign-in (`clerkEnabled` false) there is nowhere to sign
  in, so the link is absent. Preferences whose
  day-to-day home used to be a panel's own gear popover live here now, and
  only here - see **UI placement** below.

  A category can hold **sub-categories** (`parent` on the sub-category's
  spec). **Editor** holds one per editor mode whose settings apply only to
  that mode ([Editor modes](editor-modes.md)): **Draw** holds Dock Position,
  since only Draw mode has a dock. A setting that applies in both modes
  stays on Editor itself; quick-add on hover, alignment guides, auto-attach
  arrows, middle-mouse pan and power user mode all act in both. There is no
  **Diagram** sub-category while no setting applies only to Diagram mode: a
  category with no rows is never shown, and one is added beside Draw the day
  a Diagram-only setting lands. **Account** holds **Notifications** and
  **API Tokens**: both belong to the person rather than the editor. Their
  category ids (`notifications`, `tokens`) predate the nesting and are
  kept, so every `?settings=notifications` / `?settings=tokens` deep link
  (email footers, the old `/explorer/profile` redirect) and every in-app
  link to them still opens the same pane.

  Panels holds Layers, Map, Collaborate and Quick Style,
  one per panel, each its own pane. Each opens with that panel's **Enable
  switch** ("Enable Layers Panel", "Enable Map",
  "Enable Collaborate Panel", "Enable Quick Style Panel"; see the panel
  switches in the data model). The panel's other rows nest beneath the
  switch (`parent`) and are offered only while it is on, the way power
  user mode's rows follow that mode: a setting for a panel you have
  turned off has nothing to act on. The Map's switch keeps its stored key
  (`showMinimap`) and its telemetry tokens, only its label changed. A parent's sub-categories follow it directly in the catalogue. In the
  list the parent is an **accordion**: its sub-categories sit indented beneath
  it only while it is expanded, so they do not take up the list all the time.
  It starts collapsed. On desktop, clicking the parent opens its own pane and
  expands it, and clicking it again folds it away, handing the selection back
  to the parent if a sub-category held it, so the open pane is never one the
  list has just hidden. A disclosure chevron inside the parent's row (the
  row's highlight takes it in) toggles it without changing the pane. It is
  held open while one of its sub-categories is the current pane (a search
  result, a link, a remembered view) or holds a search hit. **A phone has no
  accordion to work**: the parent is an ordinary row that pushes its pane,
  and that pane ends with its sub-categories as rows in the root list's
  grouped card, each pushing its own pane, the way iOS Settings nests a
  screen. Back from a sub-category returns to its parent's pane (the back
  control reads "Panels", "Editor" or "Account"), and back from there to the root list. On the
  phone's root list the sub-categories show beneath the parent only for a
  search hit. (A disclosure chevron on the phone was tried and dropped: its
  right-pointing arrow read as the row's own "go" arrow, so the
  sub-categories behind it went unfound.) A
  sub-category carries a plain 16px glyph rather than a tile: its panel's own
  mark in the editor (Lucide layers for Layers, the Collaborate button's
  glyph; the Map and Quick Style, which have no
  toolbar button, take Lucide map and Lucide palette; Draw takes the
  marker the editor mode switch shows for Draw mode; Notifications and
  API Tokens keep the bell and key they carried as top-level tiles). Search matches a
  sub-category's rows on its parent's name too, and the canvas search names
  it by path ("in Panels › Layers", "in Editor › Draw", "in Account ›
  API Tokens").

  Within a category, rows carry an optional **`section`** so a category
  holding several clusters (Editor's Power User rows) gets a sub-heading per
  cluster. Sections group CONSECUTIVE runs, so one cannot be split and
  silently re-headed further down.

  Each category row carries a **coloured, rounded icon tile**, iOS-style -
  the thing the eye navigates by once the labels blur together. Colour is a
  second channel, never the only one: every category has its own glyph too.

  A setting renders as a **one-line row** (label + control), with its
  long-form explanation as a **grey footnote below the row**. Labels are
  **Title Case**. Row kinds: `toggle`, `choice` (a segmented control, e.g.
  the theme and the minimap size), `slider` (panel opacity, UI scale, committing on
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
  Toolbar, [Toolbar layout](toolbar-layout.md)) and **Theme** (Light / Dark / System, the
  last drawn half light and half dark). Theme's pictures are drawn in their
  own fixed colours and are never dimmed, since their colour is the point: a
  dimmed light editor reads grey on a dark dialog. A test holds every
  illustrated choice row to drawing exactly its options.

  **Clicking a picture picks it.** Clicking the drawing of the state you
  want is the obvious move, so each state of an illustration is a click
  target: a choice row's option, or a toggle row's Off / On half. The one in
  force and any option that can't be picked right now (a desktop-only one
  on a phone) take no click and show no pointer. It is a pointer
  convenience: the radios and the switch stay the keyboard and screen-reader
  control, so the SVG keeps `role="img"` and its states aren't focusable.

  A choice option can be **desktop only** (`desktopOnly` in the catalogue).
  On a phone-sized viewport it stays visible but can't be picked, and a note
  under the row says why. Panel Layout's Floating is desktop only: a phone
  shows Toolbar instead ([Toolbar layout](toolbar-layout.md)), which is therefore the phone default,
  and the row rings Toolbar there (`read(prefs, { mobile })`).

  A whole row can be desktop only too (`desktopOnly` on the row, holding the
  note to show). On a phone-sized viewport the row stays visible, greyed,
  showing its stored value, but its control (and its illustration) takes no
  input, and the note says why; the stored value is untouched, so it still
  applies on a desktop. The Map's rows (Enable Map, Dim Outside the View,
  Map Size) are desktop only: a phone never draws the Map
  ([Minimap](../008-canvas/minimap.md)), so flipping them there did nothing
  and read as broken.

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
  ([Transactional & lifecycle email (Resend)](../014-identity/transactional-email.md)) and the reader is signed in - a guest has no address, so those
  switches could never apply. A category left with no applicable rows drops
  out entirely rather than becoming a row that pushes a blank pane.
  **Power-user-only rows** (Minimal chrome) are absent the same way unless
  power user mode is on ([Power user mode](power-user-mode.md)); they appear the
  moment the mode's row is switched on, without reopening the dialog.

  A row may have a **parent** row: its children render directly beneath it,
  indented, as one group named "<parent label> settings" (the power user mode
  row's Minimal Chrome and its preset readout). A child whose parent is not
  among the rows shown (a search match) renders on its own.

  (Element add is a single always-on tap-or-drag gesture with no setting, see
  [Canvas and palette](../008-canvas/canvas-and-palette.md).) The
  **Editor** group holds `middleMousePan` (default on): holding the
  middle mouse button drags the canvas in both axes from anywhere, over
  empty space or elements, whatever tool is active — off leaves the middle
  button to the browser. The
  **Keyboard** group holds the **Keyboard Shortcuts** switch, which is
  per-device (localStorage, not `UserPreferences`) so shortcuts can be on at
  a full keyboard and off on a tablet; it used to sit in Controls, and
  before that at the foot of the Shortcuts dialog. Below it, the shortcut
  catalogue renders as collapsible groups, the same content the old dialog
  listed. The
  Notifications group holds `notificationsEnabled`, whose description
  notes that errors are always shown regardless. The
  Accessibility group holds `reduceMotion`, noting the OS setting is
  always respected and this only adds a user-forced override. The
  Experimental group, after AI Tools, holds `infographicModeEnabled`
  ([Editor modes](editor-modes.md#experimental-modes)), off by default;
  it emits `UI`/`Toggled`/`InfographicMode{On,Off}`.

- **Per-tool surfaces**: none today. The pencil's ModeBanner used to
  carry a `recogniseShapes` toggle; [Two pens instead of a pen and a mode](../008-canvas/two-pens.md) replaced it with two
  palette tiles, so no preference is set from a tool's own chrome any
  more. The Highlighter's Colour and Width ([Highlighter](../008-canvas/highlighter.md)) are set from
  the Quick style panel while its tile is armed, and are session-local editor state setting the next
  stroke rather than a persisted preference.

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
