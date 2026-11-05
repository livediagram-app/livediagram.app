// The tab-level settings a template ships with (templateCanvasOverrides): its backdrop, layers, mode and kind. Its
// own module, apart from the template catalogue in templates.ts, which the editor reads (a template's title) on every
// load.
import type { BackgroundPattern, Tab } from '@livehuddle/document';
import { templateEditorMode } from './template-modes';
import type { TemplateKind } from './templates';

// The canvas backdrop pattern that best suits each template's layout, applied on top of the chosen theme (which only
// supplies the colours). The Spaces pin the dot grid (explicit, so it survives even a blank-canvas theme): an office's
// floor plan reads as one on gridded paper, the rooms carrying their own floors. Blank Space is not listed and falls
// through to the theme's pattern.
const TEMPLATE_PATTERNS: Partial<Record<TemplateKind, BackgroundPattern>> = {
  'virtual-office': 'grid',
  'coworking-space': 'grid',
  'team-pod': 'grid',
  'all-hands-hall': 'grid',
  'focus-library': 'grid',
  'training-room': 'grid',
  'rooftop-bar': 'grid',
  cafe: 'grid',
  'garden-retreat': 'grid',
  'city-park': 'grid',
};

// How far each loud backdrop pattern steps back behind a template's content
// (the tab's `backgroundOpacity`, which dims only the pattern layer). Graph
// paper is the loudest (two line weights across the whole page), so it drops
// the most; ruled lines, crosshatch and the checkerboard sit between. The dot
// grid and a blank canvas are already quiet and keep full strength. The user
// can still turn any of them back up in the Canvas controls.
const TEMPLATE_PATTERN_OPACITY: Partial<Record<BackgroundPattern, number>> = {
  graph: 0.4,
  crosshatch: 0.5,
  lines: 0.6,
  checkerboard: 0.6,
};

// Tab-level overrides a specific template ships with, applied on top
// of whatever theme is selected. Each template carries its preferred
// backdrop pattern (see TEMPLATE_PATTERNS).
export function templateCanvasOverrides(kind: TemplateKind): Partial<Tab> {
  const overrides: Partial<Tab> = {};
  const pattern = TEMPLATE_PATTERNS[kind];
  if (pattern) overrides.backgroundPattern = pattern;
  // The pattern recedes behind the content: a template is read, so its
  // backdrop should organise the page rather than compete with it. The
  // louder the pattern, the further it steps back (TEMPLATE_PATTERN_OPACITY).
  const quiet = pattern ? TEMPLATE_PATTERN_OPACITY[pattern] : undefined;
  if (quiet !== undefined && quiet < 1) overrides.backgroundOpacity = quiet;
  // A template's mode (docs/specs/007-editor/templates-by-mode.md): every template opens on a meeting board.
  overrides.opensIn = templateEditorMode(kind);
  return overrides;
}
