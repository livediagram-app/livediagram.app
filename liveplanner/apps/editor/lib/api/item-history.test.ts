import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./core', () => ({
  API_BASE: '/api',
  apiFetch: vi.fn(),
  apiHeaders: vi.fn(async () => ({ Authorization: 'Bearer t' })),
  expectOk: vi.fn(async (res: Response) => (await res.json()) as unknown),
}));
vi.mock('../offline/offline-store', () => ({ isOfflineId: vi.fn(async () => false) }));

import { apiFetch } from './core';
import { isOfflineId } from '../offline/offline-store';
import { fetchItemHistory } from './item-history';

// A card's history on the api (docs/specs/026-plan/items.md "History"): one card's route, a tab-scoped session's tab,
// and a This Browser plan, which keeps none and is never asked.
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

  it('asks nothing of a This Browser plan', async () => {
    vi.mocked(isOfflineId).mockResolvedValue(true);
    expect(await fetchItemHistory(SCOPE, 'c1')).toBe('offline');
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
