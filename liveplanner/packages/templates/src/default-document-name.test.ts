import { describe, expect, it } from 'vitest';
import { isDefaultDocumentName, untitledNameForTemplate } from './templates';

// docs/specs/007-editor/templates-by-mode.md "The document's name": a template picked on a document's first tab names
// it after itself while its name is still a default one.
describe('untitledNameForTemplate', () => {
  it('names a document after its template', () => {
    expect(untitledNameForTemplate('kanban')).toBe('Untitled Kanban Board');
    expect(untitledNameForTemplate('blank-spreadsheet')).toBe('Untitled Spreadsheet');
    expect(untitledNameForTemplate('blank')).toBe('Untitled document');
  });
});

describe('isDefaultDocumentName', () => {
  it("counts every template's untitled name, and the plain and legacy untitled", () => {
    for (const name of [
      'Untitled document',
      'Untitled diagram',
      'Untitled Plan',
      'Untitled Spreadsheet',
      'Untitled Kanban Board',
    ])
      expect(isDefaultDocumentName(name)).toBe(true);
  });

  it('never counts a name someone gave it', () => {
    for (const name of [
      'Q3 roadmap',
      'Untitled',
      'untitled kanban board',
      'Untitled Kanban Board 2',
      '',
    ])
      expect(isDefaultDocumentName(name)).toBe(false);
  });
});
