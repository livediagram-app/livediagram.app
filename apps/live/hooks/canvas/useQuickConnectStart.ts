import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Anchor } from '@livediagram/diagram';
import type { QuickConnectDirection } from '@/lib/canvas';
import type { EditorDragApi } from './useEditorDrag.types';

// Quick add + connect Arrow starter (spec/09), lifted out of
// EditorCanvasHost. Desktop (mouse / pen): make a pinned→free arrow
// from the picked side's anchor in click-to-place mode — a plain click
// then has the endpoint trail the cursor until the next click lands it
// (a press-drag still works too). Touch: no hover, so arm the
// click-to-connect gesture (the next shape tap sets the other end),
// reusing addArrow's connect-from-selection path.
export function useQuickConnectStart({
  selectedId,
  beginAnchorDrag,
}: {
  selectedId: string | null;
  beginAnchorDrag: EditorDragApi['beginAnchorDrag'];
}) {
  const handleStartArrow = (direction: QuickConnectDirection, e: ReactPointerEvent) => {
    if (selectedId === null) return;
    // The arrow pins to the picked side's anchor; its stroke is the tab
    // theme's, like every drawn connector.
    const anchor: Anchor =
      direction === 'right' ? 'e' : direction === 'left' ? 'w' : direction === 'below' ? 's' : 'n';
    if (e.pointerType === 'touch') {
      // Touch enters a REAL drag, like the desktop press-drag: drag from the +
      // onto another shape and the arrow connects to it. It used to commit a
      // 50px free stub and return, so a drag had nothing to drag — the arrow
      // was already placed before the finger moved.
      //
      // A plain TAP still has to mean something, so the gesture carries a
      // fallback: on a release that never moved, the pointer-up attaches the
      // far end to whatever sits on that side, or drops the old stub when
      // there's nothing there.
      beginAnchorDrag(selectedId, anchor, e, { tapPlaceOutPx: 50 });
      return;
    }
    beginAnchorDrag(selectedId, anchor, e, { clickToPlace: true });
  };

  return { handleStartArrow };
}
