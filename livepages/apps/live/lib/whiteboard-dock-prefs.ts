// Draw mode's pattern (docs/specs/007-editor/editor-modes.md "One look"): the person's own Plain,
// Dots or Grid, never stored on a tab. It lives in the user's preferences blob
// (lib/user-preferences.ts), so it follows a signed-in user across devices and stays in this browser
// for a guest. Read through here, never directly: a stored value is only trusted once parsed.
import type { BackgroundPattern } from '@livepages/document';
import type { UserPreferences } from './user-preferences';

const DRAW_PATTERNS = ['blank', 'grid', 'graph'] as const satisfies readonly BackgroundPattern[];
export type DrawPattern = (typeof DRAW_PATTERNS)[number];
const DEFAULT_DRAW_PATTERN: DrawPattern = 'graph';

export function readDrawPattern(prefs: UserPreferences): DrawPattern {
  const stored = prefs.drawPattern;
  return DRAW_PATTERNS.find((p) => p === stored) ?? DEFAULT_DRAW_PATTERN;
}
