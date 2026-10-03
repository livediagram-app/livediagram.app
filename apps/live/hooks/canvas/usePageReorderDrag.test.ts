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

describe('reorderSlot with documents', () => {
  const row = layOutIllustratePages([
    { id: 'a', orientation: 'portrait' },
    { id: 'd1', orientation: 'portrait', kind: 'document', flow: 'f' },
    { id: 'd2', orientation: 'portrait', kind: 'document', flow: 'f' },
    { id: 'c', orientation: 'portrait' },
  ]);
  const mid = (id: string) => {
    const r = row.find((p) => p.id === id)!.rect;
    return r.x + r.width / 2;
  };

  it('counts a document as one unit, so no slot falls inside it', () => {
    // Past the first sheet of the document but short of its middle: still before it.
    expect(reorderSlot(row, 'a', mid('d1') + 1)).toBe(0);
    expect(reorderSlot(row, 'a', mid('d2') + 1)).toBe(1);
    expect(reorderSlot(row, 'c', mid('a') - 1)).toBe(0);
  });

  it("moves a document by any of its pages' labels", () => {
    expect(reorderSlot(row, 'd2', mid('c') + 1)).toBe(2);
  });
});
