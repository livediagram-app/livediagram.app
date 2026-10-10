import { diffToElementOps, ledgerKey, type ElementOp, type Tab } from '@livediagram/document';
import type { RoomOp, RoomOutgoing } from '@livediagram/api-schema';
import { tabBroadcastOps } from './tab-broadcast-ops';

// What one tab's save needs of the realtime room: read when it is used, since a reconnect replaces it.
// `sequence` sends an op and resolves true once the room has sequenced it, false when it can't say.
export type SaveRoom = {
  send: (msg: RoomOutgoing) => void;
  sequence: (op: RoomOp) => Promise<boolean>;
};

// Save one tab and tell the room what changed (docs/specs/012-collaboration/collab-race-hardening.md).
//
// The ops are derived NOW, against what peers have at the snapshot (`before`), not when the PUT lands:
// by then the baseline may hold a peer's newer copy of an element, and diffing our snapshot against it
// would broadcast our older copy over theirs.
//
// The ops the room's ledger records (a Plan board's `board` delta) go FIRST, and the write waits for the
// room to sequence them: a peer's save that lands after ours then merges them from the ledger. Sent after
// the write, a peer saving at the same moment wrote before the ledger had them and erased them from D1.
// Element ops still follow the write, so peers never hold an element D1 has not.
export async function saveTabAndRelay<R>(
  before: Tab | undefined,
  tab: Tab,
  room: () => SaveRoom | null,
  put: () => Promise<R>,
): Promise<R> {
  const ops = tabBroadcastOps(before, tab);
  const deltas = ops.filter((op) => ledgerKey(op) !== null);
  const rest = ops.filter((op) => ledgerKey(op) === null);
  const live = room();
  if (live && deltas.length > 0) {
    const confirmed = await Promise.all(deltas.map((op) => live.sequence(op)));
    if (confirmed.includes(false)) {
      console.warn('[autosave] room did not confirm the deltas before the save', {
        tabId: tab.id,
        deltas: deltas.length,
        confirmed: confirmed.filter(Boolean).length,
      });
    }
  }
  const saved = await put();
  for (const op of rest) room()?.send({ kind: 'op', op });
  return saved;
}

// A Participant's save (docs/specs/013-workspace/share-roles.md "Integrity"): no tab PUT, no tab or metadata op,
// only the element changes since `before`, sent to the room, which applies each through the participant content
// rule and writes D1 itself. A reorder is never sent: a Participant never restacks. With the room closed the save
// fails, and the autosave retries it as any failed save.
export function participantElementOps(before: Tab | undefined, tab: Tab): ElementOp[] {
  return diffToElementOps(before?.elements ?? [], tab.elements).filter(
    (op) => op.kind !== 'reorder',
  );
}

export async function relayParticipantChanges(
  before: Tab | undefined,
  tab: Tab,
  room: () => SaveRoom | null,
): Promise<null> {
  const live = room();
  if (!live) throw new Error('participant save: the room is not open');
  for (const op of participantElementOps(before, tab)) {
    live.send({ kind: 'op', op: { kind: 'el', tabId: tab.id, op } });
  }
  return null;
}
