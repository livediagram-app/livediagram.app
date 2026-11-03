// The tab-level settings a template ships with (templateCanvasOverrides): its backdrop, layers, mode and kind. Its
// own module, apart from the template catalogue in templates.ts, which the editor reads (a template's title) on every
// load.
import type { BackgroundPattern, Tab } from '@livehuddle/document';
import { templateLayers } from './template-layers';
import { templateEditorMode } from './template-modes';
import type { TemplateKind } from './templates';

// The canvas backdrop pattern that best suits each template's layout.
// Applied on top of the chosen theme (which only supplies the colours),
// so a starter ships with a fitting canvas instead of inheriting the
// theme's default dot grid:
//   - graph paper for alignment-heavy scaffolds (SWOT, the matrices,
//     the roadmap) where boxes snap to a square grid,
//   - a blank canvas for drawn scenes and pages (the Sailboat, the
//     Objectives planner) where the shapes should carry the page,
//   - horizontal rules for the time-ordered user journey,
//   - the dot grid (explicit, so it survives even a blank-canvas theme)
//     for the sticky-note / freeform boards.
// Templates not listed here fall through to the theme's pattern.
const TEMPLATE_PATTERNS: Partial<Record<TemplateKind, BackgroundPattern>> = {
  swot: 'graph',
  journey: 'lines',
  retrospective: 'grid',
  'prioritization-matrix': 'graph',
  // The later batch splits the same way: alignment-heavy scaffolds ride
  // graph paper, sticky-note workshop boards pin the dot grid.
  roadmap: 'graph',
  'raci-matrix': 'graph',
  'business-model-canvas': 'graph',
  'user-story-map': 'grid',
  'affinity-map': 'grid',
  'lean-coffee': 'grid',
  brainstorm: 'grid',
  'workshop-board': 'grid',
  'town-hall': 'grid',
  'pub-quiz': 'grid',
  'icebreaker-questions': 'grid',
  // Grid: an office's floor plan reads as one on gridded paper, the rooms carrying their own floors.
  'virtual-office': 'grid',
  'coworking-space': 'grid',
  'team-pod': 'grid',
  'all-hands-hall': 'grid',
  'two-truths-and-a-lie': 'grid',
  'would-you-rather': 'grid',
  'people-bingo': 'grid',
  'empathy-map': 'grid',
  // The twelve-starter batch follows the same split: the retro formats,
  // Crazy 8s, persona, agenda and objectives are sticky-note / workshop
  // boards on the dot grid, as is the postmortem (a dense written report,
  // where graph lines behind every card read as noise); the matrices and
  // tree ride graph paper; the Sailboat's drawn scene gets a blank canvas.
  'start-stop-continue': 'grid',
  'mad-sad-glad': 'grid',
  'four-ls': 'grid',
  sailboat: 'blank',
  'incident-postmortem': 'grid',
  'opportunity-solution-tree': 'graph',
  'crazy-eights': 'grid',
  'stakeholder-map': 'graph',
  'risk-matrix': 'graph',
  // The Value Proposition Canvas is a sticky-note board on the dot grid.
  'value-proposition-canvas': 'grid',
  'user-persona': 'grid',
  'meeting-agenda': 'grid',
  // A personal planning sheet, read closely like a page: even dots behind
  // its cards read as noise, so it gets a clean canvas.
  'objectives-planner': 'blank',
  // The board grids are sticky-note boards on the dot grid.
  'pestle-analysis': 'grid',
  'kwl-chart': 'grid',
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
// backdrop pattern (see TEMPLATE_PATTERNS); User journey and the Prioritization matrix
// additionally soften the canvas opacity so the pattern recedes behind
// the stage row / the items. Layered templates (docs/specs/006-document/layers.md)
// also carry their `Tab.layers` here, matching the `layerId`s their
// builder pre-stamps, so every application path lands scaffold and
// layers in one commit.
export function templateCanvasOverrides(kind: TemplateKind): Partial<Tab> {
  const overrides: Partial<Tab> = {};
  const pattern = TEMPLATE_PATTERNS[kind];
  if (pattern) overrides.backgroundPattern = pattern;
  // The pattern recedes behind the content: a template is read, so its
  // backdrop should organise the page rather than compete with it. The
  // louder the pattern, the further it steps back (TEMPLATE_PATTERN_OPACITY);
  // a few radial / stage layouts soften further still, and the lower of the
  // two wins.
  const quiet = pattern ? TEMPLATE_PATTERN_OPACITY[pattern] : undefined;
  const soft = kind === 'journey' || kind === 'prioritization-matrix' ? 0.8 : undefined;
  const opacity = Math.min(quiet ?? 1, soft ?? 1);
  if (opacity < 1) overrides.backgroundOpacity = opacity;
  const layers = templateLayers(kind);
  if (layers) overrides.layers = layers;
  // A template's mode (docs/specs/007-editor/templates-by-mode.md): every template opens in Workshop.
  overrides.opensIn = templateEditorMode(kind);
  return overrides;
}
