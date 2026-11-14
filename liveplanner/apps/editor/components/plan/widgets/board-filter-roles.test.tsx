// @vitest-environment jsdom
// The board's filter by share role (docs/specs/026-plan/board-widgets.md "The board's filter"; Work Tracker 842): an
// Editor and a Participant change it; a Viewer sees it applied, read-only (no typing, chips, Only Mine, Clear, widget
// presses, Show all or saved filter apply).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  ITEM_TYPES,
  presetSetup,
  projectBoard,
  type BoardWidgetKind,
  type Item,
  type QuickFilter,
} from '@liveplanner/items';
import { planPalette } from '../plan-palette';
import { BoardWidgetView, type WidgetContext } from './BoardWidgetView';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const SAM = { id: 'sam', name: 'Sam', color: '#2563eb' };
const item = (id: string, fields: Item['fields'], type = 'task'): Item =>
  ({
    id,
    type,
    key: 1,
    rank: `r${id}`,
    fields,
    createdBy: SAM,
    updatedBy: SAM,
    createdAt: 0,
    updatedAt: 0,
  }) as unknown as Item;

type Role = 'editor' | 'participant' | 'viewer';

function ctx(role: Role, quick: QuickFilter = {}): WidgetContext {
  const setup = {
    ...presetSetup('kanban'),
    savedFilters: [{ id: 'f1', name: 'Bugs', type: 'bug' }],
  };
  const items = [
    item('a', { title: 'a', status: 'todo', assignee: SAM, priority: 'high', due: '2026-10-01' }),
    item('b', { title: 'b', status: 'doing', due: '2026-10-07' }, 'note'),
  ];
  return {
    setup,
    projection: projectBoard(setup, new Map(items.map((i) => [i.id, i])), quick),
    items,
    types: ITEM_TYPES,
    palette: planPalette('light', {}),
    quick,
    onQuick: vi.fn(),
    canFilterMine: 'sam',
    canFilter: role !== 'viewer',
    trayOpen: false,
    onToggleTray: vi.fn(),
    now: new Date(2026, 9, 5),
    canEdit: role === 'editor',
    onSetup: vi.fn(),
    onOpenItem: vi.fn(),
    planItems: new Map(items.map((i) => [i.id, i])),
  };
}

const draw = (kind: BoardWidgetKind, c: WidgetContext) =>
  render(<BoardWidgetView kind={kind} ctx={c} />);

afterEach(cleanup);

describe.each<Role>(['editor', 'participant'])('the board filter for an %s', (role) => {
  it('types, presses Only Mine, a widget value and a saved filter, each into the shared filter', () => {
    const c = ctx(role);
    draw('filter', c);
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter this board' }), {
      target: { value: 'login' },
    });
    expect(c.onQuick).toHaveBeenLastCalledWith({ text: 'login' });
    fireEvent.click(screen.getByRole('button', { name: 'Bugs' }));
    expect(c.onQuick).toHaveBeenLastCalledWith({ type: 'bug' });
    cleanup();
    draw('mine', c);
    fireEvent.click(screen.getByRole('button', { name: 'Only Mine' }));
    expect(c.onQuick).toHaveBeenLastCalledWith({ mine: 'sam' });
    cleanup();
    draw('priorities', c);
    fireEvent.click(screen.getByRole('button', { name: /^Only High priority/ }));
    expect(c.onQuick).toHaveBeenLastCalledWith({ priority: 'high' });
  });

  it('clears the shared filter with Show all', () => {
    const c = ctx(role, { type: 'task' });
    draw('count', c);
    fireEvent.click(screen.getByRole('button', { name: /Show all$/ }));
    expect(c.onQuick).toHaveBeenLastCalledWith({});
  });
});

describe('the board filter for a Viewer', () => {
  it('shows the words and chips read-only, with no Clear or Add Filter', () => {
    const c = ctx('viewer', { text: 'login', filters: [{ by: 'type', key: 'task' }] });
    draw('filter', c);
    const box = screen.getByRole<HTMLInputElement>('textbox', { name: 'Filter this board' });
    expect(box.readOnly).toBe(true);
    expect(box.value).toBe('login');
    expect(screen.queryByRole('button', { name: 'Clear Filter' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Filter' })).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Bugs' }).disabled).toBe(true);
  });

  it('disables Only Mine and every widget press, and reads the count without Show all', () => {
    const c = ctx('viewer', { mine: 'sam' });
    draw('mine', c);
    const mine = screen.getByRole<HTMLButtonElement>('button', { name: 'Only Mine' });
    expect(mine.disabled).toBe(true);
    expect(mine.getAttribute('aria-pressed')).toBe('true');
    cleanup();
    for (const kind of ['people', 'types', 'priorities', 'due', 'unassigned'] as const) {
      const { container, unmount } = draw(kind, ctx('viewer'));
      const buttons = [...container.querySelectorAll('button')];
      expect(buttons.length, kind).toBeGreaterThan(0);
      for (const b of buttons) expect(b.disabled, `${kind}: ${b.textContent}`).toBe(true);
      unmount();
    }
    draw('count', ctx('viewer', { type: 'task' }));
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull();
    expect(document.querySelector('[data-filter-count]')?.textContent).toMatch(
      /^Showing \d+of \d+ items$/,
    );
  });
});
