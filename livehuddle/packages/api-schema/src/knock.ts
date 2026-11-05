// Knock (docs/specs/012-collaboration/knock.md "The wire"): a knock on a Room or an Office Pod, broadcast so each
// receiver decides whether it stands inside, and the answer, addressed to the knocker alone. Both are presence ops:
// never ordered, logged or replayed, never touching the document, from any share level.
import { PRESENCE_ID_MAX } from './call-hand';

const TAB_ID_MAX = 64;
/** A room's or pod's element id, as long as an element id may be. */
const ROOM_ID_MAX = 64;

/** One knock per this many ms per sender: the room drops a second inside the window, and the button waits it out. */
export const KNOCK_THROTTLE_MS = 10_000;

export type AvatarKnockOp = { kind: 'avatar-knock'; tabId: string; roomId: string };

export type KnockAnswer = 'in' | 'later';
export type AvatarKnockAnswerOp = {
  kind: 'avatar-knock-answer';
  tabId: string;
  targetId: string;
  roomId: string;
  answer: KnockAnswer;
};

const isField = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;

/** An `avatar-knock` op as sent, or null. */
export function parseAvatarKnock(op: unknown): AvatarKnockOp | null {
  const o = op as Partial<Record<keyof AvatarKnockOp, unknown>> | null;
  if (!o || o.kind !== 'avatar-knock') return null;
  if (!isField(o.tabId, TAB_ID_MAX) || !isField(o.roomId, ROOM_ID_MAX)) return null;
  return { kind: 'avatar-knock', tabId: o.tabId, roomId: o.roomId };
}

/** An `avatar-knock-answer` op as sent, or null. */
export function parseAvatarKnockAnswer(op: unknown): AvatarKnockAnswerOp | null {
  const o = op as Partial<Record<keyof AvatarKnockAnswerOp, unknown>> | null;
  if (!o || o.kind !== 'avatar-knock-answer') return null;
  if (!isField(o.tabId, TAB_ID_MAX) || !isField(o.roomId, ROOM_ID_MAX)) return null;
  if (!isField(o.targetId, PRESENCE_ID_MAX)) return null;
  if (o.answer !== 'in' && o.answer !== 'later') return null;
  return {
    kind: 'avatar-knock-answer',
    tabId: o.tabId,
    targetId: o.targetId,
    roomId: o.roomId,
    answer: o.answer,
  };
}

/**
 * The room's throttle: whether a knock from `sender` at `now` may pass, noting it when it does. Bounded by the
 * connections in the room (the caller forgets a sender when its socket closes) and pruned of stale entries as it goes.
 */
export function createKnockThrottle(windowMs = KNOCK_THROTTLE_MS) {
  const last = new Map<string, number>();
  return {
    allow(sender: string, now: number): boolean {
      const at = last.get(sender);
      if (at !== undefined && now - at < windowMs) return false;
      last.set(sender, now);
      if (last.size > 256) for (const [id, t] of last) if (now - t >= windowMs) last.delete(id);
      return true;
    },
    forget(sender: string): void {
      last.delete(sender);
    },
  };
}
