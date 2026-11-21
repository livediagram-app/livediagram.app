import { describe, expect, it } from 'vitest';
import { PAGE_GAP, pageRectsOf } from './page-rects';
import { upgradeStoredTabKeepingRetired } from './upgrade-tab';

describe('pageRectsOf', () => {
  it('lays pages in one row from the anchor, the first centred on it', () => {
    const rects = pageRectsOf({
      pages: [
        { id: 'a', size: 'a4', rowAt: { x: 1000, y: 500 } },
        { id: 'b', size: 'slide' },
        { id: 'c', size: 'fit', fit: { width: 300, height: 200 } },
      ],
    });
    expect(rects).toEqual([
      { pageId: 'a', x: 1000 - 397, y: 500 - 561.5, width: 794, height: 1123 },
      { pageId: 'b', x: 603 + 794 + PAGE_GAP, y: 500 - 540, width: 1920, height: 1080 },
      { pageId: 'c', x: 1493 + 1920 + PAGE_GAP, y: 400, width: 300, height: 200 },
    ]);
  });

  it('answers nothing for a tab with no pages, and skips repeats and malformed pages', () => {
    expect(pageRectsOf({ elements: [] })).toEqual([]);
    expect(pageRectsOf({ pages: [{ id: 'a' }, { id: 'a' }, 7, { size: 'a4' }] })).toHaveLength(1);
  });
});

describe('upgradeStoredTabKeepingRetired', () => {
  it('keeps a Pages tab’s pages and a body it cannot read as it came', () => {
    const pages = [{ id: 'p1', kind: 'slide', size: 'slide' }];
    const out = upgradeStoredTabKeepingRetired({ opensIn: 'pages', pages, elements: [] });
    expect(out.pages).toEqual(pages);
    expect(upgradeStoredTabKeepingRetired({ elements: 'nope' })).toMatchObject({
      elements: 'nope',
    });
  });
});
