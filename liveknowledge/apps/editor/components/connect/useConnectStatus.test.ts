// @vitest-environment jsdom

// Connect's checks (docs/specs/030-knowledgebase/blueprints/mcp-connect-ui.md "The checks"): one read on opening,
// then one every 10 seconds while the tab shows, for 5 minutes, stopping once an app arrives.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeAgent } from '@liveknowledge/api-schema';

const api = vi.hoisted(() => ({ apiKnowledgeOverview: vi.fn() }));
vi.mock('@/lib/api/knowledge', () => api);

import { CHECK_EVERY_MS, CHECK_FOR_MS } from '@/lib/knowledge-connect/connect-status';
import { useConnectStatus } from './useConnectStatus';

const WHO = { ownerId: 'me', shareCode: null };
const agent = (id: string, readsThisWeek = 1): KnowledgeAgent => ({
  id,
  name: id,
  readsThisWeek,
  topPages: [],
});
const answer = (agents: KnowledgeAgent[]) => Promise.resolve({ agents });

let visibility: DocumentVisibilityState = 'visible';
beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  api.apiKnowledgeOverview.mockImplementation(() => answer([agent('old')]));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  api.apiKnowledgeOverview.mockReset();
});

const reads = () => api.apiKnowledgeOverview.mock.calls.length;
const start = async (enabled = true) => {
  const hook = renderHook(() => useConnectStatus(WHO, 'd1', enabled));
  await act(async () => {});
  return hook;
};
const wait = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('the checks', () => {
  it('read once on opening, then every 10 seconds, 31 reads at most, then stop', async () => {
    const { result } = await start();
    expect(reads()).toBe(1);
    expect(result.current.status.kind).toBe('waiting');
    expect(result.current.agents?.map((a) => a.id)).toEqual(['old']);
    await wait(CHECK_EVERY_MS);
    expect(reads()).toBe(2);
    await wait(CHECK_FOR_MS);
    expect(reads()).toBe(31);
    expect(result.current.status.kind).toBe('stopped');
    await wait(CHECK_FOR_MS);
    expect(reads()).toBe(31);
  });

  it('read nothing while the tab is hidden, and read at once when it shows again', async () => {
    await start();
    visibility = 'hidden';
    await wait(CHECK_EVERY_MS * 6);
    expect(reads()).toBe(1);
    visibility = 'visible';
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(reads()).toBe(2);
  });

  it('stop once an app arrives, and say which', async () => {
    const { result } = await start();
    api.apiKnowledgeOverview.mockImplementation(() => answer([agent('old'), agent('Claude')]));
    await wait(CHECK_EVERY_MS);
    expect(result.current.status).toEqual({ kind: 'connected', agent: agent('Claude') });
    await wait(CHECK_EVERY_MS * 3);
    expect(reads()).toBe(2);
  });

  it('count one that was there and read again as arrived', async () => {
    const { result } = await start();
    api.apiKnowledgeOverview.mockImplementation(() => answer([agent('old', 4)]));
    await wait(CHECK_EVERY_MS);
    expect(result.current.status.kind).toBe('connected');
  });

  it('start a new window on Check Again, keeping what the view first saw', async () => {
    const { result } = await start();
    await wait(CHECK_FOR_MS);
    expect(result.current.status.kind).toBe('stopped');
    const before = reads();
    act(() => result.current.checkNow());
    await act(async () => {});
    expect(reads()).toBe(before + 1);
    expect(result.current.status.kind).toBe('waiting');
    api.apiKnowledgeOverview.mockImplementation(() => answer([agent('old'), agent('Cursor')]));
    await wait(CHECK_EVERY_MS);
    expect(result.current.status).toMatchObject({ kind: 'connected', agent: { id: 'Cursor' } });
  });

  it('stop on a failed read, say so, and keep what is on show; Try Again reads again', async () => {
    const { result } = await start();
    api.apiKnowledgeOverview.mockImplementation(() => Promise.reject(new Error('offline')));
    await wait(CHECK_EVERY_MS);
    expect(result.current.status.kind).toBe('failed');
    expect(result.current.agents?.map((a) => a.id)).toEqual(['old']);
    await wait(CHECK_EVERY_MS * 3);
    expect(reads()).toBe(2);
    api.apiKnowledgeOverview.mockImplementation(() => answer([agent('old')]));
    act(() => result.current.checkNow());
    await act(async () => {});
    expect(result.current.status.kind).toBe('waiting');
  });

  it('read nothing when there is nothing to check, and nothing after the view closes', async () => {
    await start(false);
    await wait(CHECK_EVERY_MS * 3);
    expect(reads()).toBe(0);
    const { unmount } = await start();
    unmount();
    await wait(CHECK_EVERY_MS * 3);
    expect(reads()).toBe(1);
  });
});
