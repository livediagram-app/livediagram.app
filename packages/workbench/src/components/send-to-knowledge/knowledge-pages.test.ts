import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { pageTree, plainLine, previewBlocks, searchPages, selectionWords } from './knowledge-pages';

describe('pageTree', () => {
  it('lists each page then the pages under it, a lost parent at the top, a loop broken', () => {
    expect(
      pageTree([
        { id: 'a', name: 'Handbook', parent: null },
        { id: 'b', name: 'Payments', parent: 'a' },
        { id: 'c', name: 'Cards', parent: 'b' },
        { id: 'd', name: 'Orphan', parent: 'gone' },
        { id: 'x', name: 'Loop X', parent: 'y' },
        { id: 'y', name: 'Loop Y', parent: 'x' },
        { id: 'z', name: 'Self', parent: 'z' },
      ]),
    ).toEqual([
      { id: 'a', name: 'Handbook', depth: 0 },
      { id: 'b', name: 'Payments', depth: 1 },
      { id: 'c', name: 'Cards', depth: 2 },
      { id: 'd', name: 'Orphan', depth: 0 },
      { id: 'z', name: 'Self', depth: 0 },
      { id: 'x', name: 'Loop X', depth: 0 },
      { id: 'y', name: 'Loop Y', depth: 1 },
    ]);
  });

  it('reads a deep tree in linear time', () => {
    const pages = Array.from({ length: 2_000 }, (_, i) => ({
      id: `p${i}`,
      name: `Page ${i}`,
      parent: i === 0 ? null : `p${i - 1}`,
    }));
    expect(cpuMsOf(() => pageTree(pages))).toBeLessThan(cpuBudgetMs(100));
  });
});

describe('searchPages', () => {
  it('keeps pages whose title holds every word', () => {
    const tree = [
      { id: 'a', name: 'Payment Cards', depth: 0 },
      { id: 'b', name: 'Payments', depth: 1 },
    ];
    expect(searchPages(tree, 'card pay').map((p) => p.id)).toEqual(['a']);
    expect(searchPages(tree, '  ')).toHaveLength(2);
  });
});

describe('previewBlocks', () => {
  it('reads headings, joined paragraphs, nested items, numbered items and code', () => {
    expect(
      previewBlocks(
        '### Checkout\n\nThe cart\nsends the **order**.\n\n- Cart\n  - Line\n1. First\n```\n# not a heading\n```\nSent from [Payments](https://x) in livediagram',
      ),
    ).toEqual([
      { kind: 'heading', text: 'Checkout' },
      { kind: 'paragraph', text: 'The cart sends the order.' },
      { kind: 'item', text: 'Cart', depth: 0 },
      { kind: 'item', text: 'Line', depth: 1 },
      { kind: 'item', text: 'First', depth: 0 },
      { kind: 'code', text: '# not a heading' },
      { kind: 'paragraph', text: 'Sent from Payments in livediagram' },
    ]);
  });

  it('takes the fallback list’s escapes', () => {
    expect(plainLine('Cart \\#1 \\[draft\\]')).toBe('Cart #1 [draft]');
  });

  it('reads a worst-case summary in linear time', () => {
    const worst = `${'[a]('.repeat(5_000)}\n${'#'.repeat(10_000)}\n${'- '.repeat(10_000)}`;
    expect(cpuMsOf(() => previewBlocks(worst))).toBeLessThan(cpuBudgetMs(150));
  });
});

describe('selectionWords', () => {
  it('counts items and arrows', () => {
    expect(selectionWords(1, 0)).toBe('1 item');
    expect(selectionWords(6, 4)).toBe('6 items, 4 arrows');
    expect(selectionWords(2, 1)).toBe('2 items, 1 arrow');
  });
});
