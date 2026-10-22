// The editor mode in the editor (docs/specs/007-editor/pages-mode.md "One mode"): livedesign has one, Pages, so
// there is nothing to switch. `canEdit` comes from the editor's one answer (useViewPreview) and is
// handed back beside the mode, so the chrome reads both from one place.
import { DEFAULT_EDITOR_MODE, type EditorMode } from '@livedesign/document';

export type EditorModeState = {
  mode: EditorMode;
  canEdit: boolean;
};

export function useEditorMode(canEdit: boolean): EditorModeState {
  return { mode: DEFAULT_EDITOR_MODE, canEdit };
}
