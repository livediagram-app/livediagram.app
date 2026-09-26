// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/diagram';

const apiLoadTab = vi.fn();
vi.mock('@/lib/api-client', () => ({ apiLoadTab: (...a: unknown[]) => apiLoadTab(...a) }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { usePerTabLoad } from './usePerTabLoad';

// A failed tab load retries only on Retry (the nonce) or a genuine change.
// It used to refetch on EVERY re-render: resetTabs was a fresh function each
// render and sat in the effect's deps, and a failure drops the tab from the
// loaded-set, so each render started another fetch. The editor re-renders on
// a 30s presence tick, so one tab left on its error overlay refetched (and
// reported `Error.Api.Http403.LoadTab`) around the clock (spec/22, spec/13).

const flush = () => act(async () => {});

function setup() {
  const loadedTabIdsRef = { current: new Set<string>() };
  const setTabLoadErrors = vi.fn();
  const initial = { activeId: 't2', retryNonce: 0 };
  const hook = renderHook(
    ({ activeId, retryNonce }: { activeId: string; retryNonce: number }) =>
      usePerTabLoad({
        hydrated: true,
        diagramId: 'd1',
        activeId,
        selfId: 'me',
        sessionShareCode: null,
        tabsRef: { current: [] as Tab[] },
        loadedTabIdsRef,
        setLoadedTabIds: vi.fn(),
        setTabLoadErrors,
        retryNonce,
        lastSavedTabsRef: { current: [] },
        // A fresh function every render, like the caller used to pass.
        resetTabs: () => {},
      }),
    { initialProps: initial },
  );
  return { ...hook, loadedTabIdsRef, setTabLoadErrors };
}

describe('usePerTabLoad after a failed load', () => {
  beforeEach(() => {
    apiLoadTab.mockReset();
  });

  it('does not refetch when the editor merely re-renders', async () => {
    apiLoadTab.mockRejectedValue(new Error('403'));
    const { rerender, setTabLoadErrors } = setup();
    await flush();
    expect(apiLoadTab).toHaveBeenCalledTimes(1);
    expect(setTabLoadErrors).toHaveBeenCalled();
    for (let i = 0; i < 5; i++) {
      rerender({ activeId: 't2', retryNonce: 0 });
      await flush();
    }
    expect(apiLoadTab).toHaveBeenCalledTimes(1);
  });

  it('does not refetch after a 404 on re-render either', async () => {
    apiLoadTab.mockResolvedValue(null);
    const { rerender } = setup();
    await flush();
    rerender({ activeId: 't2', retryNonce: 0 });
    await flush();
    expect(apiLoadTab).toHaveBeenCalledTimes(1);
  });

  it('refetches when Retry bumps the nonce', async () => {
    apiLoadTab.mockRejectedValue(new Error('500'));
    const { rerender } = setup();
    await flush();
    rerender({ activeId: 't2', retryNonce: 1 });
    await flush();
    expect(apiLoadTab).toHaveBeenCalledTimes(2);
  });

  it('refetches when the user leaves the tab and comes back', async () => {
    apiLoadTab.mockRejectedValue(new Error('500'));
    const { rerender, loadedTabIdsRef } = setup();
    await flush();
    // t1 is already loaded (hydration seeds it), so visiting it fetches nothing.
    loadedTabIdsRef.current.add('t1');
    rerender({ activeId: 't1', retryNonce: 0 });
    await flush();
    expect(apiLoadTab).toHaveBeenCalledTimes(1);
    rerender({ activeId: 't2', retryNonce: 0 });
    await flush();
    expect(apiLoadTab).toHaveBeenCalledTimes(2);
  });

  it('does not restart an in-flight load on re-render', async () => {
    apiLoadTab.mockReturnValue(new Promise(() => {}));
    const { rerender } = setup();
    rerender({ activeId: 't2', retryNonce: 0 });
    rerender({ activeId: 't2', retryNonce: 0 });
    await flush();
    expect(apiLoadTab).toHaveBeenCalledTimes(1);
  });
});

describe('usePerTabLoad search sweep failing on the tab being viewed', () => {
  beforeEach(() => {
    apiLoadTab.mockReset();
  });

  it('raises the error overlay instead of leaving the tab on its loader', async () => {
    // The sweep claims every unloaded tab up front. Switch to one while its
    // fetch is in flight and the visit-time load bails (already claimed); if
    // the sweep's fetch then fails, nothing else would ever surface it.
    let rejectT2: (e: Error) => void = () => {};
    apiLoadTab.mockImplementation((_self: string, _d: string, tabId: string) =>
      tabId === 't2'
        ? new Promise((_, reject) => {
            rejectT2 = reject;
          })
        : Promise.resolve({ id: tabId, name: tabId, elements: [] }),
    );
    const loadedTabIdsRef = { current: new Set<string>(['t1']) };
    let errors = new Set<string>();
    const setTabLoadErrors = vi.fn((u: Set<string> | ((p: Set<string>) => Set<string>)) => {
      errors = typeof u === 'function' ? u(errors) : u;
    });
    const hook = renderHook(
      ({ activeId }: { activeId: string }) =>
        usePerTabLoad({
          hydrated: true,
          diagramId: 'd1',
          activeId,
          selfId: 'me',
          sessionShareCode: null,
          tabsRef: { current: [{ id: 't1' }, { id: 't2' }] as Tab[] },
          loadedTabIdsRef,
          setLoadedTabIds: vi.fn(),
          setTabLoadErrors,
          retryNonce: 0,
          lastSavedTabsRef: { current: [] },
          resetTabs: () => {},
        }),
      { initialProps: { activeId: 't1' } },
    );
    let sweep: Promise<void> = Promise.resolve();
    act(() => {
      sweep = hook.result.current.loadAllTabs();
    });
    hook.rerender({ activeId: 't2' });
    await flush();
    await act(async () => {
      rejectT2(new Error('500'));
      await sweep;
    });
    expect(errors.has('t2')).toBe(true);
  });
});
