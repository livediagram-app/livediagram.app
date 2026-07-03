// Device-local layout for the editor's floating panels (spec/63).
//
// Which corner each panel docks into — or where it floats free — is a
// per-device ergonomic choice (screen size, handedness, external
// monitor), so unlike the synced user-preferences blob (spec/20) this
// lives ONLY in localStorage and is NEVER sent to the api / D1. Guests
// get it for free. Do not fold panel placement into UserPreferences.
//
// Eventing mirrors lib/user-preferences.ts (a same-tab custom event so
// the editor reacts to its own write, plus the browser's native
// `storage` event for cross-tab), but there is no network step.

import { readLocalStorageSafe, writeLocalStorageSafe } from './local-storage-safe';

export type PanelCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// The floating panels that participate in docking. Every one is built
// on the shared MovablePanel. The fixed zoom controls are deliberately
// absent — they are not a MovablePanel and stay pinned bottom-right.
export type PanelId =
  | 'palette'
  | 'explorer'
  | 'activity'
  | 'comments'
  | 'actions'
  | 'ai'
  | 'minimap';

export const PANEL_CORNERS: readonly PanelCorner[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
];

export const PANEL_IDS: readonly PanelId[] = [
  'palette',
  'explorer',
  'activity',
  'comments',
  'actions',
  'ai',
  'minimap',
];

// Internal: a free panel's pixel position. Not exported — callers pass
// plain { x, y } object literals to freePanel().
type FreePosition = { x: number; y: number };

// A panel id appears in EXACTLY ONE place: one corner's array, or
// `free`, or neither (then it uses its default corner, below). The
// per-corner array is ordered top→bottom for top corners and
// bottom→top fill order for bottom corners; reflow when a panel is
// removed / hidden is just "drop it from the array, the rest shift".
export type PanelLayout = {
  corners: Record<PanelCorner, PanelId[]>;
  free: Partial<Record<PanelId, FreePosition>>;
};

// Each panel's home corner — matches the historical fixed layout from
// spec/09 so a user who never rearranges anything sees no change,
// including Comments / AI stacking beneath the Palette (top-right).
export const DEFAULT_PANEL_CORNER: Record<PanelId, PanelCorner> = {
  explorer: 'top-left',
  palette: 'top-right',
  comments: 'top-right',
  actions: 'top-right',
  ai: 'top-right',
  activity: 'bottom-left',
  minimap: 'bottom-left',
};

export const STORAGE_KEY = 'livediagram:panel-layout:v1';
export const PANEL_LAYOUT_CHANGED_EVENT = 'livediagram:panel-layout-changed';

function emptyCorners(): Record<PanelCorner, PanelId[]> {
  return { 'top-left': [], 'top-right': [], 'bottom-left': [], 'bottom-right': [] };
}

// The default layout: every panel in its home corner, in the historical
// stacking order, nothing free.
export function defaultPanelLayout(): PanelLayout {
  const corners = emptyCorners();
  // Order within a corner matters (it's the stack order); list them in
  // the order they stacked historically rather than PANEL_IDS order.
  corners['top-left'] = ['explorer'];
  corners['top-right'] = ['palette', 'comments', 'actions', 'ai'];
  corners['bottom-left'] = ['activity', 'minimap'];
  return { corners, free: {} };
}

// Coerce arbitrary parsed JSON into a well-formed PanelLayout:
//   - drop unknown / duplicate panel ids (a panel can live in only one
//     place; first occurrence wins, scanning corners then free),
//   - keep only known corners,
//   - any panel id not mentioned anywhere is simply absent — callers
//     resolve absent ids to DEFAULT_PANEL_CORNER, so a layout written
//     by an older client (missing a newer panel) never strands it.
// Returns the default layout for non-object input.
export function normalizePanelLayout(input: unknown): PanelLayout {
  if (typeof input !== 'object' || input === null) return defaultPanelLayout();
  const raw = input as Partial<PanelLayout>;
  const seen = new Set<PanelId>();
  const corners = emptyCorners();

  const rawCorners = (raw.corners ?? {}) as Partial<Record<PanelCorner, unknown>>;
  for (const corner of PANEL_CORNERS) {
    const list = rawCorners[corner];
    if (!Array.isArray(list)) continue;
    for (const id of list) {
      if (!isPanelId(id) || seen.has(id)) continue;
      seen.add(id);
      corners[corner].push(id);
    }
  }

  const free: Partial<Record<PanelId, FreePosition>> = {};
  const rawFree = (raw.free ?? {}) as Record<string, unknown>;
  for (const [id, pos] of Object.entries(rawFree)) {
    if (!isPanelId(id) || seen.has(id)) continue;
    if (!isFreePosition(pos)) continue;
    seen.add(id);
    free[id] = { x: pos.x, y: pos.y };
  }

  return { corners, free };
}

function isPanelId(value: unknown): value is PanelId {
  return typeof value === 'string' && (PANEL_IDS as readonly string[]).includes(value);
}

function isFreePosition(value: unknown): value is FreePosition {
  return (
    typeof value === 'object' &&
    value !== null &&
    Number.isFinite((value as FreePosition).x) &&
    Number.isFinite((value as FreePosition).y)
  );
}

// Read the layout from localStorage, normalised. Returns the default
// layout on a missing key, SSR, or a parse error. Synchronous so the
// editor can hydrate during the first render with no flash.
export function readPanelLayout(): PanelLayout {
  const rawText = readLocalStorageSafe(STORAGE_KEY);
  if (!rawText) return defaultPanelLayout();
  try {
    return normalizePanelLayout(JSON.parse(rawText));
  } catch {
    return defaultPanelLayout();
  }
}

// Persist the layout. Best-effort (quota / private-window failures are
// swallowed; the in-memory state still applies for the session). Fires
// a same-tab change event so in-process listeners refresh without
// polling; the browser handles cross-tab via its native `storage` event.
export function writePanelLayout(layout: PanelLayout): void {
  writeLocalStorageSafe(STORAGE_KEY, JSON.stringify(layout));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PANEL_LAYOUT_CHANGED_EVENT));
  }
}

// --- Pure layout transforms (no I/O; the hook persists the result) ---

// Remove a panel from wherever it currently lives (any corner, or free).
function withoutPanel(layout: PanelLayout, panel: PanelId): PanelLayout {
  const corners = emptyCorners();
  for (const corner of PANEL_CORNERS) {
    corners[corner] = layout.corners[corner].filter((id) => id !== panel);
  }
  const free = { ...layout.free };
  delete free[panel];
  return { corners, free };
}

// Dock a panel to a corner, appended to the bottom of that corner's
// stack (it joins below whatever is already there). Idempotent on the
// corner contents beyond moving the panel.
export function dockPanel(layout: PanelLayout, panel: PanelId, corner: PanelCorner): PanelLayout {
  const next = withoutPanel(layout, panel);
  next.corners[corner] = [...next.corners[corner], panel];
  return next;
}

// Park a panel at an explicit free position, removing it from any corner.
export function freePanel(layout: PanelLayout, panel: PanelId, pos: FreePosition): PanelLayout {
  const next = withoutPanel(layout, panel);
  next.free[panel] = pos;
  return next;
}

// Reset a panel to its default corner (clearing a free position or a
// non-default corner). Appends to the default corner's current stack.
export function resetPanelPlacement(layout: PanelLayout, panel: PanelId): PanelLayout {
  return dockPanel(layout, panel, DEFAULT_PANEL_CORNER[panel]);
}

// Resolve where a panel currently sits, falling back to its default
// corner when it isn't mentioned in the layout at all.
export type ResolvedPlacement =
  | { mode: 'corner'; corner: PanelCorner }
  | { mode: 'free'; pos: FreePosition };

export function resolvePlacement(layout: PanelLayout, panel: PanelId): ResolvedPlacement {
  for (const corner of PANEL_CORNERS) {
    if (layout.corners[corner].includes(panel)) return { mode: 'corner', corner };
  }
  const free = layout.free[panel];
  if (free) return { mode: 'free', pos: free };
  return { mode: 'corner', corner: DEFAULT_PANEL_CORNER[panel] };
}

// --- Snap geometry (pure; drives the drag snap-to-corner guides) ---

// The corner inset (px) that resting panels sit at — matches the
// `*-4` (1rem) Tailwind corner classes in the dock containers.
export const CORNER_INSET_PX = 16;
// Extra bottom inset for the BOTTOM-RIGHT corner so a panel docked there
// sits ABOVE the fixed zoom controls (bottom-right, ~44px tall at a 16px
// inset) rather than overlapping them. Internal: it reaches the dock
// container + snap detection via cornerBottomInset(), so nothing imports
// the raw constant.
const ZOOM_CLEARANCE_PX = 56;
// How close (px) the panel's relevant corner must get to a corner anchor
// before that corner becomes the snap candidate. Internal to the snap math.
const SNAP_RADIUS_PX = 96;
// Gap between stacked panels in a corner (matches the dock containers'
// `gap-4`). Used to offset the snap anchor past an occupied corner's
// existing stack so detection lines up with where the panel will land.
export const STACK_GAP_PX = 16;

// Heights (px) of the EXISTING resting stack in each corner during a
// drag (the dragged panel excluded). Lets the snap anchor sit at the
// landing position — below a top corner's stack, above a bottom one's —
// so you don't have to drag all the way to the bare corner when another
// panel is already there. Missing / 0 means an empty corner.
export type CornerStackExtents = Partial<Record<PanelCorner, number>>;

// The total bottom inset for a corner: bottom-right is raised to clear the
// zoom controls; every other corner uses the plain inset.
export function cornerBottomInset(corner: PanelCorner): number {
  return corner === 'bottom-right' ? CORNER_INSET_PX + ZOOM_CLEARANCE_PX : CORNER_INSET_PX;
}

// A dragged panel's geometry in positioning-container (i.e. <main>)
// coordinates, plus the container's own size — everything
// nearestSnapCorner needs, with no DOM access.
export type PanelDragGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  parentWidth: number;
  parentHeight: number;
};

// The anchor point (container coords) the dragged panel's relevant corner
// should reach to dock here. With an empty corner that's the inset corner;
// with `extent` of existing stack it's offset to the LANDING position
// (past the stack + a gap), so the snap fires where the panel will
// actually sit rather than only at the bare corner.
function cornerAnchor(
  corner: PanelCorner,
  parentWidth: number,
  parentHeight: number,
  extent: number,
): { x: number; y: number } {
  const left = corner === 'top-left' || corner === 'bottom-left';
  const top = corner === 'top-left' || corner === 'top-right';
  const stackOffset = extent > 0 ? extent + STACK_GAP_PX : 0;
  return {
    x: left ? CORNER_INSET_PX : parentWidth - CORNER_INSET_PX,
    y: top ? CORNER_INSET_PX + stackOffset : parentHeight - cornerBottomInset(corner) - stackOffset,
  };
}

// The point ON THE PANEL that should approach a given corner: a
// top-left target watches the panel's top-left corner, a bottom-right
// target watches its bottom-right, etc. So the guide reads "bring this
// edge of the panel to that corner of the screen".
function panelCornerPoint(corner: PanelCorner, geom: PanelDragGeometry): { x: number; y: number } {
  const left = corner === 'top-left' || corner === 'bottom-left';
  const top = corner === 'top-left' || corner === 'top-right';
  return {
    x: left ? geom.x : geom.x + geom.width,
    y: top ? geom.y : geom.y + geom.height,
  };
}

// Which corner the panel would snap to if released now, or null if it's
// outside every corner's snap radius (a free drop). Picks the nearest
// when more than one is in range. `extents` shifts each corner's anchor
// past any panel already stacked there, so detection matches the landing
// slot (you don't have to reach the bare corner).
export function nearestSnapCorner(
  geom: PanelDragGeometry,
  extents: CornerStackExtents = {},
): PanelCorner | null {
  let best: PanelCorner | null = null;
  let bestDist = SNAP_RADIUS_PX;
  for (const corner of PANEL_CORNERS) {
    const anchor = cornerAnchor(corner, geom.parentWidth, geom.parentHeight, extents[corner] ?? 0);
    const point = panelCornerPoint(corner, geom);
    const dist = Math.hypot(point.x - anchor.x, point.y - anchor.y);
    if (dist <= bestDist) {
      best = corner;
      bestDist = dist;
    }
  }
  return best;
}
