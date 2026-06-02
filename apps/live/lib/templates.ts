import type { Tab } from '@livediagram/diagram';

export type TemplateKind =
  | 'blank'
  | 'mindmap'
  | 'orgchart'
  | 'retrospective'
  | 'flowchart'
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
  | 'logo-design';

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
    description: 'A central idea with branching topics around it.',
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
    kind: 'kanban',
    title: 'Kanban',
    description: 'Five lanes from Backlog to Done, with ticket cards and priority chips.',
  },
  {
    kind: 'swot',
    title: 'SWOT',
    description: 'Spacious 2×2 with bullet starters in each quadrant and a centre subject.',
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
    description: 'Four stacked tiers — foundation at the bottom, peak on top.',
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
];

// Optional canvas-level overrides a specific template can request
// on top of whatever theme is applied — soft-edits to backdrop
// fields that ship with the template. Today only Mind map uses this
// (the radiating branches read better against a slightly softened
// canvas). Generalises if other templates want their own tuning.
export function templateCanvasOverrides(kind: TemplateKind): Partial<Tab> {
  if (kind === 'mindmap') return { backgroundOpacity: 0.8 };
  return {};
}
