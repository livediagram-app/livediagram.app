// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { planPalette } from '../plan-palette';
import { BoardWidgetZone } from './BoardWidgetZone';
import { widgetSlotAt } from '@/hooks/plan/widget-slot';

// docs/specs/026-plan/board-widgets.md "Remove": a widget's × shows only while its board is selected, and then only
// on hover, keyboard focus or a touch tap.
afterEach(cleanup);

function show(selected: boolean, canEdit = true) {
  const onChange = vi.fn();
  render(
    <BoardWidgetZone
      widgets={['count', 'filter']}
      canEdit={canEdit}
      selected={selected}
      palette={planPalette('light', {})}
      onChange={onChange}
      render={(kind) => <span>{kind}</span>}
    />,
  );
  return onChange;
}

describe('BoardWidgetZone ×', () => {
  it('is hidden while the board is not selected', () => {
    show(false);
    expect(screen.queryByRole('button', { name: 'Remove Item Count' })).toBeNull();
  });

  it('shows on a selected board and takes the widget off', () => {
    const onChange = show(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Item Count' }));
    expect(onChange).toHaveBeenCalledWith(['filter']);
  });

  it('stays out of sight until a hover, keyboard focus or a tap, and leaves nothing selected once used', () => {
    const onChange = show(true);
    const remove = screen.getByRole('button', { name: 'Remove Item Count' });
    // Hidden by default; the widget's hover or focus shows it.
    expect(remove.className).toContain('opacity-0');
    expect(remove.className).toContain('group-hover/widget:opacity-100');
    // A touch tap on the widget shows its × at once.
    fireEvent.pointerDown(screen.getByText('count'), { pointerType: 'touch', button: 0 });
    expect(screen.getByRole('button', { name: 'Remove Item Count' }).className).toContain(
      'opacity-100',
    );
    const widget = screen.getByRole('listitem', { name: 'Item Count widget' });
    widget.focus();
    fireEvent.keyDown(widget, { key: 'Delete' });
    expect(onChange).toHaveBeenCalledWith(['filter']);
    expect(document.activeElement).not.toBe(widget);
  });

  it('puts a tapped widget’s × away on a tap outside the zone, or Escape', () => {
    show(true);
    const tap = () =>
      fireEvent.pointerDown(screen.getByText('count'), { pointerType: 'touch', button: 0 });
    const remove = () => screen.getByRole('button', { name: 'Remove Item Count' });
    tap();
    expect(remove().className).not.toContain('opacity-0');
    // A tap inside the zone keeps it.
    fireEvent.pointerDown(screen.getByText('filter'), { pointerType: 'touch', button: 0 });
    fireEvent.pointerDown(screen.getByText('count'), { pointerType: 'touch', button: 0 });
    expect(remove().className).not.toContain('opacity-0');
    fireEvent.pointerDown(document.body, { pointerType: 'touch', button: 0 });
    expect(remove().className).toContain('opacity-0');
    tap();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(remove().className).toContain('opacity-0');
  });

  it('never shows to someone who may not edit', () => {
    show(true, false);
    expect(screen.queryByRole('button', { name: 'Remove Item Count' })).toBeNull();
  });
});

// docs/specs/026-plan/board-widgets.md: an empty zone's hint shows only while the board is selected.
describe('BoardWidgetZone empty hint', () => {
  const empty = (selected: boolean, canEdit = true) =>
    render(
      <BoardWidgetZone
        widgets={[]}
        canEdit={canEdit}
        selected={selected}
        palette={planPalette('light', {})}
        onChange={vi.fn()}
        render={(kind) => <span>{kind}</span>}
      />,
    );

  it('shows the hint and its + only on a selected board, to someone who may edit', () => {
    empty(true);
    expect(screen.getByText('Add widgets to this board')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a widget' })).toBeTruthy();
    cleanup();
    empty(false);
    expect(screen.queryByText('Add widgets to this board')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add a widget' })).toBeNull();
    cleanup();
    empty(true, false);
    expect(screen.queryByText('Add widgets to this board')).toBeNull();
  });
});

// docs/specs/026-plan/board-widgets.md "The widget gallery": the + opens the widgets not on the board yet.
describe('BoardWidgetZone +', () => {
  it('leaves out the widgets on the board, and adds the one picked at the end', () => {
    const onChange = show(true);
    fireEvent.click(screen.getByRole('button', { name: 'Add a widget' }));
    expect(screen.queryByRole('button', { name: 'Add Item Count' })).toBeNull();
    expect(screen.queryByText('Item Count')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add Completion' }));
    expect(onChange).toHaveBeenCalledWith(['count', 'filter', 'progress']);
    expect(screen.queryByRole('button', { name: 'Add Completion' })).toBeNull();
  });

  it('names each section in a line that meets AA contrast in both themes', () => {
    show(true);
    fireEvent.click(screen.getByRole('button', { name: 'Add a widget' }));
    const lines = document.querySelectorAll('[data-group-line]');
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.className).toContain('text-slate-500');
      expect(line.className).toContain('dark:text-slate-400');
    }
  });

  it('narrows the gallery to a search, and says when nothing matches', () => {
    show(true);
    fireEvent.click(screen.getByRole('button', { name: 'Add a widget' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Find a widget' }), {
      target: { value: 'votes' },
    });
    expect(screen.getByRole('button', { name: 'Add Top Voted' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add Completion' })).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Find a widget' }), {
      target: { value: 'zzz' },
    });
    expect(screen.getByRole('status').textContent).toMatch(/^No widgets match/);
  });
});

describe('WIDGET_GROUPS', () => {
  it('holds every widget kind exactly once', async () => {
    const { WIDGET_GROUPS } = await import('./BoardWidgetPicker');
    const { BOARD_WIDGET_KINDS } = await import('@liveplanner/items');
    const all = WIDGET_GROUPS.flatMap((g) => g.kinds);
    expect([...all].sort()).toEqual([...BOARD_WIDGET_KINDS].sort());
  });
});

// The reorder's landmark: the place before the first widget whose middle is right of the point.
describe('widgetSlotAt', () => {
  it('counts the widgets left of the point, skipping the dragged one', () => {
    const zone = document.createElement('div');
    for (const [i, id] of ['a', 'b', 'c'].entries()) {
      const el = document.createElement('div');
      el.dataset.widget = id;
      el.getBoundingClientRect = () => ({ left: i * 100, width: 80 }) as DOMRect;
      zone.append(el);
    }
    expect(widgetSlotAt(zone, 0)).toBe(0);
    expect(widgetSlotAt(zone, 150)).toBe(2);
    expect(widgetSlotAt(zone, 500)).toBe(3);
    expect(widgetSlotAt(zone, 150, 'a')).toBe(2);
  });
});

// docs/specs/026-plan/board-widgets.md "The header": an empty zone in a header band keeps its +, so the controls card
// never shows a hairline before the cog with nothing beside it.
describe('BoardWidgetZone, empty', () => {
  const empty = (props: { selected?: boolean; offerAdd?: boolean; canEdit?: boolean }) =>
    render(
      <BoardWidgetZone
        widgets={[]}
        canEdit={props.canEdit ?? true}
        selected={props.selected ?? false}
        offerAdd={props.offerAdd ?? false}
        palette={planPalette('light', {})}
        onChange={vi.fn()}
        render={(kind) => <span>{kind}</span>}
      />,
    );

  it('stays clean on an unselected canvas board', () => {
    empty({});
    expect(screen.queryByRole('button', { name: 'Add a widget' })).toBeNull();
  });

  it('offers the + alone in a header band, unselected', () => {
    empty({ offerAdd: true });
    expect(screen.getByRole('button', { name: 'Add a widget' })).toBeTruthy();
    expect(screen.queryByText('Add widgets to this board')).toBeNull();
  });

  it('offers nothing to someone who may not edit', () => {
    empty({ offerAdd: true, canEdit: false });
    expect(screen.queryByRole('button', { name: 'Add a widget' })).toBeNull();
  });
});
