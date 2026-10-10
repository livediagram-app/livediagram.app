// @vitest-environment jsdom

// Entering Illustrate mode puts a board that does not fit its first page onto a page made around
// it, moving nothing (docs/specs/007-editor/illustrate-pages.md "Into pages"; issue #491).

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Element, EditorMode, Tab } from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { useIllustratePages } from './useIllustratePages';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const board = (): Tab =>
  ({
    id: 't',
    name: 'T',
    elements: [
      { id: 'a', type: 'sticky', x: -1200, y: -100, width: 150, height: 92 },
      { id: 'b', type: 'sticky', x: 1100, y: 400, width: 150, height: 92 },
    ] as unknown as Element[],
  }) as unknown as Tab;

function enter(tab: Tab, opts: { canEdit?: boolean; mode?: EditorMode } = {}) {
  let tabs = [tab];
  const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  const toastInfo = vi.fn();
  renderHook(() =>
    useIllustratePages({
      activeTab: tabs[0]!,
      mode: opts.mode ?? 'illustrate',
      canEdit: opts.canEdit ?? true,
      tabLoaded: true,
      commitTabs,
      canvasMainRef: { current: null },
      setViewportZoom: vi.fn(),
      setViewportOffset: vi.fn(),
      getViewport: () => ({ zoom: 1, offset: { x: 0, y: 0 } }),
      clearSelection: vi.fn(),
      toastInfo,
    }),
  );
  return { tab: () => tabs[0]!, commitTabs, toastInfo };
}

describe('entering Illustrate mode', () => {
  it('puts the board onto a page around it, each element exactly as it was', () => {
    const before = board();
    const h = enter(before);
    expect(h.commitTabs).toHaveBeenCalledTimes(1);
    expect(h.tab().elements).toEqual(before.elements);
    expect(h.tab().pages).toHaveLength(1);
    expect(h.toastInfo).toHaveBeenCalledWith(
      'Put onto a page that fits it. Undo takes the page away.',
    );
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'PageFitToContent');
  });

  it('leaves the tab alone for a viewer, a locked tab, or another mode', () => {
    expect(enter(board(), { canEdit: false }).commitTabs).not.toHaveBeenCalled();
    expect(enter({ ...board(), locked: true }).commitTabs).not.toHaveBeenCalled();
    expect(enter(board(), { mode: 'diagram' }).commitTabs).not.toHaveBeenCalled();
  });

  it('leaves a board that already fits its first page alone', () => {
    const small = {
      ...board(),
      elements: [{ id: 's', type: 'sticky', x: -75, y: -46, width: 150, height: 92 }],
    } as unknown as Tab;
    expect(enter(small).commitTabs).not.toHaveBeenCalled();
  });
});
