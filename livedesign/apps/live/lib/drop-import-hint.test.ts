import { describe, expect, it } from 'vitest';
import { dropImportHint } from './drop-import-hint';

describe('dropImportHint', () => {
  it('points a file the Import dialog reads at Import', () => {
    expect(dropImportHint({ name: 'Tab.JSON' })).toBe(
      'To bring in a livedesign export, use Import in the tab menu.',
    );
    expect(dropImportHint({ name: 'notes.md' })).toContain('a Markdown file');
  });

  it('says nothing for any other file', () => {
    expect(dropImportHint({ name: 'photo.jpg' })).toBeNull();
    expect(dropImportHint({ name: 'json' })).toBeNull();
  });
});
