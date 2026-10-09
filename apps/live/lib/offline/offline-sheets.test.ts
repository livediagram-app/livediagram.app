// An offline document's sheet store (docs/specs/029-sheets/sheet-store.md "Offline documents"): the sheets live in
// the record, every write is the api's own transition, and refusals are the api's.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DOCUMENT_SHEETS_MAX, SHEET_SIZED_AXES_MAX, type SheetJson } from '@livediagram/sheets';
import { __setOfflineBackend, offlineGetRecord, offlinePutRecord } from './offline-store';
import { memBackend, testRecord } from './offline-test-utils';
import {
  offlineCreateSheet,
  offlineDeleteSheet,
  offlineFetchSheets,
  offlineWriteSheet,
} from './offline-sheets';

const ME = { id: 'me', name: 'Me', color: '#2563eb' };
const layout = { rows: ['aaaa', 'bbbb'], cols: ['cccc', 'dddd'] };
// Past the sized-lines limit (SHEET_SIZED_AXES_MAX): a sheet the size checks call full.
const crowded = {
  ...layout,
  rowSize: Object.fromEntries(
    Array.from({ length: SHEET_SIZED_AXES_MAX + 1 }, (_, i) => [
      `s${String(i).padStart(5, '0')}`,
      30,
    ]),
  ),
};
const stored = (id: string, tabId: string, title = id): SheetJson => ({
  id,
  tabId,
  title,
  layout,
  cells: [{ r: 'aaaa', c: 'cccc', i: { n: 1 } }],
  rev: 3,
  createdAt: 1,
  updatedAt: 1,
  updatedBy: ME,
});

beforeEach(() => __setOfflineBackend(memBackend()));
afterEach(() => __setOfflineBackend(null));

describe('offlineFetchSheets', () => {
  it('reads none from a record written before sheets, or no record', async () => {
    await offlinePutRecord(testRecord());
    expect(await offlineFetchSheets('d1', null)).toEqual([]);
    expect(await offlineFetchSheets('nope', { tabId: 't1' })).toEqual([]);
  });

  it('reads every sheet, a tab, or named ones', async () => {
    const sheets = [
      stored('sheetAAAA', 't1'),
      stored('sheetBBBB', 't2'),
      stored('sheetCCCC', 't1'),
    ];
    await offlinePutRecord(testRecord({ sheets }));
    expect(await offlineFetchSheets('d1', null)).toHaveLength(3);
    expect((await offlineFetchSheets('d1', { tabId: 't1' })).map((s) => s.id)).toEqual([
      'sheetAAAA',
      'sheetCCCC',
    ]);
    expect(
      (await offlineFetchSheets('d1', { ids: ['sheetBBBB', 'missing01'] })).map((s) => s.id),
    ).toEqual(['sheetBBBB']);
  });
});

describe('offlineCreateSheet', () => {
  it('makes a sheet in the record, with an id made when none is given', async () => {
    await offlinePutRecord(testRecord());
    const made = await offlineCreateSheet('d1', { tabId: 't1', title: 'Budget' }, ME);
    expect(made).toMatchObject({ tabId: 't1', title: 'Budget', rev: 0, cells: [], updatedBy: ME });
    expect(made.id).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(made.layout.rows.length).toBeGreaterThan(0);
    expect((await offlineGetRecord('d1'))?.sheets?.map((s) => s.id)).toEqual([made.id]);
  });

  it('copies a sheet in the record', async () => {
    await offlinePutRecord(testRecord({ sheets: [stored('sheetAAAA', 't1')] }));
    const copy = await offlineCreateSheet(
      'd1',
      { id: 'sheetCOPY', tabId: 't2', title: 'Copy', copyOf: 'sheetAAAA' },
      ME,
    );
    expect(copy).toMatchObject({ id: 'sheetCOPY', tabId: 't2', rev: 0, layout });
    expect(copy.cells).toEqual(stored('sheetAAAA', 't1').cells);
  });

  it('takes the layout and cells given', async () => {
    await offlinePutRecord(testRecord());
    const made = await offlineCreateSheet(
      'd1',
      {
        id: 'sheetAAAA',
        tabId: 't1',
        title: 'X',
        layout,
        cells: [{ r: 'bbbb', c: 'dddd', i: { s: 'hi' } }],
      },
      ME,
    );
    expect(made.cells).toEqual([{ r: 'bbbb', c: 'dddd', i: { s: 'hi' } }]);
  });

  it('refuses as the api does', async () => {
    await offlinePutRecord(testRecord({ sheets: [stored('sheetAAAA', 't1', 'Taken')] }));
    await expect(
      offlineCreateSheet('d1', { id: 'sheetAAAA', tabId: 't1', title: 'New' }, ME),
    ).rejects.toMatchObject({ status: 409, code: 'sheet_exists' });
    await expect(
      offlineCreateSheet('d1', { id: 'sheetBBBB', tabId: 't1', title: 'taken' }, ME),
    ).rejects.toMatchObject({ status: 409, code: 'sheet_title_taken' });
    // The same title on another tab is fine.
    await expect(
      offlineCreateSheet('d1', { id: 'sheetBBBB', tabId: 't2', title: 'Taken' }, ME),
    ).resolves.toMatchObject({ id: 'sheetBBBB' });
    await expect(
      offlineCreateSheet(
        'd1',
        { id: 'sheetCCCC', tabId: 't1', title: 'C', copyOf: 'gone00001' },
        ME,
      ),
    ).rejects.toMatchObject({ status: 404, code: 'sheet_not_found' });
    await expect(
      offlineCreateSheet('d1', { id: 'bad id', tabId: 't1', title: 'C' }, ME),
    ).rejects.toMatchObject({ status: 400, code: 'write_invalid' });
    await expect(offlineCreateSheet('nope', { tabId: 't1', title: 'C' }, ME)).rejects.toMatchObject(
      { status: 404, code: 'not_found' },
    );
    await offlinePutRecord(testRecord({ id: 'd2', trashedAt: 5 }));
    await expect(offlineCreateSheet('d2', { tabId: 't1', title: 'C' }, ME)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('refuses a document already holding the most sheets', async () => {
    const sheets = Array.from({ length: DOCUMENT_SHEETS_MAX }, (_, i) =>
      stored(`sheet${String(i).padStart(4, '0')}`, 't1'),
    );
    await offlinePutRecord(testRecord({ sheets }));
    await expect(
      offlineCreateSheet('d1', { id: 'sheetMORE', tabId: 't1', title: 'More' }, ME),
    ).rejects.toMatchObject({ status: 413, code: 'sheets_full' });
  });

  it('refuses a sheet past a size limit as 413, and a malformed one as 400', async () => {
    await offlinePutRecord(testRecord());
    await expect(
      offlineCreateSheet(
        'd1',
        { id: 'sheetFULL', tabId: 't1', title: 'Full', layout: crowded },
        ME,
      ),
    ).rejects.toMatchObject({ status: 413, code: 'sheet_full' });
    const rows = Array.from({ length: 10_001 }, (_, i) => `r${String(i).padStart(5, '0')}`);
    await expect(
      offlineCreateSheet(
        'd1',
        { id: 'sheetHUGE', tabId: 't1', title: 'Huge', layout: { rows, cols: ['cccc'] } },
        ME,
      ),
    ).rejects.toMatchObject({ status: 400, code: 'sheet_too_large' });
  });
});

describe('offlineWriteSheet', () => {
  beforeEach(async () => {
    await offlinePutRecord(
      testRecord({ sheets: [stored('sheetAAAA', 't1', 'One'), stored('sheetBBBB', 't1', 'Two')] }),
    );
  });

  it('applies a cells write and answers with the cells it touched', async () => {
    const answer = await offlineWriteSheet(
      'd1',
      'sheetAAAA',
      { write: { kind: 'cells', cells: [{ r: 'bbbb', c: 'dddd', i: { s: 'x' } }] } },
      ME,
    );
    expect(answer.rev).toBe(4);
    expect(answer.cells).toEqual([{ r: 'bbbb', c: 'dddd', i: { s: 'x' } }]);
    const rec = await offlineGetRecord('d1');
    expect(rec?.sheets?.[0]?.cells).toHaveLength(2);
    expect(rec?.sheets?.[1]?.rev).toBe(3);
  });

  it('renames, trimmed, answering with no cells', async () => {
    const answer = await offlineWriteSheet(
      'd1',
      'sheetAAAA',
      { write: { kind: 'title', title: '  Renamed  ' } },
      ME,
    );
    expect(answer.cells).toEqual([]);
    expect((await offlineGetRecord('d1'))?.sheets?.[0]?.title).toBe('Renamed');
  });

  it('answers a layout write with no cells', async () => {
    const answer = await offlineWriteSheet(
      'd1',
      'sheetAAAA',
      {
        write: { kind: 'layout', changes: [{ k: 'hide', axis: 'r', ids: ['aaaa'], hidden: true }] },
      },
      ME,
    );
    expect(answer.cells).toEqual([]);
    expect(answer.applied.kind).toBe('layout');
  });

  it('refuses a write that grows a sheet already past a limit as 413', async () => {
    await offlinePutRecord(
      testRecord({ sheets: [{ ...stored('sheetAAAA', 't1'), layout: crowded }] }),
    );
    await expect(
      offlineWriteSheet(
        'd1',
        'sheetAAAA',
        { write: { kind: 'cells', cells: [{ r: 'aaaa', c: 'cccc', i: { n: 2 } }] } },
        ME,
      ),
    ).rejects.toMatchObject({ status: 413, code: 'sheet_full' });
  });

  it('refuses as the api does', async () => {
    await expect(
      offlineWriteSheet('d1', 'sheetAAAA', { write: { kind: 'title', title: 'two' } }, ME),
    ).rejects.toMatchObject({ status: 409, code: 'sheet_title_taken' });
    // Its own title, cased differently, is not taken.
    await expect(
      offlineWriteSheet('d1', 'sheetAAAA', { write: { kind: 'title', title: 'ONE' } }, ME),
    ).resolves.toBeDefined();
    await expect(
      offlineWriteSheet('d1', 'missing01', { write: { kind: 'title', title: 'X' } }, ME),
    ).rejects.toMatchObject({ status: 404, code: 'sheet_not_found' });
    await expect(
      offlineWriteSheet(
        'd1',
        'sheetAAAA',
        {
          write: { kind: 'cells', cells: [{ r: 'aaaa', c: 'cccc', i: { s: 'x'.repeat(10_001) } }] },
        },
        ME,
      ),
    ).rejects.toMatchObject({ status: 400, code: 'input_too_long' });
    await expect(
      offlineWriteSheet('nope', 'sheetAAAA', { write: { kind: 'title', title: 'X' } }, ME),
    ).rejects.toMatchObject({ status: 404, code: 'not_found' });
  });
});

describe('offlineDeleteSheet', () => {
  it('removes the sheet from the record, and refuses one not there', async () => {
    await offlinePutRecord(testRecord({ sheets: [stored('sheetAAAA', 't1')] }));
    await offlineDeleteSheet('d1', 'sheetAAAA');
    expect((await offlineGetRecord('d1'))?.sheets).toEqual([]);
    await expect(offlineDeleteSheet('d1', 'sheetAAAA')).rejects.toMatchObject({
      status: 404,
      code: 'sheet_not_found',
    });
  });

  it('refuses on a record with no sheets field', async () => {
    await offlinePutRecord(testRecord());
    await expect(offlineDeleteSheet('d1', 'sheetAAAA')).rejects.toMatchObject({ status: 404 });
  });
});
