import { describe, expect, it } from 'vitest';
import {
  pageAdded,
  pageAddedLike,
  pageBackgroundSet,
  pageDuplicated,
  pageLaidOut,
  pageLockRefuses,
  pageLockSet,
  pageMovedTo,
  pageRemoved,
  pageRenamed,
  pageResized,
  pageTurned,
  type PageEdit,
} from './pages-edits';
import { pagesSharing } from './page-units';
import {
  lastPageOfTabKind,
  layOutPages,
  MAX_PAGES,
  newLogoPage,
  newWireframePage,
  pagesOf,
  tabPageKind,
  type Page,
} from './page';
import type { Element, Tab } from './index';

// docs/specs/007-editor/pages-mode.md "The page panel", "Page actions"; the same edits the
// agents make (docs/specs/024-agents/pages-for-agents.md "change_pages").

const box = (id: string, x: number, y: number): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y,
  width: 40,
  height: 40,
});

const tabOf = (pages: Page[], elements: Element[] = [], extra: Partial<Tab> = {}): Tab => ({
  id: 't',
  name: 'T',
  elements,
  pages,
  ...extra,
});

const ok = <T>(out: PageEdit<T>): T => {
  if (!('tab' in out)) throw new Error(`refused ${out.refused}`);
  return out.tab;
};
const pagesAfter = (out: PageEdit<Tab>) => pagesOf(ok(out));

const a4 = (id: string, extra: Partial<Page> = {}): Page => ({
  id,
  orientation: 'portrait',
  ...extra,
});

// A box in the middle of the n-th page of a row.
const onPage = (pages: Page[], index: number, id: string): Element => {
  const r = layOutPages(pages)[index]!.rect;
  return box(id, r.x + r.width / 2 - 20, r.y + r.height / 2 - 20);
};

describe('which pages an edit reaches', () => {
  const pages = [a4('p1'), a4('p2', { locked: true })];

  it('reaches the page alone', () => {
    expect([...pagesSharing(pages, 'p1')]).toEqual(['p1']);
    expect(pagesSharing(pages, 'nope').size).toBe(0);
  });

  it('is held by the page’s own lock', () => {
    expect(pageLockRefuses(pages, 'p2')).toBe(true);
    expect(pageLockRefuses(pages, 'p1')).toBe(false);
    expect(pageLockRefuses(pages, 'nope')).toBe(false);
  });
});

describe('locking and naming', () => {
  it('locks and unlocks a page, and is no edit when already so', () => {
    const tab = tabOf([a4('p1')]);
    const locked = ok(pageLockSet(tab, 'p1', true));
    expect(pagesOf(locked)[0]!.locked).toBe(true);
    expect(ok(pageLockSet(locked, 'p1', true))).toBe(locked);
    expect(pagesOf(ok(pageLockSet(locked, 'p1', false)))[0]!.locked).toBeUndefined();
    expect(pageLockSet(tab, 'nope', true)).toEqual({ refused: 'unknown_page' });
  });

  it('names a page trimmed and capped, clears it when empty, refuses a locked page', () => {
    const tab = tabOf([a4('p1')]);
    const named = ok(pageRenamed(tab, 'p1', '  Cover  '));
    expect(pagesOf(named)[0]!.name).toBe('Cover');
    expect(ok(pageRenamed(named, 'p1', 'Cover'))).toBe(named);
    expect(pagesOf(ok(pageRenamed(named, 'p1', '')))[0]!.name).toBeUndefined();
    expect(pagesOf(ok(pageRenamed(tab, 'p1', 'x'.repeat(90))))[0]!.name).toHaveLength(60);
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
    const rect = layOutPages(pagesOf(turned))[0]!.rect;
    const b = turned.elements[0] as Element & { x: number; y: number };
    expect(b.x).toBeGreaterThanOrEqual(rect.x);
    expect(b.x).toBeLessThanOrEqual(rect.x + rect.width);
    expect(ok(pageTurned(turned, 'p1', 'landscape'))).toBe(turned);
  });

  it('refuses to turn a logo, or a locked page', () => {
    const tab = tabOf([a4('s', { kind: 'logo', size: 'logo' })]);
    expect(pageTurned(tab, 's', 'landscape')).toEqual({ refused: 'no_orientation' });
    expect(pageTurned(tabOf([a4('p', { locked: true })]), 'p', 'landscape')).toEqual({
      refused: 'locked',
    });
    expect(pageTurned(tab, 'nope', 'portrait')).toEqual({ refused: 'unknown_page' });
  });

  it('resizes to a size the kind offers, and refuses any other and Fit to Content', () => {
    const tab = tabOf([a4('p1', { size: 'fit', fit: { width: 300, height: 200 } })]);
    const back = pagesAfter(pageResized(tab, 'p1', 'a4'))[0]!;
    expect(back.size).toBeUndefined();
    expect(back.fit).toBeUndefined();
    expect(ok(pageResized(tabOf([a4('p1')]), 'p1', 'a4')).pages).toEqual([a4('p1')]);
    expect(pageResized(tabOf([a4('p1')]), 'p1', 'fit')).toEqual({ refused: 'size_not_offered' });
    expect(pageResized(tabOf([a4('p1')]), 'p1', 'logo')).toEqual({
      refused: 'size_not_offered',
    });
    expect(pageResized(tabOf([a4('p1', { locked: true })]), 'p1', 'a4')).toEqual({
      refused: 'locked',
    });
    expect(pageResized(tab, 'nope', 'a4')).toEqual({ refused: 'unknown_page' });
  });
});

describe('painting', () => {
  const solid = { kind: 'solid', color: '#0f172a' } as const;

  it('paints a page', () => {
    expect(
      pagesAfter(pageBackgroundSet(tabOf([a4('p')]), 'p', { fill: solid }))[0]!.background,
    ).toEqual({
      fill: solid,
    });
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
  const logo = (id: string, extra: Partial<Page> = {}): Page => ({ ...newLogoPage(id), ...extra });
  const screen = (id: string, extra: Partial<Page> = {}): Page => ({
    ...newWireframePage(id),
    ...extra,
  });

  it('adds a logo page as the artboard, after the last', () => {
    const out = pagesAfter(pageAdded(tabOf([logo('p')]), 'logo', 'n'));
    expect(out.map((p) => p.id)).toEqual(['p', 'n']);
    expect(out[1]).toMatchObject({ id: 'n', size: 'logo', kind: 'logo' });
  });

  it('carries the last page’s background onto a new page of every kind, a logo without pattern', () => {
    const fill = { kind: 'gradient' as const, from: '#fde68a', to: '#fca5a5', angle: 160 };
    const wireframes = tabOf([screen('p', { background: { fill, pattern: 'dots' } })]);
    expect(pagesOf(ok(pageAdded(wireframes, 'wireframe', 'n')))[1]!.background).toEqual({
      fill,
      pattern: 'dots',
    });
    const logos = tabOf([logo('p', { background: { fill } })]);
    expect(pagesOf(ok(pageAdded(logos, 'logo', 'n')))[1]!.background).toEqual({ fill });
    // The paper carries nothing over.
    expect(pagesAfter(pageAdded(tabOf([logo('p')]), 'logo', 'n'))[1]!.background).toBe(undefined);
  });

  it('refuses past the page limit or on an id already there', () => {
    const full = tabOf(Array.from({ length: MAX_PAGES }, (_, i) => logo(`p${i}`)));
    expect(pageAdded(full, 'logo', 'n')).toEqual({ refused: 'page_limit' });
    expect(pageAdded(tabOf([logo('p')]), 'logo', 'p')).toEqual({ refused: 'page_limit' });
  });

  // docs/specs/007-editor/pages-mode.md "One kind a tab".
  it('adds only pages of the tab’s kind, its first page’s', () => {
    const logos = tabOf([logo('p')]);
    expect(pageAdded(logos, 'wireframe', 'n')).toEqual({ refused: 'kind_not_offered' });
    expect(pageAdded(logos, 'photo', 'n')).toEqual({ refused: 'kind_not_offered' });
    const screens = tabOf([screen('s')]);
    expect(pageAdded(screens, 'logo', 'n')).toEqual({ refused: 'kind_not_offered' });
    // A screen of another device is still a wireframe page.
    expect(pagesAfter(pageAdded(screens, 'wireframe', 'n', 'ipad'))[1]).toMatchObject({
      kind: 'wireframe',
      device: 'ipad',
    });
    // A tab whose first page is blank has no kind yet: nothing is added to it.
    for (const kind of ['logo', 'wireframe', 'photo'] as const)
      expect(pageAdded(tabOf([a4('p')]), kind, 'n')).toEqual({ refused: 'kind_not_offered' });
    // A tab stored mixing kinds takes its first page's.
    const mixed = tabOf([logo('l'), screen('s')]);
    expect(pageAdded(mixed, 'wireframe', 'n')).toEqual({ refused: 'kind_not_offered' });
    expect(pagesAfter(pageAdded(mixed, 'logo', 'n'))[2]).toMatchObject({ kind: 'logo' });
    expect(pageAddedLike(mixed, 's', 'n')).toEqual({ refused: 'kind_not_offered' });
    expect(pagesAfter(pageAddedLike(mixed, 'l', 'n'))[2]).toMatchObject({ kind: 'logo' });
  });

  it('reads the tab’s kind from its first page, and what the + adds another of', () => {
    expect(tabPageKind([logo('l'), screen('s')])).toBe('logo');
    expect(tabPageKind([a4('p'), logo('l')])).toBeNull();
    expect(tabPageKind([])).toBeNull();
    expect(lastPageOfTabKind([logo('a'), logo('b')])?.id).toBe('b');
    expect(lastPageOfTabKind([logo('a'), screen('s')])?.id).toBe('a');
    expect(lastPageOfTabKind([a4('p'), logo('l')])).toBeUndefined();
  });
});

describe('duplicating, moving and deleting', () => {
  it('duplicates a page with its content after it', () => {
    const pages = [a4('p1'), a4('p2')];
    const tab = tabOf(pages, [onPage(pages, 0, 'b')]);
    const out = ok(pageDuplicated(tab, 'p1', 'c'));
    expect(pagesOf(out).map((p) => p.id)).toEqual(['p1', 'c', 'p2']);
    expect(out.elements).toHaveLength(2);
    expect(pageDuplicated(tab, 'nope', 'c')).toEqual({ refused: 'unknown_page' });
    const full = tabOf(Array.from({ length: MAX_PAGES }, (_, i) => a4(`p${i}`)));
    expect(pageDuplicated(full, 'p0', 'c')).toEqual({ refused: 'page_limit' });
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
    expect(pagesOf(out).map((p) => p.id)).toEqual(['p2']);
    expect(out.elements.map((e) => e.id)).toEqual(['kept']);
  });

  it('never deletes the last page, nor a locked one', () => {
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
