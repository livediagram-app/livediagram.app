import { EditorHeader as SharedEditorHeader } from '@liveworkspace/workbench/components/chrome/EditorHeader';
import { explorerItemHref } from '@liveworkspace/workbench/lib/explorer-href';
import { AuthControls } from '@liveworkspace/workbench/components/chrome/AuthControls';

export type { SaveStatus } from '@liveworkspace/workbench/components/chrome/EditorHeader';

// livediagram's bar over the pages that stand in for a canvas (loading, not found, a failed create): the shared
// EditorHeader (docs/specs/007-editor/editor-app.md "Header actions") with this app's logo, which goes to the Explorer, and
// its account control. The open canvas has no header bar.
export function EditorHeader() {
  return (
    <SharedEditorHeader
      app="livediagram"
      logoHref={explorerItemHref(null)}
      account={<AuthControls />}
    />
  );
}
