import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';
import { MAX_KNOWLEDGEBASE_PAGES, MAX_PAGE_DEPTH, withPageMoved } from '@liveknowledge/document';
import {
  dropMove,
  dropZoneOf,
  pageTreeClearancePx,
  treeKeyAction,
  visiblePageRows,
  PAGE_TREE_RAIL_WIDTH,
  PAGE_TREE_WIDTH,
  type TreeTab,
} from './page-tree-view';

// docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page tree", as the sidebar draws it.

const tab = (id: string, parent?: string): TreeTab => ({ id, name: id.toUpperCase(), parent });
// a > (b > d, c), e
const TABS = [tab('a'), tab('b', 'a'), tab('d', 'b'), tab('c', 'a'), tab('e')];
const NONE: ReadonlySet<string> = new Set();
const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe('visiblePageRows', () => {
  it('lists every page in tree order, a level deeper under its parent, open until closed', () => {
    const rows = visiblePageRows(TABS, NONE, null);
    expect(rows.map((r) => [r.id, r.level, r.parent, r.open])).toEqual([
      ['a', 1, undefined, true],
      ['b', 2, 'a', true],
      ['d', 3, 'b', false],
      ['c', 2, 'a', false],
      ['e', 1, undefined, false],
    ]);
    // Where each sits among its siblings, for aria-posinset and aria-setsize.
    expect(rows.map((r) => `${r.position}/${r.siblings}`)).toEqual([
      '1/2',
      '1/2',
      '1/1',
      '2/2',
      '2/2',
    ]);
  });

  it('folds a closed page’s subpages away, at every level under it', () => {
    expect(ids(visiblePageRows(TABS, new Set(['a']), null))).toEqual(['a', 'e']);
    expect(ids(visiblePageRows(TABS, new Set(['b']), null))).toEqual(['a', 'b', 'c', 'e']);
  });

  it('always opens the current page’s ancestors: opening a page by its link shows where it is', () => {
    const rows = visiblePageRows(TABS, new Set(['a', 'b']), 'd');
    expect(ids(rows)).toEqual(['a', 'b', 'd', 'c', 'e']);
    // The current page itself stays as the person left it.
    expect(ids(visiblePageRows(TABS, new Set(['a']), 'a'))).toEqual(['a', 'e']);
  });

  it('names a locked page and a page with no name as they are', () => {
    const rows = visiblePageRows([{ id: 'x', name: '', locked: true }], NONE, null);
    expect(rows[0]).toMatchObject({ name: '', locked: true, subpages: 0, open: false });
  });

  it('reads a full knowledgebase (500 pages, 8 levels) within budget', () => {
    const full: TreeTab[] = Array.from({ length: MAX_KNOWLEDGEBASE_PAGES }, (_, i) =>
      i % MAX_PAGE_DEPTH === 0 ? tab(`t${i}`) : tab(`t${i}`, `t${i - 1}`),
    );
    const start = cpuNowMs();
    const rows = visiblePageRows(full, NONE, `t${MAX_KNOWLEDGEBASE_PAGES - 1}`);
    expect(cpuNowMs() - start).toBeLessThan(cpuBudgetMs(50));
    expect(rows).toHaveLength(MAX_KNOWLEDGEBASE_PAGES);
  });
});

describe('visiblePageRows under a label filter (page-surface.md "The label filter")', () => {
  it('keeps the matches and the pages above them, open whatever is closed, the rest away', () => {
    // d matches under b under a; e matches at the top. a and b are closed.
    const rows = visiblePageRows(TABS, new Set(['a', 'b']), null, new Set(['d', 'e']));
    expect(rows.map((r) => [r.id, r.open, r.subpages, r.context])).toEqual([
      ['a', true, 1, true],
      ['b', true, 1, true],
      ['d', false, 0, false],
      ['e', false, 0, false],
    ]);
    expect(rows.map((r) => `${r.position}/${r.siblings}`)).toEqual(['1/2', '1/1', '1/1', '2/2']);
  });

  it('counts the matches under a match, and shows none for no match', () => {
    const rows = visiblePageRows(TABS, NONE, null, new Set(['a', 'c', 'd']));
    expect(rows.map((r) => [r.id, r.subpages, r.context])).toEqual([
      ['a', 2, false],
      ['b', 1, true],
      ['d', 0, false],
      ['c', 0, false],
    ]);
    expect(visiblePageRows(TABS, NONE, 'd', new Set())).toEqual([]);
    expect(visiblePageRows(TABS, NONE, null).every((r) => !r.context)).toBe(true);
  });

  it('filters a full knowledgebase (500 pages, 8 levels) within budget', () => {
    const full: TreeTab[] = Array.from({ length: MAX_KNOWLEDGEBASE_PAGES }, (_, i) =>
      i % MAX_PAGE_DEPTH === 0 ? tab(`t${i}`) : tab(`t${i}`, `t${i - 1}`),
    );
    // The last page of every chain matches: each keeps its whole chain above it.
    const last = (i: number) => i % MAX_PAGE_DEPTH === MAX_PAGE_DEPTH - 1 || i === full.length - 1;
    const only = new Set(full.filter((_, i) => last(i)).map((t) => t.id));
    const start = cpuNowMs();
    const rows = visiblePageRows(full, NONE, null, only);
    expect(cpuNowMs() - start).toBeLessThan(cpuBudgetMs(50));
    expect(rows).toHaveLength(MAX_KNOWLEDGEBASE_PAGES);
    expect(rows.filter((r) => !r.context)).toHaveLength(only.size);
  });
});

describe('treeKeyAction', () => {
  const rows = visiblePageRows(TABS, new Set(['b']), null); // a, b (closed), c, e
  const key = (from: string, k: string, shift = false) => treeKeyAction(rows, from, k, shift);

  it('moves through the rows on screen with Up, Down, Home and End', () => {
    expect(key('a', 'ArrowDown')).toEqual({ kind: 'focus', id: 'b' });
    expect(key('b', 'ArrowDown')).toEqual({ kind: 'focus', id: 'c' });
    expect(key('c', 'ArrowUp')).toEqual({ kind: 'focus', id: 'b' });
    expect(key('a', 'ArrowUp')).toBeNull();
    expect(key('e', 'ArrowDown')).toBeNull();
    expect(key('c', 'Home')).toEqual({ kind: 'focus', id: 'a' });
    expect(key('a', 'End')).toEqual({ kind: 'focus', id: 'e' });
  });

  it('opens a closed page with Right, and enters an open one', () => {
    expect(key('b', 'ArrowRight')).toEqual({ kind: 'open', id: 'b' });
    expect(key('a', 'ArrowRight')).toEqual({ kind: 'focus', id: 'b' });
    expect(key('e', 'ArrowRight')).toBeNull();
  });

  it('closes an open page with Left, and goes to the parent from a closed one', () => {
    expect(key('a', 'ArrowLeft')).toEqual({ kind: 'close', id: 'a' });
    expect(key('b', 'ArrowLeft')).toEqual({ kind: 'focus', id: 'a' });
    expect(key('c', 'ArrowLeft')).toEqual({ kind: 'focus', id: 'a' });
    expect(key('e', 'ArrowLeft')).toBeNull();
  });

  it('opens the page with Enter, renames with F2, and opens its menu with the menu key', () => {
    expect(key('c', 'Enter')).toEqual({ kind: 'select', id: 'c' });
    expect(key('c', 'F2')).toEqual({ kind: 'rename', id: 'c' });
    expect(key('c', 'ContextMenu')).toEqual({ kind: 'menu', id: 'c' });
    expect(key('c', 'F10', true)).toEqual({ kind: 'menu', id: 'c' });
    expect(key('c', 'F10')).toBeNull();
  });

  it('takes no other key, and none with no row focused', () => {
    expect(key('c', 'x')).toBeNull();
    expect(treeKeyAction(rows, null, 'ArrowDown')).toBeNull();
    expect(treeKeyAction(rows, 'gone', 'ArrowDown')).toBeNull();
  });
});

describe('the drop', () => {
  it('reads the row’s top and bottom quarters as its edges, the middle as the row', () => {
    expect(dropZoneOf(2, 32)).toBe('before');
    expect(dropZoneOf(16, 32)).toBe('inside');
    expect(dropZoneOf(30, 32)).toBe('after');
    expect(dropZoneOf(5, 0)).toBe('inside');
  });

  const rows = visiblePageRows(TABS, NONE, null);
  const order = (id: string, target: string, zone: 'before' | 'after' | 'inside') => {
    const moved = withPageMoved(TABS, id, dropMove(rows, target, zone)!);
    return moved?.map((t) => `${t.id}${t.parent ? `<${t.parent}` : ''}`).join(' ');
  };

  it('reorders among siblings on an edge', () => {
    expect(dropMove(rows, 'c', 'before')).toEqual({ parent: 'a', before: 'c' });
    expect(order('e', 'a', 'before')).toBe('e a b<a d<b c<a');
    // After a page with no subpages: next among its siblings.
    expect(order('b', 'c', 'after')).toBe('a c<a b<a d<b e');
    expect(order('a', 'e', 'after')).toBe('e a b<a d<b c<a');
  });

  it('nests on the row itself, as its last subpage', () => {
    expect(dropMove(rows, 'c', 'inside')).toEqual({ parent: 'c' });
    expect(order('e', 'a', 'inside')).toBe('a b<a d<b c<a e<a');
  });

  it('lands as the first subpage when dropped after an open page, where the line is drawn', () => {
    expect(dropMove(rows, 'a', 'after')).toEqual({ parent: 'a', before: 'b' });
    expect(order('e', 'a', 'after')).toBe('a e<a b<a d<b c<a');
  });

  it('lands after the whole closed page when it is closed', () => {
    const closed = visiblePageRows(TABS, new Set(['a']), null);
    expect(dropMove(closed, 'a', 'after')).toEqual({ parent: undefined, before: 'e' });
  });

  it('is no move for a row not on screen', () => {
    expect(dropMove(rows, 'gone', 'inside')).toBeNull();
  });
});

describe('the sidebar’s room', () => {
  it('is 264px, a 48px rail collapsed, cleared with the corner inset at the panels’ scale', () => {
    expect(PAGE_TREE_WIDTH).toBe(264);
    expect(PAGE_TREE_RAIL_WIDTH).toBe(48);
    expect(pageTreeClearancePx(PAGE_TREE_WIDTH, 1)).toBe(280);
    expect(pageTreeClearancePx(PAGE_TREE_RAIL_WIDTH, 1.25)).toBe(76);
  });
});
