# User preferences

Per-user editor preference flags that toggle behaviour without
changing design content. Most are exposed through a small
Settings dialog launched from the footer (the **Application settings**
gear button to the left
of the dark-mode toggle); a small number are per-tool toggles
that live next to the tool they affect (see the UI placement
section below) rather than in Settings. Either way the
persistence model is the same. Replaces the earlier
per-design-settings shape: preferences are about the user's
editor experience, not about any particular design, so they live
once per account / device and apply everywhere.

## Where preferences live

livedesign keeps no preferences of its own. They are kept with the person's
**liveworkspace account** ([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md)
"Settings"), with `localStorage` as a fast warm cache so the editor never
blocks on a network round-trip at boot.

- **The account's settings**, read and written by the api worker through
  the accounts Worker's internal API (`apps/api/src/accounts/settings.ts`,
  app `livedesign.app`). Each person has two scopes there: **All**, the keys
  every liveworkspace app shares (`ALL_SETTING_KEYS` in
  `@liveworkspace/settings`: privacy, motion, notifications, the chrome's
  scale and opacity, power user mode, your own swatches, and the editor
  settings two or more apps have: the Home banner, the Collaborate, Quick Style, Layers and Map panels, alignment guides, auto-attach arrows, element indicators, quick-add on hover and Pages' Contents), and livedesign's
  own for every other key. The api joins the two on a read
  (`joinSettings`) and splits a change between them on a write
  (`splitSettings`), so the editor sees one flat set. A shared key changed
  here changes in every app that has it, and the Settings dialog marks those
  rows with a quiet **All apps** note under their description.
  A shared key's value may still sit in this app's scope: `joinSettings` uses it
  until `all` has one, and the first change writes `all` and drops the app's copy.
- **Owners.** A signed-in person's settings are their account's
  (`user_…`). A guest's are kept under their server-minted guest id
  (`guest_<id>` to the accounts Worker), so a guest who clears
  `localStorage` in the same browser still gets them back.
- **localStorage cache** keyed `livedesign:user-preferences:v1`. Read
  synchronously at page-load so the Settings dialog and gate caches
  (telemetry, draw-to-add, etc.) have a value to read before the network
  fetch returns.

### Sync flow

- **On page load**: read the localStorage cache synchronously
  (zero-blocking), then fire-and-forget `GET /api/preferences`, **once per
  page load and owner**: the Explorer and the editor share one read
  (`fetchUserPreferences`), so a session costs one accounts call. When the
  answer arrives, merge it over the cache (server wins for any key present
  on both sides), persist back to localStorage, and dispatch the existing
  `livedesign:preferences-changed` window event so in-process listeners
  refresh. If the fetch fails the cache stays authoritative, and the next
  ask tries again.
- **On toggle**: update localStorage immediately (so the UI reflects the
  change without waiting for the network), then queue a save.
- **Saving to the server** (`apps/live/lib/preferences-sync.ts`):
  - **It fits.** The set is trimmed to 4,096 characters of
    `{"prefs":...}` before it is cached or sent: an old blob's
    `recentExcludedIds`, which nothing reads since Recent moved to
    liveworkspace's index ([Hide from Recent](../013-workspace/hide-from-recent.md)),
    goes whole; every other key stays whole. A full account measured 4,967 characters. A
    trim logs `[preferences] trimmed to fit dropped=<n> length=<n>`.
  - **Only what changed is sent, each key whole.** A save is a patch: the
    keys whose value differs from what the server last held (the set
    fetched at load, then each save it confirmed), each with its whole
    value, and `null` for a key removed. The accounts Worker replaces a
    value rather than merging into it, so an object value is
    always sent entire. Another app or tab changing
    other keys meanwhile keeps its change.
  - **Changes close together are one save.** A save waits
    `PREFERENCES_SAVE_DEBOUNCE_MS` (400 ms) after the last change: a
    slider dragged across 20 steps is one request, not 20. A tab going
    away (`pagehide`) sends a waiting change at once.
  - **One save at a time, the latest wins.** A change made while a save
    is in flight waits for it, so saves never land out of order.
  - **A save that did not land keeps this device's copy.** From the
    moment a save is queued until one succeeds, this browser is marked
    unsynced for that owner (`livedesign:user-preferences:unsynced`,
    holding the owner id). A refused or failed save (logged
    `[preferences] save-refused status=<n>` or `save-not-confirmed`)
    leaves the mark, and the next load lets the cache win over the
    server's set and sends the difference again, instead of the server
    reverting settings it never received.
- **A guest's Settings in the Explorer**: the Explorer on this app's
  address (`/explorer`, liveworkspace's, served through the router) gives a
  guest this app's settings too, and changes them in this same cache
  (`livedesign:user-preferences:v1`, one key at a time over the freshest copy)
  rather than over the network. Each change also sets the unsynced mark
  for the guest's `guest_<uuid>`, so this editor's next load keeps the
  cache over the server's copy and sends it on, as for a save of its own
  that never landed ([liveworkspace/docs/specs/010-site/site.md](../../../../liveworkspace/docs/specs/010-site/site.md#settings)
  "A guest"). Renaming the key or the mark means changing
  `DEVICE_PREFERENCES` in `@liveworkspace/settings/device` with it; the
  settings-site-catalogue test fails until both agree.
- **Cross-tab updates**: the browser's native `storage` event on the
  preferences key still fires across tabs in the same browser, so toggling
  in one tab updates every open editor and Explorer: both follow the cache
  live rather than holding their own copy. A change is always built on the
  freshest cache, never on a render's snapshot (`rebaseUserPreferences`:
  only the keys the change touched are applied over the cache); built on a
  snapshot, it would undo a change another tab made since.

### Why not localStorage only

Signed-in users who use livedesign on a laptop and a phone would have to
re-flip every setting on each device, and a person using several
liveworkspace apps would set motion, notifications and scale once per app.
Keeping them with the account fixes both.

**Panel corner layout is the deliberate exception.** Which corner
each corner panel docks into ([Panel corner docking](panel-docking.md)) is a
per-device ergonomic choice (screen size, handedness, monitor), so it
lives in its own **device-local** `localStorage` store
(`livedesign:panel-layout:v1`) and is **not** part of the synced
set. Don't fold panel placement into `UserPreferences`.

### Sign-up migration

When a guest signs up, the accounts Worker merges the guest into the
account ([Auth + guest access](../014-identity/auth-and-guest-access.md)
"Guest → account migration"), settings included: the account keeps what it
already has, the guest's values fill its gaps, then the guest's are
cleared. A second merge finds nothing left to move.

### Without liveworkspace accounts

A deployment with no accounts Worker configured keeps no preferences on the
server: `GET` and `PUT /api/preferences` answer 404
`preferences_not_stored`, the editor stops sending for that page load, and
the localStorage cache is the only store. No SaaS call is required.

## Schema

```ts
type UserPreferences = {
  // When false, the live editor skips the auto-rebind that moves a
  // pinned arrow end to the side facing the other end once its drawn
  // path runs through a shape after a move (packages/design's
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

  // Opacity (0..1) of EVERY panel at rest, so the canvas shows through
  // them; they snap back to fully opaque while hovered or focused so they
  // stay readable in use. Applied via the `--lvd-panel-opacity` custom
  // property (usePanelOpacity), read by every surface tagged
  // `data-panel-translucent`: MovablePanel in both its docked and its
  // popover branch (so the Explorer, Layers and Collaborate
  // popovers follow it too), the Map, the Quick style panel and the
  // Toolbar strip. Buttons are not panels: the
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
  // Button Labels (Settings › Appearance): the names beside the editor's bottom buttons' icons, the
  // footer bar's and, on a wide desktop, the bottom-right cluster's (live-app.md "Named on a wide
  // desktop"). Missing / true === shown; a phone never shows them. Read through useDockNames.
  dockButtonNames?: boolean;

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

  // Email notification preferences (docs/specs/014-identity/profile-and-email-notifications.md). Account-level email
  // settings that share this synced blob rather than a parallel store,
  // surfaced in the Settings dialog's Notifications category (only when the deployment has
  // email configured: capabilities.emailEnabled). The api worker reads
  // these server-side before sending the matching transactional email
  // (docs/specs/014-identity/transactional-email.md), so a missing key === undefined === notify (opt-out, not
  // opt-in). Distinct from `notificationsEnabled`, which gates in-editor
  // toasts, not email.
  //
  // When false, suppress the "someone first opened one of my shared
  // designs" email. Defaults to true (notify).
  notifyDesignJoin?: boolean;
  // When false, suppress the "someone accepted/declined a team invite I
  // sent" email (sent to the team's admins). Defaults to true (notify).
  notifyInviteResponse?: boolean;

  // The Pages tour's seen record (docs/specs/007-editor/pages-tour.md): true counts every
  // page kind's track as seen while Power user mode is on. Set with every kind by Power user mode.
  pagesTourSeen?: boolean;
  // The page kinds whose Pages tour track has been taken (completed or skipped). Feeds Settings' row per kind (Logo Tour, ...), which adds or removes its own kind, and which page a
  // Start Pages Tour press prefers; it never hides the button.
  pagesTourKinds?: PageKind[];
  // Element tours (docs/specs/007-editor/element-tours.md): the toured element kinds whose tour has been started
  // (a press of Start Tour). Surfaced in Settings as Tours › Show Me, one switch
  // per kind (inverted); it never hides the Start Tour button.
  elementTourKinds?: ElementTourKind[];
  // Counts every element tour as taken while Power user mode is on; written by its preset.
  elementToursSeen?: boolean;
  // DEAD (docs/specs/012-collaboration/presentation-mode.md): presenter settings livedesign has no use for.
  // Nothing reads or writes this; a stored value is ignored and left in place.
  presentation?: Record<string, unknown>;
  // DEAD (../004-interface-design/colour-picker.md "Custom colours"): Custom colours are kept with the design's tabs, not per user.
  // Nothing reads or writes this; it stays because it is already stored.
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
  // How an element shows its link, note, action and comments
  // (../008-canvas/element-indicators.md): glyphs inside its top-right corner
  // ('top'), a row along its bottom edge ('footer') or none ('off'). Unset, or anything
  // else, is Top (lib/element-indicator-style).
  elementIndicatorStyle?: 'top' | 'footer' | 'off';
  // Where the Contents sits on a desktop (./pages-mode.md "Contents"):
  // docked as a sidebar beside the canvas, or minimised to its cluster button.
  // Unset, or anything but 'button', is the sidebar (lib/contents-placement).
  contentsPlacement?: 'sidebar' | 'button';

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
- `panelLayout` and `minimalPanels`, which older blobs still carry, are
  ignored: there is one panel layout ([Toolbar layout](toolbar-layout.md#one-layout)).
- `contentsPlacement` undefined → the Contents docked as a sidebar
  flush against the canvas's edge on a desktop, with more than one page (the
  default). `'button'` minimises it to its cluster button; a phone always has
  the button. Which edge (left or right) is per device, kept in the browser
  alone, never here
  ([Pages](pages-mode.md#contents)). Written by the sidebar's
  Minimise, the popover's Dock as Sidebar and Settings › Editor › Pages ›
  Contents; emits `UI`/`Changed`/`ContentsPlacementSidebar` or
  `ContentsPlacementButton`.
- `elementIndicatorStyle` undefined → Top: an element's link, note, action
  and comment glyphs sit inside it along its top, top-right on a box and centred
  on a round or pointed shape (the default). `'footer'` moves them to a labelled
  row along its bottom edge; `'off'` hides them
  ([Element indicators](../008-canvas/element-indicators.md)). Emits `UI`/`Changed`/
  `ElementIndicatorsTop`, `ElementIndicatorsFooter` or `ElementIndicatorsOff`.
- `dockButtonNames` undefined / true → the editor's bottom buttons named
  beside their icons on a desktop (the default). `false` leaves them icons
  alone, each still named in its hover card. A phone shows icons alone
  whatever it says, so its Settings row is desktop only. Emits
  `UI`/`Toggled`/`DockButtonNames{On,Off}`.
- `alignmentGuides` undefined → guides on (the default). Setting it
  to `false` hides the faint guide lines during a move / resize; the
  snap behaviour itself is unchanged.
- `panelOpacity` undefined / 1 → every panel fully opaque (the
  default). A value below 1 makes every panel translucent at rest
  (snapping back to opaque on hover / focus) via the
  `--lvd-panel-opacity` custom property, on every surface: docked,
  popover (the cluster popovers), the Map, Quick style and the Toolbar
  strip. Buttons stay opaque. The **Explorer** is always fully opaque,
  docked or as a popover: it is where designs are read and managed,
  and its menus open outside the panel, so a fade would set in just as
  one of them is in use. A touch screen (no
  hover) keeps every panel opaque, since nothing there would bring a
  faded panel back while it is in use. Emits
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
- **Retired keys.** A key no setting reads (`activityPanelEnabled`, the Activity panel's revert hover preview,
  `skipLocationStep`) is ignored on read and dropped on the next write: Undo and Redo always show in the
  bottom-right cluster, and `/new` never asks where a design goes
  ([New design route](new-design-route.md#what-new-makes)), so new designs follow the
  [default folders](../013-workspace/default-folders.md).
  The keys livediagram stored for its other modes (`pagesModeEnabled`, `infographicModeEnabled`,
  `planModeEnabled`, `recogniseShapes`, `tourSeen`, `planTourSeen`, `planTourTracks`, `workshopTourSeen`,
  `drawTourSeen`, `formTourSeen`, the `whiteboard…` dock keys and `drawPattern`) are ignored the same way.
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
- `notifyDesignJoin` / `notifyInviteResponse` undefined / true → the
  matching email notification is on (the default; [Account settings & email notifications](../014-identity/profile-and-email-notifications.md)). Setting
  either to `false` is the only state that suppresses its email. Read
  server-side by the api worker before sending; flipped from the
  Settings dialog. Emit `UI`/`Toggled`/`NotifyDesignJoin{On,Off}`
  and `NotifyInviteResponse{On,Off}` ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).
- `notificationsEnabled` undefined / true → notifications on (the
  default). Setting it to `false` suppresses the success + info toasts
  the editor shows for consequential, otherwise-silent actions (a
  design moved to a folder, duplicated, or deleted from a long list; a
  tab linked into another design). **Error and warning toasts are never
  gated by this** ([Toasts](../004-interface-design/toasts.md)): a failure the user would otherwise never see still surfaces,
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

Empty (or missing entirely) localStorage entry, AND nothing stored
with the account for this owner, is therefore the "everything
on" state.

## UI placement

**Every preference lives in the Settings dialog**, and for almost all of them
that is the only control.

- The **Settings dialog** lists all of them, grouped and searchable by eye.
  It is the answer to "I half-remember a setting about layer previews" from
  someone who does not know which panel owns it, and the place a new reader
  goes to see what the editor can be told to do.
- **One setting, one control.** No panel carries a gear popover of its own
  settings: every preference has its row in the dialog, and a second home would
  only drift from it. A handful of preferences DO keep a second,
  in-context control where that control is the thing itself rather than a
  settings menu: the Appearance cycle button in the footer, and each of those rows says
  **"Also in ..."** so the pair reads as deliberate.
- There are no per-tool preferences.

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

- **Settings dialog**: `apps/live/components/dialogs/SettingsDialog.tsx`,
  lazy-loaded via `next/dynamic` (matches the other on-demand
  modals: ShareDialog, ExportTabDialog, ImagePicker). Trigger: a
  gear-icon button in the TabBar footer, sitting between Search and the
  dark-mode toggle. The "Keyboard Shortcuts" command in search
  ([Command palette (⌘K)](command-palette.md)) opens it on the **Keyboard** category; that category replaced the standalone
  Shortcuts dialog and the footer's keyboard button. Settings can also open on a **section**
  of a category: the section
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
    is never empty. The dialog is `60rem` wide (never more than 92% of the
    window), so the rail (`15rem`, whose names wrap rather than being cut off)
    and a readable pane sit side by side, and a fixed `44rem` tall (less on a
    short window), whichever category is
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
    `livedesign:settings-view:v1` and never synced: where you were in a
    dialog belongs to this screen, not the account. Unreadable or malformed
    storage is ignored with a `[settings-view]` warning.
  - Written when the dialog unmounts and on `pagehide`, never per scroll
    event. The backdrop is the
    see-through `desktop-light` one, not the default dim+blur: this is where
    you flip things whose effect is on the canvas behind it.

  **It is the central place to find every preference.** Categories:
  **Editor** (a **Canvas** section: alignment guides, auto-attach arrows,
  element indicators; a **Mouse** section: quick-add on hover, middle-mouse
  pan; then **Power User**: power user mode, with Minimal chrome and the preset
  readout nested under it while the mode is on; with the sub-categories
  **Pages** (a **Pages**
  section: Contents, Sidebar or Button; then a **Logo Pages** section: Logo Guides, with Logo Guide Strength and the Guides Shown chips
  nested under it)), **Appearance** (theme, then an **Interface** section:
  Button Labels, and UI scale with a slider per part nested under it), **Keyboard**
  (the Keyboard Shortcuts on/off switch, then the full shortcut catalogue as
  collapsible groups), **Panels** (panel opacity; with the
  sub-categories **Layers**, **Map**, **Collaborate** (its panel switch, then the device-local Hide Participant Cursors switch, shown only while the tab draws other people's cursors, [Collaborator enhancements](../012-collaboration/collaborator-enhancements.md)) and
  **Quick Style**, one per panel),
  **Accessibility** (reduce motion, and a **UI Scale** link row that opens
  Appearance), **Tours** (one switch per guided tour, see **Tours** below),
  **Designs** (a **Default Folders** section with one row per
  [default folder](../013-workspace/default-folders.md#settings) entry, with Change and Clear; those are not a
  preference, they read and write the index's placement defaults), and an **Explorer** section with **Show Home Banner**
  (`homeBanner`, missing means shown; [Explorer Home](../013-workspace/explorer-home.md#hiding-the-banner))), **Account** (identity, Trash, delete account, see
  [Account settings & email notifications](../014-identity/profile-and-email-notifications.md); with the
  sub-categories **Notifications** (in-editor, plus the seven email preferences) and **API Tokens** (create, view and
  revoke API tokens, see [Public API and tokens §3.6](../015-api/public-api-and-tokens.md#36-management-the-settings-dialogs-api-tokens-category);
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
  **Sign In** link to `/sign-in/` that returns to the current page. Panel preferences live here, and
  only here: see **UI placement** below.

  A category can hold **sub-categories** (`parent` on the sub-category's
  spec). **Editor** holds **Pages** (Contents and the logo guides); the
  settings that act on the whole canvas (quick-add on hover, alignment guides, auto-attach arrows, middle-mouse pan
  and power user mode) stay on Editor itself. A category with no rows is never shown. **Account** holds **Notifications** and
  **API Tokens**: both belong to the person rather than the editor. Their
  category ids (`notifications`, `tokens`) predate the nesting and are
  kept, so every `?settings=notifications` / `?settings=tokens` deep link
  (email footers, the old `/explorer/profile` redirect) and every in-app
  link to them still opens the same pane.

  **Webhooks** are an account's too, made and managed in liveworkspace's Settings
  ([Webhooks](../../../../liveworkspace/docs/specs/004-index/webhooks.md#managing-them)). Signed in, the Account
  section's **Webhooks** links there. A guest gets a **Webhooks** category under Account (id `webhooks`, so
  `?settings=webhooks` opens it) holding one stand-in row, "Sign in to add webhooks." with the **Sign In** link,
  the same shape as the email stand-in, so it reads the way API Tokens does for a guest. A workbench has neither.

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
  toolbar button, take Lucide map and Lucide palette; Notifications and
  API Tokens keep the bell and key they carried as top-level tiles). Search matches a
  sub-category's rows on its parent's name too, and the canvas search names
  it by path ("in Panels › Layers", "in Editor › Pages", "in Account ›
  API Tokens").

  Within a category, rows carry an optional **`section`** so a category
  holding several clusters (Editor's Power User rows) gets a sub-heading per
  cluster. Sections group CONSECUTIVE runs, so one cannot be split and
  silently re-headed further down.

  Each category row carries a **coloured, rounded icon tile**, iOS-style -
  the thing the eye navigates by once the labels blur together. Colour is a
  second channel, never the only one: every category has its own glyph too.

  **Grouped rows.** Each section of a category is **one card** (`SettingsGroup`),
  iOS grouped-list style: its rows are cells inside it, split by hairlines,
  rather than a card per row. A cell holds the **label** with a **short
  description** under it (one or two lines, so the dialog stays skimmable) and the **control** beside them; a **Learn more** link and an
  **"Also in ..."** line close the description. Labels are **Title Case**.
  A row nested under a parent row (`parent`) renders inside the same card,
  indented and faintly tinted, beneath it. What every row of a section shares
  is said **once**, in a **section note** under its heading (`sectionNotes` on
  the category: Designs' Default Folders, the Tours' Offer Again), not
  repeated under each row. A row reused outside a group (`SettingsRow`) draws the same cell inside a card of its
  own.

  Row kinds: `toggle`, `choice` (a segmented control, e.g.
  the theme and the minimap size), `slider` (panel opacity, UI scale, committing on
  release so one drag is not one PUT per pixel), `toggleGroup` (several
  switches as one row of chips, see **Toggle groups** below), `appearance` (the one row
  backed by the device-local store, not `UserPreferences`), and `tokens` (the
  API token manager).
  A toggle row's control is `@liveworkspace/ui`'s `Switch` at its `sm` size
  (a 20 x 36 px track, the compact look Settings has always had), named by the
  label (`aria-labelledby`) and described by the description. It is drawn with
  `coversRow`, so its `::after` stretches over the whole cell and a click
  anywhere on the row flips it, while the help link and the illustration sit
  above that layer and keep their own clicks. A screen reader hears one switch.

  Settings whose effect is **visual** carry a small **before/after
  illustration** drawn from the real editor, which **rings the state
  currently in force** so the picture doubles as a readout: the minimap,
  alignment guides, layer thumbnails, and the minimap's dimming.

  Pick-one settings whose options LOOK different draw **one picture per
  option** instead, side by side with no arrow, the one in force ringed
  (`settings-choice-illustrations.tsx`): **Theme** (Light / Dark / System, the
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

  A whole row can be desktop only too (`desktopOnly` on the row, holding the
  note to show). On a phone-sized viewport the row stays visible, greyed,
  showing its stored value, but its control (and its illustration) takes no
  input, and the note says why; the stored value is untouched, so it still
  applies on a desktop. The Map's rows (Enable Map, Dim Outside the View,
  Map Size) are desktop only: a phone never draws the Map
  ([Minimap](../008-canvas/minimap.md)), so flipping them there did nothing
  and read as broken. So are the Mouse section's (Quick-Add on Hover, Middle-Mouse
  Pan): a phone has no hover and no middle button.

  **Tours** is a category of its own: **Pages Tours** (over **Wireframe Tour**, **Logo Tour** and **Photo Tour**), with a line saying where it runs and a **Learn more** to its article, under
  one **Offer Again** section note. No tour offers itself: every tour is started from the footer's
  **Start Tour** button, immediately left of Search, and stays there once taken ([Pages tour](pages-tour.md)).
  These rows record which tours have been taken; switching a Pages track back on and closing Settings starts the Pages
  tour when it is on offer right now. (The note's words, and the Show Me section's, say tours offer themselves once; none
  does.) A tour is not an accessibility setting, so the rows are not under Accessibility. Every switch is inverted: on means "not taken yet", the
  preference records "already seen", and its telemetry tokens still describe the PREFERENCE (switching on is
  `...SeenOff`), so each dashboard series keeps its meaning.

  The Pages tour is a tour of several tracks (`apps/live/lib/tour-tracks.ts`), one per page kind
  ([Pages tour](pages-tour.md)): **Pages Tours** is one switch over all of them (`tourTracksSwitch`, key
  `pagesTourSeen`: on while any track is untaken, off marks every track taken, on forgets every record), and each track
  has its own row nested beneath it, named for itself (`tourTrackSwitch`). A track's row is on while its track is
  untaken; off adds its kind to `pagesTourKinds`, on removes it alone, and both clear the single `pagesTourSeen`,
  folding it into the list first so one track back on leaves the others taken. Power user mode's readout lists
  the switch over all its tracks (**Pages Tours**). The old single flag `pagesTourSeen` counts every track only
  while Power user mode is on.

  Below the Pages tours, **Show Me** (element tours, named Show Me in the interface) is its own section, a closed
  accordion naming how many are on ([Element tours](element-tours.md#settings)): **Show Me on Every Element**, built
  as Pages Tours is (`tourTracksSwitch`) against `elementToursSeen` and `elementTourKinds`, with one switch per toured
  kind nested under it, named for the element (**Sankey Diagram**). Element tours
  need no relaunch: the Start Tour button offers one whenever its element is selected. A category may mark any section
  closed this way (`collapsedSections`); Settings opened on one of its rows opens it.

  **Toggle groups.** Several related switches that share one description are
  one `toggleGroup` row: the label and description over a row of **chips**, one
  per switch, ticked and tinted while on, each its own preference with its own
  telemetry. Chips rather than a grid of switches, so short names fit without
  truncating. **Guides Shown** (one chip per logo guide) is the one
  today; six near-identical rows each saying "Shows the X among a logo page's
  construction guides" read as clutter.

  **Button Labels** (Appearance › Interface, `dockButtonNames`, on by default)
  names the editor's bottom buttons beside their icons: the footer bar's Search,
  Settings and theme, and the bottom-right cluster's (Contents, Style and
  the rest) on a desktop wide enough for them ([Live app](live-app.md)). Off,
  they are icons alone, each still named in its hover card. A phone always shows
  icons alone, so the row is desktop only there.

  The dialog is **data-driven**: `settings-catalogue.ts` declares the
  categories and, per row, its label, description, help article, section,
  illustration, availability, how to `read` and `write` itself, and its
  telemetry tokens (unchanged from before this rework, so history stays
  continuous). Adding a setting is a catalogue entry, not another JSX block
  in a file that only grows. Picking a category emits `UI` / `Opened` with a
  `Settings<Category>` type.

  **One Settings view for every app.** The dialog's view is shared:
  `@liveworkspace/settings-ui` (`packages/settings-ui` at the monorepo root) draws the header with its
  back bar, the rail, the pane, search and its "no matches" state, the view memory and scroll
  anchor, sections, collapsed sections, nested rows, the desktop-only note and every generic row
  (`toggle`, `choice` with its illustration, `slider`, `toggleGroup`, `link`, `note`, the power user
  preset readout and the shortcut list). It knows nothing of this app: it is driven by a plain model
  (categories with an icon, rows with a value and an `onChange`) and is handed the app's pieces (the
  search box, close button, help link, Sign In link, illustrations) through `SettingsUiKit`. The app
  keeps `SettingsDialog.tsx` (the frame, the tours it relaunches on close, the footer),
  `settings-catalogue.ts`, `settings-model.tsx` (its catalogue bound to the live preferences: the
  standard kinds through the package's `bindStandardRow`, which tracks each change before writing it,
  and its own rows as `custom` rows), its icons and illustrations, and the rows only it has
  (appearance, shortcuts, tokens and pairings, identity, delete account, trash, default folders).
  liveworkspace.app renders the same view over this app's derived catalogue
  ([liveworkspace/docs/specs/010-site/site.md](../../../../liveworkspace/docs/specs/010-site/site.md) "Settings"), so the app's
  settings look the same there as here.

  **This app or All.** The dialog is the package's `SettingsPanel`, the one Settings panel every app
  and liveworkspace.app open. Its header carries a switch like the Explorer's filter: **livedesign**
  (this app's logo and name) and **All** (liveworkspace's logo). livedesign shows, signed in, the **Account** section and the **Common** settings this app has, then this app's
  own Settings (as above, less what those two hold): they shape this app as much as its own. Its own rows draw
  at once and the rest join them when read (a read that fails leaves this app's own rows, with a note and Try again
  for the rest); a guest sees this app's own Settings alone, asking the network
  for nothing. All shows every setting the account
  has: first an **Account** section (Profile, Notifications, Privacy, Accessibility), then one set of categories
  merged across every app (liveworkspace/docs/specs/010-site/site.md "Settings", "All"): one Editor, one Tours, one Explorer and so
  on, with no group per app. In each, the shared rows come first: every editor setting two or more apps have
  (`COMMON_SETTING_KEYS`, liveworkspace/docs/specs/003-accounts/accounts.md "Common settings"), once, and any row two apps keep under the
  same key and wording, once, written to each; then each app's own rows under a small sub-heading with its logo and
  name. This app's rows are its own Settings minus the shared switches the Account section already
  holds (a row marked "All apps" whose key is one of the Account section's), and its common rows are this editor's
  own rows (so a change there is counted and synced as here), so a setting never shows twice; the other apps' rows are their own rows of their
  plain-data catalogues (`@liveworkspace/settings/catalogues/<app>`), read and written over
  liveworkspace's account API through this app's router (`/api/workspace/account/settings/<app>`)
  with the person's access token (`currentBearer`), the door the Explorer panel's teams already use.
  The Account section's switches are this editor's own shared preferences, changed through this
  editor's own row for the key when it has one (so the change is counted and synced as here), and
  its Profile's Name and Colour is edited in place, never a link away: the shared editor
  (`ProfileEditor` in `@liveworkspace/settings-ui`), which reads and patches the profile over the
  same door (`/api/workspace/account/profile`, `bearerProfileHost`). A saved name or colour is the
  editor's own at once: its cursor, name tag and presence avatar in the room follow it without a
  reload (`announceProfileSaved` / `onProfileSaved`), and opening the editor again never overwrites
  a stored name with the account name. Sign-in Methods and devices link to liveworkspace.app, whose
  session holds them. Nothing of All is fetched
  until All is first chosen: its code and the three other apps' catalogues are their own chunks, one
  read per other app, kept for the page's lifetime. All is offered only to a signed-in account
  outside a workbench (a guest's settings stay in this browser); a targeted open (a search result,
  `?settings=`) lands on livedesign; otherwise the dialog opens on the side this device chose last
  (`livedesign:settings-scope:v1`). The host part is `settings-panel-host.tsx` (the app's id, its logos
  and the bearer request); the switch, the Account section and All's merged categories are the package's.

  Email rows are **absent, not disabled**, unless BOTH email is configured (the api's `EMAIL` binding)
  ([Transactional email](../014-identity/transactional-email.md)) and the reader is signed in - a guest has no address, so those
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
  empty space or elements, whatever tool is active; off leaves the middle
  button to the browser. The
  **Keyboard** group holds the **Keyboard Shortcuts** switch, which is
  per-device (localStorage, not `UserPreferences`) so shortcuts can be on at
  a full keyboard and off on a tablet. Below it, the shortcut
  catalogue renders as collapsible groups. The
  Notifications group holds `notificationsEnabled`, whose description
  notes that errors are always shown regardless. The
  Accessibility group holds `reduceMotion`, noting the OS setting is
  always respected and this only adds a user-forced override.

- **Per-tool surfaces**: none.

## Read / write helpers

Live in `apps/live/lib/user-preferences.ts`:

- `readUserPreferences(): UserPreferences` returns the current
  cached preferences, parsing the stored JSON and defaulting any
  missing key. Returns `{}` on parse failure (graceful). Sync,
  reads localStorage only, so the editor can use it during render.
- `writeUserPreferences(prefs, ownerId?): void` trims the blob to
  fit, serialises and writes it back to localStorage AND, when
  `ownerId` is supplied, queues a save (debounced, a patch of what
  changed, one at a time) so the value reaches the account. Also dispatches a
  `livedesign:preferences-changed` window event so same-tab
  listeners (notably `lib/telemetry.ts`) can refresh their cached
  gate without polling. Callers without an `ownerId` (unit tests,
  the editor before identity resolves) skip the network step and
  still get the localStorage write; the next call with an
  ownerId catches the server up.
- `fetchUserPreferences(ownerId): Promise<UserPreferences | null>`
  does a single `GET /api/preferences` for the resolved owner (once
  per page load: a second caller shares the first's answer),
  merges the server's value over the localStorage cache (server
  wins on conflict, unless this browser holds an unconfirmed save
  for the owner, when the cache wins and is sent again), writes the merged blob back to localStorage,
  and dispatches `livedesign:preferences-changed`. Returns the
  merged preferences, or null on failure or when the deployment
  keeps none (the caller can treat that as "stick with the
  cache"). Called by the Explorer and the editor as they mount.

- `rebaseUserPreferences(snapshot, next)` moves a change built on a
  render's snapshot onto the freshest cache, and
  `commitUserPreferences(snapshot, next, ownerId)` rebases, writes and
  returns it, for callers that also hold the preferences in state.

Cross-tab updates are picked up via the browser's native `storage`
event on the preferences key.

## API

- **`GET /api/preferences`**: returns `{ prefs: UserPreferences }`
  for the resolved owner: both scopes joined, `{}` when nothing is
  stored. Auth: the standard hybrid identity (an account's or a
  guest's Bearer token). 404 `preferences_not_stored` without liveworkspace
  accounts; 503 `preferences_unavailable` when the accounts Worker
  can't be reached.
- **`PUT /api/preferences`**: body `{ prefs: PreferencesPatch }`: the
  keys to change, each value whole, `null` to delete one, keys left out
  unchanged. The api splits it between the All scope and livedesign's
  own and makes one accounts write. Returns 204. Refused with 400 for a
  key that isn't a plain name (`[A-Za-z0-9_.-]`, up to 64) or a body
  past 8 KB; a refusal from the accounts Worker (a scope past its 16 KB) keeps
  its status. Values are otherwise opaque: the client owns their shape.
