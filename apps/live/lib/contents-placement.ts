// Where Illustrate's Contents sits on a desktop (docs/specs/007-editor/illustrate-pages.md "Contents"):
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

// The docked sidebar, for what measures it (the page framing, the left corner stacks).
export const CONTENTS_SIDEBAR_SELECTOR = '[data-contents-sidebar]';
// Its width in px, and the gap it keeps from the canvas's left edge (the corner panels' resting inset).
export const CONTENTS_SIDEBAR_WIDTH = 236;
export const CONTENTS_SIDEBAR_INSET = 16;

// Where the left corner stacks start while the sidebar is docked: past it, with the same inset again.
// The sidebar is drawn at the panels' UI scale (docs/specs/007-editor/ui-scale.md), so its width
// scales and its insets do not.
export function contentsSidebarClearancePx(panelScale: number): number {
  return CONTENTS_SIDEBAR_INSET * 2 + CONTENTS_SIDEBAR_WIDTH * panelScale;
}
