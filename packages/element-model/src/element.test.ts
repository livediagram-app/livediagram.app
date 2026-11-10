import { describe, expect, it } from 'vitest';
import { isBoxed } from './element';

describe('isBoxed', () => {
  it('is true for every boxed kind any product has', () => {
    for (const type of [
      'shape',
      'text',
      'freehand',
      'sticky',
      'image',
      'path',
      'table',
      'annotation',
      'link-card',
      'video',
      'article-note',
    ]) {
      expect(isBoxed({ type })).toBe(true);
    }
  });

  it('is false for an arrow and for a kind no product has, as each product answers', () => {
    expect(isBoxed({ type: 'arrow' })).toBe(false);
    expect(isBoxed({ type: 'page' })).toBe(false);
    expect(isBoxed({ type: '' })).toBe(false);
  });
});
