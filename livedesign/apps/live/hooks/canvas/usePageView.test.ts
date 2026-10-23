// @vitest-environment jsdom

// docs/specs/011-theme/light-and-dark.md "A page's own paper": what the canvas draws each element
// on a filled page for.
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createText, layOutPages, type Element, type Page } from '@livedesign/design';
import { usePageView } from './usePageView';

const page: Page = { id: 's', orientation: 'landscape', kind: 'logo', size: 'logo' };
const plain = layOutPages([page]);
const filled = layOutPages([
  { ...page, background: { fill: { kind: 'solid', color: '#ffffff' } } },
]);
const r = filled[0]!.rect;
const words: Element[] = [{ ...createText(r.x + 40, r.y + 40), id: 'w' }];

describe('usePageView', () => {
  it('is nothing off Pages mode, or where no page has a fill', () => {
    expect(renderHook(() => usePageView(words, undefined, 'steel')).result.current).toBeUndefined();
    expect(renderHook(() => usePageView(words, plain, 'steel')).result.current).toBeUndefined();
  });

  it('names the surface of each element on a filled page, with the theme in both halves', () => {
    const view = renderHook(() => usePageView(words, filled, 'steel')).result.current!;
    expect(view.surfaces.get('w')).toBe('light');
    expect(view.maps.light.size).toBeGreaterThan(0);
    expect(view.maps.dark.size).toBeGreaterThan(0);
  });

  it('keeps the same maps between renders, so the canvas projection stays cached', () => {
    const { result, rerender } = renderHook(() => usePageView(words, filled, 'steel'));
    const first = result.current!.maps;
    rerender();
    expect(result.current!.maps).toBe(first);
  });
});
