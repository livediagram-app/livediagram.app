// A template's page kind (docs/specs/007-editor/start-diagramming.md "Page type"): what the start screen's page type
// switch filters by.
import type { PageKind } from '@livedesign/design';
import type { TemplateKind } from './templates';

// Every listed template's page kind: the kind of the pages it opens on. Written out rather than worked out from the
// pages (templateCanvasOverrides builds them), so the start screen's filter never draws the builders into the
// editor's first load; template-page-kinds.test.ts checks each against the pages the template really makes.
const PAGE_KIND_OF: Readonly<Partial<Record<TemplateKind, PageKind>>> = {
  'blank-logo': 'logo',
  'photo-edit': 'photo',
  'blank-wireframe-phone': 'wireframe',
  'blank-wireframe-tablet': 'wireframe',
  'blank-wireframe-browser': 'wireframe',
  'blank-wireframe-laptop': 'wireframe',
  'blank-wireframe-watch': 'wireframe',
  'logo-design': 'logo',
  'wireframe-mobile-app': 'wireframe',
  'wireframe-website': 'wireframe',
  'wireframe-dashboard': 'wireframe',
  'wireframe-tablet-app': 'wireframe',
  'wireframe-watch-app': 'wireframe',
  'logo-lockups': 'logo',
  'logo-wordmarks': 'logo',
  'logo-emblems': 'logo',
  'logo-marks': 'logo',
  'wireframe-social-app': 'wireframe',
  'wireframe-delivery-app': 'wireframe',
  'wireframe-travel-app': 'wireframe',
  'wireframe-ride-app': 'wireframe',
  'wireframe-music-app': 'wireframe',
  'wireframe-app-onboarding': 'wireframe',
  'wireframe-online-store': 'wireframe',
  'wireframe-blog': 'wireframe',
  'wireframe-company-site': 'wireframe',
  'wireframe-project-tool': 'wireframe',
  'wireframe-team-inbox': 'wireframe',
  'wireframe-video-app': 'wireframe',
  'wireframe-fitness-watch': 'wireframe',
  'wireframe-watch-music': 'wireframe',
  'logo-brand-board': 'logo',
  'wireframe-launch-site': 'wireframe',
  'wireframe-account-settings': 'wireframe',
  'wireframe-class-booking': 'wireframe',
};

/** The kind of page a template opens on, or null for one that makes no page of its own (Blank Tab, the blank). */
export function templatePageKind(kind: TemplateKind): PageKind | null {
  return PAGE_KIND_OF[kind] ?? null;
}
