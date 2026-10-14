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

  it('fires when another line strikes the label through, moving it along its own line to a clear spot', () => {
    const labelled = arrow('x', 'a', 'b', ['e', 'w'], { label: 'go' });
    // c drops straight through the middle of a→b, where its label sits.
    const tab = tabOf(
      box('a', 0, 0),
      box('b', 800, 0),
      box('c', 396, -200),
      box('d', 396, 200),
      labelled,
      arrow('y', 'c', 'd', ['s', 'n']),
    );
    const [f] = of(lint(tab), 'label-collision');
    expect(f).toMatchObject({
      refs: ['x', 'y'],
      message: 'a→b label struck by c→d',
      fix: 'set a->b labelOffset={"t":0.25,"offset":0}',
    });
    // A line along the label's own track, as a bus, is its own line: no strike. (Into a second box on the same
    // spot, so no fan spreads the two ends apart.)
    const bus = tabOf(
      box('a', 0, 0),
      box('b', 800, 0),
      box('b2', 800, 0),
      box('e', -200, 0),
      labelled,
      arrow('z', 'e', 'b2', ['e', 'w']),
    );
    expect(of(lint(bus), 'label-collision')).toEqual([]);
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
