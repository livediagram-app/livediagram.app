// CSV in and out of a sheet (docs/specs/029-sheets/sheet.md "CSV"): Download CSV saves every row and column up to
// the last filled cell, each value as shown, under the sheet's title made safe for a file name; Import CSV reads a
// file into the sheet, replacing it or at the selection, each value read as typed, a cut one said in a toast.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptyLayout,
  single,
  typeInto,
  type Selection,
  type SheetJson,
  type SheetWrite,
} from '@livediagram/sheets';
import { track } from '@/lib/telemetry';
import { downloadBlob } from '@/lib/download-blob';
import { SheetStore } from './sheet-store-client';
import type { SheetController } from './sheet-controller';
import {
  CSV_TRUNCATED,
  csvWrites,
  downloadSheetCsv,
  importCsvText,
  sheetCsvText,
} from './sheet-csv';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/download-blob', () => ({ downloadBlob: vi.fn() }));

const by = { id: 'me', name: 'Me', color: '#000000' };
let seq = 11;
const rand = () => ((seq = (seq * 16807) % 2147483647) - 1) / 2147483646;
const ID = 'sheet0001';

async function makeStore(title = 'Sheet 1', rows = 6, cols = 4) {
  const json: SheetJson = {
    id: ID,
    tabId: 't1',
    title,
    layout: emptyLayout(rand, rows, cols),
    cells: [],
    rev: 0,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: by,
  };
  const store = new SheetStore({
    scope: { documentId: 'd1', ownerId: 'o', shareCode: null, tabId: null },
    self: () => by,
    locale: 'en-GB',
    pushUndo: () => {},
    toast: () => {},
    api: {
      fetchSheets: async () => [json],
      writeSheet: () => new Promise(() => {}),
    } as never,
  });
  await store.loadTab('t1');
  return store;
}

function type(store: SheetStore, r: number, c: number, text: string) {
  const res = typeInto(store.workbook('t1'), ID, { r, c }, text);
  if (!res?.ok) throw new Error(`could not type ${text}`);
  store.write(ID, res.write);
}

// A controller over the store, as importCsvText sees it.
function controller(store: SheetStore, selection: Selection) {
  const kinds: string[] = [];
  const toast = vi.fn();
  const c = {
    get sheet() {
      return store.sheet(ID)!;
    },
    get workbook() {
      return store.workbook('t1');
    },
    selectionNow: () => selection,
    write: (w: SheetWrite, kind: string) => {
      kinds.push(kind);
      return store.write(ID, w) === null;
    },
    writeAll: (edits: { sheetId: string; write: SheetWrite }[], kind: string) => {
      kinds.push(kind);
      return store.writeAll(edits) === null;
    },
    toast,
  } as unknown as SheetController;
  return { c, kinds, toast };
}

const value = (store: SheetStore, r: number, c: number) => store.workbook('t1').value(ID, r, c);

beforeEach(() => vi.clearAllMocks());

describe('sheetCsvText', () => {
  it('is empty for an empty sheet', async () => {
    const store = await makeStore();
    expect(sheetCsvText(store.workbook('t1'), store.sheet(ID)!)).toBe('');
  });

  it('writes up to the last filled cell, each value as shown, quoting where needed', async () => {
    const store = await makeStore();
    type(store, 0, 0, '2');
    type(store, 0, 1, '=A1*3');
    type(store, 1, 2, 'a, "b"');
    type(store, 2, 0, '50%');
    const text = sheetCsvText(store.workbook('t1'), store.sheet(ID)!);
    expect(text).toBe('2,6,\r\n,,"a, ""b"""\r\n50.00%,,\r\n');
  });
});

describe('downloadSheetCsv', () => {
  it('saves the CSV under the title, made safe for a file name, and tracks it', async () => {
    const store = await makeStore('a/b: c?');
    type(store, 0, 0, 'x');
    downloadSheetCsv(store.workbook('t1'), store.sheet(ID)!);
    const [blob, name] = vi.mocked(downloadBlob).mock.calls[0]!;
    expect(name).toBe('a b  c.csv');
    expect(blob.type).toBe('text/csv;charset=utf-8');
    expect(await blob.text()).toBe('x\r\n');
    expect(track).toHaveBeenCalledWith('Sheet', 'Exported', 'Csv');
  });

  it('falls back to Sheet for a title of only unsafe characters', async () => {
    const store = await makeStore('???');
    downloadSheetCsv(store.workbook('t1'), store.sheet(ID)!);
    expect(vi.mocked(downloadBlob).mock.calls[0]![1]).toBe('Sheet.csv');
  });
});

describe('csvWrites', () => {
  it('is null for a file with no rows, or a sheet the workbook lacks', async () => {
    const store = await makeStore();
    expect(csvWrites(store.workbook('t1'), ID, { r: 0, c: 0 }, '')).toBeNull();
    expect(csvWrites(store.workbook('t1'), 'missing01', { r: 0, c: 0 }, 'a,b')).toBeNull();
  });

  it('reads each value as typed from where it is put', async () => {
    const store = await makeStore();
    const made = csvWrites(store.workbook('t1'), ID, { r: 1, c: 1 }, 'a,2\n3,TRUE')!;
    expect(made.truncated).toBe(false);
    for (const w of made.writes) store.write(ID, w);
    expect([
      value(store, 1, 1),
      value(store, 1, 2),
      value(store, 2, 1),
      value(store, 2, 2),
    ]).toEqual(['a', 2, 3, true]);
  });

  it('says a file wider than a sheet was cut', async () => {
    const store = await makeStore();
    const wide = Array.from({ length: 201 }, (_, i) => String(i)).join(',');
    expect(csvWrites(store.workbook('t1'), ID, { r: 0, c: 0 }, wide)!.truncated).toBe(true);
  });
});

describe('importCsvText', () => {
  it('replaces every cell, from A1, and tracks the import', async () => {
    const store = await makeStore();
    type(store, 4, 3, 'old');
    const { c, kinds, toast } = controller(store, single({ r: 2, c: 2 }));
    importCsvText(c, 'x,y', 'replace');
    // The clear and the paste are one change: one write, one undo step.
    expect(kinds).toEqual(['Paste']);
    expect([value(store, 0, 0), value(store, 0, 1), value(store, 4, 3)]).toEqual(['x', 'y', null]);
    expect(toast).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('Sheet', 'Imported', 'Csv');
  });

  it('inserts at the last selected range, keeping the other cells', async () => {
    const store = await makeStore();
    type(store, 0, 0, 'keep');
    const sel: Selection = {
      ranges: [
        { r1: 0, c1: 0, r2: 0, c2: 0 },
        { r1: 3, c1: 2, r2: 4, c2: 3 },
      ],
      active: { r: 3, c: 2 },
      anchor: { r: 3, c: 2 },
    };
    const { c, kinds } = controller(store, sel);
    importCsvText(c, '7', 'insert');
    expect(kinds).not.toContain('Clear');
    expect([value(store, 0, 0), value(store, 3, 2)]).toEqual(['keep', 7]);
  });

  it('writes nothing for an empty file, and tracks nothing', async () => {
    const store = await makeStore();
    const { c, kinds } = controller(store, single({ r: 0, c: 0 }));
    importCsvText(c, '', 'insert');
    expect(kinds).toEqual([]);
    expect(track).not.toHaveBeenCalled();
  });

  it('says a cut file in a toast', async () => {
    const store = await makeStore();
    const { c, toast } = controller(store, single({ r: 0, c: 0 }));
    importCsvText(c, Array.from({ length: 201 }, () => 'v').join(','), 'replace');
    expect(toast).toHaveBeenCalledWith(CSV_TRUNCATED);
  });
});
