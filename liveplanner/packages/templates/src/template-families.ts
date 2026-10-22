// The template family each template belongs to (docs/specs/013-workspace/default-folders.md
// "Creation intent"): the one map that routes a new retrospective or Kanban board to its default
// folder. A family is a set of ordinary diagram templates, never a tab kind. A Record over
// TemplateKind, so a new template kind does not compile until it is mapped.

import type { TemplateFamily } from '@liveplanner/api-schema';
import type { TemplateKind } from './templates';

const TEMPLATE_FAMILY: Record<TemplateKind, TemplateFamily | null> = {
  blank: null,
  kanban: 'kanban',
  // Plan templates (docs/specs/026-plan/plan-templates.md): the Project Planner runs its sprints on a
  // Kanban board by another name, the Team Retro is a retrospective; the rest belong to no family.
  'blank-plan': null,
  'blank-spreadsheet': null,
  'project-planner': 'kanban',
  'bug-triage': null,
  'team-retro': 'retrospective',
  'weekly-planner': null,
  'content-calendar': null,
  'hiring-pipeline': null,
  okrs: null,
  'product-launch': null,
  'feedback-board': null,
  'budget-planner': null,
  timesheet: null,
  'contact-list': null,
  'task-tracker': null,
  invoice: null,
  'expense-report': null,
  'loan-calculator': null,
  'sales-pipeline': null,
  inventory: null,
  'guest-list': null,
  'grade-book': null,
  'habit-tracker': null,
  'blank-form': null,
  'bug-report-form': null,
  'feedback-form': null,
  'feature-request-form': null,
  'rsvp-form': null,
  'job-application-form': null,
  'contact-form': null,
};

/** The family a document made from this template belongs to; null for no template or no family. */
export function templateFamilyOf(kind: TemplateKind | null): TemplateFamily | null {
  return kind === null ? null : TEMPLATE_FAMILY[kind];
}
