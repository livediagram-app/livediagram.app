import { describe, expect, it } from 'vitest';
import { arrow, box, frame, lint, of, tabOf } from '../fixtures/build';

const core = () => [frame('core', 0, 0, 200, 400), box('a', 40, 40), box('b', 40, 300)];

describe('group-split-edges', () => {
  it('fires when most of a frame\x27s arrows cross its border', () => {
    const outside = [box('x', 400, 40), box('y', 400, 300), box('z', 400, 500)];
    const report = lint(
      tabOf(
        ...core(),
        ...outside,
        arrow('1', 'a', 'x'),
        arrow('2', 'b', 'y'),
        arrow('3', 'a', 'z'),
      ),
    );
    expect(of(report, 'group-split-edges')).toEqual([
      {
        code: 'group-split-edges',
        severity: 'info',
        refs: ['core'],
        message: 'core: 3 of 3 arrows cross its border',
        fix: 'unwrap core',
      },
    ]);
    expect(
      of(
        lint(
          tabOf(
            ...core(),
            ...outside,
            arrow('1', 'a', 'x'),
            arrow('2', 'b', 'y'),
            arrow('3', 'a', 'z'),
          ),
          { source: 'graph' },
        ),
        'group-split-edges',
      )[0]!.fix,
    ).toBe('group by ownership, or drop the groups');
  });

  it('stays quiet under three arrows, when most stay inside, and for a lane', () => {
    expect(
      of(
        lint(tabOf(...core(), box('x', 400, 40), arrow('1', 'a', 'x'), arrow('2', 'b', 'x'))),
        'group-split-edges',
      ),
    ).toEqual([]);
    const inside = [
      box('c', 40, 160),
      arrow('1', 'a', 'b', ['s', 'n']),
      arrow('2', 'a', 'c', ['s', 'n']),
      arrow('3', 'c', 'b', ['s', 'n']),
    ];
    expect(
      of(
        lint(tabOf(...core(), ...inside, box('x', 400, 40), arrow('4', 'a', 'x'))),
        'group-split-edges',
      ),
    ).toEqual([]);
    const lane = [
      frame('lane', 0, 0, 200, 400, 'lane'),
      box('a', 40, 40),
      box('x', 400, 40),
      box('y', 400, 300),
      box('z', 400, 500),
    ];
    expect(
      of(
        lint(tabOf(...lane, arrow('1', 'a', 'x'), arrow('2', 'a', 'y'), arrow('3', 'a', 'z'))),
        'group-split-edges',
      ),
    ).toEqual([]);
  });

  it('counts an inner frame\x27s members for the outer frame (N13)', () => {
    const nested = [
      frame('outer', 0, 0, 300, 400),
      frame('inner', 20, 20, 200, 200),
      box('a', 40, 40),
    ];
    const outside = [box('x', 500, 40), box('y', 500, 300), box('z', 500, 500)];
    const report = lint(
      tabOf(
        ...nested,
        ...outside,
        arrow('1', 'a', 'x'),
        arrow('2', 'a', 'y'),
        arrow('3', 'a', 'z'),
      ),
    );
    expect(of(report, 'group-split-edges').map((f) => f.refs[0])).toEqual(['outer', 'inner']);
  });
});
