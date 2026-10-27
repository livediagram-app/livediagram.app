// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, presetSetup, type Item } from '@liveplanner/items';
import type { ShapeElement } from '@liveplanner/project';
import { PlanBoardView } from './PlanBoardView';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { DashboardContext, type DashboardContextValue } from './dashboard/dashboard-context';
import { SlotSettings, type SlotSettingsValue } from './dashboard/slot-menu';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { maximisePlanElement, releasePlanElement } from '@/hooks/plan/maximised-plan';
import { FormBoardContext, type FormBoardValue } from '@/components/forms/form-board-context';

// docs/specs/026-plan/plan-tabs.md "A board in a slot is simplified": in a Dashboard slot an Editor still works the
// cards (Add card, the column counts and WIP limits, the saved widgets), but the board's set-up is not offered there:
// no column cogs, no widget +, no Add New Card Type, no renaming, and the cog is the slot's own.
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

const draw = (opts: { dashboard: boolean; value?: PlanContextValue }) => {
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
          {wrap(<PlanBoardView element={board} />)}
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
    // The cards, Add card and each column's count against its WIP limit stay.
    expect(screen.getByText('Write the plan')).toBeTruthy();
    expect(
      screen.getAllByRole('button', { name: /Add (your first )?card/ }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/of a WIP limit of 3/).length).toBeGreaterThan(0);
    // No column cogs, no Board Settings: the slot's own cog instead.
    expect(document.querySelector('[data-column-cog]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Board Settings' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Slot Settings' })).toBeTruthy();
    // The saved widget shows, read-only: no + to add one, nothing to carry or take off.
    expect(screen.queryByRole('button', { name: 'Add a widget' })).toBeNull();
    expect(screen.queryByRole('listitem', { name: /widget$/ })).toBeNull();
    expect(screen.getByRole('list', { name: 'Board widgets' })).toBeTruthy();
    // The title is not renamed here.
    fireEvent.doubleClick(screen.getByText('Sprint'));
    expect(screen.queryByRole('textbox')).toBeNull();
    // Maximise stays.
    expect(screen.getByRole('button', { name: /Maximise/ })).toBeTruthy();
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
