import { describe, expect, it } from 'vitest';
import {
  groupRows,
  landArrivals,
  rowsToLanes,
  settleNotesOnLanes,
} from './event-storming-lane-landing';
import { isOnLane } from './event-storming-lanes';
import type { Element } from './index';

// docs/specs/021-event-storming/event-storming.md "Always on a lane".

function note(id: string, x: number, y: number, over: Partial<Element> = {}): Element {
  return {
    id,
    type: 'sticky',
    x,
    y,
    width: 200,
    height: 200,
    fillColor: '#fdba74',
    esKind: 'domain-event',
    fixedSize: true,
    ...over,
  } as Element;
}

const box = (x: number, y: number, width = 200, height = 200) => ({ x, y, width, height });
const byId = (els: Element[], id: string) =>
  els.find((e) => e.id === id) as Element & { y: number; x: number };

describe('groupRows', () => {
  it('groups boxes level with each other into rows, top to bottom and left to right', () => {
    const rows = groupRows([box(300, 250), box(0, 0), box(250, 30), box(0, 260)]);
    expect(rows).toEqual([
      [1, 2],
      [3, 0],
    ]);
  });

  it('starts a new row half a lane below the row first note, so a long sag cannot chain rows', () => {
    // Each box 60px lower than the last: chained, they would be one row.
    const rows = groupRows([box(0, 0), box(220, 60), box(440, 120)]);
    expect(rows).toEqual([[0, 1], [2]]);
  });
});

describe('rowsToLanes', () => {
  it('puts each row on its nearest lane', () => {
    expect(rowsToLanes([box(0, 10), box(220, -5), box(0, 250)])).toEqual([0, 0, 240]);
  });

  it('never merges two rows into one lane, and pushes every row below along (the cascade)', () => {
    // Three rows only 110px apart: nearest lanes 0, 0, 1 would merge the first two.
    const tops = rowsToLanes([box(0, 0), box(0, 110), box(0, 220)]);
    expect(tops).toEqual([0, 240, 480]);
  });

  it('keeps an empty lane the block already had', () => {
    expect(rowsToLanes([box(0, 0), box(0, 480)])).toEqual([0, 480]);
  });

  it('centres mixed stationery on the lane', () => {
    expect(rowsToLanes([box(0, 0), box(220, 20, 300, 180)])).toEqual([0, 10]);
  });
});

describe('landArrivals', () => {
  it('lands only the arriving workshop notes, leaving everything else alone', () => {
    const els = [
      note('down', 0, 130),
      note('new', 400, 130),
      {
        id: 'shape',
        type: 'shape',
        shape: 'square',
        x: 0,
        y: 55,
        width: 100,
        height: 100,
      } as Element,
    ];
    const out = landArrivals(els, new Set(['new', 'shape']), { x: 'keep' });
    expect(byId(out, 'down').y).toBe(130);
    expect(byId(out, 'new').y).toBe(240);
    expect(byId(out, 'shape').y).toBe(55);
  });

  it('ignores a plain sticky', () => {
    const plain = { id: 'p', type: 'sticky', x: 0, y: 130, width: 200, height: 200 } as Element;
    const els = [plain];
    expect(landArrivals(els, new Set(['p']), { x: 'keep' })).toBe(els);
  });

  it('keeps the x of a block, even over a note already there', () => {
    const els = [note('down', 0, 0), note('a', 20, 10), note('b', 236, 250)];
    const out = landArrivals(els, new Set(['a', 'b']), { x: 'keep' });
    expect(byId(out, 'a')).toMatchObject({ x: 20, y: 0 });
    expect(byId(out, 'b')).toMatchObject({ x: 236, y: 240 });
  });

  it('moves a lone arrival on an occupied spot to the nearest free slot along its lane', () => {
    const els = [note('down', 0, 0), note('new', 30, 5)];
    const out = landArrivals(els, new Set(['new']), { x: 'free-slot' });
    expect(byId(out, 'new')).toMatchObject({ x: 216, y: 0 });
    expect(byId(out, 'down')).toMatchObject({ x: 0, y: 0 });
  });

  it('leaves a lone arrival in open space where it is with free-slot, and captures it with capture', () => {
    const els = [note('down', 0, 0), note('new', 290, 5)];
    expect(byId(landArrivals(els, new Set(['new']), { x: 'free-slot' }), 'new').x).toBe(290);
    expect(byId(landArrivals(els, new Set(['new']), { x: 'capture' }), 'new').x).toBe(216);
  });

  it('returns the same array when every arrival is already on a lane where it is', () => {
    const els = [note('a', 0, 240)];
    expect(landArrivals(els, new Set(['a']), { x: 'keep' })).toBe(els);
  });
});

describe('settleNotesOnLanes', () => {
  it('moves every workshop note off a lane to its nearest lane, y only', () => {
    const els = [
      note('a', 17, 130),
      note('b', 400, 0),
      note('c', 800, 200, { width: 300, height: 180 }),
    ];
    const { elements, movedIds } = settleNotesOnLanes(els);
    expect(movedIds).toEqual(['a', 'c']);
    expect(byId(elements, 'a')).toMatchObject({ x: 17, y: 240 });
    expect(byId(elements, 'b')).toBe(els[1]);
    expect(byId(elements, 'c')).toMatchObject({ x: 800, y: 250 });
    expect(elements.filter((e) => e.type === 'sticky').every((e) => isOnLane(e as never))).toBe(
      true,
    );
  });

  it('never moves a locked note, a plain sticky or a shape', () => {
    const els = [
      note('locked', 0, 130, { locked: true }),
      { id: 'plain', type: 'sticky', x: 0, y: 130, width: 200, height: 200 } as Element,
      { id: 's', type: 'shape', shape: 'square', x: 0, y: 130, width: 100, height: 100 } as Element,
    ];
    const out = settleNotesOnLanes(els);
    expect(out.movedIds).toEqual([]);
    expect(out.elements).toBe(els);
  });
});
