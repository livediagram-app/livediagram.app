# User preferences

Per-user editor preference flags that toggle behaviour without
changing project content. Most are exposed through a small
Settings dialog launched from the footer (the **Application settings**
gear button to the left
of the dark-mode toggle); a small number are per-tool toggles
that live next to the tool they affect (see the UI placement
section below) rather than in Settings. Either way the
persistence model is the same. Replaces the earlier
per-project-settings shape: preferences are about the user's
editor experience, not about any particular project, so they live
once per account / device and apply everywhere.

## Where preferences live

Preferences live in the **liveworkspace accounts database** as the
source of truth ([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md)
"Settings"), with `localStorage` as a fast warm cache so the editor
never blocks on a network round-trip at boot. liveplanner keeps no
table of its own for them.

- **Two scopes per owner.** The accounts database keeps a person's
  settings in an `all` scope, which every liveworkspace app reads, and
  one scope per app (liveplanner's is `liveplanner.app`). A key in
  `ALL_SETTING_KEYS` (`@liveworkspace/settings`: telemetry, reduced
  motion, the notification switches, panel opacity, UI scale, middle-
  mouse pan, dock button names, power user mode, minimal chrome,
  custom swatches, and the editor settings two or more apps have:
  the Home banner and the Collaborate panel) lives in `all`, so changing it here changes it in
  every app that has it; every other key is liveplanner's own. The api
  joins the two (`joinSettings`) on read and splits a patch
  (`splitSettings`) on write, so the editor only ever sees one flat set.
  The editor settings that became shared in October 2026 were this app's own
  before, so a value may still sit in this app's scope: `joinSettings` uses it
  until `all` has one, and the first change writes `all` and drops the old copy.
- **Owners.** An account's settings are kept under its user id; a
  guest's under the `guest_<uuid>` id its liveworkspace guest token
  names, so guests have them too. Each scope holds at most 16 KB, and a
  value is replaced whole.
- **localStorage cache** keyed `liveplanner:user-preferences:v1`
  (legacy key, unchanged). Read synchronously at page-load so the
  Settings dialog and gate caches (telemetry, draw-to-add, etc.)
  have a value to read before the network fetch returns.

### Sync flow

- **On editor open**: read the localStorage cache synchronously
  (zero-blocking), then fire-and-forget `GET /api/preferences`,
  once per page load per owner (every caller shares the one request,
  which is one call to the accounts Worker).
  When the server response arrives, merge it over the cache
  (server wins for any key present on both sides), persist back
  to localStorage, and dispatch the existing
  `liveplanner:preferences-changed` window event so in-process
  listeners refresh. If the fetch fails the cache value stays
  authoritative for the session.
- **On toggle**: update localStorage immediately (so the UI
  reflects the change without waiting for the network), then queue
  a save. The save waits 400 ms (`SAVE_DEBOUNCE_MS`) for the next
  one, so a dragged slider or a run of switches is one request, and
  goes early when the page is hidden or closed (`pagehide`, sent with
  `keepalive` so it outlives the page). It sends a **patch** to
  `PUT /api/preferences`: each key that differs from what the server
  last held, its value whole (a nested value such as
  `powerUserBaseline` is always sent complete), and `null` for a key
  that went. A key another app changed meanwhile is never sent back,
  so it is never undone.
- **Saving to the server** (`apps/editor/lib/preferences-sync.ts`):
  - **It fits.** The blob is trimmed to the api's cap (4,096
    characters of `{"prefs":...}`) before it is cached or sent:
    the key nothing reads any more (`customSwatches`) goes first; every other key stays whole, and none
    grows without bound (Hide from Recent is the index's,
    [Hide from Recent](../013-workspace/hide-from-recent.md)). A trim logs
    `[preferences] trimmed to fit dropped=<keys> length=<n>`.
  - **Only what changed, coalesced.** As above: one patch per
    400 ms of changes, measured against the server's last copy.
  - **One save at a time, the latest wins.** A save made while one
    is in flight waits, and replaces any save already waiting, so
    the server can never end on an older blob than the last one sent.
  - **A save that did not land keeps this device's copy.** From the
    moment a save is queued until one succeeds, this browser is
    marked unsynced for that owner
    (`liveplanner:user-preferences:unsynced`, holding the owner id).
    A refused or failed save (logged `[preferences] save-refused
status=<n>` or `save-not-confirmed`) leaves the mark, and the
    next load lets the cache win over the server's blob and sends it
    again, instead of the server reverting settings it never received.
- **A guest's Settings in the Explorer**: the Explorer on this app's
  address (`/explorer`, liveworkspace's, served through the router) gives a
  guest this app's settings too, and changes them in this same cache
  (`liveplanner:user-preferences:v1`, one key at a time over the freshest copy)
  rather than over the network. Each change also sets the unsynced mark
  for the guest's `guest_<uuid>`, so this editor's next load keeps the
  cache over the server's copy and sends it on, as for a save of its own
  that never landed ([liveworkspace/docs/specs/010-site/site.md](../../../../liveworkspace/docs/specs/010-site/site.md#settings)
  "A guest"). Renaming the key or the mark means changing
  `DEVICE_PREFERENCES` in `@liveworkspace/settings/device` with it; the
  settings-site-catalogue test fails until both agree.
- **Cross-tab updates**: the browser's native `storage` event on
  the preferences key still fires across tabs in the same
  browser, so toggling in one tab updates every open editor and
  Explorer: both follow the cache live rather than holding their
  own copy. Every change is built on the freshest cache, never on a render's snapshot
  (`rebaseUserPreferences`: only the keys the change touched are
  applied over the cache); built on a snapshot, it would undo a
  change another tab made since.

### Why server-side instead of localStorage-only

The original v1 shape was localStorage-only on the grounds that
flags were UI-only and a server round-trip per toggle was
overkill. That trade-off was wrong for the user experience:
signed-in users who use liveplanner on a laptop and a phone had
to re-flip every setting on each device. Per-account sync is the
expected behaviour for an account-bound app.

Guests get the same persistence model (the api keys them by
the `guest_<uuid>` id their guest token names), so server-side storage is
effectively a remote copy of localStorage for that device, but
with a cross-browser bonus: a guest who clears localStorage but
keeps the same browser session still recovers their preferences.

**Panel corner layout is the deliberate exception.** Which corner
each corner panel docks into ([Panel corner docking](panel-docking.md)) is a
per-device ergonomic choice (screen size, handedness, monitor), so it
lives in its own **device-local** `localStorage` store
(`liveplanner:panel-layout:v1`) and is **not** part of this synced
blob. Don't fold panel placement into `UserPreferences`.

### Sign-up migration

liveplanner runs none. When a guest signs in, the accounts Worker moves
their settings to the account, scope by scope, in the same hook that
moves their plans in the index ([Auth + guest access](../014-identity/auth-and-guest-access.md#guest--account),
[liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md) "Settings"). A key the
account already has keeps the account's value; the guest's other keys
fill the gaps, so a guest who signs up keeps the settings they'd already
chosen.

### Degradation without the api

When the api keeps no preferences (a deployment without liveworkspace
accounts, or an owner id the accounts database has no place for),
`GET /api/preferences` answers `{ prefs: null }` and `PUT` answers 404
`preferences_not_stored`. The editor then keeps preferences in this
browser only (`keepPreferencesLocally`) and sends nothing more for the
page's life: the localStorage cache is the only persistence, as in the
original v1 design. When the api worker itself is unreachable the fetch
fails and the cache stays authoritative. No required SaaS calls.

## Schema

```ts
type UserPreferences = {
  // When false, the live editor skips the auto-rebind that moves a
  // pinned arrow end to the side facing the other end once its drawn
  // path runs through a shape after a move (packages/project's
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
  // footer bar's and, on a wide desktop, the bottom-right cluster's (editor-app.md "Named on a wide
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
  // email configured, per capabilities.emailEnabled). The api worker reads
  // these server-side before sending the matching transactional email
  // (docs/specs/014-identity/transactional-email.md), so a missing key === undefined === notify (opt-out, not
  // opt-in). Distinct from `notificationsEnabled`, which gates in-editor
  // toasts, not email.
  //
  // When false, suppress the "someone first opened one of my shared
  // projects" email. Defaults to true (notify).
  notifyProjectJoin?: boolean;
  // When false, suppress the "someone accepted/declined a team invite I
  // sent" email (sent to the team's admins). Defaults to true (notify).
  notifyInviteResponse?: boolean;

  // The Plan tour's seen-guard (docs/specs/026-plan/plan-tour.md): true counts both tracks as seen while Power user
  // mode is on (lib/tour-tracks.ts); set with every track by Power user mode.
  planTourSeen?: boolean;
  // The Plan tour tracks (Boards, Sheets, Dashboards) taken (a run completed or skipped). It picks which track the footer's
  // Start Tour button names and feeds Settings' rows; it never hides the button. Settings' Boards Tour, Sheets Tour and
  // Dashboards Tour rows each add or remove their own track.
  planTourTracks?: PlanTourTrack[];
  // The Forms tour's record (docs/specs/030-forms/forms.md "The Forms tour"), written when a run ends; it feeds the
  // Settings row only. Show Me Around in the form's cog panel reruns it. Missing / undefined === not seen.
  formTourSeen?: boolean;
  // DEAD (../004-interface-design/colour-picker.md "Custom colours"): Custom colours are kept with the project's tabs, not per user.
  // Nothing reads or writes this; it stays because it is already stored.
  customSwatches?: string[];
  // The quick style panel's custom swatches (../008-canvas/quick-style-panel.md
  // "Custom swatches"): per theme, newest-edited first, which of a row's six
  // slots you replaced with your own colour. `t` is the theme id, `s` the
  // Stroke row and `f` the Background row, slot (1-6) to lower-case #rrggbb.
  // Short keys because the blob shares the 4,096-character cap; at most 8 themes and
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
  `apps/editor/lib/user-preferences.ts`, shared by the Settings
  dialog's row and the editor-preferences hook so the default
  can't drift between consumers.
- `telemetryEnabled` undefined → telemetry on (the default).
  Setting it to `false` is the only state that opts out.
- A stored key the type does not name is ignored: there is one panel layout ([Toolbar layout](toolbar-layout.md#one-layout)).
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
  docked or as a popover: it is where projects are read and managed,
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
- **No retired keys.** liveplanner's preferences have only ever been stored in their current names, so nothing
  upgrades, renames or drops a key on read.
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
- `notifyProjectJoin` / `notifyInviteResponse` undefined / true → the
  matching email notification is on (the default; [Account settings & email notifications](../014-identity/profile-and-email-notifications.md)). Setting
  either to `false` is the only state that suppresses its email. Read
  server-side by the api worker before sending; flipped from the
  Settings dialog. Emit `UI`/`Toggled`/`NotifyProjectJoin{On,Off}`
  and `NotifyInviteResponse{On,Off}` ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).
- `notificationsEnabled` undefined / true → notifications on (the
  default). Setting it to `false` suppresses the success + info toasts
  the editor shows for consequential, otherwise-silent actions (a
  project moved to a folder, duplicated, or deleted from a long list; a
  tab linked into another project). **Error and warning toasts are never
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

Empty (or missing entirely) localStorage entry, AND no settings
stored for this owner, is therefore the "everything on" state.

## UI placement

**Every preference lives in the Settings dialog**, and for almost all of them
that is the only control.

- The **Settings dialog** lists all of them, grouped and searchable by eye.
  It is the answer to "I half-remember a setting about layer previews" from
  someone who does not know which panel owns it, and the place a new reader
  goes to see what the editor can be told to do.
- **One setting, one control.** No panel carries a settings gear of its own:
  every preference has its row in the dialog, and a gear would be a second home
  for a setting that already has one. A handful of preferences DO keep a second,
  in-context control where that control is the thing itself rather than a
  settings menu: the Appearance cycle button in the footer, and each of those rows says
  **"Also in ..."** so the pair reads as deliberate.
- **"All apps".** A row whose key every liveworkspace app shares
  (`ALL_SETTING_KEYS`, UI Scale's part sliders and Presenting's options included) carries a quiet
  **All apps** line under its description, in the dialog's hint style, so
  a change turning up in another app is no surprise
  (`components/dialogs/settings/settings-all-apps.ts`). Where preferences
  stay in this browser the line is not shown.
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

- **Settings dialog**: `apps/editor/components/dialogs/SettingsDialog.tsx`,
  lazy-loaded via `next/dynamic` (matches the other on-demand
  modals: ShareDialog, ExportTabDialog). Trigger: a
  gear-icon button in the TabBar footer, sitting between Search and the
  dark-mode toggle (with the Start Tour button immediately left of it while a tour is on offer,
  [Editor tours](editor-tour.md) "Where it appears"). The "Keyboard Shortcuts" command in search
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
    `liveplanner:settings-view:v1` and never synced: where you were in a
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
  readout nested under it while the mode is on), **Appearance** (theme, then an **Interface** section:
  Button Labels, and UI scale with a slider per part nested under it), **Keyboard**
  (the Keyboard Shortcuts on/off switch, then the full shortcut catalogue as
  collapsible groups), **Panels** (panel opacity; with the
  sub-categories **Layers**, **Map**, **Collaborate** and
  **Quick Style**, one per panel),
  **Accessibility** (reduce motion, and a **UI Scale** link row that opens
  Appearance), **Tours** (one switch per guided tour, see **Tours** below),
  **Projects** (a **Default Folders** section with one row per
  [default folder](../013-workspace/default-folders.md) entry, with Change and Clear; those are not a
  preference, they are the index's (`/placement-defaults`, [Default folders](../013-workspace/default-folders.md))), and an **Explorer** section with **Show Home Banner**
  (`homeBanner`, missing means shown; [Explorer Home](../013-workspace/explorer-home.md))), **Account** (identity, Trash, delete account, see
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
  **Sign In** link to `/sign-in/` that returns to the current page. Preferences a panel might
  otherwise carry live here, and only here - see **UI placement** below.

  A category can hold **sub-categories** (`parent` on the sub-category's
  spec). **Editor** holds none today: every editor setting applies to every tab, and a
  category with no rows is never shown. **Account** holds **Notifications** and
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
  marker glyph; Notifications and
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

  **Grouped rows.** Each section of a category is **one card** (`SettingsGroup`),
  iOS grouped-list style: its rows are cells inside it, split by hairlines,
  rather than a card per row. A cell holds the **label** with a **short
  description** under it (one or two lines; the long paragraphs that used to
  sit as a footnote under each row's own card made the dialog impossible to
  skim) and the **control** beside them; a **Learn more** link and an
  **"Also in ..."** line close the description. Labels are **Title Case**.
  A row nested under a parent row (`parent`) renders inside the same card,
  indented and faintly tinted, beneath it. What every row of a section shares
  is said **once**, in a **section note** under its heading (`sectionNotes` on
  the category: Projects' Default Folders, the Tours' "offer again"), not
  repeated under each row. A row reused outside a group (a Plan panel's
  `SettingsRow`) draws the same cell inside a card of its own.

  Row kinds: `toggle`, `choice` (a segmented control, e.g.
  the theme and the minimap size), `slider` (panel opacity, UI scale, committing on
  release so one drag is not one PUT per pixel), `appearance` (the one row
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

  **Tours** is a category of its own: one switch per guided tour, **Plan Tours** (over **Boards Tour**,
  **Sheets Tour** and **Dashboards Tour**) and **Forms Tour**, each with a line saying where it runs and a
  **Learn more** to its article, under one **Offer Again** section note. Every tour is started from the footer's
  Start Tour button, which stays on offer whether a tour is taken or not ([Editor tours](editor-tour.md) "Where it
  appears"); the switches are the record of which have been taken. Switch one back on and close Settings to take it
  again straight away when it is on offer where you are; otherwise nothing starts, and the button is there once it
  is. The switches sit in their own category, not inside Accessibility: a tour is not an accessibility setting. Every switch is inverted: on means "not taken yet", the preference records
  "already seen", and its telemetry tokens still describe the PREFERENCE (switching on is `...SeenOff`), so each
  dashboard series keeps its meaning.

  The Plan tour is a tour of several tracks (`apps/editor/lib/tour-tracks.ts`): **Plan Tours** is one switch over all
  of them (`tourTracksSwitch`, key `planTourSeen`: on while any track is owed, off answers every track, on forgets
  every answer), and each track has its own row nested beneath it (`parent: 'planTourSeen'`), named for itself:
  **Boards Tour**, **Sheets Tour** and **Dashboards Tour** (`tourTrackSwitch`, keys `planTourSeen-boards`,
  `planTourSeen-sheets`, `planTourSeen-dashboards`). A track's row is on while its track is owed; off adds its track
  to `planTourTracks`, on removes it alone, and both clear the single `planTourSeen`, folding it into the list first
  so one track back on leaves the others answered. It needs no handoff flag (the Plan tour is on the button once a
  board or Sheet is open, the Dashboards tour on a dashboard), so closing the dialog only reruns it, when a track
  became owed while it was open and the tour is on offer ([Plan tour](../026-plan/plan-tour.md)). **Forms Tour** works the same way against
  `formTourSeen` ([Forms](../030-forms/forms.md) "The Forms tour"). Power user mode's readout lists the Plan tour's
  switch over all its tracks (**Plan Tours**). The Plan tour's old single flag (`planTourSeen`) counts every track
  only while Power user mode is on.

  There is no Diagram Tour, Avatar tour or element-tour row ([Editor tours](editor-tour.md),
  [Element tours](element-tours.md)); `tourSeen`, `elementToursSeen` and `elementTourKinds` are not preferences, and
  a stored value is ignored.

  **Button Labels** (Appearance › Interface, `dockButtonNames`, on by default)
  names the editor's bottom buttons beside their icons: the footer bar's Search,
  Start Tour, Settings and theme, and the bottom-right cluster's (Layers, Style, Tidy Up and
  the rest) on a desktop wide enough for them ([Editor app](editor-app.md)). Off,
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
  standard kinds through the package's `bindRow` (`packages/settings-ui/src/bind.ts`), which tracks each change before writing it,
  and its own rows as `custom` rows), its icons and illustrations, and the rows only it has
  (appearance, shortcuts, tokens and pairings, identity, delete account, trash, default folders).
  liveworkspace.app renders the same view over this app's derived catalogue
  ([liveworkspace/docs/specs/010-site/site.md](../../../../liveworkspace/docs/specs/010-site/site.md) "Settings"), so the app's
  settings look the same there as here.

  **This app or All.** The dialog is the package's `SettingsPanel`, the one Settings panel every app
  and liveworkspace.app open. Its header carries a switch like the Explorer's filter: **liveplanner**
  (this app's logo and name) and **All** (liveworkspace's logo). liveplanner shows, signed in, the **Account** section and the **Common** settings this app has, then this app's
  own Settings (as above, less what those two hold): they shape this app as much as its own. Its own rows draw
  at once and the rest join them when read; a guest sees this app's own Settings alone, asking the network
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
  same door (`/api/workspace/account/profile`, `requestProfileHost` in `packages/settings-ui/src/profile/profile-host.ts`). A saved name or colour is the
  editor's own at once: its cursor, name tag and presence avatar in the room follow it without a
  reload (`announceProfileSaved` / `onProfileSaved`), and opening the editor again never overwrites
  a stored name with the account name. Sign-in Methods and devices link to liveworkspace.app, whose
  session holds them. Nothing of All is fetched
  until All is first chosen: its code and the three other apps' catalogues are their own chunks, one
  read per other app, kept for the page's lifetime. All is offered only to a signed-in account
  outside a workbench (a guest's settings stay in this browser); a targeted open (a search result,
  `?settings=`) lands on liveplanner; otherwise the dialog opens on the side this device chose last
  (`liveplanner:settings-scope:v1`). The host part is `settings-panel-host.tsx` (the app's id, its logos
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

  The **Editor** group holds only Power User Mode and its children. The
  canvas-era rows (`alignmentGuides`, `autoRebindArrows`, `elementIndicatorStyle`,
  `quickAddOnHover`, `middleMousePan`) and the Layers, Map and Quick Style panels
  are not offered in Settings, and there is no AI assistant; their stored fields
  stay in the type because the canvas host reads them. The
  **Keyboard** group holds the **Keyboard Shortcuts** switch, which is
  per-device (localStorage, not `UserPreferences`) so shortcuts can be on at
  a full keyboard and off on a tablet. Below it, the shortcut
  catalogue renders as collapsible groups. The
  Notifications group holds `notificationsEnabled`, whose description
  notes that errors are always shown regardless. The
  Accessibility group holds `reduceMotion`, noting the OS setting is
  always respected and this only adds a user-forced override.

- **Per-tool surfaces**: none. No preference is set from a tool's own chrome.

## Read / write helpers

Live in `apps/editor/lib/user-preferences.ts`:

- `readUserPreferences(): UserPreferences` returns the current
  cached preferences, parsing the stored JSON and defaulting any
  missing key. Returns `{}` on parse failure (graceful). Sync,
  reads localStorage only, so the editor can use it during render.
- `writeUserPreferences(prefs, ownerId?): void` trims the blob to
  fit, serialises and writes it back to localStorage AND, when
  `ownerId` is supplied, queues a debounced patch to
  `PUT /api/preferences` (one at a time, latest wins) so the value
  reaches the accounts database. Also dispatches a
  `liveplanner:preferences-changed` window event so same-tab
  listeners (notably `lib/telemetry.ts`) can refresh their cached
  gate without polling. Callers without an `ownerId` (unit tests,
  the editor before identity resolves) skip the network step and
  still get the localStorage write; the next call with an
  ownerId catches the server up.
- `fetchUserPreferences(ownerId): Promise<UserPreferences | null>`
  does a single `GET /api/preferences` for the resolved owner (shared
  by every caller for the page's life; a failed read may be retried),
  merges the server's value over the localStorage cache (server
  wins on conflict, unless this browser holds an unconfirmed save
  for the owner, when the cache wins and is sent again), writes the merged blob back to localStorage,
  and dispatches `liveplanner:preferences-changed`. Returns the
  merged preferences (the cache alone when the server keeps none),
  or null on failure / when the api worker is unreachable (the caller can treat that as "stick with the
  cache"). Called once at editor mount.

- `rebaseUserPreferences(snapshot, next)` moves a change built on a
  render's snapshot onto the freshest cache, and
  `commitUserPreferences(snapshot, next, ownerId)` rebases, writes and
  returns it, for callers that also hold the preferences in state.

Cross-tab updates are picked up via the browser's native `storage`
event on the preferences key.

## API

- **`GET /api/preferences`**: returns `{ prefs: UserPreferences }`
  for the resolved owner: the `all` and `liveplanner.app` scopes
  joined, in one call to the accounts Worker. Empty object when
  nothing is stored; `{ prefs: null }` when the api keeps no
  preferences (see Degradation without the api); 503
  `preferences_unavailable` when the accounts Worker cannot be
  reached. Auth: the standard identity (an account or guest Bearer).
- **`PUT /api/preferences`**: body `{ prefs: <patch> }`: each key
  named takes its value whole, a key set to `null` is deleted, keys
  not named stay. The api splits it into the two scopes and writes
  them in one call. Returns 204; 400 for a body that is not an object
  or is over 16 KB; 404 `preferences_not_stored` where nothing is kept
  server-side; the accounts Worker's own 400 / 413 refusals passed on;
  503 when it cannot be reached. Values are opaque to the api worker:
  the client is responsible for the shape, and a malformed client just
  reflects malformed prefs back to itself.
