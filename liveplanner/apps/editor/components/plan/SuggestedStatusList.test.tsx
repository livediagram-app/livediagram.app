// @vitest-environment jsdom
// docs/specs/026-plan/plan-board.md "Suggested statuses": Setup Board's Columns step suggests the common states when
// the project has none to offer, each added with one press (Add All for the lot), and only an Editor ever sees them.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, PLAN_COLUMNS_MAX, type PlanBoardSetup } from '@liveplanner/items';
import { markPlacedHere, resetSetupDialogs } from '@/lib/setup-dialog-store';
import { planPalette } from './plan-palette';
import { PlanSetupBoard } from './PlanSetupBoard';
import { SetupBoardHost } from './SetupBoardHost';
import { SetupColumnsStep } from './setup-board-steps';
import type { SetupColumn } from './setup-board';
import { SuggestedStatusList } from './SuggestedStatusList';

const track = vi.fn<(part: string) => void>();
vi.mock('./track-board-setup', () => ({ trackSetup: (part: string) => track(part) }));
const plan = {
  canEdit: true,
  types: ITEM_TYPES,
  updateBoard: vi.fn(),
  notify: vi.fn(),
  announce: vi.fn(),
  editType: vi.fn(),
};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));

beforeEach(() => {
  vi.clearAllMocks();
  resetSetupDialogs();
});
afterEach(cleanup);

const palette = planPalette('light', {});
const suggested = () =>
  within(screen.getByRole('group', { name: 'Suggested States' }))
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label'));

// The Columns step on its own, with the chosen columns kept in state by the caller's onChange.
function step(chosen: SetupColumn[], statusNames: ReadonlyMap<string, string> = new Map()) {
  const onChange = vi.fn<(next: SetupColumn[]) => void>();
  const view = render(
    <SetupColumnsStep
      chosen={chosen}
      statusNames={statusNames}
      max={PLAN_COLUMNS_MAX}
      palette={palette}
      onChange={onChange}
    />,
  );
  return { onChange, view };
}

describe('Setup Board’s Suggested States', () => {
  it('suggests the five common states on a plan with none, Done last', () => {
    step([]);
    expect(suggested()).toEqual([
      'Add Backlog',
      'Add To Do',
      'Add In Progress',
      'Add In Review',
      'Add Done',
    ]);
    expect(screen.getByText('Ready to start')).toBeTruthy();
    expect(screen.queryByText('Use an Existing State')).toBeNull();
  });

  it('adds one as a new state with a press, and tracks it', () => {
    const { onChange } = step([{ kind: 'new', name: 'Waiting' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Add To Do' }));
    expect(onChange).toHaveBeenCalledWith([
      { kind: 'new', name: 'Waiting' },
      { kind: 'new', name: 'To Do' },
    ]);
    expect(track).toHaveBeenCalledWith('ColumnAddedSuggested');
  });

  it('keeps the order a board runs whatever order they are pressed in, Done last', () => {
    const three: SetupColumn[] = ['To Do', 'In Progress', 'Done'].map((name) => ({
      kind: 'new',
      name,
    }));
    const { onChange } = step(three);
    fireEvent.click(screen.getByRole('button', { name: 'Add In Review' }));
    expect(onChange.mock.lastCall![0].map((c) => c.name)).toEqual([
      'To Do',
      'In Progress',
      'In Review',
      'Done',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Add All' }));
    expect(onChange.mock.lastCall![0].map((c) => c.name)).toEqual([
      'Backlog',
      'To Do',
      'In Progress',
      'In Review',
      'Done',
    ]);
  });

  it('leaves out the states already chosen, as names compare', () => {
    step([
      { kind: 'new', name: 'to do' },
      { kind: 'new', name: 'DONE' },
    ]);
    expect(suggested()).toEqual(['Add Backlog', 'Add In Progress', 'Add In Review']);
  });

  it('adds them all in order with Add All, up to the column limit', () => {
    const near = Array.from({ length: PLAN_COLUMNS_MAX - 2 }, (_, i): SetupColumn => ({
      kind: 'new',
      name: `Stage ${i}`,
    }));
    const { onChange } = step(near);
    fireEvent.click(screen.getByRole('button', { name: 'Add All' }));
    const next = onChange.mock.lastCall![0];
    expect(next).toHaveLength(PLAN_COLUMNS_MAX);
    expect(next.slice(-2).map((c) => c.name)).toEqual(['Backlog', 'To Do']);
    expect(track).toHaveBeenCalledWith('ColumnAddedSuggested');
  });

  it('turns the rows and Add All off at the column limit', () => {
    const full = Array.from({ length: PLAN_COLUMNS_MAX }, (_, i): SetupColumn => ({
      kind: 'new',
      name: `Stage ${i}`,
    }));
    step(full);
    const rows = within(screen.getByRole('group', { name: 'Suggested States' })).getAllByRole(
      'button',
    );
    for (const row of rows) expect(row).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Add All' })).toHaveProperty('disabled', true);
  });

  it('suggests nothing while the project has a state to use', () => {
    step([], new Map([['todo', 'To Do']]));
    expect(screen.getByText('Use an Existing State')).toBeTruthy();
    expect(screen.queryByText('Suggested States')).toBeNull();
  });

  it('suggests what the project lacks once its states are all chosen', () => {
    step([{ kind: 'existing', status: 'todo', name: 'To Do' }], new Map([['todo', 'To Do']]));
    expect(screen.queryByText('Use an Existing State')).toBeNull();
    expect(suggested()).not.toContain('Add To Do');
  });

  it('creates the board with the suggestions picked, through the whole dialog', () => {
    const onSetUp = vi.fn<(columns: SetupColumn[]) => void>();
    render(
      <PlanSetupBoard
        boardId="b"
        onClose={vi.fn()}
        layout={{ swimlaneBy: 'none', fillTab: false }}
        types={ITEM_TYPES}
        statusNames={new Map()}
        onSetUp={onSetUp}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Columns' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add To Do' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add In Progress' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Layout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create Board' }));
    expect(onSetUp.mock.lastCall![0].map((c) => c.name)).toEqual(['To Do', 'In Progress', 'Done']);
  });
});

describe('who sees the suggestions', () => {
  const UNSET = { title: 'Roadmap', columns: [] } as unknown as PlanBoardSetup;
  const host = (canEdit: boolean) => (
    <SetupBoardHost
      elementId="board1"
      setup={UNSET}
      palette={palette}
      canEdit={canEdit}
      pickable={new Map()}
    />
  );

  it('an Editor reaches them from Set up board', async () => {
    render(host(true));
    fireEvent.click(screen.getByRole('button', { name: 'Set up board' }));
    await screen.findByRole('dialog', { name: 'Set up your board' });
    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Columns' }));
    expect(suggested()).toHaveLength(5);
  });

  it('a Participant or a Viewer never does: no Set up board, no dialog, even on a board placed here', () => {
    markPlacedHere('board1');
    render(host(false));
    expect(screen.queryByRole('button', { name: 'Set up board' })).toBeNull();
    expect(screen.getByText('Someone who can edit it will set it up.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Suggested States')).toBeNull();
  });
});

describe('SuggestedStatusList', () => {
  it('renders nothing with no suggestions', () => {
    const { container } = render(
      <SuggestedStatusList
        heading="Suggested Statuses"
        suggestions={[]}
        onPick={vi.fn()}
        onPickAll={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });
});
