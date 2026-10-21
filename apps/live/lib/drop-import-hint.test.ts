import { describe, expect, it } from 'vitest';
import { dropImportHint } from './drop-import-hint';

// docs/specs/020-import-export/excalidraw-import-export.md "Dropped files"
describe('dropImportHint', () => {
  it('points a file the Import dialog reads at Import', () => {
    expect(dropImportHint({ name: 'Flow.DRAWIO' })).toBe(
      'To bring in a draw.io file, use Import in the tab menu.',
    );
    expect(dropImportHint({ name: 'plan.mmd' })).toContain('a Mermaid file');
    expect(dropImportHint({ name: 'notes.md' })).toContain('a Markdown file');
    expect(dropImportHint({ name: 'tab.json' })).toContain('a liveplanner export');
  });

  it('says nothing for any other file', () => {
    expect(dropImportHint({ name: 'photo.jpg' })).toBeNull();
    expect(dropImportHint({ name: 'drawio' })).toBeNull();
  });
});
