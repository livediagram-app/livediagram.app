'use client';

// The Tab Style dialog's Room panel (docs/specs/011-theme/canvas-and-theme-dialog.md "Room panel"): the floor
// controls the dialog hands every Canvas panel, plus the walls, which only livehuddle's tab has, read from and set on
// the editor's active tab. Outside an editor (no context) it is the floor controls alone.
import type { BackgroundPattern } from '@livehuddle/document';
import type { TabStyleCanvasPanelProps } from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-profile';
import { useOptionalEditorContext } from '@/app/document/[id]/EditorContext';
import { CanvasStyleControls } from './CanvasStyleControls';

export function RoomStyleControls(props: TabStyleCanvasPanelProps<BackgroundPattern>) {
  const editor = useOptionalEditorContext();
  return (
    <CanvasStyleControls
      {...props}
      walls={editor ? { color: editor.activeTab.wallColor, onSet: editor.setWallColor } : undefined}
    />
  );
}
