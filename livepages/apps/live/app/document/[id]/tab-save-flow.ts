import { diffToElementOps, ledgerKey, type ElementOp, type Tab } from '@livepages/document';
import type { RoomOp, RoomOutgoing } from '@livepages/api-schema';
import { tabBroadcastOps } from './tab-broadcast-ops';
import { holdOwnWrites, type OwnElementWrites } from './own-element-writes';

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
//
// The save's ops, derived at the snapshot, and (with `writes`) the elements they write held from that moment
// until the room sequences them (own-element-writes.ts), so a peer's update of one of them that the room ordered
// first is not shown over ours. Taken when the snapshot is, not when a queued save gets to run.
export type PreparedTabSave = { ops: RoomOp[]; release: (() => void) | null };

export function prepareTabSave(
  before: Tab | undefined,
  tab: Tab,
  writes?: OwnElementWrites,
): PreparedTabSave {
  const ops = tabBroadcastOps(before, tab);
  if (!writes) return { ops, release: null };
  const elementOps = ops.flatMap((op) => (op.kind === 'el' ? [op.op] : []));
  return { ops, release: holdOwnWrites(writes, tab.id, elementOps) };
}

export async function saveTabAndRelay<R>(
  before: Tab | undefined,
  tab: Tab,
  room: () => SaveRoom | null,
  put: () => Promise<R>,
  prepared: PreparedTabSave = prepareTabSave(before, tab),
): Promise<R> {
  const { ops, release } = prepared;
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
  let saved: R;
  try {
    saved = await put();
  } catch (err) {
    // Nothing was sent: the hold goes, and the retry carries the change.
    release?.();
    throw err;
  }
  relay(rest, room(), release);
  return saved;
}

// Sends the ops in order. Held element ops go through `sequence`, and the hold is released once the room has
// answered for every one of them (sequenced, or unable to say).
function relay(ops: RoomOp[], live: SaveRoom | null, release: (() => void) | null): void {
  if (!live || !release) {
    for (const op of ops) live?.send({ kind: 'op', op });
    release?.();
    return;
  }
  const answers: Promise<boolean>[] = [];
  for (const op of ops) {
    if (op.kind === 'el') answers.push(live.sequence(op));
    else live.send({ kind: 'op', op });
  }
  void Promise.allSettled(answers).then(release);
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
  writes?: OwnElementWrites,
): Promise<null> {
  const live = room();
  if (!live) throw new Error('participant save: the room is not open');
  const ops = participantElementOps(before, tab);
  const release = writes ? holdOwnWrites(writes, tab.id, ops) : null;
  relay(
    ops.map((op) => ({ kind: 'el', tabId: tab.id, op })),
    live,
    release,
  );
  return null;
}
