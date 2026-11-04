import { describe, expect, it } from 'vitest';
import { isDefaultDocumentName, untitledNameForTemplate } from './templates';

// docs/specs/007-editor/templates-by-mode.md "The document's name": a template picked on a document's first tab names
// it after itself while its name is still a default one.
describe('untitledNameForTemplate', () => {
  it('names a document after its template', () => {
    expect(untitledNameForTemplate('team-pod')).toBe('Untitled Team Pod');
    // The blank makes a Space (domain-language.md "Space"), as no template does.
    expect(untitledNameForTemplate('blank-session')).toBe('Untitled Space');
    expect(untitledNameForTemplate(null)).toBe('Untitled Space');
    expect(untitledNameForTemplate('virtual-office')).toBe('Untitled Virtual Office');
  });
});

describe('isDefaultDocumentName', () => {
  it("counts every template's untitled name, and the plain and legacy untitled", () => {
    for (const name of [
      'Untitled Space',
      'Untitled canvas',
      'Untitled document',
      'Untitled diagram',
      'Untitled Session',
      'Untitled Workshop',
      'Untitled Team Pod',
      // A space made from a template that left (Work Tracker #423) is still unnamed.
      'Untitled Sailboat Retrospective',
      'Untitled Town Hall Q&A',
    ])
      expect(isDefaultDocumentName(name)).toBe(true);
  });

  it('never counts a name someone gave it', () => {
    for (const name of ['Q3 roadmap', 'Untitled', 'untitled flowchart', 'Untitled Flowchart 2', ''])
      expect(isDefaultDocumentName(name)).toBe(false);
  });
});
