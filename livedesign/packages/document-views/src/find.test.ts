import { describe, expect, it } from 'vitest';
import { createTable, type Element } from '@livedesign/document';
import { arrowBetween, shapeAt } from './__fixtures__/build';
import { CHECKOUT_REV, checkoutTab } from './__fixtures__/checkout-tab';
import { golden } from './__fixtures__/golden-path';
import { elementFindTexts, findView } from './find';
import { buildViewModel } from './model';

const checkout = () => buildViewModel(checkoutTab(), { rev: CHECKOUT_REV });

describe('findView (R17, VW35)', () => {
  it('prints matches under their container chains, then the counts', async () => {
    const { text, json } = findView(checkout(), 'pay');
    await expect(text).toMatchFileSnapshot(golden('checkout.find-pay.txt'));
    expect(json.matches.map((m) => [m.ref, m.field, m.path])).toEqual([
      ['146b', 'note', ['c991']],
      ['e4a8', 'label', ['c991']],
      ['480a', 'cell', []],
      ['0c84', 'label', []],
    ]);
  });

  it('folds case and width, and finds an arrow label under its source', () => {
    const { text, json } = findView(checkout(), 'ｊｗｔ');
    expect(text.split('\n').slice(1)).toEqual([
      'frame 048c "Edge"',
      '  arrow 9c5e 649c → 202b "JWT"',
      '1 match: 1 edge',
    ]);
    expect(json.q).toBe('ｊｗｔ');
  });

  it('says 0 matches', () => {
    expect(findView(checkout(), 'nothing like it').text.split('\n').at(-1)).toBe('0 matches');
  });

  it('searches fields, items, code and comments, reprinting a chain only when it changes', () => {
    const elements = [
      shapeAt('frame', 'outer', 0, 0, 2000, 2000, { label: 'Outer' }),
      shapeAt('frame', 'inner', 0, 0, 900, 900, { label: 'Inner' }),
      { ...createTable(10, 10), id: 'ent', width: 100, height: 50, cells: [['needle_id', 'uuid']] },
      shapeAt('checklist', 'list', 300, 10, 100, 50, {
        checklistItems: [{ text: 'thread the needle', done: false }],
      }),
      shapeAt('code-block', 'code', 1000, 1000, 100, 50, { code: 'const needle = 1;' }),
      shapeAt('square', 'talk', 3000, 0, 100, 50, {
        commentThread: {
          comments: [
            { id: 'c', text: 'Needle?', createdAt: 0, authorName: 'A', authorColor: '#000' },
          ],
          resolved: false,
        },
      }),
      {
        ...arrowBetween('free', 'talk', 'talk', { label: 'needle' }),
        from: { kind: 'free', x: 0, y: 0 },
      },
    ] as Element[];
    const model = buildViewModel({ id: 't', name: 'T', elements });
    const lines = findView(model, 'needle').text.split('\n').slice(1);
    expect(lines.map((l) => /^ *\S+ ?\S*/.exec(l)![0])).toEqual([
      'frame outer',
      '  frame inner',
      '    table ent',
      '    checklist list',
      '  code-block code',
      'square talk',
      'arrow free',
      '5 matches:',
    ]);
    expect(lines.at(-1)).toBe('5 matches: 1 edge, 1 cell, 1 item, 1 code, 1 comment');
  });

  // Whatever the budget, the totals stay, and a cut answer always says so: never a silent truncation.
  it('keeps its match count at every budget, and names what any budget left out', () => {
    const full = findView(checkout(), 'order');
    const total = full.text.split('\n').length;
    for (let budget = 1; budget <= full.fit.estimate; budget++) {
      const lines = findView(checkout(), 'order', { budget }).text.split('\n');
      const cut = lines.length < total;
      expect(lines.some((line) => /^\d+ match(es)?: /.test(line))).toBe(true);
      if (cut) expect(lines.at(-1)).toMatch(/^… \d+ lines? hidden: /);
    }
  });

  it('fits a budget', () => {
    const { text } = findView(checkout(), 'order', { budget: 60 });
    expect(text.split('\n').at(-1)).toMatch(/^… \d+ lines hidden: view --budget \d+$/);
  });
});

describe('find on odd shapes', () => {
  it('reads past malformed rows, prints an unlabelled container, and skips non-matching own-line arrows', () => {
    const elements = [
      shapeAt('frame', 'box', 0, 0, 900, 900, { label: undefined }),
      { ...shapeAt('square', 't', 10, 10), type: 'table', cells: ['junk', ['a needle']] },
      { ...arrowBetween('free', 't', 't', { label: 'other' }), from: { kind: 'free', x: 0, y: 0 } },
    ] as unknown as Element[];
    const model = buildViewModel({ id: 't', name: 'T', elements });
    expect(findView(model, 'needle').text.split('\n').slice(1, 2)).toEqual(['frame box']);
    expect(findView(model, 'needle').json.matches.map((m) => m.field)).toEqual(['cell']);
  });

  it('finds a Sankey by the nodes its flows name, each once', () => {
    const model = buildViewModel(
      {
        id: 't',
        name: 'T',
        elements: [
          shapeAt('sankey', 'sk', 0, 0, 400, 200, {
            sankeyFlows: [
              { from: 'Salary', to: 'Budget', value: 3 },
              { from: 'Budget', to: 'Savings', value: 1 },
              'not a flow',
            ] as never,
          }),
        ] as Element[],
      },
      { rev: 1 },
    );
    const { json } = findView(model, 'budget');
    expect(json.matches.map((m) => [m.ref, m.field])).toHaveLength(1);
    expect(json.matches[0]!.field).toBe('node');
  });
});

describe('elementFindTexts', () => {
  it('lists every text find searches on one element, for a caller without the view', () => {
    const el = { ...shapeAt('square', 's1', 0, 0), label: 'Pay now', note: 'by card' } as Element;
    expect(elementFindTexts(el)).toEqual(['Pay now', 'by card']);
  });
});
