import { describe, expect, it } from 'vitest';
import { arrow, box, lint, of, tabOf } from '../fixtures/build';

describe('label-collision', () => {
  it("fires when an arrow's label plate overlaps a box, its own ends included", () => {
    const labelled = arrow('x', 'a', 'b', ['e', 'w'], { label: 'A long label that will not fit' });
    const [f] = of(lint(tabOf(box('a', 0, 0), box('b', 160, 0), labelled)), 'label-collision');
    expect(f).toMatchObject({
      refs: ['x', 'a', 'b'],
      message: 'a→b label overlaps a, b',
      fix: 'set a->b label="<at most 3 characters>"',
    });
    expect(
      of(
        lint(tabOf(box('a', 0, 0), box('b', 160, 0), labelled), { source: 'graph' }),
        'label-collision',
      )[0]!.fix,
    ).toBe('shorten the edge label to 3 characters');
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

  it("fires when two arrows' labels overlap each other, once per pair", () => {
    // Two lines on one route with their labels on the same spot.
    const a = arrow('y', 'd', 'p', ['e', 'w'], {
      label: 'Accept',
      labelOffset: { t: 0.5, offset: 0 },
    });
    const b = arrow('n', 'd', 'p', ['e', 'w'], {
      label: 'Decline',
      labelOffset: { t: 0.5, offset: 0 },
    });
    const found = of(lint(tabOf(box('d', 0, 100), box('p', 600, 100), a, b)), 'label-collision');
    expect(found).toHaveLength(1);
    expect(found[0]!.refs).toEqual(['y', 'n']);
    expect(found[0]!.message).toMatch(/label overlaps .*'s label/);
  });
});
