import { describe, expect, it } from 'vitest';
import { POPULAR_TEMPLATE_KINDS, stepPopularKinds } from './popular';
import { BLANK_TEMPLATE } from './template-modes';
import { TEMPLATES } from './templates';

// docs/specs/008-canvas/canvas-and-palette.md "Template categories": Popular is a short curated list.
describe('Popular', () => {
  const kinds = new Set(TEMPLATES.map((t) => t.kind));

  it('gives each shelf a short list, Blank Illustration first, each once, every kind real', () => {
    for (const list of [POPULAR_TEMPLATE_KINDS, stepPopularKinds()]) {
      expect(list.length).toBeGreaterThanOrEqual(5);
      expect(list.length).toBeLessThanOrEqual(13);
      expect(new Set(list).size).toBe(list.length);
      expect(list[0]).toBe(BLANK_TEMPLATE);
      for (const k of list) expect(kinds.has(k), k).toBe(true);
    }
  });
});
