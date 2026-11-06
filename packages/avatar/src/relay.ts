// Avatar mode in a busy room (docs/specs/008-canvas/avatar-mode.md "A busy room"): how often an editor sends its
// character, how a peer's character glides between the slower steps a big room sends, and when a packet carries the
// costume. The step table itself is the wire's (@liveworkspace/api-schema/presence-fanout), so the room's coalescing
// runs at the same pace.
import {
  AVATAR_COSTUME_REFRESH_MS,
  leanAvatarPacket,
  type AvatarConfig,
  type AvatarPacket,
} from '@liveworkspace/api-schema/avatar';
import { PRESENCE_QUIET_ROOM, presenceStepMs } from '@liveworkspace/api-schema/presence-fanout';
import { AVATAR_SPEED } from './walk';

/** How often (ms) an editor sends its walking character in a room of `roomSize` people, itself included. */
export function avatarSendIntervalMs(roomSize: number): number {
  return presenceStepMs(roomSize);
}

/**
 * How long (ms) a peer's character takes to slide to each new position it is sent, or 0 to jump there. A room of up
 * to 10 sends about 30 a second and draws each one where it lands, as it always has; a bigger room sends fewer, and
 * a step of 13 to 17 canvas px would read as a stutter, so the character covers it over one step instead.
 */
export function avatarGlideMs(roomSize: number): number {
  return roomSize > PRESENCE_QUIET_ROOM ? presenceStepMs(roomSize) : 0;
}

/**
 * Whether a peer's move from `from` to `to` glides over `glideMs`: only while they walk, and only as far as a walk
 * covers in two steps. Anything further is a jump (a portal, a pad, a seat) and lands at once.
 */
export function avatarGlides(
  from: { x: number; y: number },
  to: { x: number; y: number },
  glideMs: number,
  walking: boolean,
): boolean {
  if (glideMs <= 0 || !walking) return false;
  const reach = (AVATAR_SPEED * glideMs * 2) / 1000;
  return Math.hypot(to.x - from.x, to.y - from.y) <= reach;
}

/**
 * The sending side of "The costume rides only when it is needed" (docs/specs/008-canvas/avatar-mode.md "A busy
 * room"), one per room connection. `pack` turns each outgoing character into its lean packet, carrying the costume
 * only when a peer may not have it yet: the first packet (since `reset`: a new socket, or leaving the mode), the
 * first on a new tab, a changed costume, someone new in the roster (`noteRoster`), or AVATAR_COSTUME_REFRESH_MS since
 * it last rode.
 */
export type AvatarPacker = {
  pack(tabId: string, packet: AvatarPacket): AvatarPacket;
  /** The roster's presence ids, from each roster frame: a new one is due the costume. */
  noteRoster(ids: Iterable<string>): void;
  /** Nothing has been sent on this socket yet, or the character left the mode: the next packet carries it all. */
  reset(): void;
};

// A costume as one comparable string; '' for none.
const costumeKey = (config: AvatarConfig | undefined): string =>
  config ? `${config.gender}|${config.clothing}|${config.hair}|${config.size}` : '';

export function createAvatarPacker(now: () => number = () => Date.now()): AvatarPacker {
  // What the last packet that carried the costume carried, where, when, and how many joins had been seen by then.
  let sent: { costume: string; tabId: string; at: number; joins: number } | null = null;
  let roster = new Set<string>();
  let joins = 0;
  return {
    pack(tabId, packet) {
      const costume = costumeKey(packet.config);
      const at = now();
      const due =
        sent === null ||
        sent.costume !== costume ||
        sent.tabId !== tabId ||
        sent.joins !== joins ||
        at - sent.at >= AVATAR_COSTUME_REFRESH_MS;
      if (due) sent = { costume, tabId, at, joins };
      return leanAvatarPacket(packet, due);
    },
    noteRoster(ids) {
      const next = new Set(ids);
      for (const id of next) {
        if (!roster.has(id)) {
          joins++;
          break;
        }
      }
      roster = next;
    },
    reset() {
      sent = null;
    },
  };
}
