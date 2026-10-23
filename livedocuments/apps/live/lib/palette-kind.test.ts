import { describe, expect, it } from 'vitest';
import { paletteKindForPage } from './palette-kind';

// docs/specs/007-editor/pages-mode.md "The palette's kind".
describe('the palette kind', () => {
  it('is the page’s own: Slide, Article, else Design', () => {
    expect(paletteKindForPage('slide')).toBe('slide');
    expect(paletteKindForPage('article')).toBe('article');
    expect(paletteKindForPage('infographic')).toBe('design');
    expect(paletteKindForPage(null)).toBe('design');
  });
});
