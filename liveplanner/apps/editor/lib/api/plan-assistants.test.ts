import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./core', () => ({
  API_BASE: '/api',
  apiFetch: vi.fn(),
  apiHeaders: vi.fn(async () => ({ Authorization: 'Bearer t' })),
  expectOk: vi.fn(async (res: Response) => (await res.json()) as unknown),
}));
vi.mock('../offline/offline-store', () => ({ isOfflineId: vi.fn(async () => false) }));
vi.mock('./workbench-confinement', () => ({ workbenchAllows: vi.fn(() => true) }));

import { apiFetch } from './core';
import { isOfflineId } from '../offline/offline-store';
import { apiPlanAssistants } from './plan-assistants';
import { workbenchAllows } from './workbench-confinement';

// The plan's remembered assistants (docs/specs/026-plan/blueprints/item-store.md "The assistant on the card"): read
// for the Assignee picker, never by a tab-scoped link, an offline plan or a workbench frame that may not.
const SCOPE = { ownerId: 'me', projectId: 'p 1', shareCode: null, tabId: null };
const ASSISTANT = { id: 'ai-1', name: 'Claude (Sam)', color: '#000' };

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(apiFetch).mockImplementation(async () => Response.json({ assistants: [ASSISTANT] }));
  vi.mocked(isOfflineId).mockResolvedValue(false);
  vi.mocked(workbenchAllows).mockReturnValue(true);
});

describe('apiPlanAssistants', () => {
  it('reads the list from the plan’s route', async () => {
    expect(await apiPlanAssistants(SCOPE)).toEqual([ASSISTANT]);
    expect(vi.mocked(apiFetch).mock.calls.map((c) => c[0])).toEqual([
      '/api/projects/p%201/items/assistants',
    ]);
  });

  it('asks nothing for a tab-scoped link, an offline plan, or a workbench frame that may not', async () => {
    expect(await apiPlanAssistants({ ...SCOPE, tabId: 't1' })).toEqual([]);
    vi.mocked(isOfflineId).mockResolvedValueOnce(true);
    expect(await apiPlanAssistants(SCOPE)).toEqual([]);
    vi.mocked(workbenchAllows).mockReturnValueOnce(false);
    expect(await apiPlanAssistants(SCOPE)).toEqual([]);
    expect(workbenchAllows).toHaveBeenLastCalledWith('/api/projects/p%201/items/assistants');
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
