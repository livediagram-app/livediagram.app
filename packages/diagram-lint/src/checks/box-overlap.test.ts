import { describe, expect, it } from 'vitest';
import { box, lint, of, tabOf } from '../fixtures/build';

describe('box-overlap', () => {
  it('fires on two boxes that partly overlap, naming both, the earlier first', () => {
    const [f] = of(lint(tabOf(box('a', 0, 0), box('b', 60, 20))), 'box-overlap');
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
    expect(of(lint(tabOf(box('a', 0, 0), b)), 'box-overlap')).toHaveLength(1);
    expect(of(lint(tabOf(box('a', 0, 0), { ...b, rotation: 0 } as never)), 'box-overlap')).toEqual(
      [],
    );
  });

  it('suggests a graph source compare', () => {
    expect(
      of(lint(tabOf(box('a', 0, 0), box('b', 60, 20)), { source: 'graph' }), 'box-overlap')[0]!.fix,
    ).toBe('graph lint --compare direction,groups');
  });
});
