// Sheet sources' doors (sheet-source-doors.ts): the index's key alone, a 404 without a handler, and each answer.
import { describe, expect, it, vi } from 'vitest';
import { handleInternalItems, type InternalItemHandlers } from './internal';
import { tellSourceChanged } from './sheet-source-doors';

const OPTIONS = {
  key: 'index-key',
  exportKey: 'media-key',
  driveKey: 'drive-key',
  dataExportKey: 'export-key',
  communityKey: 'community-key',
};

const RANGE = { r1: 'r0001', c1: 'c0001', r2: 'r0009', c2: 'c0004' };
const READ = {
  sheetName: 'Budget',
  tabId: 'tab1',
  range: RANGE,
  a1: 'A1:D9',
  table: { categories: ['Q1'], series: [{ name: 'Sales', values: [3] }] },
};

const call = (path: string, auth: string, body?: unknown) =>
  new Request(`https://app.test/api/internal/items/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });

const send = (req: Request, handlers: Partial<InternalItemHandlers>) =>
  handleInternalItems(req, { ...OPTIONS, handlers: { purge: async () => {}, ...handlers } });

describe('the sheets door', () => {
  it("lists a plan's sheets on the index's key", async () => {
    const sheets = [{ id: 's1', name: 'Budget', tabId: 'tab1', a1: 'A1:D9' }];
    const listSheets = vi.fn(async () => ({ status: 'ok' as const, sheets }));
    const res = await send(call('P1/sheets', 'index-key'), { listSheets });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sheets });
    expect(listSheets).toHaveBeenCalledWith('P1');
  });

  it('answers a plan it does not have as missing', async () => {
    const res = await send(call('P1/sheets', 'index-key'), {
      listSheets: async () => ({ status: 'not_found' }),
    });
    expect(res.status).toBe(404);
  });

  it.each(['media-key', 'drive-key', 'export-key', 'community-key'])(
    'refuses the %s',
    async (key) => {
      const listSheets = vi.fn();
      const res = await send(call('P1/sheets', key), { listSheets });
      expect(res.status).toBe(401);
      expect(listSheets).not.toHaveBeenCalled();
    },
  );

  it('is missing for an app without it, or the wrong method', async () => {
    expect((await send(call('P1/sheets', 'index-key'), {})).status).toBe(404);
    const listSheets = vi.fn();
    expect((await send(call('P1/sheets', 'index-key', {}), { listSheets })).status).toBe(404);
  });
});

describe('the sheet-range door', () => {
  it('reads the asked range, handing on a watcher', async () => {
    const sheetRange = vi.fn(async () => ({ status: 'ok' as const, read: READ }));
    const res = await send(
      call('P1/sheet-range', 'index-key', { sheetId: 's1', a1: 'A1:D9', watcher: 'D1' }),
      { sheetRange },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(READ);
    expect(sheetRange).toHaveBeenCalledWith('P1', { sheetId: 's1', a1: 'A1:D9' }, 'D1');
  });

  it('reads without a watcher when none is named', async () => {
    const sheetRange = vi.fn(async () => ({ status: 'ok' as const, read: READ }));
    await send(call('P1/sheet-range', 'index-key', { sheetId: 's1', range: RANGE, watcher: 7 }), {
      sheetRange,
    });
    expect(sheetRange).toHaveBeenCalledWith('P1', { sheetId: 's1', range: RANGE }, null);
  });

  it.each([
    ['not_found', 404, 'not_found'],
    ['range_gone', 409, 'range_gone'],
    ['invalid_range', 400, 'invalid_range'],
  ] as const)('answers %s as %i', async (status, code, error) => {
    const res = await send(call('P1/sheet-range', 'index-key', { sheetId: 's1', a1: 'A1' }), {
      sheetRange: async () => ({ status }),
    });
    expect(res.status).toBe(code);
    expect(await res.json()).toEqual({ error });
  });

  it('refuses a malformed ask before asking the app', async () => {
    const sheetRange = vi.fn();
    for (const body of [{ sheetId: 's1' }, 'not json']) {
      const res = await send(call('P1/sheet-range', 'index-key', body), { sheetRange });
      expect(res.status).toBe(400);
    }
    expect(sheetRange).not.toHaveBeenCalled();
  });

  it("refuses every key but the index's", async () => {
    const sheetRange = vi.fn();
    const res = await send(call('P1/sheet-range', 'export-key', { sheetId: 's1', a1: 'A1' }), {
      sheetRange,
    });
    expect(res.status).toBe(401);
    expect(sheetRange).not.toHaveBeenCalled();
  });
});

describe('the source-changed door', () => {
  const change = { app: 'liveplanner', itemId: 'P1', sheetIds: ['s1'] };

  it('tells the reader app and answers at once', async () => {
    const sourceChanged = vi.fn(async () => {});
    const res = await send(call('D1/source-changed', 'index-key', change), { sourceChanged });
    expect(res.status).toBe(202);
    expect(sourceChanged).toHaveBeenCalledWith('D1', change);
  });

  it('still confirms when telling fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await send(call('D1/source-changed', 'index-key', change), {
      sourceChanged: async () => {
        throw new Error('room down');
      },
    });
    expect(res.status).toBe(202);
    expect(warn).toHaveBeenCalledWith('[internal] source changed failed', expect.anything());
    warn.mockRestore();
  });

  it('refuses a malformed change', async () => {
    const sourceChanged = vi.fn();
    const res = await send(
      call('D1/source-changed', 'index-key', { ...change, app: 'livediagram' }),
      { sourceChanged },
    );
    expect(res.status).toBe(400);
    expect(sourceChanged).not.toHaveBeenCalled();
  });
});

describe('tellSourceChanged', () => {
  it('binds the room and sends every session the ids', () => {
    const sent: unknown[] = [];
    const bound: string[] = [];
    const change = { app: 'liveplanner' as const, itemId: 'plan_1', sheetIds: ['sheet0001'] };
    tellSourceChanged(
      { bind: (id) => bound.push(id), broadcast: (frame) => sent.push(frame) },
      'doc_1',
      change,
    );
    expect(bound).toEqual(['doc_1']);
    expect(sent).toEqual([{ kind: 'source-changed', ...change }]);
  });
});
