'use client';

// The dock's History group (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows"): Undo
// and Redo, the same actions as the corner cluster and the keyboard, on every layout. With nothing
// to undo or redo a button is unavailable but stays in the toolbar's arrow-key order.

import { DockButton, DockToolbar } from './DockToolbar';
import { RedoGlyph, UndoGlyph } from './whiteboard-icons';

export function HistoryGroup({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <DockToolbar label="History" group="history">
      <DockButton
        itemKey="undo"
        label="Undo"
        icon={<UndoGlyph />}
        unavailable={!canUndo}
        onPress={onUndo}
      />
      <DockButton
        itemKey="redo"
        label="Redo"
        icon={<RedoGlyph />}
        unavailable={!canRedo}
        onPress={onRedo}
      />
    </DockToolbar>
  );
}
