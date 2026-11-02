// The tab's editor mode in the editor (docs/specs/007-editor/editor-modes.md). Every tab is a Workshop board:
// there is one mode and no switch, so the mode is never stored or chosen, only read by what still asks.
import { useMemo } from 'react';
import type { EditorMode } from '@livehuddle/document';

export type EditorModeState = {
  mode: EditorMode;
  canEdit: boolean;
};

export function useEditorMode(canEdit: boolean): EditorModeState {
  return useMemo(() => ({ mode: 'workshop', canEdit }), [canEdit]);
}
