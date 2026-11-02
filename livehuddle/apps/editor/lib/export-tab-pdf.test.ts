import { describe, expect, it } from 'vitest';
import { MAX_PDF_PAGE_PT, singlePageMedia } from './export-tab-pdf';

// A single-page PDF prints at the size the tab shows (0.75 pt per CSS px), not
// at the 2x render's pixel count, and never past the PDF page limit.
describe('singlePageMedia', () => {
  it('sizes the page from CSS px, not device pixels', () => {
    // An 1000 x 500 CSS px tab rendered at 2x.
    expect(singlePageMedia(2000, 1000, 2)).toEqual({ mediaW: 750, mediaH: 375 });
  });

  it('gives the same page whatever scale the render took', () => {
    expect(singlePageMedia(1000, 500, 1)).toEqual(singlePageMedia(2000, 1000, 2));
  });

  it('shrinks a page past the PDF limit uniformly to fit it', () => {
    // 32768 x 16384 CSS px, rendered at 0.5 to stay under the canvas cap.
    const { mediaW, mediaH } = singlePageMedia(16384, 8192, 0.5);
    expect(mediaW).toBe(MAX_PDF_PAGE_PT);
    expect(mediaH).toBe(MAX_PDF_PAGE_PT / 2);
  });

  it('keeps a tall page inside the limit on its long side', () => {
    const { mediaW, mediaH } = singlePageMedia(4000, 40000, 1);
    expect(mediaH).toBe(MAX_PDF_PAGE_PT);
    expect(mediaW).toBe(1440);
  });
});
