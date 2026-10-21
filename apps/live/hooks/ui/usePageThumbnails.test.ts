// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, layOutPages, type Element, type Page } from '@liveplanner/document';
import * as slideThumb from '@/lib/slide-thumb';
import { usePageThumbnails, type PageThumbTab } from './usePageThumbnails';

vi.mock('@/hooks/ui/useIconCatalogs', () => ({ useIconCatalogs: () => true }));

// docs/specs/007-editor/pages-mode.md "Contents" "Cost".
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const pages: Page[] = ['p1', 'p2', 'p3'].map((id) => ({
  id,
  orientation: 'landscape',
  kind: 'slide',
  size: 'slide',
}));
const laid = layOutPages(pages);
const boxOn = (i: number, id: string, label = id): Element => ({
  ...createShape('square', laid[i]!.rect.x + 50, laid[i]!.rect.y + 50),
  id,
  label,
});
// The tab's layers keep their identity from render to render, as the editor's do.
const layers: PageThumbTab['layers'] = [];
const tabWith = (elements: Element[]): PageThumbTab => ({
  id: 't',
  name: 'T',
  elements,
  pages,
  layers,
});
const ids = ['p1', 'p2', 'p3'];

describe('usePageThumbnails', () => {
  it('redraws only the page an edit touched', () => {
    const draw = vi.spyOn(slideThumb, 'slideThumbFor');
    const a = boxOn(0, 'a');
    const b = boxOn(1, 'b');
    const c = boxOn(2, 'c');
    const { result, rerender } = renderHook(({ tab }) => usePageThumbnails(tab, ids), {
      initialProps: { tab: tabWith([a, b, c]) },
    });
    expect(draw).toHaveBeenCalledTimes(3);
    const before = result.current;
    draw.mockClear();
    rerender({ tab: tabWith([a, boxOn(1, 'b', 'Edited'), c]) });
    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw.mock.calls[0]![0].pageId).toBe('p2');
    expect(result.current.get('p1')).toBe(before.get('p1'));
    expect(result.current.get('p2')).not.toBe(before.get('p2'));
  });

  it('redraws every page when what they share changes', () => {
    const draw = vi.spyOn(slideThumb, 'slideThumbFor');
    const elements = [boxOn(0, 'a'), boxOn(1, 'b')];
    const { rerender } = renderHook(({ tab }) => usePageThumbnails(tab, ids), {
      initialProps: { tab: tabWith(elements) },
    });
    draw.mockClear();
    rerender({ tab: { ...tabWith(elements), finish: 'sketch' } });
    expect(draw).toHaveBeenCalledTimes(3);
  });

  it('draws only the pages asked for', () => {
    const draw = vi.spyOn(slideThumb, 'slideThumbFor');
    renderHook(() => usePageThumbnails(tabWith([boxOn(0, 'a')]), ['p2']));
    expect(draw.mock.calls.map((c) => c[0].pageId)).toEqual(['p2']);
  });

  it('with settleMs, redraws once the tab has rested, not on every change', () => {
    vi.useFakeTimers();
    const draw = vi.spyOn(slideThumb, 'slideThumbFor');
    const { rerender } = renderHook(({ tab }) => usePageThumbnails(tab, ids, 250), {
      initialProps: { tab: tabWith([boxOn(0, 'a')]) },
    });
    draw.mockClear();
    // A drag: a change a frame.
    for (let x = 0; x < 5; x++) {
      rerender({ tab: tabWith([boxOn(0, 'a', `a${x}`)]) });
      act(() => {
        vi.advanceTimersByTime(16);
      });
    }
    expect(draw).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(draw).toHaveBeenCalledTimes(1);
  });
});
