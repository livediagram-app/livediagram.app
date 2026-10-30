import { describe, expect, it } from 'vitest';
import { docksPageToolbar, paletteKindForPage } from './palette-kind';

// docs/specs/007-editor/pages-mode.md "The palette's kind".
describe('the palette kind', () => {
  it('is the page’s own: Slide, Article, Flashcard, else Design', () => {
    expect(paletteKindForPage('slide')).toBe('slide');
    expect(paletteKindForPage('article')).toBe('article');
    expect(paletteKindForPage('flashcard')).toBe('flashcard');
    expect(paletteKindForPage('infographic')).toBe('design');
    expect(paletteKindForPage(null)).toBe('design');
  });

  // docs/specs/007-editor/flashcards.md "Text only".
  it('docks the page toolbar for writing: an article or a card', () => {
    expect(docksPageToolbar('article')).toBe(true);
    expect(docksPageToolbar('flashcard')).toBe(true);
    expect(docksPageToolbar('slide')).toBe(false);
    expect(docksPageToolbar('design')).toBe(false);
  });
});
