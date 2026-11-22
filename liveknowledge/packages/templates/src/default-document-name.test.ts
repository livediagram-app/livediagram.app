import { describe, expect, it } from 'vitest';
import { isDefaultDocumentName, untitledNameForTemplate } from './templates';

// docs/specs/007-editor/new-document-route.md "What `/new` makes": a template picked on a document's first tab names
// it after itself while its name is still a default one.
describe('untitledNameForTemplate', () => {
  it('names a document after its template', () => {
    expect(untitledNameForTemplate('meeting-notes')).toBe('Untitled Meeting Notes');
    expect(untitledNameForTemplate('article')).toBe('Untitled Project Brief');
    // A kind liveknowledge does not list names nothing.
    expect(untitledNameForTemplate('blank-slide-deck')).toBe('Untitled Knowledgebase');
    expect(untitledNameForTemplate('blank')).toBe('Untitled Knowledgebase');
  });
});

describe('isDefaultDocumentName', () => {
  it("counts every template's untitled name, and the plain untitled", () => {
    for (const name of [
      'Untitled Knowledgebase',
      'Untitled Meeting Notes',
      'Untitled Project Brief',
    ])
      expect(isDefaultDocumentName(name)).toBe(true);
  });

  it('never counts a name someone gave it', () => {
    for (const name of [
      'Q3 roadmap',
      'Untitled',
      'untitled meeting notes',
      'Untitled Meeting Notes 2',
      '',
    ])
      expect(isDefaultDocumentName(name)).toBe(false);
  });
});
