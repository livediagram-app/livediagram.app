// @vitest-environment jsdom
// docs/specs/009-elements/tab-window.md "Exports": the export waits for the shown tabs and their photos.

import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@livediagram/document';

const loadTabImages = vi.fn(async () => new Map());
vi.mock('@/lib/export-tab', async (real) => ({
  ...(await real<typeof import('@/lib/export-tab')>()),
  loadTabImages: (...a: unknown[]) => loadTabImages(...(a as [])),
}));

import { useTabWindowExport } from './useTabWindowExport';

const win = (windowTabId: string): Element =>
  ({
    id: 'w',
    type: 'shape',
    shape: 'tab-window',
    x: 0,
    y: 0,
    width: 640,
    height: 360,
    windowTabId,
  }) as Element;
const box = {
  id: 'b',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
} as Element;
const ctx = { ownerId: 'o', documentId: 'd', shareCode: null };

describe('useTabWindowExport', () => {
  it('is ready for a window whose tab was deleted, photos and all', async () => {
    const slide = { id: 's', name: 'S', elements: [win('gone')] } as Tab;
    const { result } = renderHook(() =>
      useTabWindowExport({
        tab: slide,
        tabs: [slide],
        loadTabs: async () => [],
        imageContext: ctx,
        active: true,
      }),
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
  });

  it('fetches a shown tab’s photos once, not again on every edit to another tab', async () => {
    loadTabImages.mockClear();
    const slide = { id: 's', name: 'S', elements: [win('f')] } as Tab;
    const flow = { id: 'f', name: 'Flow', elements: [box] } as Tab;
    let tabs: Tab[] = [slide, flow, { id: 'x', name: 'X', elements: [] } as Tab];
    const { result, rerender } = renderHook(() =>
      useTabWindowExport({
        tab: slide,
        tabs,
        loadTabs: async () => [],
        imageContext: ctx,
        active: true,
      }),
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    // A collaborator edits tab X: new tab objects, no new photos.
    tabs = tabs.map((t) => (t.id === 'x' ? { ...t, name: 'X2' } : { ...t }));
    rerender();
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(loadTabImages).toHaveBeenCalledTimes(1);
  });
});
