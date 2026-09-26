import { useCallback, type RefObject } from 'react';
import type { ElementDelta, Tab } from '@livediagram/diagram';
import type { connectRoom } from '@/lib/api-client';
import { applyDeltaToTabs } from '@/app/diagram/[id]/room-op-apply';

// Send ONE answer / idea / checklist tick / comment change (spec/152).
//
// Applied to our own tab through the same `applyDeltaToTabs` every receiver
// runs, and sent straight down the socket rather than left to the 600 ms
// autosave: the autosave ships whole elements, which is what let two people
// pressing the same done check overwrite each other. The autosave still PUTs
// the tab to D1, and skips the whole-element broadcast when a delta was the
// only change (tabBroadcastOps). The socket strips a comment's author id on
// the way out (room.ts); our own copy keeps it, for our delete button.
//
// Through `tickTabs`, never a history commit: these are the room's answers,
// and one person's Ctrl+Z must not take them back (spec/122).
export type ApplyElementDelta = (elementId: string, delta: ElementDelta, tabId?: string) => void;

export function useElementDeltas(deps: {
  activeId: string;
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  roomRef: RefObject<ReturnType<typeof connectRoom> | null>;
}): ApplyElementDelta {
  const { activeId, tickTabs, roomRef } = deps;
  return useCallback(
    (elementId, delta, tabId = activeId) => {
      tickTabs((ts) => applyDeltaToTabs(ts, tabId, elementId, delta));
      // A no-op before the room is open, like every other send: a solo session
      // has nobody to tell, and the autosave persists the change either way.
      roomRef.current?.send({ kind: 'op', op: { kind: 'el-delta', tabId, elementId, delta } });
    },
    [activeId, tickTabs, roomRef],
  );
}
