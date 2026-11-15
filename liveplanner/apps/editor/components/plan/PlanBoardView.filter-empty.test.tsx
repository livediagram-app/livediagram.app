// @vitest-environment jsdom
// docs/specs/026-plan/board-widgets.md "When the filter hides every card" (Work Tracker 881): a board whose shared
// filter hides every card it holds says so in its columns, with Show All for an Editor and a Participant; a Viewer
// reads it without the button. Worked out for each viewer (Only Mine), never on a phone or in a Dashboard slot, and
// never on a board that is really empty.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, presetSetup, type BoardFilter, type Item } from '@liveplanner/items';
import type { ShapeElement } from '@liveplanner/project';
import { PlanBoardView } from './PlanBoardView';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { DashboardContext, type DashboardContextValue } from './dashboard/dashboard-context';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { narrowingCount } from './FilterEmptyHint';

const phone = vi.hoisted(() => ({ on: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => phone.on,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(() => {
  phone.on = false;
  cleanup();
});

const SAM = { id: 'sam', name: 'Sam', color: '#2563eb' };
const ANA = { id: 'ana', name: 'Ana', color: '#16a34a' };
const card = (id: string, assignee = SAM): Item =>
  ({
    id,
    key: 1,
    type: 'task',
    fields: { title: `Card ${id}`, status: 'todo', assignee },
    rank: `a${id}`,
    createdAt: 0,
    updatedAt: 0,
    createdBy: SAM,
  }) as unknown as Item;

type Role = 'editor' | 'participant' | 'viewer';
const plan = (role: Role, over: Partial<PlanContextValue> = {}): PlanContextValue =>
  ({
    items: new Map([
      ['a', card('a')],
      ['b', card('b')],
    ]),
    types: ITEM_TYPES,
    status: 'ready',
    self: ANA,
    people: [],
    canEdit: role === 'editor',
    canEditCards: role !== 'viewer',
    canVote: true,
    presence: new Map(),
    statusNames: new Map(),
    openItemId: null,
    retry: vi.fn(),
    openItem: vi.fn(),
    openNewItem: vi.fn(),
    addItem: vi.fn(),
    moveItem: vi.fn(),
    updateBoard: vi.fn(),
    setBoardFilter: vi.fn(),
    createTypeForBoard: vi.fn(),
    announce: vi.fn(),
    ...over,
  }) as unknown as PlanContextValue;

const board = (filter?: BoardFilter): ShapeElement =>
  ({
    id: 'b1',
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 1200,
    height: 600,
    planBoard: { ...presetSetup('kanban'), widgets: ['count'], ...(filter ? { filter } : {}) },
  }) as unknown as ShapeElement;

const draw = (value: PlanContextValue, element: ShapeElement, wrap = (n: ReactNode) => n) =>
  render(
    <SelectionStoreProvider store={createSelectionStore()}>
      <PlanProvider value={value}>{wrap(<PlanBoardView element={element} />)}</PlanProvider>
    </SelectionStoreProvider>,
  );

const hint = () => document.querySelector('[data-filter-empty]');

describe.each<Role>(['editor', 'participant'])('a filter hiding every card, for an %s', (role) => {
  it('shows the hint once, in the first column, and Show All clears the shared filter', () => {
    const value = plan(role);
    draw(value, board({ text: 'zzz' }));
    expect(document.querySelectorAll('[data-filter-empty]')).toHaveLength(1);
    expect(hint()?.closest('[data-plan-status]')?.getAttribute('data-plan-status')).toBe('backlog');
    expect(hint()?.textContent).toContain('No cards match “zzz”');
    expect(hint()?.textContent).toContain('The board’s filter hides all 2 cards.');
    fireEvent.click(screen.getByRole('button', { name: 'Show All' }));
    expect(value.setBoardFilter).toHaveBeenCalledWith('b1', undefined);
  });
});

describe('a filter hiding every card', () => {
  it('shows a Viewer the hint without Show All', () => {
    draw(plan('viewer'), board({ text: 'zzz' }));
    expect(hint()).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Show All' })).toBeNull();
  });

  it('is worked out for each viewer: Only Mine hides Ana’s nothing-assigned board, not Sam’s', () => {
    draw(plan('editor'), board({ mine: true }));
    expect(hint()?.textContent).toContain('No cards match these filters');
    cleanup();
    draw(plan('editor', { self: SAM }), board({ mine: true }));
    expect(hint()).toBeNull();
  });

  it('says its one card when the board holds one', () => {
    draw(plan('editor', { items: new Map([['a', card('a')]]) }), board({ text: 'zzz' }));
    expect(hint()?.textContent).toContain('The board’s filter hides its one card.');
  });

  it('never shows on a board that is really empty, nor while a filter leaves cards', () => {
    draw(plan('editor', { items: new Map() }), board({ text: 'zzz' }));
    expect(hint()).toBeNull();
    cleanup();
    draw(plan('editor'), board({ text: 'Card' }));
    expect(hint()).toBeNull();
  });

  it('never shows on a phone or in a Dashboard slot, where the filter stands down', () => {
    phone.on = true;
    draw(plan('editor'), board({ text: 'zzz' }));
    expect(hint()).toBeNull();
    cleanup();
    phone.on = false;
    draw(plan('editor'), board({ text: 'zzz' }), (n) => (
      <DashboardContext.Provider value={{} as DashboardContextValue}>{n}</DashboardContext.Provider>
    ));
    expect(hint()).toBeNull();
  });

  it('counts each narrowing beside the words', () => {
    expect(narrowingCount({})).toBe(0);
    expect(
      narrowingCount({
        text: 'x',
        mine: 'sam',
        person: 'ana',
        type: 'bug',
        priority: 'high',
        due: { to: '2026-12-01' },
        filters: [{ field: 'f-a', op: 'is', value: 'x' } as never, { field: 'f-b' } as never],
      }),
    ).toBe(7);
  });
});
