import { describe, expect, it } from 'vitest';
import { arrow, box, lint, of, tabOf } from '../fixtures/build';

describe('node-isolated', () => {
  it('fires on a shape with no arrows on a tab that is otherwise a graph', () => {
    const report = lint(
      tabOf(box('a', 0, 0), box('b', 300, 0), arrow('x', 'a', 'b'), box('alone', 0, 200)),
    );
    expect(of(report, 'node-isolated')).toEqual([
      {
        code: 'node-isolated',
        severity: 'warning',
        refs: ['alone'],
        message: 'alone has no arrows',
        fix: 'connect <ref> -> alone',
      },
    ]);
  });

  it("skips an unlabelled shape: a key's sample or a card is decoration", () => {
    const sample = { ...box('sample', 0, 200), label: '' } as never;
    expect(
      of(
        lint(tabOf(box('a', 0, 0), box('b', 300, 0), arrow('x', 'a', 'b'), sample)),
        'node-isolated',
      ),
    ).toEqual([]);
  });

  it("skips the hub of a ring of connected boxes: a cycle's theme at its centre", () => {
    const ring = [box('n', 200, 0), box('e', 400, 200), box('s', 200, 400), box('w', 0, 200)];
    const loop = [
      arrow('1', 'n', 'e'),
      arrow('2', 'e', 's'),
      arrow('3', 's', 'w'),
      arrow('4', 'w', 'n'),
    ];
    expect(of(lint(tabOf(...ring, ...loop, box('hub', 200, 200))), 'node-isolated')).toEqual([]);
    // Off centre, it is a node left out again.
    expect(
      of(lint(tabOf(...ring, ...loop, box('stray', 900, 900))), 'node-isolated').map(
        (f) => f.refs[0],
      ),
    ).toEqual(['stray']);
  });

  it('judges shapes only, and only when most boxes are connected', () => {
    const sticky = { ...box('note', 0, 200), type: 'sticky' } as never;
    expect(
      of(
        lint(tabOf(box('a', 0, 0), box('b', 300, 0), arrow('x', 'a', 'b'), sticky)),
        'node-isolated',
      ),
    ).toEqual([]);
    expect(
      of(
        lint(
          tabOf(
            box('a', 0, 0),
            box('b', 300, 0),
            arrow('x', 'a', 'b'),
            box('c', 0, 200),
            box('d', 0, 400),
            box('e', 0, 600),
          ),
        ),
        'node-isolated',
      ),
    ).toEqual([]);
    expect(of(lint(tabOf(box('a', 0, 0), box('b', 300, 0))), 'node-isolated')).toEqual([]);
  });

  it('counts a box touched by a half-free arrow as touched', () => {
    const half = { ...arrow('y', 'c', 'b'), to: { kind: 'free', x: 900, y: 0 } } as never;
    expect(
      of(
        lint(tabOf(box('a', 0, 0), box('b', 300, 0), arrow('x', 'a', 'b'), box('c', 0, 200), half)),
        'node-isolated',
      ),
    ).toEqual([]);
  });
});
