'use client';

// What each peer has their hands on, said through an ephemeral room op and never stored: a photo page's
// layer (usePhotoPresence). A hold is said when it changes and a release
// only after a hold, so someone who never holds anything sends nothing; the room keeps no holds, so a holder
// says its hold again when someone new joins and when its own connection rejoins. A peer who leaves the
// presence list takes their hold with them when the caller reads holds by its peers.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomOp } from '@livedesign/api-schema';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

export function usePresenceHolds<H>(opts: {
  peers: readonly { id: string }[];
  send: (op: RoomOp) => void;
}) {
  const { peers } = opts;
  // Read at send time, so the publisher keeps one identity across renders.
  const send = useLatest(opts.send);
  const [holds, setHolds] = useState<ReadonlyMap<string, H>>(new Map());
  const lastSent = useRef('');
  // What this person holds now, to say again to a late joiner; null while holding nothing.
  const held = useRef<RoomOp | null>(null);
  // The peers already told, by presence id: a new id is someone who joined (or rejoined) since.
  const told = useRef<ReadonlySet<string>>(new Set());

  // A peer's hold (null: they let go).
  const receive = useCallback((from: string, hold: H | null) => {
    setHolds((prev) => {
      const next = new Map(prev);
      if (hold) next.set(from, hold);
      else next.delete(from);
      return next;
    });
  }, []);

  // Say this person's hold: `key` names it, so the same hold is said once; `holding` is false for a release,
  // which is said only after a hold.
  const say = useCallback(
    (op: RoomOp, key: string, holding: boolean) => {
      if (!holding && !held.current) return;
      if (key === lastSent.current) return;
      lastSent.current = key;
      held.current = holding ? op : null;
      send.current(op);
    },
    [send],
  );

  // Say the hold again: to a peer who just joined, or after this connection rejoined. Nothing while holding
  // nothing.
  const reannounce = useCallback(() => {
    if (held.current) send.current(held.current);
  }, [send]);

  // Someone new in the presence list hears what is held: one op per join, from holders only.
  useEffect(() => {
    const ids = new Set(peers.map((p) => p.id));
    const joined = [...ids].some((id) => !told.current.has(id));
    told.current = ids;
    if (joined) reannounce();
  }, [peers, reannounce]);

  return { holds, receive, say, reannounce };
}
