import { describe, expect, it } from 'vitest';
import {
  INFOGRAPHIC_PAGE_GAP,
  infographicPagesOf,
  layOutInfographicPages,
  pageDimensions,
  pageHasOrientation,
  pageLabel,
  pageMargin,
  withInfographicPages,
  type InfographicPage,
} from './infographic-page';
import {
  elementIdsOnPage,
  pageFillTone,
  pageIsDark,
  pageSurface,
  withDuplicatedPage,
  withPageContentReplaced,
} from './infographic-page-content';
import type { Element } from './index';

// docs/specs/007-editor/infographic-pages.md: a page's size, background and name, and the edits
// that carry its content.
const box = (id: string, cx: number, cy: number) =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x: cx - 10,
    y: cy - 10,
    width: 20,
    height: 20,
  }) as Element;
const centre = (el: Element) =>
  el.type === 'arrow' ? null : { x: el.x + el.width / 2, y: el.y + el.height / 2 };

describe('a page', () => {
  it('keeps its valid optional fields and drops the rest', () => {
    const [page] = infographicPagesOf({
      pages: [
        {
          id: 'p',
          orientation: 'portrait',
          size: 'square',
          background: { fill: { kind: 'solid', color: 'red' }, pattern: 'dots' },
          name: '  Launch  ',
        },
      ],
    });
    expect(page).toEqual({
      id: 'p',
      orientation: 'portrait',
      size: 'square',
      background: { pattern: 'dots' },
      name: 'Launch',
    });
  });

  it('normalises a gradient angle and drops an unknown size', () => {
    const [page] = infographicPagesOf({
      pages: [
        {
          id: 'p',
          orientation: 'landscape',
          size: 'tabloid',
          background: { fill: { kind: 'gradient', from: '#fff', to: '#000000', angle: -20 } },
        },
      ],
    });
    expect(page).toEqual({
      id: 'p',
      orientation: 'landscape',
      background: { fill: { kind: 'gradient', from: '#fff', to: '#000000', angle: 340 } },
    });
  });

  it('measures every size, the long side upright in portrait', () => {
    expect(pageDimensions({ orientation: 'portrait' })).toEqual({ width: 794, height: 1123 });
    expect(pageDimensions({ orientation: 'landscape', size: 'wide' })).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(pageDimensions({ orientation: 'landscape', size: 'square' })).toEqual({
      width: 1080,
      height: 1080,
    });
    expect(pageHasOrientation({ size: 'square' })).toBe(false);
    expect(pageMargin({ orientation: 'portrait' })).toBe(56);
  });

  it('names itself by its name, or its place once there are several', () => {
    expect(pageLabel({ orientation: 'portrait' }, 0, 1)).toBe('A4 · Portrait');
    expect(pageLabel({ orientation: 'landscape' }, 1, 2)).toBe('Page 2 · A4 · Landscape');
    expect(pageLabel({ orientation: 'portrait', size: 'square', name: 'Launch' }, 0, 3)).toBe(
      'Launch · Square',
    );
    expect(pageLabel({ orientation: 'landscape', size: 'wide' }, 0, 1)).toBe('Slide (16:9)');
  });

  it('lays mixed sizes out in a row, each centred on the axis', () => {
    const [a, b] = layOutInfographicPages([
      { id: 'a', orientation: 'portrait' },
      { id: 'b', orientation: 'portrait', size: 'square' },
    ]);
    expect(b!.rect.x).toBe(a!.rect.x + a!.rect.width + INFOGRAPHIC_PAGE_GAP);
    expect(b!.rect.y).toBe(-540);
  });

  it('re-centres its content when its size changes, and moves the pages after it', () => {
    const pages: InfographicPage[] = [
      { id: 'a', orientation: 'portrait' },
      { id: 'b', orientation: 'portrait' },
    ];
    const [, b] = layOutInfographicPages(pages);
    const onB = box('x', b!.rect.x + b!.rect.width / 2, 0);
    const next = withInfographicPages({ elements: [onB], pages }, [
      { id: 'a', orientation: 'portrait', size: 'a3' },
      { id: 'b', orientation: 'portrait' },
    ]);
    const [, b2] = layOutInfographicPages(next.pages);
    expect(centre(next.elements[0]!)).toEqual({ x: b2!.rect.x + b2!.rect.width / 2, y: 0 });
  });
});

describe('page content', () => {
  const pages: InfographicPage[] = [
    { id: 'a', orientation: 'portrait', name: 'Intro' },
    { id: 'b', orientation: 'portrait' },
  ];
  const [, laidB] = layOutInfographicPages(pages);
  const bx = laidB!.rect.x + laidB!.rect.width / 2;
  const onA = [box('a1', 0, 0), box('a2', 100, 100)];
  const arrow = {
    id: 'ar',
    type: 'arrow',
    from: { kind: 'pinned', elementId: 'a1', anchor: 'e' },
    to: { kind: 'pinned', elementId: 'a2', anchor: 'w' },
  } as Element;
  const tab = { elements: [...onA, arrow, box('b1', bx, 0)], pages };

  it('knows what is on a page, arrows by their midpoint', () => {
    const laid = layOutInfographicPages(pages);
    expect([...elementIdsOnPage(tab.elements, laid, 'a')].sort()).toEqual(['a1', 'a2', 'ar']);
    expect([...elementIdsOnPage(tab.elements, laid, 'b')]).toEqual(['b1']);
  });

  it('duplicates a page with its content, pinned arrows re-pinned to the copies', () => {
    let n = 0;
    const next = withDuplicatedPage(tab, 'a', 'page-9', () => `c${++n}`);
    expect(next.pages.map((p) => p.id)).toEqual(['a', 'page-9', 'b']);
    expect(next.pages[1]!.name).toBe('Intro copy');
    const laid = layOutInfographicPages(next.pages);
    const copies = next.elements.filter((el) => el.id.startsWith('c'));
    expect(copies).toHaveLength(3);
    const copiedArrow = copies.find((el) => el.type === 'arrow')!;
    expect(copiedArrow.type === 'arrow' && copiedArrow.from).toMatchObject({ elementId: 'c1' });
    // The copies sit on the copy; the page after moved along with its content.
    expect([...elementIdsOnPage(next.elements, laid, 'page-9')].sort()).toEqual(['c1', 'c2', 'c3']);
    expect([...elementIdsOnPage(next.elements, laid, 'b')]).toEqual(['b1']);
  });

  it('replaces a page’s content, arrows pinned to it going too', () => {
    const next = withPageContentReplaced(tab, 'a', [box('n', 0, 0)]);
    expect(next.elements.map((el) => el.id)).toEqual(['b1', 'n']);
  });
});

describe('page backgrounds', () => {
  it('read a gradient as its stops’ mean, dark or light', () => {
    expect(pageFillTone({ kind: 'gradient', from: '#000000', to: '#ffffff', angle: 0 })).toBe(
      '#808080',
    );
    expect(pageIsDark({ background: { fill: { kind: 'solid', color: '#0f172a' } } })).toBe(true);
    expect(pageSurface({ background: { fill: { kind: 'solid', color: '#fef9c3' } } })).toBe(
      'light',
    );
    expect(pageSurface({})).toBeNull();
  });
});
