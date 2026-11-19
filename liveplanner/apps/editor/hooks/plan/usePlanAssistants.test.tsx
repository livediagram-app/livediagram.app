// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/core', () => ({
  API_BASE: '/api',
  apiFetch: vi.fn(),
  apiHeaders: vi.fn(async () => ({ Authorization: 'Bearer t' })),
  expectOk: vi.fn(async (res: Response) => {
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as unknown;
  }),
}));
vi.mock('@/lib/offline/offline-store', () => ({ isOfflineId: vi.fn(async () => false) }));

import { itemAssistantFor, type Item } from '@liveplanner/items';
import { apiFetch } from '@/lib/api/core';
import { isOfflineId } from '@/lib/offline/offline-store';
import { apiPlanAssistants } from '@/lib/api/plan-assistants';
import { PLAN_ASSISTANTS_REFRESH_MS, usePlanAssistants } from './usePlanAssistants';

// docs/specs/026-plan/items.md "Who it can be handed to"; blueprint item-store.md "The assistant on the card".
const SCOPE = { ownerId: 'me', projectId: 'p 1', shareCode: null, tabId: null };
const THOMAS = { id: 'a1b2c3d4e5f6a1b2c3d4e5f6', name: 'Thomas', color: '#2563eb' };
const SAM = { id: 'b1b2c3d4e5f6a1b2c3d4e5f6', name: 'Sam', color: '#16a34a' };
const CLAUDE = itemAssistantFor(THOMAS, 'Claude')!;
const CURSOR = itemAssistantFor(SAM, 'Cursor')!;
const card = (fields: Item['fields']): Item => ({
  id: 'c1',
  type: 'task',
  key: 1,
  rank: 'k',
  fields,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: THOMAS,
  updatedBy: THOMAS,
});

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(isOfflineId).mockResolvedValue(false);
  vi.mocked(apiFetch).mockImplementation(async () => Response.json({ assistants: [CURSOR] }));
});

describe('apiPlanAssistants', () => {
  it('reads the plan’s route, and none for a tab-scoped link or an offline plan', async () => {
    expect(await apiPlanAssistants(SCOPE)).toEqual([CURSOR]);
    expect(vi.mocked(apiFetch).mock.calls[0]![0]).toBe('/api/projects/p%201/items/assistants');
    expect(await apiPlanAssistants({ ...SCOPE, tabId: 't1' })).toEqual([]);
    vi.mocked(isOfflineId).mockResolvedValue(true);
    expect(await apiPlanAssistants(SCOPE)).toEqual([]);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});

describe('usePlanAssistants', () => {
  it('lists the cards’ assistants with the remembered ones, read on load and at most once a minute', async () => {
    const items = new Map([['c1', card({ assignee: CLAUDE })]]);
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const { result } = renderHook(() => usePlanAssistants(items, SCOPE, true));
    expect(result.current.assistants).toEqual([CLAUDE]);
    await waitFor(() => expect(result.current.assistants).toEqual([CLAUDE, CURSOR]));
    act(() => result.current.refresh());
    expect(apiFetch).toHaveBeenCalledTimes(1);
    now.mockReturnValue(1_000 + PLAN_ASSISTANTS_REFRESH_MS);
    act(() => result.current.refresh());
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    now.mockRestore();
  });

  it('hands on the same list until the assistants change', async () => {
    const { result, rerender } = renderHook(({ items }) => usePlanAssistants(items, SCOPE, true), {
      initialProps: { items: new Map([['c1', card({ assignee: CLAUDE, title: 'a' })]]) },
    });
    await waitFor(() => expect(result.current.assistants).toHaveLength(2));
    const first = result.current.assistants;
    rerender({ items: new Map([['c1', card({ assignee: CLAUDE, title: 'b' })]]) });
    expect(result.current.assistants).toBe(first);
  });

  it('reads nothing while off, and keeps its list when a read fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const off = renderHook(() => usePlanAssistants(new Map(), SCOPE, false));
    off.result.current.refresh();
    renderHook(() => usePlanAssistants(new Map(), null, true));
    expect(apiFetch).not.toHaveBeenCalled();
    expect(off.result.current.assistants).toEqual([]);
    vi.mocked(apiFetch).mockImplementation(async () => new Response(null, { status: 500 }));
    const { result } = renderHook(() => usePlanAssistants(new Map(), SCOPE, true));
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith('[plan] plan.assistants.load-failed', expect.anything()),
    );
    expect(result.current.assistants).toEqual([]);
    warn.mockRestore();
  });
});
