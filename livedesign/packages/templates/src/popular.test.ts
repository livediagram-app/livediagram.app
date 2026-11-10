import { describe, expect, it } from 'vitest';
import { EDITOR_MODES } from '@livedesign/design';
import {
  POPULAR_BY_MODE,
  POPULAR_PER_MODE,
  POPULAR_TEMPLATE_KINDS,
  popularKindsFor,
} from './popular';
import { BLANK_TEMPLATE_FOR_MODE, templateEditorMode } from './template-modes';
import { TEMPLATES } from './templates';

// docs/specs/008-canvas/canvas-and-palette.md "Template categories": Popular is a curated list per mode filter.
describe('Popular', () => {
  const kinds = new Set(TEMPLATES.map((t) => t.kind));

  // docs/specs/007-editor/start-diagramming.md "Recommended and groups": the mode's blank is hidden, since the ×
  // leaves the same tab, so no shelf offers it.
  it("lists Everything without the mode's blank", () => {
    expect(popularKindsFor('all')).toEqual([...POPULAR_TEMPLATE_KINDS]);
    for (const mode of EDITOR_MODES) {
      expect(POPULAR_TEMPLATE_KINDS).not.toContain(BLANK_TEMPLATE_FOR_MODE[mode]);
    }
  });

  it('gives every mode a short list of its own, each once, every kind real', () => {
    for (const [choice, list] of Object.entries(POPULAR_BY_MODE)) {
      expect(list.length, choice).toBeGreaterThanOrEqual(POPULAR_PER_MODE);
      expect(list.length, choice).toBeLessThanOrEqual(13);
      expect(new Set(list).size, choice).toBe(list.length);
      for (const k of list) expect(kinds.has(k), k).toBe(true);
      if (choice === 'all') continue;
      const mode = choice as keyof typeof BLANK_TEMPLATE_FOR_MODE;
      for (const k of list) expect(templateEditorMode(k), k).toBe(mode);
    }
  });
});
