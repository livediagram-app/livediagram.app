import { describe, expect, it } from 'vitest';
import { createIndexClient } from './client';
import {
  BOARD_COUNT_BYS,
  BOARD_COUNT_LABELS,
  isBoardCountBy,
  isMetricId,
  isPlanDataDoorListing,
  isPlanDataDoorRead,
  PLAN_DATA_BOARDS_MAX,
  readBoardCountFilter,
  readPlanDataAsk,
} from './live-data';

const TABLE = { categories: ['To Do', 'Done'], series: [{ name: 'Cards', values: [3, 5] }] };
const LISTING = {
  boards: [{ id: 't1', name: 'Roadmap', tabId: 't1' }],
  metrics: [{ id: 'progress', label: 'Progress' }],
  filters: {
    priorities: [{ id: 'high', label: 'High' }],
    labels: ['bug'],
    people: [{ id: 'u1', name: 'Ada' }],
    types: [{ id: 'task', label: 'Task' }],
  },
};

describe('readPlanDataAsk', () => {
  it('reads a board ask with its filter, and a metric ask', () => {
    expect(
      readPlanDataAsk({
        kind: 'board',
        boardId: 't1',
        by: 'label',
        filter: { priority: 'high' },
        x: 1,
      }),
    ).toEqual({ kind: 'board', boardId: 't1', by: 'label', filter: { priority: 'high' } });
    expect(readPlanDataAsk({ kind: 'board', boardId: 't1', by: 'column', filter: {} })).toEqual({
      kind: 'board',
      boardId: 't1',
      by: 'column',
    });
    expect(readPlanDataAsk({ kind: 'metric', metric: 'top-voted' })).toEqual({
      kind: 'metric',
      metric: 'top-voted',
    });
  });

  it.each([
    null,
    [],
    { kind: 'sheet' },
    { kind: 'board', boardId: 'bad id', by: 'column' },
    { kind: 'board', boardId: 't1', by: 'colour' },
    { kind: 'board', boardId: 't1', by: 'column', filter: [] },
    { kind: 'board', boardId: 't1', by: 'column', filter: { status: 'x' } },
    { kind: 'board', boardId: 't1', by: 'column', filter: { label: '' } },
    { kind: 'board', boardId: 't1', by: 'column', filter: { label: 'x'.repeat(65) } },
    { kind: 'metric', metric: 'Progress!' },
    { kind: 'metric' },
  ])('refuses %j', (raw) => {
    expect(readPlanDataAsk(raw)).toBeNull();
  });

  it('names every count', () => {
    for (const by of BOARD_COUNT_BYS) {
      expect(isBoardCountBy(by)).toBe(true);
      expect(BOARD_COUNT_LABELS[by]).toMatch(/^Cards per /);
    }
    expect(isBoardCountBy('status')).toBe(false);
    expect(isMetricId('count')).toBe(true);
    expect(isMetricId(1)).toBe(false);
    expect(readBoardCountFilter(undefined)).toBeUndefined();
  });
});

describe('the answers', () => {
  it('checks a door read', () => {
    expect(
      isPlanDataDoorRead({ sourceName: 'Roadmap', tabId: 't1', label: 'Cards', table: TABLE }),
    ).toBe(true);
    expect(isPlanDataDoorRead({ sourceName: 'Roadmap', tabId: 't1', label: 'Cards' })).toBe(false);
    expect(
      isPlanDataDoorRead({ sourceName: 'x'.repeat(201), tabId: 't1', label: 'C', table: TABLE }),
    ).toBe(false);
    expect(isPlanDataDoorRead(null)).toBe(false);
  });

  it('checks a door listing and its caps', () => {
    expect(isPlanDataDoorListing(LISTING)).toBe(true);
    expect(isPlanDataDoorListing({ ...LISTING, filters: undefined })).toBe(false);
    expect(isPlanDataDoorListing({ ...LISTING, metrics: [{ id: 'Bad Id', label: 'x' }] })).toBe(
      false,
    );
    const many = Array.from({ length: PLAN_DATA_BOARDS_MAX + 1 }, (_, i) => ({
      id: `t${i}`,
      name: 'B',
      tabId: `t${i}`,
    }));
    expect(isPlanDataDoorListing({ ...LISTING, boards: many })).toBe(false);
    expect(
      isPlanDataDoorListing({ ...LISTING, filters: { ...LISTING.filters, labels: [1] } }),
    ).toBe(false);
  });

  it("lists a plan's data and reads with the reader's grant and watch", async () => {
    const seen: { url: string; method: string; grant: string | null; body: unknown }[] = [];
    const doFetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      seen.push({
        url: String(input),
        method: init.method ?? 'GET',
        grant: new Headers(init.headers).get('X-Index-Grant'),
        body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      });
      return Response.json({ ok: true });
    }) as typeof fetch;
    const client = createIndexClient({ getToken: () => 'tok', fetch: doFetch });
    await client.listPlanData('p1');
    await client.readPlanData(
      'p1',
      { kind: 'metric', metric: 'count' },
      { grant: 'g', watch: 'd1' },
    );
    await client.readPlanData('p1', { kind: 'board', boardId: 't1', by: 'column' });
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'GET /api/index/items/p1/plan-data',
      'POST /api/index/items/p1/plan-data',
      'POST /api/index/items/p1/plan-data',
    ]);
    expect(seen[1]).toMatchObject({
      grant: 'g',
      body: { kind: 'metric', metric: 'count', watch: { itemId: 'd1' } },
    });
    expect(seen[2]).toMatchObject({
      grant: null,
      body: { kind: 'board', boardId: 't1', by: 'column' },
    });
  });
});
