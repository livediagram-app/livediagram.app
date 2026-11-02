import { TEMPLATES, type TemplateKind } from '@livehuddle/templates';
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
