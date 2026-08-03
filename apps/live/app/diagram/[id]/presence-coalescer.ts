import type { Dispatch, SetStateAction } from 'react';
import type { AvatarPresence } from '@livediagram/api-schema';
import { trimLaserBuffer, type LaserPoint } from '@/lib/laser-buffer';
import type { LaserConfig } from '@/lib/laser-config';

export type CursorPos = { tabId: string; x: number; y: number } | null;
// The pen (spec/111) rides along with the samples so peers render the
// sender's laser rather than their own default.
export type LaserTrail = { tabId: string; points: LaserPoint[]; config?: LaserConfig };
export type AvatarEntry = { tabId: string; avatar: AvatarPresence } | null;

// Presence-packet coalescing: cursor / laser ops arrive at up to
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
  laser(from: string, incoming: { tabId: string; point: LaserPoint; config?: LaserConfig }): void;
  avatar(from: string, entry: AvatarEntry): void;
  /** Drop a pending frame on teardown, so a flush can't land after unmount. */
  cancel(): void;
};

export function createPresenceCoalescer({
  setRemoteCursors,
  setRemoteLaserTrails,
  setRemoteAvatars,
}: {
  setRemoteCursors: Dispatch<SetStateAction<Map<string, CursorPos>>>;
  setRemoteLaserTrails: Dispatch<SetStateAction<Map<string, LaserTrail>>>;
  setRemoteAvatars: Dispatch<
    SetStateAction<Map<string, { tabId: string; avatar: AvatarPresence }>>
  >;
}): PresenceCoalescer {
  const pendingCursors = new Map<string, CursorPos>();
  const pendingLasers = new Map<string, LaserTrail>();
  // Avatar mode (spec/101): the latest character snapshot per peer, or null
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
    if (pendingLasers.size > 0) {
      const trails = new Map(pendingLasers);
      pendingLasers.clear();
      setRemoteLaserTrails((prev) => {
        const next = new Map(prev);
        for (const [id, incoming] of trails) {
          const existing = next.get(id);
          // A tab switch resets the buffer for that participant —
          // otherwise a peer who lasered on tab A then started
          // lasering on tab B would briefly render an interpolated
          // line across the gap.
          const points =
            existing && existing.tabId === incoming.tabId
              ? trimLaserBuffer([...existing.points, ...incoming.points])
              : incoming.points;
          // spec/111, "Everyone sees your pen": receivers keep the LATEST
          // look per participant, so a presenter's bold amber comet looks
          // the same on every screen. The pen follows the PERSON, not the
          // tab, so a tab switch resets the points above and leaves it be;
          // a packet that carries no look keeps whatever we already had.
          //
          // This commit used to drop `config` on the floor. The op carried
          // it, the buffer parsed it, and then the trail that reached
          // LaserOverlay had only { tabId, points } — so every peer fell
          // back to DEFAULT_LASER_CONFIG and the feature was inert.
          next.set(id, {
            tabId: incoming.tabId,
            points,
            config: incoming.config ?? existing?.config,
          });
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
    laser(from, incoming) {
      // Points accumulate within the frame; a tab switch starts a fresh
      // buffer for that peer, matching what the flush does across frames.
      const buffered = pendingLasers.get(from);
      const carried = buffered && buffered.tabId === incoming.tabId ? buffered.points : [];
      pendingLasers.set(from, {
        tabId: incoming.tabId,
        points: [...carried, incoming.point],
        // Latest wins: they may change the pen mid-sweep, and a packet
        // without one keeps whatever the buffer already carried.
        config: incoming.config ?? buffered?.config,
      });
      schedule();
    },
    avatar(from, entry) {
      // Latest-wins per peer (no accumulation, unlike laser points): the
      // character has one position at a time.
      pendingAvatars.set(from, entry);
      schedule();
    },
    cancel() {
      if (presenceRafId !== null) cancelAnimationFrame(presenceRafId);
      presenceRafId = null;
    },
  };
}
