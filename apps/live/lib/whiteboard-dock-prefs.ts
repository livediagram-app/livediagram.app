// The whiteboard dock's synced preferences (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard
// shows", "Shape slots"): the dock mode, the pinned shape kinds and the pick counts behind the
// frequent slots. They live in the user's preferences blob (lib/user-preferences.ts), so they follow
// a signed-in user across devices and stay in this browser for a guest. Read through here, never
// directly: a stored value is only trusted once parsed.
import type { UserPreferences } from './user-preferences';
import { isWhiteboardShapeKey, type WhiteboardShapeKey } from './whiteboard-shape-catalogue';
import { PINNED_SHAPES_MAX, type ShapePicks } from './whiteboard-shape-slots';

// 'full' (Full drawing) is shown under Settings but not selectable yet ("Coming soon").
export type WhiteboardDockMode = 'simple' | 'shapes';

export const DEFAULT_WHITEBOARD_DOCK_MODE: WhiteboardDockMode = 'shapes';

export const WHITEBOARD_DOCK_MODES: readonly {
  id: WhiteboardDockMode | 'full';
  label: string;
  comingSoon?: true;
}[] = [
  { id: 'simple', label: 'Simple' },
  { id: 'shapes', label: 'With shapes' },
  { id: 'full', label: 'Full drawing', comingSoon: true },
];

export type WhiteboardDockPrefs = {
  mode: WhiteboardDockMode;
  pinned: WhiteboardShapeKey[];
  picks: ShapePicks;
};

function parseMode(raw: unknown): WhiteboardDockMode {
  return raw === 'simple' || raw === 'shapes' ? raw : DEFAULT_WHITEBOARD_DOCK_MODE;
}

function parsePinned(raw: unknown): WhiteboardShapeKey[] {
  if (!Array.isArray(raw)) return [];
  const out: WhiteboardShapeKey[] = [];
  for (const key of raw) {
    if (out.length === PINNED_SHAPES_MAX) break;
    if (isWhiteboardShapeKey(key) && !out.includes(key)) out.push(key);
  }
  return out;
}

const isCount = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0;
const isTime = (t: unknown): t is number => Number.isFinite(t) && (t as number) >= 0;

function parsePicks(raw: unknown): ShapePicks {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: Partial<Record<WhiteboardShapeKey, readonly [number, number]>> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isWhiteboardShapeKey(key) || !Array.isArray(value) || value.length !== 2) continue;
    const [n, t] = value as unknown[];
    if (isCount(n) && isTime(t)) out[key] = [n, t];
  }
  return out;
}

export function readWhiteboardDockPrefs(prefs: UserPreferences): WhiteboardDockPrefs {
  return {
    mode: parseMode(prefs.whiteboardDockMode),
    pinned: parsePinned(prefs.whiteboardPinnedShapes),
    picks: parsePicks(prefs.whiteboardShapePicks),
  };
}

/** The preferences with `patch` applied; a default or empty value is removed rather than stored. */
export function withWhiteboardDockPrefs(
  prefs: UserPreferences,
  patch: Partial<WhiteboardDockPrefs>,
): UserPreferences {
  const next = { ...prefs };
  if (patch.mode !== undefined) {
    if (patch.mode === DEFAULT_WHITEBOARD_DOCK_MODE) delete next.whiteboardDockMode;
    else next.whiteboardDockMode = patch.mode;
  }
  if (patch.pinned !== undefined) {
    if (patch.pinned.length === 0) delete next.whiteboardPinnedShapes;
    else next.whiteboardPinnedShapes = patch.pinned;
  }
  if (patch.picks !== undefined) {
    if (Object.keys(patch.picks).length === 0) delete next.whiteboardShapePicks;
    else next.whiteboardShapePicks = patch.picks;
  }
  return next;
}
