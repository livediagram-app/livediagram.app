import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Anchor, Tab } from '@livediagram/diagram';
import type { QuickConnectDirection } from '@/lib/canvas';
import { quickConnectGroupStart, quickConnectSourceId } from '@/lib/quick-connect-source';
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
  activeTab,
  beginAnchorDrag,
}: {
  selectedId: string | null;
  activeTab: Tab;
  beginAnchorDrag: EditorDragApi['beginAnchorDrag'];
}) {
  const handleStartArrow = (direction: QuickConnectDirection, e: ReactPointerEvent) => {
    if (selectedId === null) return;
    // On a group the pluses ring the union bounds: the arrow starts PINNED
    // TO THE GROUP's union box at the picked side's centre (a pinned-group
    // endpoint, so it tracks the group as it moves), inheriting its stroke
    // from the member nearest that side. A lone element pins to its own
    // anchor as ever.
    const sourceId = quickConnectSourceId(activeTab.elements, selectedId, direction);
    const groupStart = quickConnectGroupStart(activeTab.elements, selectedId, direction);
    const fromGroup = groupStart
      ? { groupId: groupStart.groupId, point: { x: groupStart.x, y: groupStart.y } }
      : undefined;
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
      beginAnchorDrag(sourceId, anchor, e, { tapPlaceOutPx: 50, fromGroup });
      return;
    }
    beginAnchorDrag(sourceId, anchor, e, { clickToPlace: true, fromGroup });
  };

  return { handleStartArrow };
}
