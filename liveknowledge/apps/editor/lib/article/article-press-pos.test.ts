import { describe, expect, it } from 'vitest';
import { pressedPos } from './article-press-pos';

// docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page is drawn as tall as its writing here".
describe('pressedPos', () => {
  const base = { hit: 12, endBottom: 500, end: 90, continuous: true };

  it('puts the caret at the end for a press below the last line of a continuous page', () => {
    expect(pressedPos({ ...base, y: 900 })).toBe(90);
  });

  it('keeps the place pressed within the writing', () => {
    expect(pressedPos({ ...base, y: 300 })).toBe(12);
    expect(pressedPos({ ...base, y: 500 })).toBe(12);
  });

  it('is the end when nothing was hit', () => {
    expect(pressedPos({ ...base, hit: undefined, y: 300 })).toBe(90);
  });

  it('keeps the place pressed on paper pages, whose columns end at different heights', () => {
    expect(pressedPos({ ...base, continuous: false, y: 900 })).toBe(12);
  });

  it('keeps the place pressed when the end cannot be measured', () => {
    expect(pressedPos({ ...base, endBottom: null, y: 900 })).toBe(12);
  });
});
