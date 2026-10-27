'use client';

import { useEditorModeState } from './editor-mode-context';
import { ModeMenuChip } from './ModeMenuChip';

// The top chrome's mode switch (docs/specs/007-editor/editor-modes.md "The mode switch"): a compact dropdown chip
// (ModeMenuChip) right of the menu button, in its card, on every general tab an Editor may switch, empty or not. It
// reads the editor's own resolved mode (EditorModeProvider), so it shows the mode the canvas is in.
//
// Renders nothing where no switch is offered: outside an editor, for a Participant or a Viewer (canEdit is an
// Editor's alone), on a locked tab or an event-storming board (canSwitch).
//
// The chip takes only the width its content needs, so a short name (Draw) leaves no empty space. `iconOnly` (a phone)
// drops the name to save room in the strip's row; the chip keeps its accessible name.
const SLOT = 'flex shrink-0';

export function EditorModeSwitch({ iconOnly = false }: { iconOnly?: boolean }) {
  const editorMode = useEditorModeState();
  if (!editorMode?.canEdit || !editorMode.canSwitch) return null;
  return (
    <div data-editor-mode-switch="" className={SLOT}>
      <ModeMenuChip
        mode={editorMode.mode}
        onChange={editorMode.setMode}
        compact
        iconOnly={iconOnly}
      />
    </div>
  );
}
