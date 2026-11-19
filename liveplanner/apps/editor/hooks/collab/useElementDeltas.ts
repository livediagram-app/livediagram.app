import { useCallback, type RefObject } from 'react';
import type { ElementDelta, Tab } from '@liveplanner/project';
import type { connectRoom } from '@/lib/api-client';
import type { RoomOutgoing } from '@liveplanner/api-schema';
import { sendOrHold, type PreRoomOutbox } from '@liveworkspace/workbench/lib/pre-room-outbox';
import { applyDeltaToTabs } from '@/app/project/[id]/room-op-apply';

// Send ONE answer / checklist tick / comment change (docs/specs/012-collaboration/collab-race-hardening.md).
//
// Applied to our own tab through the same `applyDeltaToTabs` every receiver
// runs, and sent straight down the socket rather than left to the 600 ms
// autosave: the autosave ships whole elements, which is what let two people
// pressing the same temperature check overwrite each other. The autosave still PUTs
// the tab to D1, and skips the whole-element broadcast when a delta was the
// only change (tabBroadcastOps). The socket strips a comment's author id on
// the way out (room.ts); our own copy keeps it, for our delete button.
//
// Through `tickTabs`, never a history commit: these are the room's answers,
// and one person's Ctrl+Z must not take them back (docs/specs/012-collaboration/participant-responses.md).
export type ApplyElementDelta = (elementId: string, delta: ElementDelta, tabId?: string) => void;

export function useElementDeltas(deps: {
  activeId: string;
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  roomRef: RefObject<ReturnType<typeof connectRoom> | null>;
  // Holds a delta sent before the room client exists, for the room about to open (pre-room-outbox).
  preRoomOutbox: PreRoomOutbox<RoomOutgoing>;
}): ApplyElementDelta {
  const { activeId, tickTabs, roomRef, preRoomOutbox } = deps;
  return useCallback(
    (elementId, delta, tabId = activeId) => {
      tickTabs((ts) => applyDeltaToTabs(ts, tabId, elementId, delta));
      // Before the room client exists (the page just opened) it is held and sent as the room is made, so peers
      // already in the room still see it; a solo session has nobody to tell, and the autosave persists it either way.
      sendOrHold(preRoomOutbox, roomRef.current, {
        kind: 'op',
        op: { kind: 'el-delta', tabId, elementId, delta },
      });
    },
    [activeId, tickTabs, roomRef, preRoomOutbox],
  );
}
