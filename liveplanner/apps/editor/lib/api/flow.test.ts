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
import { fetchFlow } from './flow';

// A range's flow on the api (docs/specs/026-plan/plan-views.md "Flow charts"): every type, a tab-scoped session's
// tab, and an offline plan, which keeps none and is never asked.
const SCOPE = { ownerId: 'me', projectId: 'p 1', shareCode: null, tabId: null };
const ANSWER = { fromDay: 1, toDay: 30, counts: [], cards: [] };

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(isOfflineId).mockResolvedValue(false);
});

describe('fetchFlow', () => {
  it('reads a range, naming a tab-scoped session’s tab', async () => {
    vi.mocked(apiFetch).mockImplementation(async () => Response.json(ANSWER));
    expect(await fetchFlow(SCOPE, 30)).toEqual(ANSWER);
    await fetchFlow({ ...SCOPE, tabId: 't 1' }, 90);
    expect(vi.mocked(apiFetch).mock.calls.map((c) => c[0])).toEqual([
      '/api/projects/p%201/flow?days=30',
      '/api/projects/p%201/flow?days=90&tabId=t%201',
    ]);
  });

  it('asks nothing of an offline plan', async () => {
    vi.mocked(isOfflineId).mockResolvedValue(true);
    expect(await fetchFlow(SCOPE, 30)).toBe('offline');
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
