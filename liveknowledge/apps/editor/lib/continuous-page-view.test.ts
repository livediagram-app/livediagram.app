import { describe, expect, it } from 'vitest';
import {
  CONTINUOUS_PAGE_WIDTH,
  layOutPages,
  newKnowledgebasePageContent,
} from '@liveknowledge/document';
import { continuousPageWidth, pageFitsSideways } from './continuous-page-view';

// docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The continuous page".
describe('the view of a continuous page', () => {
  it('reads the continuous page width, and none for any other first page', () => {
    expect(continuousPageWidth(layOutPages(newKnowledgebasePageContent().pages))).toBe(
      CONTINUOUS_PAGE_WIDTH,
    );
    expect(continuousPageWidth(layOutPages([{ id: 'p', orientation: 'portrait' }]))).toBe(0);
    expect(continuousPageWidth([])).toBe(0);
  });

  it('holds a sideways pan only while the page fits the window', () => {
    expect(pageFitsSideways(820, 1, 1280)).toBe(true);
    expect(pageFitsSideways(820, 1, 820)).toBe(true);
    // Zoomed in past the window, or on a phone narrower than the page: it pans.
    expect(pageFitsSideways(820, 2, 1280)).toBe(false);
    expect(pageFitsSideways(820, 1, 390)).toBe(false);
    expect(pageFitsSideways(0, 1, 1280)).toBe(false);
    expect(pageFitsSideways(820, 1, 0)).toBe(false);
  });
});
