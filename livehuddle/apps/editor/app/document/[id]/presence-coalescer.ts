import type { Dispatch, SetStateAction } from 'react';
import { expandAvatarPacket, type AvatarPacket } from '@livehuddle/api-schema';
import type { CursorPos, PeerAvatar } from '@/lib/peer-motion';

export type { CursorPos } from '@/lib/peer-motion';
// A character as it arrives: full or lean (docs/specs/008-canvas/avatar-mode.md "The costume rides only when it is
// needed"). The flush fills a lean one back out with the costume last seen from that peer.
export type AvatarEntry = { tabId: string; avatar: AvatarPacket } | null;

// Presence-packet coalescing: cursor and avatar ops arrive at up to
// 30 Hz per peer, and committing state per packet re-rendered the
// whole editor tree per message (~90 renders/s with three peers,
// while the local user is idle). Buffer them in refs and commit ONE
// Map update per animation frame, the same rAF pattern the pan and
// snap-guide paths use. The commit lands in the peer-motion store
// (lib/peer-motion.ts), so even that one per frame renders only the
// cursor layer and the canvas, never the editor root.
//
// One coalescer per room connection, created inside the effect so a
// reconnect starts clean, and cancelled with it.
//
// It is the only thing in the room that knows a packet is not an
// event: everything else there translates one op into one state
// change, and this deliberately does not.
/**
 * A hidden page gets no animation frames, so while it is hidden the flush runs on this timer instead (the browser runs
 * it about once a second there). Without it, someone who walked up while the tab was hidden never reached the call,
 * so nobody heard them until the tab showed again (docs/specs/012-collaboration/proximity-audio.md "Someone who
 * arrives later").
 */
export const HIDDEN_FLUSH_MS = 250;

const pageHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

export type PresenceCoalescer = {
  cursor(from: string, pos: CursorPos): void;
  avatar(from: string, entry: AvatarEntry): void;
  /**
   * Forget buffered packets from anyone not in `present` (the roster just received). A peer's last
   * cursor move often lands in the same frame as the roster that drops them; flushed after the
   * roster's prune, it would put their cursor back on every screen until the next roster.
   */
  prune(present: ReadonlySet<string>): void;
  /** Drop a pending frame or timer on teardown, so a flush can't land after unmount. */
  cancel(): void;
};

export function createPresenceCoalescer({
  setRemoteCursors,
  setRemoteAvatars,
}: {
  setRemoteCursors: Dispatch<SetStateAction<Map<string, CursorPos>>>;
  setRemoteAvatars: Dispatch<SetStateAction<Map<string, PeerAvatar>>>;
}): PresenceCoalescer {
  const pendingCursors = new Map<string, CursorPos>();
  // Avatar mode (docs/specs/008-canvas/avatar-mode.md): the latest character snapshot per peer, or null
  // for "they left the mode". Coalesced exactly like cursors — a walking
  // avatar publishes at the same ~30 Hz.
  const pendingAvatars = new Map<string, AvatarEntry>();
  let presenceRafId: number | null = null;
  let hiddenTimer: ReturnType<typeof setTimeout> | null = null;

  const cancelPending = () => {
    if (presenceRafId !== null) cancelAnimationFrame(presenceRafId);
    presenceRafId = null;
    if (hiddenTimer !== null) clearTimeout(hiddenTimer);
    hiddenTimer = null;
  };

  // Only one of the two is ever pending (schedule), and the one that fired is spent.
  const flushPresence = () => {
    presenceRafId = null;
    hiddenTimer = null;
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
          // A packet that carries no costume keeps the one we last saw from them, and its resting values back.
          if (entry) {
            const known = prev.get(id)?.avatar.config;
            next.set(id, { tabId: entry.tabId, avatar: expandAvatarPacket(entry.avatar, known) });
          } else next.delete(id);
        }
        return next;
      });
    }
  };

  const schedule = () => {
    if (hiddenTimer !== null) return;
    if (pageHidden()) {
      // A frame asked for before the page hid would never come: the timer takes its place.
      if (presenceRafId !== null) cancelAnimationFrame(presenceRafId);
      presenceRafId = null;
      hiddenTimer = setTimeout(flushPresence, HIDDEN_FLUSH_MS);
      return;
    }
    presenceRafId ??= requestAnimationFrame(flushPresence);
  };
  // The page hiding with a frame pending (the last packet before it hid) moves that flush onto the timer.
  const onVisibility = () => {
    if (presenceRafId !== null && pageHidden()) schedule();
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);

  return {
    cursor(from, pos) {
      pendingCursors.set(from, pos);
      schedule();
    },
    avatar(from, entry) {
      // Latest-wins per peer (no accumulation): the
      // character has one position at a time.
      // A costume a packet held back this frame carried is kept, should the newer one carry none.
      const held = pendingAvatars.get(from);
      const config = entry?.avatar.config ?? held?.avatar.config;
      pendingAvatars.set(
        from,
        entry && config && !entry.avatar.config
          ? { tabId: entry.tabId, avatar: { ...entry.avatar, config } }
          : entry,
      );
      schedule();
    },
    prune(present) {
      for (const pending of [pendingCursors, pendingAvatars]) {
        for (const id of pending.keys()) if (!present.has(id)) pending.delete(id);
      }
    },
    cancel() {
      cancelPending();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    },
  };
}
