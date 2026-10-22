// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardSlot, Tab } from '@livepages/document';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { DashboardSlotView } from './DashboardSlotView';

// What the slot shows, drawing the slot's own cog where a header with no cog of its own would (slot-menu.ts).
vi.mock('./DashboardSlotContent', async () => {
  const { useSlotSettings } = await import('./slot-menu');
  return { DashboardSlotContent: () => <div>{useSlotSettings()?.cog}</div> };
});

// docs/specs/026-plan/plan-tabs.md "Clearing a slot".
afterEach(cleanup);

function show(slot: DashboardSlot, over: Partial<DashboardContextValue> = {}) {
  const actions = {
    setSlotContent: vi.fn(),
    placeItem: vi.fn(),
    removeSlot: vi.fn(),
    changeDashboard: vi.fn(),
  } as unknown as DashboardContextValue['actions'];
  const value: DashboardContextValue = {
    tabs: [{ id: 't', name: 'Launch', kind: 'board', elements: [] } as unknown as Tab],
    elements: new Map(),
    canEdit: true,
    actions,
    openTab: vi.fn(),
    tabStatus: () => 'loaded',
    retryTab: vi.fn(),
    deleteTab: vi.fn(),
    releaseSheets: vi.fn(() => true),
    ...over,
  };
  render(
    <DashboardContext.Provider value={value}>
      <DashboardSlotView rowId="r" slot={slot} at={{ slot: 0, row: 0, slots: 2 }} />
    </DashboardContext.Provider>,
  );
  return value;
}

const openMenu = () =>
  fireEvent.click(screen.getAllByRole('button', { name: 'Slot Settings' })[0]!);

describe('clearing a slot', () => {
  it('asks whether to delete the tab it showed, and does both when asked', () => {
    const v = show({ id: 's', span: 6, content: { type: 'tab', tabId: 't', of: 'board' } });
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Slot' }));
    expect(screen.getByText(/Delete the Launch tab too\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete the Tab Too' }));
    expect(v.actions.setSlotContent).toHaveBeenCalledWith('s', undefined);
    expect(v.deleteTab).toHaveBeenCalledWith('t');
  });

  it('keeps the tab when asked to', () => {
    const v = show({ id: 's', span: 6, content: { type: 'tab', tabId: 't', of: 'board' } });
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Slot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep the Tab' }));
    expect(v.actions.removeSlot).toHaveBeenCalledWith('r', 's');
    expect(v.deleteTab).not.toHaveBeenCalled();
  });

  it('clears a note at once, with nothing more to ask', () => {
    const v = show({ id: 's', span: 6, content: { type: 'note', title: 'N', text: '' } });
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Slot' }));
    expect(v.actions.setSlotContent).toHaveBeenCalledWith('s', undefined);
  });
});

// plan-tabs.md "Share roles": a Participant or Viewer looks and opens; nothing reshapes the dashboard.
describe('share roles', () => {
  it('gives an Editor the grip and Add to Slot', () => {
    show({ id: 's', span: 6 }, { beginMove: vi.fn() });
    expect(screen.getByRole('button', { name: 'Move Slot' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add to Slot/ })).toBeTruthy();
  });

  it('gives anyone who may not edit neither, the slot titled Empty Slot with no line under it', () => {
    show({ id: 's', span: 6 }, { canEdit: false });
    expect(screen.queryByRole('button', { name: 'Move Slot' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Add to Slot/ })).toBeNull();
    expect(screen.getByText('Empty Slot')).toBeTruthy();
    expect(screen.queryByText(/waiting|drag it in/)).toBeNull();
  });
});

// plan-tabs.md "Moving a slot" (on a touch screen): the grip waits for no hover, has a finger's tap area, and sits in
// the top left corner of a slot with no header of its own.
describe('the grip on a touch screen', () => {
  it('is always shown there, with a finger’s tap area, in an unheaded slot’s corner', () => {
    show({ id: 's', span: 6 }, { beginMove: vi.fn() });
    const grip = screen.getByRole('button', { name: 'Move Slot' }).className;
    expect(grip).toMatch(/\btouch-target\b/);
    expect(grip).toContain('[@media(hover:none)]:opacity-70');
    expect(grip).toContain('[@media(hover:none)]:left-2');
  });

  it('stays in the middle of a headed slot’s top edge, clear of its title', () => {
    show(
      { id: 's', span: 6, content: { type: 'tab', tabId: 't' } },
      { beginMove: vi.fn(), tabs: [] },
    );
    const grip = screen.getByRole('button', { name: 'Move Slot' }).className;
    expect(grip).toContain('[@media(hover:none)]:opacity-70');
    expect(grip).not.toContain('[@media(hover:none)]:left-2');
  });
});

// plan-tabs.md "Sheet Chart": picked, Add to Slot gives way to Choose a Chart; nothing fills the slot until chosen.
describe('a Sheet Chart from Add to Slot', () => {
  it('asks for its sheet and chart first', () => {
    // A slot with a chart's room.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ width: 600, height: 400 }),
    );
    const v = show({ id: 's', span: 6 });
    fireEvent.click(screen.getByRole('button', { name: /Add to Slot/ }));
    fireEvent.click(screen.getByRole('button', { name: /^From a Sheet/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Sheet Chart' }));
    expect(screen.getByRole('heading', { name: 'Sheet' })).toBeTruthy();
    expect(screen.getByText('No sheets in this document yet.')).toBeTruthy();
    expect(v.actions.placeItem).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe('Add a Slot, in the slot’s cog', () => {
  // docs/specs/026-plan/plan-tabs.md "Dashboard tab": a side picked adds a slot or a row there.
  const open = (over: Partial<DashboardContextValue> = {}) => {
    const v = show({ id: 's', span: 6, content: { type: 'note', title: 'N', text: '' } }, over);
    fireEvent.click(screen.getByRole('button', { name: 'Slot Settings' }));
    return v;
  };

  it('offers the four sides, adding a slot beside it or a row above or below, then closes', () => {
    const v = open();
    expect(screen.getByRole('group', { name: 'Add a Slot' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add Slot to the Right' }));
    expect(v.actions.changeDashboard).toHaveBeenCalledWith(expect.any(Function), 'DashboardSlot');
    expect(screen.queryByRole('group', { name: 'Add a Slot' })).toBeNull();
  });

  it('adds a row below as a row', () => {
    const v = open();
    fireEvent.click(screen.getByRole('button', { name: 'Add Row Below' }));
    expect(v.actions.changeDashboard).toHaveBeenCalledWith(expect.any(Function), 'DashboardRow');
  });

  it('shows a side it cannot use, saying why, and adds nothing there', () => {
    const v = open({
      fit: {
        keeps: () => false,
        fitOf: () => null,
        allowFor: () => undefined,
        allowMove: () => () => true,
      },
    });
    const left = screen.getByRole('button', { name: 'Add Slot to the Left' });
    expect(left.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(left);
    expect(v.actions.changeDashboard).not.toHaveBeenCalled();
  });

  it('is not offered to someone who may not edit', () => {
    show(
      { id: 's', span: 6, content: { type: 'tab', tabId: 't', of: 'board' } },
      { canEdit: false },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Slot Settings' }));
    expect(screen.queryByRole('group', { name: 'Add a Slot' })).toBeNull();
  });
});

// plan-tabs.md "Editing": an item has one menu, its cog; no ⋯ beside it.
describe('the slot’s one cog', () => {
  it('is the only menu a slot shows, with no ⋯', () => {
    show({ id: 's', span: 6, content: { type: 'tab', tabId: 't', of: 'board' } });
    expect(screen.getAllByRole('button', { name: 'Slot Settings' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Slot Options' })).toBeNull();
  });

  it('opens on its Slot section: Open Tab, Add a Slot, Clear Slot and Remove Slot for an Editor', () => {
    const v = show({ id: 's', span: 6, content: { type: 'tab', tabId: 't', of: 'board' } });
    openMenu();
    expect(screen.getByRole('button', { name: /^Slot$/, expanded: true })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Add a Slot' })).toBeTruthy();
    for (const name of ['Clear Slot', 'Remove Slot'])
      expect(screen.getByRole('button', { name })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Tab' }));
    expect(v.openTab).toHaveBeenCalledWith('t');
    expect(screen.queryByRole('dialog', { name: 'Slot Settings' })).toBeNull();
  });

  it('gives someone who may not edit Open Tab alone', () => {
    show(
      { id: 's', span: 6, content: { type: 'tab', tabId: 't', of: 'board' } },
      { canEdit: false },
    );
    openMenu();
    expect(screen.getByRole('button', { name: 'Open Tab' })).toBeTruthy();
    for (const name of ['Clear Slot', 'Remove Slot'])
      expect(screen.queryByRole('button', { name })).toBeNull();
  });

  it('is not shown to someone who may not edit a slot showing no tab', () => {
    show({ id: 's', span: 6, content: { type: 'note', title: 'N', text: '' } }, { canEdit: false });
    expect(screen.queryByRole('button', { name: 'Slot Settings' })).toBeNull();
  });

  it('cancels the question about what goes with the slot', () => {
    const v = show({ id: 's', span: 6, content: { type: 'tab', tabId: 't', of: 'board' } });
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Slot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(v.actions.removeSlot).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Remove Slot' })).toBeTruthy();
  });
});
