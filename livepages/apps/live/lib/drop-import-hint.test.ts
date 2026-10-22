import { describe, expect, it } from 'vitest';
import { dropImportHint } from './drop-import-hint';

describe('dropImportHint', () => {
  it('points a file the Import dialog reads at Import', () => {
    expect(dropImportHint({ name: 'Tab.JSON' })).toBe(
      'To bring in a livepages export, use Import in the tab menu.',
    );
  });

  it('says nothing for any other file', () => {
    expect(dropImportHint({ name: 'photo.jpg' })).toBeNull();
    expect(dropImportHint({ name: 'json' })).toBeNull();
    expect(dropImportHint({ name: 'notes.md' })).toBeNull();
  });
});
