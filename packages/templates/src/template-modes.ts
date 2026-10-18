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
  'blank-illustration': 'pages',
  'blank-slide-deck': 'pages',
  'blank-article': 'pages',
  'blank-infographic': 'pages',
  'blank-logo': 'pages',
  article: 'pages',
  'working-backwards': 'pages',
  'slide-deck': 'pages',
  'logo-design': 'pages',
  'live-card': 'pages',
  'event-poster': 'pages',
  'year-in-review': 'pages',
  resume: 'pages',
  'recipe-card': 'pages',
  'data-story': 'pages',
  'how-it-works': 'pages',
  versus: 'pages',
  'social-carousel': 'pages',
  'launch-keynote': 'pages',
  'quarterly-review': 'pages',
  'team-welcome': 'pages',
  'workshop-kickoff': 'pages',
  // Design templates (template-design-pages.ts): drawn on a page sized for what each is.
  'floor-plan': 'pages',
  storyboard: 'pages',
  'browser-wireframe': 'pages',
  'laptop-wireframe': 'pages',
  'mobile-wireframe': 'pages',
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
  brainstorm: 'facilitate',
  'workshop-board': 'facilitate',
  'crazy-eights': 'facilitate',
  'meeting-agenda': 'facilitate',
  // Quizzes & Games (docs/specs/012-collaboration/quiz-and-game-templates.md): run on quiz cards, pickers and polls.
  'pub-quiz': 'facilitate',
  'icebreaker-questions': 'facilitate',
  'virtual-office': 'facilitate',
  'coworking-space': 'facilitate',
  'team-pod': 'facilitate',
  'all-hands-hall': 'facilitate',
  'two-truths-and-a-lie': 'facilitate',
  'would-you-rather': 'facilitate',
  'people-bingo': 'facilitate',
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
  'value-proposition-canvas': 'facilitate',
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
  pages: 'blank-illustration',
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
  'blank-form',
];

/** True for the blanks: each mode's, Blank Spreadsheet and the blanks of a page kind. Quick-picks on Popular, never on a category shelf or tile. */
export function isBlankTemplate(kind: TemplateKind): boolean {
  return (
    Object.values(BLANK_TEMPLATE_FOR_MODE).includes(kind) || EXTRA_BLANK_TEMPLATES.includes(kind)
  );
}
