// Sending a plan's waiting card changes (docs/specs/007-editor/offline-changes.md "Sending them", "When the server says
// no"): oldest first, one request at a time, a run of field changes as one many-patch request. A request with no
// answer stops the replay (the rest keeps waiting); a refused batch goes again one change at a time, so only the
// change the server refuses is taken back.
import { ITEM_BULK_MAX, type ItemPatchOf, type ItemWrite } from '@liveplanner/items';
import type { ItemWriteAnswer } from '@/lib/api/items';
import type { PlanQueue, QueuedChange } from './plan-queue';
import { isConnectionFailure } from './reconnect';

type ItemChange = Extract<QueuedChange, { store: 'items' }>;

export type ItemBatch = { ids: string[]; write: ItemWrite; lastSeq: number };

// The next request: the oldest change, or, when it is a field change newer than `splitThrough`, it and the field
// changes straight after it with the same undo flag, up to ITEM_BULK_MAX, as one many-patch write.
export function nextItemBatch(changes: readonly ItemChange[], splitThrough: number): ItemBatch {
  const first = changes[0]!;
  const single = { ids: [first.id], write: first.write, lastSeq: first.seq };
  if (first.write.kind !== 'patch' || first.seq <= splitThrough) return single;
  const undo = first.write.undo === true;
  const run: ItemChange[] = [];
  for (const c of changes) {
    if (run.length === ITEM_BULK_MAX) break;
    if (c.write.kind !== 'patch' || (c.write.undo === true) !== undo) break;
    run.push(c);
  }
  if (run.length < 2) return single;
  const patches: ItemPatchOf[] = run.map((c) => {
    const w = c.write as Extract<ItemWrite, { kind: 'patch' }>;
    return { id: w.id, patch: w.patch };
  });
  return {
    ids: run.map((c) => c.id),
    write: { kind: 'patches', patches, ...(undo ? { undo: true as const } : {}) },
    lastSeq: run[run.length - 1]!.seq,
  };
}

// A refusal that says the change is already the server's: a card made whose answer was lost, a delete of a card
// already gone.
export function alreadyLanded(write: ItemWrite, e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  const status = (e as { status?: unknown } | null)?.status;
  if (write.kind === 'create') return code === 'item_exists';
  if (write.kind === 'delete') return code === 'item_not_found' || status === 404;
  return false;
}

export type ItemReplayDeps = {
  queue: PlanQueue;
  send: (write: ItemWrite) => Promise<ItemWriteAnswer>;
  // An answer to fold in (a whole one, or the part of a refused many-item write that landed).
  landed: (answer: ItemWriteAnswer) => void;
  // A change the server refused: tell the person and take it back.
  refused: (write: ItemWrite, e: unknown) => void;
};

// 'done' when nothing waits any more; 'stalled' when a request got no answer (what is left keeps waiting). `sent`
// counts the changes that left the queue.
export async function replayItemQueue(
  deps: ItemReplayDeps,
): Promise<{ outcome: 'done' | 'stalled'; sent: number }> {
  let splitThrough = -1;
  let sent = 0;
  for (;;) {
    const changes = deps.queue.changes('items') as ItemChange[];
    if (changes.length === 0) return { outcome: 'done', sent };
    const batch = nextItemBatch(changes, splitThrough);
    let answer: ItemWriteAnswer | null = null;
    try {
      answer = await deps.send(batch.write);
    } catch (e) {
      if (isConnectionFailure(e)) return { outcome: 'stalled', sent };
      const landed = (e as { landed?: ItemWriteAnswer } | null)?.landed;
      if (landed) deps.landed(landed);
      if (batch.ids.length > 1) {
        // Field changes are values to set, so sending any of them again is safe.
        splitThrough = batch.lastSeq;
        continue;
      }
      if (!alreadyLanded(batch.write, e)) deps.refused(batch.write, e);
    }
    // Folded in outside the try: a failure there is the editor's, never a missing connection.
    if (answer) deps.landed(answer);
    deps.queue.remove(batch.ids);
    sent += batch.ids.length;
  }
}
