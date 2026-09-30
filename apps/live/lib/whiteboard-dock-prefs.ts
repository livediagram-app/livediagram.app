// The whiteboard dock's synced preferences (docs/specs/023-whiteboard/whiteboard.md "Shape slots"):
// the pinned shape kinds and the pick counts behind the Shapes flyout's slots. They live in the
// user's preferences blob (lib/user-preferences.ts), so they follow a signed-in user across devices
// and stay in this browser for a guest. Read through here, never directly: a stored value is only
// trusted once parsed.
import type { UserPreferences } from './user-preferences';
import { isWhiteboardShapeKey, type WhiteboardShapeKey } from './whiteboard-shape-catalogue';
import {
  DEFAULT_PINNED_SHAPES,
  PINNED_SHAPES_MAX,
  type ShapePicks,
} from './whiteboard-shape-slots';

export type WhiteboardDockPrefs = {
  pinned: WhiteboardShapeKey[];
  picks: ShapePicks;
};

// Absent (never changed) or malformed: the defaults. An array, even empty, is the user's own.
function parsePinned(raw: unknown): WhiteboardShapeKey[] {
  if (!Array.isArray(raw)) return [...DEFAULT_PINNED_SHAPES];
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
    pinned: parsePinned(prefs.whiteboardPinnedShapes),
    picks: parsePicks(prefs.whiteboardShapePicks),
  };
}

/** The preferences with `patch` applied; empty counts are removed rather than stored. */
export function withWhiteboardDockPrefs(
  prefs: UserPreferences,
  patch: Partial<WhiteboardDockPrefs>,
): UserPreferences {
  const next = { ...prefs };
  // Stored once changed, even empty: absent means the default pins.
  if (patch.pinned !== undefined) next.whiteboardPinnedShapes = patch.pinned;
  if (patch.picks !== undefined) {
    if (Object.keys(patch.picks).length === 0) delete next.whiteboardShapePicks;
    else next.whiteboardShapePicks = patch.picks;
  }
  return next;
}
