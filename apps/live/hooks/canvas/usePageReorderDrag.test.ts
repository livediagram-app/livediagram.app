import { describe, expect, it } from 'vitest';
import { layOutIllustratePages } from '@livediagram/document';
import { reorderSlot } from './usePageReorderDrag';

// docs/specs/007-editor/illustrate-pages.md "Getting around the pages": a dragged label's page
// lands after every other page whose centre is left of its own.
const pages = layOutIllustratePages(
  ['a', 'b', 'c'].map((id) => ({ id, orientation: 'portrait' as const })),
);
const centre = (i: number) => pages[i]!.rect.x + pages[i]!.rect.width / 2;

describe('reorderSlot', () => {
  it('finds the slot among the other pages', () => {
    expect(reorderSlot(pages, 'a', centre(0))).toBe(0);
    expect(reorderSlot(pages, 'a', centre(1) + 1)).toBe(1);
    expect(reorderSlot(pages, 'a', centre(2) + 1)).toBe(2);
    expect(reorderSlot(pages, 'c', centre(0) - 1)).toBe(0);
  });
});
