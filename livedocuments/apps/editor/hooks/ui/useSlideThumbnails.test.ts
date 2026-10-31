// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createImage, createShape, svgBoxed, type Deck, type Tab } from '@livedocuments/document';
import { useSlideThumbnails } from './useSlideThumbnails';

vi.mock('@liveworkspace/workbench/hooks/ui/useIconCatalogs', () => ({
  useIconCatalogs: () => false,
}));
// The image store, stood in for: what the hook asked for, and the URLs it has.
const images = vi.hoisted(() => ({ asked: [] as string[][] }));
vi.mock('@/components/canvas/page-image-access', () => ({
  useImageSources: (ids: readonly string[]) => {
    images.asked.push([...ids]);
    return (id: string) => `blob:${id}`;
  },
}));

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

  // docs/specs/012-collaboration/presentation-mode.md "The slide list": pictures show in the rows.
  it("draws a slide's image elements and its page's picture with the image store's URLs", () => {
    const image = { ...createImage(0, 0), id: 'img', imageId: 'g1' };
    const tab = {
      id: 't',
      name: 'T',
      elements: [image],
      pages: [
        {
          id: 'p1',
          orientation: 'portrait',
          background: { fill: { kind: 'image', imageId: 'g0' } },
        },
      ],
    } as unknown as Tab;
    const deck: Deck = {
      slides: [
        { id: 'a', tabId: 't', elementIds: ['img'] },
        { id: 'b', tabId: 't', elementIds: [], pageId: 'p1' },
        { id: 'gone', tabId: 'missing', elementIds: [] },
      ],
    };
    const thumbs = renderHook(() => useSlideThumbnails(deck, [tab])).result.current;
    expect(images.asked.at(-1)).toEqual(expect.arrayContaining(['g1', 'g0']));
    expect(thumbs.get('a')?.markup).toContain('href="blob:g1"');
    expect(thumbs.get('b')?.markup).toContain('href="blob:g0"');
  });
});
