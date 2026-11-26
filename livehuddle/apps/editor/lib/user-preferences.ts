export type MapSize = 'short' | 'medium' | 'tall';

// Per-user editor preference flags. See docs/specs/007-editor/user-preferences.md.
//
// Storage:
//   - liveworkspace keeps the authoritative copy (the api's /api/preferences), fetched
//     once per page load via fetchUserPreferences() so a person's flags follow them
//     across devices, and the shared ones (ALL_SETTING_KEYS) across apps. A deployment
//     without liveworkspace keeps none: the cache below is then the only copy.
//   - `localStorage` under `livehuddle:user-preferences:v1` is a warm
//     cache so the editor never blocks on the network at boot. Reads
//     are synchronous; writes go to BOTH localStorage and the api
//     (one PUT at a time, latest wins, lib/preferences-sync). Last-write-wins per device.
//
// Cross-tab consistency: callers can listen for the native `storage`
// event on STORAGE_KEY. Same-tab writes also fire a window event
// `livehuddle:preferences-changed` so listeners that can't observe
// their own `localStorage.setItem` (like `lib/telemetry.ts`'s
// in-memory gate cache) still refresh promptly. Every write stores the
// WHOLE blob in the cache, so a change is built on the cache, never on a
// render's snapshot (see rebaseUserPreferences): another tab's write since
// that render would otherwise be undone.

import type { ElementTourKind } from './element-tours';
import type { SwatchOverrideStore } from '@liveworkspace/workbench/lib/swatch-overrides';
import { USER_PREFERENCES_STORAGE_KEY } from '@livehuddle/telemetry-client';
import { preferencesStore } from './preferences-sync';

export type UserPreferences = {
  // (`autoRebindArrows`, the Auto-Attach Arrows switch, left livehuddle in Work Tracker #423 part 4: arrows
  // always reattach after a move, and a stored value stays in old browsers' storage, unread.)
  // When `false`, `track()` in lib/telemetry is a no-op (the user
  // opted out of analytics). Distinct from the build-time
  // NEXT_PUBLIC_TELEMETRY_ENABLED gate and the api worker's
  // TELEMETRY_ENABLED gate. Missing / undefined === on.
  telemetryEnabled?: boolean;
  // DEAD as of docs/specs/008-canvas/two-pens.md: shape recognition is now which pen you picked
  // (Freehand or Shape Pen), not a persisted mode. Nothing reads this any
  // more. It stays in the type because it is already stored for
  // existing users, and removing it would make a stored preference fail to
  // parse rather than simply be ignored.
  recogniseShapes?: boolean;
  // Map panel options (docs/specs/008-canvas/minimap.md). Both default ON / medium via `!== false`
  // and `?? 'medium'`, so an existing user's map is unchanged.
  //
  // `mapDimOutside` shades everything outside the current view. It reads as
  // "you are here" at a glance, but on a dense canvas some people want the
  // whole map bright, so it is a toggle rather than a rule.
  mapDimOutside?: boolean;
  // How tall the map is. A big canvas is unreadable in a 144px strip; a
  // small one doesn't need more.
  mapSize?: MapSize;
  // `collaboratePanelEnabled` is not read: the Collaborate Panel left livehuddle with comments and actions
  // (docs/specs/002-project-scope/not-in-livehuddle.md "Comments, actions, links and notes"). A stored value is kept,
  // unread, like any key this version does not know.
  // `quickStylePanelEnabled` is not read: livehuddle has no Quick Style panel
  // (docs/specs/002-project-scope/not-in-livehuddle.md#quick-style). A stored
  // value is kept, unread, like any key this version does not know.
  // Panel opacity (docs/specs/007-editor/user-preferences.md). The opacity (0..1) of EVERY panel at
  // rest (floating, popover, the Map, the Toolbar strip), so the
  // canvas shows through; they snap back to fully opaque while hovered /
  // focused. Applied via the `--lvd-panel-opacity` custom property (see
  // usePanelOpacity) on every `data-panel-translucent` surface. Buttons are
  // not panels: the cluster buttons stay opaque.
  // Missing / undefined / 1 === fully opaque, the default.
  panelOpacity?: number;
  // UI scale (docs/specs/007-editor/ui-scale.md). The factor (0.8..1.2 in 0.05
  // steps) the panels, the toolbar and the bottom-right corner buttons are
  // drawn at, via CSS `zoom` on each surface; nothing else scales. Desktop
  // only: a phone always draws at 1. `uiScale` is the master; each part's own
  // key overrides it for that part, and setting the master clears them. Read
  // through `resolveUiScales`, never directly. Missing === 1, the default.
  uiScale?: number;
  uiScalePanels?: number;
  uiScaleToolbar?: number;
  uiScaleCornerButtons?: number;
  // (`quickAddOnHover` left livehuddle with Quick Connect, docs/specs/002-project-scope/not-in-livehuddle.md: a
  // stored value stays, unread, like any key this version does not know.)
  // `elementIndicatorStyle` is not read either: the element indicators went with comments, actions, links and notes
  // (docs/specs/008-canvas/element-indicators.md). A stored value is kept, unread.
  // Alignment guides (docs/specs/008-canvas/canvas-and-palette.md). When `false`, the editor skips the
  // faint guide lines drawn along the edges / centres a dragged or
  // resized element shares with its neighbours (the snap itself is
  // unaffected; only the visual hint is suppressed). Missing /
  // undefined === guides on, the default.
  alignmentGuides?: boolean;
  // Rotate in 3D View (docs/specs/008-canvas/3d-view.md "Turning the camera"): when true the 3D view offers Turn Left
  // and Turn Right (and [ and ]). Missing / false === off, the default.
  rotateIn3D?: boolean;
  // Real 3D (docs/specs/008-canvas/3d-engine.md): when true the 3D view draws a real WebGL scene. Missing / false === off.
  real3D?: boolean;
  // Reduce motion (accessibility, docs/specs/007-editor/user-preferences.md). When `true`, the editor adds
  // `.reduce-motion` to <html> so the CSS in globals.css collapses every
  // decorative animation + transition to ~instant. Independent of the OS
  // `prefers-reduced-motion` media query (which is always honoured): this
  // lets a user force the calm UI even when their OS setting is off, and
  // syncs across their devices. Missing / undefined / false === full
  // motion (subject to the OS setting), the default.
  reduceMotion?: boolean;
  // Toast notifications (docs/specs/007-editor/user-preferences.md). When `false`, the editor suppresses
  // the confirmation / status toasts (success + info tones) it shows
  // for consequential, otherwise-silent actions (a document moved to a
  // folder, a tab linked, etc.). ERROR toasts are NOT gated by this:
  // a failure the user would otherwise never see still surfaces, so
  // turning notifications off quiets the chatter without hiding
  // breakage. Missing / undefined / true === notifications on, the
  // default. See hooks/useToast.tsx.
  notificationsEnabled?: boolean;
  // Middle-mouse pan. When `false`, holding the middle button no longer
  // drags the canvas in both axes (the browser's own middle-drag behaviour
  // takes over instead). Missing / undefined / true === on, the default —
  // it mirrors Figma, and the pan works from anywhere on the canvas
  // regardless of the active tool. Lives in the Controls group.
  middleMousePan?: boolean;
  // Minimap (docs/specs/008-canvas/minimap.md). When `false`, the bottom-left canvas minimap is hidden.
  // Missing / undefined / true === shown, the default (and even then only once
  // the tab has a few elements, and on desktop). The minimap's own close button writes an explicit `false`.
  showMinimap?: boolean;
  // Explorer Home's banner, the hero (docs/specs/013-workspace/explorer-home.md "Hiding the banner"). When `false`,
  // Home opens on its ordinary page header and the header's search field instead. Missing / undefined / true ===
  // shown, the default. The banner's own close button writes an explicit `false`; Settings turns it back on.
  homeBanner?: boolean;
  // Automatically Open Explorer (liveworkspace/docs/specs/004-index/one-explorer.md "Opening on the Explorer"), a
  // common setting. When `true`, the homepage, arrived at from outside the site while signed in, opens the Explorer.
  // Missing / undefined / false === off, the default. Mirrored into this address's `lw_open_explorer` cookie on every
  // write and every server read, for the router.
  autoOpenExplorer?: boolean;
  // Whether the bottom-right cluster names its buttons beside their icons on a wide desktop
  // (docs/specs/007-editor/editor-app.md "Named on a wide desktop"). Missing === on; a phone never
  // names them, whatever this says. Read through useDockNames.
  dockButtonNames?: boolean;
  // Suggest Other Apps (liveworkspace/docs/specs/016-notifications/suggestions.md): false quiets every suggestion.
  suggestNextApp?: boolean;
  // Your hearing ring in a call (docs/specs/012-collaboration/proximity-audio.md "Your hearing ring"): where people can
  // hear you while you talk. Missing / undefined / true === shown, the default; `false` hides it. The call is unchanged.
  hearingRing?: boolean;
  // Join and Leave Sounds (docs/specs/012-collaboration/join-and-leave-sounds.md): a chime when someone arrives in or
  // leaves the Space you have open. Missing / undefined / true === on, the default; `false` silences both.
  joinLeaveSounds?: boolean;
  // Desktop Notifications (docs/specs/012-collaboration/nudge.md "Desktop Notifications"): a system notification for
  // a nudge while the tab is hidden. Missing === on, but it only shows once the browser has granted permission.
  desktopNotifications?: boolean;
  // Whether the one-time offer to turn Desktop Notifications on has been answered (either way). Missing === not yet.
  desktopNotificationsOffered?: boolean;
  // Email notifications (docs/specs/014-identity/profile-and-email-notifications.md). Account-level settings flipped from the
  // Settings dialog; the api worker reads them server-side before
  // sending the matching transactional email (docs/specs/014-identity/transactional-email.md). Distinct from
  // `notificationsEnabled`, which is about in-editor toasts, not email.
  // Missing / undefined / true === notify (opt-out); an explicit false
  // suppresses that email.
  //
  // "Someone first opened one of my shared documents."
  notifyDocumentJoin?: boolean;
  // "Someone accepted / declined a team invite I sent" (to the team's admins).
  notifyInviteResponse?: boolean;
  notifyComments?: boolean;
  notifyTips?: boolean;
  notifyMilestones?: boolean;
  // "A teammate assigned me an action on an element in a document" (docs/specs/012-collaboration/assigned-actions.md).
  notifyActionAssigned?: boolean;
  // "A teammate @-mentioned me in a comment" (docs/specs/012-collaboration/comment-mentions.md).
  notifyMentions?: boolean;
  // livediagram's Diagram, Workshop and Draw tours' seen-guards (`tourSeen`, `workshopTourSeen`, `drawTourSeen`) are
  // not fields here: those tours are not in livehuddle, and a stored value stays in the blob unread, like any key this
  // version does not know (docs/specs/007-editor/user-preferences.md "Retired keys").
  // The Receptionist's welcome given (docs/specs/008-canvas/receptionist.md "The welcome"), under the retired Avatar tour's key so
  // nobody who took that tour is welcomed again. Surfaced in Settings as Tours › "Receptionist's Welcome" (inverted).
  // Missing / undefined === not welcomed.
  avatarTourSeen?: boolean;
  // The topics the Receptionist has answered for this person (docs/specs/008-canvas/receptionist.md "Asking the Receptionist"), by topic id,
  // each once, in the order heard: the ticks in his bubble.
  receptionistTopicsSeen?: string[];
  // Element tours (docs/specs/007-editor/element-tours.md): the toured element kinds whose tour has been taken,
  // a record for Settings (it never hides the Start Tour button). Surfaced in Settings as Tours › Show Me, one switch
  // per kind (inverted). Read through lib/element-tours.
  elementTourKinds?: ElementTourKind[];
  // Counts every element tour as answered (lib/tour-tracks.ts): Settings' Show Me on Every Element, switched off,
  // writes it, as the retired Power user mode's preset did.
  elementToursSeen?: boolean;
  // DEAD as of docs/specs/004-interface-design/colour-picker.md: Custom colours are the colours
  // picked with + in the document, kept with its tabs, not a per-user list. Nothing reads or writes this any
  // more; it stays in the type because it is already stored for existing users.
  customSwatches?: string[];
  // The quick style panel's custom swatches (docs/specs/008-canvas/quick-style-panel.md "Custom
  // swatches"): per theme, which of a row's six slots you replaced with a
  // colour of your own. Read and written through lib/swatch-overrides, which
  // validates it and keeps it inside its share of the 4 KB cap.
  quickSwatchOverrides?: SwatchOverrideStore;
  // livediagram's whiteboard dock settings (its pinned shapes, their pick counts, its colours, where it sat, its
  // pattern). livehuddle has no whiteboard since Work Tracker #329: nothing reads them, they stay in the type because
  // they are already stored, and the picks are the first thing trimmed when the blob is full (lib/preferences-sync).
  whiteboardPinnedShapes?: string[];
  whiteboardShapePicks?: Partial<Record<string, readonly [number, number]>>;
  whiteboardYourColours?: string[];
  whiteboardDockPosition?: 'top' | 'bottom';
  drawPattern?: 'blank' | 'grid' | 'graph';
  // livediagram's presenter settings (docs/specs/012-collaboration/presentation-mode.md), one shared setting.
  // livehuddle has no presenting since Work Tracker #423 part 2: it never reads or writes the key, only carries it.
  presentation?: Record<string, unknown>;
  // What a delete does with a picture nothing else uses (docs/specs/009-elements/images.md "Deleting an unused
  // picture"): a common setting, read through @liveworkspace/workbench/lib/unused-image-choice. Unset is Ask.
  unusedImageChoice?: 'ask' | 'delete' | 'keep';
};

// Re-exported under this module's own name because everything here reads it
// as "the preferences key". It's DEFINED in telemetry-client because the help
// centre reads the telemetry field out of this same blob and must never get
// the string wrong — see the note there.
export const STORAGE_KEY = USER_PREFERENCES_STORAGE_KEY;
export { PREFERENCES_CHANGED_EVENT } from './preferences-sync';

// The browser's copy, read synchronously so the first render has it; written whole, trimmed to fit, and sent when an
// owner is known; merged with the account's copy once per page load (liveworkspace/docs/specs/011-workbench/
// editor-preferences.md). All of it is the editors' one store, bound in lib/preferences-sync.
export function readUserPreferences(): UserPreferences {
  return preferencesStore.read();
}

export function writeUserPreferences(prefs: UserPreferences, ownerId?: string | null): void {
  preferencesStore.write(prefs, ownerId);
}

// A change built on a render's snapshot, moved onto the freshest copy, so a key another tab wrote since survives.
export function rebaseUserPreferences(
  snapshot: UserPreferences,
  next: UserPreferences,
): UserPreferences {
  return preferencesStore.rebase(snapshot, next);
}

export function commitUserPreferences(
  snapshot: UserPreferences,
  next: UserPreferences,
  ownerId?: string | null,
): UserPreferences {
  return preferencesStore.commit(snapshot, next, ownerId);
}

// The account's copy merged into the browser's, once per page load and owner; null when it could not be read or the
// deployment keeps none (the caller sticks with the browser's copy).
export function fetchUserPreferences(ownerId: string): Promise<UserPreferences | null> {
  return preferencesStore.fetch(ownerId);
}
