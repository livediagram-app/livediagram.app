import { describe, expect, it } from 'vitest';
import { dropImportHint } from './drop-import-hint';

// docs/specs/002-project-scope/not-in-livehuddle.md "Imports from other tools"
describe('dropImportHint', () => {
  it('points a file the Import dialog reads at Import', () => {
    expect(dropImportHint({ name: 'Tab.JSON' })).toBe(
      'To bring in a livehuddle export, use Import in the tab menu.',
    );
  });

  // Imports from other tools left livehuddle: Import is no way in for them.
  it("says nothing for any other file, a diagram tool's included", () => {
    expect(dropImportHint({ name: 'photo.jpg' })).toBeNull();
    for (const name of ['Flow.drawio', 'plan.mmd', 'notes.md', 'board.excalidraw'])
      expect(dropImportHint({ name })).toBeNull();
  });
});
