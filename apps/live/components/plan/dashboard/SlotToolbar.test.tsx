// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "Editing": a slot's toolbar across the top of its cog.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardSlot, Tab } from '@livediagram/document';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { SlotToolbar } from './SlotToolbar';

afterEach(cleanup);

function show(slot: DashboardSlot, over: Partial<DashboardContextValue> = {}) {
  const actions = {
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
      <SlotToolbar rowId="r" slot={slot} onClose={onClose} />
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
