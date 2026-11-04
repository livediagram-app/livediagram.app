// Raise hand's wire (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Raise hand"; blueprint "Behaviour and
// state (part 3)"): the two presence ops a stage's audience and its speakers trade, and their field-by-field parsers,
// shared by the room's gate and the editor. Presence only: a hand is never stored.

/** The longest presence id either op names: the room's other id bound. */
export const PRESENCE_ID_MAX = 64;
const TAB_ID_MAX = 64;

/**
 * Your hand, sent by its owner to the whole room: `raised`, and once someone let you speak, `letSpeak`, the presence id
 * of who did (each listener checks they still may). A lowered hand carries no `letSpeak`.
 */
export type AvatarHandOp = {
  kind: 'avatar-hand';
  tabId: string;
  raised: boolean;
  letSpeak?: string | null;
};

/**
 * Let a raised hand speak (`on`), or Done (`!on`): addressed to the hand's owner alone, as a shove is, because a
 * browser never learns its own presence id and so could not recognise one broadcast about it.
 */
export type AvatarLetSpeakOp = {
  kind: 'avatar-let-speak';
  tabId: string;
  targetId: string;
  on: boolean;
};

const isId = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;

/** An `avatar-hand` op as sent, or null. */
export function parseAvatarHand(op: unknown): AvatarHandOp | null {
  const o = op as { kind?: unknown; tabId?: unknown; raised?: unknown; letSpeak?: unknown } | null;
  if (!o || o.kind !== 'avatar-hand' || !isId(o.tabId, TAB_ID_MAX)) return null;
  if (typeof o.raised !== 'boolean') return null;
  if (!o.raised) return { kind: 'avatar-hand', tabId: o.tabId, raised: false };
  if (o.letSpeak === undefined || o.letSpeak === null) {
    return { kind: 'avatar-hand', tabId: o.tabId, raised: true };
  }
  if (!isId(o.letSpeak, PRESENCE_ID_MAX)) return null;
  return { kind: 'avatar-hand', tabId: o.tabId, raised: true, letSpeak: o.letSpeak };
}

/** An `avatar-let-speak` op as sent, or null. */
export function parseAvatarLetSpeak(op: unknown): AvatarLetSpeakOp | null {
  const o = op as { kind?: unknown; tabId?: unknown; targetId?: unknown; on?: unknown } | null;
  if (!o || o.kind !== 'avatar-let-speak' || !isId(o.tabId, TAB_ID_MAX)) return null;
  if (!isId(o.targetId, PRESENCE_ID_MAX) || typeof o.on !== 'boolean') return null;
  return { kind: 'avatar-let-speak', tabId: o.tabId, targetId: o.targetId, on: o.on };
}
