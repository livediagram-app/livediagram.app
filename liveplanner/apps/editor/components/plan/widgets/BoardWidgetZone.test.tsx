// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { planPalette } from '../plan-palette';
import { BoardWidgetZone } from './BoardWidgetZone';
import { widgetSlotAt } from '@/hooks/plan/widget-slot';
import type { BoardWidgetId } from '@liveplanner/items';
import { BOARD_WIDGET_INFO } from '@liveplanner/plan-art';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';

// docs/specs/026-plan/board-widgets.md "Remove": Edit Widgets puts the zone in edit mode, where every widget shows its
// ×, on any board, selected or not; out of edit mode no widget shows one.
afterEach(cleanup);

const labelOf = (id: BoardWidgetId) =>
  id in BOARD_WIDGET_INFO ? BOARD_WIDGET_INFO[id as keyof typeof BOARD_WIDGET_INFO].label : id;

function show(selected: boolean, canEdit = true, widgets: BoardWidgetId[] = ['count', 'filter']) {
  const onChange = vi.fn();
  const props = {
    canEdit,
    selected,
    palette: planPalette('light', {}),
    onChange,
    labelOf,
    render: (kind: BoardWidgetId) => <span>{kind}</span>,
  };
  const view = render(<BoardWidgetZone widgets={widgets} {...props} />);
  const rerender = (next: BoardWidgetId[]) =>
    view.rerender(<BoardWidgetZone widgets={next} {...props} />);
  return Object.assign(onChange, { rerender });
}

const removeButton = (name = 'Item Count') =>
  screen.queryByRole('button', { name: `Remove ${name}` });
const edit = () => fireEvent.click(screen.getByRole('button', { name: 'Edit Widgets' }));

describe('BoardWidgetZone Edit Widgets', () => {
  it('shows no × until edit mode, then one on every widget, on an unselected board too', () => {
    show(false);
    expect(removeButton()).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Widgets' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    edit();
    expect(removeButton()).toBeTruthy();
    expect(removeButton('Filter')).toBeTruthy();
    const done = screen.getByRole('button', { name: 'Done Editing Widgets' });
    expect(done.getAttribute('aria-pressed')).toBe('true');
  });

  it('takes a widget off with its × and stays in edit mode for the next', () => {
    const onChange = show(true);
    edit();
    fireEvent.click(removeButton()!);
    expect(onChange).toHaveBeenCalledWith(['filter']);
    onChange.rerender(['filter']);
    expect(removeButton('Filter')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Done Editing Widgets' })).toBeTruthy();
  });

  it('ends on Done, Escape and a press outside the zone, but not a press inside it', () => {
    show(false);
    edit();
    fireEvent.click(screen.getByRole('button', { name: 'Done Editing Widgets' }));
    expect(removeButton()).toBeNull();
    edit();
    fireEvent.pointerDown(screen.getByText('filter'), { button: 0 });
    expect(removeButton()).toBeTruthy();
    fireEvent.pointerDown(document.body, { button: 0 });
    expect(removeButton()).toBeNull();
    edit();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(removeButton()).toBeNull();
  });

  it('ends when the last widget goes, so a widget added later shows no ×', () => {
    const onChange = show(false, true, ['count']);
    edit();
    fireEvent.click(removeButton()!);
    expect(onChange).toHaveBeenCalledWith([]);
    onChange.rerender([]);
    onChange.rerender(['count']);
    expect(removeButton()).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Widgets' })).toBeTruthy();
  });

  it('still takes a focused widget off with Delete, leaving no focus on it', () => {
    const onChange = show(false);
    const widget = screen.getByRole('listitem', { name: 'Item Count widget' });
    widget.focus();
    fireEvent.keyDown(widget, { key: 'Delete' });
    expect(onChange).toHaveBeenCalledWith(['filter']);
    expect(document.activeElement).not.toBe(widget);
  });

  // docs/specs/013-workspace/share-roles.md: widgets are board structure, so only an Editor changes them (the editor's
  // canEdit is !isReadOnly, and only an edit link is not read-only).
  it.each([
    ['edit', true],
    ['participate', false],
    ['view', false],
  ] as const)('a %s link offers Edit Widgets: %s', (role, offered) => {
    show(true, resolveEditorCapabilities({ level: role, adderKey: 'k' }).level === 'edit');
    expect(!!screen.queryByRole('button', { name: 'Edit Widgets' })).toBe(offered);
    expect(removeButton()).toBeNull();
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
        labelOf={labelOf}
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

// docs/specs/026-plan/board-widgets.md "The widget gallery": the + opens every widget, those on the board On Board.
describe('BoardWidgetZone +', () => {
  it('shows the widgets on the board On Board, adds one picked at the end and stays open', () => {
    const onChange = show(true);
    fireEvent.click(screen.getByRole('button', { name: 'Add a widget' }));
    const on = screen.getByRole('button', { name: 'Remove Item Count' });
    expect(on.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Add Completion' }));
    expect(onChange).toHaveBeenCalledWith(['count', 'filter', 'progress']);
    expect(screen.getByRole('dialog', { name: 'Add a Widget' })).toBeTruthy();
    fireEvent.click(on);
    expect(onChange).toHaveBeenLastCalledWith(['filter']);
    // The + again closes it.
    fireEvent.click(screen.getByRole('button', { name: 'Add a widget' }));
    expect(screen.queryByRole('dialog', { name: 'Add a Widget' })).toBeNull();
  });

  // The gallery is a dialog (a search, a rail and tiles), not a menu: a screen reader told "menu" expects menu items
  // and arrow keys from the button.
  it('says the + opens a dialog', () => {
    show(true);
    const add = screen.getByRole('button', { name: 'Add a widget' });
    expect(add.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(add);
    expect(screen.getByRole('dialog', { name: 'Add a Widget' })).toBeTruthy();
  });

  it('works out For You only as the gallery opens', () => {
    const suggest = vi.fn(() => [
      { id: 'due' as const, score: 1, reason: '3 cards have due dates' },
    ]);
    render(
      <BoardWidgetZone
        widgets={['count']}
        canEdit
        palette={planPalette('light', {})}
        onChange={vi.fn()}
        labelOf={labelOf}
        suggest={suggest}
        render={(kind) => <span>{kind}</span>}
      />,
    );
    expect(suggest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Add a widget' }));
    expect(suggest).toHaveBeenCalledTimes(1);
    expect(screen.getByText('3 cards have due dates')).toBeTruthy();
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
    expect(screen.queryByRole('navigation', { name: 'Widget sections' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add Completion' })).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Find a widget' }), {
      target: { value: 'zzz' },
    });
    expect(screen.getByRole('status').textContent).toMatch(/^No widgets match/);
  });
});

describe('WIDGET_GROUPS', () => {
  it('holds every widget kind exactly once', async () => {
    const { WIDGET_GROUPS } = await import('./widget-gallery-model');
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
        labelOf={labelOf}
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
