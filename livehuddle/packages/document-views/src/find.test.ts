import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import { arrowBetween, retiredShapeAt, shapeAt } from './__fixtures__/build';
import { CHECKOUT_REV, checkoutTab } from './__fixtures__/checkout-tab';
import { golden } from './__fixtures__/golden-path';
import { findView } from './find';
import { buildViewModel } from './model';

const checkout = () => buildViewModel(checkoutTab(), { rev: CHECKOUT_REV });

describe('findView (R17, VW35)', () => {
  // Nothing nests since part 3 of the element engine (docs/specs/002-project-scope/not-in-livehuddle.md): each match
  // prints on its own outline line, and its path on the wire is empty.
  it('prints each match on its outline line, then the counts', async () => {
    const { text, json } = findView(checkout(), 'pay');
    await expect(text).toMatchFileSnapshot(golden('checkout.find-pay.txt'));
    expect(json.matches.every((m) => m.path.length === 0)).toBe(true);
    expect(json.matches.map((m) => m.field)).toContain('note');
  });

  it('folds case and width, and finds an arrow label under its source', () => {
    const { text, json } = findView(checkout(), 'ｊｗｔ');
    expect(text.split('\n').slice(1)).toEqual(['arrow 9c5e 649c → 202b "JWT"', '1 match: 1 edge']);
    expect(json.q).toBe('ｊｗｔ');
  });

  it('says 0 matches', () => {
    expect(findView(checkout(), 'nothing like it').text.split('\n').at(-1)).toBe('0 matches');
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
  it('reads past malformed rows, and skips non-matching own-line arrows', () => {
    const elements = [
      { ...shapeAt('square', 't', 10, 10), type: 'table', cells: ['junk', ['a needle']] },
      { ...arrowBetween('free', 't', 't', { label: 'other' }), from: { kind: 'free', x: 0, y: 0 } },
    ] as unknown as Element[];
    const model = buildViewModel({ id: 't', name: 'T', elements });
    expect(findView(model, 'needle').text.split('\n').slice(1, 2)).toEqual(['? table t']);
    expect(findView(model, 'needle').json.matches.map((m) => m.field)).toEqual(['cell']);
  });

  it('searches items, code and comments, each match on its own line', () => {
    const elements = [
      retiredShapeAt('checklist', 'list', 300, 10, 100, 50, {
        checklistItems: [{ text: 'thread the needle', done: false }],
      }),
      retiredShapeAt('code-block', 'code', 1000, 1000, 100, 50, { code: 'const needle = 1;' }),
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
      '? checklist',
      'square talk',
      '? code-block',
      'arrow free',
      '4 matches:',
    ]);
    expect(lines.at(-1)).toBe('4 matches: 1 edge, 1 item, 1 code, 1 comment');
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3: a stored lane, boundary or stack
  // is a placeholder that holds nothing. find still reads its stored label, and prints it flat as `? <kind>`.
  it("finds a stored layout container's label, flat, and what sat on it beside it", () => {
    const elements = [
      retiredShapeAt('lane', 'ops', 0, 0, 1200, 300, { label: 'Ops lane' }),
      retiredShapeAt('boundary', 'vpc', 0, 400, 900, 400, { label: 'Ops VPC' }),
      retiredShapeAt('stack', 'row', 0, 900, 600, 200, { label: 'Ops stack' }),
      shapeAt('square', 'deploy', 100, 100, 100, 50, { label: 'Deploy ops' }),
    ] as Element[];
    const { text, json } = findView(buildViewModel({ id: 't', name: 'T', elements }), 'ops');
    expect(text.split('\n').slice(1)).toEqual([
      '? lane ops "Ops lane"',
      'square deploy "Deploy ops"',
      '? boundary vpc "Ops VPC"',
      '? stack row "Ops stack"',
      '4 matches: 4 labels',
    ]);
    expect(json.matches.map((m) => [m.ref, m.kind, m.path])).toEqual([
      ['ops', '? lane', []],
      ['deploy', 'square', []],
      ['vpc', '? boundary', []],
      ['row', '? stack', []],
    ]);
  });
});
