// The sheet store's state (docs/specs/029-sheets/sheet-store.md; blueprint sheet-store.md "Editor slice"): per sheet,
// the server's confirmed state and this person's pending writes laid over it (what they see), one workbook per tab,
// loading a tab, and what lands from the server or the room, merged by rev. The store itself (sheet-store-client.ts)
// adds the writes this person makes and the changes waiting for the connection.
import type { SheetsRoomOp } from '@liveplanner/api-schema';
import {
  Workbook,
  applySheetWrite,
  changedInputs,
  mergeSheetChange,
  sheetFromJson,
  type CardSource,
  type Sheet,
  type SheetJson,
  type SheetPerson,
  type SheetWrite,
} from '@liveplanner/sheets';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { ApiError } from '@/lib/api/core';
import { createSheet, deleteSheet, fetchSheets, writeSheet } from '@/lib/api/sheets';
import { SheetQueueKeeper } from './sheet-store-queue';
import { sheetRefusalMessage } from './sheet-store-messages';
import type { Entry, Pending, SheetStoreDeps, TabStatus } from './sheet-store-types';

const NOBODY: SheetPerson = { id: '', name: 'Someone', color: '#94a3b8' };
export const SHEET_REFETCH_DEBOUNCE_MS = 400;

export class SheetStoreBase {
  protected deps: SheetStoreDeps;
  protected readonly api: NonNullable<SheetStoreDeps['api']>;
  protected readonly wait: (ms: number) => Promise<void>;
  protected readonly waiting: SheetQueueKeeper;
  protected readonly entries = new Map<string, Entry>();
  protected readonly tabStatus = new Map<string, TabStatus>();
  protected readonly workbooks = new Map<string, Workbook>();
  protected readonly queues = new Map<string, Promise<void>>();
  // Each tab's load in flight (loadTab).
  protected readonly loads = new Map<string, Promise<void>>();
  protected readonly listeners = new Set<() => void>();
  protected readonly refetchTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // Sheets this person deleted with their elements, as they were: Undo puts the element back and its sheet with it
  // (sheet-store.md "Deleting a sheet"). Kept for the session, as undo is.
  protected readonly released = new Map<string, SheetJson>();
  // Writes a reload kept waiting (offline-changes.md "Kept across a reload") for sheets not loaded yet: laid over the
  // sheet when it loads, as its pending writes.
  protected readonly restored = new Map<string, Pending[]>();
  protected cards: CardSource | null = null;
  version = 0;

  constructor(deps: SheetStoreDeps) {
    this.deps = deps;
    this.api = deps.api ?? { fetchSheets, createSheet, writeSheet, deleteSheet };
    this.wait = deps.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.waiting = new SheetQueueKeeper(() => this.deps, this.wait);
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

  protected notify(): void {
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

  protected async fetchTab(tabId: string): Promise<void> {
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
  protected adopt(json: SheetJson): void {
    const confirmed = sheetFromJson(json);
    const entry = this.entries.get(json.id);
    const pending = entry?.pending ?? this.restored.get(json.id) ?? [];
    this.restored.delete(json.id);
    this.entries.set(json.id, { confirmed, pending, view: this.rebase(confirmed, pending) });
    this.workbookUpdate(confirmed.tabId, json.id);
  }

  protected async refetchSheet(sheetId: string): Promise<void> {
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

  protected scheduleRefetch(sheetId: string): void {
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

  protected drop(sheetId: string): void {
    const entry = this.entries.get(sheetId);
    if (!entry) return;
    this.entries.delete(sheetId);
    this.workbooks.get(entry.view.tabId)?.removeSheet(sheetId);
  }

  // ---- The workbooks -----------------------------------------------------------------------------------

  protected rebase(confirmed: Sheet, pending: readonly Pending[]): Sheet {
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

  protected workbookUpdate(tabId: string, sheetId: string, keys?: string[]): void {
    const wb = this.workbooks.get(tabId);
    const view = this.entries.get(sheetId)?.view;
    if (wb && view) wb.updateSheet(view, keys);
  }

  protected by(): SheetPerson {
    return this.deps.self() ?? NOBODY;
  }

  // Whether a write is still this person's to send: pending on its sheet, or kept by a reload for a sheet not loaded.
  protected isPending(sheetId: string, wid: string): boolean {
    const has = (list: readonly Pending[] | undefined) => !!list?.some((p) => p.wid === wid);
    return has(this.entries.get(sheetId)?.pending) || has(this.restored.get(sheetId));
  }

  protected dropPending(sheetId: string, wid: string | undefined): void {
    const entry = this.entries.get(sheetId);
    if (entry) entry.pending = entry.pending.filter((p) => p.wid !== wid);
    const kept = this.restored.get(sheetId);
    if (kept)
      this.restored.set(
        sheetId,
        kept.filter((p) => p.wid !== wid),
      );
  }

  // Our write as the server stored it, from the answer or the room, whichever comes first.
  protected landed(
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

  protected refused(e: unknown, sheetId: string): void {
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
