// The sheet store's client (docs/specs/029-sheets/sheet-store.md): a cloud document's calls go to the api with the
// owner id and share code, a tab-scoped session names its tab on every call, named sheets are read 50 a call, and a
// refusal maps to an ApiError with its code. An offline document never reaches the network.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SheetJson } from '@livediagram/sheets';
import { __setOfflineBackend, offlinePutRecord } from '../offline/offline-store';
import { memBackend, testRecord } from '../offline/offline-test-utils';
import { ApiError, API_BASE } from './core';
import {
  createSheet,
  deleteSheet,
  fetchAllSheets,
  fetchSheets,
  sheetAsCreate,
  writeSheet,
  type SheetsScope,
} from './sheets';

const ME = { id: 'me', name: 'Me', color: '#2563eb' };
const sheet = (id: string, tabId = 't1'): SheetJson => ({
  id,
  tabId,
  title: id,
  layout: { rows: ['aaaa'], cols: ['bbbb'] },
  cells: [],
  rev: 0,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: ME,
});

type Call = { url: string; init: RequestInit };
let calls: Call[];
let answers: (() => Response)[];

function respond(...rs: (() => Response)[]) {
  answers.push(...rs);
}

beforeEach(() => {
  __setOfflineBackend(memBackend());
  calls = [];
  answers = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url: String(url), init });
      const next = answers.shift();
      return next ? next() : Response.json({ sheets: [] });
    }),
  );
});
afterEach(() => {
  __setOfflineBackend(null);
  vi.unstubAllGlobals();
});

const cloud: SheetsScope = {
  ownerId: 'owner-1',
  documentId: 'doc 1',
  shareCode: null,
  tabId: null,
};
const shared: SheetsScope = { ...cloud, shareCode: 'share-9', tabId: 'tab-x' };
const header = (c: Call, name: string) => new Headers(c.init.headers).get(name);
const base = `${API_BASE}/documents/doc%201/sheets`;

describe('fetchSheets on a cloud document', () => {
  it("reads a tab's sheets with the owner id", async () => {
    respond(() => Response.json({ sheets: [sheet('sheetAAAA')] }));
    const out = await fetchSheets(cloud, { tabId: 't1' });
    expect(out.map((s) => s.id)).toEqual(['sheetAAAA']);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`${base}?tabId=t1`);
    expect(calls[0]!.init.method ?? 'GET').toBe('GET');
    expect(header(calls[0]!, 'X-Owner-Id')).toBe('owner-1');
    expect(header(calls[0]!, 'X-Share-Code')).toBeNull();
  });

  it('names the link tab, not the asked one, on a tab-scoped session, with the share code', async () => {
    await fetchSheets(shared, { tabId: 't1' });
    expect(calls[0]!.url).toBe(`${base}?tabId=tab-x`);
    expect(header(calls[0]!, 'X-Share-Code')).toBe('share-9');
  });

  it('reads named sheets 50 a call', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `sheet${String(i).padStart(4, '0')}`);
    respond(
      () => Response.json({ sheets: [sheet('one000001')] }),
      () => Response.json({ sheets: [sheet('two000001')] }),
      () => Response.json({ sheets: [sheet('thr000001')] }),
    );
    const out = await fetchSheets(shared, { ids });
    expect(out.map((s) => s.id)).toEqual(['one000001', 'two000001', 'thr000001']);
    expect(calls).toHaveLength(3);
    const asked = calls.map((c) => new URL(c.url, 'http://x').searchParams);
    expect(asked.map((q) => q.get('ids')!.split(',').length)).toEqual([50, 50, 20]);
    expect(asked.every((q) => q.get('tabId') === 'tab-x')).toBe(true);
    expect(asked[2]!.get('ids')!.split(',')[0]).toBe('sheet0100');
  });

  it('makes no call for no ids', async () => {
    expect(await fetchSheets(cloud, { ids: [] })).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('throws an ApiError with the code on a refusal', async () => {
    respond(() => Response.json({ error: 'forbidden' }, { status: 403 }));
    const err = await fetchSheets(cloud, { tabId: 't1' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: 'forbidden', action: 'sheets' });
  });
});

describe('fetchAllSheets on a cloud document', () => {
  it('reads every sheet of the document', async () => {
    respond(() => Response.json({ sheets: [sheet('sheetAAAA'), sheet('sheetBBBB', 't2')] }));
    expect((await fetchAllSheets(cloud)).map((s) => s.id)).toEqual(['sheetAAAA', 'sheetBBBB']);
    expect(calls[0]!.url).toBe(base);
  });

  it('keeps a tab-scoped session to its tab', async () => {
    await fetchAllSheets(shared);
    expect(calls[0]!.url).toBe(`${base}?tabId=tab-x`);
  });
});

describe('writing on a cloud document', () => {
  it('creates a sheet with a JSON body', async () => {
    respond(() => Response.json({ sheet: sheet('sheetAAAA') }, { status: 201 }));
    const create = { id: 'sheetAAAA', tabId: 't1', title: 'Sheet 1' };
    expect((await createSheet(shared, create, ME)).id).toBe('sheetAAAA');
    const c = calls[0]!;
    expect(c.url).toBe(`${base}?tabId=tab-x`);
    expect(c.init.method).toBe('POST');
    expect(header(c, 'Content-Type')).toBe('application/json');
    expect(header(c, 'X-Share-Code')).toBe('share-9');
    expect(JSON.parse(String(c.init.body))).toEqual(create);
  });

  it('maps a refused create to its code', async () => {
    respond(() => Response.json({ error: 'sheet_title_taken' }, { status: 409 }));
    await expect(createSheet(cloud, { tabId: 't1', title: 'X' }, ME)).rejects.toMatchObject({
      status: 409,
      code: 'sheet_title_taken',
      action: 'sheet create',
    });
  });

  it('writes to the sheet, its id encoded', async () => {
    const answer = { applied: { kind: 'title', title: 'B' }, rev: 2, cells: [] };
    respond(() => Response.json(answer));
    const req = { write: { kind: 'title' as const, title: 'B' }, wid: 'w1' };
    expect(await writeSheet(cloud, 'sheet/1', req, ME)).toEqual(answer);
    const c = calls[0]!;
    expect(c.url).toBe(`${base}/sheet%2F1/writes`);
    expect(c.init.method).toBe('POST');
    expect(JSON.parse(String(c.init.body))).toEqual(req);
  });

  it('maps a refused write to its code', async () => {
    respond(() => Response.json({ error: 'sheet_full' }, { status: 413 }));
    await expect(
      writeSheet(cloud, 'sheetAAAA', { write: { kind: 'title', title: 'B' } }, ME),
    ).rejects.toMatchObject({ status: 413, code: 'sheet_full', action: 'sheet write' });
  });

  it('deletes a sheet', async () => {
    respond(() => new Response(null, { status: 204 }));
    await deleteSheet(shared, 'sheetAAAA');
    const c = calls[0]!;
    expect(c.url).toBe(`${base}/sheetAAAA?tabId=tab-x`);
    expect(c.init.method).toBe('DELETE');
    expect(header(c, 'X-Owner-Id')).toBe('owner-1');
  });

  it('deletes a sheet with its element once nothing references it', async () => {
    respond(() => new Response(null, { status: 204 }));
    await deleteSheet(shared, 'sheetAAAA', { whenUnreferenced: true });
    expect(calls[0]!.url).toBe(`${base}/sheetAAAA?tabId=tab-x&whenUnreferenced=true`);
  });

  it('maps a refused delete to its code', async () => {
    respond(() => Response.json({ error: 'sheet_not_found' }, { status: 404 }));
    await expect(deleteSheet(cloud, 'sheetAAAA')).rejects.toMatchObject({
      status: 404,
      code: 'sheet_not_found',
      action: 'sheet delete',
    });
  });
});

describe('sheetAsCreate', () => {
  it('keeps the id, tab, title, layout and cells, and nothing else', () => {
    const s = { ...sheet('sheetAAAA'), cells: [{ r: 'aaaa', c: 'bbbb', i: { n: 1 } }], rev: 7 };
    expect(sheetAsCreate(s)).toEqual({
      id: 'sheetAAAA',
      tabId: 't1',
      title: 'sheetAAAA',
      layout: s.layout,
      cells: s.cells,
    });
  });
});

describe('an offline document', () => {
  const offline: SheetsScope = { ownerId: 'o', documentId: 'd1', shareCode: null, tabId: null };

  it('goes to the local store for every call, never the network', async () => {
    await offlinePutRecord(testRecord());
    const made = await createSheet(
      offline,
      {
        id: 'sheetAAAA',
        tabId: 't1',
        title: 'Sheet 1',
        layout: { rows: ['aaaa'], cols: ['bbbb'] },
      },
      ME,
    );
    expect(made).toMatchObject({ id: 'sheetAAAA', rev: 0 });
    const wrote = await writeSheet(
      offline,
      'sheetAAAA',
      { write: { kind: 'cells', cells: [{ r: 'aaaa', c: 'bbbb', i: { n: 5 } }] } },
      ME,
    );
    expect(wrote.rev).toBe(1);
    expect((await fetchSheets(offline, { tabId: 't1' })).map((s) => s.id)).toEqual(['sheetAAAA']);
    expect((await fetchSheets(offline, { ids: ['sheetAAAA'] }))[0]!.cells).toHaveLength(1);
    expect(await fetchAllSheets(offline)).toHaveLength(1);
    await deleteSheet(offline, 'sheetAAAA');
    expect(await fetchAllSheets(offline)).toEqual([]);
    expect(calls).toEqual([]);
  });
});
