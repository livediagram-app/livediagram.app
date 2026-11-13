'use client';

// The peers the canvas draws, read from the peer-motion store where they are drawn (lib/peer-motion.ts): a frame of
// movement renders the reader, not the editor. Each joins the latest snapshot with the coarse facts the root hands
// down, the same builders the root used to run (lib/presence-rows).
import { useCallback, useMemo } from 'react';
import { useStoreSlice } from '@liveworkspace/workbench/hooks/ui/useStoreSlice';
import type { PeerRowsSource } from '@/lib/peer-motion';
import {
  buildRemoteAvatarRows,
  buildRemoteCursorRows,
  walkerKey,
  type RemoteAvatarRow,
} from '@/lib/presence-rows';

const whole = <T>(snapshot: T): T => snapshot;

/** Peers' cursors on the active tab, joined with presence (the cursor layer). */
export function usePeerCursorRows(peers: PeerRowsSource) {
  const cursors = useStoreSlice(peers.motion.cursors, whole);
  // Who walks a character here (avatar-mode.md "Cursors while walking"): a string slice, so a step renders nothing.
  const selectWalkers = useCallback(
    (avatars: ReturnType<PeerRowsSource['motion']['avatars']['get']>) =>
      walkerKey(avatars, peers.activeId, peers.tabFocus),
    [peers],
  );
  const walkers = useStoreSlice(peers.motion.avatars, selectWalkers);
  return useMemo(
    () =>
      buildRemoteCursorRows(
        cursors,
        peers.livePresenceById,
        peers.selfId,
        peers.activeId,
        walkers ? new Set(walkers.split('\n')) : undefined,
      ),
    [cursors, peers, walkers],
  );
}

// The rows for one snapshot of the characters and one source, built once however many read them: the characters layer
// subscribes, the canvas takes by-value slices and the gestures read them when a press runs, all from the same array.
const rowsCache = new WeakMap<object, { peers: PeerRowsSource; rows: RemoteAvatarRow[] }>();
export function peerAvatarRowsOf(
  peers: PeerRowsSource,
  avatars: ReturnType<PeerRowsSource['motion']['avatars']['get']>,
): RemoteAvatarRow[] {
  const hit = rowsCache.get(avatars);
  if (hit && hit.peers === peers) return hit.rows;
  const rows = buildRemoteAvatarRows(
    avatars,
    peers.livePresenceById,
    peers.selfId,
    peers.activeId,
    peers.tabFocus,
  );
  rowsCache.set(avatars, { peers, rows });
  return rows;
}

/** Peers' characters as they are now, for a handler (a click on a peer, a seat on arrival): renders nothing. */
export function readPeerAvatarRows(peers: PeerRowsSource): RemoteAvatarRow[] {
  return peerAvatarRowsOf(peers, peers.motion.avatars.get());
}

/** Peers' characters on the active tab, joined with presence (the characters layer). */
export function usePeerAvatarRows(peers: PeerRowsSource): RemoteAvatarRow[] {
  const select = useCallback(
    (avatars: ReturnType<PeerRowsSource['motion']['avatars']['get']>) =>
      peerAvatarRowsOf(peers, avatars),
    [peers],
  );
  return useStoreSlice(peers.motion.avatars, select);
}

/**
 * A by-value fact about the peers' characters (who sits where, which pods are shut): the reader renders when the
 * fact changes, never for a frame of their walking. `select` should keep its identity (a module function or a
 * memoised one), or it selects again on every render.
 */
export function usePeerAvatarSlice<T>(
  peers: PeerRowsSource,
  select: (rows: RemoteAvatarRow[]) => T,
  equal?: (a: T, b: T) => boolean,
): T {
  const fromStore = useCallback(
    (avatars: ReturnType<PeerRowsSource['motion']['avatars']['get']>) =>
      select(peerAvatarRowsOf(peers, avatars)),
    [peers, select],
  );
  return useStoreSlice(peers.motion.avatars, fromStore, equal);
}
