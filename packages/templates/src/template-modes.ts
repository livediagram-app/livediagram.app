// The editor mode each template opens in (docs/specs/007-editor/templates-by-mode.md "A template's
// mode"): declared once here, read by the template step (its mode filter and the glyph on every
// card) and by templateCanvasOverrides (the tab's `opensIn`), so the two can never disagree.
import type { EditorMode } from '@livediagram/document';
import type { TemplateKind } from './templates';

// Every template not named here is a Diagram template.
const TEMPLATE_MODES: Partial<Record<TemplateKind, EditorMode>> = {
  whiteboard: 'draw',
  sketchnote: 'draw',
  'rich-picture': 'draw',
  'comic-strip': 'draw',
  'doodle-warmup': 'draw',
  'paper-prototype': 'draw',
  'journey-doodle': 'draw',
  'pre-mortem': 'draw',
  'idea-garden': 'draw',
  'blank-illustration': 'illustrate',
  'blank-slide-deck': 'illustrate',
  'blank-article': 'illustrate',
  'blank-infographic': 'illustrate',
  'blank-logo': 'illustrate',
  article: 'illustrate',
  'slide-deck': 'illustrate',
  'logo-design': 'illustrate',
  'live-card': 'illustrate',
  'event-poster': 'illustrate',
  'year-in-review': 'illustrate',
  resume: 'illustrate',
  'recipe-card': 'illustrate',
  'data-story': 'illustrate',
  'how-it-works': 'illustrate',
  versus: 'illustrate',
  'social-carousel': 'illustrate',
  'launch-keynote': 'illustrate',
  'quarterly-review': 'illustrate',
  'team-welcome': 'illustrate',
  'workshop-kickoff': 'illustrate',
  // Design templates (template-design-pages.ts): drawn on a page sized for what each is.
  'floor-plan': 'illustrate',
  storyboard: 'illustrate',
  'browser-wireframe': 'illustrate',
  'laptop-wireframe': 'illustrate',
  'mobile-wireframe': 'illustrate',
  // Plan templates (docs/specs/026-plan/plan-templates.md).
  'blank-plan': 'plan',
  'blank-spreadsheet': 'plan',
  kanban: 'plan',
  'project-planner': 'plan',
  'bug-triage': 'plan',
  'team-retro': 'plan',
  'weekly-planner': 'plan',
  'content-calendar': 'plan',
  'hiring-pipeline': 'plan',
  okrs: 'plan',
  'product-launch': 'plan',
  'feedback-board': 'plan',
  'budget-planner': 'plan',
  timesheet: 'plan',
  'contact-list': 'plan',
  'task-tracker': 'plan',
  invoice: 'plan',
  'expense-report': 'plan',
  'loan-calculator': 'plan',
  'sales-pipeline': 'plan',
  inventory: 'plan',
  'guest-list': 'plan',
  'grade-book': 'plan',
  'habit-tracker': 'plan',
  // Session formats (docs/specs/012-collaboration/facilitate-mode.md "Templates"): run with the room,
  // so they open where the Collaborate kit and the Session strip are.
  'blank-session': 'facilitate',
  retrospective: 'facilitate',
  'start-stop-continue': 'facilitate',
  'mad-sad-glad': 'facilitate',
  'four-ls': 'facilitate',
  sailboat: 'facilitate',
  'town-hall': 'facilitate',
  'lean-coffee': 'facilitate',
  'crazy-eights': 'facilitate',
  'meeting-agenda': 'facilitate',
  // Boards that ship a dot vote: only Facilitate's Session strip can watch, end and keep a vote.
  'affinity-map': 'facilitate',
  'prioritization-matrix': 'facilitate',
  'risk-matrix': 'facilitate',
  // Boards a team fills in together in a session, rather than a diagram one person draws.
  'incident-postmortem': 'facilitate',
  'objectives-planner': 'facilitate',
  roadmap: 'facilitate',
  'raci-matrix': 'facilitate',
  'user-story-map': 'facilitate',
  'business-model-canvas': 'facilitate',
  'stakeholder-map': 'facilitate',
  'opportunity-solution-tree': 'facilitate',
  'user-persona': 'facilitate',
};

/** The mode a template's tab opens in. */
export function templateEditorMode(kind: TemplateKind): EditorMode {
  return TEMPLATE_MODES[kind] ?? 'diagram';
}

/** Each mode's blank (docs/specs/007-editor/templates-by-mode.md "Five blanks"). */
export const BLANK_TEMPLATE_FOR_MODE: Readonly<Record<EditorMode, TemplateKind>> = {
  diagram: 'blank',
  draw: 'whiteboard',
  illustrate: 'blank-illustration',
  plan: 'blank-plan',
  facilitate: 'blank-session',
};

// The blanks beyond each mode's own (docs/specs/007-editor/templates-by-mode.md "The blanks"): Blank Spreadsheet, an
// empty Sheet, beside Blank Plan; the blanks of a page kind ("Blanks of a page kind"), one empty page of a chosen kind,
// beside Blank Illustration, in the order the landing page's Blank Slate lists them.
export const EXTRA_BLANK_TEMPLATES: readonly TemplateKind[] = [
  'blank-slide-deck',
  'blank-article',
  'blank-infographic',
  'blank-logo',
  'blank-spreadsheet',
];

/** True for the blanks: each mode's, Blank Spreadsheet and the blanks of a page kind. Quick-picks on Popular, never on a category shelf or tile. */
export function isBlankTemplate(kind: TemplateKind): boolean {
  return (
    Object.values(BLANK_TEMPLATE_FOR_MODE).includes(kind) || EXTRA_BLANK_TEMPLATES.includes(kind)
  );
}
