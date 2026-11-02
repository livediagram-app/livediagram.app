// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveworkspace/index-client';

const state = vi.hoisted(() => ({
  offline: new Set<string>(),
  sync: vi.fn(),
  takeOffline: vi.fn(),
}));
vi.mock('@/lib/offline/offline-store', () => ({
  isOfflineIdSync: (id: string) => state.offline.has(id),
}));
vi.mock('./useOfflineConversion', () => ({
  useOfflineConversions: () => ({ syncToCloud: state.sync, takeOffline: state.takeOffline }),
}));

import { useOfflineItemMenu } from './useOfflineItemMenu';

const item = (over: Partial<Item> = {}): Item =>
  ({
    id: 'doc-1',
    app: 'livehuddle',
    title: 'Plan',
    access: 'edit',
    sharedVia: null,
    trashedAt: null,
    ...over,
  }) as Item;

const labels = (menu: ReturnType<typeof useOfflineItemMenu>, it: Item) =>
  menu!(it).map((v) => v.label);

beforeEach(() => {
  state.offline.clear();
  state.sync.mockClear();
  state.takeOffline.mockClear();
});

describe("The panel's Take Offline and Sync Canvas", () => {
  it('offers nothing before there is a person', () => {
    expect(renderHook(() => useOfflineItemMenu(null)).result.current).toBeUndefined();
  });

  it('offers Take Offline on a canvas in the library, and runs it on that canvas', () => {
    const menu = renderHook(() => useOfflineItemMenu('user_ada')).result.current;
    const [verb] = menu!(item());
    expect(verb!.label).toBe('Take Offline');
    void verb!.onSelect();
    expect(state.takeOffline).toHaveBeenCalledWith({ id: 'doc-1', name: 'Plan' });
  });

  it('offers Sync Canvas on a canvas this browser holds', () => {
    state.offline.add('doc-1');
    const menu = renderHook(() => useOfflineItemMenu('user_ada')).result.current;
    const [verb] = menu!(item());
    expect(verb!.label).toBe('Sync Canvas');
    void verb!.onSelect();
    expect(state.sync).toHaveBeenCalledWith({ id: 'doc-1', name: 'Plan' });
  });

  it('offers neither on a link, a read-only canvas or another app’s item', () => {
    const menu = renderHook(() => useOfflineItemMenu('user_ada')).result.current;
    expect(labels(menu, item({ sharedVia: 'CODE' }))).toEqual([]);
    expect(labels(menu, item({ access: 'view' }))).toEqual([]);
    expect(labels(menu, item({ app: 'liveplanner' }))).toEqual([]);
  });

  it('keeps one host across renders, so the menus never redraw for it', () => {
    const { result, rerender } = renderHook(() => useOfflineItemMenu('user_ada'));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
