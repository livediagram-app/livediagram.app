import type { Dispatch, SetStateAction } from 'react';

export type CursorPos = { tabId: string; x: number; y: number } | null;

// Presence-packet coalescing: cursor ops arrive at up to 30 Hz per
// peer, and committing state per packet re-rendered the whole editor
// tree per message (~90 renders/s with three peers, while the local
// user is idle). Buffer them in refs and commit ONE Map update per
// animation frame — the same rAF pattern the pan and snap-guide
// paths use.
//
// One coalescer per room connection, created inside the effect so a
// reconnect starts clean, and cancelled with it.
//
// It is the only thing in the room that knows a packet is not an
// event: everything else there translates one op into one state
// change, and this deliberately does not.
export type PresenceCoalescer = {
  cursor(from: string, pos: CursorPos): void;
  /** Drop a pending frame on teardown, so a flush can't land after unmount. */
  cancel(): void;
};

export function createPresenceCoalescer({
  setRemoteCursors,
}: {
  setRemoteCursors: Dispatch<SetStateAction<Map<string, CursorPos>>>;
}): PresenceCoalescer {
  const pendingCursors = new Map<string, CursorPos>();
  let presenceRafId: number | null = null;

  const flushPresence = () => {
    presenceRafId = null;
    if (pendingCursors.size > 0) {
      const moves = new Map(pendingCursors);
      pendingCursors.clear();
      setRemoteCursors((prev) => {
        const next = new Map(prev);
        for (const [id, pos] of moves) next.set(id, pos);
        return next;
      });
    }
  };

  const schedule = () => {
    if (presenceRafId === null) presenceRafId = requestAnimationFrame(flushPresence);
  };

  return {
    cursor(from, pos) {
      pendingCursors.set(from, pos);
      schedule();
    },
    cancel() {
      if (presenceRafId !== null) cancelAnimationFrame(presenceRafId);
      presenceRafId = null;
    },
  };
}
