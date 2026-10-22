// Per-template element builders. Each builder is pure: it takes a
// centre (cx, cy) and returns a fresh array of Element. Sizing
// constants live inline so each template is self-describing. See
// docs/specs/008-canvas/canvas-and-palette.md for the picker UX; the editor applies its theme recolour on
// top (apps/live/lib/template-builders.ts), and the MCP worker
// materialises these directly (docs/specs/015-api/mcp-server.md §4.5).

import { buildWireframeFlow } from './template-builders-wireframe-flows';
import { settleChips, type Element } from '@livedocuments/document';
import type { TemplateKind } from './templates';
import { buildSlideDeck } from './template-builders-slides';
import { buildEventPoster } from './template-builders-poster';
import { buildYearInReview } from './template-builders-year-review';
import { buildResume } from './template-builders-resume';
import { buildRecipeCard } from './template-builders-recipe';
import { buildDataStory } from './template-builders-data-story';
import { buildHowItWorks } from './template-builders-how-it-works';
import { buildVersus } from './template-builders-versus';
import { buildSocialCarousel } from './template-builders-social-carousel';
import { buildLayoutDeck } from './template-builders-layout-decks';
import { buildStoryboard } from './template-builders-storyboard';
import { buildOnDesignPage } from './template-design-pages';
import { buildFloorPlan } from './template-builders-floorplan';
import { buildLogoDesign } from './template-builders-logo';
import { buildLiveCard } from './template-builders-livecard';

// Build the elements for a given template, centred on the supplied canvas
// point. Each template is intentionally small and editable; users grow them.
// The output lands settled (docs/specs/009-elements/blueprints/badge.md "Settling"): a builder sizes a step
// after making it, so its number is set to half the disc here, as a stored board reads back, and a
// preview or an agent's create shows what the editor will.
export function buildTemplate(kind: TemplateKind, cx: number, cy: number): Element[] {
  return settleChips([], buildUnsettled(kind, cx, cy), { attachLoose: false });
}

function buildUnsettled(kind: TemplateKind, cx: number, cy: number): Element[] {
  switch (kind) {
    // Blank Tab is truly blank: no seeded element.
    case 'blank':
      return [];
    case 'slide-deck':
      return buildSlideDeck(cx, cy);
    case 'logo-design':
      return buildLogoDesign(cx, cy);
    case 'live-card':
      return buildLiveCard(cx, cy);
    case 'storyboard':
      return buildOnDesignPage('storyboard', buildStoryboard);
    case 'floor-plan':
      return buildOnDesignPage('floor-plan', buildFloorPlan);
    // An article's writing and page are tab data (templateCanvasOverrides), not elements; a blank
    // illustration is its one empty page, which asks what it is for, and a blank of a page kind its one
    // empty page of that kind (blank-page-templates.ts).
    case 'article':
    case 'working-backwards':
    case 'blank-illustration':
    case 'blank-slide-deck':
    case 'blank-article':
    case 'blank-infographic':
    case 'blank-logo':
    case 'blank-wireframe-phone':
    case 'blank-wireframe-tablet':
    case 'blank-wireframe-browser':
    case 'blank-wireframe-laptop':
    case 'blank-wireframe-watch':
      return [];
    case 'wireframe-mobile-app':
    case 'wireframe-website':
    case 'wireframe-dashboard':
    case 'wireframe-tablet-app':
    case 'wireframe-watch-app':
      return buildWireframeFlow(kind);
    // Built on their own pages (template-pages.ts), whatever the centre.
    case 'event-poster':
      return buildEventPoster();
    case 'year-in-review':
      return buildYearInReview();
    case 'resume':
      return buildResume();
    case 'recipe-card':
      return buildRecipeCard();
    case 'data-story':
      return buildDataStory();
    case 'how-it-works':
      return buildHowItWorks();
    case 'versus':
      return buildVersus();
    case 'social-carousel':
      return buildSocialCarousel();
    case 'launch-keynote':
    case 'quarterly-review':
    case 'team-welcome':
    case 'workshop-kickoff':
      return buildLayoutDeck(kind);
  }
}

// A template's tabs: every Pages template
// makes one, named null so it keeps the name the caller gives a new tab. The shape stays a list so the callers that
// make a template's tabs (the editor, the api, the MCP worker) need not change. Its elements are buildTemplate's.
export type TemplateTabDef = {
  name: string | null;
  build: (cx: number, cy: number) => Element[];
};

export function templateTabs(kind: TemplateKind): TemplateTabDef[] {
  return [{ name: null, build: (cx: number, cy: number) => buildTemplate(kind, cx, cy) }];
}
