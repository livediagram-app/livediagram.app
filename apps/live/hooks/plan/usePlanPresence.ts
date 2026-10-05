'use client';

// Presence on Plan cards (docs/specs/025-plan/plan-board.md "What the board shows"): the card each peer
// is dragging or reading, sent as an ephemeral `plan-presence` room op and drawn as a ring in their
// colour. Peers who leave take their ring with them.
import { useCallback, useMemo, useRef, useState } from 'react';
import type { RoomOp } from '@livediagram/api-schema';
import type { PlanCardPresence } from '@/components/plan/PlanContext';

type Peer = { id: string; name: string; color: string };
type Hold = { tabId: string; itemId: string; state: 'drag' | 'view' };

export function usePlanPresence(opts: {
  activeTabId: string;
  peers: readonly Peer[];
  send: (op: RoomOp) => void;
}) {
  const { activeTabId, peers, send } = opts;
  const [holds, setHolds] = useState<ReadonlyMap<string, Hold>>(new Map());
  const lastSent = useRef<string>('');

  const receive = useCallback(
    (from: string, op: { tabId: string; itemId: string | null; state?: 'drag' | 'view' }) => {
      setHolds((prev) => {
        const next = new Map(prev);
        if (op.itemId)
          next.set(from, { tabId: op.tabId, itemId: op.itemId, state: op.state ?? 'view' });
        else next.delete(from);
        return next;
      });
    },
    [],
  );

  const publish = useCallback(
    (itemId: string | null, state: 'drag' | 'view') => {
      const key = `${activeTabId}|${itemId}|${state}`;
      if (key === lastSent.current) return;
      lastSent.current = key;
      send({ kind: 'plan-presence', tabId: activeTabId, itemId, ...(itemId ? { state } : {}) });
    },
    [activeTabId, send],
  );

  const presence = useMemo(() => {
    const byItem = new Map<string, PlanCardPresence>();
    for (const peer of peers) {
      const hold = holds.get(peer.id);
      if (!hold || hold.tabId !== activeTabId) continue;
      // A drag outranks a read when two people hold one card.
      const have = byItem.get(hold.itemId);
      if (!have || hold.state === 'drag') {
        byItem.set(hold.itemId, { name: peer.name, color: peer.color, state: hold.state });
      }
    }
    return byItem;
  }, [holds, peers, activeTabId]);

  return { presence, receive, publish };
}
