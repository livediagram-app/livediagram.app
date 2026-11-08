import { describe, expect, it } from 'vitest';
import type { Tab } from '@livehuddle/document';
import { checkoutFlow } from '../fixtures/checkout-flow';
import { applied, lines, refused } from '../fixtures/outcomes';
import { boxIn, run } from '../fixtures/run';

describe('layout', () => {
  // No arrow joins anything since part 4 of the element engine (docs/specs/002-project-scope/not-in-livehuddle.md):
  // the sweep is the whole layout, and the stored arrows are left as stored.
  it('sweeps only the selection into rows from its top-left, sizes kept, the rest untouched', () => {
    const outcome = run('layout n5 n6 n7 n8 t1');
    const { tab } = applied(outcome);
    // n5 already sits at the selection's top-left.
    expect(lines(outcome)).toEqual(['» n6 n7 n8 t1  laid out']);
    const laid = ['n5', 'n6', 'n7', 'n8', 't1'].map((id) => boxIn(tab, id));
    expect(Math.min(...laid.map(([x]) => x))).toBe(0);
    expect(Math.min(...laid.map(([, y]) => y))).toBe(400);
    expect(boxIn(tab, 'n5').slice(2)).toEqual([140, 60]);
    expect(boxIn(tab, 'n6').slice(2)).toEqual([140, 80]);
    expect(boxIn(tab, 'n4')).toEqual(boxIn(checkoutFlow(), 'n4'));
    const a5 = (t: Tab) => t.elements.find((el) => el.id === 'a5');
    expect(a5(tab)).toEqual(a5(checkoutFlow()));
  });

  it('refuses the layered layout’s style and direction', () => {
    expect(run('layout n1 n2 n3 style=tree')).toHaveProperty('errors');
    expect(run('layout n1 n2 n3 direction=right')).toHaveProperty('errors');
    expect(run('{"op":"layout","target":"n1","style":"flow"}')).toHaveProperty('errors');
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
