// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "Cards": a Checklist with nothing on it yet offers an Editor a first item to type
// into; anyone else reads that it is empty.
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { DashboardChecklistCard } from './DashboardChecklistCard';
import type { DashboardChecklistItem } from '@livedesign/document';

afterEach(cleanup);

function show(canEdit: boolean) {
  const setSlotContent = vi.fn();
  const value = {
    tabs: [],
    elements: new Map(),
    canEdit,
    actions: { setSlotContent },
    openTab: vi.fn(),
    tabStatus: () => 'loaded',
    retryTab: vi.fn(),
  } as unknown as DashboardContextValue;
  render(
    <DashboardContext.Provider value={value}>
      <DashboardChecklistCard slotId="s" checklist={{ title: 'Launch', items: [] }} />
    </DashboardContext.Provider>,
  );
  return setSlotContent;
}

describe('an empty Checklist', () => {
  it('gives an Editor a first item to type into, kept once it holds text', () => {
    const setSlotContent = show(true);
    expect(screen.queryByRole('button', { name: /Add Item/ })).toBeNull();
    const field = screen.getByRole('textbox', { name: 'Item' });
    fireEvent.blur(field);
    expect(setSlotContent).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: 'Book the venue' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    const saved = setSlotContent.mock.calls[0]![1] as { items: { text: string }[] };
    expect(saved.items.map((i) => i.text)).toEqual(['Book the venue', '']);
  });

  it('tells anyone else it is empty', () => {
    show(false);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Nothing on the list yet.')).toBeTruthy();
  });
});

// "Cards": Enter in an item saves what was typed and adds the next item as one step.
describe('Enter in a Checklist item', () => {
  it('saves the typed text and the new item in one change', () => {
    const setSlotContent = vi.fn();
    function Harness() {
      const [items, setItems] = useState<DashboardChecklistItem[]>([
        { id: 'a', text: 'Book', done: false },
      ]);
      const value = {
        tabs: [],
        elements: new Map(),
        canEdit: true,
        actions: {
          setSlotContent: (_: string, c: { items: DashboardChecklistItem[] }) => {
            setSlotContent(c);
            setItems(c.items);
          },
        },
        openTab: vi.fn(),
        tabStatus: () => 'loaded',
        retryTab: vi.fn(),
      } as unknown as DashboardContextValue;
      return (
        <DashboardContext.Provider value={value}>
          <DashboardChecklistCard slotId="s" checklist={{ title: 'Launch', items }} />
        </DashboardContext.Provider>
      );
    }
    render(<Harness />);
    const field = screen.getByRole('textbox', { name: 'Item' });
    fireEvent.change(field, { target: { value: 'Book the venue' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.blur(field);
    expect(setSlotContent).toHaveBeenCalledTimes(1);
    const saved = setSlotContent.mock.calls[0]![0] as { items: DashboardChecklistItem[] };
    expect(saved.items.map((i) => i.text)).toEqual(['Book the venue', '']);
    expect(screen.getAllByRole('textbox', { name: 'Item' })[0]).toHaveProperty(
      'value',
      'Book the venue',
    );
  });
});
