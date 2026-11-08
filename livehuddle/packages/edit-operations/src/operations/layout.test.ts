import { describe, expect, it } from 'vitest';
import type { Tab } from '@livehuddle/document';
import { checkoutFlow } from '../fixtures/checkout-flow';
import { applied, lines, refused } from '../fixtures/outcomes';
import { boxIn, run } from '../fixtures/run';

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

  it('lays out as a tree, and refuses the mind map style', () => {
    expect(lines(run('layout type:square style=tree')).find((l) => l.startsWith('»'))).toBe(
      '» n3 n4 n5 n7  laid out (tree)',
    );
    expect(run('layout n1 n2 n3 style=mindmap')).toHaveProperty('errors');
  });

  it('runs a tree across when asked right, down when asked down (EO38)', () => {
    const right = run('layout type:square style=tree direction=right');
    expect(lines(right).some((line) => line.endsWith('laid out (tree, right)'))).toBe(true);
    const down = run('layout type:square style=tree direction=down');
    expect(lines(down).some((line) => line.endsWith('laid out (tree, down)'))).toBe(true);
    expect(applied(right).tab).not.toEqual(applied(down).tab);
  });

  it('sweeps boxes no arrow joins into rows from the top-left (E9)', () => {
    const tab: Tab = {
      ...checkoutFlow(),
      elements: [
        { id: 'p', type: 'sticky', x: 500, y: 500, width: 100, height: 100 },
        { id: 'q', type: 'sticky', x: 900, y: 300, width: 100, height: 100 },
      ],
    };
    const out = applied(run('layout type:sticky', tab)).tab;
    expect(boxIn(out, 'p').slice(0, 2)).toEqual([500, 300]);
    expect(boxIn(out, 'q')[1]).toBe(300);
  });

  it('prints nothing for a layout that changes nothing', () => {
    expect(lines(run('layout t1'))).toEqual([]);
  });

  it('lays out nothing for arrows alone', () => {
    expect(lines(run('layout a1'))).toEqual([]);
    expect(refused(run('layout nowhere')).code).toBe('target_not_found');
  });

  // What `layout` lays out (EO38): refs and quoted labels each name one element, the other words together any
  // number, in element order, each once.
  it('takes refs, quoted labels and selector terms together, and refuses what names nothing', () => {
    const { targets } = applied(run('layout "Cart" n3 label~"card"'));
    expect([...targets].sort()).toEqual(['n2', 'n3', 'n5', 'n7']);
    expect(refused(run('layout n3 nowhere')).code).toBe('target_not_found');
    expect(refused(run('layout n3 type:table')).code).toBe('target_not_found');
    expect(refused(run('layout n3 selected')).details[0]).toBe('nothing is selected');
    expect(refused(run('{"op":"layout","target":"\\"open"}')).code).toBe('parse_error');
  });
});
