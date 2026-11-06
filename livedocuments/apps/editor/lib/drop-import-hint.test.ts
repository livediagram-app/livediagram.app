import { describe, expect, it } from 'vitest';
import { dropImportHint } from './drop-import-hint';

describe('dropImportHint', () => {
  it('points a file the Import dialog reads at Import', () => {
    expect(dropImportHint({ name: 'Tab.JSON' })).toBe(
      'To bring in a livedocuments export, use Import in the tab menu.',
    );
    expect(dropImportHint({ name: 'notes.md' })).toContain('a Markdown file');
    expect(dropImportHint({ name: 'Notes.MARKDOWN' })).toContain('a Markdown file');
    expect(dropImportHint({ name: 'Report.DOCX' })).toBe(
      'To bring in a Word document, use Import in the tab menu.',
    );
    expect(dropImportHint({ name: 'pitch.pptx' })).toContain('a PowerPoint deck');
  });

  it("names the tabs that take a file this tab's Import does not", () => {
    expect(dropImportHint({ name: 'notes.md' }, ['json', 'powerpoint'])).toBe(
      'A Markdown file imports into an article or an empty tab.',
    );
    expect(dropImportHint({ name: 'Report.docx' }, ['json'])).toBe(
      'A Word document imports into an article or an empty tab.',
    );
    expect(dropImportHint({ name: 'pitch.pptx' }, ['json', 'markdown', 'word'])).toBe(
      'A PowerPoint deck imports into a slide deck or an empty tab.',
    );
    expect(dropImportHint({ name: 'pitch.pptx' }, ['json', 'powerpoint'])).toBe(
      'To bring in a PowerPoint deck, use Import in the tab menu.',
    );
    expect(dropImportHint({ name: 'tab.json' }, ['json'])).toContain('use Import');
  });

  it('says nothing for any other file', () => {
    expect(dropImportHint({ name: 'photo.jpg' })).toBeNull();
    expect(dropImportHint({ name: 'json' })).toBeNull();
  });
});
