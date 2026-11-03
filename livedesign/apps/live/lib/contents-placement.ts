// Where Pages mode's Contents sits on a desktop (docs/specs/007-editor/pages-mode.md "Contents"):
// docked as a sidebar down the canvas's left, the way a slide editor shows its slides, or minimised
// to the Contents button in the bottom-right cluster. The person's own choice, kept in their synced
// preferences (lib/user-preferences.ts) so it follows them across devices. A phone always has the
// button.
import type { UserPreferences } from './user-preferences';

export const CONTENTS_PLACEMENTS = ['sidebar', 'button'] as const;
export type ContentsPlacement = (typeof CONTENTS_PLACEMENTS)[number];

// The sidebar until the person minimises it.
export function readContentsPlacement(prefs: UserPreferences): ContentsPlacement {
  return prefs.contentsPlacement === 'button' ? 'button' : 'sidebar';
}

export function withContentsPlacement(
  prefs: UserPreferences,
  placement: ContentsPlacement,
): UserPreferences {
  return { ...prefs, contentsPlacement: placement };
}

// Which side of the canvas the sidebar is pinned to (@liveworkspace/workbench/lib/contents-sidebar), kept in this
// browser only under this key, and never synced.
export const CONTENTS_SIDE_STORAGE_KEY = 'livedesign:contents-side:v1';
