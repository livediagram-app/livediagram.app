import { describe, expect, it } from 'vitest';
import {
  isUntitledName,
  UNTITLED_DOCUMENT_NAMES,
  UNTITLED_KNOWLEDGEBASE_NAME,
} from './untitled-names';

// docs/specs/030-knowledgebase/knowledgebases-and-pages.md "A knowledgebase".
describe('untitled names', () => {
  it("counts liveknowledge's own default name beside the platform's", () => {
    expect(UNTITLED_KNOWLEDGEBASE_NAME).toBe('Untitled Knowledgebase');
    expect(isUntitledName('Untitled Knowledgebase')).toBe(true);
    expect(isUntitledName('Untitled document')).toBe(true);
    expect(UNTITLED_DOCUMENT_NAMES.size).toBeGreaterThan(2);
  });

  it('never counts a name someone gave it', () => {
    expect(isUntitledName('Engineering Handbook')).toBe(false);
    expect(isUntitledName('untitled knowledgebase')).toBe(false);
  });
});
