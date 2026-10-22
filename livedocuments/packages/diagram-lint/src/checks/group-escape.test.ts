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
  });

  it('judges each side, and the first frame on the chain', () => {
    const sides = [box('l', -10, 80), box('t', 40, -10), box('b', 40, 150)];
    expect(
      of(lint(tabOf(frame('f', 0, 0, 200, 200), ...sides)), 'group-escape').map((f) => f.refs[0]),
    ).toEqual(['t', 'l', 'b']);
    // A stack inside the frame: the stack is never judged, the frame is.
    const nested = lint(
      tabOf(
        frame('f', 0, 0, 400, 400),
        frame('stack', 20, 20, 300, 300, 'stack'),
        box('a', 250, 40),
      ),
    );
    expect(of(nested, 'group-escape').map((f) => f.refs)).toEqual([]);
    const outOfFrame = lint(
      tabOf(
        frame('f', 0, 0, 400, 400),
        frame('stack', 20, 20, 300, 300, 'stack'),
        box('a', 330, 40),
      ),
    );
    expect(of(outOfFrame, 'group-escape').map((f) => f.refs)).toEqual([['a', 'f']]);
  });

  it('stays quiet inside, within the tolerance, outside every frame, and in a stack alone', () => {
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
      of(lint(tabOf(frame('stack', 0, 0, 200, 200, 'stack'), box('a', 120, 20))), 'group-escape'),
    ).toEqual([]);
  });
});
