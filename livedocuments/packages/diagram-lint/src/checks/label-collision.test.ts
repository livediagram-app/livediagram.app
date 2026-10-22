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
  });

  it('reads lines as drawn, fanned off a shared anchor: a label between two fanned drops is not struck', () => {
    // Two angled lines leave e's bottom together and the renderers fan them apart; x's label sits in the gap between
    // the two drops. Read unfanned, y's drop ran through the label, a strike whose fix never cleared it.
    const big = { width: 400, height: 150 };
    const els = [
      box('e', 560, 610, big),
      box('r', 770, 890, { width: 215, height: 140 }),
      box('c', 535, 890, { width: 215, height: 140 }),
    ];
    const sql = arrow('x', 'e', 'r', ['s', 'n'], { arrowStyle: 'angled', label: 'SQL' });
    const cache = arrow('y', 'e', 'c', ['s', 'n'], { arrowStyle: 'angled' });
    expect(of(lint(tabOf(...els, sql, cache)), 'label-collision')).toEqual([]);
  });

  it('finds the run a label sits on past an earlier run on the same upright', () => {
    // Down x=0, across, back to x=0 and down again: the label sits on the last run, below the first one's end. A
    // line along that run is the label's own track, never a strike.
    const hook = arrow('x', 'a', 'b', ['s', 'n'], {
      arrowStyle: 'angled',
      label: 'go',
      labelOffset: { t: 0.5, offset: 0 },
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 0, y: 800 },
      curvePoints: [
        { dx: 0, dy: -300 },
        { dx: 100, dy: -300 },
        { dx: 100, dy: -200 },
        { dx: 0, dy: -200 },
      ],
    });
    const along = arrow('y', 'a', 'b', ['s', 'n'], {
      from: { kind: 'free', x: 0, y: 250 },
      to: { kind: 'free', x: 0, y: 350 },
    });
    expect(of(lint(tabOf(hook, along)), 'label-collision')).toEqual([]);
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

  it('names both a box and another label a plate overlaps, and fixes it by length', () => {
    const tab = tabOf(
      box('a', 0, 0),
      box('b', 160, 0),
      box('c', 0, 12),
      box('d', 160, 12),
      arrow('x', 'a', 'b', ['e', 'w'], {
        label: 'A long label that will not fit',
        labelOffset: { t: 0.5, offset: 0 },
      }),
      arrow('y', 'c', 'd', ['e', 'w'], {
        label: 'Another long one',
        labelOffset: { t: 0.5, offset: 0 },
      }),
    );
    const [f] = of(lint(tab), 'label-collision');
    expect(f!.message).toMatch(/^a→b label overlaps .*c→d's label/);
    expect(f!.refs).toEqual(expect.arrayContaining(['x', 'y']));
    expect(f!.fix).toMatch(/label="<at most \d+ characters>"/);
  });

  it('shortens a struck label when no spot along its line is clear', () => {
    // Lines drop across a→b every 100 px: wherever its wide plate sits, one strikes it.
    const drops = [150, 250, 350, 450, 550, 650].flatMap((x, i) => [
      box(`t${i}`, x - 60, -300),
      box(`u${i}`, x - 60, 300),
      arrow(`v${i}`, `t${i}`, `u${i}`, ['s', 'n']),
    ]);
    const tab = tabOf(
      box('a', 0, 0),
      box('b', 800, 0),
      arrow('x', 'a', 'b', ['e', 'w'], {
        label: 'a long label of many words across',
        labelOffset: { t: 0.5, offset: 0 },
      }),
      ...drops,
    );
    const [f] = of(lint(tab), 'label-collision').filter((x) => x.refs[0] === 'x');
    expect(f!.message).toMatch(/^a→b label struck by/);
    expect(f!.fix).toMatch(/label="<at most \d+ characters>"/);
  });

  it('moves a label off another label along its own line, rather than shortening it', () => {
    // Two long level arrows a few pixels apart, each label placed at its middle (as the label pass places them): the
    // plates overlap.
    const tab = tabOf(
      box('a', 0, 0),
      box('b', 800, 0),
      box('c', 0, 12),
      box('d', 800, 12),
      arrow('x', 'a', 'b', ['e', 'w'], { label: 'publish', labelOffset: { t: 0.5, offset: 0 } }),
      arrow('y', 'c', 'd', ['e', 'w'], { label: 'consume', labelOffset: { t: 0.5, offset: 0 } }),
    );
    const [f] = of(lint(tab), 'label-collision');
    expect(f!.message).toContain("label overlaps c→d's label");
    expect(f!.fix).toMatch(/^set a->b labelOffset=\{"t":0\.\d+,"offset":0\}$/);
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
