import { describe, expect, it } from 'vitest';
import { isDefaultDocumentName, untitledNameForTemplate } from './templates';

// docs/specs/007-editor/new-document-route.md "What `/new` makes": a template picked on a document's first tab names
// it after itself while its name is still a default one.
describe('untitledNameForTemplate', () => {
  it('names a document after its template', () => {
    expect(untitledNameForTemplate('event-poster')).toBe('Untitled Event Poster');
    expect(untitledNameForTemplate('article')).toBe('Untitled Project Brief');
    expect(untitledNameForTemplate('blank-slide-deck')).toBe('Untitled Slide Deck');
    expect(untitledNameForTemplate('blank')).toBe('Untitled document');
  });
});

describe('isDefaultDocumentName', () => {
  it("counts every template's untitled name, and the plain and legacy untitled", () => {
    for (const name of [
      'Untitled document',
      'Untitled diagram',
      'Untitled Illustration',
      'Untitled Slide Deck',
      'Untitled Event Poster',
    ])
      expect(isDefaultDocumentName(name)).toBe(true);
  });

  it('never counts a name someone gave it', () => {
    for (const name of [
      'Q3 roadmap',
      'Untitled',
      'untitled event poster',
      'Untitled Event Poster 2',
      '',
    ])
      expect(isDefaultDocumentName(name)).toBe(false);
  });
});
