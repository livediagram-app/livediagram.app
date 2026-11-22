// docs/specs/030-knowledgebase/knowledgebases-and-pages.md "A knowledgebase", "The page tree".
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';
import {
  buildPageTree,
  isConnectedRow,
  MAX_KNOWLEDGEBASE_PAGES,
  MAX_PAGE_DEPTH,
  pageAddRefusal,
  pageAncestors,
  pageCount,
  pageDepth,
  pageMoveRefusal,
  pageParents,
  pageSubtreeIds,
  pageTreeRefusal,
  pageTreeRows,
  parseTabParent,
  subpageCount,
  withConnectedRowAdded,
  withPageAdded,
  withPageDeleted,
  withPageIndented,
  withPageMoved,
  withPageOutdented,
  withPageStepped,
  withPageTreeOrder,
  type TreePage,
} from './page-tree';

const page = (id: string, parent?: string): TreePage => (parent ? { id, parent } : { id });
// "a b>a c>b d": each page, with its parent after ">".
const pagesOf = (text: string): TreePage[] =>
  text.split(' ').map((part) => {
    const [id, parent] = part.split('>');
    return page(id!, parent);
  });
const show = (pages: readonly TreePage[]) =>
  pages.map((p) => (p.parent ? `${p.id}>${p.parent}` : p.id)).join(' ');
const moved = (out: TreePage[] | null) => (out ? show(out) : null);

// start
//   guide
//     install
//     upgrade
//   faq
// team
const TREE = pagesOf('start guide>start install>guide upgrade>guide faq>start team');

// A chain n levels deep: p1, p2 under p1, ...
const chain = (n: number): TreePage[] =>
  Array.from({ length: n }, (_, i) => page(`p${i + 1}`, i === 0 ? undefined : `p${i}`));

describe('limits', () => {
  it('holds a knowledgebase to 500 pages, 8 levels deep', () => {
    expect(MAX_KNOWLEDGEBASE_PAGES).toBe(500);
    expect(MAX_PAGE_DEPTH).toBe(8);
  });
});

describe('a stored parent', () => {
  it('is a non-empty id, else none', () => {
    expect(parseTabParent('a')).toBe('a');
    for (const v of ['', 7, null, undefined, {}, 'x'.repeat(129)])
      expect(parseTabParent(v)).toBeUndefined();
  });

  it('reads a parent that is gone, or the page itself, as the top level', () => {
    const parents = pageParents(pagesOf('a b>gone c>c d>a'));
    expect([...parents]).toEqual([
      ['a', undefined],
      ['b', undefined],
      ['c', undefined],
      ['d', 'a'],
    ]);
  });

  it('never reads a cycle: it is cut at its first page, which keeps the rest under it', () => {
    const looped = pagesOf('a>c b>a c>b d');
    expect(show(withPageTreeOrder(looped))).toBe('a b>a c>b d');
    expect(pageAncestors(looped, 'c').map((p) => p.id)).toEqual(['a', 'b']);
    // Two pages each the other's parent.
    expect(show(withPageTreeOrder(pagesOf('x>y y>x')))).toBe('x y>x');
  });
});

describe('the tree', () => {
  it('nests each page under its parent, siblings in list order', () => {
    const ids = (nodes: ReturnType<typeof buildPageTree<TreePage>>): unknown =>
      nodes.map((n) => (n.children.length ? [n.page.id, ids(n.children)] : n.page.id));
    expect(ids(buildPageTree(TREE))).toEqual([
      ['start', [['guide', ['install', 'upgrade']], 'faq']],
      'team',
    ]);
    expect(buildPageTree([])).toEqual([]);
  });

  it('draws as rows, each page then its subpages, with its level and how many are under it', () => {
    expect(pageTreeRows(TREE).map((r) => [r.page.id, r.depth, r.subpages])).toEqual([
      ['start', 1, 4],
      ['guide', 2, 2],
      ['install', 3, 0],
      ['upgrade', 3, 0],
      ['faq', 2, 0],
      ['team', 1, 0],
    ]);
  });

  it('draws a list out of tree order as the tree', () => {
    const jumbled = pagesOf('install>guide team guide>start start faq>start');
    expect(pageTreeRows(jumbled).map((r) => r.page.id)).toEqual([
      'team',
      'start',
      'guide',
      'install',
      'faq',
    ]);
  });

  it('names a page’s ancestors from the top, its level, and its subtree', () => {
    expect(pageAncestors(TREE, 'install').map((p) => p.id)).toEqual(['start', 'guide']);
    expect(pageAncestors(TREE, 'start')).toEqual([]);
    expect(pageAncestors(TREE, 'nope')).toEqual([]);
    expect(pageDepth(TREE, 'start')).toBe(1);
    expect(pageDepth(TREE, 'install')).toBe(3);
    expect(pageDepth(TREE, 'nope')).toBe(0);
    expect(pageSubtreeIds(TREE, 'guide')).toEqual(['guide', 'install', 'upgrade']);
    expect(pageSubtreeIds(TREE, 'nope')).toEqual([]);
    expect(pageSubtreeIds(TREE, '')).toEqual([]);
    expect(subpageCount(TREE, 'start')).toBe(4);
    expect(subpageCount(TREE, 'faq')).toBe(0);
    expect(subpageCount(TREE, 'nope')).toBe(0);
  });
});

describe('the list in tree order', () => {
  it('is the same list when it is already so', () => {
    expect(withPageTreeOrder(TREE)).toBe(TREE);
  });

  it('puts each page before its subpages and drops a parent that is gone', () => {
    const out = withPageTreeOrder(pagesOf('b>a a c>gone'));
    expect(show(out)).toBe('a b>a c');
    expect('parent' in out[2]!).toBe(false);
  });
});

describe('adding a page', () => {
  it('adds a top-level page last, a subpage after its parent’s last subpage', () => {
    expect(moved(withPageAdded(TREE, page('new')) as TreePage[])).toBe(`${show(TREE)} new`);
    expect(moved(withPageAdded(TREE, page('new'), 'guide') as TreePage[])).toBe(
      'start guide>start install>guide upgrade>guide new>guide faq>start team',
    );
    // The parent given wins over one the page carried.
    expect(moved(withPageAdded(TREE, page('new', 'team'), 'faq') as TreePage[])).toContain(
      'new>faq',
    );
  });

  it('refuses past 500 pages, below 8 levels, under a page not there, or an id already there', () => {
    const full = Array.from({ length: MAX_KNOWLEDGEBASE_PAGES }, (_, i) => page(`p${i}`));
    expect(pageAddRefusal(full)).toBe('page_limit');
    expect(withPageAdded(full, page('new'))).toEqual({ refused: 'page_limit' });
    const deep = chain(MAX_PAGE_DEPTH);
    expect(pageAddRefusal(deep, `p${MAX_PAGE_DEPTH - 1}`)).toBeNull();
    expect(pageAddRefusal(deep, `p${MAX_PAGE_DEPTH}`)).toBe('depth_limit');
    expect(withPageAdded(deep, page('new'), `p${MAX_PAGE_DEPTH}`)).toEqual({
      refused: 'depth_limit',
    });
    expect(pageAddRefusal(TREE, 'nope')).toBe('unknown_page');
    expect(withPageAdded(TREE, page('faq'))).toEqual({ refused: 'unknown_page' });
    expect(pageAddRefusal(TREE)).toBeNull();
  });
});

describe('moving a page', () => {
  it('moves it with its subpages, among siblings or under another page', () => {
    expect(moved(withPageMoved(TREE, 'guide', { parent: 'team' }))).toBe(
      'start faq>start team guide>team install>guide upgrade>guide',
    );
    expect(moved(withPageMoved(TREE, 'guide', {}))).toBe(
      'start faq>start team guide install>guide upgrade>guide',
    );
    expect(moved(withPageMoved(TREE, 'team', { before: 'start' }))).toBe(
      'team start guide>start install>guide upgrade>guide faq>start',
    );
    expect(moved(withPageMoved(TREE, 'faq', { parent: 'start', before: 'guide' }))).toBe(
      'start faq>start guide>start install>guide upgrade>guide team',
    );
    // A `before` that is not a subpage of the target puts it last there.
    expect(moved(withPageMoved(TREE, 'faq', { parent: 'guide', before: 'team' }))).toBe(
      'start guide>start install>guide upgrade>guide faq>guide team',
    );
  });

  it('is never dropped inside its own subtree, and changes nothing where it already is', () => {
    expect(pageMoveRefusal(TREE, 'start', { parent: 'install' })).toBe('own_subtree');
    expect(pageMoveRefusal(TREE, 'guide', { parent: 'guide' })).toBe('own_subtree');
    expect(withPageMoved(TREE, 'start', { parent: 'install' })).toBeNull();
    expect(withPageMoved(TREE, 'team', {})).toBeNull();
    expect(withPageMoved(TREE, 'faq', { parent: 'start' })).toBeNull();
    expect(withPageMoved(TREE, 'faq', { parent: 'start', before: 'faq' })).toBeNull();
    expect(pageMoveRefusal(TREE, 'nope', {})).toBe('unknown_page');
    expect(pageMoveRefusal(TREE, '', {})).toBe('unknown_page');
    expect(pageMoveRefusal(TREE, 'faq', { parent: 'nope' })).toBe('unknown_page');
    expect(pageMoveRefusal(TREE, 'faq', { parent: '' })).toBe('unknown_page');
  });

  it('never lets its deepest subpage pass 8 levels', () => {
    const deep = [...chain(MAX_PAGE_DEPTH - 1), page('a'), page('b', 'a')];
    // a (with b under it) under the 7th level would put b at level 9.
    expect(pageMoveRefusal(deep, 'a', { parent: `p${MAX_PAGE_DEPTH - 1}` })).toBe('depth_limit');
    expect(withPageMoved(deep, 'a', { parent: `p${MAX_PAGE_DEPTH - 1}` })).toBeNull();
    expect(pageMoveRefusal(deep, 'a', { parent: `p${MAX_PAGE_DEPTH - 2}` })).toBeNull();
    expect(pageMoveRefusal(deep, 'b', { parent: `p${MAX_PAGE_DEPTH - 1}` })).toBeNull();
  });
});

describe('Move Up and Move Down', () => {
  it('step a page among its siblings, its subpages with it', () => {
    expect(moved(withPageStepped(TREE, 'faq', -1))).toBe(
      'start faq>start guide>start install>guide upgrade>guide team',
    );
    expect(moved(withPageStepped(TREE, 'guide', 1))).toBe(
      'start faq>start guide>start install>guide upgrade>guide team',
    );
    expect(moved(withPageStepped(TREE, 'start', 1))).toBe(
      'team start guide>start install>guide upgrade>guide faq>start',
    );
    expect(moved(withPageStepped(TREE, 'install', 1))).toBe(
      'start guide>start upgrade>guide install>guide faq>start team',
    );
  });

  it('stop at the first and the last sibling, and for a page not there', () => {
    expect(withPageStepped(TREE, 'start', -1)).toBeNull();
    expect(withPageStepped(TREE, 'team', 1)).toBeNull();
    expect(withPageStepped(TREE, 'guide', -1)).toBeNull();
    expect(withPageStepped(TREE, 'nope', 1)).toBeNull();
    expect(withPageStepped(TREE, '', 1)).toBeNull();
  });
});

describe('Indent and Outdent', () => {
  it('indents a page under the sibling above it, last', () => {
    expect(moved(withPageIndented(TREE, 'faq'))).toBe(
      'start guide>start install>guide upgrade>guide faq>guide team',
    );
    expect(moved(withPageIndented(TREE, 'team'))).toBe(
      'start guide>start install>guide upgrade>guide faq>start team>start',
    );
  });

  it('indents nothing with no sibling above, past 8 levels, or for a page not there', () => {
    expect(withPageIndented(TREE, 'start')).toBeNull();
    expect(withPageIndented(TREE, 'guide')).toBeNull();
    expect(withPageIndented(TREE, 'nope')).toBeNull();
    expect(withPageIndented(TREE, '')).toBeNull();
    const deep = [...chain(MAX_PAGE_DEPTH), page('z', `p${MAX_PAGE_DEPTH - 1}`)];
    // z is at level 8 beside p8: under p8 it would be level 9.
    expect(withPageIndented(deep, 'z')).toBeNull();
  });

  it('outdents a page to just after the page it was under', () => {
    expect(moved(withPageOutdented(TREE, 'install'))).toBe(
      'start guide>start upgrade>guide install>start faq>start team',
    );
    expect(moved(withPageOutdented(TREE, 'faq'))).toBe(
      'start guide>start install>guide upgrade>guide faq team',
    );
    expect(moved(withPageOutdented(TREE, 'guide'))).toBe(
      'start faq>start guide install>guide upgrade>guide team',
    );
  });

  it('outdents nothing at the top level, or for a page not there', () => {
    expect(withPageOutdented(TREE, 'team')).toBeNull();
    expect(withPageOutdented(TREE, 'nope')).toBeNull();
  });
});

describe('deleting a page', () => {
  it('takes its subpages with it', () => {
    expect(moved(withPageDeleted(TREE, 'guide'))).toBe('start faq>start team');
    expect(moved(withPageDeleted(TREE, 'start'))).toBe('team');
    expect(moved(withPageDeleted(TREE, 'upgrade'))).toBe(
      'start guide>start install>guide faq>start team',
    );
  });

  it('never leaves a knowledgebase with no page, and deletes nothing that is not there', () => {
    expect(withPageDeleted(pagesOf('a b>a'), 'a')).toBeNull();
    expect(withPageDeleted(pagesOf('a'), 'a')).toBeNull();
    expect(withPageDeleted(TREE, 'nope')).toBeNull();
  });
});

describe('what the room checks', () => {
  it('takes a tree within the limits', () => {
    expect(pageTreeRefusal(TREE)).toBeNull();
    expect(pageTreeRefusal([])).toBeNull();
    expect(pageTreeRefusal(chain(MAX_PAGE_DEPTH))).toBeNull();
  });

  it('refuses over 500 pages, or a page below 8 levels', () => {
    const many = Array.from({ length: MAX_KNOWLEDGEBASE_PAGES + 1 }, (_, i) => page(`p${i}`));
    expect(pageTreeRefusal(many)).toBe('page_limit');
    expect(pageTreeRefusal(chain(MAX_PAGE_DEPTH + 1))).toBe('depth_limit');
  });
});

// The sidebar draws the rows on every change of the list: a full knowledgebase, as deep as it may be, stays well
// inside a frame (measured about 1 ms; the budget is generous so a loaded CI machine never flakes).
describe('cost', () => {
  it('draws and moves in a full knowledgebase within its CPU budget', () => {
    const pages = Array.from({ length: MAX_KNOWLEDGEBASE_PAGES }, (_, i) =>
      page(`p${i}`, i % MAX_PAGE_DEPTH === 0 ? undefined : `p${i - 1}`),
    );
    const start = cpuNowMs();
    expect(pageTreeRows(pages)).toHaveLength(MAX_KNOWLEDGEBASE_PAGES);
    expect(withPageMoved(pages, 'p8', { before: 'p0' })).not.toBeNull();
    expect(pageTreeRefusal(pages)).toBeNull();
    expect(cpuNowMs() - start).toBeLessThan(cpuBudgetMs(150));
  });
});

// docs/specs/030-knowledgebase/links-and-embeds.md "Connected files in the sidebar": a connected row is placed like a
// page but is no page.
describe('connected rows', () => {
  const link = { id: 'c1', app: 'livediagram', itemId: 'i1' };
  const row = (id: string, parent?: string): TreePage =>
    parent ? { id, parent, connection: link } : { id, connection: link };

  it('tells a connected row from a page, and counts pages alone', () => {
    expect(isConnectedRow(row('x'))).toBe(true);
    expect(isConnectedRow(page('a'))).toBe(false);
    expect(isConnectedRow({ id: 'n', connection: null })).toBe(false);
    expect(pageCount([page('a'), row('x'), page('b', 'a')])).toBe(2);
  });

  it('never counts a connected row toward the page limit', () => {
    const full = Array.from({ length: MAX_KNOWLEDGEBASE_PAGES - 1 }, (_, i) => page(`p${i}`));
    const withRows = [...full, row('x'), row('y')];
    expect(pageAddRefusal(withRows)).toBeNull();
    expect(pageTreeRefusal([...withRows, page('last')])).toBeNull();
    expect(pageAddRefusal([...withRows, page('last')])).toBe('page_limit');
    // Adding a connected row is never refused for the page limit.
    expect(withConnectedRowAdded([...withRows, page('last')], row('z'))).toHaveLength(
      MAX_KNOWLEDGEBASE_PAGES + 3,
    );
  });

  it("places a connected row at the top level or as a page's last subpage, never under another row", () => {
    const pages = [page('a'), page('b', 'a'), row('x')];
    expect(withConnectedRowAdded(pages, row('y'), 'a')).toEqual([
      page('a'),
      page('b', 'a'),
      row('y', 'a'),
      row('x'),
    ]);
    expect(withConnectedRowAdded(pages, row('y'))).toEqual([...pages, row('y')]);
    expect(withConnectedRowAdded(pages, row('y'), 'x')).toEqual({ refused: 'unknown_page' });
    expect(withConnectedRowAdded(pages, row('y'), 'gone')).toEqual({ refused: 'unknown_page' });
    expect(withConnectedRowAdded(pages, row('x'))).toEqual({ refused: 'unknown_page' });
    const deep = Array.from({ length: MAX_PAGE_DEPTH }, (_, i) =>
      page(`d${i}`, i ? `d${i - 1}` : undefined),
    );
    expect(withConnectedRowAdded(deep, row('y'), `d${MAX_PAGE_DEPTH - 1}`)).toEqual({
      refused: 'depth_limit',
    });
  });

  it('holds no subpages: nothing is added or moved under one, and a stored one reads at the top level', () => {
    const pages = [page('a'), row('x'), page('b')];
    expect(pageAddRefusal(pages, 'x')).toBe('unknown_page');
    expect(pageMoveRefusal(pages, 'b', { parent: 'x' })).toBe('unknown_page');
    expect(withPageMoved(pages, 'b', { parent: 'x' })).toBeNull();
    expect(pageParents([page('a'), row('x'), page('b', 'x')]).get('b')).toBeUndefined();
    // A connected row moves like a page: under a page, or back to the top.
    expect(withPageMoved(pages, 'x', { parent: 'a' })).toEqual([
      page('a'),
      row('x', 'a'),
      page('b'),
    ]);
  });

  it('never deletes the last page, whatever connected rows are left', () => {
    expect(withPageDeleted([page('a'), row('x')], 'a')).toBeNull();
    expect(withPageDeleted([page('a'), row('x')], 'x')).toEqual([page('a')]);
    expect(withPageDeleted([page('a'), row('x', 'a'), page('b')], 'a')).toEqual([page('b')]);
  });
});
