import { EditorHeader as SharedEditorHeader } from '@liveworkspace/workbench/components/chrome/EditorHeader';
import { AuthControls } from '@liveworkspace/workbench/components/chrome/AuthControls';
import { useOwnPicture } from '@/lib/own-picture';
import { EXPLORER_LANDING_PATH } from '@/lib/explorer-landing';

export type { SaveStatus } from '@liveworkspace/workbench/components/chrome/EditorHeader';

// liveknowledge's bar over the pages that stand in for a document (loading, not found, a failed create): the shared
// EditorHeader (docs/specs/007-editor/editor-app.md "Header actions") with this app's logo, which goes to the Explorer, and
// its account control. The open document has no header bar.
export function EditorHeader() {
  return (
    <SharedEditorHeader
      app="liveknowledge"
      logoHref={EXPLORER_LANDING_PATH}
      account={<OwnAuthControls />}
    />
  );
}

// The shared account control with your own Google picture, whatever Show My Google Picture says
// (docs/specs/014-identity/profile-picture.md): a component of its own, so a picture change re-renders only it.
function OwnAuthControls() {
  const { picture } = useOwnPicture();
  return <AuthControls picture={picture} />;
}
