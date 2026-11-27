import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./core', () => ({
  API_BASE: '/api',
  apiFetch: vi.fn(),
  apiHeaders: vi.fn(async () => ({ Authorization: 'Bearer t' })),
  expectOk: vi.fn(async (res: Response) => (await res.json()) as unknown),
}));
vi.mock('../offline/offline-store', () => ({ isOfflineId: vi.fn(async () => false) }));

import { apiFetch, expectOk } from './core';
import { isOfflineId } from '../offline/offline-store';
import { fetchItemHistory, recordSessionOutcome } from './item-history';
import { onHistoryWritten } from './history-written';

// A card's history on the api (docs/specs/026-plan/items.md "History"): one card's route, a tab-scoped session's tab,
// and an offline plan, which keeps none and is never asked.
const SCOPE = { ownerId: 'me', projectId: 'p 1', shareCode: null, tabId: null };

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(isOfflineId).mockResolvedValue(false);
});

describe('fetchItemHistory', () => {
  it('reads one card’s history, naming a tab-scoped session’s tab', async () => {
    const entries = [{ at: 1, by: { name: 'Sam', color: '#000' }, changes: [{ kind: 'flagged' }] }];
    vi.mocked(apiFetch).mockImplementation(async () => Response.json({ entries }));
    expect(await fetchItemHistory(SCOPE, 'c/1')).toEqual(entries);
    await fetchItemHistory({ ...SCOPE, tabId: 't 1' }, 'c1');
    expect(vi.mocked(apiFetch).mock.calls.map((c) => c[0])).toEqual([
      '/api/projects/p%201/items/c%2F1/history',
      '/api/projects/p%201/items/c1/history?tabId=t%201',
    ]);
  });

  it('asks nothing of an offline plan', async () => {
    vi.mocked(isOfflineId).mockResolvedValue(true);
    expect(await fetchItemHistory(SCOPE, 'c1')).toBe('offline');
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe('recordSessionOutcome', () => {
  const body = { session: 'refinement', outcome: 'skipped' } as const;

  it('posts the outcome to the card’s session route, naming a tab-scoped session’s tab', async () => {
    vi.mocked(apiFetch).mockImplementation(async () => new Response(null, { status: 204 }));
    await recordSessionOutcome(SCOPE, 'c/1', body);
    await recordSessionOutcome({ ...SCOPE, tabId: 't 1' }, 'c1', body);
    const calls = vi.mocked(apiFetch).mock.calls;
    expect(calls.map((c) => c[0])).toEqual([
      '/api/projects/p%201/items/c%2F1/session',
      '/api/projects/p%201/items/c1/session?tabId=t%201',
    ]);
    expect(calls[0]![1]).toMatchObject({ method: 'POST', body: JSON.stringify(body) });
  });

  it('throws a refusal, and sends nothing for an offline plan', async () => {
    vi.mocked(apiFetch).mockImplementation(async () =>
      Response.json({ error: 'x' }, { status: 403 }),
    );
    vi.mocked(expectOk).mockRejectedValueOnce(new Error('refused'));
    await expect(recordSessionOutcome(SCOPE, 'c1', body)).rejects.toThrow('refused');
    vi.mocked(apiFetch).mockReset();
    vi.mocked(isOfflineId).mockResolvedValue(true);
    await recordSessionOutcome(SCOPE, 'c1', body);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe('onHistoryWritten', () => {
  const body = { session: 'refinement', outcome: 'skipped' } as const;

  it('hears a recorded outcome, never a refused one, and stops when unsubscribed', async () => {
    const heard = vi.fn();
    const stop = onHistoryWritten(heard);
    vi.mocked(apiFetch).mockImplementation(async () => new Response(null, { status: 204 }));
    await recordSessionOutcome(SCOPE, 'c1', body);
    expect(heard).toHaveBeenCalledWith('c1');
    heard.mockClear();
    vi.mocked(apiFetch).mockImplementation(async () =>
      Response.json({ error: 'x' }, { status: 403 }),
    );
    vi.mocked(expectOk).mockRejectedValueOnce(new Error('refused'));
    await expect(recordSessionOutcome(SCOPE, 'c1', body)).rejects.toThrow('refused');
    expect(heard).not.toHaveBeenCalled();
    stop();
    vi.mocked(apiFetch).mockImplementation(async () => new Response(null, { status: 204 }));
    await recordSessionOutcome(SCOPE, 'c1', body);
    expect(heard).not.toHaveBeenCalled();
  });
});
