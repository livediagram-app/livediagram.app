import { useEditorModeState } from './editor-mode-context';
import { ModeMenuChip } from './ModeMenuChip';

// The mode switch (docs/specs/007-editor/editor-modes.md "The mode switch"): a dropdown chip
// (ModeMenuChip). Toolbar layout: icon-only, beside the menu button (which stays up in Draw mode).
// Floating layout: labelled, in the Palette's header in Diagram mode and leading the dock in Draw
// mode, which takes the palette's place. It reads the editor's own resolved mode
// (EditorModeProvider), so wherever it is placed it shows the mode the canvas is in.
//
// Renders nothing where no switch is offered: outside an editor, for a visitor who cannot edit,
// or on a tab that offers none (an event-storming board).
//
// Zero layout shift: a fixed width per form, whatever the mode.
const SLOT = 'flex shrink-0';
const SLOT_WIDTH = { icon: 'w-12', labelled: 'w-[6.5rem]' } as const;

export function EditorModeSwitch({
  className = '',
  align = 'left',
  labelled = false,
}: {
  className?: string;
  // The edge the menu hangs from: right where the switch sits at the right of its host.
  align?: 'left' | 'right';
  // The mode's name beside its icon (the Floating layout, which has the room).
  labelled?: boolean;
}) {
  const editorMode = useEditorModeState();
  if (!editorMode?.canEdit || !editorMode.canSwitch) return null;
  return (
    <div
      data-editor-mode-switch
      className={`${SLOT} ${SLOT_WIDTH[labelled ? 'labelled' : 'icon']} ${className}`}
    >
      <ModeMenuChip
        mode={editorMode.mode}
        onChange={editorMode.setMode}
        align={align}
        labelled={labelled}
      />
    </div>
  );
}

// Whether a switch shows here, for a host that sets a divider or a group around it.
export function useEditorModeSwitchShown(): boolean {
  const editorMode = useEditorModeState();
  return !!editorMode?.canEdit && editorMode.canSwitch;
}
