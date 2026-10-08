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
    expect(BOARD_WIDGET_KINDS).toHaveLength(14);
  });

  it('shows the default set on a board that names none, and reads a stored Votes Left past', () => {
    expect(widgetsOf({})).toEqual([...DEFAULT_BOARD_WIDGETS]);
    expect(widgetsOf({ widgets: [] })).toEqual([]);
    expect(readBoardWidgets(['votes', 'count'])).toEqual(['count']);
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

describe('card sizes', () => {
  it('draw only the fields their size can', async () => {
    const { cardFieldsAt } = await import('./board');
    expect(cardFieldsAt('minimal', ['key', 'labels', 'due'])).toEqual(['key', 'due']);
    expect(cardFieldsAt('compact', ['key', 'labels', 'due'])).toEqual(['key', 'due']);
    expect(cardFieldsAt(undefined, ['labels', 'description'])).toEqual(['labels', 'description']);
  });
});

describe('preset widgets', () => {
  it('give each board type widgets that suit it', async () => {
    const { presetSetup } = await import('./presets');
    expect(presetSetup('sprint').widgets).toContain('points');
    expect(presetSetup('bug-triage').widgets).toContain('unassigned');
    expect(presetSetup('retro').widgets).toEqual(['top-voted']);
    // No columns, so no done column: nothing to measure yet (docs/specs/026-plan/board-widgets.md "Defaults").
    expect(presetSetup('blank').widgets).toEqual([]);
    expect(presetSetup('roadmap').widgets).not.toContain('progress');
  });

  it('narrow to the unassigned and to a priority', async () => {
    const { quickFilterMatches, UNASSIGNED } = await import('./board');
    const { item, SAM } = await import('./test-items');
    const nobody = item({ title: 'n', priority: 'high' });
    const sam = item({ title: 's', assignee: SAM });
    expect(quickFilterMatches({ person: UNASSIGNED }, nobody)).toBe(true);
    expect(quickFilterMatches({ person: UNASSIGNED }, sam)).toBe(false);
    expect(quickFilterMatches({ priority: 'high' }, nobody)).toBe(true);
    expect(quickFilterMatches({ priority: 'low' }, nobody)).toBe(false);
  });
});
