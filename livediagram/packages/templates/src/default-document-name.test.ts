import { describe, expect, it } from 'vitest';
import { isDefaultDocumentName, untitledNameForTemplate } from './templates';

// docs/specs/007-editor/templates-by-mode.md "The document's name": a template picked on a document's first tab names
// it after itself while its name is still a default one.
describe('untitledNameForTemplate', () => {
  it('names a document after its template', () => {
    expect(untitledNameForTemplate('flowchart')).toBe('Untitled Flowchart');
    expect(untitledNameForTemplate('orgchart')).toBe('Untitled Org Chart');
    expect(untitledNameForTemplate('whiteboard')).toBe('Untitled Whiteboard');
    expect(untitledNameForTemplate('blank')).toBe('Untitled document');
  });
});

describe('isDefaultDocumentName', () => {
  it("counts every template's untitled name, and the plain and legacy untitled", () => {
    for (const name of [
      'Untitled document',
      'Untitled diagram',
      'Untitled Session',
      'Untitled Whiteboard',
      'Untitled Flowchart',
    ])
      expect(isDefaultDocumentName(name)).toBe(true);
  });

  it('never counts a name someone gave it', () => {
    for (const name of ['Q3 roadmap', 'Untitled', 'untitled flowchart', 'Untitled Flowchart 2', ''])
      expect(isDefaultDocumentName(name)).toBe(false);
  });
});
