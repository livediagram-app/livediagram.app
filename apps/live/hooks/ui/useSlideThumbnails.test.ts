// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, svgBoxed, type Deck, type Tab } from '@livediagram/document';
import { ITEM_TYPES, presetSetup, type Item } from '@livediagram/items';
import { useSlideThumbnails } from './useSlideThumbnails';

// docs/specs/012-collaboration/presentation-mode.md "Board slides": a slide showing a Plan board draws its
// cards in the panel's thumbnail, not empty columns.
vi.mock('@/hooks/ui/useIconCatalogs', () => ({ useIconCatalogs: () => false }));

const item: Item = {
  id: 'item0001',
  type: 'task',
  key: 7,
  rank: 'i',
  fields: { title: 'Ship the board slide', status: 'todo' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'Sam', color: '#2563eb' },
  updatedBy: { id: 'p', name: 'Sam', color: '#2563eb' },
};
const board = { ...createShape('plan-board', 0, 0), id: 'board', planBoard: presetSetup('kanban') };
const box = { ...createShape('square', 2000, 0), id: 'box' };
const tab = { id: 't', name: 'Tab', elements: [board, box] } as unknown as Tab;
const plan = { items: new Map([[item.id, item]]), types: ITEM_TYPES };
const slide = (elementIds: string[]): Deck => ({
  slides: [{ id: 's', tabId: 't', elementIds }],
});

describe('useSlideThumbnails', () => {
  it("draws a board slide's cards from the document's items", () => {
    const { result } = renderHook(() => useSlideThumbnails(slide(['board']), [tab], plan));
    expect(result.current.get('s')?.markup).toContain('Ship the board slide');
  });

  it('draws the board without its cards before the items are handed over', () => {
    const { result } = renderHook(() => useSlideThumbnails(slide(['board']), [tab]));
    expect(result.current.get('s')?.markup).not.toContain('Ship the board slide');
  });

  it('keeps the thumbnails of a deck without a board when the items change', () => {
    const deck = slide(['box']);
    const tabs = [tab];
    const { result, rerender } = renderHook(({ p }) => useSlideThumbnails(deck, tabs, p), {
      initialProps: { p: plan },
    });
    const first = result.current;
    rerender({ p: { ...plan, items: new Map() } });
    expect(result.current).toBe(first);
  });

  // docs/specs/007-editor/illustrate-pages.md "Slides": a page slide is drawn as the page exports,
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
