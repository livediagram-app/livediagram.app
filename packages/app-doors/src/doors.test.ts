import { describe, expect, it, vi } from 'vitest';
import { createAppDoors, DoorError, DOOR_TIMEOUT_MS, type AppDoorsConfig } from './doors';

const CONFIG: AppDoorsConfig = {
  origin: (app) => (app === 'livedesign' ? undefined : `https://${app}.test`),
  key: (app) => (app === 'livedocuments' ? undefined : `${app}-key`),
  caller: 'export',
};

type Answer = { status: number; body?: string | null; headers?: Record<string, string> };

function doorsAnswering(answer: Answer | ((url: string, init?: RequestInit) => Answer)) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const doFetch = vi.fn(async (input: string, init?: RequestInit) => {
    const url = input;
    calls.push({ url, ...(init ? { init } : {}) });
    const a = typeof answer === 'function' ? answer(url, init) : answer;
    return new Response(a.body ?? null, { status: a.status, headers: a.headers ?? {} });
  });
  return { doors: createAppDoors(CONFIG, doFetch), calls };
}

const authOf = (init?: RequestInit) => new Headers(init?.headers).get('Authorization');

describe('exportFile', () => {
  it('answers the envelope and its version, with the caller key', async () => {
    const { doors, calls } = doorsAnswering({
      status: 200,
      body: '{"a":1}',
      headers: { ETag: '"7"' },
    });
    expect(await doors.exportFile('livediagram', 'A B')).toEqual({ body: '{"a":1}', version: 7 });
    expect(calls[0]!.url).toBe(
      'https://livediagram.test/api/internal/items/A%20B/export?format=file',
    );
    expect(authOf(calls[0]!.init)).toBe('Bearer livediagram-key');
  });

  it('is null for a gone item and throws for anything else', async () => {
    expect(
      await doorsAnswering({ status: 404, body: 'x' }).doors.exportFile('liveplanner', 'A'),
    ).toBeNull();
    await expect(
      doorsAnswering({ status: 500, body: 'x' }).doors.exportFile('liveplanner', 'A'),
    ).rejects.toMatchObject({ name: 'DoorError', status: 500 });
    // A 200 with no version is no answer either.
    await expect(
      doorsAnswering({ status: 200, body: '{}' }).doors.exportFile('liveplanner', 'A'),
    ).rejects.toBeInstanceOf(DoorError);
  });

  it('throws for an app whose origin or key is unset', async () => {
    const { doors, calls } = doorsAnswering({ status: 200 });
    await expect(doors.exportFile('livedesign', 'A')).rejects.toThrow(
      'export: livedesign doors not configured',
    );
    await expect(doors.exportFile('livedocuments', 'A')).rejects.toBeInstanceOf(DoorError);
    expect(calls).toHaveLength(0);
  });
});

describe('exportSvg', () => {
  it('asks for one tab, or the first', async () => {
    const { doors, calls } = doorsAnswering({ status: 200, body: '<svg/>' });
    expect(await doors.exportSvg('livediagram', 'A', 't 1')).toBe('<svg/>');
    expect(await doors.exportSvg('livediagram', 'A')).toBe('<svg/>');
    expect(calls.map((c) => c.url)).toEqual([
      'https://livediagram.test/api/internal/items/A/export?format=svg&tab=t%201',
      'https://livediagram.test/api/internal/items/A/export?format=svg',
    ]);
  });

  it('is null for nothing to draw (204) or any failure', async () => {
    expect(await doorsAnswering({ status: 204 }).doors.exportSvg('livediagram', 'A')).toBeNull();
    expect(
      await doorsAnswering({ status: 502, body: 'no' }).doors.exportSvg('livediagram', 'A'),
    ).toBeNull();
  });
});

describe('exportTables and exportComments', () => {
  it('answer the lists', async () => {
    const tables = [{ name: 'Sprint', kind: 'board', csv: 'a\n' }];
    const threads = [
      { id: 'T', tabId: null, tabName: null, on: null, resolved: false, comments: [] },
    ];
    const { doors, calls } = doorsAnswering((url) =>
      url.includes('format=csv')
        ? { status: 200, body: JSON.stringify({ tables }) }
        : { status: 200, body: JSON.stringify({ threads }) },
    );
    expect(await doors.exportTables('liveplanner', 'P')).toEqual(tables);
    expect(await doors.exportComments('liveplanner', 'P')).toEqual(threads);
    expect(calls.map((c) => c.url)).toEqual([
      'https://liveplanner.test/api/internal/items/P/export?format=csv',
      'https://liveplanner.test/api/internal/items/P/export?format=comments',
    ]);
  });

  it('are null for a 404 (an app without tables, a gone item)', async () => {
    const { doors } = doorsAnswering({ status: 404, body: '{"error":"not_found"}' });
    expect(await doors.exportTables('livediagram', 'A')).toBeNull();
    expect(await doors.exportComments('livediagram', 'A')).toBeNull();
  });

  it('throw for another status or a malformed answer', async () => {
    await expect(
      doorsAnswering({ status: 503, body: 'x' }).doors.exportComments('livediagram', 'A'),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      doorsAnswering({ status: 200, body: '{"threads":{}}' }).doors.exportComments(
        'livediagram',
        'A',
      ),
    ).rejects.toThrow('export: malformed threads');
    await expect(
      doorsAnswering({ status: 200, body: 'not json' }).doors.exportTables('liveplanner', 'A'),
    ).rejects.toThrow('export: malformed tables');
  });
});

describe('importFile', () => {
  const input = { owner: 'user_ada', folderId: null, name: 'Logo', file: '{}' };

  it('answers the new id', async () => {
    const { doors, calls } = doorsAnswering({ status: 201, body: '{"id":"N"}' });
    expect(await doors.importFile('livediagram', input)).toEqual({ ok: true, id: 'N' });
    expect(calls[0]!.url).toBe('https://livediagram.test/api/internal/items/import');
    expect(calls[0]!.init?.method).toBe('POST');
    expect(JSON.parse(calls[0]!.init?.body as string)).toEqual(input);
  });

  it('names each refusal', async () => {
    expect(
      await doorsAnswering({ status: 400, body: '{}' }).doors.importFile('livediagram', input),
    ).toEqual({
      ok: false,
      error: 'invalid_file',
    });
    expect(
      await doorsAnswering({ status: 413, body: '{}' }).doors.importFile('livediagram', input),
    ).toEqual({
      ok: false,
      error: 'too_large',
    });
    expect(
      await doorsAnswering({ status: 201, body: 'nope' }).doors.importFile('livediagram', input),
    ).toEqual({
      ok: false,
      error: 'failed',
    });
    expect(await doorsAnswering({ status: 200 }).doors.importFile('livedesign', input)).toEqual({
      ok: false,
      error: 'not_configured',
    });
  });
});

describe('itemUrl', () => {
  it('is the item in its app, or null without an origin', () => {
    const { doors } = doorsAnswering({ status: 200 });
    expect(doors.itemUrl('livediagram', 'A')).toMatch(/^https:\/\/livediagram\.test\/.+A$/);
    expect(doors.itemUrl('livedesign', 'A')).toBeNull();
  });
});

describe('the default fetch and timeout', () => {
  it('uses the global fetch and the default timeout', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('<svg/>', { status: 200 }));
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const doors = createAppDoors(CONFIG);
    expect(await doors.exportSvg('livediagram', 'A')).toBe('<svg/>');
    expect(spy).toHaveBeenCalledOnce();
    expect(timeout).toHaveBeenCalledWith(DOOR_TIMEOUT_MS);
    spy.mockRestore();
    timeout.mockRestore();
  });

  it('takes a timeout of its own', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const doors = createAppDoors(
      { ...CONFIG, timeoutMs: 5 },
      async () => new Response('{"id":"N"}', { status: 201 }),
    );
    await doors.importFile('livediagram', {
      owner: 'user_a',
      folderId: null,
      name: 'A',
      file: '{}',
    });
    expect(timeout).toHaveBeenCalledWith(5);
    timeout.mockRestore();
  });
});

describe('sheet sources', () => {
  const RANGE = { r1: 'r0001', c1: 'c0001', r2: 'r0009', c2: 'c0004' };
  const READ = {
    sheetName: 'Budget',
    tabId: 'tab1',
    range: RANGE,
    a1: 'A1:D9',
    table: { categories: ['Q1'], series: [{ name: 'Sales', values: [3] }] },
  };
  const SHEETS = [{ id: 's1', name: 'Budget', tabId: 'tab1', a1: 'A1:D9' }];

  it("lists a source's sheets on the caller's key", async () => {
    const { doors, calls } = doorsAnswering({
      status: 200,
      body: JSON.stringify({ sheets: SHEETS }),
    });
    expect(await doors.listSheets('liveplanner', 'P 1')).toEqual(SHEETS);
    expect(calls[0]!.url).toBe('https://liveplanner.test/api/internal/items/P%201/sheets');
    expect(authOf(calls[0]!.init)).toBe('Bearer liveplanner-key');
  });

  it('throws the status of a refused or malformed list', async () => {
    await expect(
      doorsAnswering({ status: 404, body: '{}' }).doors.listSheets('liveplanner', 'P'),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      doorsAnswering({
        status: 200,
        body: JSON.stringify({ sheets: [{ id: 's1' }] }),
      }).doors.listSheets('liveplanner', 'P'),
    ).rejects.toMatchObject({ status: 200 });
  });

  it('reads one range, sending a watcher only when there is one', async () => {
    const { doors, calls } = doorsAnswering({ status: 200, body: JSON.stringify(READ) });
    expect(
      await doors.readSheetRange('liveplanner', 'P1', {
        sheetId: 's1',
        a1: 'A1:D9',
        watcher: 'D1',
      }),
    ).toEqual(READ);
    await doors.readSheetRange('liveplanner', 'P1', { sheetId: 's1', range: RANGE, watcher: null });
    expect(calls[0]!.url).toBe('https://liveplanner.test/api/internal/items/P1/sheet-range');
    expect(calls[0]!.init?.method).toBe('POST');
    expect(JSON.parse(calls[0]!.init?.body as string)).toEqual({
      sheetId: 's1',
      a1: 'A1:D9',
      watcher: 'D1',
    });
    expect(JSON.parse(calls[1]!.init?.body as string)).toEqual({ sheetId: 's1', range: RANGE });
  });

  it("throws a read's refusal or a malformed answer", async () => {
    const ask = { sheetId: 's1', a1: 'A1' };
    await expect(
      doorsAnswering({ status: 409, body: '{"error":"range_gone"}' }).doors.readSheetRange(
        'liveplanner',
        'P',
        ask,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      doorsAnswering({ status: 200, body: 'nope' }).doors.readSheetRange('liveplanner', 'P', ask),
    ).rejects.toMatchObject({ status: 200 });
    await expect(
      doorsAnswering({ status: 200, body: '{}' }).doors.readSheetRange('livedesign', 'P', ask),
    ).rejects.toMatchObject({ status: 0 });
  });
});

describe('live data', () => {
  const LISTING = {
    boards: [{ id: 't1', name: 'Roadmap', tabId: 't1' }],
    metrics: [{ id: 'count', label: 'Cards' }],
    filters: { priorities: [], labels: [], people: [], types: [] },
  };
  const READ = {
    sourceName: 'Roadmap',
    tabId: 't1',
    label: 'Cards per column',
    table: { categories: ['To Do'], series: [{ name: 'Cards', values: [2] }] },
  };

  it("lists a plan's data and reads, sending a watcher only when there is one", async () => {
    const { doors, calls } = doorsAnswering((_url, init) => ({
      status: 200,
      body: JSON.stringify(init?.method === 'POST' ? READ : LISTING),
    }));
    expect(await doors.listPlanData('liveplanner', 'P1')).toEqual(LISTING);
    const ask = { kind: 'board', boardId: 't1', by: 'column' } as const;
    expect(await doors.readPlanData('liveplanner', 'P1', { ...ask, watcher: 'D1' })).toEqual(READ);
    await doors.readPlanData('liveplanner', 'P1', {
      kind: 'metric',
      metric: 'count',
      watcher: null,
    });
    expect(calls[0]!.url).toBe('https://liveplanner.test/api/internal/items/P1/plan-data');
    expect(authOf(calls[1]!.init)).toBe('Bearer liveplanner-key');
    expect(JSON.parse(calls[1]!.init?.body as string)).toEqual({ ...ask, watcher: 'D1' });
    expect(JSON.parse(calls[2]!.init?.body as string)).toEqual({ kind: 'metric', metric: 'count' });
  });

  it('throws a refusal or a malformed answer', async () => {
    const ask = { kind: 'metric', metric: 'count' } as const;
    await expect(
      doorsAnswering({ status: 404, body: '{}' }).doors.listPlanData('liveplanner', 'P'),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      doorsAnswering({ status: 200, body: '{}' }).doors.listPlanData('liveplanner', 'P'),
    ).rejects.toMatchObject({ status: 200 });
    await expect(
      doorsAnswering({ status: 400, body: '{}' }).doors.readPlanData('liveplanner', 'P', ask),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      doorsAnswering({ status: 200, body: 'nope' }).doors.readPlanData('liveplanner', 'P', ask),
    ).rejects.toMatchObject({ status: 200 });
  });
});
