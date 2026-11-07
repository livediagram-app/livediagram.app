// The reception bell (docs/specs/009-elements/workday-pieces.md "The wire"): a ring of a Reception Desk's bell, broadcast
// so each receiver decides whether it stands in earshot. A presence op, like a knock: never ordered, logged or
// replayed, never touching the document, from any share level.

const TAB_ID_MAX = 64;
/** A desk's element id, as long as an element id may be. */
const DESK_ID_MAX = 64;

/** One ring per this many ms per sender: the room drops a second inside the window, and the button waits it out. */
export const BELL_THROTTLE_MS = 5_000;

export type AvatarBellOp = { kind: 'avatar-bell'; tabId: string; deskId: string };

const isField = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;

/** An `avatar-bell` op as sent, or null. */
export function parseAvatarBell(op: unknown): AvatarBellOp | null {
  const o = op as Partial<Record<keyof AvatarBellOp, unknown>> | null;
  if (!o || o.kind !== 'avatar-bell') return null;
  if (!isField(o.tabId, TAB_ID_MAX) || !isField(o.deskId, DESK_ID_MAX)) return null;
  return { kind: 'avatar-bell', tabId: o.tabId, deskId: o.deskId };
}
