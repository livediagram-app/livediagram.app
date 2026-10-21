import { describe, expect, it } from 'vitest';
import { box, frame, lint, of, tabOf } from '../fixtures/build';

describe('group-escape', () => {
  it('fires on a member reaching past its frame, by the centre rule', () => {
    const report = lint(tabOf(frame('f', 0, 0, 200, 200), box('a', 120, 20)));
    expect(of(report, 'group-escape')).toEqual([
      {
        code: 'group-escape',
        severity: 'warning',
        refs: ['a', 'f'],
        message: 'a sticks out of f',
        fix: 'move a inside:f',
      },
    ]);
    expect(
      of(
        lint(tabOf(frame('f', 0, 0, 200, 200), box('a', 120, 20)), { source: 'graph' }),
        'group-escape',
      )[0]!.fix,
    ).toBe('drop the group');
  });

  it('judges each side, and the first frame on the chain', () => {
    const sides = [box('l', -10, 80), box('t', 40, -10), box('b', 40, 150)];
    expect(
      of(lint(tabOf(frame('f', 0, 0, 200, 200), ...sides)), 'group-escape').map((f) => f.refs[0]),
    ).toEqual(['t', 'l', 'b']);
    // A lane inside the frame: the lane is never judged, the frame is.
    const nested = lint(
      tabOf(frame('f', 0, 0, 400, 400), frame('lane', 20, 20, 300, 300, 'lane'), box('a', 250, 40)),
    );
    expect(of(nested, 'group-escape').map((f) => f.refs)).toEqual([]);
    const outOfFrame = lint(
      tabOf(frame('f', 0, 0, 400, 400), frame('lane', 20, 20, 300, 300, 'lane'), box('a', 330, 40)),
    );
    expect(of(outOfFrame, 'group-escape').map((f) => f.refs)).toEqual([['a', 'f']]);
  });

  it('stays quiet inside, within the tolerance, outside every frame, and in a lane alone', () => {
    expect(of(lint(tabOf(frame('f', 0, 0, 200, 200), box('a', 40, 40))), 'group-escape')).toEqual(
      [],
    );
    expect(of(lint(tabOf(frame('f', 0, 0, 200, 200), box('a', 81, 40))), 'group-escape')).toEqual(
      [],
    );
    expect(of(lint(tabOf(frame('f', 0, 0, 200, 200), box('a', 400, 40))), 'group-escape')).toEqual(
      [],
    );
    expect(
      of(lint(tabOf(frame('lane', 0, 0, 200, 200, 'lane'), box('a', 120, 20))), 'group-escape'),
    ).toEqual([]);
  });
});
