import { describe, expect, it } from 'vitest';
import { countPlanShapes, readPlanShapes, timelineAxis } from './read-shapes';
import { arrow, box, lane, sticky, text } from './test-elements';

// docs/specs/013-workspace/make-plan-cards.md "What becomes what": shapes and stickies with words become cards; an
// arrow is Blocked By (its head waits on its tail); the lane holding a shape names its column or label; dates come from
// the words, else from the timeline's axis. A plan's own drawing is never read back.
const today = new Date(2026, 10, 23);

describe('readPlanShapes', () => {
  it('reads shapes and stickies with words, in reading order, never lanes, frames, blanks or drawn cards', () => {
    const shapes = readPlanShapes(
      [
        lane('L2', 'Doing', { x: 0, y: 200, width: 600, height: 150 }),
        lane('L1', 'To Do\nsecond line', { x: 0, y: 0, width: 600, height: 150 }),
        box('b', 'Build', { x: 200, y: 220 }),
        sticky('a', 'Design', { x: 300, y: 10 }),
        box('c', 'Research', { x: 20, y: 10 }),
        box('blank', '  '),
        box('card:todo:x', 'Drawn by the plan'),
        box('rail', 'Rail', {}, 'timeline-rail'),
        box('loose', 'Loose', { x: 900, y: 900 }),
      ],
      { today },
    );
    expect(shapes.map((s) => [s.element, s.lane])).toEqual([
      ['loose', undefined],
      ['b', 'Doing'],
      ['c', 'To Do'],
      ['a', 'To Do'],
    ]);
  });

  it('puts a shape in the smallest lane or frame holding its centre', () => {
    const [s] = readPlanShapes(
      [
        box('F', 'Big frame', { x: 0, y: 0, width: 1000, height: 1000 }, 'frame'),
        lane('L', 'Small', { x: 0, y: 0, width: 300, height: 200 }),
        box('s', 'Inside', { x: 10, y: 10 }),
      ],
      { today },
    );
    expect(s!.lane).toBe('Small');
  });

  it('reads an arrow as Blocked By, either way round, never both-ended or headless, a self loop or a dropped shape', () => {
    const shapes = readPlanShapes(
      [
        box('a', 'A'),
        box('b', 'B', { x: 200 }),
        box('c', 'C', { x: 400 }),
        box('d', 'D', { x: 600 }),
        arrow('1', 'a', 'b'),
        arrow('1b', 'a', 'b'),
        arrow('2', 'c', 'b', { arrowEnds: 'from' }),
        arrow('3', 'c', 'd', { arrowEnds: 'both' }),
        arrow('3n', 'b', 'a', { arrowEnds: 'none' }),
        arrow('4', 'd', 'd'),
        arrow('5', 'd', 'c'),
        arrow('free', 'a', 'c', { to: { kind: 'free', x: 0, y: 0 } }),
      ],
      { today, only: new Set(['a', 'b', 'c']) },
    );
    const by = Object.fromEntries(shapes.map((s) => [s.element, s.blockedBy]));
    expect(by).toEqual({ a: [], b: ['a'], c: ['b'] });
  });

  it('dates a shape from its words: a span, then a due day', () => {
    const shapes = readPlanShapes(
      [
        box('a', 'Design 1 Dec to 12 Dec'),
        box('b', 'Ship by 20 Dec', { x: 200 }),
        box('c', 'Undated', { x: 400 }),
      ],
      { today },
    );
    expect(shapes[0]).toMatchObject({ title: 'Design', start: '2026-12-01', due: '2026-12-12' });
    expect(shapes[1]).toMatchObject({ title: 'Ship', due: '2026-12-20' });
    expect(shapes[1]!.start).toBeUndefined();
    expect(shapes[2]!.due).toBeUndefined();
  });

  it('dates an undated shape on a timeline from where it stands against the axis', () => {
    const shapes = readPlanShapes(
      [
        text('t1', '1 Dec', { x: -30, y: 0 }),
        text('t2', '31 Dec', { x: 270, y: 0 }),
        box('a', 'Build', { x: 0, y: 50, width: 100 }),
        box('b', 'Dated 5 Dec', { x: 0, y: 50, width: 100 }),
      ],
      { today },
    );
    expect(shapes.find((s) => s.element === 'a')).toMatchObject({
      start: '2026-12-01',
      due: '2026-12-11',
    });
    expect(shapes.find((s) => s.element === 'b')!.start).toBeUndefined();
  });
});

describe('timelineAxis', () => {
  it('needs two dates written apart, running forward', () => {
    expect(timelineAxis([text('t', '1 Dec')], today)).toBeNull();
    expect(timelineAxis([text('t', '1 Dec'), text('u', '2 Dec', { x: 10 })], today)).toBeNull();
    expect(timelineAxis([text('t', '9 Dec'), text('u', '2 Dec', { x: 300 })], today)).toBeNull();
    const axis = timelineAxis(
      [text('t', '1 Dec'), text('u', '11 Dec', { x: 100 }), box('n', 'Not a date')],
      today,
    )!;
    expect(axis(30)).toBe('2026-12-01');
    expect(axis(80)).toBe('2026-12-06');
  });
});

describe('countPlanShapes', () => {
  it('counts candidates only as far as asked', () => {
    const many = [
      box('a', 'A'),
      box('b', 'B'),
      box('c', 'C'),
      lane('l', 'Lane', { width: 9, height: 9 }),
    ];
    expect(countPlanShapes(many, 2)).toBe(2);
    expect(countPlanShapes(many, 10)).toBe(3);
  });
});
