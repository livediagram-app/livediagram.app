import { EditorHeader as SharedEditorHeader } from '@liveworkspace/workbench/components/chrome/EditorHeader';
import { explorerItemHref } from '@liveworkspace/workbench/lib/explorer-href';
import { AuthControls } from '@liveworkspace/workbench/components/chrome/AuthControls';
import { useOwnPicture } from '@/lib/own-picture';

export type { SaveStatus } from '@liveworkspace/workbench/components/chrome/EditorHeader';

// livedesign's bar over the pages that stand in for a design (loading, not found, a failed create): the shared
// EditorHeader (docs/specs/007-editor/live-app.md "Header actions") with this app's logo, which goes to the Explorer, and
// its account control. The open design has no header bar.
export function EditorHeader() {
  return (
    <SharedEditorHeader
      app="livedesign"
      logoHref={explorerItemHref(null)}
      account={<OwnAuthControls />}
    />
  );
}

// The shared account control with your own Google picture, whatever Show My Google Picture says
// (docs/specs/014-identity/profile-and-email-notifications.md "Avatars"): a component of its own, so a picture change re-renders only it.
function OwnAuthControls() {
  const { picture } = useOwnPicture();
  return <AuthControls picture={picture} />;
}
