// The editor's sheet store (docs/specs/029-sheets/sheet-store.md; blueprint sheet-store.md "Editor slice"), in the
// lazy sheet chunk: per sheet, the server's confirmed state and this person's pending writes laid over it (what
// they see), one workbook per tab, writes sent one at a time per sheet in order, undo steps, and the room's ops
// merged by rev. Writes land on ids, so pending writes rebase cleanly over anyone else's.
import { isOfflineIdSync, subscribeOfflineIds } from '@/lib/offline/offline-store';
import type { SheetCreateRequest, SheetsRoomOp, SheetWriteResponse } from '@liveplanner/api-schema';
import {
  Workbook,
  applySheetWrite,
  changedInputs,
  inverseSheetWrite,
  mergeSheetChange,
  sheetFromJson,
  sheetToJson,
  undoReadsNow,
  uniqueSheetTitle,
  type CardSource,
  type Sheet,
  type SheetJson,
  type SheetPerson,
  type SheetRejection,
  type SheetWrite,
} from '@liveplanner/sheets';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { SheetsBridge } from '@/hooks/sheets/useSheetsBridge';
import { ApiError } from '@/lib/api/core';
import { errorStatus, isTransientWriteError } from './sheet-write-retry';
import { createSheet, deleteSheet, fetchSheets, writeSheet } from '@/lib/api/sheets';
import {
  PLAN_QUEUE_FULL_MESSAGE,
  nextSeq,
  planQueue,
  type SheetWriteFlags,
} from '@/lib/offline-queue/plan-queue';
import { SheetQueueKeeper, type SheetChange } from './sheet-store-queue';
import { sheetRefusalMessage } from './sheet-store-messages';
import { keysOf, plannedWrites, undoWrites, withReaders } from './sheet-store-writes';
import type {
  Entry,
  Inverse,
  Pending,
  SheetStoreDeps,
  TabStatus,
  WriteOpts,
} from './sheet-store-types';

// The store's shapes, refusal messages and write planning live in their own modules; this entry keeps every export.
export { sheetRefusalMessage, writeRefusalMessage } from './sheet-store-messages';
export type { TabStatus } from './sheet-store-types';

// A new tab's sheet waiting for the tab to be saved: retried this many times, this much longer each time
// (docs/specs/029-sheets/sheet-store.md "Changing a sheet"). Safe range 2..6 and 300..2000 ms.
const CREATE_TAB_RETRIES = 4;
const CREATE_TAB_RETRY_MS = 800;

const NOBODY: SheetPerson = { id: '', name: 'Someone', color: '#94a3b8' };
export const SHEET_REFETCH_DEBOUNCE_MS = 400;

export class SheetStore {
  private deps: SheetStoreDeps;
  private readonly api: NonNullable<SheetStoreDeps['api']>;
  private readonly wait: (ms: number) => Promise<void>;
  private readonly waiting: SheetQueueKeeper;
  private readonly entries = new Map<string, Entry>();
  private readonly tabStatus = new Map<string, TabStatus>();
  private readonly workbooks = new Map<string, Workbook>();
  private readonly queues = new Map<string, Promise<void>>();
  // Each tab's load in flight (loadTab).
  private readonly loads = new Map<string, Promise<void>>();
  private readonly listeners = new Set<() => void>();
  private readonly refetchTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // Sheets this person deleted with their elements, as they were: Undo puts the element back and its sheet with it
  // (sheet-store.md "Deleting a sheet"). Kept for the session, as undo is.
  private readonly released = new Map<string, SheetJson>();
  // Writes a reload kept waiting (offline-changes.md "Kept across a reload") for sheets not loaded yet: laid over the
  // sheet when it loads, as its pending writes.
  private readonly restored = new Map<string, Pending[]>();
  private cards: CardSource | null = null;
  version = 0;

  constructor(deps: SheetStoreDeps) {
    this.deps = deps;
    this.api = deps.api ?? { fetchSheets, createSheet, writeSheet, deleteSheet };
    this.wait = deps.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.waiting = new SheetQueueKeeper(() => this.deps, this.wait);
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

  // The editor's latest identity, toasts and undo (they change across renders; the store lives for the session).
  update(deps: SheetStoreDeps): void {
    this.deps = { ...deps, api: this.api, wait: this.wait };
  }

  // ---- Reading -----------------------------------------------------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this.version;

  sheet(id: string): Sheet | undefined {
    return this.entries.get(id)?.view;
  }

  status(tabId: string): TabStatus | undefined {
    return this.tabStatus.get(tabId);
  }

  workbook(tabId: string): Workbook {
    let wb = this.workbooks.get(tabId);
    if (!wb) {
      wb = new Workbook({
        sheets: [...this.entries.values()].map((e) => e.view).filter((s) => s.tabId === tabId),
        locale: this.deps.locale,
        cards: this.cards,
      });
      this.workbooks.set(tabId, wb);
    }
    return wb;
  }

  titlesOn(tabId: string): string[] {
    return [...this.entries.values()]
      .filter((e) => e.view.tabId === tabId)
      .map((e) => e.view.title);
  }

  setCards(cards: CardSource | null): void {
    if (cards === this.cards) return;
    this.cards = cards;
    for (const wb of this.workbooks.values()) wb.setCards(cards);
    this.notify();
  }

  usesCards(): boolean {
    for (const wb of this.workbooks.values()) if (wb.usesCards()) return true;
    return false;
  }

  private notify(): void {
    this.version++;
    for (const l of this.listeners) l();
  }

  // ---- Loading -----------------------------------------------------------------------------------------

  // Settles once the tab's sheets are in (or the load failed, never rejecting): a second caller while a load is in
  // flight waits for that same load, so what it reads next is the loaded tab, never the empty one.
  loadTab(tabId: string, force = false): Promise<void> {
    const inFlight = this.loads.get(tabId);
    if (!force && inFlight) return inFlight;
    if (!force && this.tabStatus.get(tabId) === 'ready') return Promise.resolve();
    const load = this.fetchTab(tabId);
    this.loads.set(tabId, load);
    void load.finally(() => {
      if (this.loads.get(tabId) === load) this.loads.delete(tabId);
    });
    return load;
  }

  private async fetchTab(tabId: string): Promise<void> {
    this.tabStatus.set(tabId, 'loading');
    this.notify();
    try {
      const sheets = await this.api.fetchSheets(this.deps.scope, { tabId });
      for (const json of sheets) this.adopt(json);
      this.tabStatus.set(tabId, 'ready');
    } catch (e) {
      debugLog('[sheets] sheets.load.failed', { status: e instanceof ApiError ? e.status : 0 });
      this.tabStatus.set(tabId, 'error');
    }
    this.notify();
  }

  // A sheet from the server: it becomes the confirmed state, pending writes laid back over it.
  private adopt(json: SheetJson): void {
    const confirmed = sheetFromJson(json);
    const entry = this.entries.get(json.id);
    const pending = entry?.pending ?? this.restored.get(json.id) ?? [];
    this.restored.delete(json.id);
    this.entries.set(json.id, { confirmed, pending, view: this.rebase(confirmed, pending) });
    this.workbookUpdate(confirmed.tabId, json.id);
  }

  private async refetchSheet(sheetId: string): Promise<void> {
    const entry = this.entries.get(sheetId);
    try {
      const [json] = await this.api.fetchSheets(this.deps.scope, { ids: [sheetId] });
      if (json) this.adopt(json);
      else if (entry) this.drop(sheetId);
      this.notify();
    } catch {
      debugLog('[sheets] sheets.load.failed', { sheet: true });
    }
  }

  private scheduleRefetch(sheetId: string): void {
    debugLog('[sheets] sheets.refetch.gap', {});
    clearTimeout(this.refetchTimers.get(sheetId));
    this.refetchTimers.set(
      sheetId,
      setTimeout(() => {
        this.refetchTimers.delete(sheetId);
        void this.refetchSheet(sheetId);
      }, SHEET_REFETCH_DEBOUNCE_MS),
    );
  }

  // After a reconnect, every loaded tab is fetched again (what was missed is not replayed).
  resync(): void {
    for (const [tabId, status] of this.tabStatus)
      if (status !== 'loading') void this.loadTab(tabId, true);
  }

  private drop(sheetId: string): void {
    const entry = this.entries.get(sheetId);
    if (!entry) return;
    this.entries.delete(sheetId);
    this.workbooks.get(entry.view.tabId)?.removeSheet(sheetId);
  }

  // ---- The workbooks -----------------------------------------------------------------------------------

  private rebase(confirmed: Sheet, pending: readonly Pending[]): Sheet {
    let sheet = confirmed;
    for (const p of pending) {
      try {
        sheet = {
          ...applySheetWrite(sheet, p.write, { now: Date.now(), by: this.by() }).sheet,
          rev: confirmed.rev,
        };
      } catch {
        // A write that no longer applies is left out of the view; its answer or a refetch settles it.
      }
    }
    return sheet;
  }

  private workbookUpdate(tabId: string, sheetId: string, keys?: string[]): void {
    const wb = this.workbooks.get(tabId);
    const view = this.entries.get(sheetId)?.view;
    if (wb && view) wb.updateSheet(view, keys);
  }

  private by(): SheetPerson {
    return this.deps.self() ?? NOBODY;
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

  // Whether a write is still this person's to send: pending on its sheet, or kept by a reload for a sheet not loaded.
  private isPending(sheetId: string, wid: string): boolean {
    const has = (list: readonly Pending[] | undefined) => !!list?.some((p) => p.wid === wid);
    return has(this.entries.get(sheetId)?.pending) || has(this.restored.get(sheetId));
  }

  private dropPending(sheetId: string, wid: string | undefined): void {
    const entry = this.entries.get(sheetId);
    if (entry) entry.pending = entry.pending.filter((p) => p.wid !== wid);
    const kept = this.restored.get(sheetId);
    if (kept)
      this.restored.set(
        sheetId,
        kept.filter((p) => p.wid !== wid),
      );
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

  // Our write as the server stored it, from the answer or the room, whichever comes first.
  private landed(
    sheetId: string,
    wid: string | undefined,
    rev: number,
    applied: SheetWrite,
    by?: SheetPerson,
    at?: number,
  ): void {
    const entry = this.entries.get(sheetId);
    if (!entry) {
      this.dropPending(sheetId, wid);
      return;
    }
    if (rev <= entry.confirmed.rev) {
      if (wid) entry.pending = entry.pending.filter((p) => p.wid !== wid);
      return;
    }
    const merged = mergeSheetChange(entry.confirmed, {
      rev,
      applied,
      at: at ?? Date.now(),
      by: by ?? this.by(),
    });
    if (merged.kind !== 'applied') {
      // A gap: someone else's writes came in between and their ops have not arrived; fetch the sheet.
      if (wid) entry.pending = entry.pending.filter((p) => p.wid !== wid);
      this.scheduleRefetch(sheetId);
      return;
    }
    entry.confirmed = merged.sheet;
    if (wid) entry.pending = entry.pending.filter((p) => p.wid !== wid);
    const view = this.rebase(entry.confirmed, entry.pending);
    const shown = entry.view;
    const layoutMoved = view.layout !== shown.layout || view.title !== shown.title;
    entry.view = view;
    // Only the inputs the view did not already show: our own write's answer changes none, so what reads its cells is
    // not worked out a second time (blueprint sheet-store.md "Client").
    this.workbookUpdate(
      view.tabId,
      sheetId,
      layoutMoved ? undefined : changedInputs(shown, view, merged.touched),
    );
    this.notify();
  }

  private refused(e: unknown, sheetId: string): void {
    const code = e instanceof ApiError ? e.code : null;
    debugLog('[sheets] sheets.write.failed', { error: code });
    this.deps.toast(sheetRefusalMessage(code));
    if (code === 'sheet_not_found') {
      this.drop(sheetId);
      this.notify();
    }
  }

  // ---- The room ----------------------------------------------------------------------------------------

  receive(op: SheetsRoomOp): void {
    const entry = this.entries.get(op.sheetId);
    if (op.deleted) {
      if (entry) {
        this.drop(op.sheetId);
        this.notify();
      }
      return;
    }
    if (op.created) {
      if (!entry && this.tabStatus.get(op.tabId) === 'ready') void this.refetchSheet(op.sheetId);
      return;
    }
    if (!entry) return;
    if (op.refetch || !op.applied) {
      if (op.wid) entry.pending = entry.pending.filter((p) => p.wid !== op.wid);
      this.scheduleRefetch(op.sheetId);
      return;
    }
    this.landed(op.sheetId, op.wid, op.rev, op.applied, op.by, op.at);
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
