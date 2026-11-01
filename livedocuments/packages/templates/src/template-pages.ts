// Which templates open in Pages on pages of their own (docs/specs/008-canvas/
// canvas-and-palette.md "Templates on pages"), and on which pages. The builders place their
// elements on exactly these pages; templateCanvasOverrides ships them, so every application path
// (the picker, /new, the MCP worker) lands the pages and the elements together.
import type { Page } from '@livedocuments/document';
import { liveCardPages } from './template-builders-livecard';
import { slideDeckPages } from './template-builders-slides';
import { eventPosterPages } from './template-builders-poster';
import { yearInReviewPages } from './template-builders-year-review';
import { resumePages } from './template-builders-resume';
import { recipeCardPages } from './template-builders-recipe';
import { dataStoryPages } from './template-builders-data-story';
import { howItWorksPages } from './template-builders-how-it-works';
import { versusPages } from './template-builders-versus';
import { socialCarouselPages } from './template-builders-social-carousel';
import { layoutDeckPages } from './template-builders-layout-decks';
import type { TemplateKind } from './templates';
import { designTemplatePages, isDesignTemplate } from './template-design-pages';

/** The pages a template opens on, or undefined for a template drawn on the open canvas. */
export function templatePages(kind: TemplateKind): Page[] | undefined {
  switch (kind) {
    case 'slide-deck':
      return slideDeckPages();
    case 'live-card':
      return liveCardPages();
    case 'event-poster':
      return eventPosterPages();
    case 'year-in-review':
      return yearInReviewPages();
    case 'resume':
      return resumePages();
    case 'recipe-card':
      return recipeCardPages();
    case 'data-story':
      return dataStoryPages();
    case 'how-it-works':
      return howItWorksPages();
    case 'versus':
      return versusPages();
    case 'social-carousel':
      return socialCarouselPages();
    case 'launch-keynote':
    case 'quarterly-review':
    case 'team-welcome':
    case 'workshop-kickoff':
    case 'class-lesson':
      return layoutDeckPages(kind);
    default:
      return isDesignTemplate(kind) ? designTemplatePages(kind) : undefined;
  }
}
