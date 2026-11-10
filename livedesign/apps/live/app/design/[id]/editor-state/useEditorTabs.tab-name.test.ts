import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// docs/specs/007-editor/toolbar-layout.md "The tab's name": the editor publishes the open tab's name and its rename to
// the menu box. Without the name the box stayed empty beside the menu button, though the rename was wired.
const SOURCE = readFileSync(fileURLToPath(new URL('./useEditorTabs.ts', import.meta.url)), 'utf8');

describe("useEditorTabs publishes the open tab's name to the menu box", () => {
  it('publishes the name of the open tab', () => {
    expect(SOURCE).toMatch(/\busePublishTabName\(activeTab\.name\)/);
  });

  it('publishes the rename, for someone who may change the tabs', () => {
    expect(SOURCE).toMatch(/\busePublishTabRename\(activeId, renameTab, !isStructureReadOnly\)/);
  });
});
