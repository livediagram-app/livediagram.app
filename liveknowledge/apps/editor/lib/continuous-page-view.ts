// How the view treats a continuous page (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The continuous
// page"): it scrolls down the writing, and panning sideways does not move a page that already fits the window.
import { isContinuousPage, type LaidOutPage } from '@liveknowledge/document';

/** The width of the tab's continuous page in canvas px, or 0 when its first page is not one. */
export function continuousPageWidth(pages: readonly LaidOutPage[]): number {
  const first = pages[0];
  return first && isContinuousPage(first) ? first.rect.width : 0;
}

/** Whether a continuous page `width` canvas px wide fits the window sideways at `zoom`: a sideways pan then moves
 *  nothing. Never for no page (`width` 0) or a canvas not measured yet. */
export function pageFitsSideways(width: number, zoom: number, canvasWidth: number): boolean {
  return width > 0 && canvasWidth > 0 && width * zoom <= canvasWidth;
}
