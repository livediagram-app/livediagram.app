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
  'sprint-board',
  'client-onboarding',
  'editorial-pipeline',
  'trip-planner',
] as const;
export type PlanTemplateKind = (typeof PLAN_TEMPLATE_KINDS)[number];

export function isPlanTemplateKind(kind: string): kind is PlanTemplateKind {
  return (PLAN_TEMPLATE_KINDS as readonly string[]).includes(kind);
}

// The Plan templates that start with starter rules (docs/specs/026-plan/plan-templates.md "Starter rules"): every one
// with a board, as a rule acts on cards; a Sheet template and a blank plan have none. Asked when a plan is made, so the
// rules' builders (template-starter-rules.ts) load only for these.
export const STARTER_RULE_KINDS = [
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
  'event-planner',
  'sales-crm',
  'help-desk',
  'meeting-agenda',
  'personal-goals',
  'study-planner',
  'sprint-board',
  'client-onboarding',
  'editorial-pipeline',
  'trip-planner',
] as const satisfies readonly PlanTemplateKind[];
export type StarterRuleKind = (typeof STARTER_RULE_KINDS)[number];

export function hasStarterRules(kind: string): kind is StarterRuleKind {
  return (STARTER_RULE_KINDS as readonly string[]).includes(kind);
}
