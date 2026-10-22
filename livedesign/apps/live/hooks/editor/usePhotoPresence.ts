'use client';

// Who is on which layer of a photo page (docs/specs/031-photo/photo-pages.md "Collaboration"): someone who may
// edit says the layer they have active as an ephemeral `photo-presence` room op, and the Layers tab marks
// each layer with the avatars of the peers on it. Peers who leave take their mark with them; a late joiner
// hears the layers already held.
import { useCallback, useMemo } from 'react';
import type { RoomOp } from '@livedesign/api-schema';
import { usePresenceHolds } from '@/hooks/collab/usePresenceHolds';

type Peer = { id: string; name: string; color: string };
type Hold = { tabId: string; pageId: string; layerId: string };
export type PhotoLayerPeer = { name: string; colour: string };

export type PhotoPresence = {
  // Say the layer this person has active on a page (null: none).
  publish: (pageId: string | null, layerId: string | null) => void;
  // The peers on a layer of a page.
  on: (pageId: string, layerId: string) => readonly PhotoLayerPeer[];
};

const NONE: readonly PhotoLayerPeer[] = [];

export function usePhotoPresence(opts: {
  activeTabId: string;
  peers: readonly Peer[];
  send: (op: RoomOp) => void;
}) {
  const { activeTabId, peers } = opts;
  const { holds, receive: hear, say, reannounce } = usePresenceHolds<Hold>(opts);

  const receive = useCallback(
    (from: string, op: { tabId: string; pageId: string; layerId: string | null }) =>
      hear(from, op.layerId ? { tabId: op.tabId, pageId: op.pageId, layerId: op.layerId } : null),
    [hear],
  );

  const publish = useCallback(
    (pageId: string | null, layerId: string | null) => {
      const holding = !!pageId && !!layerId;
      say(
        {
          kind: 'photo-presence',
          tabId: activeTabId,
          pageId: pageId ?? '',
          layerId: holding ? layerId : null,
        },
        holding ? `${activeTabId}|${pageId}|${layerId}` : '',
        holding,
      );
    },
    [activeTabId, say],
  );

  // The peers on each layer, by `page|layer`, in presence order.
  const byLayer = useMemo(() => {
    const map = new Map<string, PhotoLayerPeer[]>();
    for (const peer of peers) {
      const hold = holds.get(peer.id);
      if (!hold || hold.tabId !== activeTabId) continue;
      const key = `${hold.pageId}|${hold.layerId}`;
      map.set(key, [...(map.get(key) ?? []), { name: peer.name, colour: peer.color }]);
    }
    return map;
  }, [holds, peers, activeTabId]);

  const presence: PhotoPresence = useMemo(
    () => ({ publish, on: (pageId, layerId) => byLayer.get(`${pageId}|${layerId}`) ?? NONE }),
    [publish, byLayer],
  );

  return { presence, receive, reannounce };
}
