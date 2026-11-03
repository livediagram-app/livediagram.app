// Avatar mode in a busy room (docs/specs/008-canvas/avatar-mode.md "A busy room"): how often an editor sends its
// character, and how a peer's character glides between the slower steps a big room sends. The step table itself is
// the wire's (@liveworkspace/api-schema/presence-fanout), so the room's coalescing runs at the same pace.
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
