// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createImage, createShape, layOutPages, type Element, type Page } from '@livedesign/design';
import * as pageThumb from '@/lib/page-thumb';
import { usePageThumbnails, type PageThumbTab } from './usePageThumbnails';

vi.mock('@liveworkspace/workbench/hooks/ui/useIconCatalogs', () => ({
  useIconCatalogs: () => true,
}));
// The image store, stood in for: what the hook asked for, and the URLs it has so far.
const images = vi.hoisted(() => ({
  asked: [] as string[][],
  source: (_id: string): string | undefined => undefined,
}));
vi.mock('@/components/canvas/page-image-access', () => ({
  useImageSources: (ids: readonly string[]) => {
    images.asked.push([...ids]);
    return images.source;
  },
}));

// docs/specs/007-editor/pages-mode.md "Contents" "Cost".
afterEach(() => {
  images.asked = [];
  images.source = () => undefined;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const pages: Page[] = ['p1', 'p2', 'p3'].map((id) => ({
  id,
  orientation: 'landscape',
  kind: 'logo',
  size: 'logo',
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
    const draw = vi.spyOn(pageThumb, 'pageThumbFor');
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
    expect(draw.mock.calls[0]![0]).toBe('p2');
    expect(result.current.get('p1')).toBe(before.get('p1'));
    expect(result.current.get('p2')).not.toBe(before.get('p2'));
  });

  it('redraws every page when what they share changes', () => {
    const draw = vi.spyOn(pageThumb, 'pageThumbFor');
    const elements = [boxOn(0, 'a'), boxOn(1, 'b')];
    const { rerender } = renderHook(({ tab }) => usePageThumbnails(tab, ids), {
      initialProps: { tab: tabWith(elements) },
    });
    draw.mockClear();
    rerender({ tab: { ...tabWith(elements), finish: 'sketch' } });
    expect(draw).toHaveBeenCalledTimes(3);
  });

  it('draws only the pages asked for', () => {
    const draw = vi.spyOn(pageThumb, 'pageThumbFor');
    renderHook(() => usePageThumbnails(tabWith([boxOn(0, 'a')]), ['p2']));
    expect(draw.mock.calls.map((c) => c[0])).toEqual(['p2']);
  });

  it('with settleMs, redraws once the tab has rested, not on every change', () => {
    vi.useFakeTimers();
    const draw = vi.spyOn(pageThumb, 'pageThumbFor');
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

  // "Pictures in the thumbnails": an image-only page shows its picture once it arrives.
  it("asks for the drawn pages' pictures and redraws only the page a picture arrives for", () => {
    const draw = vi.spyOn(pageThumb, 'pageThumbFor');
    const image: Element = {
      ...createImage(laid[0]!.rect.x, laid[0]!.rect.y),
      id: 'img',
      imageId: 'g1',
      width: laid[0]!.rect.width,
      height: laid[0]!.rect.height,
    };
    const tab = tabWith([image, boxOn(1, 'b')]);
    const { result, rerender } = renderHook(({ tab }) => usePageThumbnails(tab, ids), {
      initialProps: { tab },
    });
    expect(images.asked.at(-1)).toEqual(['g1']);
    expect(result.current.get('p1')?.markup).not.toContain('blob:g1');
    const before = result.current;
    draw.mockClear();
    images.source = (id) => (id === 'g1' ? 'blob:g1' : undefined);
    rerender({ tab });
    expect(draw.mock.calls.map((c) => c[0])).toEqual(['p1']);
    expect(result.current.get('p1')?.markup).toContain('href="blob:g1"');
    expect(result.current.get('p2')).toBe(before.get('p2'));
  });

  it('asks only for the pictures on the pages asked for', () => {
    const image: Element = {
      ...createImage(laid[0]!.rect.x + 10, laid[0]!.rect.y + 10),
      imageId: 'g1',
    };
    renderHook(() => usePageThumbnails(tabWith([image]), ['p2']));
    expect(images.asked.at(-1)).toEqual([]);
  });
});
