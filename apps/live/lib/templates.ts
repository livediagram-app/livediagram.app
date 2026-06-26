import type { BackgroundPattern, Tab } from '@livediagram/diagram';

export type TemplateKind =
  | 'blank'
  | 'mindmap'
  // Mind-map variants (spec/09): the radial 'mindmap' plus a left-to-right
  // tree and a central bubble map, grouped under the Mind maps category.
  | 'mindmap-tree'
  | 'mindmap-bubble'
  | 'orgchart'
  | 'retrospective'
  | 'flowchart'
  // Flowchart variants (spec/09): cross-functional lanes, branching decision
  // tree, an approval loop, and a data-flow diagram. Grouped under Flowcharts.
  | 'swimlane'
  | 'decision-tree'
  | 'approval-workflow'
  | 'data-flow'
  | 'kanban'
  | 'swot'
  | 'timeline'
  | 'venn'
  | 'journey'
  | 'fishbone'
  | 'pyramid'
  // UI wireframes (use the device-frame shapes added in spec/09's
  // Devices accordion). Sit under "Show more" because they're
  // situational starters for design / product work.
  | 'mobile-wireframe'
  | 'laptop-wireframe'
  | 'slide-deck'
  // A growth / momentum flywheel: hub + four sectors with a clockwise
  // arrow loop. Sits under "Show more" alongside the other strategy /
  // wireframing starters.
  | 'flywheel'
  // Logo-design lockup sheet: one canvas with all four common
  // wordmark compositions side by side (icon-left / icon-above,
  // each with and without a tagline) so a designer can pick the
  // composition that fits, delete the rest, and iterate.
  | 'logo-design'
  // Gantt chart: a month header row plus six cascading milestone rows
  // (label + full-width track + coloured duration bar). A project-
  // planning starter; sits under "Show more".
  | 'gantt'
  // Live card: a compact event / status card lockup. Sits under
  // "Show more".
  | 'live-card'
  // Comparison table: a plan-comparison grid (the table element).
  | 'comparison-table'
  // Technical / developer-diagram starters (spec/09 "Templates"). They
  // reuse the existing shape vocabulary — cylinders for datastores, the
  // table element for entities, dashed arrows for lifelines / returns —
  // so a dev audience has a first-class starting point. All sit under
  // "Show more".
  | 'system-architecture'
  | 'er-diagram'
  | 'sequence-diagram'
  // Impact / Effort prioritisation chart: crossed value / effort axes
  // with items scattered across the field to drag into the right
  // quadrant. A product / planning starter.
  | 'prioritization-matrix';

export type TemplateDescriptor = {
  kind: TemplateKind;
  title: string;
  description: string;
  // True for templates that sit behind the picker's "Show more"
  // toggle. Default templates render in the first batch; extras
  // unlock on click so the grid stays compact for first-time users.
  extra?: boolean;
};

export const TEMPLATES: TemplateDescriptor[] = [
  {
    kind: 'blank',
    title: 'Blank diagram',
    description: 'An empty canvas to start with whatever you like.',
  },
  {
    kind: 'mindmap',
    title: 'Mind map',
    description: 'A central idea with branching topics radiating around it.',
  },
  {
    kind: 'mindmap-tree',
    title: 'Tree mind map',
    description: 'A left-to-right hierarchy: root, branches and their sub-topics.',
  },
  {
    kind: 'mindmap-bubble',
    title: 'Bubble map',
    description: 'A central topic ringed by descriptive bubbles.',
  },
  {
    kind: 'orgchart',
    title: 'Org chart',
    description: 'A simple hierarchy: leader with direct reports.',
  },
  {
    kind: 'retrospective',
    title: 'Retrospective',
    description: '"What went well", "What didn\'t", "Action items".',
  },
  {
    kind: 'flowchart',
    title: 'Flowchart',
    description: 'Start → step → decision → end, with a branching path.',
  },
  {
    kind: 'swimlane',
    title: 'Swimlane flowchart',
    description: 'A cross-functional process split across role lanes.',
    extra: true,
  },
  {
    kind: 'decision-tree',
    title: 'Decision tree',
    description: 'A question branching yes / no into cascading outcomes.',
    extra: true,
  },
  {
    kind: 'approval-workflow',
    title: 'Approval workflow',
    description: 'Submit → review → approve, with a reject loop back.',
    extra: true,
  },
  {
    kind: 'data-flow',
    title: 'Data flow diagram',
    description: 'Entities, processes and data stores wired by data flows.',
    extra: true,
  },
  {
    kind: 'kanban',
    title: 'Kanban',
    description: 'Five lanes from Backlog to Done, with ticket cards and priority chips.',
  },
  {
    kind: 'swot',
    title: 'SWOT',
    description: 'Spacious 2×2 with a role icon and bullet starters in each quadrant.',
  },
  {
    kind: 'timeline',
    title: 'Timeline',
    description: 'Horizontal line with milestone markers, above + below.',
  },
  {
    kind: 'venn',
    title: 'Venn diagram',
    description: 'Three overlapping sets with shared and exclusive labels.',
    extra: true,
  },
  {
    kind: 'journey',
    title: 'User journey',
    description: 'Stages a user moves through, with feeling notes below each.',
    extra: true,
  },
  {
    kind: 'fishbone',
    title: 'Fishbone',
    description: 'Cause-and-effect spine with four contributing categories.',
    extra: true,
  },
  {
    kind: 'pyramid',
    title: 'Pyramid',
    description: 'Four stacked tiers: foundation at the bottom, peak on top.',
    extra: true,
  },
  {
    kind: 'mobile-wireframe',
    title: 'Mobile wireframe',
    description: 'Three phone screens side by side: a user-flow starter for mobile UI work.',
    extra: true,
  },
  {
    kind: 'laptop-wireframe',
    title: 'Laptop wireframe',
    description:
      'A laptop frame with header, sidebar and content placeholders for desktop UI work.',
    extra: true,
  },
  {
    kind: 'slide-deck',
    title: 'Slide deck',
    description: 'Four blank slides in a 2 by 2 grid, like a short PowerPoint outline.',
    extra: true,
  },
  {
    kind: 'flywheel',
    title: 'Flywheel',
    description:
      'A central momentum hub with four reinforcing stages and a clockwise loop of arrows.',
    extra: true,
  },
  {
    kind: 'logo-design',
    title: 'Logo design',
    description:
      'Four wordmark lockups on one canvas (icon-left / icon-above, each with and without a tagline). Pick a composition, delete the rest, replace the placeholder icons with your own.',
    extra: true,
  },
  {
    kind: 'gantt',
    title: 'Gantt chart',
    description:
      'A month header with six cascading milestone rows: labels, tracks and coloured duration bars for project planning.',
    extra: true,
  },
  {
    kind: 'live-card',
    title: 'Live card',
    description: 'A compact event / status card lockup you can drop in and rename.',
    extra: true,
  },
  {
    kind: 'comparison-table',
    title: 'Comparison table',
    description: 'A plan-comparison grid with header row + column and zebra striping.',
    extra: true,
  },
  {
    kind: 'system-architecture',
    title: 'System architecture',
    description:
      'A request path through a small service topology: client → API gateway → services → database + cache.',
    extra: true,
  },
  {
    kind: 'er-diagram',
    title: 'Database schema',
    description:
      'Entity-relationship (ER) diagram: four tables (Users / Orders / Products / OrderItems) wired by relationships.',
    extra: true,
  },
  {
    kind: 'sequence-diagram',
    title: 'Sequence diagram',
    description:
      'Participant lifelines with request / response messages stepping down a login flow.',
    extra: true,
  },
  {
    kind: 'prioritization-matrix',
    title: 'Prioritization matrix',
    description: 'Value vs Effort chart with crossed axes and items to scatter into quadrants.',
    extra: true,
  },
];

// Picker grouping. Templates are organised into a handful of
// categories so the picker reads as titled sections (Diagrams /
// Planning / Design / Technical) instead of one long flat grid. The
// mapping lives beside the catalogue (mirroring TEMPLATE_PATTERNS) so a
// new template slots into a section with a one-line edit; the picker
// renders sections in TEMPLATE_CATEGORIES order and skips empties.
export type TemplateCategory =
  | 'mindmaps'
  | 'flowcharts'
  | 'hierarchies'
  | 'planning'
  | 'project-management'
  | 'strategy'
  | 'design'
  | 'technical';

// Category descriptions are kept to a similar length (~40-46 chars) so the
// overview cards read as a tidy, even set rather than ragged.
export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string; description: string }[] = [
  {
    id: 'mindmaps',
    label: 'Mind maps',
    description: 'Radial, tree and bubble brainstorming maps.',
  },
  {
    id: 'flowcharts',
    label: 'Flowcharts',
    description: 'Step-by-step process and decision flows.',
  },
  {
    id: 'hierarchies',
    label: 'Hierarchies',
    description: 'Org charts, pyramids and cause-effect maps.',
  },
  {
    // id stays 'planning' (nothing saved references it; label is the
    // user-facing name) — Agile artefacts: boards, retros, prioritisation.
    id: 'planning',
    label: 'Agile',
    description: 'Boards, retrospectives and prioritisation.',
  },
  {
    id: 'project-management',
    label: 'Project Management',
    description: 'Timelines, Gantt charts and roadmaps.',
  },
  {
    id: 'strategy',
    label: 'Strategy',
    description: 'Analysis frameworks, decisions and Venn sets.',
  },
  {
    id: 'design',
    label: 'Design',
    description: 'Wireframes, slide decks and visual mock-ups.',
  },
  {
    id: 'technical',
    label: 'Technical',
    description: 'Architecture, schema and sequence diagrams.',
  },
];

const TEMPLATE_CATEGORY: Record<TemplateKind, TemplateCategory> = {
  // Mind maps: radial / tree / bubble brainstorming layouts.
  mindmap: 'mindmaps',
  'mindmap-tree': 'mindmaps',
  'mindmap-bubble': 'mindmaps',
  // Flowcharts: process + decision flows. Blank lives here too (it's shown as
  // a separate quick-pick in the picker, never inside a category grid).
  blank: 'flowcharts',
  flowchart: 'flowcharts',
  swimlane: 'flowcharts',
  'decision-tree': 'flowcharts',
  'approval-workflow': 'flowcharts',
  'data-flow': 'flowcharts',
  // Hierarchies: top-down structure + cause-effect.
  orgchart: 'hierarchies',
  pyramid: 'hierarchies',
  fishbone: 'hierarchies',
  // Planning: agile boards, retrospectives, prioritisation.
  kanban: 'planning',
  retrospective: 'planning',
  'prioritization-matrix': 'planning',
  // Project Management: time-ordered schedules + roadmaps.
  gantt: 'project-management',
  timeline: 'project-management',
  // Strategy: business / product analysis, decision frameworks + set
  // relationships (Venn).
  swot: 'strategy',
  flywheel: 'strategy',
  journey: 'strategy',
  'comparison-table': 'strategy',
  venn: 'strategy',
  // Design: wireframes, slides + visual mock-ups.
  'mobile-wireframe': 'design',
  'laptop-wireframe': 'design',
  'slide-deck': 'design',
  'logo-design': 'design',
  'live-card': 'design',
  // Technical / developer diagrams.
  'system-architecture': 'technical',
  'er-diagram': 'technical',
  'sequence-diagram': 'technical',
};

export function templateCategory(kind: TemplateKind): TemplateCategory {
  return TEMPLATE_CATEGORY[kind];
}

// Title-case each word, only ever upper-casing the leading letter so existing
// caps survive (acronyms like ER / UML / SWOT stay intact).
function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Default name for a freshly-created diagram: "Untitled <Template Title>" in
// title case so a templated diagram is recognisable in the Explorer (e.g.
// "Untitled Tree Mind Map"), while a blank one (or no template) keeps the plain
// "Untitled diagram".
export function untitledNameForTemplate(kind: TemplateKind | null): string {
  if (!kind || kind === 'blank') return 'Untitled diagram';
  const title = TEMPLATES.find((t) => t.kind === kind)?.title;
  return title ? `Untitled ${titleCase(title)}` : 'Untitled diagram';
}

// The canvas backdrop pattern that best suits each template's layout.
// Applied on top of the chosen theme (which only supplies the colours),
// so a starter ships with a fitting canvas instead of inheriting the
// theme's default dot grid:
//   - graph paper for alignment-heavy scaffolds (flow / org / SWOT /
//     Gantt / kanban / wireframes) where boxes snap to a square grid,
//   - a blank canvas for clean radial layouts (Venn, flywheel,
//     pyramid) where the shapes should carry the page,
//   - a crosshatch backdrop for the slide deck, so the slide frames
//     read as cards lifted off a textured surface,
//   - a checkerboard "design board" for the logo lockup sheet,
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
  kanban: 'graph',
  'mobile-wireframe': 'graph',
  'laptop-wireframe': 'graph',
  venn: 'blank',
  flywheel: 'blank',
  pyramid: 'blank',
  'slide-deck': 'crosshatch',
  'logo-design': 'checkerboard',
  timeline: 'lines',
  journey: 'lines',
  retrospective: 'grid',
  fishbone: 'grid',
  'live-card': 'grid',
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
};

// Canvas-level overrides a specific template ships with, applied on top
// of whatever theme is selected. Each template carries its preferred
// backdrop pattern (see TEMPLATE_PATTERNS); Mind map and User journey
// additionally soften the canvas opacity so the pattern recedes behind
// the radiating branches / the stage row.
export function templateCanvasOverrides(kind: TemplateKind): Partial<Tab> {
  const overrides: Partial<Tab> = {};
  const pattern = TEMPLATE_PATTERNS[kind];
  if (pattern) overrides.backgroundPattern = pattern;
  if (
    kind === 'mindmap' ||
    kind === 'mindmap-tree' ||
    kind === 'journey' ||
    kind === 'prioritization-matrix'
  )
    overrides.backgroundOpacity = 0.8;
  return overrides;
}
