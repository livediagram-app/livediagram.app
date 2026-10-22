import { describe, expect, it } from 'vitest';
import { paletteKindForPage } from './palette-kind';

// docs/specs/007-editor/pages-mode.md "The palette's kind".
describe('the palette kind', () => {
  it('is the page’s own: Slide, Wireframe, Logo, else Design', () => {
    expect(paletteKindForPage('wireframe')).toBe('wireframe');
    expect(paletteKindForPage('logo')).toBe('logo');
    expect(paletteKindForPage('slide')).toBe('slide');
    expect(paletteKindForPage('infographic')).toBe('design');
    expect(paletteKindForPage(null)).toBe('design');
  });
});
