// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';

const apiLoadTab = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiLoadTabRevisioned: async (...a: unknown[]) => {
    const tab = await apiLoadTab(...a);
    return tab ? { tab, rev: 3 } : null;
  },
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { usePerTabLoad } from './usePerTabLoad';

// A failed tab load retries only on Retry (the nonce) or a genuine change.
// It used to refetch on EVERY re-render: resetTabs was a fresh function each
// render and sat in the effect's deps, and a failure drops the tab from the
// loaded-set, so each render started another fetch. The editor re-renders on
// a 30s presence tick, so one tab left on its error overlay refetched (and
// reported `Error.Api.Http403.LoadTab`) around the clock (docs/specs/017-telemetry/telemetry.md, docs/specs/006-document/per-tab-storage.md).

const flush = () => act(async () => {});

function setup() {
  // Refs and state setters are stable in the editor, so they are here too; resetTabs stays fresh on
  // purpose (the caller used to pass a new one every render).
  const loadedTabIdsRef = { current: new Set<string>() };
  const tabsRef = { current: [] as Tab[] };
  const lastSavedTabsRef = { current: [] as Tab[] };
  const noteChangesetSeen = vi.fn();
  const setLoadedTabIds = vi.fn();
  const setTabLoadErrors = vi.fn();
  const initial = { activeId: 't2', retryNonce: 0 };
  const hook = renderHook(
    ({ activeId, retryNonce }: { activeId: string; retryNonce: number }) =>
      usePerTabLoad({
        hydrated: true,
        documentId: 'd1',
        activeId,
        selfId: 'me',
        sessionShareCode: null,
        sessionTabScope: null,
        tabsRef,
        loadedTabIdsRef,
        setLoadedTabIds,
        setTabLoadErrors,
        retryNonce,
        lastSavedTabsRef,
        // A fresh function every render, like the caller used to pass.
        resetTabs: () => {},
        noteChangesetSeen,
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
          documentId: 'd1',
          activeId,
          selfId: 'me',
          sessionShareCode: null,
          sessionTabScope: null,
          tabsRef: { current: [{ id: 't1' }, { id: 't2' }] as Tab[] },
          loadedTabIdsRef,
          setLoadedTabIds: vi.fn(),
          setTabLoadErrors,
          retryNonce: 0,
          lastSavedTabsRef: { current: [] },
          resetTabs: () => {},
          noteChangesetSeen: vi.fn(),
        }),
      { initialProps: { activeId: 't1' } },
    );
    let sweep: Promise<unknown> = Promise.resolve();
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

// docs/specs/013-workspace/tab-scoped-share-links.md: the search sweep never asks for a tab outside a
// tab-scoped session's scope; the server would refuse it, and the visitor
// has no business asking.
describe('usePerTabLoad search sweep in a tab-scoped session', () => {
  beforeEach(() => {
    apiLoadTab.mockReset();
    apiLoadTab.mockImplementation((_me: string, _d: string, tabId: string) =>
      Promise.resolve({ id: tabId, name: tabId, elements: [] }),
    );
  });

  it('loads the scoped tab only', async () => {
    const hook = renderHook(() =>
      usePerTabLoad({
        hydrated: true,
        documentId: 'd1',
        activeId: 't2',
        selfId: 'me',
        sessionShareCode: 'CODE2345',
        sessionTabScope: 't2',
        tabsRef: { current: [{ id: 't1' }, { id: 't2' }, { id: 't3' }] as Tab[] },
        loadedTabIdsRef: { current: new Set<string>() },
        setLoadedTabIds: vi.fn(),
        setTabLoadErrors: vi.fn(),
        retryNonce: 0,
        lastSavedTabsRef: { current: [] },
        resetTabs: () => {},
        noteChangesetSeen: vi.fn(),
      }),
    );
    await act(async () => {
      await hook.result.current.loadAllTabs();
    });
    const asked = apiLoadTab.mock.calls.map((c) => c[2]);
    expect(new Set(asked)).toEqual(new Set(['t2']));
  });
});

// docs/specs/024-agents/agent-changesets.md "The editor": a tab put in place holds every changeset up
// to the revision it was read at.
describe('usePerTabLoad and changesets', () => {
  beforeEach(() => apiLoadTab.mockReset());

  it('records the revision of a tab it puts in place', async () => {
    apiLoadTab.mockResolvedValue({ id: 't2', name: 't2', elements: [] });
    const noteChangesetSeen = vi.fn();
    renderHook(() =>
      usePerTabLoad({
        hydrated: true,
        documentId: 'd1',
        activeId: 't2',
        selfId: 'me',
        sessionShareCode: null,
        sessionTabScope: null,
        tabsRef: { current: [{ id: 't2', name: 't2', elements: [] }] as Tab[] },
        loadedTabIdsRef: { current: new Set<string>() },
        setLoadedTabIds: vi.fn(),
        setTabLoadErrors: vi.fn(),
        retryNonce: 0,
        lastSavedTabsRef: { current: [] },
        resetTabs: () => {},
        noteChangesetSeen,
      }),
    );
    await flush();
    expect(noteChangesetSeen).toHaveBeenCalledWith('t2', 3);
  });
});
