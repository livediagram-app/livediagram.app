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
  if (!editorMode?.canEdit || (!editorMode.canSwitch && !editorMode.lockedReason)) return null;
  return (
    <div
      data-editor-mode-switch
      // The mode it shows, for the e2e helpers (a tour owed only in Diagram, e2e/fixtures.ts).
      data-editor-mode={editorMode.mode}
      className={`${SLOT} ${className}`}
    >
      <ModeMenuChip
        mode={editorMode.mode}
        onChange={editorMode.setMode}
        // A new tab in another mode: what a locked tab offers, and what Plan offers across its line (crossesPlan).
        newTabIn={editorMode.newTabIn}
        {...(editorMode.canSwitch ? {} : { lockedReason: editorMode.lockedReason })}
      />
    </div>
  );
}
