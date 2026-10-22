// Plan's templates (docs/specs/026-plan/plan-templates.md): the boards, Sheets and forms Start Planning, /new and the
// Explorer offer to start from. The catalogue's one other template, Blank, is an empty tab an agent makes by name.
import type { TemplateKind } from './templates';

const PLAN_TEMPLATES: ReadonlySet<TemplateKind> = new Set<TemplateKind>([
  'blank-plan',
  'blank-spreadsheet',
  'kanban',
  'project-planner',
  'bug-triage',
  'team-retro',
  'weekly-planner',
  'content-calendar',
  'hiring-pipeline',
  'okrs',
  'product-launch',
  'feedback-board',
  'budget-planner',
  'timesheet',
  'contact-list',
  'task-tracker',
  'invoice',
  'expense-report',
  'loan-calculator',
  'sales-pipeline',
  'inventory',
  'guest-list',
  'grade-book',
  'habit-tracker',
  // A form is started on a Plan tab (form-templates.ts).
  'blank-form',
  'bug-report-form',
  'feedback-form',
  'feature-request-form',
  'rsvp-form',
  'job-application-form',
  'contact-form',
]);

/** True for a template Plan offers to start from. */
export function isPlanTemplate(kind: TemplateKind): boolean {
  return PLAN_TEMPLATES.has(kind);
}

// The blanks (docs/specs/026-plan/plan-templates.md "The blanks"), in the order the landing page's Blank Slate lists
// them: Blank Plan first, beside it Blank Spreadsheet (an empty Sheet) and Blank Form; the catalogue's other blanks
// after.
export const BLANK_TEMPLATES: readonly TemplateKind[] = [
  'blank-plan',
  'blank-spreadsheet',
  'blank-form',
  'blank',
];

/** True for the blanks. Quick-picks on Popular, never on a category shelf or tile. */
export function isBlankTemplate(kind: TemplateKind): boolean {
  return BLANK_TEMPLATES.includes(kind);
}
