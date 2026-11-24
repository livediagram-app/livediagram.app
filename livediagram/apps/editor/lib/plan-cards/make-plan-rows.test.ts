import {
  PLAN_MAKE_CARDS_MAX,
  PLAN_MAKE_LABEL_MAX,
  PLAN_MAKE_TEXT_MAX,
  PLAN_MAKE_TITLE_MAX,
  planSendRef,
  type PlanSend,
} from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { defaultLaneMode, makeAsk, makePreview, type MakeShape } from './make-plan-rows';

// docs/specs/013-workspace/make-plan-cards.md "The preview" and "Making again": each shape a row saying where it lands
// and what it waits on; a shape sent before updates its card; links that would close a loop are counted and left out;
// removed shapes' cards in this plan are offered for the Trash.
const shape = (element: string, over: Partial<MakeShape> = {}): MakeShape => ({
  element,
  title: `T ${element}`,
  text: `T ${element}`,
  blockedBy: [],
  ...over,
});
const send = (element: string, plan = 'P'): PlanSend => ({
  id: `s-${element}`,
  ref: planSendRef({ kind: 'element', tabId: 'tab', elementId: element, part: null }),
  kind: 'element',
  plan: { id: plan, title: 'Plan' },
  card: { id: `card-${element}`, title: 'Card', column: 'To Do', done: false },
  link: 'https://lp.test',
  at: 1,
});
const COLUMNS = ['To Do', 'Doing'];
const all = (shapes: MakeShape[]) => new Set(shapes.map((s) => s.element));

describe('defaultLaneMode', () => {
  it('is Columns when a lane is a column, else Labels, else none', () => {
    expect(defaultLaneMode([shape('a')], COLUMNS)).toBe('none');
    expect(defaultLaneMode([shape('a', { lane: 'doing ' })], COLUMNS)).toBe('columns');
    expect(defaultLaneMode([shape('a', { lane: 'Design' })], COLUMNS)).toBe('labels');
  });
});

describe('makePreview', () => {
  const shapes = [
    shape('a', { lane: 'Doing', start: '2026-12-01', due: '2026-12-02' }),
    shape('b', { lane: 'Elsewhere', blockedBy: ['a', 'a', 'b', 'gone'] }),
    shape('c', { blockedBy: ['b'] }),
    shape('d', { blockedBy: ['c'] }),
  ];
  // A loop: a waits on d, which waits (through c and b) on a.
  shapes[0]!.blockedBy = ['d'];

  it('lists each row: where it lands, its dates, what it waits on, what it updates; a loop counted once', () => {
    const p = makePreview({
      shapes,
      ticked: all(shapes),
      laneMode: 'columns',
      columns: COLUMNS,
      planId: 'P',
      tabId: 'tab',
      sends: [send('a'), send('a'), send('c', 'Other')],
      removed: [{ send: send('x') }, { send: send('y', 'Other') }],
    });
    expect(p.rows[0]).toMatchObject({
      lands: { kind: 'column', name: 'Doing', matched: true },
      start: '2026-12-01',
      due: '2026-12-02',
      updates: { id: 's-a' },
    });
    expect(p.rows[1]!.lands).toEqual({ kind: 'column', name: 'Elsewhere', matched: false });
    expect(p.rows[2]).toMatchObject({ lands: { kind: 'picked' }, waits: 1, updates: null });
    expect([p.made, p.updated, p.links, p.loops, p.cut]).toEqual([3, 1, 3, 1, 0]);
    expect(p.removed.map((s) => s.id)).toEqual(['s-x']);
  });

  it('lands lanes as labels, counts nothing unticked, and offers nothing without a plan', () => {
    const p = makePreview({
      shapes,
      ticked: new Set(['b']),
      laneMode: 'labels',
      columns: COLUMNS,
      planId: null,
      tabId: 'tab',
      sends: [send('a')],
      removed: [{ send: send('x') }],
    });
    expect(p.rows[1]).toMatchObject({
      ticked: true,
      lands: { kind: 'label', name: 'Elsewhere' },
      waits: 0,
    });
    expect(p.rows[0]).toMatchObject({ ticked: false, waits: 0, updates: null });
    expect([p.made, p.updated, p.links, p.removed.length]).toEqual([1, 0, 0, 0]);
  });

  it(`cuts past ${PLAN_MAKE_CARDS_MAX} shapes`, () => {
    const many = Array.from({ length: PLAN_MAKE_CARDS_MAX + 4 }, (_, i) => shape(`s${i}`));
    const p = makePreview({
      shapes: many,
      ticked: all(many),
      laneMode: 'none',
      columns: [],
      planId: 'P',
      tabId: 't',
      sends: [],
      removed: [],
    });
    expect(p.rows).toHaveLength(PLAN_MAKE_CARDS_MAX);
    expect(p.cut).toBe(4);
  });
});

describe('makeAsk', () => {
  it('sends ticked shapes clipped, their kept links, the lane as a column or label, and the removed ticked', () => {
    const long = 'x'.repeat(PLAN_MAKE_TEXT_MAX + 5);
    const lanes = 'L'.repeat(PLAN_MAKE_LABEL_MAX + 5);
    const shapes = [
      shape('a', {
        title: 'y'.repeat(PLAN_MAKE_TITLE_MAX + 5),
        text: long,
        lane: ' doing ',
        due: '2026-12-02',
      }),
      shape('b', { lane: lanes, start: '2026-12-01', blockedBy: ['a'] }),
      shape('c', { blockedBy: ['b'] }),
    ];
    const base = {
      shapes,
      removedTicked: new Set<string>(),
      columns: COLUMNS,
      board: 'b1',
      column: 'To Do',
      source: { itemId: 'D', tabId: 'tab', label: 'Roadmap' },
    };
    const asColumns = makeAsk({
      ...base,
      ticked: new Set(['a', 'b']),
      laneMode: 'columns',
      removedTicked: new Set(['card-x']),
    });
    expect(asColumns.cards).toHaveLength(2);
    expect(asColumns.cards[0]!.title).toHaveLength(PLAN_MAKE_TITLE_MAX);
    expect(asColumns.cards[0]!.text).toHaveLength(PLAN_MAKE_TEXT_MAX);
    expect(asColumns.cards[0]).toMatchObject({ column: 'Doing', due: '2026-12-02' });
    expect(asColumns.cards[1]).toMatchObject({ start: '2026-12-01', blockedBy: ['a'] });
    expect(asColumns.cards[1]!.column).toBeUndefined();
    expect(asColumns.trash).toEqual(['card-x']);

    const asLabels = makeAsk({ ...base, ticked: all(shapes), laneMode: 'labels' });
    expect(asLabels.cards[1]!.labels).toEqual(['L'.repeat(PLAN_MAKE_LABEL_MAX)]);
    expect(asLabels.cards[0]!.labels).toEqual(['doing']);
    expect(asLabels.trash).toBeUndefined();
    expect(asLabels.cards[2]!.blockedBy).toEqual(['b']);
  });
});
