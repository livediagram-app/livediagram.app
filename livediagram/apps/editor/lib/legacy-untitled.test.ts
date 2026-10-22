import { describe, expect, it } from 'vitest';
import {
  UNTITLED_DOCUMENT_NAME,
  isUntitledDocumentName,
  untitledNameForTemplate,
} from '@livediagram/templates';

// Documents created before the rename are stored as "Untitled diagram"
// (docs/specs/006-document/document-structure.md); they still count as untitled.
describe('untitled document names', () => {
  it('names a new blank document "Untitled document"', () => {
    expect(UNTITLED_DOCUMENT_NAME).toBe('Untitled document');
    expect(untitledNameForTemplate('blank')).toBe('Untitled document');
    expect(untitledNameForTemplate(null)).toBe('Untitled document');
  });

  it('treats both the current and the pre-rename default as untitled', () => {
    expect(isUntitledDocumentName('Untitled document')).toBe(true);
    expect(isUntitledDocumentName('Untitled diagram')).toBe(true);
    expect(isUntitledDocumentName('Roadmap')).toBe(false);
    expect(isUntitledDocumentName('Untitled Tree Mind Map')).toBe(false);
  });
});
