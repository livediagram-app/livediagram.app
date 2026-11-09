// Whether walking input is held back right now (docs/specs/008-canvas/avatar-mode.md "Not over a start"): the one
// check every walking input reads (the arrows and Space, the action keys, Enter to speak, a click or tap on the
// canvas), so a screen in front of the canvas holds them all. An open modal dialog owns the keyboard
// (modal-guard), and a template start (Start a Space) is in front of the canvas until a template is picked or it is
// closed (start-panel-open). Read at event time, outside React.
import { startPanelIsOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import { anyModalOpen } from '@liveworkspace/workbench/lib/modal-guard';

export function walkInputBlocked(): boolean {
  return anyModalOpen() || startPanelIsOpen();
}
