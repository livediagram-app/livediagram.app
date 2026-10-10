import { describe, expect, it } from 'vitest';
import { articlesOf } from './article-flow';
import {
  pageAdded,
  pageBackgroundSet,
  pageDuplicated,
  pageLaidOut,
  pageLockRefuses,
  pageLockSet,
  pageMovedTo,
  pageRemoved,
  pageRenamed,
  pageResized,
  pagesSharing,
  pageTurned,
  type PageEdit,
} from './illustrate-edits';
import {
  illustratePagesOf,
  layOutIllustratePages,
  MAX_ILLUSTRATE_PAGES,
  type IllustratePage,
} from './illustrate-page';
import type { Element, Tab } from './index';

// docs/specs/007-editor/illustrate-pages.md "The page panel", "Page actions"; the same edits the
// agents make (docs/specs/024-agents/illustrate-for-agents.md "change_pages").

const box = (id: string, x: number, y: number): Element =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x,
    y,
    width: 40,
    height: 40,
  }) as Element;

const tabOf = (pages: IllustratePage[], elements: Element[] = [], extra: Partial<Tab> = {}): Tab =>
  ({ id: 't', name: 'T', elements, pages, ...extra }) as Tab;

const ok = <T>(out: PageEdit<T>): T => {
  if (!('tab' in out)) throw new Error(`refused ${out.refused}`);
  return out.tab;
};
const pagesAfter = (out: PageEdit<Tab>) => illustratePagesOf(ok(out));

const a4 = (id: string, extra: Partial<IllustratePage> = {}): IllustratePage => ({
  id,
  orientation: 'portrait',
  ...extra,
});
const article = (id: string, flow: string, extra: Partial<IllustratePage> = {}): IllustratePage =>
  a4(id, { kind: 'article', flow, ...extra });

// A box in the middle of the n-th page of a row.
const onPage = (pages: IllustratePage[], index: number, id: string): Element => {
  const r = layOutIllustratePages(pages)[index]!.rect;
  return box(id, r.x + r.width / 2 - 20, r.y + r.height / 2 - 20);
};

describe('which pages an edit reaches', () => {
  const pages = [a4('p1'), article('a1', 'f'), article('a2', 'f', { locked: true })];

  it('reaches a page alone, or every page of its article', () => {
    expect([...pagesSharing(pages, 'p1')]).toEqual(['p1']);
    expect([...pagesSharing(pages, 'a1')]).toEqual(['a1', 'a2']);
    expect(pagesSharing(pages, 'nope').size).toBe(0);
  });

  it('holds an article-wide edit when any of its pages is locked, a page-only one by its own lock', () => {
    expect(pageLockRefuses(pages, 'a1')).toBe(true);
    expect(pageLockRefuses(pages, 'a1', false)).toBe(false);
    expect(pageLockRefuses(pages, 'p1')).toBe(false);
    expect(pageLockRefuses(pages, 'nope')).toBe(false);
  });
});

describe('locking and naming', () => {
  it('locks and unlocks a page, and is no edit when already so', () => {
    const tab = tabOf([a4('p1')]);
    const locked = ok(pageLockSet(tab, 'p1', true));
    expect(illustratePagesOf(locked)[0]!.locked).toBe(true);
    expect(ok(pageLockSet(locked, 'p1', true))).toBe(locked);
    expect(illustratePagesOf(ok(pageLockSet(locked, 'p1', false)))[0]!.locked).toBeUndefined();
    expect(pageLockSet(tab, 'nope', true)).toEqual({ refused: 'unknown_page' });
  });

  it('names a page trimmed and capped, clears it when empty, refuses a locked page', () => {
    const tab = tabOf([a4('p1')]);
    const named = ok(pageRenamed(tab, 'p1', '  Cover  '));
    expect(illustratePagesOf(named)[0]!.name).toBe('Cover');
    expect(ok(pageRenamed(named, 'p1', 'Cover'))).toBe(named);
    expect(illustratePagesOf(ok(pageRenamed(named, 'p1', '')))[0]!.name).toBeUndefined();
    expect(illustratePagesOf(ok(pageRenamed(tab, 'p1', 'x'.repeat(90))))[0]!.name).toHaveLength(60);
    expect(pageRenamed(tabOf([a4('p1', { locked: true })]), 'p1', 'A')).toEqual({
      refused: 'locked',
    });
    expect(pageRenamed(tab, 'nope', 'A')).toEqual({ refused: 'unknown_page' });
  });
});

describe('turning and resizing', () => {
  it('turns a page and keeps its content on it', () => {
    const pages = [a4('p1')];
    const tab = tabOf(pages, [onPage(pages, 0, 'b')]);
    const turned = ok(pageTurned(tab, 'p1', 'landscape'));
    const rect = layOutIllustratePages(illustratePagesOf(turned))[0]!.rect;
    const b = turned.elements[0] as Element & { x: number; y: number };
    expect(b.x).toBeGreaterThanOrEqual(rect.x);
    expect(b.x).toBeLessThanOrEqual(rect.x + rect.width);
    expect(ok(pageTurned(turned, 'p1', 'landscape'))).toBe(turned);
  });

  it('refuses to turn a slide or a logo, or a locked page', () => {
    const tab = tabOf([a4('s', { kind: 'slide', size: 'slide', orientation: 'landscape' })]);
    expect(pageTurned(tab, 's', 'portrait')).toEqual({ refused: 'no_orientation' });
    expect(pageTurned(tabOf([a4('p', { locked: true })]), 'p', 'landscape')).toEqual({
      refused: 'locked',
    });
    expect(pageTurned(tab, 'nope', 'portrait')).toEqual({ refused: 'unknown_page' });
  });

  it('turns every page of an article together, fitting nothing', () => {
    const tab = tabOf([article('a1', 'f'), article('a2', 'f'), a4('p')]);
    const pages = pagesAfter(pageTurned(tab, 'a2', 'landscape'));
    expect(pages.map((p) => p.orientation)).toEqual(['landscape', 'landscape', 'portrait']);
  });

  it('resizes to a size the kind offers, and refuses any other and Fit to Content', () => {
    const tab = tabOf([a4('p1', { size: 'fit', fit: { width: 300, height: 200 } })]);
    const a3 = pagesAfter(pageResized(tab, 'p1', 'a3'))[0]!;
    expect(a3.size).toBe('a3');
    expect(a3.fit).toBeUndefined();
    const back = pagesAfter(pageResized(tabOf([a4('p1', { size: 'a3' })]), 'p1', 'a4'))[0]!;
    expect(back.size).toBeUndefined();
    expect(ok(pageResized(tabOf([a4('p1')]), 'p1', 'a4')).pages).toEqual([a4('p1')]);
    expect(pageResized(tabOf([a4('p1')]), 'p1', 'fit')).toEqual({ refused: 'size_not_offered' });
    expect(pageResized(tabOf([article('a', 'f')]), 'a', 'slide')).toEqual({
      refused: 'size_not_offered',
    });
    expect(pageResized(tabOf([a4('p1', { locked: true })]), 'p1', 'a3')).toEqual({
      refused: 'locked',
    });
    expect(pageResized(tab, 'nope', 'a3')).toEqual({ refused: 'unknown_page' });
  });
});

describe('painting', () => {
  const solid = { kind: 'solid', color: '#0f172a' } as const;

  it('paints a page, and every page of an article', () => {
    expect(
      pagesAfter(pageBackgroundSet(tabOf([a4('p')]), 'p', { fill: solid }))[0]!.background,
    ).toEqual({
      fill: solid,
    });
    const both = pagesAfter(
      pageBackgroundSet(tabOf([article('a1', 'f'), article('a2', 'f')]), 'a1', { pattern: 'dots' }),
    );
    expect(both.every((p) => p.background?.pattern === 'dots')).toBe(true);
  });

  it('is no edit when the page already wears it, and back to paper clears it', () => {
    const tab = tabOf([a4('p', { background: { fill: solid } })]);
    expect(ok(pageBackgroundSet(tab, 'p', { fill: { ...solid } }))).toBe(tab);
    expect(
      pagesAfter(pageBackgroundSet(tab, 'p', { fill: undefined }))[0]!.background,
    ).toBeUndefined();
  });

  it('refuses a pattern on a logo page, a locked page and an unknown one', () => {
    const logo = tabOf([a4('l', { kind: 'logo', size: 'logo' })]);
    expect(pageBackgroundSet(logo, 'l', { pattern: 'grid' })).toEqual({
      refused: 'pattern_not_offered',
    });
    expect(pagesAfter(pageBackgroundSet(logo, 'l', { fill: solid }))[0]!.background?.fill).toEqual(
      solid,
    );
    expect(pageBackgroundSet(tabOf([a4('p', { locked: true })]), 'p', { fill: solid })).toEqual({
      refused: 'locked',
    });
    expect(pageBackgroundSet(logo, 'nope', { fill: solid })).toEqual({ refused: 'unknown_page' });
  });
});

describe('adding', () => {
  it('adds an infographic page like the last one, A4 after Fit to Content', () => {
    const like = pagesAfter(
      pageAdded(
        tabOf([a4('p', { size: 'a3', orientation: 'landscape' })]),
        'infographic',
        'n',
        'f',
      ),
    );
    expect(like[1]).toEqual({ id: 'n', orientation: 'landscape', size: 'a3' });
    const afterFit = pagesAfter(
      pageAdded(
        tabOf([a4('p', { size: 'fit', fit: { width: 100, height: 100 } })]),
        'infographic',
        'n',
        'f',
      ),
    );
    expect(afterFit[1]).toEqual({ id: 'n', orientation: 'portrait' });
    expect(pagesAfter(pageAdded(tabOf([]), 'infographic', 'n', 'f')).at(-1)).toEqual({
      id: 'n',
      orientation: 'portrait',
    });
  });

  it('adds a slide in the last slide size, and a logo artboard', () => {
    const tab = tabOf([
      a4('s', { kind: 'slide', size: 'slide-classic', orientation: 'landscape' }),
    ]);
    expect(pagesAfter(pageAdded(tab, 'slide', 'n', 'f'))[1]).toMatchObject({
      kind: 'slide',
      size: 'slide-classic',
      orientation: 'landscape',
    });
    expect(pagesAfter(pageAdded(tab, 'logo', 'n', 'f'))[1]).toMatchObject({
      kind: 'logo',
      size: 'logo',
    });
  });

  it('adds an article on the last paper size, else A4 portrait, with its writing', () => {
    const onA3 = ok(
      pageAdded(tabOf([a4('p', { size: 'a3', orientation: 'landscape' })]), 'article', 'n', 'f'),
    );
    expect(illustratePagesOf(onA3)[1]).toMatchObject({
      kind: 'article',
      flow: 'f',
      size: 'a3',
      orientation: 'landscape',
    });
    expect(articlesOf(onA3).f).toBeDefined();
    const afterSlide = ok(
      pageAdded(
        tabOf([a4('s', { kind: 'slide', size: 'slide', orientation: 'landscape' })]),
        'article',
        'n',
        'f',
      ),
    );
    expect(illustratePagesOf(afterSlide)[1]).toMatchObject({ orientation: 'portrait' });
    expect(illustratePagesOf(afterSlide)[1]!.size).toBeUndefined();
  });

  it('refuses past the page limit or on an id already there', () => {
    const full = tabOf(Array.from({ length: MAX_ILLUSTRATE_PAGES }, (_, i) => a4(`p${i}`)));
    expect(pageAdded(full, 'slide', 'n', 'f')).toEqual({ refused: 'page_limit' });
    expect(pageAdded(tabOf([a4('p')]), 'slide', 'p', 'f')).toEqual({ refused: 'page_limit' });
  });
});

describe('duplicating, moving and deleting', () => {
  it('duplicates a page with its content after it', () => {
    const pages = [a4('p1'), a4('p2')];
    const tab = tabOf(pages, [onPage(pages, 0, 'b')]);
    const out = ok(pageDuplicated(tab, 'p1', 'c', 'f'));
    expect(illustratePagesOf(out).map((p) => p.id)).toEqual(['p1', 'c', 'p2']);
    expect(out.elements).toHaveLength(2);
    expect(pageDuplicated(tab, 'nope', 'c', 'f')).toEqual({ refused: 'unknown_page' });
    const full = tabOf(Array.from({ length: MAX_ILLUSTRATE_PAGES }, (_, i) => a4(`p${i}`)));
    expect(pageDuplicated(full, 'p0', 'c', 'f')).toEqual({ refused: 'page_limit' });
  });

  it('duplicates a whole article with its writing', () => {
    const tab = ok(pageAdded(tabOf([a4('p')]), 'article', 'a', 'f'));
    const out = ok(pageDuplicated(tab, 'a', 'unused', 'g'));
    expect(illustratePagesOf(out).filter((p) => p.flow === 'g')).toHaveLength(1);
    expect(Object.keys(articlesOf(out)).sort()).toEqual(['f', 'g']);
    const full = tabOf([
      ...Array.from({ length: MAX_ILLUSTRATE_PAGES - 1 }, (_, i) => a4(`p${i}`)),
      article('a', 'f'),
    ]);
    expect(pageDuplicated(full, 'a', 'x', 'g')).toEqual({ refused: 'page_limit' });
  });

  it('moves a page, clamped to the row, and is no edit in place', () => {
    const tab = tabOf([a4('p1'), a4('p2'), a4('p3')]);
    expect(pagesAfter(pageMovedTo(tab, 'p3', 0)).map((p) => p.id)).toEqual(['p3', 'p1', 'p2']);
    expect(pagesAfter(pageMovedTo(tab, 'p1', 99)).map((p) => p.id)).toEqual(['p2', 'p3', 'p1']);
    expect(ok(pageMovedTo(tab, 'p2', 1))).toBe(tab);
    expect(pageMovedTo(tab, 'nope', 0)).toEqual({ refused: 'unknown_page' });
  });

  it('deletes a page and what is on it, the rest closing the gap', () => {
    const pages = [a4('p1'), a4('p2')];
    const tab = tabOf(pages, [onPage(pages, 0, 'gone'), onPage(pages, 1, 'kept')]);
    const out = ok(pageRemoved(tab, 'p1'));
    expect(illustratePagesOf(out).map((p) => p.id)).toEqual(['p2']);
    expect(out.elements.map((e) => e.id)).toEqual(['kept']);
  });

  it('deletes a whole article, never the last unit, never a locked page', () => {
    const withArticle = ok(pageAdded(tabOf([a4('p')]), 'article', 'a', 'f'));
    const out = ok(pageRemoved(withArticle, 'a'));
    expect(illustratePagesOf(out).map((p) => p.id)).toEqual(['p']);
    expect(articlesOf(out).f).toBeUndefined();
    expect(pageRemoved(tabOf([a4('p')]), 'p')).toEqual({ refused: 'last_page' });
    expect(pageRemoved(tabOf([a4('p', { locked: true }), a4('q')]), 'p')).toEqual({
      refused: 'locked',
    });
    expect(pageRemoved(tabOf([a4('p')]), 'nope')).toEqual({ refused: 'unknown_page' });
  });
});

describe('laying out', () => {
  it('replaces what is on the page with the layout', () => {
    const pages = [a4('p1'), a4('p2')];
    const tab = tabOf(pages, [onPage(pages, 0, 'old'), onPage(pages, 1, 'other')]);
    const out = ok(pageLaidOut(tab, 'p1', [onPage(pages, 0, 'new')]));
    expect(out.elements.map((e) => e.id).sort()).toEqual(['new', 'other']);
    expect(pageLaidOut(tab, 'nope', [])).toEqual({ refused: 'unknown_page' });
    expect(pageLaidOut(tabOf([a4('p', { locked: true })]), 'p', [])).toEqual({ refused: 'locked' });
  });
});
