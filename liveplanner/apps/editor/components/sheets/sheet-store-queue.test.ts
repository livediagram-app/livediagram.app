import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applySheetWrite,
  emptyLayout,
  sheetFromJson,
  sheetToJson,
  type Sheet,
  type SheetJson,
  type SheetWrite,
} from '@liveplanner/sheets';
import { ApiError } from '@/lib/api/core';
import {
  PLAN_QUEUE_FULL_MESSAGE,
  PLAN_QUEUE_MAX_CHANGES,
  PlanQueue,
  type QueuedChange,
} from '@/lib/offline-queue/plan-queue';
import { signalReconnect } from '@/lib/offline-queue/reconnect';
import type { SheetQueueRights } from '@/lib/offline-queue/queue-roles';
import { SheetStore, forgetSheetStores, sheetStoreFor, sheetStoreOf } from './sheet-store-client';

const offlineProject = vi.hoisted(() => ({ is: false }));
vi.mock('@/lib/offline/offline-store', async (original) => ({
  ...(await original<typeof import('@/lib/offline/offline-store')>()),
  isOfflineIdSync: () => offlineProject.is,
}));
import type { SheetsBridge } from '@/hooks/sheets/useSheetsBridge';

// docs/specs/007-editor/offline-changes.md, the sheet store's part: writes, new sheets and deletes made without a
// connection wait in the plan's queue, are sent again (after a reload too) and refused one by one.

const by = { id: 'me', name: 'Me', color: '#000000' };
let r = 7;
const rand = () => ((r = (r * 16807) % 2147483647) - 1) / 2147483646;
const initial = (): SheetJson => ({
  id: 'sheet0001',
  tabId: 't1',
  title: 'Sheet 1',
  layout: emptyLayout(rand, 4, 3),
  cells: [],
  rev: 0,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: by,
});

const offline = new TypeError('Failed to fetch');

function server(json: SheetJson) {
  let sheet: Sheet = sheetFromJson(json);
  // While down, every request fails with no answer.
  let down = false;
  const fail = () => {
    if (down) throw offline;
  };
  const api = {
    fetchSheets: vi.fn(async () => {
      fail();
      return [sheetToJson(sheet)];
    }),
    createSheet: vi.fn(async (_s: unknown, c: { id?: string; title: string; tabId: string }) => {
      fail();
      return { ...initial(), id: c.id ?? 'made', title: c.title, tabId: c.tabId };
    }),
    deleteSheet: vi.fn(async () => {
      fail();
    }),
    writeSheet: vi.fn(async (_s: unknown, _id: string, req: { write: SheetWrite }) => {
      fail();
      const res = applySheetWrite(sheet, req.write, { now: 1, by });
      sheet = res.sheet;
      return { applied: res.applied, rev: sheet.rev, cells: [] };
    }),
  };
  return {
    api,
    get sheet() {
      return sheet;
    },
    down(on: boolean) {
      down = on;
    },
  };
}

const EDITOR: SheetQueueRights = { cells: true, shape: true };

function make(
  srv: ReturnType<typeof server>,
  queue: PlanQueue | null,
  opts: { rights?: SheetQueueRights; toast?: (m: string) => void } = {},
) {
  return new SheetStore({
    scope: { projectId: 'd1', ownerId: 'o', shareCode: null, tabId: null },
    self: () => by,
    locale: 'en-GB',
    pushUndo: () => {},
    toast: opts.toast ?? (() => {}),
    api: srv.api,
    // The waits end at once; the reconnect signal is what the tests drive.
    wait: () => new Promise((resolve) => setTimeout(resolve, 0)),
    queue,
    rights: opts.rights ?? EDITOR,
  });
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
const setOnline = (online: boolean) => vi.stubGlobal('navigator', { onLine: online });

let srv: ReturnType<typeof server>;
let rows: string[];
let cols: string[];
const set = (row: number, col: number, n: number): SheetWrite => ({
  kind: 'cells',
  cells: [{ r: rows[row]!, c: cols[col]!, i: { n } }],
});

beforeEach(() => {
  srv = server(initial());
  rows = srv.sheet.layout.rows;
  cols = srv.sheet.layout.cols;
});

afterEach(async () => {
  // Writes still retrying land and stop.
  srv.down(false);
  vi.unstubAllGlobals();
  signalReconnect();
  await tick();
  forgetSheetStores();
});

describe('the sheet store, offline', () => {
  it('keeps a write made offline in the queue, shows it, and sends it when the connection is back', async () => {
    const queue = new PlanQueue('k', null);
    const s = make(srv, queue);
    await s.loadTab('t1');
    setOnline(false);
    srv.down(true);
    expect(s.write('sheet0001', set(0, 0, 5))).toBeNull();
    expect(queue.count('sheets')).toBe(1);
    expect(s.workbook('t1').value('sheet0001', 0, 0)).toBe(5);
    // Its first try gets no answer; it keeps waiting.
    await tick();
    expect(queue.count('sheets')).toBe(1);
    // A later write joins behind it.
    s.write('sheet0001', set(0, 1, 6));
    expect(queue.count('sheets')).toBe(2);
    setOnline(true);
    srv.down(false);
    signalReconnect();
    await s.settle();
    await tick();
    await s.settle();
    expect(queue.count()).toBe(0);
    expect(srv.sheet.rev).toBe(2);
  });

  it('keeps a write that failed online with no answer, so a reload keeps it too', async () => {
    const queue = new PlanQueue('k', null);
    const s = make(srv, queue);
    await s.loadTab('t1');
    srv.down(true);
    s.write('sheet0001', set(1, 0, 3));
    expect(queue.count()).toBe(0);
    await tick();
    expect(queue.count('sheets')).toBe(1);
    srv.down(false);
    signalReconnect();
    await tick();
    await s.settle();
    expect(queue.count()).toBe(0);
  });

  it('sends what a reload kept, laying a write over its sheet as it loads', async () => {
    const queue = new PlanQueue('k', null);
    const kept: QueuedChange[] = [
      {
        id: 'c1',
        seq: 1,
        store: 'sheets',
        op: 'create',
        sheetId: 'new1',
        create: { id: 'new1', tabId: 't2', title: 'New' },
      },
      {
        id: 'w2',
        seq: 2,
        store: 'sheets',
        op: 'write',
        sheetId: 'sheet0001',
        write: set(2, 2, 9),
        flags: {},
      },
      { id: 'd3', seq: 3, store: 'sheets', op: 'delete', sheetId: 'old1' },
    ];
    for (const c of kept) queue.add(c);
    srv.down(true);
    const s = make(srv, queue);
    // The new sheet is in the store at once.
    expect(s.sheet('new1')?.title).toBe('New');
    srv.down(false);
    await s.loadTab('t1');
    // The write was laid over the sheet as it loaded, or has landed already.
    expect(s.workbook('t1').value('sheet0001', 2, 2)).toBe(9);
    signalReconnect();
    await tick();
    await s.settle();
    await tick();
    expect(queue.count()).toBe(0);
    expect(srv.api.createSheet).toHaveBeenCalled();
    expect(srv.api.deleteSheet).toHaveBeenCalled();
    expect(srv.sheet.rev).toBe(1);
  });

  it('lays a kept write on the new sheet a reload also kept, and sends both in order', async () => {
    const queue = new PlanQueue('k', null);
    queue.add({
      id: 'c1',
      seq: 1,
      store: 'sheets',
      op: 'create',
      sheetId: 'new1',
      create: { id: 'new1', tabId: 't2', title: 'New' },
    });
    queue.add({
      id: 'w2',
      seq: 2,
      store: 'sheets',
      op: 'write',
      sheetId: 'new1',
      write: set(0, 0, 4),
      flags: {},
    });
    srv.down(true);
    const s = make(srv, queue);
    expect(s.sheet('new1')).toBeDefined();
    srv.down(false);
    signalReconnect();
    await tick();
    await s.settle();
    await tick();
    expect(queue.count()).toBe(0);
    expect(srv.api.createSheet.mock.invocationCallOrder[0]!).toBeLessThan(
      srv.api.writeSheet.mock.invocationCallOrder[0]!,
    );
  });

  it('a kept write the server refuses is told, dropped and the sheet read again', async () => {
    const queue = new PlanQueue('k', null);
    queue.add({
      id: 'w1',
      seq: 1,
      store: 'sheets',
      op: 'write',
      sheetId: 'sheet0001',
      write: set(0, 0, 1),
      flags: {},
    });
    srv.api.writeSheet.mockRejectedValueOnce(new ApiError('sheet write', 403, 'forbidden'));
    const toast = vi.fn();
    const s = make(srv, queue, { toast });
    await s.loadTab('t1');
    await s.settle();
    await tick();
    expect(toast).toHaveBeenCalledWith("Couldn't save that change");
    expect(queue.count()).toBe(0);
    expect(s.workbook('t1').value('sheet0001', 0, 0)).toBeNull();
  });

  it('a kept write that lands before its sheet loads is not laid over it again', async () => {
    const queue = new PlanQueue('k', null);
    queue.add({
      id: 'w1',
      seq: 1,
      store: 'sheets',
      op: 'write',
      sheetId: 'sheet0001',
      write: set(0, 0, 4),
      flags: {},
    });
    const s = make(srv, queue);
    await s.settle();
    expect(queue.count()).toBe(0);
    await s.loadTab('t1');
    expect(s.workbook('t1').value('sheet0001', 0, 0)).toBe(4);
    expect(s.sheet('sheet0001')!.rev).toBe(1);
  });

  it('refuses a change that would pass the queue’s bound, applying nothing', async () => {
    const queue = new PlanQueue('k', null);
    for (let i = 1; i <= PLAN_QUEUE_MAX_CHANGES; i++)
      queue.add({ id: `x${i}`, seq: i, store: 'items', write: { kind: 'delete', id: `c${i}` } });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const toast = vi.fn();
    const s = make(srv, queue, { toast });
    await s.loadTab('t1');
    setOnline(false);
    expect(s.write('sheet0001', set(0, 0, 1))).toBe('write_too_large');
    expect(toast).toHaveBeenCalledWith(PLAN_QUEUE_FULL_MESSAGE);
    expect(s.workbook('t1').value('sheet0001', 0, 0)).toBeNull();
    // A new sheet past the bound still goes from memory: its element is already placed.
    srv.down(true);
    s.create({ id: 'n2', tabId: 't1', title: 'Two' });
    expect(s.sheet('n2')).toBeDefined();
    expect(queue.count('sheets')).toBe(0);
  });

  it('keeps a new sheet and a delete made offline, and sends both when back', async () => {
    const queue = new PlanQueue('k', null);
    const s = make(srv, queue);
    await s.loadTab('t1');
    setOnline(false);
    srv.down(true);
    s.create({ id: 'n1', tabId: 't1', title: 'Fresh' });
    s.release(['sheet0001']);
    expect(queue.changes('sheets').map((c) => (c as { op: string }).op)).toEqual([
      'create',
      'delete',
    ]);
    await tick();
    expect(queue.count('sheets')).toBe(2);
    setOnline(true);
    srv.down(false);
    signalReconnect();
    await tick();
    await s.settle();
    await tick();
    expect(queue.count()).toBe(0);
  });

  it('a new sheet refused on replay is told and taken away', async () => {
    const queue = new PlanQueue('k', null);
    queue.add({
      id: 'c1',
      seq: 1,
      store: 'sheets',
      op: 'create',
      sheetId: 'n1',
      create: { id: 'n1', tabId: 't1', title: 'Taken' },
    });
    srv.api.createSheet.mockRejectedValueOnce(
      new ApiError('sheet create', 409, 'sheet_title_taken'),
    );
    const toast = vi.fn();
    const s = make(srv, queue, { toast });
    await s.settle();
    expect(toast).toHaveBeenCalledWith('Another sheet on this tab is called that');
    expect(s.sheet('n1')).toBeUndefined();
    expect(queue.count()).toBe(0);
  });
});

describe('the sheet store offline, by role', () => {
  it('Participant: a cell write waits; a layout write goes from memory only', async () => {
    const queue = new PlanQueue('k', null);
    const s = make(srv, queue, { rights: { cells: true, shape: false } });
    await s.loadTab('t1');
    setOnline(false);
    srv.down(true);
    s.write('sheet0001', set(0, 0, 1));
    expect(queue.count('sheets')).toBe(1);
    s.write('sheet0001', { kind: 'title', title: 'Renamed' });
    expect(queue.count('sheets')).toBe(1);
    await tick();
    expect(queue.count('sheets')).toBe(1);
  });

  it('Viewer: nothing waits', async () => {
    const queue = new PlanQueue('k', null);
    const s = make(srv, queue, { rights: { cells: false, shape: false } });
    await s.loadTab('t1');
    setOnline(false);
    srv.down(true);
    s.write('sheet0001', set(0, 0, 1));
    await tick();
    expect(queue.count()).toBe(0);
  });

  it('no queue (an Offline Mode project): nothing is kept, no rights given: nothing waits', async () => {
    const s = make(srv, null);
    await s.loadTab('t1');
    setOnline(false);
    expect(s.write('sheet0001', set(0, 0, 1))).toBeNull();
    const queue = new PlanQueue('k', null);
    const plain = new SheetStore({
      scope: { projectId: 'd2', ownerId: 'o', shareCode: null, tabId: null },
      self: () => by,
      locale: 'en-GB',
      pushUndo: () => {},
      toast: () => {},
      api: srv.api,
      queue,
    });
    await plain.loadTab('t1');
    plain.write('sheet0001', set(0, 1, 1));
    expect(queue.count()).toBe(0);
  });
});

describe('sheetStoreOf', () => {
  it('gives the store the plan’s queue and the session’s rights', () => {
    vi.stubGlobal('localStorage', undefined);
    const bridge = {
      scope: { projectId: 'p9', ownerId: 'o9', shareCode: null, tabId: null },
      self: by,
      locale: 'en-GB',
      pushUndo: () => {},
      toast: () => {},
      canEdit: true,
      canShape: false,
    } as unknown as SheetsBridge;
    const store = sheetStoreOf(bridge);
    expect(store).toBe(sheetStoreFor({ ...bridge, self: () => by }));
  });

  it('gives an Offline Mode project no queue', () => {
    offlineProject.is = true;
    const bridge = {
      scope: { projectId: 'p8', ownerId: 'o8', shareCode: null, tabId: null },
      self: by,
      locale: 'en-GB',
      pushUndo: () => {},
      toast: () => {},
      canEdit: true,
      canShape: true,
    } as unknown as SheetsBridge;
    const store = sheetStoreOf(bridge) as unknown as { deps: { queue: unknown } };
    offlineProject.is = false;
    expect(store.deps.queue).toBeNull();
  });
});
