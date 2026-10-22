import { describe, expect, it } from 'vitest';
import { indefiniteArticle, withArticle } from './indefinite-article';

describe('indefiniteArticle', () => {
  it('says "an" before a vowel sound and "a" before the rest', () => {
    for (const w of [
      'Org Chart',
      'Invoice',
      'Empathy Map',
      'OKRs',
      'infographic',
      'article',
      'Estimate',
      'entity',
    ])
      expect(indefiniteArticle(w), w).toBe('an');
    for (const w of ['Blank Diagram', 'Crazy 8s', 'slide', 'logo', 'YouTube', 'hotspot'])
      expect(indefiniteArticle(w), w).toBe('a');
  });

  it('keeps "a" where the vowel is said "you"', () => {
    for (const w of ['User Persona', 'user story map', 'UML Class', 'unit', 'UX review'])
      expect(indefiniteArticle(w), w).toBe('a');
  });

  it('puts the article before the word', () => {
    expect(withArticle('infographic')).toBe('an infographic');
    expect(withArticle('slide')).toBe('a slide');
  });
});
