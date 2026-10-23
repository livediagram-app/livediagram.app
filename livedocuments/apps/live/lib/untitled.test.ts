import { describe, expect, it } from 'vitest';
import {
  UNTITLED_DOCUMENT_NAME,
  isUntitledDocumentName,
  untitledNameForTemplate,
} from '@livedocuments/templates';

// docs/specs/006-document/document-structure.md
describe('untitled document names', () => {
  it('names a new blank document "Untitled document"', () => {
    expect(UNTITLED_DOCUMENT_NAME).toBe('Untitled document');
    expect(untitledNameForTemplate('blank')).toBe('Untitled document');
    expect(untitledNameForTemplate(null)).toBe('Untitled document');
  });

  it('treats only the default name as untitled', () => {
    expect(isUntitledDocumentName('Untitled document')).toBe(true);
    expect(isUntitledDocumentName('Roadmap')).toBe(false);
    expect(isUntitledDocumentName('Untitled Tree Mind Map')).toBe(false);
  });
});
