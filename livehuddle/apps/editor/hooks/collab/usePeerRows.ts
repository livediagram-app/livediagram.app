'use client';

// The peers the canvas draws, read from the peer-motion store where they are drawn (lib/peer-motion.ts): a frame of
// movement renders the reader, not the editor. Each joins the latest snapshot with the coarse facts the root hands
// down, the same builders the root used to run (lib/presence-rows).
import { useMemo } from 'react';
import { useStoreSlice } from '@liveworkspace/workbench/hooks/ui/useStoreSlice';
import type { PeerRowsSource } from '@/lib/peer-motion';
import {
  buildRemoteAvatarRows,
  buildRemoteCursorRows,
  type RemoteAvatarRow,
} from '@/lib/presence-rows';

const whole = <T>(snapshot: T): T => snapshot;

/** Peers' cursors on the active tab, joined with presence (the cursor layer). */
export function usePeerCursorRows(peers: PeerRowsSource) {
  const cursors = useStoreSlice(peers.motion.cursors, whole);
  return useMemo(
    () => buildRemoteCursorRows(cursors, peers.livePresenceById, peers.selfId, peers.activeId),
    [cursors, peers],
  );
}

/** Peers' characters on the active tab, joined with presence (the canvas and its avatar hooks). */
export function usePeerAvatarRows(peers: PeerRowsSource): RemoteAvatarRow[] {
  const avatars = useStoreSlice(peers.motion.avatars, whole);
  return useMemo(
    () =>
      buildRemoteAvatarRows(
        avatars,
        peers.livePresenceById,
        peers.selfId,
        peers.activeId,
        peers.tabFocus,
      ),
    [avatars, peers],
  );
}
