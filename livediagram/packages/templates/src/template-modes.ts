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
  // A form is started on a Plan tab (form-templates.ts).
  'blank-form': 'plan',
  'bug-report-form': 'plan',
  'feedback-form': 'plan',
  'feature-request-form': 'plan',
  'rsvp-form': 'plan',
  'job-application-form': 'plan',
  'contact-form': 'plan',
  // Session formats (docs/specs/012-collaboration/workshop-mode.md "Templates"): run with the room,
  // so they open where the Collaborate kit and the Session strip are.
  'blank-session': 'workshop',
  retrospective: 'workshop',
  'start-stop-continue': 'workshop',
  'mad-sad-glad': 'workshop',
  'four-ls': 'workshop',
  sailboat: 'workshop',
  'town-hall': 'workshop',
  'lean-coffee': 'workshop',
  brainstorm: 'workshop',
  'workshop-board': 'workshop',
  'crazy-eights': 'workshop',
  'meeting-agenda': 'workshop',
  // Quizzes & Games (docs/specs/012-collaboration/quiz-and-game-templates.md): run on quiz cards, pickers and polls.
  'pub-quiz': 'workshop',
  'icebreaker-questions': 'workshop',
  'virtual-office': 'workshop',
  'coworking-space': 'workshop',
  'team-pod': 'workshop',
  'all-hands-hall': 'workshop',
  'two-truths-and-a-lie': 'workshop',
  'would-you-rather': 'workshop',
  'people-bingo': 'workshop',
  // Boards that ship a dot vote: only Workshop's Session strip can watch, end and keep a vote.
  'affinity-map': 'workshop',
  'prioritization-matrix': 'workshop',
  'risk-matrix': 'workshop',
  // Boards a team fills in together in a session, rather than a diagram one person draws.
  'incident-postmortem': 'workshop',
  'objectives-planner': 'workshop',
  roadmap: 'workshop',
  'raci-matrix': 'workshop',
  'user-story-map': 'workshop',
  'business-model-canvas': 'workshop',
  'stakeholder-map': 'workshop',
  'value-proposition-canvas': 'workshop',
  'opportunity-solution-tree': 'workshop',
  'user-persona': 'workshop',
  // Sticky-note boards a group fills in together (docs/specs/007-editor/templates-by-mode.md "A template's mode"):
  // a note per voice is the room's work, not a diagram one person draws.
  swot: 'workshop',
  'empathy-map': 'workshop',
  journey: 'workshop',
};

/** The mode a template's tab opens in. */
export function templateEditorMode(kind: TemplateKind): EditorMode {
  return TEMPLATE_MODES[kind] ?? 'diagram';
}

/** Each mode's blank (docs/specs/007-editor/templates-by-mode.md "Five blanks"). */
export const BLANK_TEMPLATE_FOR_MODE: Readonly<Record<EditorMode, TemplateKind>> = {
  diagram: 'blank',
  draw: 'whiteboard',
  plan: 'blank-plan',
  workshop: 'blank-session',
};

// The blanks beyond each mode's own (docs/specs/007-editor/templates-by-mode.md "The blanks"): Blank Spreadsheet, an
// empty Sheet, and Blank Form beside Blank Plan, in the order the landing page's Blank Slate lists them.
export const EXTRA_BLANK_TEMPLATES: readonly TemplateKind[] = ['blank-spreadsheet', 'blank-form'];

/** True for the blanks: each mode's, Blank Spreadsheet and Blank Form. Quick-picks on Popular, never on a category shelf or tile. */
export function isBlankTemplate(kind: TemplateKind): boolean {
  return (
    Object.values(BLANK_TEMPLATE_FOR_MODE).includes(kind) || EXTRA_BLANK_TEMPLATES.includes(kind)
  );
}
