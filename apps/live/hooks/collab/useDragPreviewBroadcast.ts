'use client';

// Our drag, live for collaborators (docs/specs/008-canvas/drag-preview.md "Live movement for
// collaborators"): while our preview lasts, its changed elements' geometry goes to the room as
// presence, at most every DRAG_PREVIEW_SEND_MS, then an end message. A gesture changing more than
// DRAG_PREVIEW_MAX_ELEMENTS elements sends nothing: collaborators see it on release.

import { useEffect, useEffectEvent, type RefObject } from 'react';
import type { Element } from '@livediagram/document';
import {
  DRAG_PREVIEW_ARROW_FIELDS,
  DRAG_PREVIEW_BOX_FIELDS,
  DRAG_PREVIEW_MAX_ELEMENTS,
  type DragPreviewPatch,
  type RoomOp,
  type RoomOutgoing,
} from '@livediagram/api-schema';
import {
  localPreview,
  localPreviewEnding,
  subscribeDragPreview,
  type DragOverlay,
} from '@/lib/drag-preview';

// The cursor's rate (docs/specs/015-api/api.md).
export const DRAG_PREVIEW_SEND_MS = 33;

function patchOf(el: Element): DragPreviewPatch {
  const fields: readonly string[] =
    el.type === 'arrow' ? DRAG_PREVIEW_ARROW_FIELDS : DRAG_PREVIEW_BOX_FIELDS;
  const source = el as unknown as Record<string, unknown>;
  const patch: Record<string, unknown> = { id: el.id };
  for (const k of fields) if (source[k] !== undefined) patch[k] = source[k];
  return patch as DragPreviewPatch;
}

export function useDragPreviewBroadcast(deps: {
  roomRef: RefObject<{ send: (msg: RoomOutgoing) => void } | null>;
  // The room is open for this document (hydrated, and shared or a team's).
  live: boolean;
  activeId: string;
}): void {
  const send = useEffectEvent((op: RoomOp) => {
    deps.roomRef.current?.send({ kind: 'op', op });
  });
  const { live, activeId } = deps;

  useEffect(() => {
    if (!live) return;
    let sentTab: string | null = null;
    let lastSent = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const sendNow = (overlay: DragOverlay) => {
      timer = null;
      lastSent = Date.now();
      if (overlay.changed.size > DRAG_PREVIEW_MAX_ELEMENTS) return;
      sentTab = overlay.tabId;
      send({
        kind: 'drag-preview',
        tabId: overlay.tabId,
        patches: [...overlay.changed.values()].map(patchOf),
      });
    };
    const onChange = () => {
      const overlay = localPreview();
      if (!overlay || overlay.tabId !== activeId) {
        if (timer) clearTimeout(timer);
        timer = null;
        if (sentTab)
          send({
            kind: 'drag-preview',
            tabId: sentTab,
            end: true,
            ...(localPreviewEnding() === 'landed' ? { landed: true as const } : {}),
          });
        sentTab = null;
        return;
      }
      if (timer) return;
      const wait = lastSent + DRAG_PREVIEW_SEND_MS - Date.now();
      if (wait <= 0) sendNow(overlay);
      else
        timer = setTimeout(() => {
          const latest = localPreview();
          if (latest && latest.tabId === activeId) sendNow(latest);
          else timer = null;
        }, wait);
    };
    const unsubscribe = subscribeDragPreview(onChange);
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
      if (sentTab) send({ kind: 'drag-preview', tabId: sentTab, end: true });
    };
  }, [live, activeId]);
}
