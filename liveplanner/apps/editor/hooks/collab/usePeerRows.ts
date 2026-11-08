'use client';

// The peers' cursors the canvas draws, read from the peer-motion store where they are drawn (lib/peer-motion.ts): a
// frame of movement renders the cursor layer, not the editor. It joins the latest snapshot with the coarse facts the
// root hands down, the same builder the root used to run (lib/presence-rows).
import { useMemo } from 'react';
import { useStoreSlice } from '@liveworkspace/workbench/hooks/ui/useStoreSlice';
import type { PeerRowsSource } from '@/lib/peer-motion';
import { buildRemoteCursorRows } from '@/lib/presence-rows';

const whole = <T>(snapshot: T): T => snapshot;

/**
 * Peers' cursors on the active tab, joined with presence; none while a vote hides them (docs/specs/012-collaboration/
 * session-tools.md), so nobody can watch the room converge on a favourite.
 */
export function usePeerCursorRows(peers: PeerRowsSource) {
  const cursors = useStoreSlice(peers.motion.cursors, whole);
  return useMemo(
    () =>
      peers.cursorsHidden
        ? []
        : buildRemoteCursorRows(cursors, peers.livePresenceById, peers.selfId, peers.activeId),
    [cursors, peers],
  );
}
