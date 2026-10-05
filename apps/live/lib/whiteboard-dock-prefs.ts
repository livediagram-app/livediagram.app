// The whiteboard dock's synced preferences (docs/specs/023-draw-mode/draw-mode.md "Shape slots",
// "Where the dock sits"): the pinned shape kinds and the pick counts behind the Shapes flyout's
// slots, where the dock sits, and Draw mode's pattern. They live in the
// user's preferences blob (lib/user-preferences.ts), so they follow a signed-in user across devices
// and stay in this browser for a guest. Read through here, never directly: a stored value is only
// trusted once parsed.
import type { BackgroundPattern } from '@livediagram/document';
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

// Where the dock sits: the top unless the user chose the bottom.
export const WHITEBOARD_DOCK_POSITIONS = ['top', 'bottom'] as const;
export type WhiteboardDockPosition = (typeof WHITEBOARD_DOCK_POSITIONS)[number];

export function readWhiteboardDockPosition(prefs: UserPreferences): WhiteboardDockPosition {
  return prefs.whiteboardDockPosition === 'bottom' ? 'bottom' : 'top';
}

export function withWhiteboardDockPosition(
  prefs: UserPreferences,
  position: WhiteboardDockPosition,
): UserPreferences {
  return { ...prefs, whiteboardDockPosition: position };
}

// The dock's wrapper, as wide as its groups: what the top corners are measured against. The
// Toolbar layout's dock only: the Floating layout's Palette panel carries the same tools
// (data-dock-variant="panel") and is a corner panel itself.
export const WHITEBOARD_DOCK_SELECTOR = '[data-whiteboard-dock][data-dock-variant="dock"]';

// Draw mode's pattern (docs/specs/007-editor/editor-modes.md "One look"): the person's own Plain,
// Dots or Grid, as they last chose it in Draw mode, never stored on a tab. Grid until chosen.
export const DRAW_PATTERNS = [
  'blank',
  'grid',
  'graph',
] as const satisfies readonly BackgroundPattern[];
export type DrawPattern = (typeof DRAW_PATTERNS)[number];
export const DEFAULT_DRAW_PATTERN: DrawPattern = 'graph';

export function readDrawPattern(prefs: UserPreferences): DrawPattern {
  const stored = prefs.drawPattern;
  return DRAW_PATTERNS.find((p) => p === stored) ?? DEFAULT_DRAW_PATTERN;
}

export function withDrawPattern(prefs: UserPreferences, pattern: DrawPattern): UserPreferences {
  return { ...prefs, drawPattern: pattern };
}
