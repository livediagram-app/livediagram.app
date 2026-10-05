import { describe, expect, it } from 'vitest';
import {
  BOARD_WIDGET_KINDS,
  DEFAULT_BOARD_WIDGETS,
  isBoardWidgetKind,
  nudgeWidget,
  placeWidget,
  readBoardWidgets,
  removeWidget,
  widgetsOf,
} from './board-widgets';
import { normaliseBoardSetup } from './board';

describe('board widgets', () => {
  it('reads known kinds once each, in order', () => {
    expect(readBoardWidgets(['filter', 'nope', 'count', 'filter', 3])).toEqual(['filter', 'count']);
    expect(readBoardWidgets('count')).toBeUndefined();
    expect(isBoardWidgetKind('due')).toBe(true);
    expect(BOARD_WIDGET_KINDS).toHaveLength(10);
  });

  it('shows the default set on a board that names none, with Votes Left when it votes', () => {
    expect(widgetsOf({ voting: { on: false } })).toEqual([...DEFAULT_BOARD_WIDGETS]);
    expect(widgetsOf({ voting: { on: true } })).toEqual([...DEFAULT_BOARD_WIDGETS, 'votes']);
    expect(widgetsOf({ widgets: [], voting: { on: true } })).toEqual([]);
  });

  it('places a new widget at a place, and moves one the board has', () => {
    expect(placeWidget(['count', 'filter'], 'due', 1)).toEqual(['count', 'due', 'filter']);
    expect(placeWidget(['count', 'filter'], 'due', 9)).toEqual(['count', 'filter', 'due']);
    expect(placeWidget(['count', 'filter', 'mine'], 'count', 3)).toEqual([
      'filter',
      'mine',
      'count',
    ]);
    expect(placeWidget(['count', 'filter', 'mine'], 'mine', 0)).toEqual([
      'mine',
      'count',
      'filter',
    ]);
    expect(placeWidget(['count', 'filter'], 'count', 1)).toEqual(['count', 'filter']);
  });

  it('nudges left and right, and stops at the ends', () => {
    expect(nudgeWidget(['count', 'filter'], 'count', 1)).toEqual(['filter', 'count']);
    expect(nudgeWidget(['count', 'filter'], 'count', -1)).toEqual(['count', 'filter']);
    expect(nudgeWidget(['count'], 'due', 1)).toEqual(['count']);
  });

  it('removes a widget', () => {
    expect(removeWidget(['count', 'filter'], 'count')).toEqual(['filter']);
  });

  it('keeps a board’s widgets through the set-up check', () => {
    const cols = [{ id: 'a', status: 's', name: 'A' }];
    expect(normaliseBoardSetup({ columns: cols, widgets: ['due', 'x', 'due'] })?.widgets).toEqual([
      'due',
    ]);
    expect(normaliseBoardSetup({ columns: cols })).not.toHaveProperty('widgets');
  });
});
