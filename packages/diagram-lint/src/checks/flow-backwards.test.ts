import { describe, expect, it } from 'vitest';
import { arrow, box, lint, of, tabOf } from '../fixtures/build';

// Three arrows down a column, and one back up.
const column = () => [box('a', 0, 0), box('b', 0, 200), box('c', 0, 400), box('d', 0, 600)];
const down = () => [
  arrow('1', 'a', 'b', ['s', 'n']),
  arrow('2', 'b', 'c', ['s', 'n']),
  arrow('3', 'c', 'd', ['s', 'n']),
];

describe('flow-backwards', () => {
  it('fires on a directed arrow against the inferred flow', () => {
    const report = lint(tabOf(...column(), ...down(), arrow('back', 'd', 'a', ['n', 's'])));
    expect(of(report, 'flow-backwards')).toEqual([
      {
        code: 'flow-backwards',
        severity: 'info',
        refs: ['back'],
        message: 'd→a points up, against the flow down',
        fix: 'rewire back from=a to=d',
      },
    ]);
  });

  it('reads an arrow drawn from its from end the other way round, and skips undirected ones', () => {
    const reversed = arrow('rev', 'a', 'd', ['s', 'n'], { arrowEnds: 'from' });
    const both = arrow('both', 'd', 'a', ['n', 's'], { arrowEnds: 'both' });
    expect(
      of(lint(tabOf(...column(), ...down(), reversed, both)), 'flow-backwards').map(
        (f) => f.refs[0],
      ),
    ).toEqual(['rev']);
  });

  it('takes a graph source\x27s direction, every flow, and says reverse the edge', () => {
    const row = [box('a', 0, 0), box('b', 300, 0), arrow('x', 'b', 'a', ['w', 'e'])];
    expect(
      of(lint(tabOf(...row), { source: 'graph', flow: 'right' }), 'flow-backwards')[0],
    ).toMatchObject({
      message: 'b→a points left, against the flow right',
      fix: 'reverse the edge, unless it is a loop',
    });
    const left = [box('a', 900, 0), box('b', 600, 0), box('c', 300, 0), box('d', 0, 0)];
    const leftArrows = [
      arrow('1', 'a', 'b', ['w', 'e']),
      arrow('2', 'b', 'c', ['w', 'e']),
      arrow('3', 'c', 'd', ['w', 'e']),
      arrow('back', 'd', 'a', ['e', 'w']),
    ];
    expect(of(lint(tabOf(...left, ...leftArrows)), 'flow-backwards')[0]!.message).toBe(
      'd→a points right, against the flow left',
    );
    const up = [box('a', 0, 600), box('b', 0, 400), box('c', 0, 200), box('d', 0, 0)];
    const upArrows = [
      arrow('1', 'a', 'b', ['n', 's']),
      arrow('2', 'b', 'c', ['n', 's']),
      arrow('3', 'c', 'd', ['n', 's']),
      arrow('back', 'd', 'a', ['s', 'n']),
    ];
    expect(of(lint(tabOf(...up, ...upArrows)), 'flow-backwards')[0]!.message).toBe(
      'd→a points down, against the flow up',
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
});
