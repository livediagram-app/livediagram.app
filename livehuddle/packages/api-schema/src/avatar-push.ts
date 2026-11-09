// A shove's wire (docs/specs/008-canvas/avatar-mode.md "You can push each other"): the room's check on an
// `avatar-push` before it addresses it, so a hand-made one with a direction that is not a number reaches nobody.
import type { AvatarPushOp } from '@liveworkspace/api-schema/avatar';
import { PRESENCE_ID_MAX } from './call-hand';

const TAB_ID_MAX = 64;

const isField = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;

/** The checked copy of a push: its own fields only, the direction a unit vector; null for a malformed one. */
export function parseAvatarPush(op: unknown): AvatarPushOp | null {
  const o = op as Partial<Record<keyof AvatarPushOp, unknown>> | null;
  if (!o || o.kind !== 'avatar-push') return null;
  if (!isField(o.tabId, TAB_ID_MAX) || !isField(o.targetId, PRESENCE_ID_MAX)) return null;
  const { dx, dy } = o;
  if (typeof dx !== 'number' || typeof dy !== 'number') return null;
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len === 0) return null;
  return { kind: 'avatar-push', tabId: o.tabId, targetId: o.targetId, dx: dx / len, dy: dy / len };
}
