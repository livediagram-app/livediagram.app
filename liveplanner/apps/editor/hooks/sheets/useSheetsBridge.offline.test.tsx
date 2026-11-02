// @vitest-environment jsdom
// docs/specs/007-editor/offline-changes.md "Kept across a reload": sheet changes a reload kept go as soon as the plan
// opens, before any Sheet is drawn, by loading the sheet chunk only when some wait.
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetPlanQueues, planQueue } from '@/lib/offline-queue/plan-queue';

const chunk = vi.hoisted(() => ({ sheetStoreOf: vi.fn() }));
vi.mock('@/components/sheets/sheet-store-client', () => chunk);
const offline = vi.hoisted(() => ({ is: false }));
vi.mock('@/lib/offline/offline-ids', () => ({ isOfflineIdSync: () => offline.is }));

import { useSheetsBridge } from './useSheetsBridge';

const opts = (projectId = 'p1') => ({
  projectId,
  ownerId: 'o1',
  shareCode: null,
  tabScope: null,
  self: null,
  canEdit: true,
  peers: [],
  pushUndo: vi.fn(),
  toast: vi.fn(),
  notify: vi.fn(),
  send: vi.fn(),
  activeTabId: 't1',
  commitElements: vi.fn(),
  placeElement: vi.fn(),
  tickElements: vi.fn(),
  selectElement: vi.fn(),
  sheetRetitled: vi.fn(),
});

const keepOne = (projectId = 'p1') =>
  planQueue(projectId, 'o1').add({
    id: 'w1',
    seq: 1,
    store: 'sheets',
    op: 'write',
    sheetId: 's1',
    write: { kind: 'cells', cells: [] },
    flags: {},
  });

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  forgetPlanQueues();
  offline.is = false;
});

describe('useSheetsBridge, waiting sheet changes', () => {
  it('makes the sheet store when sheet changes wait, handing it the bridge', async () => {
    keepOne();
    const { result } = renderHook(() => useSheetsBridge(opts()));
    await waitFor(() => expect(chunk.sheetStoreOf).toHaveBeenCalledWith(result.current.bridge));
  });

  it('loads nothing when nothing waits, for an Offline Mode project, or before the plan is known', async () => {
    renderHook(() => useSheetsBridge(opts()));
    keepOne('p2');
    offline.is = true;
    renderHook(() => useSheetsBridge(opts('p2')));
    renderHook(() => useSheetsBridge(opts('')));
    await new Promise((r) => setTimeout(r, 10));
    expect(chunk.sheetStoreOf).not.toHaveBeenCalled();
  });

  it('leaves them waiting when the chunk does not load', async () => {
    keepOne();
    chunk.sheetStoreOf.mockImplementationOnce(() => {
      throw new Error('ChunkLoadError');
    });
    renderHook(() => useSheetsBridge(opts()));
    await waitFor(() => expect(chunk.sheetStoreOf).toHaveBeenCalled());
    expect(planQueue('p1', 'o1').count('sheets')).toBe(1);
  });
});
