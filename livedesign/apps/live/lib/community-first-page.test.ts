import { describe, expect, it } from 'vitest';
import { createShape, laidOutPagesOf, type Tab } from '@livedesign/design';
import { firstPageLooksEmpty } from './community-first-page';

// docs/specs/025-community/community.md "Something to show": the first page is the Community card's picture.

const page = (id: string, kind = 'logo') => ({ id, orientation: 'portrait', size: 'a4', kind });

function tab(pages: object[] | undefined, elements: Tab['elements'] = []): Tab {
  return pages
    ? ({ id: 't', name: 'T', opensIn: 'pages', pages, elements } as unknown as Tab)
    : { id: 't', name: 'T', elements };
}

describe('firstPageLooksEmpty', () => {
  const pages = [page('a'), page('b')];
  const laid = laidOutPagesOf(tab(pages));
  const on = (i: number, id: string) => ({
    ...createShape('square', laid[i]!.rect.x + 10, laid[i]!.rect.y + 10),
    id,
  });

  it('is empty while nothing sits on the first page, whatever the later pages hold', () => {
    expect(firstPageLooksEmpty(tab(pages))).toBe(true);
    expect(firstPageLooksEmpty(tab(pages, [on(1, 'later')] as Tab['elements']))).toBe(true);
  });

  it('has something to show once an element sits on the first page', () => {
    expect(firstPageLooksEmpty(tab(pages, [on(0, 'first')] as Tab['elements']))).toBe(false);
  });

  it('leaves a photo page to the server, which counts its layers', () => {
    expect(firstPageLooksEmpty(tab([page('p', 'photo')]))).toBe(false);
  });

  it('counts the elements of a tab with no pages', () => {
    expect(firstPageLooksEmpty(tab(undefined))).toBe(true);
    expect(
      firstPageLooksEmpty(tab(undefined, [createShape('square', 0, 0)] as Tab['elements'])),
    ).toBe(false);
  });
});
