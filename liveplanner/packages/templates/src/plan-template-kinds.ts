// The Plan templates' kinds (docs/specs/026-plan/plan-templates.md "The templates"), apart from the catalogue of
// their tabs: the editor asks whether a kind is a Plan template on every load, and this leaf keeps that question
// from carrying every template's boards, dashboards and forms (docs/specs/016-platform/web-performance.md). It
// imports nothing; plan-lazy-load.test.ts keeps it that way.

export const PLAN_TEMPLATE_KINDS = [
  'blank-plan',
  'blank-spreadsheet',
  'project-planner',
  'kanban',
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
  'event-planner',
  'sales-crm',
  'help-desk',
  'meeting-agenda',
  'personal-goals',
  'study-planner',
] as const;
export type PlanTemplateKind = (typeof PLAN_TEMPLATE_KINDS)[number];

export function isPlanTemplateKind(kind: string): kind is PlanTemplateKind {
  return (PLAN_TEMPLATE_KINDS as readonly string[]).includes(kind);
}
