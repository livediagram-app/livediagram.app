// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXAMPLE_FIELD, ITEM_TYPES, presetSetup, type Item } from '@liveplanner/items';
import type { ShapeElement } from '@liveplanner/project';
import { PlanBoardView } from './PlanBoardView';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { DashboardContext, type DashboardContextValue } from './dashboard/dashboard-context';
import { SlotSettings, type SlotSettingsValue } from './dashboard/slot-menu';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { maximisePlanElement, releasePlanElement } from '@/hooks/plan/maximised-plan';
import { FormBoardContext, type FormBoardValue } from '@/components/forms/form-board-context';

// docs/specs/026-plan/plan-tabs.md "A board in a slot is simplified": in a Dashboard slot the board is a compact one for
// working its cards (moving, opening and adding them, each column's count against its WIP limit), with nothing that sets
// it up: no column cogs, no widgets, no example cards' notice, no Add New Card Type, no renaming, no swimlanes, and the
// cog is the slot's own. The share roles are a Board tab's.
afterEach(() => {
  releasePlanElement('b1');
  cleanup();
  vi.unstubAllGlobals();
});

const card: Item = {
  id: 'i1',
  key: 1,
  type: 'task',
  fields: { title: 'Write the plan', status: 'todo' },
  rank: 'a0',
  createdAt: 0,
  updatedAt: 0,
} as unknown as Item;

// A second card, urgent, so a board by priority has two rows and a Minimal card a bit to show.
const urgent: Item = {
  ...card,
  id: 'i2',
  key: 2,
  fields: { title: 'Fix the login', status: 'todo', priority: 'urgent' },
  rank: 'a1',
};
const twoCards = () =>
  new Map([
    [card.id, card],
    [urgent.id, urgent],
  ]);

const plan = (over: Partial<PlanContextValue> = {}): PlanContextValue =>
  ({
    items: new Map([[card.id, card]]),
    types: ITEM_TYPES,
    status: 'ready',
    self: null,
    people: [],
    canEdit: true,
    canEditCards: true,
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
    createTypeForBoard: vi.fn(),
    announce: vi.fn(),
    ...over,
  }) as unknown as PlanContextValue;

const board: ShapeElement = {
  id: 'b1',
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 0,
  width: 1200,
  height: 600,
  planBoard: {
    ...presetSetup('kanban'),
    title: 'Sprint',
    widgets: ['progress'],
    columns: presetSetup('kanban').columns.map((c, i) => (i === 0 ? { ...c, wipLimit: 3 } : c)),
  },
} as unknown as ShapeElement;

const slot: SlotSettingsValue = {
  sections: () => null,
  cog: <button type="button">Slot Settings</button>,
  toolbar: () => null,
};

// A form sending its responses to the board: its strip leads the widgets where the board is whole.
const forms: FormBoardValue = {
  forms: [{ tabId: 'f1', heading: 'Bug Report' }],
  projectId: 'd1',
  ownerId: 'me',
  share: null,
  online: true,
  canShare: true,
  openTab: vi.fn(),
};

// The board's set-up, there or not: column cogs, Board Settings, the widget +, the Form strip.
const setUpShown = () => ({
  columnCogs: document.querySelectorAll('[data-column-cog]').length > 0,
  boardSettings: !!screen.queryByRole('button', { name: 'Board Settings' }),
  addWidget: !!screen.queryByRole('button', { name: 'Add a widget' }),
  formStrip: !!document.querySelector('[data-form-strip]'),
});
const WHOLE = { columnCogs: true, boardSettings: true, addWidget: true, formStrip: true };
const SIMPLIFIED = { columnCogs: false, boardSettings: false, addWidget: false, formStrip: false };

const draw = (opts: { dashboard: boolean; value?: PlanContextValue; element?: ShapeElement }) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({ link: null, responses: 0, unseen: 0, suspendedAt: null, canPublish: true }),
    ),
  );
  const wrap = (children: ReactNode) =>
    opts.dashboard ? (
      <DashboardContext.Provider value={{} as DashboardContextValue}>
        <SlotSettings.Provider value={slot}>{children}</SlotSettings.Provider>
      </DashboardContext.Provider>
    ) : (
      children
    );
  render(
    <SelectionStoreProvider store={createSelectionStore()}>
      <PlanProvider value={opts.value ?? plan()}>
        <FormBoardContext.Provider value={forms}>
          {wrap(<PlanBoardView element={opts.element ?? board} />)}
        </FormBoardContext.Provider>
      </PlanProvider>
    </SelectionStoreProvider>,
  );
};

describe('a board in a Dashboard slot', () => {
  it('offers its set-up on a Board tab: column cogs and Board Settings', () => {
    draw({ dashboard: false });
    expect(setUpShown()).toEqual(WHOLE);
    expect(document.querySelectorAll('[data-column-cog]').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Board Settings' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a widget' })).toBeTruthy();
    expect(screen.getByRole('listitem', { name: /widget$/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Slot Settings' })).toBeNull();
    fireEvent.doubleClick(screen.getByText('Sprint'));
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it("keeps an Editor's card work and drops the board's set-up", () => {
    draw({ dashboard: true });
    expect(setUpShown()).toEqual(SIMPLIFIED);
    // The compact header and column heads, the cards and each column's count against its WIP limit stay.
    expect(document.querySelector('[data-slot-board-header]')).toBeTruthy();
    expect(document.querySelectorAll('[data-slot-column-head]').length).toBe(
      presetSetup('kanban').columns.length,
    );
    expect(screen.getByText('Write the plan')).toBeTruthy();
    expect(screen.getAllByLabelText(/of a WIP limit of 3/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('1 card')).toBeTruthy();
    // Add card is each column head's +, not a row under the cards.
    expect(screen.getByRole('button', { name: 'Add a card to To Do' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Add (your first )?card$/ })).toBeNull();
    // No column cogs, no Board Settings: the slot's own cog instead.
    expect(screen.queryByRole('button', { name: 'Board Settings' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Slot Settings' })).toBeTruthy();
    // No widgets at all, saved or to add.
    expect(screen.queryByRole('list', { name: 'Board widgets' })).toBeNull();
    // The title is not renamed here.
    fireEvent.doubleClick(screen.getByText('Sprint'));
    expect(screen.queryByRole('textbox')).toBeNull();
    // Maximise stays, among the controls the header reveals.
    expect(
      document
        .querySelector('[data-slot-board-controls]')
        ?.contains(screen.getByRole('button', { name: /Maximise/ })),
    ).toBe(true);
  });

  it('adds a card from a column head, at the foot of that column, opened to be named', () => {
    const value = plan();
    draw({ dashboard: true, value });
    fireEvent.click(screen.getByRole('button', { name: 'Add a card to To Do' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Task/ }));
    expect(value.addItem).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'task', status: 'todo', after: 'i1' }),
    );
    expect(value.openNewItem).toHaveBeenCalled();
    // Pressed again while open, the + closes its menu.
    const plus = screen.getByRole('button', { name: 'Add a card to Backlog' });
    fireEvent.click(plus);
    expect(plus.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(plus);
    expect(plus.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a card on a click, for every role', () => {
    for (const roles of [
      { canEdit: true, canEditCards: true },
      { canEdit: false, canEditCards: true },
      { canEdit: false, canEditCards: false },
    ]) {
      const value = plan(roles);
      draw({ dashboard: true, value });
      fireEvent.keyDown(screen.getByRole('listitem', { name: /Write the plan/ }), { key: 'Enter' });
      expect(value.openItem).toHaveBeenCalledWith('i1');
      cleanup();
    }
  });

  it('lets a Participant add cards, and a Viewer only look', () => {
    draw({ dashboard: true, value: plan({ canEdit: false, canEditCards: true }) });
    expect(screen.getByRole('button', { name: 'Add a card to To Do' })).toBeTruthy();
    expect(setUpShown()).toEqual(SIMPLIFIED);
    cleanup();
    draw({ dashboard: true, value: plan({ canEdit: false, canEditCards: false }) });
    expect(screen.queryByRole('button', { name: /^Add a card to/ })).toBeNull();
    expect(screen.getByText('Write the plan')).toBeTruthy();
  });

  it('leaves the example cards notice on the tab', () => {
    const example = { ...card, fields: { ...card.fields, [EXAMPLE_FIELD]: true } } as Item;
    draw({ dashboard: false, value: plan({ items: new Map([[card.id, example]]) }) });
    expect(screen.getByRole('button', { name: 'Clear Example Cards' })).toBeTruthy();
    cleanup();
    draw({ dashboard: true, value: plan({ items: new Map([[card.id, example]]) }) });
    expect(screen.queryByRole('button', { name: 'Clear Example Cards' })).toBeNull();
  });

  it('draws a board with swimlanes in plain columns in a slot', () => {
    const laned = {
      ...board,
      planBoard: { ...board.planBoard!, swimlaneBy: 'priority' },
    } as ShapeElement;
    const columns = presetSetup('kanban').columns.length;
    const cells = () =>
      screen.getAllByRole('list').filter((l) => /items?$/.test(l.getAttribute('aria-label') ?? ''));
    draw({ dashboard: false, element: laned, value: plan({ items: twoCards() }) });
    // On its tab, a row per priority: two rows of cells.
    expect(cells()).toHaveLength(columns * 2);
    cleanup();
    draw({ dashboard: true, element: laned, value: plan({ items: twoCards() }) });
    // In a slot, one row, and the column heads' + rather than a row's Add card.
    expect(cells()).toHaveLength(columns);
    expect(screen.getByRole('button', { name: 'Add a card to To Do' })).toBeTruthy();
  });

  it('draws narrow columns with Minimal cards, stacked', () => {
    draw({ dashboard: true, value: plan({ items: twoCards() }) });
    // jsdom measures the body 0 wide: the columns are at their floor, so the cards are Minimal and stacked.
    const title = screen.getByText('Fix the login');
    expect(title.style.fontSize).toBe('12.5px');
  });

  it('is the whole board while maximised from the slot, and simplified again once restored', () => {
    draw({ dashboard: true });
    expect(setUpShown()).toEqual(SIMPLIFIED);
    expect(screen.getByRole('button', { name: 'Slot Settings' })).toBeTruthy();
    act(() => maximisePlanElement('b1'));
    expect(setUpShown()).toEqual(WHOLE);
    // Board Settings (the slot's section after the board's) in place of the slot's own cog.
    expect(screen.queryByRole('button', { name: 'Slot Settings' })).toBeNull();
    act(() => releasePlanElement('b1'));
    expect(setUpShown()).toEqual(SIMPLIFIED);
    expect(screen.getByRole('button', { name: 'Slot Settings' })).toBeTruthy();
  });

  it('shows a Viewer with no slot settings no cog at all', () => {
    render(
      <SelectionStoreProvider store={createSelectionStore()}>
        <PlanProvider value={plan({ canEdit: false, canEditCards: false })}>
          <DashboardContext.Provider value={{} as DashboardContextValue}>
            <PlanBoardView element={board} />
          </DashboardContext.Provider>
        </PlanProvider>
      </SelectionStoreProvider>,
    );
    expect(screen.queryByRole('button', { name: 'Board Settings' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Slot Settings' })).toBeNull();
    expect(screen.getByText('Write the plan')).toBeTruthy();
  });
});
