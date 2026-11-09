// The room's rules for the walking characters (docs/specs/015-api/api.md "A busy room bounds its presence fan-out"),
// handed to the shared presence relay (@liveworkspace/api-kit/room-presence-relay) as the `avatar` kind's track. The
// relay keeps the step and the batching; this keeps what only a walker needs:
//
//   - A character goes only to the sockets on its tab (or whose tab the room does not know yet); leaving the mode
//     (`avatar: null`) goes to everyone, so nobody keeps a ghost.
//   - The room remembers each walker's last packet, so a session that switches tab is shown where everyone on it
//     stands now, not where they stood the last time it looked. In memory only: a hibernation forgets it, and the
//     standing heartbeat fills it again.
//   - A character's costume rides only when it is needed: a lean packet (no costume, no resting values) goes as it
//     came to a socket whose `hello` said `leanAvatars: true`, and filled back out, with the costume the room last
//     saw from that walker, to one that did not (an editor from before), so it still draws the right character.
import {
  tabReaches,
  type RelayFrame,
  type RelaySession,
  type SampleOp,
  type SampleTrack,
} from '@liveworkspace/api-kit/room-presence-relay';
import {
  expandAvatarPacket,
  isLeanAvatarPacket,
  type AvatarConfig,
  type AvatarPacket,
} from '@livehuddle/api-schema';

// What the walker's rules read of a session beyond the relay's: whether its editor reads lean avatar packets.
export type AvatarRelaySession = RelaySession & { leanAvatars?: boolean };

// The most walkers the room remembers at once: a closed socket's walker is forgotten, so this only bounds what a
// missed close could leave behind (twice a full room).
export const REMEMBERED_WALKERS = 200;

type AvatarOpShape = SampleOp & { avatar?: unknown };

// One walker as the room remembers it: its tab, its last packet as relayed, the last costume it sent, and whether
// that packet was lean (so a catch-up fills it back out).
type Walker = {
  tabId: string;
  op: AvatarOpShape;
  frame: RelayFrame;
  costume: AvatarConfig | undefined;
  lean: boolean;
};

// The op's character, when it is one (an object), else null: leaving the mode, or something no editor sends.
function packetOf(op: AvatarOpShape): AvatarPacket | null {
  const avatar = op.avatar;
  return typeof avatar === 'object' && avatar !== null && !Array.isArray(avatar)
    ? (avatar as AvatarPacket)
    : null;
}

/** `op`'s frame from `from` with its character filled back out, costume and resting values, for an older editor. */
export function filledAvatarFrame(
  from: string,
  op: AvatarOpShape,
  costume: AvatarConfig | undefined,
): RelayFrame {
  const packet = packetOf(op)!;
  const payload = {
    kind: 'op' as const,
    from,
    op: { ...op, avatar: expandAvatarPacket(packet, costume) },
  };
  return { payload, serialized: JSON.stringify(payload) };
}

/** Whether a socket on `session` should be sent this `avatar` op. */
export function avatarReaches(op: AvatarOpShape, session: RelaySession | null): boolean {
  return op.avatar === null || tabReaches(op.tabId, session);
}

/** The `avatar` kind's track: one per room, as the walkers it remembers are the room's. */
export function createAvatarTrack(): SampleTrack<AvatarRelaySession> {
  const walkers = new Map<string, Walker>();

  // Remember `from`'s packet, and return the costume it now wears: its own, else the last one it sent.
  const remember = (
    from: string,
    op: AvatarOpShape,
    frame: RelayFrame,
    lean: boolean,
  ): AvatarConfig | undefined => {
    const before = walkers.get(from);
    walkers.delete(from);
    if (op.avatar === null || typeof op.tabId !== 'string') return undefined;
    const costume = packetOf(op)?.config ?? before?.costume;
    walkers.set(from, { tabId: op.tabId, op, frame, costume, lean });
    if (walkers.size > REMEMBERED_WALKERS) walkers.delete(walkers.keys().next().value!);
    return costume;
  };

  return {
    route(from, sample, frame) {
      const op = sample as AvatarOpShape;
      const packet = packetOf(op);
      const lean = packet !== null && isLeanAvatarPacket(packet);
      const costume = remember(from, op, frame, lean);
      // A lean packet filled back out, built once and only if a socket that did not ask for lean ones is sent it.
      let filled: RelayFrame | null = null;
      return {
        reaches: (session) => avatarReaches(op, session),
        frameFor: (session) =>
          lean && session?.leanAvatars !== true
            ? (filled ??= filledAvatarFrame(from, op, costume))
            : frame,
      };
    },
    // Always filled out: the switcher may never have been sent this walker's costume.
    *catchUp(selfId, session) {
      for (const [from, walker] of walkers) {
        if (from === selfId || !tabReaches(walker.tabId, session)) continue;
        yield walker.lean ? filledAvatarFrame(from, walker.op, walker.costume) : walker.frame;
      }
    },
    forget(presenceId) {
      walkers.delete(presenceId);
    },
  };
}
