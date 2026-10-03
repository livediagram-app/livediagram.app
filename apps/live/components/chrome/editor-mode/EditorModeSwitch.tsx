import { useEditorModeState } from './editor-mode-context';
import { ModeMenuChip } from './ModeMenuChip';

// The mode switch (docs/specs/007-editor/editor-modes.md "The mode switch"): an icon-only dropdown
// (ModeMenuChip) beside the Toolbar layout's menu button and in the Floating layout's Explorer
// panel header, both of which stay up in Draw mode. It reads the editor's own resolved mode
// (EditorModeProvider), so wherever it is placed it shows the mode the canvas is in.
//
// Renders nothing where no switch is offered: outside an editor, for a visitor who cannot edit,
// or on a tab that offers none (an event-storming board).
//
// Zero layout shift: a fixed width, whatever the mode.
const SLOT = 'flex w-12 shrink-0';

export function EditorModeSwitch({
  className = '',
  align = 'left',
}: {
  className?: string;
  // The edge the menu hangs from: right where the switch sits at the right of its host.
  align?: 'left' | 'right';
}) {
  const editorMode = useEditorModeState();
  if (!editorMode?.canEdit || !editorMode.canSwitch) return null;
  return (
    <div data-editor-mode-switch className={`${SLOT} ${className}`}>
      <ModeMenuChip mode={editorMode.mode} onChange={editorMode.setMode} align={align} />
    </div>
  );
}
