export type MapSize = 'short' | 'medium' | 'tall';

// Per-user editor preference flags. See docs/specs/007-editor/user-preferences.md.
//
// Storage:
//   - The liveworkspace accounts database is the authoritative store (through the api's
//     /api/preferences), read once a page load via fetchUserPreferences() so a person's flags
//     follow them across devices, and those every app shares (ALL_SETTING_KEYS in
//     @liveworkspace/settings) across apps too. A deployment without liveworkspace accounts keeps
//     none, and the flags live in this browser only.
//   - `localStorage` under `livedocuments:user-preferences:v1` is a warm
//     cache so the editor never blocks on the network at boot. Reads
//     are synchronous; writes go to localStorage at once and to the api as
//     a debounced patch of what changed (lib/preferences-sync).
//
// Cross-tab consistency: callers can listen for the native `storage`
// event on STORAGE_KEY. Same-tab writes also fire a window event
// `livedocuments:preferences-changed` so listeners that can't observe
// their own `localStorage.setItem` (like `lib/telemetry.ts`'s
// in-memory gate cache) still refresh promptly. Every write starts from the
// WHOLE blob, so a change is built on the cache, never on a render's
// snapshot (see rebaseUserPreferences): another tab's write since that
// render would otherwise be undone.

import { upgradeLegacyPreferences } from '@livedocuments/api-schema';
import type { PageKind } from '@livedocuments/document';
import type { ElementTourKind } from './element-tours';
import type { SwatchOverrideStore } from './swatch-overrides';
import { USER_PREFERENCES_STORAGE_KEY } from '@livedocuments/telemetry-client';
import { apiGetPreferences } from './api-client';
import {
  fitPreferences,
  keepPreferencesLocally,
  preferencesUnsynced,
  savePreferences,
  setServerPreferences,
} from './preferences-sync';
import { getWorkbenchConfinement } from './api/workbench-confinement';
import { readLocalStorageSafe, writeLocalStorageSafe } from './local-storage-safe';
import { debugLog } from './debug-log';

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
  // Layers panel hover-solo (docs/specs/006-document/layers.md). When `false`, resting the pointer
  // on a Layers-panel row no longer solos that layer on the canvas.
  // Missing / undefined / true === on, the default. Flipped from the
  // panel's settings gear (desktop-only chrome, like the hover itself).
  layerHoverPreview?: boolean;
  // Whether the bottom-right cluster names its buttons beside their icons on a wide desktop
  // (docs/specs/007-editor/editor-app.md "Named on a wide desktop"). Missing === on; a phone never
  // names them, whatever this says. Read through useDockNames.
  dockButtonNames?: boolean;
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
  // The Pages tour's seen-guard (docs/specs/007-editor/pages-tour.md): true counts every
  // page kind's track as seen while Power user mode is on. Set with every kind by Power user mode.
  pagesTourSeen?: boolean;
  // The page kinds whose Pages tour track has been offered and answered (taken, skipped or declined), so each
  // kind offers its own once ever. Cleared with `pagesTourSeen` when the Settings switch is turned on.
  pagesTourKinds?: PageKind[];
  // Element tours (docs/specs/007-editor/element-tours.md): the toured element kinds whose offer has been answered
  // (Play or Cancel), so each offers itself once ever. Surfaced in Settings as Tours › Show Me, one switch
  // per kind (inverted). Read through lib/element-tours.
  elementTourKinds?: ElementTourKind[];
  // Counts every element tour as answered while Power user mode is on (lib/tour-tracks.ts); written by its preset.
  elementToursSeen?: boolean;
  // Documents this user has hidden from the Explorer's Recent list
  // (docs/specs/013-workspace/hide-from-recent.md). PER-USER rather than a field on the document: your Recent
  // is your view of your own work, and on a shared document one
  // collaborator hiding it must not hide it from everyone else.
  //
  // Ids only, so the list stays small; the whole preferences blob has a
  // 4 KB budget (lib/preferences-sync PREFERENCES_BODY_MAX), which `toggleRecentExcluded` below budgets for.
  // Missing / undefined === nothing excluded.
  // DEAD as of docs/specs/004-interface-design/colour-picker.md: Custom colours are the colours
  // picked with + in the document, kept with its tabs, not a per-user list. Nothing reads or writes this any
  // more; it stays in the type because it is already stored for existing users.
  customSwatches?: string[];
  // The quick style panel's custom swatches (docs/specs/008-canvas/quick-style-panel.md "Custom
  // swatches"): per theme, which of a row's six slots you replaced with a
  // colour of your own. Read and written through lib/swatch-overrides, which
  // validates it and keeps it inside its share of the 4 KB cap.
  quickSwatchOverrides?: SwatchOverrideStore;
  recentExcludedIds?: string[];
  // Power user mode (docs/specs/007-editor/power-user-mode.md). Read and written through
  // lib/power-user-mode.ts, never directly: switching it applies or restores
  // the preset, recorded in `powerUserBaseline` while the mode is on.
  powerUserMode?: boolean;
  powerUserBaseline?: Record<
    string,
    { before: Partial<UserPreferences>; applied: Partial<UserPreferences> }
  >;
  // A power-user-only setting: honoured only while `powerUserMode` is on,
  // where missing means on. Read through `isMinimalChrome`.
  minimalChrome?: boolean;
  // One-way latch: the power user mode offer has been shown to this account.
  powerUserOfferShown?: boolean;
  // A canvas pattern of the person's own, kept from livediagram's Draw mode:
  // Plain, Dots or Grid. Read through lib/whiteboard-dock-prefs. Missing === Grid.
  drawPattern?: 'blank' | 'grid' | 'graph';
  // How Pages mode's Contents shows on a desktop (docs/specs/007-editor/pages-mode.md
  // "Contents"): docked as a sidebar down the canvas's left, or minimised to its cluster button. Read
  // through lib/contents-placement. Missing (or anything but 'button') === the sidebar.
  contentsPlacement?: 'sidebar' | 'button';
  // The presenter settings (docs/specs/012-collaboration/presentation-mode.md "Settings"): transition, speed,
  // playback and display, as one object. Read through lib/presentation-config, which trusts it only once parsed.
  // Missing === what this browser kept before they followed the account, else the defaults.
  presentation?: Record<string, unknown>;
};

// How many excluded ids we keep. A document id is a 36-char UUID, so 200
// of them is ~7.4 KB of JSON on its own — well past the 4 KB budget for
// the serialised preferences blob (lib/preferences-sync), which would
// crowd out every other preference. 60 is far more than anyone will
// hide by hand and leaves plenty of room for the other flags.
export const RECENT_EXCLUDED_LIMIT = 60;

// Flip a document's Recent exclusion, returning the NEXT id list. Newest
// exclusions are kept at the front so the cap drops the oldest choice
// rather than the one just made.
export function toggleRecentExcluded(prefs: UserPreferences, documentId: string): string[] {
  const current = prefs.recentExcludedIds ?? [];
  if (current.includes(documentId)) return current.filter((id) => id !== documentId);
  return [documentId, ...current].slice(0, RECENT_EXCLUDED_LIMIT);
}

// Re-exported under this module's own name because everything here reads it
// as "the preferences key". It's DEFINED in telemetry-client because the help
// centre reads the telemetry field out of this same blob and must never get
// the string wrong — see the note there.
export const STORAGE_KEY = USER_PREFERENCES_STORAGE_KEY;
export const PREFERENCES_CHANGED_EVENT = 'livedocuments:preferences-changed';

// The effective "Auto-Attach Arrows" state (docs/specs/007-editor/user-preferences.md): on by
// default, so only an explicit `false` turns the on-move rebind off. The
// single home for the default: the Settings row and the editor-preferences
// hook both call this instead of re-deriving it.
export function autoRebindArrowsEnabled(prefs: UserPreferences): boolean {
  return prefs.autoRebindArrows !== false;
}

// Read the current preferences from localStorage. Returns `{}` on
// missing key, an SSR / private-window environment without
// `localStorage`, or a parse error (corrupted JSON). Synchronous so
// the editor can use it during render; the network fetch via
// fetchUserPreferences happens separately at mount and merges its
// result back into the cache when it arrives.
export function readUserPreferences(): UserPreferences {
  const raw = readLocalStorageSafe(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return {};
    // Keep unknown keys: forward-compat for future-versioned flags
    // a different client may have written.
    return upgradeLegacyPreferences(parsed as Record<string, unknown>);
  } catch {
    return {};
  }
}

// Write preferences back. Best-effort: a quota / private-window
// failure is swallowed (the dialog state still applies in-memory
// for the session; the user just loses the persistence). The
// network sync to D1 runs in the background when `ownerId` is supplied
// (lib/preferences-sync): the cache write happens synchronously so the
// UI updates without waiting. Callers without an ownerId (e.g. unit
// tests, the editor before identity resolves) skip the network step.
// The blob is first trimmed to fit the api's size cap, so the cache and
// the server hold the same thing. On success a same-tab
// `livedocuments:preferences-changed` event fires so in-process
// listeners refresh without polling. The browser handles cross-tab
// via its native `storage` event.
export function writeUserPreferences(prefs: UserPreferences, ownerId?: string | null): void {
  const fitted = fitPreferences(prefs);
  writeLocalStorageSafe(STORAGE_KEY, JSON.stringify(fitted));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PREFERENCES_CHANGED_EVENT));
  }
  // The editor in a workbench never writes preferences to the api (docs/specs/013-workspace/
  // blueprints/workbench-embeds.md, I9): the frame's choices stay in the frame. Nor under the 'self'
  // placeholder a document in This Browser opens with before the reader is known
  // (docs/specs/006-document/offline-mode.md "Instant open"): that row would be everybody's.
  if (ownerId && ownerId !== 'self' && !getWorkbenchConfinement()) savePreferences(ownerId, fitted);
}

// A change a caller built on its render's snapshot, moved onto the
// freshest preferences (the device cache, which every tab writes):
// only the keys `next` changed from `snapshot` are applied, so a key
// another tab wrote since that render survives. With no cache yet,
// the snapshot is the freshest there is.
export function rebaseUserPreferences(
  snapshot: UserPreferences,
  next: UserPreferences,
): UserPreferences {
  const latest = readLocalStorageSafe(STORAGE_KEY) === null ? snapshot : readUserPreferences();
  const rebased: Record<string, unknown> = { ...latest };
  const before = snapshot as Record<string, unknown>;
  const after = next as Record<string, unknown>;
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[key] === after[key]) continue;
    if (key in after) rebased[key] = after[key];
    else delete rebased[key];
  }
  return rebased;
}

// Rebase a change (above), write it, and answer what was written, for a
// caller that also holds the preferences in React state.
export function commitUserPreferences(
  snapshot: UserPreferences,
  next: UserPreferences,
  ownerId?: string | null,
): UserPreferences {
  const rebased = rebaseUserPreferences(snapshot, next);
  writeUserPreferences(rebased, ownerId);
  return rebased;
}

// Fetch preferences from the api, merge over the localStorage cache, and
// dispatch `livedocuments:preferences-changed` so in-process listeners
// pick up the merged value. Returns the merged preferences (or null
// when the fetch failed; the caller can treat that as "stick with
// the cache"). Called by the editor and the Explorer at mount, docs/specs/007-editor/user-preferences.md's sync flow.
//
// Server-wins on conflict: the server holds the most-recently-saved
// state across all of this owner's devices, so any key present on
// both sides takes the server's value. Keys only in the cache (a
// PUT that hasn't reached the server yet, or a write made offline)
// are preserved by the spread order below. The exception is a device
// whose last save was never confirmed (lib/preferences-sync): the
// server's blob is older than the cache there, so the cache wins and
// is sent again.
//
// Once a page load per owner: the Explorer and the editor both ask, and share the one read.
const loads = new Map<string, Promise<UserPreferences | null>>();

export function fetchUserPreferences(ownerId: string): Promise<UserPreferences | null> {
  const known = loads.get(ownerId);
  if (known) return known.then((merged) => (merged === null ? null : readUserPreferences()));
  const load = loadUserPreferences(ownerId);
  loads.set(ownerId, load);
  // A failed read may be tried again.
  void load.then((merged) => {
    if (merged === null) loads.delete(ownerId);
  });
  return load;
}

// Test seam: forget the page's reads.
export function __forgetPreferenceLoads(): void {
  loads.clear();
}

async function loadUserPreferences(ownerId: string): Promise<UserPreferences | null> {
  const remote = await apiGetPreferences(ownerId);
  if (remote === 'local') {
    keepPreferencesLocally();
    return null;
  }
  if (remote === null) return null;
  const local = readUserPreferences();
  const server = upgradeLegacyPreferences(remote) as UserPreferences;
  setServerPreferences(ownerId, remote);
  const unsynced = preferencesUnsynced(ownerId);
  const merged = fitPreferences(unsynced ? { ...server, ...local } : { ...local, ...server });
  writeLocalStorageSafe(STORAGE_KEY, JSON.stringify(merged));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PREFERENCES_CHANGED_EVENT));
  }
  if (unsynced) {
    debugLog('[preferences] device copy kept over the server, resending');
    if (!getWorkbenchConfinement()) savePreferences(ownerId, merged);
  }
  return merged;
}

// Whether a panel switch is on (docs/specs/007-editor/user-preferences.md):
// on unless stored `false`, so the Settings row and every surface it gates
// read one rule.
export type PanelSwitch =
  'layersPanelEnabled' | 'collaboratePanelEnabled' | 'quickStylePanelEnabled';
export function panelEnabled(prefs: UserPreferences | undefined, key: PanelSwitch): boolean {
  return prefs?.[key] !== false;
}
