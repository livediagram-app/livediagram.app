import { describe, expect, it } from 'vitest';
import { POPULAR_TEMPLATE_KINDS } from './popular';
import { isPlanTemplate } from './template-modes';
import { TEMPLATES } from './templates';

// docs/specs/008-canvas/canvas-and-palette.md "Template categories": Popular is a short curated list of Plan's
// templates.
describe('Popular', () => {
  const kinds = new Set(TEMPLATES.map((t) => t.kind));

  it('leads with Blank Plan, each once, every kind a real Plan template', () => {
    expect(POPULAR_TEMPLATE_KINDS[0]).toBe('blank-plan');
    expect(POPULAR_TEMPLATE_KINDS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(POPULAR_TEMPLATE_KINDS).size).toBe(POPULAR_TEMPLATE_KINDS.length);
    for (const k of POPULAR_TEMPLATE_KINDS) {
      expect(kinds.has(k), k).toBe(true);
      expect(isPlanTemplate(k), k).toBe(true);
    }
  });
});
