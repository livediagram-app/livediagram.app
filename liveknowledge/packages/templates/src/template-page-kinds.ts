// A template's page kind (docs/specs/007-editor/start-diagramming.md "Page type"): what the start screen's page type
// switch filters by.
import type { PageKind } from '@liveknowledge/document';
import type { TemplateKind } from './templates';

// Every listed template's page kind: the kind of the pages it opens on. Written out rather than worked out from the
// pages (templateCanvasOverrides builds them), so the start screen's filter never draws the builders into the
// editor's first load; template-page-kinds.test.ts checks each against the pages the template really makes.
const PAGE_KIND_OF: Readonly<Partial<Record<TemplateKind, PageKind>>> = {
  'blank-slide-deck': 'slide',
  'blank-article': 'article',
  'blank-infographic': 'infographic',
  'slide-deck': 'slide',
  'live-card': 'infographic',
  storyboard: 'infographic',
  'floor-plan': 'infographic',
  'working-backwards': 'article',
  article: 'article',
  'event-poster': 'infographic',
  'year-in-review': 'infographic',
  resume: 'infographic',
  'recipe-card': 'infographic',
  'data-story': 'infographic',
  'how-it-works': 'infographic',
  versus: 'infographic',
  'social-carousel': 'infographic',
  'launch-keynote': 'slide',
  'quarterly-review': 'slide',
  'team-welcome': 'slide',
  'workshop-kickoff': 'slide',
  'meeting-notes': 'article',
  'lesson-plan': 'article',
  'business-proposal': 'article',
  'design-doc': 'article',
  'status-report': 'article',
  'cover-letter': 'article',
  'class-lesson': 'slide',
  'product-one-pager': 'article',
  'research-report': 'article',
  newsletter: 'article',
  'case-study': 'article',
  'onboarding-handbook': 'article',
  'board-update': 'slide',
};

/** The kind of page a template opens on, or null for one that makes no page of its own (Blank Tab, the blank). */
export function templatePageKind(kind: TemplateKind): PageKind | null {
  return PAGE_KIND_OF[kind] ?? null;
}
