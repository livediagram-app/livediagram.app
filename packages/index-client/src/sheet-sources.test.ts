import { describe, expect, it } from 'vitest';
import { createIndexAppClient, createIndexClient } from './client';
import {
  isSheetAxisRange,
  isSheetChartTable,
  isSheetListing,
  isSheetRangeDoorRead,
  isSheetSourceApp,
  isSourceWatchApp,
  readSheetRangeAsk,
  readSourceChange,
  SHEET_CHANGE_SHEETS_MAX,
} from './sheet-sources';

const RANGE = { r1: 'r0001', c1: 'c0001', r2: 'r0009', c2: 'c0004' };

type Seen = { url: string; method: string; headers: Headers; body: unknown };
function fakeFetch(answer: unknown) {
  const seen: Seen[] = [];
  const doFetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    seen.push({
      url: String(input),
      method: init.method ?? 'GET',
      headers: new Headers(init.headers),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    return Response.json(answer);
  }) as typeof fetch;
  return { seen, doFetch };
}

describe('the apps', () => {
  it('reads liveplanner as the source and the canvas apps as the readers', () => {
    expect(isSheetSourceApp('liveplanner')).toBe(true);
    expect(isSheetSourceApp('livedocuments')).toBe(false);
    expect(isSourceWatchApp('livedocuments')).toBe(true);
    expect(isSourceWatchApp('livediagram')).toBe(true);
    expect(isSourceWatchApp('livedesign')).toBe(true);
    expect(isSourceWatchApp('liveplanner')).toBe(false);
  });
});

describe('readSheetRangeAsk', () => {
  it('takes a range of ids, keeping only its corners', () => {
    expect(
      readSheetRangeAsk({ sheetId: 's1', range: { ...RANGE, extra: 1 }, other: true }),
    ).toEqual({ sheetId: 's1', range: RANGE });
  });

  it('takes A1 text, trimmed, and picked columns', () => {
    expect(readSheetRangeAsk({ sheetId: 's1', a1: ' B2:E9 ', cols: ['c0002', 'c0003'] })).toEqual({
      sheetId: 's1',
      a1: 'B2:E9',
      cols: ['c0002', 'c0003'],
    });
  });

  it.each([
    ['not an object', null],
    ['an array', []],
    ['no sheet', { range: RANGE }],
    ['a bad sheet id', { sheetId: 'a b', range: RANGE }],
    ['neither range nor A1', { sheetId: 's1' }],
    ['both range and A1', { sheetId: 's1', range: RANGE, a1: 'A1' }],
    ['a malformed range', { sheetId: 's1', range: { ...RANGE, r2: 'R!' } }],
    ['blank A1', { sheetId: 's1', a1: '   ' }],
    ['A1 that is not text', { sheetId: 's1', a1: 5 }],
    ['A1 too long', { sheetId: 's1', a1: 'A'.repeat(25) }],
    ['empty cols', { sheetId: 's1', a1: 'A1', cols: [] }],
    ['repeated cols', { sheetId: 's1', a1: 'A1', cols: ['c0001', 'c0001'] }],
    [
      'too many cols',
      { sheetId: 's1', a1: 'A1', cols: Array.from({ length: 14 }, (_, i) => `c${1000 + i}`) },
    ],
    ['a bad col', { sheetId: 's1', a1: 'A1', cols: ['C!'] }],
  ])('refuses %s', (_why, raw) => {
    expect(readSheetRangeAsk(raw)).toBeNull();
  });

  it('checks a range alone', () => {
    expect(isSheetAxisRange(RANGE)).toBe(true);
    expect(isSheetAxisRange('r1')).toBe(false);
  });
});

describe('answers', () => {
  const table = { categories: ['Q1'], series: [{ name: 'Sales', values: [3] }] };

  it('checks a table', () => {
    expect(isSheetChartTable(table)).toBe(true);
    expect(isSheetChartTable({ categories: [1], series: [] })).toBe(false);
    expect(isSheetChartTable({ categories: [], series: [{ name: 'x', values: [Infinity] }] })).toBe(
      false,
    );
    expect(isSheetChartTable({ categories: [], series: [null] })).toBe(false);
    expect(isSheetChartTable({ categories: [] })).toBe(false);
  });

  it("checks a door's read and a listing", () => {
    const read = { sheetName: 'Budget', tabId: 't1', range: RANGE, a1: 'A1:D9', table };
    expect(isSheetRangeDoorRead(read)).toBe(true);
    expect(isSheetRangeDoorRead({ ...read, a1: 3 })).toBe(false);
    expect(isSheetListing({ id: 's1', name: 'Budget', tabId: 't1', a1: 'A1:D9' })).toBe(true);
    expect(isSheetListing({ id: 's1', name: 'Budget', tabId: 't1' })).toBe(false);
  });

  it('reads a change, without repeats', () => {
    expect(
      readSourceChange({ app: 'liveplanner', itemId: 'p1', sheetIds: ['s1', 's1', 's2'] }),
    ).toEqual({ app: 'liveplanner', itemId: 'p1', sheetIds: ['s1', 's2'] });
    expect(readSourceChange({ app: 'livediagram', itemId: 'p1', sheetIds: ['s1'] })).toBeNull();
    expect(readSourceChange({ app: 'liveplanner', itemId: 'p1', sheetIds: [] })).toBeNull();
    expect(readSourceChange({ app: 'liveplanner', itemId: 'p1', sheetIds: 's1' })).toBeNull();
    expect(
      readSourceChange({
        app: 'liveplanner',
        itemId: 'p1',
        sheetIds: Array.from({ length: SHEET_CHANGE_SHEETS_MAX + 1 }, (_, i) => `s${i}`),
      }),
    ).toBeNull();
  });
});

describe('the clients', () => {
  it("lists a plan's sheets and reads a range with the reader's grant and watch", async () => {
    const { seen, doFetch } = fakeFetch({ ok: true });
    const client = createIndexClient({ getToken: () => 'tok', fetch: doFetch });
    await client.listSheets('p/1');
    await client.readSheetRange('p1', { sheetId: 's1', a1: 'A1:B3' }, { grant: 'g1', watch: 'd1' });
    await client.readSheetRange('p1', { sheetId: 's1', range: RANGE });
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'GET /api/index/items/p%2F1/sheets',
      'POST /api/index/items/p1/sheet-range',
      'POST /api/index/items/p1/sheet-range',
    ]);
    expect(seen[1]!.body).toEqual({ sheetId: 's1', a1: 'A1:B3', watch: { itemId: 'd1' } });
    expect(seen[1]!.headers.get('X-Index-Grant')).toBe('g1');
    expect(seen[2]!.body).toEqual({ sheetId: 's1', range: RANGE });
    expect(seen[2]!.headers.get('X-Index-Grant')).toBeNull();
  });

  it('tells the index a sheet changed, answering the watchers gone', async () => {
    const { seen, doFetch } = fakeFetch({ gone: ['d2'] });
    const app = createIndexAppClient({
      app: 'liveplanner',
      key: 'k',
      baseUrl: 'https://x/api/index',
      fetch: doFetch,
    });
    await expect(app.sheetChanged('p1', ['s1'], ['d1', 'd2'])).resolves.toEqual(['d2']);
    expect(seen[0]).toMatchObject({
      url: 'https://x/api/index/app/items/p1/sheet-changed',
      method: 'POST',
      body: { sheetIds: ['s1'], watchers: ['d1', 'd2'] },
    });
    expect(seen[0]!.headers.get('X-Index-App')).toBe('liveplanner');
  });
});
