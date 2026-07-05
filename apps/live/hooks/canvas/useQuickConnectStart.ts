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
      // Touch: drop a free arrow running straight out from the anchor (~50px)
      // and select it, so the user can drag it where they want — no
      // tap-target step.
      beginAnchorDrag(sourceId, anchor, e, { placeOutPx: 50, fromGroup });
      return;
    }
    beginAnchorDrag(sourceId, anchor, e, { clickToPlace: true, fromGroup });
  };

  return { handleStartArrow };
}
