import { describe, expect, it } from 'vitest';
import { arrow, box, lint, of, tabOf } from '../fixtures/build';

describe('box-overlap', () => {
  it('fires on two boxes that partly overlap, naming both, the earlier first', () => {
    const [f] = of(
      lint(tabOf(box('a', 0, 0), box('b', 60, 20), arrow('x', 'a', 'b'))),
      'box-overlap',
    );
    expect(f).toEqual({
      code: 'box-overlap',
      severity: 'error',
      refs: ['a', 'b'],
      message: 'a overlaps b',
      fix: 'move b right-of:a',
    });
  });

  it('stays quiet for boxes that only touch, sit apart, or one holds the other wholly (N12)', () => {
    expect(of(lint(tabOf(box('a', 0, 0), box('b', 120, 0))), 'box-overlap')).toEqual([]);
    expect(of(lint(tabOf(box('a', 0, 0), box('b', 300, 0))), 'box-overlap')).toEqual([]);
    const icon = box('icon', 10, 10, { width: 30, height: 30 });
    expect(of(lint(tabOf(box('a', 0, 0), icon)), 'box-overlap')).toEqual([]);
  });

  it('measures rotated boxes as drawn', () => {
    // Rotated 45°, b's corner reaches into a; unrotated it would not.
    const b = box('b', 125, 0, { width: 60, height: 60, rotation: 45 });
    const joined = arrow('x', 'a', 'b');
    expect(of(lint(tabOf(box('a', 0, 0), b, joined)), 'box-overlap')).toHaveLength(1);
    const flat = { ...b, rotation: 0 } as never;
    expect(of(lint(tabOf(box('a', 0, 0), flat, joined)), 'box-overlap')).toEqual([]);
  });

  it('leaves decoration alone: boxes no arrow connects may overlap by design', () => {
    const venn = [box('p', 0, 0, { shape: 'circle' }), box('q', 60, 0, { shape: 'circle' })];
    expect(of(lint(tabOf(...venn)), 'box-overlap')).toEqual([]);
    const badge = box('badge', 100, -10, { width: 40, height: 40 });
    const graph = [box('a', 0, 0), box('b', 300, 0), arrow('x', 'a', 'b'), badge];
    expect(of(lint(tabOf(...graph)), 'box-overlap')).toEqual([]);
  });

  it('suggests a graph source compare', () => {
    expect(
      of(
        lint(tabOf(box('a', 0, 0), box('b', 60, 20), arrow('x', 'a', 'b')), { source: 'graph' }),
        'box-overlap',
      )[0]!.fix,
    ).toBe('graph lint --compare direction,groups');
  });
});
