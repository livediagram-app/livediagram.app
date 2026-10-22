// The Popular shelf (docs/specs/008-canvas/canvas-and-palette.md "Template categories"): where most people start, a
// short curated list of Plan's templates opening with Blank Plan. Shared by the Explorer's welcome and the marketing
// gallery, so the two can never disagree.
import { TEMPLATES, type TemplateKind } from './templates';

const LISTED = new Set(TEMPLATES.filter((t) => !t.hidden).map((t) => t.kind));

// Popular, hidden templates left out.
export const POPULAR_TEMPLATE_KINDS: readonly TemplateKind[] = (
  [
    'blank-plan',
    'project-planner',
    'kanban',
    'budget-planner',
    'team-retro',
    'bug-triage',
    'invoice',
  ] as const satisfies readonly TemplateKind[]
).filter((k) => LISTED.has(k));
