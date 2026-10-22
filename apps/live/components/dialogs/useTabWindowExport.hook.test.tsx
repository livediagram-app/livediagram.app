// @vitest-environment jsdom
// docs/specs/009-elements/tab-window.md "Exports": the export waits for the shown tabs.

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@liveplanner/document';

import { useTabWindowExport } from './useTabWindowExport';

const win = (windowTabId: string): Element => ({
  id: 'w',
  type: 'shape',
  shape: 'tab-window',
  x: 0,
  y: 0,
  width: 640,
  height: 360,
  windowTabId,
});
const box = {
  id: 'b',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
} as Element;

describe('useTabWindowExport', () => {
  it('is ready for a window whose tab was deleted', async () => {
    const slide = { id: 's', name: 'S', elements: [win('gone')] } as Tab;
    const { result } = renderHook(() =>
      useTabWindowExport({
        tab: slide,
        tabs: [slide],
        loadTabs: async () => [],
        active: true,
      }),
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
  });

  // loadTabs settles once each tab has, another caller's fetch included, so the export draws the tab, never its
  // empty placeholder, and never polls.
  it('waits for a shown tab still being fetched elsewhere, never drawing its empty placeholder', async () => {
    const slide = { id: 's', name: 'S', elements: [win('f')] } as Tab;
    let flow = { id: 'f', name: 'Flow', elements: [] } as Tab;
    let settle: (failures: string[]) => void = () => {};
    const loadTabs = vi.fn(() => new Promise<string[]>((r) => (settle = r)));
    const { result, rerender } = renderHook(() =>
      useTabWindowExport({ tab: slide, tabs: [slide, flow], loadTabs, active: true }),
    );
    await act(async () => {});
    expect(result.current.ready).toBe(false);
    // That fetch lands.
    flow = { ...flow, elements: [box] };
    rerender();
    await act(async () => settle([]));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(loadTabs).toHaveBeenCalledTimes(1);
  });

  // "Exports": a Plan tab draws as unavailable, so its content is never fetched for the export.
  it('fetches each tab a window shows, a Plan tab included', async () => {
    const slide = { id: 's', name: 'S', elements: [win('f'), win('b')] } as Tab;
    const flow = { id: 'f', name: 'Flow', elements: [box] } as Tab;
    const board = { id: 'b', name: 'Board', kind: 'board', elements: [] } as unknown as Tab;
    const loadTabs = vi.fn(async (_: readonly string[]) => [] as string[]);
    const { result } = renderHook(() =>
      useTabWindowExport({ tab: slide, tabs: [slide, flow, board], loadTabs, active: true }),
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(loadTabs).toHaveBeenCalledWith(['f', 'b']);
  });
});
