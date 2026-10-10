// The editor's sheet store (docs/specs/029-sheets/sheet-store.md; blueprint sheet-store.md "Editor slice"), in the
// lazy sheet chunk: per sheet, the server's confirmed state and this person's pending writes laid over it (what
// they see), one workbook per tab, writes sent one at a time per sheet in order, undo steps, and the room's ops
// merged by rev. Writes land on ids, so pending writes rebase cleanly over anyone else's.
import { subscribeOfflineIds } from '@/lib/offline/offline-store';
import type { SheetCreateRequest, SheetsRoomOp, SheetWriteResponse } from '@livediagram/api-schema';
import {
  Workbook,
  applyLayoutChange,
  applySheetWrite,
  cellKey,
  inverseLayoutChanges,
  inverseSheetWrite,
  mergeSheetChange,
  sheetFromJson,
  sheetToJson,
  splitWrite,
  undoReadsNow,
  uniqueSheetTitle,
  validateWrite,
  type CardSource,
  type Sheet,
  type SheetJson,
  type SheetLayout,
  type SheetPerson,
  type SheetRejection,
  type SheetWrite,
} from '@livediagram/sheets';
import { debugLog } from '@/lib/debug-log';
import type { SheetsBridge } from '@/hooks/sheets/useSheetsBridge';
import { ApiError } from '@/lib/api/core';
import { errorStatus, isTransientWriteError, sheetWriteRetryMs } from './sheet-write-retry';
import {
  createSheet,
  deleteSheet,
  fetchSheets,
  writeSheet,
  type SheetsScope,
} from '@/lib/api/sheets';
import type { ItemUndoStep } from '@/hooks/plan/item-undo-journal';

export type SheetStoreDeps = {
  scope: SheetsScope;
  self: () => SheetPerson | null;
  locale: string;
  pushUndo: (step: ItemUndoStep) => void;
  toast: (message: string) => void;
  // Injected in tests.
  api?: {
    fetchSheets: typeof fetchSheets;
    createSheet: typeof createSheet;
    writeSheet: typeof writeSheet;
    deleteSheet: typeof deleteSheet;
  };
  // The wait before a write is sent again; injected in tests.
  wait?: (ms: number) => Promise<void>;
};

type Pending = { wid: string; write: SheetWrite };
// One sheet's part of an undo step; a deletion's also keeps the layout it was made on and what it did, to be undone
// against the sheet as it is at the undo.
type Inverse = { sheetId: string; write: SheetWrite; before?: SheetLayout; applied?: SheetWrite };
type Entry = { confirmed: Sheet; pending: Pending[]; view: Sheet };
export type TabStatus = 'loading' | 'ready' | 'error';

const NOBODY: SheetPerson = { id: '', name: 'Someone', color: '#94a3b8' };
export const SHEET_REFETCH_DEBOUNCE_MS = 400;

const REFUSALS: Partial<Record<string, string>> = {
  sheet_full: 'This sheet holds the most cells it can',
  sheets_full: 'This document holds the most sheets it can',
  sheet_too_large: 'A sheet holds up to 10,000 rows and 200 columns',
  sheet_title_taken: 'Another sheet on this tab is called that',
  input_too_long: 'A cell holds up to 10,000 characters',
  sheet_not_found: 'This sheet is no longer in this document',
};

export function sheetRefusalMessage(code: string | null): string {
  return (code && REFUSALS[code]) ?? "Couldn't save that change";
}

let widCounter = 0;
const newWid = () => `w${Date.now().toString(36)}${(widCounter++).toString(36)}`;

function keysOf(write: SheetWrite): string[] | undefined {
  if (write.kind !== 'cells') return undefined;
  return write.cells.map((c) => cellKey(c.r, c.c));
}

export class SheetStore {
  private deps: SheetStoreDeps;
  private readonly api: NonNullable<SheetStoreDeps['api']>;
  private readonly wait: (ms: number) => Promise<void>;
  private readonly entries = new Map<string, Entry>();
  private readonly tabStatus = new Map<string, TabStatus>();
  private readonly workbooks = new Map<string, Workbook>();
  private readonly queues = new Map<string, Promise<void>>();
  private readonly listeners = new Set<() => void>();
  private readonly refetchTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // Sheets this person deleted with their elements, as they were: Undo puts the element back and its sheet with it
  // (sheet-store.md "Deleting a sheet"). Kept for the session, as undo is.
  private readonly released = new Map<string, SheetJson>();
  private cards: CardSource | null = null;
  version = 0;

  constructor(deps: SheetStoreDeps) {
    this.deps = deps;
    this.api = deps.api ?? { fetchSheets, createSheet, writeSheet, deleteSheet };
    this.wait = deps.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    // The document synced to the server in place (docs/specs/006-document/offline-mode.md "Syncing in
    // place"): every loaded tab is read again from the server, so the confirmed revisions are its own.
    // The store lives for the session, as does this subscription.
    subscribeOfflineIds((id) => {
      if (id === this.deps.scope.documentId) this.resync();
    });
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

  async loadTab(tabId: string, force = false): Promise<void> {
    const status = this.tabStatus.get(tabId);
    if (!force && (status === 'loading' || status === 'ready')) return;
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
    const pending = entry?.pending ?? [];
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
    opts: { onRefused?: (code: string | null) => boolean } = {},
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
    this.enqueue(create.id, async () => {
      try {
        const stored = await this.api.createSheet(this.deps.scope, create, this.by());
        this.adopt(stored);
        this.notify();
      } catch (e) {
        const code = e instanceof ApiError ? e.code : null;
        if (!opts.onRefused?.(code)) this.refused(e, create.id);
        this.drop(create.id);
        this.notify();
      }
    });
  }

  // One change to a sheet, as the person made it: applied now, sent in order, undoable unless `undoable` is false
  // (an undo or redo itself). Refused at once (with the reason) when it breaks a limit.
  write(
    sheetId: string,
    write: SheetWrite,
    opts: { undoable?: boolean; undo?: boolean } = {},
  ): SheetRejection | null {
    return this.writeAll([{ sheetId, write }], opts);
  }

  // Several writes as one change (a cut whose moved cells other sheets' formulas read; Insert Cells): every part of
  // every write checked first, then all applied at once and sent in order, and one undo step takes them all back.
  // A large write goes in parts of at most one write's size; each part is checked against the sheet as the parts
  // before it leave it, so the per-write cap never refuses what the sheet allows.
  writeAll(
    edits: readonly { sheetId: string; write: SheetWrite }[],
    opts: { undoable?: boolean; undo?: boolean } = {},
  ): SheetRejection | null {
    const now = Date.now();
    const states = new Map<string, Sheet>();
    const plan: { sheetId: string; write: SheetWrite; parts: SheetWrite[] }[] = [];
    for (const { sheetId, write } of edits) {
      const entry = this.entries.get(sheetId);
      if (!entry) return 'write_invalid';
      const parts = splitWrite(write);
      let state = states.get(sheetId) ?? entry.view;
      for (const part of parts) {
        const check = validateWrite(state, part);
        if (!check.ok) {
          this.deps.toast(sheetRefusalMessage(check.error));
          return check.error;
        }
        // Only a later part or write needs the sheet as this one leaves it.
        if (parts.length > 1 || edits.length > 1)
          state = applySheetWrite(state, part, { now, by: this.by() }).sheet;
      }
      states.set(sheetId, state);
      plan.push({ sheetId, write, parts });
    }
    const inverses: Inverse[] = [];
    for (const { sheetId, write, parts } of plan) {
      const entry = this.entries.get(sheetId)!;
      const before = entry.view;
      const result = applySheetWrite(before, write, { now, by: this.by() });
      inverses.unshift({
        sheetId,
        write: inverseSheetWrite(before, result),
        // A deletion's undo is worked out again when it is made, against the sheet as it is then.
        ...(undoReadsNow(result.applied) ? { before: before.layout, applied: result.applied } : {}),
      });
      for (const part of parts) {
        const wid = newWid();
        entry.pending.push({ wid, write: part });
        this.enqueue(sheetId, () => this.send(sheetId, wid, part, opts.undo === true));
      }
      entry.view = { ...result.sheet, rev: entry.confirmed.rev };
      this.workbookUpdate(
        before.tabId,
        sheetId,
        write.kind === 'layout' || write.kind === 'title' ? undefined : keysOf(write),
      );
    }
    if (opts.undoable !== false) {
      this.deps.pushUndo({
        undo: () => void this.writeAll(this.undoWrites(inverses), { undoable: false, undo: true }),
        redo: () => void this.writeAll(edits, { undoable: false, undo: true }),
      });
    }
    this.notify();
    return null;
  }

  // The undo of a change, as it lands on the sheets now: a deletion's undo puts back what it took into the layout
  // as it is (and as the undo's earlier writes to that sheet leave it), so links, drafts and merges made since stay.
  private undoWrites(inverses: readonly Inverse[]): { sheetId: string; write: SheetWrite }[] {
    const landing = new Map<string, SheetLayout>();
    return inverses.map(({ sheetId, write, before, applied }) => {
      const now = landing.get(sheetId) ?? this.entries.get(sheetId)?.view.layout;
      let out = write;
      if (before && applied?.kind === 'layout' && write.kind === 'layout' && now)
        out = { ...write, changes: inverseLayoutChanges(before, applied.changes, now) };
      if (now && out.kind === 'layout')
        landing.set(sheetId, out.changes.reduce(applyLayoutChange, now));
      return { sheetId, write: out };
    });
  }

  // Delete sheets with their elements: gone from the store now, kept as they were for Undo, and deleted by the api
  // once nothing in the document references them.
  release(sheetIds: readonly string[]): void {
    for (const id of sheetIds) {
      const entry = this.entries.get(id);
      if (!entry) continue;
      this.released.set(id, sheetToJson(entry.view));
      this.drop(id);
      this.enqueue(id, async () => {
        try {
          await this.api.deleteSheet(this.deps.scope, id, { whenUnreferenced: true });
        } catch (e) {
          // Already gone is what was wanted.
          if (!(e instanceof ApiError && e.code === 'sheet_not_found')) this.refused(e, id);
        }
      });
    }
    this.notify();
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

  // Let pending sends finish (tests, and before a document copy reads the store).
  async settle(): Promise<void> {
    await Promise.all([...this.queues.values()]);
  }

  private async send(
    sheetId: string,
    wid: string,
    write: SheetWrite,
    undo: boolean,
    attempt = 0,
  ): Promise<void> {
    let answer: SheetWriteResponse;
    try {
      answer = await this.api.writeSheet(
        this.deps.scope,
        sheetId,
        { write, wid, ...(undo ? { undo: true } : {}) },
        this.by(),
      );
    } catch (e) {
      // A dropped connection, a rate limit or a server error is not a refusal: the write stays pending (still seen,
      // and still ahead of this sheet's later writes) and goes again after a wait. Unless the room has meanwhile
      // confirmed it (the server stored it and only the answer was lost), or the sheet is gone.
      if (isTransientWriteError(e)) {
        debugLog('[sheets] sheets.write.retrying', { attempt, status: errorStatus(e) });
        await this.wait(sheetWriteRetryMs(attempt));
        if (!this.entries.get(sheetId)?.pending.some((p) => p.wid === wid)) return;
        return this.send(sheetId, wid, write, undo, attempt + 1);
      }
      this.refused(e, sheetId);
      const entry = this.entries.get(sheetId);
      if (entry) entry.pending = entry.pending.filter((p) => p.wid !== wid);
      await this.refetchSheet(sheetId);
      return;
    }
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
    if (!entry) return;
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
    const layoutMoved = view.layout !== entry.view.layout || view.title !== entry.view.title;
    entry.view = view;
    this.workbookUpdate(view.tabId, sheetId, layoutMoved ? undefined : merged.touched);
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

// The store of a document, made on first use and kept for the session.
// The document's sheet store, as the sheets bridge describes it (a Sheet and a chart drawn from one share it).
export function sheetStoreOf(bridge: SheetsBridge): SheetStore {
  return sheetStoreFor({
    scope: bridge.scope,
    self: () => bridge.self,
    locale: bridge.locale,
    pushUndo: bridge.pushUndo,
    toast: bridge.toast,
  });
}

export function sheetStoreFor(deps: SheetStoreDeps): SheetStore {
  const key = deps.scope.documentId;
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
