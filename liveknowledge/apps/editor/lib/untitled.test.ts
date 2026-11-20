import { describe, expect, it } from 'vitest';
import {
  UNTITLED_DOCUMENT_NAME,
  isUntitledDocumentName,
  untitledNameForTemplate,
} from '@liveknowledge/templates';

// docs/specs/006-document/document-structure.md
describe('untitled document names', () => {
  it('names a new blank document "Untitled Knowledgebase"', () => {
    expect(UNTITLED_DOCUMENT_NAME).toBe('Untitled Knowledgebase');
    expect(untitledNameForTemplate('blank')).toBe('Untitled Knowledgebase');
    expect(untitledNameForTemplate(null)).toBe('Untitled Knowledgebase');
  });

  it('treats only the default name as untitled', () => {
    expect(isUntitledDocumentName('Untitled Knowledgebase')).toBe(true);
    expect(isUntitledDocumentName('Roadmap')).toBe(false);
    expect(isUntitledDocumentName('Untitled Tree Mind Map')).toBe(false);
  });
});
