// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { BoardWidgetId } from '@liveplanner/items';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  MORE_DOT_PX,
  MORE_LABEL_MAX_PX,
  FITS_ALL,
  fitWidgets,
  keptFit,
  moreLabel,
  nudgeInRow,
  pressedIn,
  slotInList,
  zoneLayout,
  zoneMinWidth,
} from './zone-overflow';
import { MORE_PANEL_MAX_PX, MORE_PANEL_MIN_PX, moreName, morePanelWidth } from './ZoneMore';

// docs/specs/026-plan/board-widgets.md "The header" (Work Tracker 880): which widgets the row holds, the rest in More.
const WIDGETS: BoardWidgetId[] = ['count', 'progress', 'filter', 'mine'];
const widths = (w: Record<string, number>) =>
  new Map(Object.entries(w)) as Map<BoardWidgetId, number>;
const W = widths({ count: 100, progress: 100, filter: 200, mine: 100 });
const base = {
  order: WIDGETS,
  widths: W,
  controls: [28, 28],
  more: 70,
  compact: 28,
  pressed: new Set<BoardWidgetId>(),
};

describe('fitWidgets', () => {
  it('fits everything with its gaps and buttons, and says what it needs', () => {
    // 500 + 56 + 5 gaps of 6.
    expect(fitWidgets({ ...base, room: 586 })).toEqual({
      overflow: false,
      pinned: false,
      filter: 'whole',
      shown: 0,
      named: true,
      need: 586,
    });
  });

  it('pins the Filter and fills the rest in order beside More and the buttons', () => {
    // Filter 200 + More 70 + 56 + 3 gaps 18 = 344; each widget adds 106.
    expect(fitWidgets({ ...base, room: 560 })).toMatchObject({
      overflow: true,
      pinned: true,
      filter: 'whole',
      shown: 2,
    });
    expect(fitWidgets({ ...base, room: 450 })).toMatchObject({ filter: 'whole', shown: 1 });
    expect(fitWidgets({ ...base, room: 344 })).toMatchObject({ filter: 'whole', shown: 0 });
    // Not even the whole Filter, More and the buttons: the Filter goes compact (28 px), and one widget fits again.
    expect(fitWidgets({ ...base, room: 300 })).toMatchObject({
      pinned: true,
      filter: 'compact',
      shown: 1,
    });
  });

  it('pins nothing on a board without the Filter, and counts no buttons for a Viewer', () => {
    const order: BoardWidgetId[] = ['count', 'progress', 'mine'];
    expect(fitWidgets({ ...base, order, controls: [], room: 290 })).toMatchObject({
      overflow: true,
      pinned: false,
      shown: 2,
    });
  });

  it('reserves room for a pressed value only while More would hold it', () => {
    const pressed = new Set<BoardWidgetId>(['mine']);
    expect(fitWidgets({ ...base, pressed, room: 560 })).toMatchObject({ shown: 0 });
    // Holding back one more widget than would fit leaves the press in the row and More plain.
    const early = new Set<BoardWidgetId>(['count']);
    expect(fitWidgets({ ...base, pressed: early, room: 560 })).toMatchObject({ shown: 2 });
    expect(MORE_LABEL_MAX_PX).toBeGreaterThan(0);
  });

  // The verifier's case on PR #1842: a header band's zone at a 650 px window is 364 px, and the whole Filter 322.
  describe('in a narrow zone (a 650 px window)', () => {
    const real = {
      ...base,
      order: ['filter', 'count', 'progress', 'mine', 'people', 'due'] as BoardWidgetId[],
      widths: widths({ filter: 322, count: 110, progress: 130, mine: 90, people: 120, due: 110 }),
      compact: 30,
      more: 76,
    };
    const due = new Set<BoardWidgetId>(['due']);

    it('keeps the Filter whole while it fits beside More and the buttons', () => {
      expect(fitWidgets({ ...real, room: 600 })).toMatchObject({ filter: 'whole', shown: 1 });
    });

    it('turns the Filter compact at 364 and 300 px, pressed or not, never past the room', () => {
      expect(fitWidgets({ ...real, room: 364 })).toMatchObject({
        pinned: true,
        filter: 'compact',
        shown: 1,
        named: true,
      });
      expect(fitWidgets({ ...real, room: 364, pressed: due })).toMatchObject({
        filter: 'compact',
        shown: 0,
        named: true,
      });
      expect(fitWidgets({ ...real, room: 300 })).toMatchObject({ filter: 'compact', shown: 1 });
      expect(fitWidgets({ ...real, room: 300, pressed: due })).toMatchObject({
        filter: 'compact',
        shown: 0,
        named: true,
      });
    });

    it("drops More's name to a dot when even that is too wide", () => {
      expect(fitWidgets({ ...real, room: 250, pressed: due })).toMatchObject({
        filter: 'compact',
        shown: 0,
        named: false,
      });
      expect(MORE_DOT_PX).toBeLessThan(MORE_LABEL_MAX_PX);
    });

    it('puts the Filter into More when not even its button fits', () => {
      expect(fitWidgets({ ...real, controls: [], room: 100 })).toMatchObject({
        pinned: false,
        filter: 'more',
        shown: 0,
        named: true,
      });
      expect(fitWidgets({ ...real, controls: [], room: 100, pressed: due })).toMatchObject({
        filter: 'more',
        named: false,
      });
      expect(fitWidgets({ ...real, controls: [], room: 50 })).toMatchObject({
        filter: 'more',
        shown: 0,
        named: false,
      });
    });

    it('drops the name on a board without the Filter', () => {
      const order: BoardWidgetId[] = ['count', 'due'];
      expect(fitWidgets({ ...real, order, controls: [], room: 100, pressed: due })).toMatchObject({
        filter: 'whole',
        pinned: false,
        named: false,
      });
    });
  });

  it('works 1,000 widgets out within its CPU budget', () => {
    const order = Array.from({ length: 1000 }, (_, i) => `field:${i}` as BoardWidgetId);
    const many = new Map(order.map((k) => [k, 90] as const));
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 100; i++)
        fitWidgets({ ...base, order, widths: many, room: 1200, pressed: new Set([order[999]!]) });
    });
    expect(ms).toBeLessThan(cpuBudgetMs(200));
  });
});

// board-widgets.md "A press never reshuffles the row" (Work Tracker 1087): the verifier's case on PR #1842, a board
// header at a 990 px window whose zone is 554 px.
describe('a press at 990 px', () => {
  const at990 = {
    order: ['filter', 'progress', 'wip', 'count'] as BoardWidgetId[],
    widths: widths({ filter: 300, progress: 120, wip: 110, count: 90 }),
    room: 554,
    controls: [28, 28],
    more: 76,
    compact: 30,
    pressed: new Set<BoardWidgetId>(),
  };
  const pressed = new Set<BoardWidgetId>(['progress']);

  it('would, fitted afresh, turn the Filter compact and bring widgets back from More', () => {
    expect(fitWidgets(at990)).toMatchObject({ filter: 'whole', shown: 0 });
    expect(fitWidgets({ ...at990, pressed })).toMatchObject({ filter: 'compact', shown: 2 });
  });

  it('keeps the row as it was, More marking the press with its dot', () => {
    const before = fitWidgets(at990);
    expect(keptFit({ ...at990, pressed }, before)).toEqual({ ...before, named: false });
    // Released, nothing comes back from More either.
    expect(keptFit(at990, { ...before, named: false })).toEqual({ ...before, named: false });
  });

  it('names the press when there is room for it', () => {
    const before = fitWidgets({ ...at990, room: 700 });
    expect(keptFit({ ...at990, room: 700, pressed }, before)).toMatchObject({
      shown: before.shown,
      named: true,
    });
  });

  it('gives the row up only when it would overflow', () => {
    const before = fitWidgets(at990);
    // The press widens the Filter past the room: the row is worked out afresh.
    const wide = widths({ filter: 500, progress: 120, wip: 110, count: 90 });
    expect(keptFit({ ...at990, widths: wide, pressed }, before)).toBeNull();
    // A row holding every widget the order no longer has.
    expect(keptFit({ ...at990, order: ['filter'] }, { ...before, shown: 3 })).toBeNull();
    // Everything in the row: kept while it all fits, given up once it does not.
    const all = fitWidgets({ ...at990, room: 900 });
    expect(keptFit({ ...at990, room: 900, pressed }, all)).toMatchObject({ overflow: false });
    expect(keptFit(at990, all)).toBeNull();
  });

  it('keeps a row with no Filter pinned', () => {
    const order: BoardWidgetId[] = ['progress', 'wip', 'count'];
    const before = fitWidgets({ ...at990, order, room: 300 });
    expect(before).toMatchObject({ pinned: false, shown: 1 });
    expect(keptFit({ ...at990, order, room: 300 }, before)).toEqual(before);
  });
});

describe("the zone's narrowest", () => {
  it('is the compact Filter, More with its dot and the buttons, or every widget when less', () => {
    // 28 + 70 + 12 + 56 + 3 gaps.
    expect(zoneMinWidth(base)).toBe(28 + 70 + MORE_DOT_PX + 56 + 18);
    // No Filter: More with its dot and the buttons.
    expect(zoneMinWidth({ ...base, order: ['count', 'progress', 'mine'] })).toBe(
      70 + MORE_DOT_PX + 56 + 12,
    );
    // Every widget, when that is less.
    expect(zoneMinWidth({ ...base, order: ['count'], more: 200 })).toBe(100 + 56 + 12);
    expect(zoneMinWidth({ ...base, order: [] })).toBe(56 + 6);
  });
});

describe('the zone layout', () => {
  it('splits the row from More after the pinned Filter', () => {
    expect(zoneLayout(WIDGETS, { ...FITS_ALL })).toEqual({
      pin: false,
      row: WIDGETS,
      hidden: [],
    });
    expect(zoneLayout(WIDGETS, { ...FITS_ALL, overflow: true, pinned: true, shown: 1 })).toEqual({
      pin: true,
      row: ['count'],
      hidden: ['progress', 'mine'],
    });
    expect(
      zoneLayout(['count', 'mine'], { ...FITS_ALL, overflow: true, pinned: true, shown: 1 }),
    ).toEqual({ pin: false, row: ['count'], hidden: ['mine'] });
  });

  it("puts a row slot back into the board's list, the end before More", () => {
    const layout = {
      row: ['count', 'progress'] as BoardWidgetId[],
      hidden: ['mine'] as BoardWidgetId[],
    };
    expect(slotInList(WIDGETS, layout, 0)).toBe(0);
    expect(slotInList(WIDGETS, layout, 2)).toBe(3);
    expect(slotInList(WIDGETS, { row: layout.row, hidden: [] }, 2)).toBe(4);
  });

  it('nudges as before when nothing is pinned, or the board has no Filter', () => {
    expect(nudgeInRow(WIDGETS, 'progress', 1, false)).toEqual([
      'count',
      'filter',
      'progress',
      'mine',
    ]);
    expect(nudgeInRow(['count', 'mine'], 'count', 1, true)).toEqual(['mine', 'count']);
    expect(nudgeInRow(WIDGETS, 'count', -1, true)).toEqual(WIDGETS);
    expect(nudgeInRow(WIDGETS, 'progress', 1, true)).toEqual([
      'count',
      'mine',
      'filter',
      'progress',
    ]);
  });
});

describe('presses and More', () => {
  it('reads each widget its presses, in the order drawn', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<div data-widget="people"><b data-widget-pressed="Ana"></b><b></b></div>' +
      '<div data-widget="mine"><b data-widget-pressed="Only Mine"></b></div>' +
      '<b data-widget-pressed="stray"></b><div data-widget="due"><b data-widget-pressed=""></b></div>';
    expect([...pressedIn(root)]).toEqual([
      ['people', ['Ana']],
      ['mine', ['Only Mine']],
    ]);
    expect(pressedIn(null).size).toBe(0);
  });

  it('names the first press More holds, with how many more', () => {
    const pressed = new Map<BoardWidgetId, string[]>([
      ['people', ['Ana']],
      ['mine', ['Only Mine']],
    ]);
    expect(moreLabel(['count'], pressed)).toBeNull();
    expect(moreLabel(['people'], pressed)).toBe('Ana');
    expect(moreLabel(['mine', 'people'], pressed)).toBe('Only Mine +1');
    expect(moreName(3, null)).toBe('More widgets, 3 more');
    expect(moreName(1, 'Ana')).toBe('More widgets, 1 more, pressed: Ana');
  });

  it('sizes the panel to the widest widget within its bounds', () => {
    expect(morePanelWidth(0)).toBe(MORE_PANEL_MIN_PX);
    expect(morePanelWidth(250)).toBe(268);
    expect(morePanelWidth(2000)).toBe(MORE_PANEL_MAX_PX);
  });
});
