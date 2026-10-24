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

Preferences are kept by the **liveworkspace accounts Worker**
(liveworkspace/docs/accounts.md "Settings"), the same store every
liveworkspace app uses, with `localStorage` as a fast warm cache so the
editor never blocks on a network round-trip at boot. livediagram keeps no
table of its own for them.

- **Two scopes.** The accounts Worker holds each person's settings in
  two scopes: `all`, the keys every app shares (`ALL_SETTING_KEYS` in
  `@liveworkspace/settings`: privacy and accessibility, the
  notification switches, the editors' chrome, custom swatches), and
  livediagram's own, `livediagram.app`. The api joins them into the one
  flat blob the editor knows (`joinSettings`) and splits a change back
  (`splitSettings`), in `apps/api/src/liveworkspace/settings.ts`. A shared
  key changed here changes in every app, and Settings marks those rows
  with a quiet "All apps" note.
- **Owners.** An account's settings are kept under its account id. A
  guest's are kept under `guest_<their guest id>`, so a guest who
  clears localStorage but keeps the same guest id still recovers them.
- **localStorage cache** keyed `livediagram:user-preferences:v1`
  (legacy key, unchanged). Read synchronously at page-load so the
  Settings dialog and gate caches (telemetry, draw-to-add, etc.)
  have a value to read before the network fetch returns.

### Sync flow

- **On page load**: read the localStorage cache synchronously
  (zero-blocking), then fire-and-forget `GET /api/preferences`, once per
  page load however many surfaces ask (the Explorer, then the editor it
  opens, read the cache the first fetch merged): one accounts read per
  load. When the server response arrives, merge it over the cache
  (server wins for any key present on both sides), persist back
  to localStorage, and dispatch the existing
  `livediagram:preferences-changed` window event so in-process
  listeners refresh. If the fetch fails the cache value stays
  authoritative for the session, and the next load asks again.
- **On toggle**: update localStorage immediately (so the UI
  reflects the change without waiting for the network), then
  `PUT /api/preferences` with what changed, in the background.
- **Saving to the server** (`apps/editor/lib/preferences-sync.ts`):
  - **Only what changed.** A save sends the keys that differ from what
    the server last confirmed (its answer on load, then each save that
    landed), each key's value whole (a nested value such as the shape
    picks is replaced, not merged), and `null` for a key that was
    removed. A setting changed in another app, or another tab, since
    this one loaded is therefore never put back. Before the server's
    copy is known (the load's fetch failed), the whole blob goes, and
    nothing is deleted.
  - **It fits.** The blob is trimmed to 4,096 characters of
    `{"prefs":...}` before it is cached or sent:
    the oldest hidden-from-Recent ids go first
    ([Hide from Recent](../013-workspace/hide-from-recent.md)), then the
    least recently used shape picks
    ([Draw mode, Shape slots](../023-draw-mode/draw-mode.md)); every
    other key stays whole. A full account measured 4,967 characters.
    A trim logs `[preferences] trimmed to fit dropped=<n> length=<n>`.
    The api takes a patch of up to 8,192 characters (a blob plus a
    null for each key dropped), and the accounts Worker holds each scope
    to 16 KB.
  - **One save at a time, the latest wins.** A save made while one
    is in flight waits, and replaces any save already waiting, so
    a burst of changes (a slider dragged) costs one request in flight
    and one after it, never one per change.
  - **A save that did not land keeps this device's copy.** From the
    moment a save is queued until one succeeds, this browser is
    marked unsynced for that owner
    (`livediagram:user-preferences:unsynced`, holding the owner id).
    A refused or failed save (logged `[preferences] save-refused
status=<n>` or `save-not-confirmed`) leaves the mark, and the
    next load lets the cache win over the server's blob and sends
    what differs again, instead of the server reverting settings it
    never received.
- **Cross-tab updates**: the browser's native `storage` event on
  the preferences key still fires across tabs in the same
  browser, so toggling in one tab updates every open editor and
  Explorer: both follow the cache live rather than holding their
  own copy. The cache holds the WHOLE blob, so a change is
  always built on the freshest cache, never on a render's snapshot
  (`rebaseUserPreferences`: only the keys the change touched are
  applied over the cache); built on a snapshot, it would undo a
  change another tab made since.

### Why on the server instead of localStorage-only

The original v1 shape was localStorage-only on the grounds that
flags were UI-only and a server round-trip per toggle was
overkill. That trade-off was wrong for the user experience:
signed-in users who use livediagram on a laptop and a phone had
to re-flip every setting on each device. Per-account sync is the
expected behaviour for an account-bound app, and with the shared
scope the chrome, accessibility and notification choices follow the
person into every liveworkspace app.

**Panel corner layout is the deliberate exception.** Which corner
each corner panel docks into ([Panel corner docking](panel-docking.md)) is a
per-device ergonomic choice (screen size, handedness, monitor), so it
lives in its own **device-local** `localStorage` store
(`livediagram:panel-layout:v1`) and is **not** part of this synced
blob. Don't fold panel placement into `UserPreferences`.

### Sign-up merge

The guest-to-account merge ([Auth + guest access](../014-identity/auth-and-guest-access.md)) carries a guest's
preferences along with their documents: the liveworkspace accounts site keeps
preferences, and it merges them as it signs the guest in, so a guest who signs
up keeps the settings they'd already chosen: each key the account has no
value for takes the guest's, and the account's own values stay. Idempotent: a
second merge finds nothing left to move.

<!-- legacy-names -->

### Renamed keys

- **Renamed key.** `notifyDiagramJoin` became `notifyDocumentJoin` when the container became a
  document. `upgradeLegacyPreferences`
  (`packages/api-schema/src/legacy-preferences.ts`) renames it wherever an older copy can still
  arrive: the browser's cache on read, the server's copy before the merge, and the api's
  notification check. An opt-out is never lost; when both keys exist, the new one wins.

<!-- /legacy-names -->

### Self-host degradation

Without the accounts Worker (a guest-only self-host, no `ACCOUNTS_URL`)
there is nowhere to keep them: `GET /api/preferences` answers
`{ prefs: null }`, and the editor keeps them in localStorage alone and
sends no saves (a `PUT` there answers 409 `preferences_local_only`, which
stops sending too). That is the original v1 behaviour, so self-hosting
needs no SaaS for it. When the api worker itself is unreachable the
fetch fails and the cache stays authoritative, as above.

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
  // email configured — capabilities.emailEnabled). The api worker reads
  // these server-side before sending the matching transactional email
  // (docs/specs/014-identity/transactional-email.md), so a missing key === undefined === notify (opt-out, not
  // opt-in). Distinct from `notificationsEnabled`, which gates in-editor
  // toasts, not email.
  //
  // When false, suppress the "someone first opened one of my shared
  // documents" email. Defaults to true (notify).
  notifyDocumentJoin?: boolean;
  // When false, suppress the "someone accepted/declined a team invite I
  // sent" email (sent to the team's admins). Defaults to true (notify).
  notifyInviteResponse?: boolean;

  // The Diagram tour's seen-guard (docs/specs/007-editor/editor-tour.md; named for the welcome tour it
  // was until October 2026, so earlier answers still hold). True once the
  // tour's welcome offer has been answered (taken, skipped, or declined),
  // so the offer never re-appears for this user on any device. Surfaced
  // in Settings as Tours › "Diagram Tour" (inverted); turning it on and closing
  // Settings replays the tour. Missing / undefined === not seen.
  tourSeen?: boolean;
  // The Workshop tour's seen-guard (docs/specs/012-collaboration/workshop-tour.md), as `tourSeen`.
  // Surfaced in Settings as Tours › "Workshop Tour" (inverted). Missing / undefined === not seen.
  workshopTourSeen?: boolean;
  // The Draw tour's seen-guard (docs/specs/023-draw-mode/draw-tour.md), as `workshopTourSeen`.
  // Surfaced in Settings as Tours › "Draw Tour" (inverted). Missing / undefined === not seen.
  drawTourSeen?: boolean;
  // The Avatar tour's seen-guard (docs/specs/008-canvas/avatar-tour.md), as `drawTourSeen`.
  // Surfaced in Settings as Tours › "Avatar Tour" (inverted). Missing / undefined === not seen.
  avatarTourSeen?: boolean;
  // Element tours (docs/specs/007-editor/element-tours.md): the toured element kinds whose offer has been answered
  // (Play or Cancel). Surfaced in Settings as Tours › Show Me, one switch per kind (inverted).
  elementTourKinds?: ElementTourKind[];
  // Counts every element tour as answered while Power user mode is on; written by its preset.
  elementToursSeen?: boolean;
  // The presenter settings (docs/specs/012-collaboration/presentation-mode.md "Presenter settings"), as one object,
  // read through lib/presentation-config. Surfaced in Settings as Editor › Presenting. Missing === what this
  // browser kept before they followed the account, else the defaults.
  presentation?: Record<string, unknown>;
  // DEAD (../004-interface-design/colour-picker.md "Custom colours"): Custom colours are kept with the document's tabs, not per user.
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
  // The whiteboard dock (../023-draw-mode/draw-mode.md "Shape slots"): up to
  // seven pinned shape keys (unset is the default pins, an empty list an
  // emptied side), and per shape key [times picked, last picked ms] for the
  // Shapes flyout's slots, at most 20 kept. Keys outside the whiteboard's
  // shape catalogue are dropped on read (lib/whiteboard-dock-prefs).
  whiteboardPinnedShapes?: string[];
  whiteboardShapePicks?: Record<string, [number, number]>;
  // DEAD, like `customSwatches`: the markers' Custom colours are the document's
  // (../004-interface-design/colour-picker.md). Kept because it is already stored.
  whiteboardYourColours?: string[];
  // Where a whiteboard's dock sits (../023-draw-mode/draw-mode.md "Where the
  // dock sits"): 'top' or 'bottom'. Unset, or anything but 'bottom', is the
  // top (lib/whiteboard-dock-prefs).
  whiteboardDockPosition?: 'top' | 'bottom';
  // How an element shows its link, note, action and comments
  // (../008-canvas/element-indicators.md): glyphs inside its top-right corner
  // ('top'), a row along its bottom edge ('footer') or none ('off'). Unset, or anything
  // else, is Top (lib/element-indicator-style).
  elementIndicatorStyle?: 'top' | 'footer' | 'off';
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
  `apps/editor/lib/user-preferences.ts`, shared by the Settings
  dialog's row and the editor-preferences hook so the default
  can't drift between consumers.
- `telemetryEnabled` undefined → telemetry on (the default).
  Setting it to `false` is the only state that opts out.
- `recogniseShapes` is ignored whatever its value ([Two pens instead of a pen and a mode](../008-canvas/two-pens.md)): the
  Shape Pen recognises, Freehand does not, and no stored flag
  changes either.
- `panelLayout` and `minimalPanels`, which older blobs still carry, are
  ignored: there is one panel layout ([Toolbar layout](toolbar-layout.md#one-layout)).
- `whiteboardDockPosition` undefined → a whiteboard's dock at the top (the
  default). Only `'bottom'` moves it to the bottom.
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
- `drawPattern` undefined → Grid (`graph`) behind every tab the person works
  on in Draw mode. The dock's Background row writes it; it emits the same
  Background events as before and changes nothing on the tab.
- `alignmentGuides` undefined → guides on (the default). Setting it
  to `false` hides the faint guide lines during a move / resize; the
  snap behaviour itself is unchanged.
- `panelOpacity` undefined / 1 → every panel fully opaque (the
  default). A value below 1 makes every panel translucent at rest
  (snapping back to opaque on hover / focus) via the
  `--lvd-panel-opacity` custom property, on every surface: docked,
  popover (the cluster popovers), the Map, Quick style and the Toolbar
  strip. Buttons stay opaque. The **Explorer** is always fully opaque,
  docked or as a popover: it is where documents are read and managed,
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
- **Retired keys.** `activityPanelEnabled` and the Activity panel's revert
  hover preview went with the Activity panel (removed 2026-10-03). A value
  still stored under either is ignored on read and dropped on the next
  write; Undo and Redo always show in the bottom-right cluster.
  `illustrateModeEnabled` (and its older name `infographicModeEnabled`) and
  `planModeEnabled` went with the Settings › Experimental category (removed
  2026-10-06, [Editor modes](editor-modes.md#every-mode-always-offered)):
  every mode is always offered, and a stored `false` is dropped the same way.
  Pages mode's own preferences (`pagesTourSeen`, `pagesTourKinds`, `contentsPlacement` and the logo guide
  switches) went with Pages mode
  ([Editor modes](editor-modes.md#pages-moved-to-livedocuments)): a value still stored under one is ignored.
  `skipLocationStep` ("Always save new documents in <place> and skip this step") went with the New
  Document wizard's Location step ([New document route](new-document-route.md#one-step-wizard)): the wizard
  never asks where a document goes, so a stored place is dropped the same way and new documents follow the
  [default folders](../013-workspace/default-folders.md).
  `aiAssistanceEnabled` and `aiSuggestedPrompts` went with the in-editor AI assistant (removed 2026-10-23;
  connected AI tools work through the [MCP server](../015-api/mcp-server.md)): a value still stored under
  either is ignored.
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
  tab linked into another document). **Error and warning toasts are never
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

Empty (or missing entirely) localStorage entry, AND no settings kept
for this owner, is therefore the "everything on" state.

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

- **Settings dialog**: `apps/editor/components/dialogs/SettingsDialog.tsx`,
  lazy-loaded via `next/dynamic` (matches the other on-demand
  modals: ShareDialog, ExportTabDialog, ImagePicker). Trigger: a
  gear-icon button in the TabBar footer, sitting between Search and the
  dark-mode toggle. The "Keyboard Shortcuts" command in search
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
  **Editor** (a **Canvas** section: alignment guides, auto-attach arrows,
  element indicators; a **Mouse** section: quick-add on hover, middle-mouse
  pan; then **Power User**: power user mode, with Minimal chrome and the preset
  readout nested under it while the mode is on; with the sub-categories
  **Draw** (dock position, Top or Bottom) and **Presenting** (the presenter settings: Slides, Playback and While Presenting,
  [Presentation mode](../012-collaboration/presentation-mode.md) "Presenter settings")), **Appearance** (theme, then an **Interface** section:
  Button Labels, and UI scale with a slider per part nested under it), **Keyboard**
  (the Keyboard Shortcuts on/off switch, then the full shortcut catalogue as
  collapsible groups), **Panels** (panel opacity; with the
  sub-categories **Layers**, **Map**, **Collaborate** and
  **Quick Style**, one per panel),
  **Accessibility** (reduce motion, and a **UI Scale** link row that opens
  Appearance), **Tours** (one switch per guided tour, see **Tours** below),
  **Documents** (a **Default Folders** section with one row per
  [default folder](../013-workspace/default-folders.md#surfaces) entry, with Change and Clear; those are not a
  preference, they read and write the index's `/placement-defaults`), and an **Explorer** section with **Show Home Banner**
  (`homeBanner`, missing means shown; [Explorer Home](../013-workspace/explorer-home.md))), **Account** (identity, Trash, **Cloud Sync** (the cloud providers the
  deployment offers, [Google Drive mirror](../022-drive-mirror/drive-mirror.md)), delete account, see
  [Account settings & email notifications](../014-identity/profile-and-email-notifications.md); with the
  sub-categories **Notifications** (in-editor, plus the seven email preferences) and **API Tokens** (create, view and
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
  deployment without sign-in (`signInEnabled` false) there is nowhere to sign
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
  the category: Documents' Default Folders, the Tours' "offer again"), not
  repeated under each row.

  Row kinds: `toggle`, `choice` (a segmented control, e.g.
  the theme and the minimap size), `slider` (panel opacity, UI scale, committing on
  release so one drag is not one PUT per pixel), `toggleGroup` (several
  switches as one row of chips, see **Toggle groups** below), `appearance` (the one row
  backed by the device-local store, not `UserPreferences`), and `tokens` (the
  API token manager).
  A toggle row's control is one `role="switch"` button, named by the label
  (`aria-labelledby`) and described by the description; its `::after`
  stretches over the whole cell so a click anywhere on the row flips it, while
  the help link and the illustration sit above that layer and keep their own
  clicks. The `ToggleSwitch` inside is wrapped `aria-hidden`, because
  `presentational` still exposes `role="switch"` and would otherwise offer a
  screen reader two nested switches of the same name.

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

  **Tours** is a category of its own: one switch per guided tour, **Diagram
  Tour**, **Workshop Tour**, **Draw Tour** and **Avatar Tour**, each with a line saying where it offers itself and a **Learn more**
  to its article, under one **Offer Again** section note: each tour offers
  itself once; switch one back on and close Settings to take it again, straight
  away if you are in its mode, otherwise the next time you are. (The tours used
  to be an Onboarding Tutorials grid of five switches inside
  Accessibility, where nobody looked for them: a tour is not an accessibility
  setting.) Every switch is inverted: on means "offer me this tour", the
  preference records "already seen", and its telemetry tokens still describe the
  PREFERENCE (switching on is `...SeenOff`), so each dashboard series keeps its
  meaning.

  **Diagram Tour** (the [Diagram tour](editor-tour.md), labelled **Welcome** until October 2026) is inverted
  against the stored `tourSeen`. Because `tourSeen !== true` is necessary but NOT sufficient for the offer
  (TourHost also needs the per-tab pending flag, which only `/new` sets), closing the dialog with the switch
  on **marks that flag**, so its promise is true for a reader who had simply never taken the tour. Turning it
  on from off additionally relaunches in place on a Diagram tab; on a tab in another mode the offer waits
  for a Diagram tab. **Workshop Tour** is inverted against
  `workshopTourSeen` ([Workshop tour](../012-collaboration/workshop-tour.md)), **Draw Tour** against
  `drawTourSeen` ([Draw tour](../023-draw-mode/draw-tour.md)) and **Avatar Tour** against `avatarTourSeen`
  ([Avatar tour](../008-canvas/avatar-tour.md)); none needs a handoff flag, so closing the dialog with one turned on
  only reruns it when you are in its mode.

  Below the mode tours, **Show Me** (element tours, named Show Me in the interface) is its own section, a closed
  accordion naming how many are on ([Element tours](element-tours.md#settings)): **Show Me on Every Element**, built
  as a tour of several tracks (`tourTracksSwitch`, `apps/editor/lib/tour-tracks.ts`: on while any track is owed, off
  answers every track, on forgets every answer) against `elementToursSeen` and `elementTourKinds`, with one switch per toured
  kind nested under it, named for the element (**Sankey Diagram**). Element tours
  need no relaunch: the offer shows the next time such an element is selected. A category may mark any section
  closed this way (`collapsedSections`); Settings opened on one of its rows opens it.

  **Toggle groups.** Several related switches that share one description are
  one `toggleGroup` row: the label and description over a row of **chips**, one
  per switch, ticked and tinted while on, each its own preference with its own
  telemetry. Chips rather than a grid of switches, so short names fit without
  truncating. None is in use today: the one there was, Pages mode's logo guides,
  went with Pages mode.

  **Button Labels** (Appearance › Interface, `dockButtonNames`, on by default)
  names the editor's bottom buttons beside their icons: the footer bar's Search,
  Settings and theme, and the bottom-right cluster's (Layers, Style, Tidy Up and
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
  standard kinds through the package's `bindStandardRow`, which tracks each change before writing it,
  and its own rows as `custom` rows), its icons and illustrations, and the rows only it has
  (appearance, shortcuts, tokens and pairings, identity, delete account, trash, default folders, Cloud Sync).
  liveworkspace.app's "Your apps" dialog renders the same view over this app's derived catalogue
  ([liveworkspace/docs/site.md](../../../../liveworkspace/docs/site.md)), so the app's settings look
  the same there as here.

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
  always respected and this only adds a user-forced override.

- **Per-tool surfaces**: none today. The pencil's ModeBanner used to
  carry a `recogniseShapes` toggle; [Two pens instead of a pen and a mode](../008-canvas/two-pens.md) replaced it with two
  palette tiles, so no preference is set from a tool's own chrome any
  more. The Highlighter's Colour and Width ([Highlighter](../008-canvas/highlighter.md)) are set from
  the Quick style panel while its tile is armed, and are session-local editor state setting the next
  stroke rather than a persisted preference.

## Read / write helpers

Live in `apps/editor/lib/user-preferences.ts`:

- `readUserPreferences(): UserPreferences` returns the current
  cached preferences, parsing the stored JSON and defaulting any
  missing key. Returns `{}` on parse failure (graceful). Sync,
  reads localStorage only, so the editor can use it during render.
- `writeUserPreferences(prefs, ownerId?): void` trims the blob to
  fit, serialises and writes it back to localStorage AND, when
  `ownerId` is supplied, queues a `PUT /api/preferences` of what
  changed (one at a time, latest wins) so the value reaches the
  server. Also dispatches a
  `livediagram:preferences-changed` window event so same-tab
  listeners (notably `lib/telemetry.ts`) can refresh their cached
  gate without polling. Callers without an `ownerId` (unit tests,
  the editor before identity resolves) skip the network step and
  still get the localStorage write; the next call with an
  ownerId catches the server up.
- `fetchUserPreferences(ownerId): Promise<UserPreferences | null>`
  does a single `GET /api/preferences` for the resolved owner,
  merges the server's value over the localStorage cache (server
  wins on conflict, unless this browser holds an unconfirmed save
  for the owner, when the cache wins and is sent again), writes the merged blob back to localStorage,
  and dispatches `livediagram:preferences-changed`. Returns the
  merged preferences, or null on failure, when the api worker
  is unreachable, or when the deployment keeps none (the caller can
  treat that as "stick with the cache"). A second call in the same
  page load answers the cache without asking again.

- `rebaseUserPreferences(snapshot, next)` moves a change built on a
  render's snapshot onto the freshest cache, and
  `commitUserPreferences(snapshot, next, ownerId)` rebases, writes and
  returns it, for callers that also hold the preferences in state.

Cross-tab updates are picked up via the browser's native `storage`
event on the preferences key.

## API

- **`GET /api/preferences`** — returns `{ prefs }` for the resolved owner: the
  two scopes joined into one flat set, `{}` when nothing is kept yet, or
  `{ prefs: null }` where the deployment keeps none (no accounts Worker, or
  an owner id it can't hold). 503 `preferences_unavailable` when the
  accounts Worker can't be reached. Auth: the standard hybrid identity
  (an account's or a guest's Bearer).
- **`PUT /api/preferences`** — body `{ prefs }`, a patch: each key it names
  takes its new value whole, `null` deletes the key, and keys it leaves out
  stay. Shared keys go to the `all` scope, the rest to `livediagram.app`.
  Returns 204; 409 `preferences_local_only` where nothing is kept; 400 for a
  body that is not an object or is past 8,192 characters; the accounts
  Worker's refusal passed on (413 past its 16 KB a scope). The values are
  opaque to the api worker: the client is responsible for the shape, and
  a malformed client just reflects malformed prefs back to itself.
