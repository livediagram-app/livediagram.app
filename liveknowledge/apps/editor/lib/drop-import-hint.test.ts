import { describe, expect, it } from 'vitest';
import { dropImportHint } from './drop-import-hint';

describe('dropImportHint', () => {
  it('points a file the Import dialog reads at Import', () => {
    expect(dropImportHint({ name: 'Tab.JSON' })).toBe(
      'To bring in a liveknowledge export, use Import in the page menu.',
    );
    expect(dropImportHint({ name: 'notes.md' })).toContain('a Markdown file');
    expect(dropImportHint({ name: 'Notes.MARKDOWN' })).toContain('a Markdown file');
    expect(dropImportHint({ name: 'Report.DOCX' })).toBe(
      'To bring in a Word document, use Import in the page menu.',
    );
  });

  it("names the tabs that take a file this tab's Import does not", () => {
    expect(dropImportHint({ name: 'notes.md' }, ['json'])).toBe(
      'A Markdown file imports into a page of writing.',
    );
    expect(dropImportHint({ name: 'Report.docx' }, ['json'])).toBe(
      'A Word document imports into a page of writing.',
    );
    expect(dropImportHint({ name: 'tab.json' }, ['json'])).toContain('use Import');
  });

  it('says nothing for any other file', () => {
    expect(dropImportHint({ name: 'photo.jpg' })).toBeNull();
    expect(dropImportHint({ name: 'json' })).toBeNull();
    // A PowerPoint deck is any other file: liveknowledge has no slides to import it into.
    expect(dropImportHint({ name: 'deck.pptx' })).toBeNull();
  });
});
