import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applySheetWrite,
  cellKey,
  emptyLayout,
  sheetFromJson,
  sheetToJson,
  type Sheet,
  type SheetJson,
  type SheetWrite,
} from '@livediagram/sheets';
import { ApiError } from '@/lib/api/core';
import {
  SheetStore,
  sheetRefusalMessage,
  sheetStoreFor,
  forgetSheetStores,
  SHEET_REFETCH_DEBOUNCE_MS,
} from './sheet-store-client';

const by = { id: 'me', name: 'Me', color: '#000000' };
let seq = 3;
const rand = () => ((seq = (seq * 16807) % 2147483647) - 1) / 2147483646;

// A fake server: one sheet, writes applied in order, answers held until released.
function server(initial: SheetJson) {
  let sheet: Sheet = sheetFromJson(initial);
  const held: (() => void)[] = [];
  // Every write's room op, in the order the server stored them (the room relays them so).
  const ops: unknown[] = [];
  let hold = false;
  const api = {
    fetchSheets: vi.fn(async () => [sheetToJson(sheet)]),
    createSheet: vi.fn(
      async (_s: unknown, c: { id?: string; tabId: string; title: string; layout?: unknown }) => ({
        ...sheetToJson(sheet),
        id: c.id!,
        title: c.title,
      }),
    ),
    deleteSheet: vi.fn(async () => {}),
    writeSheet: vi.fn(
      async (_s: unknown, _id: string, req: { write: SheetWrite; wid?: string }) => {
        const r = applySheetWrite(sheet, req.write, { now: 1, by });
        sheet = r.sheet;
        ops.push({
          kind: 'sheets',
          sheetId: sheet.id,
          tabId: sheet.tabId,
          rev: sheet.rev,
          applied: r.applied,
          at: 1,
          by,
          wid: req.wid,
        });
        const answer = { applied: r.applied, rev: sheet.rev, cells: [] };
        if (!hold) return answer;
        return new Promise<typeof answer>((resolve) => held.push(() => resolve(answer)));
      },
    ),
  };
  return {
    api,
    get sheet() {
      return sheet;
    },
    // Someone else's write, straight into the server; returns its room op.
    external(write: SheetWrite) {
      const r = applySheetWrite(sheet, write, { now: 1, by });
      sheet = r.sheet;
      const op = {
        kind: 'sheets' as const,
        sheetId: sheet.id,
        tabId: sheet.tabId,
        rev: sheet.rev,
        applied: r.applied,
        at: 1,
        by,
      };
      ops.push(op);
      return op;
    },
    // The room's ops so far, delivered and forgotten.
    drain() {
      return ops.splice(0) as never[];
    },
    hold(on: boolean) {
      hold = on;
    },
    release() {
      while (held.length) held.shift()!();
    },
  };
}

const initial = (): SheetJson => ({
  id: 'sheet0001',
  tabId: 't1',
  title: 'Sheet 1',
  layout: emptyLayout(rand, 5, 3),
  cells: [],
  rev: 0,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: by,
});

function store(
  api: ReturnType<typeof server>['api'],
  extra: Partial<{
    toast: (m: string) => void;
    pushUndo: (s: unknown) => void;
    wait: (ms: number) => Promise<void>;
  }> = {},
) {
  return new SheetStore({
    scope: { documentId: 'd1', ownerId: 'o', shareCode: null, tabId: null },
    self: () => by,
    locale: 'en-GB',
    pushUndo: (extra.pushUndo ?? (() => {})) as never,
    toast: extra.toast ?? (() => {}),
    api: api as never,
    ...(extra.wait ? { wait: extra.wait } : {}),
  });
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('the sheet store client', () => {
  let srv: ReturnType<typeof server>;
  let s: SheetStore;
  let rows: string[];
  let cols: string[];
  const set = (r: number, c: number, n: number): SheetWrite => ({
    kind: 'cells',
    cells: [{ r: rows[r]!, c: cols[c]!, i: { n } }],
  });
  const value = (r: number, c: number) => s.workbook('t1').value('sheet0001', r, c);

  beforeEach(async () => {
    srv = server(initial());
    rows = srv.sheet.layout.rows;
    cols = srv.sheet.layout.cols;
    s = store(srv.api);
    await s.loadTab('t1');
  });

  it('loads a tab once and computes values', async () => {
    expect(s.status('t1')).toBe('ready');
    await s.loadTab('t1');
    expect(srv.api.fetchSheets).toHaveBeenCalledTimes(1);
    s.write('sheet0001', set(0, 0, 4));
    expect(value(0, 0)).toBe(4);
    await s.settle();
    expect(srv.sheet.rev).toBe(1);
  });
  it('shows a write at once, sends writes in order, and converges with others', async () => {
    srv.hold(true);
    s.write('sheet0001', set(0, 0, 1));
    s.write('sheet0001', set(0, 1, 2));
    expect([value(0, 0), value(0, 1)]).toEqual([1, 2]);
    // Someone else writes C1 while ours are in flight; the room relays every write in the server's order.
    await flush();
    srv.external(set(0, 2, 9));
    for (const op of srv.drain()) s.receive(op);
    srv.hold(false);
    srv.release();
    await flush();
    await s.settle();
    for (const op of srv.drain()) s.receive(op);
    expect([value(0, 0), value(0, 1)]).toEqual([1, 2]);
    expect(srv.sheet.rev).toBe(3);
    // The server's order (ours, theirs, ours) shows the same.
    expect(s.sheet('sheet0001')!.cells.size).toBe(3);
  });
  it('drops repeats, applies the room in order and refetches after a gap', async () => {
    vi.useFakeTimers();
    const a = srv.external(set(1, 0, 5));
    s.receive(a);
    s.receive(a);
    srv.drain();
    expect(value(1, 0)).toBe(5);
    srv.external(set(1, 1, 6));
    const c = srv.external(set(1, 2, 7));
    s.receive(c);
    expect(value(1, 2)).toBeNull();
    await vi.advanceTimersByTimeAsync(500);
    vi.useRealTimers();
    await flush();
    expect(value(1, 2)).toBe(7);
    expect(value(1, 1)).toBe(6);
  });
  it('refuses a write past the limits at once, and reverts one the server refuses', async () => {
    const toast = vi.fn();
    s = store(srv.api, { toast });
    await s.loadTab('t1');
    expect(
      s.write('sheet0001', {
        kind: 'cells',
        cells: [{ r: rows[0]!, c: cols[0]!, i: { s: 'x'.repeat(10_001) } }],
      }),
    ).toBe('input_too_long');
    expect(toast).toHaveBeenCalledWith('A cell holds up to 10,000 characters');
    srv.api.writeSheet.mockRejectedValueOnce(new ApiError('sheet write', 413, 'sheet_full'));
    s.write('sheet0001', set(2, 0, 1));
    await s.settle();
    await flush();
    expect(toast).toHaveBeenLastCalledWith('This sheet holds the most cells it can');
    expect(value(2, 0)).toBeNull();
    expect(s.write('nope', set(0, 0, 1))).toBe('write_invalid');
  });
  it('keeps a write the server could not take for now and sends it again, waiting longer each time', async () => {
    const toast = vi.fn();
    const waits: number[] = [];
    s = store(srv.api, { toast, wait: async (ms) => void waits.push(ms) });
    await s.loadTab('t1');
    srv.api.writeSheet
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new ApiError('sheet write', 503, null))
      .mockRejectedValueOnce(new ApiError('sheet write', 429, 'rate_limited'));
    s.write('sheet0001', set(2, 0, 4));
    await s.settle();
    expect(waits).toEqual([500, 1000, 2000]);
    expect(srv.api.writeSheet).toHaveBeenCalledTimes(4);
    expect(toast).not.toHaveBeenCalled();
    expect(value(2, 0)).toBe(4);
    expect(srv.sheet.cells.get(cellKey(rows[2]!, cols[0]!))?.input).toEqual({ n: 4 });
  });
  it('sends nothing again once the room has confirmed a write whose answer was lost', async () => {
    srv.api.writeSheet.mockImplementationOnce(async (...args) => {
      await srv.api.writeSheet.getMockImplementation()!(...args);
      throw new TypeError('Failed to fetch');
    });
    s = store(srv.api, {
      wait: async () => {
        for (const op of srv.drain()) s.receive(op);
      },
    });
    await s.loadTab('t1');
    s.write('sheet0001', set(2, 0, 4));
    await s.settle();
    expect(srv.api.writeSheet).toHaveBeenCalledTimes(1);
    expect(srv.sheet.rev).toBe(1);
    expect(value(2, 0)).toBe(4);
  });
  it('pushes an undo step that puts the cells back', async () => {
    const steps: { undo: () => void; redo: () => void }[] = [];
    s = store(srv.api, { pushUndo: (st) => steps.push(st as never) });
    await s.loadTab('t1');
    s.write('sheet0001', set(0, 0, 3));
    expect(steps).toHaveLength(1);
    steps[0]!.undo();
    expect(value(0, 0)).toBeNull();
    steps[0]!.redo();
    expect(value(0, 0)).toBe(3);
    await s.settle();
    expect(steps).toHaveLength(1);
  });
  it("undoes a row deletion into the sheet as it is then, keeping a card table's later links", async () => {
    const steps: { undo: () => void; redo: () => void }[] = [];
    s = store(srv.api, { pushUndo: (st) => steps.push(st as never) });
    await s.loadTab('t1');
    const table = {
      id: 'tbl1',
      head: rows[0]!,
      cols: [{ c: cols[0]!, field: 'Title' }],
      rows: { [rows[1]!]: 'i1', [rows[2]!]: 'i2' },
      type: 'task',
    };
    const quiet = { undoable: false };
    s.write(
      'sheet0001',
      { kind: 'layout', changes: [{ k: 'cardTable', id: 'tbl1', table }] },
      quiet,
    );
    s.write('sheet0001', { kind: 'layout', changes: [{ k: 'deleteRows', ids: [rows[2]!] }] });
    // A card linked to another row after the deletion (the sync's bookkeeping, no undo step).
    const linked = { ...table, rows: { [rows[1]!]: 'i1', [rows[3]!]: 'i3' } };
    s.write(
      'sheet0001',
      { kind: 'layout', changes: [{ k: 'cardTable', id: 'tbl1', table: linked }] },
      quiet,
    );
    steps.at(-1)!.undo();
    expect(s.sheet('sheet0001')!.layout.cardTables![0]!.rows).toEqual({
      [rows[1]!]: 'i1',
      [rows[2]!]: 'i2',
      [rows[3]!]: 'i3',
    });
    await s.settle();
  });
  it('takes several writes as one change: one undo step puts them all back, a refusal applies none', async () => {
    const steps: { undo: () => void; redo: () => void }[] = [];
    s = store(srv.api, { pushUndo: (st) => steps.push(st as never) });
    await s.loadTab('t1');
    s.write('sheet0001', set(1, 0, 1));
    steps.length = 0;
    expect(
      s.writeAll([
        { sheetId: 'sheet0001', write: set(0, 0, 5) },
        { sheetId: 'sheet0001', write: set(1, 0, 6) },
      ]),
    ).toBeNull();
    expect([value(0, 0), value(1, 0)]).toEqual([5, 6]);
    expect(steps).toHaveLength(1);
    steps[0]!.undo();
    expect([value(0, 0), value(1, 0)]).toEqual([null, 1]);
    steps[0]!.redo();
    expect([value(0, 0), value(1, 0)]).toEqual([5, 6]);
    // One bad write refuses the whole change.
    expect(
      s.writeAll([
        { sheetId: 'sheet0001', write: set(2, 0, 7) },
        { sheetId: 'nope', write: set(0, 0, 1) },
      ]),
    ).toBe('write_invalid');
    expect(value(2, 0)).toBeNull();
    await s.settle();
  });
  it('creates, deletes and hears sheets come and go', async () => {
    s.create({ id: 'sheet0002', tabId: 't1', title: 'Two', layout: emptyLayout(rand, 2, 2) });
    expect(s.titlesOn('t1').sort()).toEqual(['Sheet 1', 'Two']);
    await s.settle();
    s.receive({ kind: 'sheets', sheetId: 'sheet0002', tabId: 't1', rev: 1, deleted: true });
    expect(s.sheet('sheet0002')).toBeUndefined();
    s.receive({ kind: 'sheets', sheetId: 'sheet0001', tabId: 't1', rev: 9, created: true });
    s.receive({ kind: 'sheets', sheetId: 'unknown1', tabId: 't1', rev: 1, refetch: true });
    srv.api.createSheet.mockRejectedValueOnce(
      new ApiError('sheet create', 409, 'sheet_title_taken'),
    );
    s.create({ id: 'sheet0003', tabId: 't1', title: 'Sheet 1', layout: emptyLayout(rand, 2, 2) });
    await s.settle();
    expect(s.sheet('sheet0003')).toBeUndefined();
  });
  it('deletes a sheet with its element, and Undo makes it again as it was', async () => {
    s.write('sheet0001', set(0, 0, 7));
    await s.settle();
    s.release(['sheet0001', 'notloaded']);
    expect(s.sheet('sheet0001')).toBeUndefined();
    await s.settle();
    expect(srv.api.deleteSheet).toHaveBeenCalledTimes(1);
    expect(srv.api.deleteSheet).toHaveBeenCalledWith(expect.anything(), 'sheet0001', {
      whenUnreferenced: true,
    });
    // A new sheet took the title meanwhile: the restored one takes the next free title.
    s.create({ id: 'sheet0009', tabId: 't1', title: 'Sheet 1', layout: emptyLayout(rand, 2, 2) });
    expect(s.restoreReleased('sheet0001')).toBe(true);
    // Back at once, as it was.
    expect(s.sheet('sheet0001')!.title).toBe('Sheet 1 2');
    expect(value(0, 0)).toBe(7);
    // Once: a second Undo of the same element has nothing to make.
    expect(s.restoreReleased('sheet0001')).toBe(false);
    await s.settle();
    const create = srv.api.createSheet.mock.calls.at(-1)![1] as Record<string, unknown>;
    expect(create).toMatchObject({ id: 'sheet0001', restore: true, title: 'Sheet 1 2' });
    expect((create.cells as unknown[]).length).toBe(1);
  });
  it('lets the caller take a refused create over', async () => {
    const toast = vi.fn();
    const own = store(srv.api, { toast });
    await own.loadTab('t1');
    srv.api.createSheet.mockRejectedValueOnce(new ApiError('sheet create', 404, 'sheet_not_found'));
    const onRefused = vi.fn((code: string | null) => code === 'sheet_not_found');
    own.create({ id: 'sheet0004', tabId: 't1', title: 'Copy', copyOf: 'gone00001' }, undefined, {
      onRefused,
    });
    await own.settle();
    expect(onRefused).toHaveBeenCalledWith('sheet_not_found');
    expect(toast).not.toHaveBeenCalled();
    expect(own.sheet('sheet0004')).toBeUndefined();
  });
  it('fails a tab load quietly and resyncs', async () => {
    const bad = store({
      ...srv.api,
      fetchSheets: vi.fn(async () => {
        throw new ApiError('sheets', 500, null);
      }),
    } as never);
    await bad.loadTab('t1');
    expect(bad.status('t1')).toBe('error');
    s.resync();
    await flush();
    expect(srv.api.fetchSheets).toHaveBeenCalledTimes(2);
  });
  it('keeps one store per document and names refusals', () => {
    forgetSheetStores();
    const deps = {
      scope: { documentId: 'dX', ownerId: 'o', shareCode: null, tabId: null },
      self: () => by,
      locale: 'en',
      pushUndo: () => {},
      toast: () => {},
    };
    expect(sheetStoreFor(deps)).toBe(sheetStoreFor(deps));
    expect(sheetRefusalMessage(null)).toBe("Couldn't save that change");
    expect(cellKey('a', 'b')).toBe('a:b');
  });
});

// A change past one write's size (a big paste, fill or CSV import) is split before it is checked, so the per-write
// cap never refuses what the sheet allows; the parts go in order, as one undo step.
describe('a write past one write size', () => {
  it('is accepted, shown at once, sent as parts in order, and undone in one step', async () => {
    const big: SheetJson = {
      ...initial(),
      id: 'sheetBIG1',
      layout: emptyLayout(rand, 120, 100),
    };
    const sent: SheetWrite[] = [];
    const steps: { undo: () => void; redo: () => void }[] = [];
    const toast = vi.fn();
    const s = new SheetStore({
      scope: { documentId: 'dBig', ownerId: 'o', shareCode: null, tabId: null },
      self: () => by,
      locale: 'en-GB',
      pushUndo: (st) => steps.push(st),
      toast,
      api: {
        fetchSheets: async () => [big],
        writeSheet: vi.fn(async (_s: unknown, _id: string, req: { write: SheetWrite }) => {
          sent.push(req.write);
          return { applied: req.write, rev: sent.length, cells: [] };
        }),
      } as never,
    });
    await s.loadTab('t1');
    const { rows, cols } = big.layout;
    const cells = rows.flatMap((r, ri) =>
      cols.map((c, ci) => ({ r, c, i: { n: ri * 100 + ci + 1 } })),
    );
    expect(cells).toHaveLength(12_000);
    expect(s.write('sheetBIG1', { kind: 'cells', cells })).toBeNull();
    expect(toast).not.toHaveBeenCalled();
    const wb = () => s.workbook('t1');
    expect([wb().value('sheetBIG1', 0, 0), wb().value('sheetBIG1', 119, 99)]).toEqual([1, 12_000]);
    expect(s.sheet('sheetBIG1')!.cells.size).toBe(12_000);
    await s.settle();
    expect(sent).toHaveLength(3);
    const sentCells = sent.flatMap((w) => (w.kind === 'cells' ? w.cells : []));
    expect(sentCells.map((x) => cellKey(x.r, x.c))).toEqual(cells.map((x) => cellKey(x.r, x.c)));
    expect(sent.every((w) => w.kind === 'cells' && w.cells.length <= 5_000)).toBe(true);
    expect(steps).toHaveLength(1);
    steps[0]!.undo();
    expect(s.sheet('sheetBIG1')!.cells.size).toBe(0);
    expect([wb().value('sheetBIG1', 0, 0), wb().value('sheetBIG1', 119, 99)]).toEqual([null, null]);
    expect(steps).toHaveLength(1);
    await s.settle();
    expect(sent).toHaveLength(6);
  });
});

// The store's quieter paths: Plan cards handed to the workbooks, sheets made and gone in the room, refetches after
// a gap, answers that arrive after their sheet went, and refusals that drop a sheet.
describe('the sheet store client, edges', () => {
  let srv: ReturnType<typeof server>;
  let s: SheetStore;
  let toast: ReturnType<typeof vi.fn<(m: string) => void>>;
  const cellAt = (r: number, c: number, n: number): SheetWrite => ({
    kind: 'cells',
    cells: [{ r: srv.sheet.layout.rows[r]!, c: srv.sheet.layout.cols[c]!, i: { n } }],
  });

  beforeEach(async () => {
    srv = server(initial());
    toast = vi.fn();
    s = store(srv.api, { toast });
    await s.loadTab('t1');
  });

  it('hands Plan cards to its workbooks once, and knows when a formula reads them', () => {
    s.workbook('t1');
    expect(s.usesCards()).toBe(false);
    const v = s.version;
    s.setCards(null);
    expect(s.version).toBe(v);
    const cards = { version: 1 } as never;
    s.setCards(cards);
    expect(s.version).toBe(v + 1);
    s.setCards(cards);
    expect(s.version).toBe(v + 1);
    s.write('sheet0001', {
      kind: 'cells',
      cells: [
        {
          r: srv.sheet.layout.rows[0]!,
          c: srv.sheet.layout.cols[0]!,
          i: { f: { t: 'CARDCOUNT()', r: [] } },
        },
      ],
    } as SheetWrite);
    expect(s.usesCards()).toBe(true);
  });

  it('fetches a sheet made in the room on a loaded tab, and ignores one on a tab not loaded', async () => {
    srv.api.fetchSheets.mockClear();
    s.receive({ kind: 'sheets', sheetId: 'sheet0009', tabId: 't2', rev: 0, created: true });
    expect(srv.api.fetchSheets).not.toHaveBeenCalled();
    srv.api.fetchSheets.mockResolvedValueOnce([
      { ...sheetToJson(srv.sheet), id: 'sheet0009', title: 'New' },
    ]);
    s.receive({ kind: 'sheets', sheetId: 'sheet0009', tabId: 't1', rev: 0, created: true });
    await flush();
    expect(srv.api.fetchSheets).toHaveBeenCalledWith(expect.anything(), { ids: ['sheet0009'] });
    expect(s.sheet('sheet0009')?.title).toBe('New');
    // Ops for a sheet it does not have, and a deletion of one it does not have, are ignored.
    s.receive({
      kind: 'sheets',
      sheetId: 'unknown1',
      tabId: 't1',
      rev: 3,
      applied: cellAt(0, 0, 1),
    });
    s.receive({ kind: 'sheets', sheetId: 'unknown1', tabId: 't1', rev: 3, deleted: true });
    expect(s.sheet('unknown1')).toBeUndefined();
  });

  it('drops a sheet a refetch no longer finds, and keeps it when the refetch fails', async () => {
    vi.useFakeTimers();
    srv.api.fetchSheets.mockRejectedValueOnce(new Error('offline'));
    s.receive({ kind: 'sheets', sheetId: 'sheet0001', tabId: 't1', rev: 5, refetch: true });
    await vi.advanceTimersByTimeAsync(SHEET_REFETCH_DEBOUNCE_MS);
    expect(s.sheet('sheet0001')).toBeDefined();
    srv.api.fetchSheets.mockResolvedValueOnce([]);
    s.receive({ kind: 'sheets', sheetId: 'sheet0001', tabId: 't1', rev: 5, refetch: true });
    await vi.advanceTimersByTimeAsync(SHEET_REFETCH_DEBOUNCE_MS);
    vi.useRealTimers();
    expect(s.sheet('sheet0001')).toBeUndefined();
  });

  it('settles its own pending write when the room says to refetch it', async () => {
    vi.useFakeTimers();
    srv.hold(true);
    s.write('sheet0001', cellAt(0, 0, 4));
    await vi.advanceTimersByTimeAsync(0);
    const [op] = srv.drain() as { wid: string }[];
    s.receive({
      kind: 'sheets',
      sheetId: 'sheet0001',
      tabId: 't1',
      rev: 1,
      refetch: true,
      wid: op!.wid,
    });
    await vi.advanceTimersByTimeAsync(SHEET_REFETCH_DEBOUNCE_MS);
    srv.release();
    await vi.advanceTimersByTimeAsync(0);
    vi.useRealTimers();
    await s.settle();
    expect(s.workbook('t1').value('sheet0001', 0, 0)).toBe(4);
  });

  it('refetches when its own answer skips a rev (someone else wrote in between)', async () => {
    vi.useFakeTimers();
    srv.external(cellAt(1, 0, 7));
    srv.drain();
    s.write('sheet0001', cellAt(0, 0, 1));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(SHEET_REFETCH_DEBOUNCE_MS);
    vi.useRealTimers();
    await flush();
    expect([
      s.workbook('t1').value('sheet0001', 0, 0),
      s.workbook('t1').value('sheet0001', 1, 0),
    ]).toEqual([1, 7]);
  });

  it('ignores an answer that arrives after its sheet went', async () => {
    srv.hold(true);
    s.write('sheet0001', cellAt(0, 0, 4));
    await flush();
    s.receive({ kind: 'sheets', sheetId: 'sheet0001', tabId: 't1', rev: 9, deleted: true });
    srv.release();
    await s.settle();
    expect(s.sheet('sheet0001')).toBeUndefined();
  });

  it('drops a sheet the server says is gone when a write is refused', async () => {
    srv.api.writeSheet.mockRejectedValueOnce(new ApiError('sheet write', 404, 'sheet_not_found'));
    srv.api.fetchSheets.mockResolvedValueOnce([]);
    s.write('sheet0001', cellAt(0, 0, 4));
    await s.settle();
    await flush();
    expect(toast).toHaveBeenCalledWith('This sheet is no longer in this document');
    expect(s.sheet('sheet0001')).toBeUndefined();
  });

  it('drops a refused create whose source has gone, saying so', async () => {
    srv.api.createSheet.mockRejectedValueOnce(new ApiError('sheet create', 404, 'sheet_not_found'));
    s.create({ id: 'sheet0005', tabId: 't1', title: 'Copy', copyOf: 'gone00001' });
    await s.settle();
    expect(toast).toHaveBeenCalledWith('This sheet is no longer in this document');
    expect(s.sheet('sheet0005')).toBeUndefined();
  });

  it('says a refused delete, but not one already gone', async () => {
    srv.api.deleteSheet.mockRejectedValueOnce(new ApiError('sheet delete', 403, 'forbidden'));
    s.release(['sheet0001']);
    await s.settle();
    expect(toast).toHaveBeenCalledWith("Couldn't save that change");
    toast.mockClear();
    srv.api.deleteSheet.mockRejectedValueOnce(new ApiError('sheet delete', 404, 'sheet_not_found'));
    s.restoreReleased('sheet0001');
    await s.settle();
    s.release(['sheet0001']);
    await s.settle();
    expect(toast).not.toHaveBeenCalled();
  });
});
