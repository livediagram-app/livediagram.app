// Leaving Pages (docs/specs/007-editor/editor-modes.md "Leaving Pages"): a tab with content asks
// first, in a confirmation beside the mode switch, since its pages do not show in Diagram or Draw
// and what is on them may not look the same; Switch or Cancel. A visitor, a locked tab or an empty
// tab switches straight away.
import { useCallback, useState } from 'react';
import type { EditorMode, Tab } from '@livedesign/document';
import { track } from '@/lib/telemetry';

export type LeavePages = {
  // The mode asked for while the confirmation is open.
  confirming: EditorMode | null;
  confirmSwitch: () => void;
  cancelSwitch: () => void;
};

export function useLeavePages<M extends { mode: EditorMode; setMode: (m: EditorMode) => void }>(
  editorMode: M,
  deps: { tab: Tab | undefined; canEdit: boolean },
): { editorMode: M; leave: LeavePages } {
  const { tab, canEdit } = deps;
  const [confirming, setConfirming] = useState<EditorMode | null>(null);
  const { mode, setMode: rawSet } = editorMode;
  const setMode = useCallback(
    (next: EditorMode) => {
      const leaving =
        mode === 'pages' && next !== 'pages' && canEdit && !!tab && tab.locked !== true;
      if (leaving && tab.elements.length > 0) setConfirming(next);
      else rawSet(next);
    },
    [mode, rawSet, canEdit, tab],
  );
  const confirmSwitch = () => {
    if (confirming) {
      track('Editor', 'Changed', 'LeavePagesConfirmed');
      rawSet(confirming);
    }
    setConfirming(null);
  };
  const cancelSwitch = () => setConfirming(null);
  return {
    editorMode: { ...editorMode, setMode },
    leave: { confirming, confirmSwitch, cancelSwitch },
  };
}
