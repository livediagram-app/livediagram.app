// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@liveplanner/project';
import { ITEM_TYPES, presetSetup } from '@liveplanner/items';
import {
  PlanBoardMenuSections,
  PlanBoardSectionsPanel,
  PlanSortCardsSettings,
  PlanSupportedCardsSettings,
  PlanSwimlaneSettings,
} from './PlanBoardMenuSection';

// docs/specs/026-plan/plan-board.md "The board set-up": five sections in one Board flyout.
const plan: Record<string, unknown> = {};
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@liveworkspace/workbench/components/primitives/MenuFlyoutSection', () => ({
  MenuFlyoutSection: ({
    title,
    panel,
    children,
  }: {
    title: string;
    panel?: boolean;
    children: ReactNode;
  }) => (
    <div data-flyout={title} data-panel={panel ? 'yes' : 'no'}>
      {children}
    </div>
  ),
}));

afterEach(cleanup);

const board = {
  ...createShape('plan-board', 0, 0),
  id: 'board',
  planBoard: presetSetup('kanban'),
} as ShapeElement;

// One section's body on its own (the panel opens one section at a time).
function showBody(
  Body: (props: { element: ShapeElement }) => ReactNode,
  overrides: Record<string, unknown>,
) {
  for (const key of Object.keys(plan)) delete plan[key];
  Object.assign(plan, { canEdit: true, updateBoard: vi.fn(), announce: vi.fn() }, overrides);
  render(<Body element={board} />);
}

function show(overrides: Record<string, unknown>) {
  for (const key of Object.keys(plan)) delete plan[key];
  Object.assign(plan, { canEdit: true, updateBoard: vi.fn(), announce: vi.fn() }, overrides);
  render(<PlanBoardMenuSections element={board} flyoutProps={() => ({})} />);
}

describe('PlanBoardMenuSections', () => {
  // One less click: the sections are rows of the menu itself, not of a Board flyout inside it.
  it('puts Board Setup, Columns, Swimlanes, Sort Cards, Supported Cards and Card Layout in the menu, no Board parent', () => {
    show({ types: ITEM_TYPES });
    expect(
      [...document.querySelectorAll('[data-flyout]')].map((f) => f.getAttribute('data-flyout')),
    ).toEqual([
      'Board Setup',
      'Columns',
      'Swimlanes',
      'Sort Cards',
      'Supported Cards',
      'Card Layout',
    ]);
    expect(document.querySelector('[data-flyout="Board"]')).toBeNull();
    // Set apart from Style above them.
    expect(document.querySelector('[role="separator"]')).toBeTruthy();
  });

  it('keeps Add to Slides off the title (it is in the board’s own ⋯ menu)', () => {
    show({ addBoardSlide: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Add to Slides' })).toBeNull();
  });

  it('leaves Supported Cards out on an Archive board', () => {
    for (const key of Object.keys(plan)) delete plan[key];
    Object.assign(plan, { canEdit: true, updateBoard: vi.fn(), types: ITEM_TYPES });
    const archive = { ...board, planBoard: presetSetup('archive') } as ShapeElement;
    render(<PlanBoardMenuSections element={archive} flyoutProps={() => ({})} />);
    expect(screen.queryByRole('button', { name: 'Supported Cards' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Columns' })).toBeNull();
  });

  it('leaves Columns out of an All Cards board and one not set up yet', () => {
    for (const setupOf of [presetSetup('all-cards'), { ...presetSetup('kanban'), columns: [] }]) {
      for (const key of Object.keys(plan)) delete plan[key];
      Object.assign(plan, { canEdit: true, updateBoard: vi.fn(), types: ITEM_TYPES });
      const el = { ...board, planBoard: setupOf } as ShapeElement;
      render(<PlanBoardMenuSections element={el} flyoutProps={() => ({})} />);
      expect(screen.queryByRole('button', { name: 'Columns' })).toBeNull();
      cleanup();
    }
  });
});

// docs/specs/026-plan/plan-board.md "Swimlanes by a field".
describe('Swimlanes by a field', () => {
  const types = [
    {
      ...ITEM_TYPES[0],
      fields: [...ITEM_TYPES[0].fields, 'f-customer'],
      custom: [{ id: 'f-customer', label: 'Customer', kind: 'text' as const }],
    },
  ];

  it('offers a tile per field, and lanes the board by the one pressed', () => {
    const updateBoard = vi.fn();
    showBody(PlanSwimlaneSettings, { types, updateBoard });
    fireEvent.click(screen.getByRole('radio', { name: 'Customer' }));
    expect(updateBoard).toHaveBeenCalledWith(
      'board',
      expect.objectContaining({ swimlaneBy: 'field', swimlaneField: 'f-customer' }),
    );
    expect(screen.getByRole('radio', { name: 'Labels' })).toBeTruthy();
  });

  // "Swimlanes": a board's columns are its statuses, so Status is offered only on an All Cards board.
  it('never offers Status on a board of status columns, but does on All Cards', () => {
    showBody(PlanSwimlaneSettings, { types });
    expect(screen.getByRole('radio', { name: 'None' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Status' })).toBeNull();
    cleanup();
    for (const key of Object.keys(plan)) delete plan[key];
    Object.assign(plan, { canEdit: true, updateBoard: vi.fn(), announce: vi.fn(), types });
    render(<PlanSwimlaneSettings element={{ ...board, planBoard: presetSetup('all-cards') }} />);
    expect(screen.getByRole('radio', { name: 'Status' })).toBeTruthy();
  });

  it('drops the field when a plain swimlane is chosen', () => {
    const updateBoard = vi.fn();
    cleanup();
    const laned = {
      ...board,
      planBoard: { ...presetSetup('kanban'), swimlaneBy: 'field', swimlaneField: 'labels' },
    } as ShapeElement;
    for (const key of Object.keys(plan)) delete plan[key];
    Object.assign(plan, { canEdit: true, updateBoard, announce: vi.fn(), types });
    render(<PlanSwimlaneSettings element={laned} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Assignee' }));
    const next: unknown = updateBoard.mock.calls[0]![1];
    expect(next).toMatchObject({ swimlaneBy: 'assignee' });
    expect(next).toEqual(expect.not.objectContaining({ swimlaneField: expect.anything() }));
  });
});

// docs/specs/026-plan/plan-board.md "The board set-up": Sort Cards, up to two fields.
describe('Sort Cards', () => {
  const types = [
    {
      ...ITEM_TYPES[1],
      fields: [...ITEM_TYPES[1].fields, 'f-value'],
      custom: [{ id: 'f-value', label: 'Value', kind: 'currency' as const }],
    },
  ];
  const sortedBoard = (sortBy: unknown) =>
    ({ ...board, planBoard: { ...presetSetup('kanban'), sortBy } }) as ShapeElement;
  const showSort = (element: ShapeElement, overrides: Record<string, unknown> = {}) => {
    const updateBoard = vi.fn();
    for (const key of Object.keys(plan)) delete plan[key];
    Object.assign(plan, { canEdit: true, updateBoard, announce: vi.fn(), types }, overrides);
    render(<PlanSortCardsSettings element={element} />);
    return updateBoard;
  };
  const sent = (update: ReturnType<typeof vi.fn>): unknown => update.mock.calls[0]![1];

  it('offers None and the fields the board’s types can sort by, and sorts by the one pressed', () => {
    const updateBoard = showSort(board);
    const group = screen.getByRole('radiogroup', { name: 'Sort By' });
    expect(group.getAttribute('aria-label')).toBe('Sort By');
    expect(screen.getByRole('radio', { name: 'None' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Value' })).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: 'Then By' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Priority' }));
    expect(sent(updateBoard)).toMatchObject({ sortBy: [{ field: 'priority', dir: 'desc' }] });
  });

  it('shows a sorted board’s directions and Then By, and changes each', () => {
    const updateBoard = showSort(sortedBoard([{ field: 'priority', dir: 'desc' }]));
    expect(screen.getByRole('radio', { name: 'Highest First' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    const thenBy = screen.getByRole('radiogroup', { name: 'Then By' });
    // Then By never offers Sort By's field.
    expect(thenBy.textContent).not.toContain('Priority');
    fireEvent.click(screen.getByRole('radio', { name: 'Lowest First' }));
    expect(sent(updateBoard)).toMatchObject({ sortBy: [{ field: 'priority', dir: 'asc' }] });
    fireEvent.click(screen.getAllByRole('radio', { name: 'Due Date' }).at(-1)!);
    expect(updateBoard.mock.calls[1]![1]).toMatchObject({
      sortBy: [
        { field: 'priority', dir: 'desc' },
        { field: 'due', dir: 'asc' },
      ],
    });
  });

  it('turns sorting off with None, storing no sort', () => {
    const updateBoard = showSort(
      sortedBoard([
        { field: 'priority', dir: 'desc' },
        { field: 'due', dir: 'asc' },
      ]),
    );
    expect(screen.getByRole('radio', { name: 'Earliest First' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('radio', { name: 'None' })[0]!);
    expect(sent(updateBoard)).toEqual(expect.not.objectContaining({ sortBy: expect.anything() }));
  });

  it('keeps a field in use that the shown types no longer offer, by name or id', () => {
    showSort(sortedBoard([{ field: 'f-value', dir: 'desc' }]), { types: ITEM_TYPES });
    expect(screen.queryByRole('radio', { name: 'Value' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'f-value' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    cleanup();
    showSort(sortedBoard([{ field: 'f-value', dir: 'desc' }]), {
      types: [{ ...types[0], fields: ITEM_TYPES[1].fields }],
    });
    expect(screen.getByRole('radio', { name: 'Value' }).getAttribute('aria-checked')).toBe('true');
  });

  // docs/specs/013-workspace/share-roles.md: a board's settings are an Editor's.
  it('shows nothing to someone who may not edit the board, nor without a plan’s types', () => {
    showSort(board, { canEdit: false });
    expect(screen.queryByRole('radiogroup', { name: 'Sort By' })).toBeNull();
    cleanup();
    showSort(board, { types: undefined });
    expect(screen.getByRole('radio', { name: 'None' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Priority' })).toBeNull();
  });
});

// docs/specs/026-plan/plan-board.md "Card types a board shows": the Cards flyout's Card Types tiles filter the board.
describe('Card Types', () => {
  it('names the group Card Types and turns a hidden type back on', () => {
    const updateBoard = vi.fn();
    for (const key of Object.keys(plan)) delete plan[key];
    Object.assign(plan, { canEdit: true, updateBoard, announce: vi.fn(), types: ITEM_TYPES });
    render(<PlanSupportedCardsSettings element={board} />);
    expect(screen.getByRole('heading', { name: 'Card Types' })).toBeTruthy();
    expect(screen.queryByText('New Cards Can Be')).toBeNull();
    // Kanban shows Task, Action and Note: pressing Project shows Projects too.
    // The first Project tile is the type's (the Show on Cards group has a Project field tile too).
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Project' })[0]!);
    expect(updateBoard.mock.calls[0]![1]).toHaveProperty(
      'addTypes',
      expect.arrayContaining(['project']),
    );
  });
});

// docs/specs/026-plan/plan-board.md "Card types a board shows": a board whose chosen types were all deleted
// shows and takes every type again, and its Card Types tiles say so.
describe('Card Types after a type is deleted', () => {
  it('shows every type pressed, and a change stores only current types', () => {
    const updateBoard = vi.fn();
    cleanup();
    const stale = {
      ...board,
      planBoard: { ...presetSetup('kanban'), addTypes: ['customer-call'] },
    } as ShapeElement;
    for (const key of Object.keys(plan)) delete plan[key];
    Object.assign(plan, { canEdit: true, updateBoard, announce: vi.fn(), types: ITEM_TYPES });
    render(<PlanSupportedCardsSettings element={stale} />);
    // The Card Types tiles come first (a card field such as Project shares a name).
    const tile = (name: string) => screen.getAllByRole('checkbox', { name })[0]!;
    for (const t of ITEM_TYPES) expect(tile(t.label).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(tile('Note'));
    expect(updateBoard.mock.calls[0]![1]).toHaveProperty(
      'addTypes',
      ITEM_TYPES.map((t) => t.id).filter((id) => id !== 'note'),
    );
  });
});

// docs/specs/004-interface-design/menus.md: a menu's categories stay collapsible rows, never promoted inline.
describe('the board menu’s sections', () => {
  it('stay flyouts, never promoted into the menu', () => {
    for (const k of Object.keys(plan)) delete plan[k];
    Object.assign(plan, { canEdit: true, updateBoard: vi.fn(), announce: vi.fn(), types: [] });
    render(<PlanBoardMenuSections element={board} flyoutProps={() => ({})} />);
    for (const title of ['Board Setup', 'Columns', 'Swimlanes', 'Card Layout'])
      expect(document.querySelector(`[data-flyout="${title}"]`)?.getAttribute('data-panel')).toBe(
        'yes',
      );
  });
});

// docs/specs/026-plan/plan-board.md "Setup Board": run again from a board's Board Setup.
describe('Setup Board under the title', () => {
  it('reopens the setup dialog for the board and closes what holds it', async () => {
    const { PlanBoardSettings } = await import('./PlanBoardMenuSection');
    const store = await import('@/lib/setup-dialog-store');
    store.resetSetupDialogs();
    for (const key of Object.keys(plan)) delete plan[key];
    Object.assign(plan, { canEdit: true, updateBoard: vi.fn() });
    const onClose = vi.fn();
    render(<PlanBoardSettings element={board} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Setup Board' }));
    expect(onClose).toHaveBeenCalled();
    expect(renderHook(() => store.useSetupOpen('board')).result.current).toBe('again');
  });
});

// docs/specs/026-plan/plan-tabs.md "Editing": in a Dashboard slot the board's cog holds the slot's Slot section after
// the board's own, one section open at a time across both.
describe('the board panel with a slot’s section', () => {
  it('adds the section last, opening it closes Board Setup', () => {
    Object.assign(plan, { canEdit: true, types: ITEM_TYPES, updateBoard: vi.fn() });
    render(
      <PlanBoardSectionsPanel
        element={board}
        more={(section) => {
          const { open, onToggle } = section('slot');
          return (
            <button type="button" aria-expanded={open} onClick={onToggle}>
              Slot
            </button>
          );
        }}
      />,
    );
    const slot = screen.getByRole('button', { name: 'Slot' });
    expect(slot.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: /Board Setup/ }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    fireEvent.click(slot);
    expect(slot.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /Board Setup/ }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });
});
