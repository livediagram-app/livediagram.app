import { useEditorModeState } from './editor-mode-context';
import { ModeMenuChip } from './ModeMenuChip';

// The mode switch (docs/specs/007-editor/editor-modes.md "The mode switch"): a dropdown chip
// (ModeMenuChip), icon-only, beside the menu button (which stays up in Draw mode). It reads the editor's own resolved mode
// (EditorModeProvider), so wherever it is placed it shows the mode the canvas is in.
//
// Renders nothing where no switch is offered: outside an editor, for a visitor who cannot edit,
// or on a tab that offers none (an event-storming board).
//
// Zero layout shift: a fixed width, whatever the mode.
const SLOT = 'flex w-12 shrink-0';

export function EditorModeSwitch({ className = '' }: { className?: string }) {
  const editorMode = useEditorModeState();
  if (!editorMode?.canEdit || !editorMode.canSwitch) return null;
  return (
    <div data-editor-mode-switch className={`${SLOT} ${className}`}>
      <ModeMenuChip mode={editorMode.mode} onChange={editorMode.setMode} />
    </div>
  );
}
