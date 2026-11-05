import { describe, expect, it } from 'vitest';
import { dropImportHint } from './drop-import-hint';

// docs/specs/020-import-export/excalidraw-import-export.md "Dropped files"
describe('dropImportHint', () => {
  it('points a file the Import dialog reads at Import', () => {
    expect(dropImportHint({ name: 'Tab.JSON' })).toBe(
      'To bring in a livehuddle export, use Import in the tab menu.',
    );
  });

  // The draw.io, Mermaid and Markdown imports left livehuddle (Work Tracker #423, part 4): Import is no way in.
  it("says nothing for any other file, a diagram tool's included", () => {
    expect(dropImportHint({ name: 'photo.jpg' })).toBeNull();
    for (const name of ['Flow.drawio', 'plan.mmd', 'notes.md'])
      expect(dropImportHint({ name })).toBeNull();
  });
});
