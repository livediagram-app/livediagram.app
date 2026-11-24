export type MapSize = 'short' | 'medium' | 'tall';

// Per-user editor preference flags. See docs/specs/007-editor/user-preferences.md.
//
// Storage:
//   - liveworkspace keeps the authoritative copy (the api's /api/preferences), fetched
//     once per page load via fetchUserPreferences() so a person's flags follow them
//     across devices, and the shared ones (ALL_SETTING_KEYS) across apps. A deployment
//     without liveworkspace keeps none: the cache below is then the only copy.
//   - `localStorage` under `livediagram:user-preferences:v1` is a warm
//     cache so the editor never blocks on the network at boot. Reads
//     are synchronous; writes go to BOTH localStorage and the api
//     (one PUT at a time, latest wins, lib/preferences-sync). Last-write-wins per device.
//
// Cross-tab consistency: callers can listen for the native `storage`
// event on STORAGE_KEY. Same-tab writes also fire a window event
// `livediagram:preferences-changed` so listeners that can't observe
// their own `localStorage.setItem` (like `lib/telemetry.ts`'s
// in-memory gate cache) still refresh promptly. Every write stores the
// WHOLE blob in the cache, so a change is built on the cache, never on a
// render's snapshot (see rebaseUserPreferences): another tab's write since
// that render would otherwise be undone.

import type { ElementTourKind } from './element-tours';
import type { SwatchOverrideStore } from '@liveworkspace/workbench/lib/swatch-overrides';
import type { WhiteboardShapeKey } from './whiteboard-shape-catalogue';
import type { ShapePicks } from './whiteboard-shape-slots';
import { USER_PREFERENCES_STORAGE_KEY } from '@livediagram/telemetry-client';
import { preferencesStore } from './preferences-sync';

export type UserPreferences = {
  // When `false`, the editor skips the auto-rebind on move
  // (docs/specs/008-canvas/arrow-anchors.md, `rebindArrowAnchorsAfterMove`
  // in packages/document). Missing / undefined / true === on.
  // Consumers derive the effective value via
  // `autoRebindArrowsEnabled` below so the default lives here once.
  autoRebindArrows?: boolean;
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
  // Layers panel options (docs/specs/006-document/layers.md). Both default ON via `!== false`.
  //
  // The row thumbnail is the quickest way to tell two similarly-named layers
  // apart, but it is also the tallest thing in a row — turning it off gives a
  // compact list on a document with many layers.
  layersShowPreview?: boolean;
  // The per-layer element count, beside the name.
  layersShowCount?: boolean;
  // Panel switches (docs/specs/007-editor/user-preferences.md), each ON
  // unless stored `false`. Off removes the panel and the chrome that reaches
  // it, never the feature underneath. Read them through `panelEnabled`.
  //
  // Layers: the panel, its cluster button, "Move to layer" in the element
  // menus and the export's "Hidden layers" row. Layers still apply.
  layersPanelEnabled?: boolean;
  // Collaborate: the panel and its button. Comments and actions stay.
  collaboratePanelEnabled?: boolean;
  // Quick style: the selection's style panel. Style memory stays.
  quickStylePanelEnabled?: boolean;
  // Panel opacity (docs/specs/007-editor/user-preferences.md). The opacity (0..1) of EVERY panel at
  // rest (floating, popover, the Map, Quick style, the Toolbar strip), so the
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
  // Quick-add on hover (docs/specs/008-canvas/canvas-and-palette.md). When `true`, an element's quick-add "+"
  // buttons open their menu on hover instead of requiring a click; moving
  // the pointer away closes it. The "+" buttons still only appear on the
  // selected element, and a click still opens the menu either way. Missing /
  // undefined / false === click to open, the default (hover-open can feel
  // twitchy, so it's opt-in).
  quickAddOnHover?: boolean;
  // How an element shows its link, note, action and comments
  // (docs/specs/008-canvas/element-indicators.md): glyphs inside its top, at the top-right of a box
  // ('top', the default), a labelled row along its bottom edge ('footer'), or none ('off').
  // Read through `readElementIndicatorStyle`, which maps anything else to the default.
  elementIndicatorStyle?: 'top' | 'footer' | 'off';
  // Alignment guides (docs/specs/008-canvas/canvas-and-palette.md). When `false`, the editor skips the
  // faint guide lines drawn along the edges / centres a dragged or
  // resized element shares with its neighbours (the snap itself is
  // unaffected; only the visual hint is suppressed). Missing /
  // undefined === guides on, the default.
  alignmentGuides?: boolean;
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
  // Layers panel hover-solo (docs/specs/006-document/layers.md). When `false`, resting the pointer
  // on a Layers-panel row no longer solos that layer on the canvas.
  // Missing / undefined / true === on, the default. Flipped from the
  // panel's settings gear (desktop-only chrome, like the hover itself).
  layerHoverPreview?: boolean;
  // Whether the bottom-right cluster names its buttons beside their icons on a wide desktop
  // (docs/specs/007-editor/editor-app.md "Named on a wide desktop"). Missing === on; a phone never
  // names them, whatever this says. Read through useDockNames.
  dockButtonNames?: boolean;
  // Suggest Other Apps (liveworkspace/docs/specs/016-notifications/suggestions.md): false quiets every suggestion.
  suggestNextApp?: boolean;
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
  // The Diagram tour's seen-guard (docs/specs/007-editor/editor-tour.md; named for the welcome tour it was
  // until October 2026, so earlier answers still hold). True once the
  // tour's welcome offer has been answered (taken, skipped, or declined),
  // so the offer never re-appears for this user — synced, so it follows
  // the account across devices like every other preference. Surfaced in
  // Settings as Tours › "Watch It Built" (inverted); turning it on there and
  // closing Settings replays the tour. Missing / undefined === not seen.
  tourSeen?: boolean;
  // Watch It Built's topics taken (docs/specs/007-editor/watch-it-built.md "The start panel"): topic ids, written as a
  // topic is picked; a mode's Watch It Built is on the Start Tour button while one of its topics is not here. Read
  // through lib/watch-topics, which also counts `tourSeen` as The Basics.
  watchTopics?: string[];
  // The stepped Workshop and Draw tours' seen-guards. Both tours are retired for Watch It Built in those modes, which
  // reads neither (they showed none of its topics); kept in the type because they are already stored.
  workshopTourSeen?: boolean;
  drawTourSeen?: boolean;
  // The retired Avatar tour's seen-guard: Avatar mode moved to livehuddle (docs/specs/002-project-scope/
  // not-in-livediagram.md), so nothing reads it; kept in the type because it is already stored.
  avatarTourSeen?: boolean;
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
  // The whiteboard dock (docs/specs/023-draw-mode/draw-mode.md "Shape slots"): the pinned shape
  // kinds and the pick counts behind the Shapes flyout's slots. Read and written through
  // lib/whiteboard-dock-prefs, which parses them. Missing === the default pins, no history.
  whiteboardPinnedShapes?: WhiteboardShapeKey[];
  whiteboardShapePicks?: ShapePicks;
  // DEAD as of docs/specs/004-interface-design/colour-picker.md, like `customSwatches`: the markers'
  // Custom colours are the document's. Kept in the type because it is already stored.
  whiteboardYourColours?: string[];
  // Where a whiteboard's dock sits (docs/specs/023-draw-mode/draw-mode.md "Where the dock sits").
  // Read through lib/whiteboard-dock-prefs. Missing (or anything but 'bottom') === the top.
  whiteboardDockPosition?: 'top' | 'bottom';
  // Draw mode's pattern, the person's own (docs/specs/007-editor/editor-modes.md "One look"):
  // Plain, Dots or Grid. Read through lib/whiteboard-dock-prefs. Missing === Grid.
  drawPattern?: 'blank' | 'grid' | 'graph';
  // The presenter settings (docs/specs/012-collaboration/presentation-mode.md "Settings"): transition, speed,
  // playback and display, as one object. Read through lib/presentation-config, which trusts it only once parsed.
  // Missing === what this browser kept before they followed the account, else the defaults.
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

// The effective "Auto-Attach Arrows" state (docs/specs/007-editor/user-preferences.md): on by
// default, so only an explicit `false` turns the on-move rebind off. The
// single home for the default: the Settings row and the editor-preferences
// hook both call this instead of re-deriving it.
export function autoRebindArrowsEnabled(prefs: UserPreferences): boolean {
  return prefs.autoRebindArrows !== false;
}

// Whether a panel switch is on (docs/specs/007-editor/user-preferences.md):
// on unless stored `false`, so the Settings row and every surface it gates
// read one rule.
export type PanelSwitch =
  'layersPanelEnabled' | 'collaboratePanelEnabled' | 'quickStylePanelEnabled';
export function panelEnabled(prefs: UserPreferences | undefined, key: PanelSwitch): boolean {
  return prefs?.[key] !== false;
}
