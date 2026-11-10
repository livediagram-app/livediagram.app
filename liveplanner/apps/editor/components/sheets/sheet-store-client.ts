// The editor's sheet store (docs/specs/029-sheets/sheet-store.md; blueprint sheet-store.md "Editor slice"), in the
// lazy sheet chunk: per sheet, the server's confirmed state and this person's pending writes laid over it (what
// they see), one workbook per tab, writes sent one at a time per sheet in order, undo steps, and the room's ops
// merged by rev. Writes land on ids, so pending writes rebase cleanly over anyone else's.
import { isOfflineIdSync, subscribeOfflineIds } from '@/lib/offline/offline-store';
import type { SheetCreateRequest, SheetWriteResponse } from '@liveplanner/api-schema';
import {
  applySheetWrite,
  inverseSheetWrite,
  sheetToJson,
  undoReadsNow,
  uniqueSheetTitle,
  type SheetJson,
  type SheetRejection,
  type SheetWrite,
} from '@liveplanner/sheets';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { SheetsBridge } from '@/hooks/sheets/useSheetsBridge';
import { ApiError } from '@/lib/api/core';
import { errorStatus, isTransientWriteError } from './sheet-write-retry';
import {
  PLAN_QUEUE_FULL_MESSAGE,
  nextSeq,
  planQueue,
  type SheetWriteFlags,
} from '@/lib/offline-queue/plan-queue';
import { type SheetChange } from './sheet-store-queue';
import { SheetStoreBase } from './sheet-store-base';
import { keysOf, plannedWrites, undoWrites, withReaders } from './sheet-store-writes';
import type { Inverse, Pending, SheetStoreDeps, WriteOpts } from './sheet-store-types';

// The store's shapes, refusal messages, write planning and its confirmed state (reading, loading, the workbooks and
// what lands from the server or the room, sheet-store-base.ts) live in their own modules; this entry keeps every
// export.
export { sheetRefusalMessage, writeRefusalMessage } from './sheet-store-messages';
export { SHEET_REFETCH_DEBOUNCE_MS } from './sheet-store-base';
export type { TabStatus } from './sheet-store-types';

// A new tab's sheet waiting for the tab to be saved: retried this many times, this much longer each time
// (docs/specs/029-sheets/sheet-store.md "Changing a sheet"). Safe range 2..6 and 300..2000 ms.
const CREATE_TAB_RETRIES = 4;
const CREATE_TAB_RETRY_MS = 800;

export class SheetStore extends SheetStoreBase {
  constructor(deps: SheetStoreDeps) {
    super(deps);
    // The project synced to the server in place (docs/specs/006-project/offline-mode.md "Syncing in
    // place"): every loaded tab is read again from the server, so the confirmed revisions are its own.
    // The store lives for the session, as does this subscription.
    subscribeOfflineIds((id) => {
      if (id === this.deps.scope.projectId) this.resync();
    });
    // Back online: every loaded tab is read again, as a rejoin does, so a room connection that outlived the outage
    // cannot leave a sheet behind (offline-changes.md "Then a refresh"). Waiting sends are cut short on their own.
    if (typeof window !== 'undefined') window.addEventListener('online', () => this.resync());
    this.restore();
  }

  // ---- Writing -----------------------------------------------------------------------------------------

  // Make a sheet (placing a Sheet element, a copy, a CSV drop): in the store at once, then sent.
  // `onRefused` may take a refusal over (returning true): the default says it in a toast.
  create(
    create: SheetCreateRequest & { id: string },
    seed?: SheetJson,
    opts: { onRefused?: (code: string | null) => boolean; onCreated?: () => void } = {},
  ): void {
    const now = Date.now();
    const json: SheetJson = seed ?? {
      id: create.id,
      tabId: create.tabId,
      title: create.title,
      layout: create.layout ?? { rows: [], cols: [] },
      cells: create.cells ?? [],
      rev: 0,
      createdAt: now,
      updatedAt: now,
      updatedBy: this.by(),
    };
    this.adopt(json);
    this.notify();
    const seq = nextSeq();
    const change: SheetChange = {
      id: `c${seq.toString(36)}`,
      seq,
      store: 'sheets',
      op: 'create',
      sheetId: create.id,
      create,
    };
    // Past the queue's bound the new sheet still goes from this tab's memory: its element is already placed.
    if (this.waiting.waitsNow()) this.waiting.keep(change);
    this.sendCreate(create, opts, 0, change);
  }

  // Sends a create. A sheet on a tab made a moment ago can reach the server before its tab is saved: `tab_not_found`
  // is retried, a little later each time, before it counts as refused.
  private sendCreate(
    create: SheetCreateRequest & { id: string },
    opts: { onRefused?: (code: string | null) => boolean; onCreated?: () => void },
    attempt: number,
    change: SheetChange,
  ): void {
    this.enqueue(create.id, () => this.createTask(create, opts, attempt, change, 0));
  }

  // One try at a create; with no answer it waits for the connection (holding the sheet's later writes behind it).
  private async createTask(
    create: SheetCreateRequest & { id: string },
    opts: { onRefused?: (code: string | null) => boolean; onCreated?: () => void },
    attempt: number,
    change: SheetChange,
    retry: number,
  ): Promise<void> {
    try {
      const stored = await this.api.createSheet(this.deps.scope, create, this.by(), {
        tabMayBeUnsaved: attempt < CREATE_TAB_RETRIES,
      });
      this.waiting.forget(change.id);
      this.adopt(stored);
      this.notify();
      opts.onCreated?.();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : null;
      if (code === 'tab_not_found' && attempt < CREATE_TAB_RETRIES) {
        setTimeout(
          () => this.sendCreate(create, opts, attempt + 1, change),
          CREATE_TAB_RETRY_MS * (attempt + 1),
        );
        return;
      }
      if (isTransientWriteError(e)) {
        debugLog('[sheets] sheets.create.retrying', { retry, status: errorStatus(e) });
        this.waiting.keep(change);
        await this.waiting.pause(retry);
        return this.createTask(create, opts, attempt, change, retry + 1);
      }
      this.waiting.forget(change.id);
      if (!opts.onRefused?.(code)) this.refused(e, create.id);
      this.drop(create.id);
      this.notify();
    }
  }

  // One change to a sheet, as the person made it: applied now, sent in order, undoable unless `undoable` is false
  // (an undo or redo itself). Refused at once (with the reason) when it breaks a limit.
  write(sheetId: string, write: SheetWrite, opts: WriteOpts = {}): SheetRejection | null {
    return this.writeAll([{ sheetId, write }], opts);
  }

  // Several writes as one change (a cut whose moved cells other sheets' formulas read; Insert Cells): every part of
  // every write checked first, then all applied at once and sent in order, and one undo step takes them all back.
  // A large write goes in parts of at most one write's size; each part is checked against the sheet as the parts
  // before it leave it, so the per-write cap never refuses what the sheet allows.
  writeAll(
    asMadeEdits: readonly { sheetId: string; write: SheetWrite }[],
    opts: WriteOpts = {},
  ): SheetRejection | null {
    // An undo or redo replays writes that already carry their readers' rewrites.
    const edits = opts.undo ? asMadeEdits : withReaders(this.entries, asMadeEdits);
    const now = Date.now();
    const checked = !opts.undo && !opts.unchecked && opts.undoable !== false;
    const flags: SheetWriteFlags = {
      ...(opts.undo ? { undo: true } : {}),
      ...(opts.unchecked || (opts.undoable === false && !opts.undo) ? { unchecked: true } : {}),
    };
    const plan = plannedWrites(
      this.entries,
      this.workbooks,
      this.deps,
      () => this.by(),
      edits,
      now,
      checked,
    );
    if (!Array.isArray(plan)) return plan;
    // Offline, or with older changes waiting: every part joins the queue of waiting changes before anything is
    // applied, or, past its bound, the change is refused whole (offline-changes.md "Bounds").
    if (this.waiting.waitsNow() && !this.waiting.keepAll(plan, flags)) {
      this.deps.toast(PLAN_QUEUE_FULL_MESSAGE);
      return 'write_too_large';
    }
    const inverses: Inverse[] = [];
    for (const { sheetId, write, parts, ids } of plan) {
      const entry = this.entries.get(sheetId)!;
      const before = entry.view;
      const result = applySheetWrite(before, write, { now, by: this.by() });
      inverses.unshift({
        sheetId,
        write: inverseSheetWrite(before, result),
        // A deletion's undo is worked out again when it is made, against the sheet as it is then.
        ...(undoReadsNow(result.applied) ? { before: before.layout, applied: result.applied } : {}),
      });
      parts.forEach((part, i) => {
        const { wid, seq } = ids[i]!;
        entry.pending.push({ wid, write: part, seq });
        this.enqueue(sheetId, () => this.send(sheetId, wid, part, flags, seq));
      });
      entry.view = { ...result.sheet, rev: entry.confirmed.rev };
      this.workbookUpdate(
        before.tabId,
        sheetId,
        write.kind === 'layout' || write.kind === 'title' ? undefined : keysOf(write),
      );
    }
    if (opts.undoable !== false) {
      const alongside = opts.alongside;
      this.deps.pushUndo({
        undo: () => {
          this.writeAll(undoWrites(this.entries, inverses), { undoable: false, undo: true });
          alongside?.undo();
        },
        redo: () => {
          // The writes as made (each value as its rule took it).
          this.writeAll(
            plan.map(({ sheetId, write }) => ({ sheetId, write })),
            { undoable: false, undo: true },
          );
          alongside?.redo();
        },
      });
    }
    this.notify();
    return null;
  }

  // Delete sheets with their elements: gone from the store now, kept as they were for Undo, and deleted by the api
  // once nothing in the project references them.
  release(sheetIds: readonly string[]): void {
    for (const id of sheetIds) {
      const entry = this.entries.get(id);
      if (!entry) continue;
      this.released.set(id, sheetToJson(entry.view));
      this.drop(id);
      const seq = nextSeq();
      const change: SheetChange = {
        id: `d${seq.toString(36)}`,
        seq,
        store: 'sheets',
        op: 'delete',
        sheetId: id,
      };
      if (this.waiting.waitsNow()) this.waiting.keep(change);
      this.enqueue(id, () => this.deleteTask(change, 0));
    }
    this.notify();
  }

  // One try at deleting a sheet; with no answer it waits for the connection.
  private async deleteTask(change: SheetChange, retry: number): Promise<void> {
    const id = change.sheetId;
    try {
      await this.api.deleteSheet(this.deps.scope, id, { whenUnreferenced: true });
    } catch (e) {
      if (isTransientWriteError(e)) {
        debugLog('[sheets] sheets.delete.retrying', { retry, status: errorStatus(e) });
        this.waiting.keep(change);
        await this.waiting.pause(retry);
        return this.deleteTask(change, retry + 1);
      }
      // Already gone is what was wanted.
      if (!(e instanceof ApiError && e.code === 'sheet_not_found')) this.refused(e, id);
    }
    this.waiting.forget(change.id);
  }

  // ---- Waiting for the connection (docs/specs/007-editor/offline-changes.md) -------------------------------------

  // The changes a reload kept, sent again in their order (offline-changes.md "Kept across a reload"): a new sheet is
  // in the store at once, a write laid over its sheet when that loads.
  private restore(): void {
    const kept = this.waiting.kept();
    for (const c of kept) {
      if (c.op === 'create') {
        const { create } = c;
        const now = Date.now();
        this.adopt({
          id: create.id,
          tabId: create.tabId,
          title: create.title,
          layout: create.layout ?? { rows: [], cols: [] },
          cells: create.cells ?? [],
          rev: 0,
          createdAt: now,
          updatedAt: now,
          updatedBy: this.by(),
        });
        this.sendCreate(create, {}, 0, c);
      } else if (c.op === 'write') {
        const pending: Pending = { wid: c.id, write: c.write, seq: c.seq };
        const entry = this.entries.get(c.sheetId);
        if (entry) entry.pending.push(pending);
        else this.restored.set(c.sheetId, [...(this.restored.get(c.sheetId) ?? []), pending]);
        this.enqueue(c.sheetId, () => this.send(c.sheetId, c.id, c.write, c.flags, c.seq));
      } else {
        this.enqueue(c.sheetId, () => this.deleteTask(c, 0));
      }
    }
    if (kept.length > 0) debugLog('[offline-queue] sheets.restored', { count: kept.length });
  }

  // A Sheet whose sheet this person deleted with it is back (Undo): make the sheet again as it was, under the next
  // free title if its own is taken now. False when there is nothing to put back.
  restoreReleased(sheetId: string): boolean {
    const json = this.released.get(sheetId);
    if (!json) return false;
    this.released.delete(sheetId);
    const title = uniqueSheetTitle(json.title, this.titlesOn(json.tabId));
    this.create(
      {
        id: json.id,
        tabId: json.tabId,
        title,
        layout: json.layout,
        cells: json.cells,
        restore: true,
      },
      { ...json, title },
    );
    return true;
  }

  private enqueue(sheetId: string, task: () => Promise<void>): void {
    const prev = this.queues.get(sheetId) ?? Promise.resolve();
    const next = prev.then(task, task);
    this.queues.set(sheetId, next);
  }

  // Let pending sends finish (tests, and before a project copy reads the store).
  async settle(): Promise<void> {
    await Promise.all([...this.queues.values()]);
  }

  private async send(
    sheetId: string,
    wid: string,
    write: SheetWrite,
    flags: SheetWriteFlags,
    seq: number,
    attempt = 0,
  ): Promise<void> {
    let answer: SheetWriteResponse;
    try {
      answer = await this.api.writeSheet(
        this.deps.scope,
        sheetId,
        { write, wid, ...flags },
        this.by(),
      );
    } catch (e) {
      // A dropped connection, a rate limit or a server error is not a refusal: the write stays pending (still seen,
      // and still ahead of this sheet's later writes) and goes again after a wait. Unless the room has meanwhile
      // confirmed it (the server stored it and only the answer was lost), or the sheet is gone. It waits in the queue
      // meanwhile, so a reload keeps it (offline-changes.md).
      if (isTransientWriteError(e)) {
        debugLog('[sheets] sheets.write.retrying', { attempt, status: errorStatus(e) });
        this.waiting.keep({ id: wid, seq, store: 'sheets', op: 'write', sheetId, write, flags });
        await this.waiting.pause(attempt);
        if (!this.isPending(sheetId, wid)) {
          this.waiting.forget(wid);
          return;
        }
        return this.send(sheetId, wid, write, flags, seq, attempt + 1);
      }
      this.waiting.forget(wid);
      this.refused(e, sheetId);
      this.dropPending(sheetId, wid);
      await this.refetchSheet(sheetId);
      return;
    }
    this.waiting.forget(wid);
    this.landed(sheetId, wid, answer.rev, answer.applied);
  }
}

const STORES = new Map<string, SheetStore>();

// The store of a project, made on first use and kept for the session.
// The project's sheet store, as the sheets bridge describes it (a Sheet and a chart drawn from one share it).
export function sheetStoreOf(bridge: SheetsBridge): SheetStore {
  const { projectId, ownerId } = bridge.scope;
  return sheetStoreFor({
    scope: bridge.scope,
    self: () => bridge.self,
    locale: bridge.locale,
    pushUndo: bridge.pushUndo,
    toast: bridge.toast,
    // An Offline Mode project needs no connection, so nothing of it waits.
    queue: isOfflineIdSync(projectId) ? null : planQueue(projectId, ownerId),
    rights: { cells: bridge.canEdit, shape: bridge.canShape },
  });
}

export function sheetStoreFor(deps: SheetStoreDeps): SheetStore {
  const key = deps.scope.projectId;
  let store = STORES.get(key);
  if (!store) {
    store = new SheetStore(deps);
    STORES.set(key, store);
  } else {
    store.update(deps);
  }
  return store;
}

export function forgetSheetStores(): void {
  STORES.clear();
}
