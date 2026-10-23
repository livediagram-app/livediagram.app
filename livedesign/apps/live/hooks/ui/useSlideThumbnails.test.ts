// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, svgBoxed, type Deck, type Tab } from '@livedesign/design';
import { useSlideThumbnails } from './useSlideThumbnails';

vi.mock('@/hooks/ui/useIconCatalogs', () => ({ useIconCatalogs: () => false }));

describe('useSlideThumbnails', () => {
  // docs/specs/007-editor/pages-mode.md "Slides": a page slide is drawn as the page exports,
  // so a dark page's uncoloured elements take light ink.
  it("inks a page slide's elements for its page's surface", () => {
    const shape = { ...createShape('square', -40, -40), id: 'ink' };
    const pageTab = (fill?: string) =>
      ({
        id: 'pt',
        name: 'Pages',
        elements: [shape],
        pages: [
          {
            id: 'p1',
            orientation: 'portrait',
            ...(fill ? { background: { fill: { kind: 'solid', color: fill } } } : {}),
          },
        ],
      }) as unknown as Tab;
    const deck: Deck = { slides: [{ id: 's', tabId: 'pt', elementIds: [], pageId: 'p1' }] };
    const dark = renderHook(() => useSlideThumbnails(deck, [pageTab('#101010')])).result.current;
    const light = renderHook(() => useSlideThumbnails(deck, [pageTab()])).result.current;
    expect(dark.get('s')?.markup).toContain(svgBoxed(shape, { surface: 'dark' }));
    expect(light.get('s')?.markup).toContain(svgBoxed(shape, { surface: 'light' }));
    expect(svgBoxed(shape, { surface: 'dark' })).not.toBe(svgBoxed(shape, { surface: 'light' }));
  });
});
