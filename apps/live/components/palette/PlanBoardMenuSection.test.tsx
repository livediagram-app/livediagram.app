// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livediagram/document';
import { ITEM_TYPES, presetSetup } from '@livediagram/items';
import {
  PlanBoardMenuSections,
  PlanSupportedCardsSettings,
  PlanSwimlaneSettings,
} from './PlanBoardMenuSection';

// docs/specs/026-plan/plan-board.md "The board set-up": four sections, a flyout each.
const plan: Record<string, unknown> = {};
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@/components/primitives/MenuFlyoutSection', () => ({
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
  render(<PlanBoardMenuSections element={board} flyoutProps={() => ({}) as never} />);
}

describe('PlanBoardMenuSections', () => {
  it('is one Board flyout holding Board Title, Board Swimlanes, Supported Cards and Card Layout', () => {
    show({ types: ITEM_TYPES });
    expect(
      [...document.querySelectorAll('[data-flyout]')].map((f) => f.getAttribute('data-flyout')),
    ).toEqual(['Board']);
    expect(
      screen
        .getAllByRole('button', { expanded: true })
        .concat(screen.getAllByRole('button', { expanded: false }))
        .map((b) => b.textContent),
    ).toEqual(['Board Title', 'Board Swimlanes', 'Supported Cards', 'Card Layout']);
  });

  it('keeps Add to Slides off the title (it is in the board’s own ⋯ menu)', () => {
    show({ addBoardSlide: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Add to Slides' })).toBeNull();
  });

  it('leaves Supported Cards out on an Archive board', () => {
    for (const key of Object.keys(plan)) delete plan[key];
    Object.assign(plan, { canEdit: true, updateBoard: vi.fn(), types: ITEM_TYPES });
    const archive = { ...board, planBoard: presetSetup('archive') } as ShapeElement;
    render(<PlanBoardMenuSections element={archive} flyoutProps={() => ({}) as never} />);
    expect(screen.queryByRole('button', { name: 'Supported Cards' })).toBeNull();
  });
});

// docs/specs/026-plan/plan-board.md "Swimlanes by a field".
describe('Swimlanes by a field', () => {
  const types = [
    {
      ...ITEM_TYPES[0]!,
      fields: [...ITEM_TYPES[0]!.fields, 'f-customer'],
      custom: [{ id: 'f-customer', label: 'Customer', kind: 'text' as const }],
    },
  ];

  it('offers a tile per field, and lanes the board by the one pressed', () => {
    const updateBoard = vi.fn();
    showBody(PlanSwimlaneSettings, { types, updateBoard });
    fireEvent.click(screen.getByRole('button', { name: 'Customer' }));
    expect(updateBoard).toHaveBeenCalledWith(
      'board',
      expect.objectContaining({ swimlaneBy: 'field', swimlaneField: 'f-customer' }),
    );
    expect(screen.getByRole('button', { name: 'Labels' })).toBeTruthy();
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
    fireEvent.click(screen.getByRole('button', { name: 'Assignee' }));
    const next = updateBoard.mock.calls[0]![1];
    expect(next.swimlaneBy).toBe('assignee');
    expect(next.swimlaneField).toBeUndefined();
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
    fireEvent.click(screen.getAllByRole('button', { name: 'Project' })[0]!);
    expect(updateBoard.mock.calls[0]![1].addTypes).toContain('project');
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
    const tile = (name: string) => screen.getAllByRole('button', { name })[0]!;
    for (const t of ITEM_TYPES) expect(tile(t.label).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(tile('Note'));
    expect(updateBoard.mock.calls[0]![1].addTypes).toEqual(
      ITEM_TYPES.map((t) => t.id).filter((id) => id !== 'note'),
    );
  });
});

// docs/specs/004-interface-design/menus.md: a menu's categories stay collapsible rows, never promoted inline.
describe('the board menu’s sections', () => {
  it('stay flyouts, never promoted into the menu', () => {
    for (const k of Object.keys(plan)) delete plan[k];
    Object.assign(plan, { canEdit: true, updateBoard: vi.fn(), announce: vi.fn(), types: [] });
    render(<PlanBoardMenuSections element={board} flyoutProps={() => ({}) as never} />);
    for (const title of ['Board'])
      expect(document.querySelector(`[data-flyout="${title}"]`)?.getAttribute('data-panel')).toBe(
        'yes',
      );
  });
});

// docs/specs/026-plan/plan-board.md "Setup Board": run again from a board's Board Title.
describe('Setup Board under the title', () => {
  it('reopens the setup screen on the board and closes what holds it', async () => {
    const { PlanBoardSettings } = await import('./PlanBoardMenuSection');
    for (const key of Object.keys(plan)) delete plan[key];
    const openBoardSetup = vi.fn();
    Object.assign(plan, { canEdit: true, updateBoard: vi.fn(), openBoardSetup });
    const onClose = vi.fn();
    render(<PlanBoardSettings element={board} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Setup Board' }));
    expect(onClose).toHaveBeenCalled();
    expect(openBoardSetup).toHaveBeenCalledWith('board');
  });
});
