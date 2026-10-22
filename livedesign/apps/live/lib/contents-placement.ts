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

// The docked sidebar, for what measures it (the page framing, Zoom to Fit).
export const CONTENTS_SIDEBAR_SELECTOR = '[data-contents-sidebar]';
// Its width in px, at the panels' UI scale. It sits flush against the canvas's edge, no gap.
export const CONTENTS_SIDEBAR_WIDTH = 236;
// The resting inset the corner panels and the bottom-right cluster keep from what is beside them.
const CONTENTS_SIDEBAR_GAP = 16;

// The sidebar is docked with more than one page: a single page has nothing to find its way round,
// and keeps the button.
export const CONTENTS_SIDEBAR_MIN_PAGES = 2;

// Which side of the canvas the sidebar is pinned to: the left until the person drags it right. Like
// the corner panels' places (lib/panel-layout.ts), a per-device ergonomic choice, kept in this
// browser only and never synced.
export const CONTENTS_SIDES = ['left', 'right'] as const;
export type ContentsSide = (typeof CONTENTS_SIDES)[number];
export const CONTENTS_SIDE_STORAGE_KEY = 'livepages:contents-side:v1';

export function readContentsSide(stored: string | null): ContentsSide {
  return stored === 'right' ? 'right' : 'left';
}

// How far the corner stacks and the bottom-right cluster on the sidebar's side start from the
// canvas's edge while it is docked: past it, with their usual inset.
export function contentsSidebarClearancePx(panelScale: number): number {
  return CONTENTS_SIDEBAR_WIDTH * panelScale + CONTENTS_SIDEBAR_GAP;
}
