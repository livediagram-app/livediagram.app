'use client';

// Our drag, live for collaborators (docs/specs/008-canvas/drag-preview.md "Live movement for
// collaborators"): while our preview lasts, its changed elements' geometry goes to the room as
// presence, at most every DRAG_PREVIEW_SEND_MS, then an end message. A gesture changing more than
// DRAG_PREVIEW_MAX_ELEMENTS elements sends the one offset most of them ride instead (a ride), with the ids
// riding it now and then; one whose other elements are still too many sends nothing, and collaborators see it
// on release. A preview held still is sent again every DRAG_PREVIEW_RIDE_IDS_MS, so it outlives a collaborator's
// PEER_PREVIEW_EXPIRY_MS (D130).

import { useEffect, useEffectEvent, type RefObject } from 'react';
import { elementIndexFor, isBoxed, type Element } from '@livediagram/document';
import {
  DRAG_PREVIEW_ARROW_FIELDS,
  DRAG_PREVIEW_BOX_FIELDS,
  DRAG_PREVIEW_MAX_ELEMENTS,
  DRAG_PREVIEW_MAX_RIDE_IDS,
  type DragPreviewPatch,
  type RoomOp,
  type RoomOutgoing,
} from '@livediagram/api-schema';
import {
  localPreview,
  localPreviewBase,
  localPreviewEnding,
  subscribeDragPreview,
  type DragOverlay,
} from '@/lib/drag-preview';
import { ridingElements, type RideOffset } from '@liveworkspace/workbench/lib/drag-ride';

// The cursor's rate (docs/specs/015-api/api.md).
export const DRAG_PREVIEW_SEND_MS = 33;
// docs/specs/008-canvas/blueprints/DEFAULTS.md D128: how often a ride names its ids again though they have not
// changed, so a collaborator who joins mid-gesture, or missed the first message, sees the move within it. Also how
// often a preview held still is sent again (D130).
export const DRAG_PREVIEW_RIDE_IDS_MS = 1000;

// The ride for a very large move: the offset most changed elements ride from where the gesture found them, the
// ids riding it, and a patch for each other changed element; null when nothing rides, or what does not is too
// many to send. Linear in what the gesture changed.
export function rideOf(
  overlay: DragOverlay,
  base: readonly Element[],
): { offset: RideOffset; ids: string[]; patches: DragPreviewPatch[] } | null {
  const rides = ridingElements(overlay, elementIndexFor(base), { isBoxed });
  const tally = new Map<string, { offset: RideOffset; n: number }>();
  let best: { offset: RideOffset; n: number } | null = null;
  for (const o of rides.values()) {
    const key = `${o.dx},${o.dy}`;
    const t = tally.get(key) ?? { offset: o, n: 0 };
    t.n++;
    tally.set(key, t);
    if (!best || t.n > best.n) best = t;
  }
  if (!best) return null;
  const { offset } = best;
  const ids: string[] = [];
  const patches: DragPreviewPatch[] = [];
  for (const [id, el] of overlay.changed) {
    const o = rides.get(id);
    if (o && o.dx === offset.dx && o.dy === offset.dy) ids.push(id);
    else patches.push(patchOf(el));
  }
  if (patches.length > DRAG_PREVIEW_MAX_ELEMENTS || ids.length > DRAG_PREVIEW_MAX_RIDE_IDS)
    return null;
  return { offset, ids, patches };
}

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
    // Sends the latest preview again while the dragger holds still (D130).
    let hold: ReturnType<typeof setTimeout> | null = null;
    const stopHold = () => {
      if (hold) clearTimeout(hold);
      hold = null;
    };
    // The ids the last ride named, and when.
    let rideIds: ReadonlySet<string> | null = null;
    let rideIdsAt = 0;
    const rideOp = (overlay: DragOverlay): RoomOp | null => {
      const base = localPreviewBase();
      const ride = base ? rideOf(overlay, base) : null;
      if (!ride) return null;
      const known = rideIds;
      const name =
        known === null ||
        ride.ids.length !== known.size ||
        ride.ids.some((id) => !known.has(id)) ||
        lastSent - rideIdsAt >= DRAG_PREVIEW_RIDE_IDS_MS;
      if (name) {
        rideIds = new Set(ride.ids);
        rideIdsAt = lastSent;
      }
      return {
        kind: 'drag-preview',
        tabId: overlay.tabId,
        ride: {
          dx: ride.offset.dx,
          dy: ride.offset.dy,
          ...(name ? { ids: ride.ids } : {}),
          patches: ride.patches,
        },
      };
    };
    const sendNow = (overlay: DragOverlay) => {
      timer = null;
      lastSent = Date.now();
      let op: RoomOp | null;
      if (overlay.changed.size > DRAG_PREVIEW_MAX_ELEMENTS) op = rideOp(overlay);
      else {
        // A patch message replaces a peer's ride, so the next ride names its ids again.
        rideIds = null;
        op = {
          kind: 'drag-preview',
          tabId: overlay.tabId,
          patches: [...overlay.changed.values()].map(patchOf),
        };
      }
      stopHold();
      if (!op) return;
      sentTab = overlay.tabId;
      send(op);
      hold = setTimeout(() => {
        hold = null;
        const latest = localPreview();
        if (latest && latest.tabId === activeId && !timer) sendNow(latest);
      }, DRAG_PREVIEW_RIDE_IDS_MS);
    };
    const onChange = () => {
      const overlay = localPreview();
      if (!overlay || overlay.tabId !== activeId) {
        if (timer) clearTimeout(timer);
        timer = null;
        stopHold();
        rideIds = null;
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
      stopHold();
      if (sentTab) send({ kind: 'drag-preview', tabId: sentTab, end: true });
    };
  }, [live, activeId]);
}
