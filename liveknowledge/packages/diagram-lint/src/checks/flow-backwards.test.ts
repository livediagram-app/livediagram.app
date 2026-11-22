import { describe, expect, it } from 'vitest';
import { arrow, box, lint, of, tabOf } from '../fixtures/build';

// Three arrows down a column, and one back up to a box above it: against the flow, but not a loop (nothing leads
// from that box back down).
const column = () => [
  box('a', 0, 0),
  box('b', 0, 200),
  box('c', 0, 400),
  box('d', 0, 600),
  box('top', 300, -200),
];
const down = () => [
  arrow('1', 'a', 'b', ['s', 'n']),
  arrow('2', 'b', 'c', ['s', 'n']),
  arrow('3', 'c', 'd', ['s', 'n']),
];

describe('flow-backwards', () => {
  it('fires on a directed arrow against the inferred flow', () => {
    const report = lint(tabOf(...column(), ...down(), arrow('back', 'd', 'top', ['n', 's'])));
    expect(of(report, 'flow-backwards')).toEqual([
      {
        code: 'flow-backwards',
        severity: 'info',
        refs: ['back'],
        message: 'd→top points up, against the flow down',
        fix: 'rewire back from=top to=d',
      },
    ]);
  });

  it('stays quiet on an arrow that closes a loop: a retry runs back by design', () => {
    const report = lint(tabOf(...column(), ...down(), arrow('retry', 'd', 'a', ['n', 's'])));
    expect(of(report, 'flow-backwards')).toEqual([]);
  });

  it('reads an arrow drawn from its from end the other way round, and skips undirected ones', () => {
    const reversed = arrow('rev', 'top', 'd', ['s', 'n'], { arrowEnds: 'from' });
    const both = arrow('both', 'd', 'top', ['n', 's'], { arrowEnds: 'both' });
    expect(
      of(lint(tabOf(...column(), ...down(), reversed, both)), 'flow-backwards').map(
        (f) => f.refs[0],
      ),
    ).toEqual(['rev']);
  });

  it('takes a given direction, every flow, and says rewire the arrow', () => {
    const row = [box('a', 0, 0), box('b', 300, 0), arrow('x', 'b', 'a', ['w', 'e'])];
    expect(of(lint(tabOf(...row), { flow: 'right' }), 'flow-backwards')[0]).toMatchObject({
      message: 'b→a points left, against the flow right',
      fix: 'rewire x from=a to=b',
    });
    const left = [
      box('a', 900, 0),
      box('b', 600, 0),
      box('c', 300, 0),
      box('d', 0, 0),
      box('end', 1200, 200),
    ];
    const leftArrows = [
      arrow('1', 'a', 'b', ['w', 'e']),
      arrow('2', 'b', 'c', ['w', 'e']),
      arrow('3', 'c', 'd', ['w', 'e']),
      arrow('back', 'd', 'end', ['e', 'w']),
    ];
    expect(of(lint(tabOf(...left, ...leftArrows)), 'flow-backwards')[0]!.message).toBe(
      'd→end points right, against the flow left',
    );
    const up = [
      box('a', 0, 600),
      box('b', 0, 400),
      box('c', 0, 200),
      box('d', 0, 0),
      box('end', 300, 800),
    ];
    const upArrows = [
      arrow('1', 'a', 'b', ['n', 's']),
      arrow('2', 'b', 'c', ['n', 's']),
      arrow('3', 'c', 'd', ['n', 's']),
      arrow('back', 'd', 'end', ['s', 'n']),
    ];
    expect(of(lint(tabOf(...up, ...upArrows)), 'flow-backwards')[0]!.message).toBe(
      'd→end points down, against the flow up',
    );
  });

  it('stays quiet without a clear flow, or within the tolerance sideways', () => {
    expect(
      of(
        lint(
          tabOf(...column(), arrow('1', 'a', 'b', ['s', 'n']), arrow('back', 'c', 'b', ['n', 's'])),
        ),
        'flow-backwards',
      ),
    ).toEqual([]);
    const mixed = [
      ...column(),
      box('e', 300, 0),
      arrow('1', 'a', 'b', ['s', 'n']),
      arrow('2', 'b', 'c', ['s', 'n']),
      arrow('3', 'a', 'e'),
      arrow('4', 'b', 'e'),
      arrow('5', 'd', 'e', ['n', 's']),
    ];
    expect(of(lint(tabOf(...mixed)), 'flow-backwards').map((f) => f.refs[0])).toEqual([]);
    const sideways = [
      ...column(),
      box('b2', 4, 200),
      ...down(),
      arrow('side', 'b2', 'b', ['w', 'e']),
    ];
    expect(of(lint(tabOf(...sideways)), 'flow-backwards')).toEqual([]);
  });

  it('follows a branch that rejoins only once when it asks whether an arrow closes a loop', () => {
    // top leads to r two ways, and never back down to d: back still runs against the flow.
    const diamond = [
      box('p', 600, 0),
      box('q', 900, 0),
      box('r', 750, 400),
      arrow('tp', 'top', 'p', ['s', 'n']),
      arrow('tq', 'top', 'q', ['s', 'n']),
      arrow('pr', 'p', 'r', ['s', 'n']),
      arrow('qr', 'q', 'r', ['s', 'n']),
    ];
    const report = lint(
      tabOf(...column(), ...down(), ...diamond, arrow('back', 'd', 'top', ['n', 's'])),
    );
    expect(of(report, 'flow-backwards').map((f) => f.refs[0])).toEqual(['back']);
  });
});
