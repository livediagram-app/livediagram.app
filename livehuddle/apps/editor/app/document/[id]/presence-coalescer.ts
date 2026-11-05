import type { Dispatch, SetStateAction } from 'react';
import type { AvatarPresence } from '@livehuddle/api-schema';

export type CursorPos = { tabId: string; x: number; y: number } | null;
export type AvatarEntry = { tabId: string; avatar: AvatarPresence } | null;

// Presence-packet coalescing: cursor and avatar ops arrive at up to
// 30 Hz per peer, and committing state per packet re-rendered the
// whole editor tree per message (~90 renders/s with three peers,
// while the local user is idle). Buffer them in refs and commit ONE
// Map update per animation frame — the same rAF pattern the pan and
// snap-guide paths use.
//
// One coalescer per room connection, created inside the effect so a
// reconnect starts clean, and cancelled with it.
//
// It is the only thing in the room that knows a packet is not an
// event: everything else there translates one op into one state
// change, and this deliberately does not.
export type PresenceCoalescer = {
  cursor(from: string, pos: CursorPos): void;
  avatar(from: string, entry: AvatarEntry): void;
  /**
   * Forget buffered packets from anyone not in `present` (the roster just received). A peer's last
   * cursor move often lands in the same frame as the roster that drops them; flushed after the
   * roster's prune, it would put their cursor back on every screen until the next roster.
   */
  prune(present: ReadonlySet<string>): void;
  /** Drop a pending frame on teardown, so a flush can't land after unmount. */
  cancel(): void;
};

export function createPresenceCoalescer({
  setRemoteCursors,
  setRemoteAvatars,
}: {
  setRemoteCursors: Dispatch<SetStateAction<Map<string, CursorPos>>>;
  setRemoteAvatars: Dispatch<
    SetStateAction<Map<string, { tabId: string; avatar: AvatarPresence }>>
  >;
}): PresenceCoalescer {
  const pendingCursors = new Map<string, CursorPos>();
  // Avatar mode (docs/specs/008-canvas/avatar-mode.md): the latest character snapshot per peer, or null
  // for "they left the mode". Coalesced exactly like cursors — a walking
  // avatar publishes at the same ~30 Hz.
  const pendingAvatars = new Map<string, AvatarEntry>();
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
    if (pendingAvatars.size > 0) {
      const moves = new Map(pendingAvatars);
      pendingAvatars.clear();
      setRemoteAvatars((prev) => {
        const next = new Map(prev);
        for (const [id, entry] of moves) {
          // Leaving the mode DELETES the entry rather than storing a null:
          // nothing renders a character that isn't there, so the map stays
          // exactly as big as the number of people walking around.
          if (entry) next.set(id, entry);
          else next.delete(id);
        }
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
    avatar(from, entry) {
      // Latest-wins per peer (no accumulation): the
      // character has one position at a time.
      pendingAvatars.set(from, entry);
      schedule();
    },
    prune(present) {
      for (const pending of [pendingCursors, pendingAvatars]) {
        for (const id of pending.keys()) if (!present.has(id)) pending.delete(id);
      }
    },
    cancel() {
      if (presenceRafId !== null) cancelAnimationFrame(presenceRafId);
      presenceRafId = null;
    },
  };
}
