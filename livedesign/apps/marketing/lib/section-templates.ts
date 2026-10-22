import { TEMPLATES, type TemplateKind } from '@livepages/templates';
import { toGallery, type GalleryTemplate } from '@/lib/template-gallery';

// Each category page's "Start from a template" band (docs/specs/019-marketing/marketing-site.md "Feature
// category pages"): the templates most worth starting from once you have read about the feature, best
// first, so a visitor can dive straight into one. A hand-picked list per `LANDING_SECTIONS` id, never
// more than SECTION_TEMPLATES_MAX (three rows of three); a category with fewer good fits lists fewer
// rather than padding. section-templates.test.ts holds every id to a list and every kind to a listed
// template.

export const SECTION_TEMPLATES_MAX = 9;

export const SECTION_TEMPLATE_KINDS: Readonly<Record<string, readonly TemplateKind[]>> = {
  collaboration: [
    'retrospective',
    'brainstorm',
    'workshop-board',
    'meeting-agenda',
    'town-hall',
    'lean-coffee',
    'affinity-map',
    'crazy-eights',
    'virtual-office',
  ],
  diagrams: [
    'flowchart',
    'system-architecture',
    'mindmap',
    'orgchart',
    'sequence-diagram',
    'er-diagram',
    'swimlane',
    'cloud-architecture',
    'decision-tree',
  ],
  whiteboard: [
    'sketchnote',
    'idea-garden',
    'paper-prototype',
    'rich-picture',
    'journey-doodle',
    'pre-mortem',
    'comic-strip',
    'doodle-warmup',
    'whiteboard',
  ],
  infographics: [
    'data-story',
    'how-it-works',
    'event-poster',
    'versus',
    'social-carousel',
    'logo-design',
    'resume',
    'recipe-card',
    'live-card',
  ],
  slides: [
    'slide-deck',
    'launch-keynote',
    'quarterly-review',
    'team-welcome',
    'workshop-kickoff',
    'social-carousel',
    'blank-slide-deck',
  ],
  documents: ['article', 'working-backwards', 'year-in-review', 'blank-article'],
  plan: [
    'kanban',
    'project-planner',
    'bug-triage',
    'product-launch',
    'okrs',
    'hiring-pipeline',
    'content-calendar',
    'weekly-planner',
    'gantt',
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
