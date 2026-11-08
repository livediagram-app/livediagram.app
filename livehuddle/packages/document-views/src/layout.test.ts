import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import { arrowBetween, retiredShapeAt, shapeAt, strokeAt } from './__fixtures__/build';
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
    // One group, the canvas: nothing nests since part 3 of the element engine (not-in-livehuddle.md).
    const coarse = layoutView(checkout(), { coarse: true }).json.rows;
    expect(coarse).toHaveLength(1);
    expect(coarse?.[0]?.container).toBeNull();
    expect(coarse?.[0]?.rows.map((row) => row.length)).toEqual([1, 15, 1, 2]);
  });

  it('names the origin on the header only when content does not start at 0,0', () => {
    const at = (x: number, y: number) =>
      buildViewModel(
        { id: 'tab-1', name: 'T', elements: [shapeAt('square', 'a', x, y)] },
        { rev: 3 },
      );
    expect(layoutView(at(0, 0)).text.split('\n')[0]).not.toContain('origin');
    expect(layoutView(at(40, 20)).text.split('\n')[0]).toContain(
      'origin 40,20: stored = shown + origin · rev 3',
    );
  });

  it('prints one element and the arrows touching it with only', () => {
    const exact = layoutView(checkout(), { only: CHECKOUT_IDS.orders }).text.split('\n').slice(1);
    expect(exact[0]).toBe('146b 680,130 200x72');
    expect(exact.slice(1).every((line) => line.includes('146b.'))).toBe(true);
    expect(exact).toHaveLength(5);
    // A stored boundary holds nothing: `only` on it prints the boundary alone.
    expect(
      layoutView(checkout(), { only: CHECKOUT_IDS.data, coarse: true }).text.split('\n').slice(1),
    ).toEqual(['row 1: ca76']);
  });

  it('prints rotation, free and on-arrow ends, elements without geometry and loose rows', () => {
    const a = { ...shapeAt('square', 'a', 10, 10), rotation: 44.6 };
    const frame = retiredShapeAt('boundary', 'f', 0, 0, 1000, 1000);
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
    // A stored boundary holds nothing: what sat on it is a row member beside it.
    expect(layoutView(tab, { coarse: true }).text.split('\n').slice(1)).toEqual([
      'row 1: f a s1 s2',
      'row 2: odd',
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
    const coarse = layoutView(checkout(), { coarse: true, budget: 50 });
    expect(coarse.json.rows?.[0]?.rows.length).toBeLessThan(4);
    expect(coarse.json.rows?.[0]?.rows.length).toBeGreaterThan(0);
    expect(coarse.text.split('\n').at(-1)).toMatch(/^… \d rows? hidden: view --budget \d+$/);
  });
});

describe('the layout header origin', () => {
  it('says the origin only when content does not start at 0,0', () => {
    const atZero = buildViewModel(
      { id: 't', name: 'T', elements: [shapeAt('square', 'a', 0, 0)] },
      { rev: 3 },
    );
    expect(layoutView(atZero).text.split('\n')[0]).not.toContain('origin');
    const offset = buildViewModel(
      { id: 't', name: 'T', elements: [shapeAt('square', 'a', 40, 20)] },
      { rev: 3 },
    );
    expect(layoutView(offset).text.split('\n')[0]).toContain(
      'origin 40,20: stored = shown + origin · rev 3',
    );
  });
});
