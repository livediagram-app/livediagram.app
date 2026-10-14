// The tab-level settings a template ships with (templateCanvasOverrides): its backdrop, layers, mode, pages and
// kind. Its own module, apart from the template catalogue in templates.ts: these read the template builders (a
// template's pages are built here), and the editor reads the catalogue (a template's title) on every load, which
// drew every builder into its first load while the two shared a module.
import {
  WHITEBOARD_DEFAULT_PATTERN,
  type BackgroundPattern,
  type Tab,
} from '@livediagram/document';
import { articleTemplateOverrides } from './article-template';
import { blankPageTemplateOverrides } from './blank-page-templates';
import { templateLayers } from './template-layers';
import { templateEditorMode } from './template-modes';
import { templatePages } from './template-pages';
import type { TemplateKind } from './templates';

// The canvas backdrop pattern that best suits each template's layout.
// Applied on top of the chosen theme (which only supplies the colours),
// so a starter ships with a fitting canvas instead of inheriting the
// theme's default dot grid:
//   - graph paper for alignment-heavy scaffolds (flow / org / SWOT /
//     Gantt / kanban / wireframes) where boxes snap to a square grid,
//   - a blank canvas for clean radial layouts (Venn, flywheel,
//     pyramid) where the shapes should carry the page,
//   - a crosshatch backdrop for the storyboard, so its scene frames
//     read as cards lifted off a textured surface,
//   - a blank surround for the templates that open on Illustrate pages
//     (Article, Slide deck, Logo design, Group card and the rest): the pages are the paper,
//   - horizontal rules for the time-ordered timeline / journey,
//   - the dot grid (explicit, so it survives even a blank-canvas theme)
//     for the sticky-note / freeform boards.
// Templates not listed here fall through to the theme's pattern.
const TEMPLATE_PATTERNS: Partial<Record<TemplateKind, BackgroundPattern>> = {
  flowchart: 'graph',
  swimlane: 'graph',
  'decision-tree': 'graph',
  'approval-workflow': 'graph',
  'data-flow': 'graph',
  orgchart: 'graph',
  swot: 'graph',
  gantt: 'graph',
  // Plan boards (docs/specs/026-plan/plan-mode.md) sit on the quiet dot grid: the board is the structure.
  kanban: 'grid',
  'blank-plan': 'grid',
  'blank-spreadsheet': 'grid',
  'project-planner': 'grid',
  'bug-triage': 'grid',
  'team-retro': 'grid',
  'weekly-planner': 'grid',
  'content-calendar': 'grid',
  'hiring-pipeline': 'grid',
  okrs: 'grid',
  'product-launch': 'grid',
  'feedback-board': 'grid',
  'budget-planner': 'grid',
  timesheet: 'grid',
  'contact-list': 'grid',
  'task-tracker': 'grid',
  invoice: 'grid',
  'expense-report': 'grid',
  'loan-calculator': 'grid',
  'sales-pipeline': 'grid',
  inventory: 'grid',
  'guest-list': 'grid',
  'grade-book': 'grid',
  'habit-tracker': 'grid',
  venn: 'blank',
  flywheel: 'blank',
  pyramid: 'blank',
  // The templates on pages keep a plain surround, like the Article: the pages are the paper.
  'slide-deck': 'blank',
  'logo-design': 'blank',
  timeline: 'lines',
  'milestone-timeline': 'lines',
  // The vertical variant reads best on a clean canvas: horizontal ruled
  // lines fight a downward spine.
  'milestone-timeline-vertical': 'blank',
  journey: 'lines',
  retrospective: 'grid',
  fishbone: 'grid',
  'live-card': 'blank',
  mindmap: 'grid',
  // Tree map rides the dot grid like the radial map; the bubble map is a
  // clean radial layout, so it gets a blank canvas like Venn / pyramid.
  'mindmap-tree': 'grid',
  'mindmap-bubble': 'blank',
  // Technical diagrams are alignment-heavy (boxes + tables snap to a
  // grid), so they ride graph paper like the flow / org / SWOT scaffolds.
  'system-architecture': 'graph',
  'er-diagram': 'graph',
  'sequence-diagram': 'graph',
  'prioritization-matrix': 'graph',
  // The later batch splits the same three ways: alignment-heavy scaffolds
  // ride graph paper, sticky-note workshop boards pin the dot grid, and
  // the funnel's clean stacked silhouette gets a blank canvas. The
  // storyboard rides crosshatch so its scene frames read as cards on a
  // textured board.
  roadmap: 'graph',
  'raci-matrix': 'graph',
  'business-model-canvas': 'graph',
  'okr-tree': 'graph',
  sitemap: 'graph',
  'cloud-architecture': 'graph',
  'uml-class': 'graph',
  'state-machine': 'graph',
  'user-story-map': 'grid',
  'affinity-map': 'grid',
  'lean-coffee': 'grid',
  brainstorm: 'grid',
  'workshop-board': 'grid',
  'town-hall': 'grid',
  // Event storming is a sticky-note workshop like the story / affinity
  // maps, so it pins the dot grid rather than riding the other technical
  // templates' graph paper.
  'event-storming': 'grid',
  'empathy-map': 'grid',
  funnel: 'blank',
  sankey: 'blank',
  // A new whiteboard starts on Grid (docs/specs/023-draw-mode/draw-mode.md "Board background").
  whiteboard: WHITEBOARD_DEFAULT_PATTERN,
  // The Draw templates start on the whiteboard's board too.
  sketchnote: WHITEBOARD_DEFAULT_PATTERN,
  'rich-picture': WHITEBOARD_DEFAULT_PATTERN,
  'comic-strip': WHITEBOARD_DEFAULT_PATTERN,
  'doodle-warmup': WHITEBOARD_DEFAULT_PATTERN,
  'paper-prototype': WHITEBOARD_DEFAULT_PATTERN,
  'journey-doodle': WHITEBOARD_DEFAULT_PATTERN,
  'pre-mortem': WHITEBOARD_DEFAULT_PATTERN,
  'idea-garden': WHITEBOARD_DEFAULT_PATTERN,
  // The twelve-starter batch follows the same split: the retro formats,
  // Crazy 8s, persona, agenda and objectives are sticky-note / workshop
  // boards on the dot grid, as is the postmortem (a dense written report,
  // where graph lines behind every card read as noise); the matrices and
  // tree ride graph paper;
  // the Sailboat's drawn scene gets a blank canvas like the flywheel.
  'start-stop-continue': 'grid',
  'mad-sad-glad': 'grid',
  'four-ls': 'grid',
  sailboat: 'blank',
  'incident-postmortem': 'grid',
  'opportunity-solution-tree': 'graph',
  'crazy-eights': 'grid',
  'stakeholder-map': 'graph',
  'risk-matrix': 'graph',
  'user-persona': 'grid',
  'meeting-agenda': 'grid',
  // An article's surround stays plain: the page is the paper.
  article: 'blank',
  // The other Illustrate templates: their pages are the paper.
  'blank-illustration': 'blank',
  'blank-slide-deck': 'blank',
  'blank-article': 'blank',
  'blank-infographic': 'blank',
  'blank-logo': 'blank',
  'event-poster': 'blank',
  'year-in-review': 'blank',
  resume: 'blank',
  'recipe-card': 'blank',
  'data-story': 'blank',
  'how-it-works': 'blank',
  versus: 'blank',
  'social-carousel': 'blank',
  'launch-keynote': 'blank',
  'quarterly-review': 'blank',
  'team-welcome': 'blank',
  'workshop-kickoff': 'blank',
  // A personal planning sheet, read closely like a page: even dots behind
  // its cards read as noise, so it gets a clean canvas.
  'objectives-planner': 'blank',
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
// backdrop pattern (see TEMPLATE_PATTERNS); Mind map and User journey
// additionally soften the canvas opacity so the pattern recedes behind
// the radiating branches / the stage row. Layered templates (docs/specs/006-document/layers.md)
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
  // A whiteboard draws its own quiet board pattern (docs/specs/023-draw-mode/draw-mode.md "Board
  // background"), so it never takes a template's dimming.
  const mode = templateEditorMode(kind);
  const quiet = pattern && mode !== 'draw' ? TEMPLATE_PATTERN_OPACITY[pattern] : undefined;
  const soft =
    kind === 'mindmap' ||
    kind === 'mindmap-tree' ||
    kind === 'journey' ||
    kind === 'prioritization-matrix'
      ? 0.8
      : undefined;
  const opacity = Math.min(quiet ?? 1, soft ?? 1);
  if (opacity < 1) overrides.backgroundOpacity = opacity;
  const layers = templateLayers(kind);
  if (layers) overrides.layers = layers;
  // A template can also declare what KIND of board it makes (docs/specs/021-event-storming/event-storming.md).
  // The kind, not a layer id, is what the editor reads to decide it is a
  // workshop board, so it must land on every application path: the picker,
  // /new, and the MCP worker all go through here.
  // A template's mode (docs/specs/007-editor/templates-by-mode.md): the Draw templates are general
  // tabs that OPEN in Draw mode (docs/specs/007-editor/editor-modes.md "Where the mode lives";
  // whiteboarding is no kind), the Illustrate ones open in Illustrate (their pages below).
  if (mode !== 'diagram') overrides.opensIn = mode;
  // The Article opens in Illustrate on its one article page (docs/specs/007-editor/article-pages.md).
  if (kind === 'article') Object.assign(overrides, articleTemplateOverrides());
  // A blank of a page kind opens in Illustrate on its one page, its kind already chosen (blank-page-templates.ts).
  const blankPage = blankPageTemplateOverrides(kind);
  if (blankPage) Object.assign(overrides, blankPage);
  // The Slide deck, Logo design and Group card open in Illustrate on their own pages
  // (canvas-and-palette.md "Templates on pages"); their builders place every element on them.
  const pages = templatePages(kind);
  if (pages) Object.assign(overrides, { opensIn: 'illustrate', pages });
  if (kind === 'event-storming') {
    overrides.kind = 'event-storming';
    // The seed note is built on a lane, so the board is born settled and the
    // one-time settle never runs on it (docs/specs/021-event-storming/event-storming.md "Always on a lane").
    overrides.esLanesSettled = true;
  }
  return overrides;
}
