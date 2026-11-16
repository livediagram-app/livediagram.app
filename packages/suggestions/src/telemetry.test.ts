import { describe, expect, it } from 'vitest';
import { CANVAS_SUGGESTION_TYPES, SUGGEST_ONLY_SHARE_TYPES } from './telemetry';

describe('suggestion telemetry types', () => {
  it('names each once, in PascalCase', () => {
    for (const list of [CANVAS_SUGGESTION_TYPES, SUGGEST_ONLY_SHARE_TYPES]) {
      expect(new Set(list).size).toBe(list.length);
      for (const t of list) expect(t).toMatch(/^[A-Z][A-Za-z]+$/);
    }
  });
});
