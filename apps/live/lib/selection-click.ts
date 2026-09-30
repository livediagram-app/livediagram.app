// The click rules of selection (docs/specs/008-canvas/canvas-and-palette.md "Selection" and
// "Marquee box-select"; blueprint docs/specs/008-canvas/blueprints/selection-clicks.md).
//
// Only Shift adds to or takes from a selection. A plain click (a press and
// release without a drag) on a member of a multi-selection selects that member
// alone, and one on the only selected element deselects it. The press itself
// still starts the drag, so the click can only be settled on the release.

import { LONG_PRESS_MS } from '@/hooks/ui/useLongPress';
import { isDragTravel } from './press-gestures';

export type SelectionSnapshot = {
  selectedId: string | null;
  multiSelectedIds: ReadonlySet<string>;
};

export type PlainClickOutcome = 'select-alone' | 'deselect';

/** The element is the whole selection: the single selection, or a multi-selection of one. */
export function isOnlySelected(sel: SelectionSnapshot, id: string): boolean {
  const multi = sel.multiSelectedIds;
  if (multi.size === 0) return sel.selectedId === id;
  return multi.size === 1 && multi.has(id);
}

/** What a plain click on `id` does to the selection. */
export function plainClickOutcome(sel: SelectionSnapshot, id: string): PlainClickOutcome {
  return isOnlySelected(sel, id) ? 'deselect' : 'select-alone';
}

export type ClickPointer = {
  clientX: number;
  clientY: number;
  timeStamp: number;
  pointerId: number;
  pointerType: string;
};

/** Whether `release` ends `press` as a click: same pointer, no drag travel, and
 *  on touch not held into the long-press, whose context menu owns that press. */
export function isPlainClick(press: ClickPointer, release: ClickPointer): boolean {
  if (release.pointerId !== press.pointerId) return false;
  if (isDragTravel(release.clientX - press.clientX, release.clientY - press.clientY)) return false;
  if (press.pointerType === 'touch' && release.timeStamp - press.timeStamp >= LONG_PRESS_MS) {
    return false;
  }
  return true;
}

/** Waits for this press's release and calls `onClick` when it was a plain
 *  click. A cancelled press (a pinch, a lost pointer) is never a click. */
export function armPlainClick(press: ClickPointer, onClick: () => void): void {
  const done = () => {
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== press.pointerId) return;
    done();
    if (isPlainClick(press, e)) onClick();
  };
  const onCancel = (e: PointerEvent) => {
    if (e.pointerId === press.pointerId) done();
  };
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
}
