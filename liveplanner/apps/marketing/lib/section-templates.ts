import { TEMPLATES, type TemplateKind } from '@liveplanner/templates';
import { toGallery, type GalleryTemplate } from '@/lib/template-gallery';

// Each category page's "Start from a template" band (docs/specs/019-marketing/marketing-site.md "Feature
// category pages"): the templates most worth starting from once you have read about the feature, best
// first, so a visitor can dive straight into one. A hand-picked list per `LANDING_SECTIONS` id, never
// more than SECTION_TEMPLATES_MAX (three rows of three); a category with fewer good fits lists fewer
// rather than padding, and one with none shows no band. section-templates.test.ts holds every list to a
// category and every kind to a listed template.

export const SECTION_TEMPLATES_MAX = 9;

export const SECTION_TEMPLATE_KINDS: Readonly<Record<string, readonly TemplateKind[]>> = {
  boards: [
    'kanban',
    'project-planner',
    'sales-crm',
    'bug-triage',
    'help-desk',
    'hiring-pipeline',
    'event-planner',
    'content-calendar',
    'blank-plan',
  ],
  // Each of these opens with a Dashboard tab of its own (template-builders-plan.ts).
  dashboards: [
    'product-launch',
    'project-planner',
    'sales-crm',
    'okrs',
    'bug-triage',
    'kanban',
    'hiring-pipeline',
    'weekly-planner',
    'content-calendar',
  ],
  sheets: [
    'budget-planner',
    'invoice',
    'expense-report',
    'task-tracker',
    'loan-calculator',
    'timesheet',
    'sales-pipeline',
    'inventory',
    'habit-tracker',
  ],
  forms: [
    'contact-form',
    'feedback-form',
    'rsvp-form',
    'bug-report-form',
    'feature-request-form',
    'job-application-form',
    'blank-form',
  ],
  collaboration: [
    'team-retro',
    'meeting-agenda',
    'feedback-board',
    'event-planner',
    'product-launch',
    'project-planner',
    'weekly-planner',
    'okrs',
  ],
};

const BY_KIND = new Map(TEMPLATES.map((t) => [t.kind, t]));

// The category's templates in its order, skipping any kind the catalogue hides or no longer has
// (the test fails on those first), capped at SECTION_TEMPLATES_MAX.
export function sectionTemplates(sectionId: string): GalleryTemplate[] {
  return (SECTION_TEMPLATE_KINDS[sectionId] ?? [])
    .flatMap((kind) => {
      const t = BY_KIND.get(kind);
      return t && !t.hidden ? [toGallery(t)] : [];
    })
    .slice(0, SECTION_TEMPLATES_MAX);
}
