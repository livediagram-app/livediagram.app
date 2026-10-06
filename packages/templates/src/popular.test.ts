import { describe, expect, it } from 'vitest';
import { POPULAR_PER_MODE, popularKindsFor } from './popular';
import { templateEditorMode } from './template-modes';
import { POPULAR_TEMPLATE_KINDS } from './templates';

// docs/specs/007-editor/templates-by-mode.md "The mode filter": Popular under a mode is topped up.
describe('popularKindsFor', () => {
  it('keeps Popular as listed for Everything', () => {
    expect(popularKindsFor('all')).toEqual([...POPULAR_TEMPLATE_KINDS]);
  });

  it('gives every mode at least five of its own, its blank first, each once', () => {
    for (const mode of ['diagram', 'draw', 'illustrate', 'plan'] as const) {
      const kinds = popularKindsFor(mode);
      expect(kinds.length, mode).toBeGreaterThanOrEqual(POPULAR_PER_MODE);
      expect(new Set(kinds).size, mode).toBe(kinds.length);
      for (const k of kinds) expect(templateEditorMode(k), k).toBe(mode);
    }
    expect(popularKindsFor('plan')).toEqual([
      'blank-plan',
      'project-planner',
      'kanban',
      'team-retro',
      'bug-triage',
    ]);
  });
});
