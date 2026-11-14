// The item panel takes undo and redo (docs/specs/008-canvas/canvas-and-palette.md "Keyboard shortcuts", Work Tracker
// 746). Every dialog stands the editor's shortcuts down (the modal guard); a dialog that renders an element carrying
// TAKES_HISTORY_ATTR hands Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z and Ctrl+Y back to the editor while it is the only dialog
// open, so the plan's field edits undo with the panel up. Text fields and menus inside it keep their own keys.
import { isInMenuSurface } from '@liveplanner/ui';
import { openModalCount } from '@liveworkspace/workbench/lib/modal-guard';
import { isTypingTarget } from '@liveworkspace/workbench/lib/typing-target';

/** The marker a dialog renders (anywhere inside its panel) to take undo and redo. */
export const TAKES_HISTORY_ATTR = 'data-takes-history';

const PANEL = '[data-dialog-panel]';

/** Whether keydown `e`, pressed while a modal is open, is an undo or redo chord the open dialog hands to the editor.
 *  `mod`: Cmd, or a Ctrl that is not AltGr's. */
export function modalTakesHistory(e: KeyboardEvent, mod: boolean): boolean {
  if (!mod) return false;
  const lower = e.key.toLowerCase();
  if (lower !== 'z' && lower !== 'y') return false;
  // A dialog over the panel (a confirmation, Search) takes the keyboard back.
  if (openModalCount() !== 1) return false;
  const target = e.target;
  // A text field keeps the browser's own text undo; a menu in the panel keeps its keys.
  if (isTypingTarget(target) || isInMenuSurface(target)) return false;
  const panel = document.querySelector(`${PANEL} [${TAKES_HISTORY_ATTR}]`)?.closest(PANEL);
  if (!panel) return false;
  // Focus in the panel, or nowhere (the body): never in another surface the guard does not count.
  return target === document.body || (target instanceof Node && panel.contains(target));
}
