'use client';

// The file overlay as the Screen opens it (docs/specs/009-elements/screen-and-room-sign.md "Opened large"): the
// editor's role and its patch read here, only while it is open, so a Screen on the wall never re-renders with the
// editor. Show This Tab on the Screen is an Editor's, through the same patch as Show on the Screen (setScreenSourceOf).
import type { ScreenFile } from '@livehuddle/document';
import { useOptionalEditorContext } from '@/app/document/[id]/EditorContext';
import { ScreenFileOverlay } from './ScreenFileOverlay';

export function ScreenFileOverlayHost({
  elementId,
  file,
  onClose,
}: {
  elementId: string;
  file: ScreenFile;
  onClose: () => void;
}) {
  const editor = useOptionalEditorContext();
  const setSource = editor?.can.level === 'edit' ? editor.setScreenSourceOf : undefined;
  return (
    <ScreenFileOverlay
      file={file}
      canShowTab={!!setSource}
      onShowTab={(liveTab) =>
        setSource?.(elementId, {
          kind: 'file',
          liveItem: file.liveItem,
          liveName: file.liveName,
          liveTab,
        })
      }
      onClose={onClose}
    />
  );
}
