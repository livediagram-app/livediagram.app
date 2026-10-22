// The Popular shelf (docs/specs/008-canvas/canvas-and-palette.md "Template categories", docs/specs/007-editor/
// templates-by-mode.md "The mode filter"): where most people start, a short curated list per mode filter, each
// opening with its blank(s). Shared by the editor's template step and the marketing gallery, so the two shelves can
// never disagree.
import type { EditorMode } from '@liveplanner/document';
import { TEMPLATES, type TemplateKind } from './templates';

type PopularChoice = 'all' | EditorMode;

export const POPULAR_BY_MODE: Readonly<Partial<Record<PopularChoice, readonly TemplateKind[]>>> = {
  // The blanks lead, one per mode in mode order (EDITOR_MODES), so the picker needs no separate blank card.
  all: [
    'blank',
    'whiteboard',
    'blank-session',
    'blank-plan',
    'mindmap',
    'flowchart',
    'kanban',
    'sailboat',
    'budget-planner',
    'orgchart',
    'sketchnote',
  ],
  diagram: [
    'blank',
    'flowchart',
    'mindmap',
    'orgchart',
    'gantt',
    'timeline',
    'system-architecture',
  ],
  draw: [
    'whiteboard',
    'sketchnote',
    'journey-doodle',
    'comic-strip',
    'idea-garden',
    'rich-picture',
  ],
  plan: [
    'blank-plan',
    'project-planner',
    'kanban',
    'budget-planner',
    'team-retro',
    'bug-triage',
    'invoice',
  ],
  workshop: [
    'blank-session',
    'sailboat',
    'retrospective',
    'town-hall',
    'lean-coffee',
    'crazy-eights',
    'pub-quiz',
  ],
};

// Popular under Everything (the marketing gallery's and the step's default shelf).
export const POPULAR_TEMPLATE_KINDS: readonly TemplateKind[] = POPULAR_BY_MODE.all ?? [];

// The fewest cards any mode's Popular holds (popular.test.ts pins every list to it).
export const POPULAR_PER_MODE = 5;

const LISTED = new Set(TEMPLATES.filter((t) => !t.hidden).map((t) => t.kind));

/** Popular for a mode filter: its curated list, hidden templates left out. */
export function popularKindsFor(choice: PopularChoice): TemplateKind[] {
  return (POPULAR_BY_MODE[choice] ?? []).filter((k) => LISTED.has(k));
}
