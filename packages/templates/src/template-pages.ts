// Which templates open in Illustrate on pages of their own (docs/specs/008-canvas/
// canvas-and-palette.md "Templates on pages"), and on which pages. The builders place their
// elements on exactly these pages; templateCanvasOverrides ships them, so every application path
// (the picker, /new, the MCP worker) lands the pages and the elements together.
import type { IllustratePage } from '@livediagram/document';
import { liveCardPages } from './template-builders-livecard';
import { logoDesignPages } from './template-builders-logo';
import { slideDeckPages } from './template-builders-slides';
import { eventPosterPages } from './template-builders-poster';
import { yearInReviewPages } from './template-builders-year-review';
import { resumePages } from './template-builders-resume';
import { recipeCardPages } from './template-builders-recipe';
import type { TemplateKind } from './templates';

/** The pages a template opens on, or undefined for a template drawn on the open canvas. */
export function templatePages(kind: TemplateKind): IllustratePage[] | undefined {
  switch (kind) {
    case 'slide-deck':
      return slideDeckPages();
    case 'logo-design':
      return logoDesignPages();
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
    default:
      return undefined;
  }
}
