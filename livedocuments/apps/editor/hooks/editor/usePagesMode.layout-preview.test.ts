// @vitest-environment jsdom

// docs/specs/007-editor/pages-mode.md "It draws the tile the pointer settles on" (Work Tracker 1502): the view names
// the page whose layout tiles are hovered, and a sweep from tile to tile on that page renders the editor no more.

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedocuments/document';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { usePagesMode } from './usePagesMode';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const tab = {
  id: 't',
  name: 't',
  elements: [],
  pages: [
    { id: 'p1', size: 'a4', orientation: 'portrait' },
    { id: 'p2', size: 'a4', orientation: 'portrait' },
  ],
} as unknown as Tab;

function mount() {
  const viewport = createViewportStore(1);
  const canvas = document.createElement('main');
  let renders = 0;
  const hook = renderHook(() => {
    renders++;
    return usePagesMode({
      activeTab: tab,
      canEdit: true,
      tabLoaded: false,
      commitTabs: vi.fn(),
      canvasMainRef: { current: canvas },
      setViewportZoom: viewport.setZoom,
      setViewportOffset: viewport.setOffset,
      getViewport: viewport.get,
      clearSelection: vi.fn(),
      toastInfo: vi.fn(),
      frameFirstPageRef: { current: null },
      documentId: 'd',
      viewport,
    });
  });
  return { hook, renders: () => renders };
}

describe('usePagesMode layoutPreview', () => {
  it('names the hovered page once, however many of its tiles are crossed, and clears it', () => {
    const { hook, renders } = mount();
    expect(hook.result.current.layoutPreview).toBeNull();
    act(() => hook.result.current.setLayoutPreview({ pageId: 'p1' }));
    expect(hook.result.current.layoutPreview).toEqual({ pageId: 'p1' });
    const after = renders();
    act(() => {
      for (let i = 0; i < 8; i++) hook.result.current.setLayoutPreview({ pageId: 'p1' });
    });
    expect(renders()).toBe(after);
    act(() => hook.result.current.setLayoutPreview({ pageId: 'p2' }));
    expect(hook.result.current.layoutPreview).toEqual({ pageId: 'p2' });
    act(() => hook.result.current.setLayoutPreview(null));
    expect(hook.result.current.layoutPreview).toBeNull();
  });
});
