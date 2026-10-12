// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "Editing": a slot's toolbar across the top of its cog.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout, DashboardSlot, Tab } from '@livediagram/document';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { SlotToolbar } from './SlotToolbar';

afterEach(cleanup);

function show(slot: DashboardSlot, over: Partial<DashboardContextValue> = {}, stacked = false) {
  const actions = {
    changeDashboard: vi.fn(),
    duplicateSlot: vi.fn(),
    setSlotContent: vi.fn(),
    removeSlot: vi.fn(),
  } as unknown as DashboardContextValue['actions'];
  const onClose = vi.fn();
  const value = {
    tabs: [{ id: 't', name: 'Roadmap', kind: 'board', elements: [] } as unknown as Tab],
    elements: new Map([
      ['sh', { id: 'sh', type: 'shape', shape: 'plan-sheet', planSheet: { sheetId: 's1' } }],
    ]),
    canEdit: true,
    actions,
    openTab: vi.fn(),
    tabStatus: () => 'loaded',
    retryTab: vi.fn(),
    ...over,
  } as unknown as DashboardContextValue;
  render(
    <DashboardContext.Provider value={value}>
      <SlotToolbar rowId="r" slot={slot} stacked={stacked} onClose={onClose} />
    </DashboardContext.Provider>,
  );
  return { actions, onClose, value };
}

const button = (name: string) => screen.getByRole('button', { name });

describe('a slot’s toolbar', () => {
  it('gives an Editor Open Tab, Duplicate, Clear and Remove', () => {
    const { actions, onClose, value } = show({
      id: 's',
      span: 6,
      content: { type: 'tab', tabId: 't' },
    });
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Open Tab',
      'Duplicate Slot',
      'Clear Slot',
      'Remove Slot',
    ]);
    fireEvent.click(button('Duplicate Slot'));
    expect(actions.duplicateSlot).toHaveBeenCalledWith('r', 's');
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(button('Open Tab'));
    expect(value.openTab).toHaveBeenCalledWith('t');
  });

  it('dims Duplicate for an empty slot or a Sheet, and Clear for an empty one', () => {
    show({ id: 's', span: 6 });
    expect(button('Duplicate Slot').getAttribute('aria-disabled')).toBe('true');
    expect(button('Clear Slot').getAttribute('aria-disabled')).toBe('true');
    cleanup();
    const { actions } = show({ id: 's', span: 6, content: { type: 'element', elementId: 'sh' } });
    fireEvent.click(button('Duplicate Slot'));
    expect(actions.duplicateSlot).not.toHaveBeenCalled();
  });

  it('gives anyone else Open Tab alone, and nothing on a slot with no tab', () => {
    show({ id: 's', span: 6, content: { type: 'tab', tabId: 't' } }, { canEdit: false });
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Open Tab',
    ]);
    cleanup();
    const { value } = show(
      { id: 's', span: 6, content: { type: 'note', title: '', text: '' } },
      { canEdit: false },
    );
    void value;
    expect(screen.queryByRole('toolbar')).toBeNull();
  });
});

// plan-tabs.md "On a phone": stacked, a slot moves up and down the stack from its toolbar.
describe('a stacked slot’s toolbar', () => {
  const slot = (id: string): DashboardSlot => ({
    id,
    span: 6,
    content: { type: 'title', title: id, text: '' },
  });
  const layout: DashboardLayout = {
    rows: [
      { id: 'r1', height: 200, slots: [slot('a'), slot('b')] },
      { id: 'r2', height: 200, slots: [{ ...slot('c'), span: 12 }] },
    ],
  };

  it('offers Move Up and Move Down first, dimmed at either end of the stack', () => {
    show(slot('a'), { layout }, true);
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names.slice(0, 2)).toEqual(['Move Up', 'Move Down']);
    expect(button('Move Up').getAttribute('aria-disabled')).toBe('true');
    expect(button('Move Down').getAttribute('aria-disabled')).toBeNull();
    cleanup();
    show(slot('c'), { layout }, true);
    expect(button('Move Down').getAttribute('aria-disabled')).toBe('true');
  });

  it('swaps with the slot before or after in reading order, as one change, and closes the cog', () => {
    const { actions, onClose } = show(slot('b'), { layout }, true);
    fireEvent.click(button('Move Down'));
    expect(onClose).toHaveBeenCalled();
    const change = (actions.changeDashboard as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(change[1]).toBe('DashboardSlot');
    const moved = (change[0] as (l: DashboardLayout) => DashboardLayout)(layout);
    // What the slots hold swaps; the slots keep their places and spans.
    expect(moved.rows[0]!.slots[1]!.content).toEqual({ type: 'title', title: 'c', text: '' });
    expect(moved.rows[1]!.slots[0]!.content).toEqual({ type: 'title', title: 'b', text: '' });
  });

  it('is not offered where the swap would squeeze a slot, nor off the stack, nor to anyone else', () => {
    show(slot('b'), { layout, fit: { keeps: () => false } as never }, true);
    expect(button('Move Up').getAttribute('aria-disabled')).toBe('true');
    expect(button('Move Down').getAttribute('aria-disabled')).toBe('true');
    cleanup();
    show(slot('b'), { layout });
    expect(screen.queryByRole('button', { name: 'Move Up' })).toBeNull();
    cleanup();
    show({ ...slot('b'), content: { type: 'tab', tabId: 't' } }, { layout, canEdit: false }, true);
    expect(screen.queryByRole('button', { name: 'Move Up' })).toBeNull();
  });
});
