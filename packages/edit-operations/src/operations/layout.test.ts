import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { checkoutFlow } from '../fixtures/checkout-flow';
import { applied, lines, refused } from '../fixtures/outcomes';
import { boxIn, lockedFlow, run } from '../fixtures/run';

describe('layout', () => {
  it('lays out only the selection from its top-left, sizes kept, the rest untouched', () => {
    const outcome = run('layout n5 n6 n7 n8 t1 direction=right');
    const { tab } = applied(outcome);
    expect(lines(outcome)).toEqual([
      '~ a5  arrowStyle →straight',
      '~ a6  arrowStyle →straight',
      '~ a7  arrowStyle →straight',
      '» n5 n6 n7 n8 t1  laid out (flow, right)',
    ]);
    const laid = ['n5', 'n6', 'n7', 'n8', 't1'].map((id) => boxIn(tab, id));
    expect(Math.min(...laid.map(([x]) => x))).toBe(0);
    expect(Math.min(...laid.map(([, y]) => y))).toBe(400);
    expect(boxIn(tab, 'n5').slice(2)).toEqual([140, 60]);
    expect(boxIn(tab, 'n6')[2]).toBe(140);
    expect(boxIn(tab, 'n6')[3]).toBe(80);
    expect(boxIn(tab, 'n4')).toEqual(boxIn(checkoutFlow(), 'n4'));
  });

  it('detects the flow direction when none is given', () => {
    expect(lines(run('layout n5 n6 n7 n8')).at(-1)).toBe('» n6 n7 n8  laid out (flow, down)');
  });

  it('lays out as a tree or mind map', () => {
    expect(lines(run('layout type:square style=tree')).at(-2)).toBe(
      '» n3 n4 n5 n7  laid out (tree)',
    );
    expect(
      lines(run('layout n1 n2 n3 style=mindmap')).some((line) =>
        line.endsWith('laid out (mindmap)'),
      ),
    ).toBe(true);
  });

  it('sweeps boxes no arrow joins into rows from the top-left (E9)', () => {
    const tab: Tab = {
      ...checkoutFlow(),
      elements: [
        { id: 'p', type: 'sticky', x: 500, y: 500, width: 100, height: 100 } as Element,
        { id: 'q', type: 'sticky', x: 900, y: 300, width: 100, height: 100 } as Element,
      ],
    };
    const out = applied(run('layout type:sticky', tab)).tab;
    expect(boxIn(out, 'p').slice(0, 2)).toEqual([500, 300]);
    expect(boxIn(out, 'q')[1]).toBe(300);
  });

  it('prints nothing for a layout that changes nothing', () => {
    expect(lines(run('layout t1'))).toEqual([]);
  });

  it('refuses a locked box, and lays out nothing for arrows alone', () => {
    expect(refused(run('layout n5 n6', lockedFlow('n6'))).code).toBe('element_locked');
    expect(lines(run('layout a1'))).toEqual([]);
    expect(refused(run('layout nowhere')).code).toBe('target_not_found');
  });

  it('keeps a locked arrow as it was', () => {
    expect(lines(run('layout n5 n6 n7 direction=right', lockedFlow('a6')))).not.toContain(
      '~ a6  arrowStyle →straight',
    );
  });
});
