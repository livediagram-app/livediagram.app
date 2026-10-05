import { describe, expect, it } from 'vitest';
import { arrow, box, lint, of, tabOf } from '../fixtures/build';

describe('label-collision', () => {
  it("fires when an arrow's label plate overlaps a box, its own ends included", () => {
    const labelled = arrow('x', 'a', 'b', ['e', 'w'], { label: 'A long label that will not fit' });
    const [f] = of(lint(tabOf(box('a', 0, 0), box('b', 160, 0), labelled)), 'label-collision');
    expect(f).toMatchObject({
      refs: ['x', 'a', 'b'],
      message: 'a→b label overlaps a, b',
      fix: 'set a->b label="<text>"',
    });
    expect(
      of(
        lint(tabOf(box('a', 0, 0), box('b', 160, 0), labelled), { source: 'graph' }),
        'label-collision',
      )[0]!.fix,
    ).toBe('shorten the edge label');
  });

  it('stays quiet for a label clear of every box, and an arrow without one', () => {
    const labelled = arrow('x', 'a', 'b', ['e', 'w'], { label: 'ok' });
    expect(of(lint(tabOf(box('a', 0, 0), box('b', 500, 0), labelled)), 'label-collision')).toEqual(
      [],
    );
    expect(
      of(lint(tabOf(box('a', 0, 0), box('b', 160, 0), arrow('y', 'a', 'b'))), 'label-collision'),
    ).toEqual([]);
  });
});
