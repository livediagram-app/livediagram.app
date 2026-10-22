import { describe, expect, it } from 'vitest';
import { arrow, box, lint, of, tabOf } from '../fixtures/build';

describe('arrow-behind-box', () => {
  it('fires on an arrow through a box it does not connect, listing every such box', () => {
    const report = lint(
      tabOf(
        box('a', 0, 0),
        box('m', 200, 0),
        box('n', 400, 0),
        box('b', 600, 0),
        arrow('x', 'a', 'b'),
      ),
    );
    expect(of(report, 'arrow-behind-box')).toEqual([
      {
        code: 'arrow-behind-box',
        severity: 'warning',
        refs: ['x', 'm', 'n'],
        message: 'a→b passes behind m, n',
        // No style clears two boxes in line with both ends: move the first off the line, the shorter way.
        fix: 'move m by=0,46',
      },
    ]);
    expect(report.measures.behind).toBe(1);
  });

  it('suggests a style only when its route clears every box, else a move, per arrow', () => {
    // A diagonal through m: angled goes round it.
    const diagonal = arrow('x', 'a', 'b', ['s', 'w']);
    expect(
      of(
        lint(tabOf(box('a', 0, 0), box('m', 200, 100), box('b', 500, 300), diagonal)),
        'arrow-behind-box',
      )[0]!.fix,
    ).toBe('set a->b line=angled');
    // Angled and level, nothing clears m: a move, never curved and back again.
    const angled = arrow('x', 'a', 'b', ['e', 'w'], { arrowStyle: 'angled' });
    expect(
      of(
        lint(tabOf(box('a', 0, 0), box('m', 200, 0), box('b', 400, 0), angled)),
        'arrow-behind-box',
      )[0]!.fix,
    ).toBe('move m by=0,46');
    const twice = lint(
      tabOf(
        box('a', 0, 0),
        box('m', 200, 0),
        box('b', 400, 0),
        arrow('x', 'a', 'b'),
        arrow('y', 'a', 'b'),
      ),
    );
    // Two arrows on one anchor are drawn fanned apart, so each clears m its own way.
    expect(of(twice, 'arrow-behind-box').map((f) => f.fix)).toEqual([
      'move m by=0,39',
      'move m by=0,-39',
    ]);
  });

  it('names an arrow with a free end by its ref', () => {
    const half = { ...arrow('x', 'a', 'b'), to: { kind: 'free', x: 500, y: 30 } } as never;
    expect(
      of(lint(tabOf(box('a', 0, 0), box('m', 200, 0), half)), 'arrow-behind-box')[0]!.message,
    ).toBe('x passes behind m');
  });

  it('stays quiet for an arrow between neighbours, and never counts its own ends', () => {
    expect(
      of(lint(tabOf(box('a', 0, 0), box('b', 300, 0), arrow('x', 'a', 'b'))), 'arrow-behind-box'),
    ).toEqual([]);
  });
});
