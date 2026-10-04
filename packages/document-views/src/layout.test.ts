import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { arrowBetween, shapeAt, strokeAt } from './__fixtures__/build';
import { CHECKOUT_IDS, CHECKOUT_REV, checkoutTab } from './__fixtures__/checkout-tab';
import { golden } from './__fixtures__/golden-path';
import { layoutView } from './layout';
import { buildViewModel } from './model';

const checkout = () => buildViewModel(checkoutTab(), { rev: CHECKOUT_REV });
const tabOf = (elements: Element[]) => buildViewModel({ id: 'tab-1', name: 'T', elements });

describe('layoutView (R17)', () => {
  it('prints exact geometry from the content origin, and coarse rows (VW31, VW32)', async () => {
    await expect(layoutView(checkout()).text).toMatchFileSnapshot(golden('checkout.layout.txt'));
    await expect(layoutView(checkout(), { coarse: true }).text).toMatchFileSnapshot(
      golden('checkout.layout-coarse.txt'),
    );
    const { json } = layoutView(checkout());
    expect(json.origin).toEqual({ x: 40, y: 20 });
    expect(json.boxes).toHaveLength(19);
    expect(json.arrows[4]).toEqual({ ref: 'c41d', from: '146b.s', to: 'e4a8.n', style: 'angled' });
    expect(json.rows).toBeNull();
    expect(layoutView(checkout(), { coarse: true }).json.rows?.[0]).toEqual({
      container: null,
      rows: [['98eb'], ['048c', 'c991', 'ca76', 'e6d7'], ['cb02'], ['480a', '0c84']],
    });
  });

  it('prints one subtree and the arrows touching it with only', () => {
    const exact = layoutView(checkout(), { only: CHECKOUT_IDS.data }).text.split('\n').slice(1);
    expect(exact).toEqual([
      'ca76 1000,80 280x440',
      'd41e 1040,130 200x90',
      '822f 1040,280 200x90',
      '892e 146b.e → d41e.w',
      '1fc0 12de.e → 822f.w',
    ]);
    expect(
      layoutView(checkout(), { only: CHECKOUT_IDS.data, coarse: true }).text.split('\n').slice(1),
    ).toEqual(['ca76: d41e / 822f']);
  });

  it('prints rotation, free and on-arrow ends, elements without geometry and loose rows', () => {
    const a = { ...shapeAt('square', 'a', 10, 10), rotation: 44.6 };
    const frame = shapeAt('frame', 'f', 0, 0, 1000, 1000);
    const odd = { id: 'odd', type: 'hologram' } as unknown as Element;
    const tab = tabOf([
      frame,
      a,
      odd,
      strokeAt('s1', 2000, 0),
      strokeAt('s2', 2100, 0),
      arrowBetween('ab', 'a', 'f', { to: { kind: 'free', x: 55.4, y: 66.6 } }),
      { ...arrowBetween('on', 'a', 'f'), from: { kind: 'on-arrow', arrowId: 'ab', t: 0.5 } },
    ]);
    expect(layoutView(tab).text.split('\n').slice(1)).toEqual([
      // A stroke's box pads its points, so the origin sits a pixel above them.
      'f 0,1 1000x1000',
      'a 10,11 100x50 r=45',
      's1 1999,0 22x12',
      's2 2099,0 22x12',
      'odd no geometry',
      'ab a.e → 55,68',
      'on arrow:ab@0.50 → f.w',
    ]);
    expect(layoutView(tab).json.boxes).toHaveLength(4);
    expect(layoutView(tab, { coarse: true }).text.split('\n').slice(1)).toEqual([
      'canvas: f s1 s2 / odd',
      'f: a',
    ]);
    const inFrame = tabOf([frame, a, strokeAt('t1', 300, 300), strokeAt('t2', 400, 300)]);
    expect(layoutView(inFrame, { coarse: true }).text.split('\n').slice(1)).toEqual([
      'canvas: f',
      'f: a / t1 t2',
    ]);
  });

  it('fits a budget, in both forms', () => {
    const exact = layoutView(checkout(), { budget: 100 });
    expect(exact.json.boxes.length).toBeLessThan(19);
    expect(exact.json.arrows).toEqual([]);
    expect(exact.text.split('\n').at(-1)).toMatch(
      /^… \d+ boxes hidden; 11 arrows hidden: view --budget \d+$/,
    );
    const partArrows = layoutView(checkout(), { budget: 190 }).json;
    expect(partArrows.boxes).toHaveLength(19);
    expect(partArrows.arrows.length).toBeLessThan(11);
    const coarse = layoutView(checkout(), { coarse: true, budget: 75 });
    expect(coarse.json.rows?.length).toBeLessThan(4);
    expect(coarse.json.rows?.length).toBeGreaterThan(0);
    expect(coarse.text.split('\n').at(-1)).toMatch(/^… \d containers? hidden: view --budget \d+$/);
  });
});
