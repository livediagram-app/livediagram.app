// The sheet store's part in the plan's queue of waiting changes (docs/specs/007-editor/offline-changes.md; blueprint
// offline-changes.md "Sheets"): whether a change joins it now, keeping one (as the session's role allows), letting
// one go once settled, and the wait before trying again.
import type { SheetWrite } from '@liveplanner/sheets';
import { getOnline } from '@liveworkspace/workbench/lib/online-status';
import type { PlanQueue, QueuedChange, SheetWriteFlags } from '@/lib/offline-queue/plan-queue';
import { sheetOpMayWait, type SheetQueueRights } from '@/lib/offline-queue/queue-roles';
import { waitOrReconnect } from '@/lib/offline-queue/reconnect';
import { SHEET_WRITE_RETRY_MAX_MS, sheetWriteRetryMs } from './sheet-write-retry';

export type SheetChange = Extract<QueuedChange, { store: 'sheets' }>;

export type SheetQueueDeps = { queue?: PlanQueue | null; rights?: SheetQueueRights };

// One change's parts, as SheetStore.writeAll plans them.
export type PlannedSheetWrite = {
  sheetId: string;
  parts: SheetWrite[];
  ids: { wid: string; seq: number }[];
};

export class SheetQueueKeeper {
  private readonly deps: () => SheetQueueDeps;
  private readonly wait: (ms: number) => Promise<void>;

  constructor(deps: () => SheetQueueDeps, wait: (ms: number) => Promise<void>) {
    this.deps = deps;
    this.wait = wait;
  }

  /** Whether a change made now joins the queue at once: offline, or older sheet changes already wait. O(1). */
  waitsNow(): boolean {
    const queue = this.deps().queue;
    return !!queue && (!getOnline() || queue.count('sheets') > 0);
  }

  /** Keeps a change in the queue when this session may (its role); false only when the queue is full. A change the
   *  role may not keep still goes from this tab's memory. */
  keep(change: SheetChange): boolean {
    const { queue, rights } = this.deps();
    if (!queue) return true;
    const write = change.op === 'write' ? change.write : undefined;
    if (!sheetOpMayWait(rights ?? { cells: false, shape: false }, change.op, write)) return true;
    return queue.add(change) === 'ok';
  }

  /** Every part of a change into the queue, or none of them. */
  keepAll(plan: readonly PlannedSheetWrite[], flags: SheetWriteFlags): boolean {
    const kept: string[] = [];
    for (const { sheetId, parts, ids } of plan) {
      for (let i = 0; i < parts.length; i++) {
        const { wid, seq } = ids[i]!;
        const change: SheetChange = {
          id: wid,
          seq,
          store: 'sheets',
          op: 'write',
          sheetId,
          write: parts[i]!,
          flags,
        };
        if (!this.keep(change)) {
          this.deps().queue?.remove(kept);
          return false;
        }
        kept.push(wid);
      }
    }
    return true;
  }

  /** A change settled (stored, refused, or confirmed by the room): it waits no more. O(1) when nothing waits. */
  forget(id: string): void {
    this.deps().queue?.remove([id]);
  }

  /** The changes a reload kept, oldest first. */
  kept(): SheetChange[] {
    return (this.deps().queue?.changes('sheets') ?? []) as SheetChange[];
  }

  /** The wait before trying again: doubling while the browser says it is online, the longest wait while it says it
   *  is offline; either cut short when the connection may be back. */
  pause(attempt: number): Promise<void> {
    const ms = getOnline() ? sheetWriteRetryMs(attempt) : SHEET_WRITE_RETRY_MAX_MS;
    return waitOrReconnect(ms, this.wait);
  }
}
