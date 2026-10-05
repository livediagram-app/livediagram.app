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
    expect(
      of(
        lint(tabOf(box('a', 0, 0), box('b', 300, 0), arrow('x', 'a', 'b'), box('alone', 0, 200)), {
          source: 'graph',
        }),
        'node-isolated',
      )[0]!.fix,
    ).toBe('add an edge to alone, or drop it');
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
