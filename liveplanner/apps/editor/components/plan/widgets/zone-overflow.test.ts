// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { BoardWidgetId } from '@liveplanner/items';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  MORE_LABEL_MAX_PX,
  fitWidgets,
  moreLabel,
  nudgeInRow,
  pressedIn,
  slotInList,
  zoneLayout,
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
  pressed: new Set<BoardWidgetId>(),
};

describe('fitWidgets', () => {
  it('fits everything with its gaps and buttons, and says what it needs', () => {
    // 500 + 56 + 5 gaps of 6.
    expect(fitWidgets({ ...base, room: 586 })).toEqual({
      overflow: false,
      pinned: false,
      shown: 0,
      need: 586,
    });
  });

  it('pins the Filter and fills the rest in order beside More and the buttons', () => {
    // Filter 200 + More 70 + 56 + 3 gaps 18 = 344; each widget adds 106.
    expect(fitWidgets({ ...base, room: 560 })).toMatchObject({
      overflow: true,
      pinned: true,
      shown: 2,
    });
    expect(fitWidgets({ ...base, room: 450 })).toMatchObject({ shown: 1 });
    expect(fitWidgets({ ...base, room: 300 })).toMatchObject({ shown: 0 });
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

describe('the zone layout', () => {
  it('splits the row from More after the pinned Filter', () => {
    expect(zoneLayout(WIDGETS, { overflow: false, pinned: false, shown: 0, need: 0 })).toEqual({
      pin: false,
      row: WIDGETS,
      hidden: [],
    });
    expect(zoneLayout(WIDGETS, { overflow: true, pinned: true, shown: 1, need: 0 })).toEqual({
      pin: true,
      row: ['count'],
      hidden: ['progress', 'mine'],
    });
    expect(
      zoneLayout(['count', 'mine'], { overflow: true, pinned: true, shown: 1, need: 0 }),
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
