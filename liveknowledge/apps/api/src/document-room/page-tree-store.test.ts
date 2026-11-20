import { describe, expect, it } from 'vitest';
import { MAX_KNOWLEDGEBASE_PAGES, MAX_PAGE_DEPTH } from '@liveknowledge/document';
import {
  tabListRefusal,
  tabParentRefusal,
  treeFromEntries,
  treeOpRefusal,
  type StoredPage,
} from './page-tree-store';

// The page tree's checks on a write (docs/specs/030-knowledgebase/blueprints/page-tree.md "The room's check"): what
// the room, the whole-tab save and the metadata save each ask before they take a change to the tree.

// A chain a > b > c ... of `levels` pages, the deepest last.
const chain = (levels: number): StoredPage[] =>
  Array.from({ length: levels }, (_, i) =>
    i === 0 ? { id: 'p0' } : { id: `p${i}`, parent: `p${i - 1}` },
  );
const flat = (count: number): StoredPage[] =>
  Array.from({ length: count }, (_, i) => ({ id: `t${i}` }));

describe('tabParentRefusal', () => {
  it('takes a stored page saved where it already sits, whatever the tree', () => {
    // Deeper than the limit already (reading is forgiving): its writing still saves.
    const deep = chain(MAX_PAGE_DEPTH + 2);
    expect(tabParentRefusal(deep, `p${MAX_PAGE_DEPTH + 1}`, `p${MAX_PAGE_DEPTH}`)).toBeNull();
    expect(tabParentRefusal(flat(2), 't1', undefined)).toBeNull();
  });

  it('takes a new page until the knowledgebase holds 500, then refuses it', () => {
    expect(tabParentRefusal(flat(MAX_KNOWLEDGEBASE_PAGES - 1), 'new', undefined)).toBeNull();
    expect(tabParentRefusal(flat(MAX_KNOWLEDGEBASE_PAGES), 'new', undefined)).toBe('page_limit');
  });

  it('takes a page at level 8 and refuses one below it', () => {
    expect(tabParentRefusal(chain(MAX_PAGE_DEPTH - 1), 'new', `p${MAX_PAGE_DEPTH - 2}`)).toBeNull();
    expect(tabParentRefusal(chain(MAX_PAGE_DEPTH), 'new', `p${MAX_PAGE_DEPTH - 1}`)).toBe(
      'depth_limit',
    );
  });

  it('refuses a move that carries a subtree past level 8', () => {
    // b has a subpage; under the seventh level its subpage would sit on the ninth.
    const pages = [...chain(MAX_PAGE_DEPTH - 1), { id: 'b' }, { id: 'c', parent: 'b' }];
    expect(tabParentRefusal(pages, 'b', `p${MAX_PAGE_DEPTH - 2}`)).toBe('depth_limit');
    expect(tabParentRefusal(pages, 'b', `p${MAX_PAGE_DEPTH - 3}`)).toBeNull();
  });

  it('refuses a cycle: a page under itself or under one of its own subpages', () => {
    const pages = chain(3);
    expect(tabParentRefusal(pages, 'p0', 'p0')).toBe('own_subtree');
    expect(tabParentRefusal(pages, 'p0', 'p2')).toBe('own_subtree');
  });

  it('refuses a parent that is no page of this knowledgebase', () => {
    expect(tabParentRefusal(flat(2), 't1', 'tab-of-another-document')).toBe('unknown_page');
    expect(tabParentRefusal(flat(2), 'new', 'tab-of-another-document')).toBe('unknown_page');
    expect(tabParentRefusal(flat(2), 't1', 7)).toBe('unknown_page');
    expect(tabParentRefusal(flat(2), 't1', '')).toBe('unknown_page');
  });

  it('takes a move out to the top level, as null or as absent', () => {
    expect(tabParentRefusal(chain(3), 'p2', null)).toBeNull();
    expect(tabParentRefusal(chain(3), 'p2', undefined)).toBeNull();
  });
});

describe('tabListRefusal', () => {
  it('takes any order that places no page under another parent, without judging the tree', () => {
    const deep = chain(MAX_PAGE_DEPTH + 2);
    expect(
      tabListRefusal(
        deep,
        [...deep].reverse().map((p) => ({ id: p.id })),
      ),
    ).toBeNull();
    expect(
      tabListRefusal(
        deep,
        deep.map((p) => ({ id: p.id, parent: p.parent ?? null })),
      ),
    ).toBeNull();
  });

  it('judges the list whole, so two pages may trade places in one save', () => {
    // a > b becomes b > a: each alone would close a cycle against the stored tree.
    const stored: StoredPage[] = [{ id: 'a' }, { id: 'b', parent: 'a' }];
    expect(
      tabListRefusal(stored, [
        { id: 'b', parent: null },
        { id: 'a', parent: 'b' },
      ]),
    ).toBeNull();
  });

  it.each([
    [
      'a cycle',
      [
        { id: 'p0', parent: 'p2' },
        { id: 'p1', parent: 'p0' },
        { id: 'p2', parent: 'p1' },
      ],
      'own_subtree',
    ],
    ['a parent in another document', [{ id: 'p2', parent: 'elsewhere' }], 'unknown_page'],
    ['a parent that is no id', [{ id: 'p2', parent: 5 }], 'unknown_page'],
  ])('refuses %s', (_label, entries, reason) => {
    expect(tabListRefusal(chain(3), entries)).toBe(reason);
  });

  it('refuses a list that puts a page on the ninth level', () => {
    const stored = [...chain(MAX_PAGE_DEPTH), { id: 'x' }];
    expect(tabListRefusal(stored, [{ id: 'x', parent: `p${MAX_PAGE_DEPTH - 1}` }])).toBe(
      'depth_limit',
    );
    expect(tabListRefusal(stored, [{ id: 'x', parent: `p${MAX_PAGE_DEPTH - 2}` }])).toBeNull();
  });

  it('ignores an entry for a tab the document does not store', () => {
    expect(tabListRefusal(flat(2), [{ id: 'ghost', parent: 't0' }])).toBeNull();
    expect(treeFromEntries(flat(2), [{ id: 't1' }]).changed).toBe(false);
  });

  it('checks a full knowledgebase within budget', () => {
    // 500 pages in chains of 8: the worst tree the limits allow.
    const stored: StoredPage[] = Array.from({ length: MAX_KNOWLEDGEBASE_PAGES }, (_, i) =>
      i % MAX_PAGE_DEPTH === 0 ? { id: `t${i}` } : { id: `t${i}`, parent: `t${i - 1}` },
    );
    const entries = stored.map((p) => ({ id: p.id, parent: p.parent ?? null }));
    const last = MAX_KNOWLEDGEBASE_PAGES - 1;
    entries[last] = { id: `t${last}`, parent: 't0' };
    const started = performance.now();
    expect(tabListRefusal(stored, entries)).toBeNull();
    expect(performance.now() - started).toBeLessThan(150);
  });
});

describe('treeOpRefusal', () => {
  const stored = chain(3);

  it('leaves every op that is not the tree’s alone', () => {
    expect(treeOpRefusal(stored, { kind: 'el', tabId: 'p0' })).toBeNull();
    expect(
      treeOpRefusal(stored, { kind: 'article', tabId: 'p0', flow: 'art-1', ops: [] }),
    ).toBeNull();
    expect(
      treeOpRefusal(stored, { kind: 'tab-meta', tabId: 'p0', patch: { name: 'N' } }),
    ).toBeNull();
    expect(treeOpRefusal(stored, null)).toBeNull();
  });

  it('judges a tab-meta patch that sets or clears the parent', () => {
    expect(treeOpRefusal(stored, { kind: 'tab-meta', tabId: 'p0', patch: { parent: 'p2' } })).toBe(
      'own_subtree',
    );
    expect(
      treeOpRefusal(stored, { kind: 'tab-meta', tabId: 'p2', patch: { parent: 'elsewhere' } }),
    ).toBe('unknown_page');
    expect(
      treeOpRefusal(stored, { kind: 'tab-meta', tabId: 'p2', patch: {}, clear: ['parent'] }),
    ).toBeNull();
    // A tab the room has not stored yet: its first save is where it is judged.
    expect(
      treeOpRefusal(stored, { kind: 'tab-meta', tabId: 'new', patch: { parent: 'elsewhere' } }),
    ).toBeNull();
  });

  it('judges a whole tab: a new one past the limit, one placed in another document', () => {
    expect(
      treeOpRefusal(flat(MAX_KNOWLEDGEBASE_PAGES), { kind: 'tab', tabId: 'n', tab: { id: 'n' } }),
    ).toBe('page_limit');
    expect(
      treeOpRefusal(stored, { kind: 'tab', tabId: 'n', tab: { id: 'n', parent: 'elsewhere' } }),
    ).toBe('unknown_page');
    expect(
      treeOpRefusal(stored, { kind: 'tab', tabId: 'n', tab: { id: 'n', parent: 'p1' } }),
    ).toBeNull();
  });

  it('judges a document-meta list', () => {
    expect(
      treeOpRefusal(stored, {
        kind: 'document-meta',
        name: 'K',
        tabs: [{ id: 'p0', name: 'A', orderIndex: 0, parent: 'p2' }],
      }),
    ).toBe('own_subtree');
    expect(
      treeOpRefusal(stored, {
        kind: 'document-meta',
        name: 'K',
        tabs: stored.map((p, i) => ({ id: p.id, name: p.id, orderIndex: i })),
      }),
    ).toBeNull();
  });
});
