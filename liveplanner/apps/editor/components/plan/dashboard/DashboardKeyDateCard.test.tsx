// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "Cards": a Key Date's date lands as one step when the field is left or Enter is
// pressed, never once per keystroke.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { DashboardKeyDateCard } from './DashboardKeyDateCard';

afterEach(cleanup);

function show(date = '2026-10-01') {
  const setSlotContent = vi.fn();
  const value = {
    tabs: [],
    elements: new Map(),
    canEdit: true,
    actions: { setSlotContent },
    openTab: vi.fn(),
    tabStatus: () => 'loaded',
    retryTab: vi.fn(),
  } as unknown as DashboardContextValue;
  render(
    <DashboardContext.Provider value={value}>
      <DashboardKeyDateCard slotId="s" keyDate={{ title: 'Launch', date }} />
    </DashboardContext.Provider>,
  );
  return { setSlotContent, field: screen.getByLabelText('Date') };
}

describe('a Key Date’s date', () => {
  it('saves once, when the field is left, however many changes typing it made', () => {
    const { setSlotContent, field } = show();
    for (const v of ['0002-10-01', '0020-10-01', '0202-10-01', '2027-10-01'])
      fireEvent.change(field, { target: { value: v } });
    expect(setSlotContent).not.toHaveBeenCalled();
    fireEvent.blur(field);
    expect(setSlotContent).toHaveBeenCalledTimes(1);
    expect(setSlotContent).toHaveBeenCalledWith('s', {
      type: 'key-date',
      title: 'Launch',
      date: '2027-10-01',
    });
  });

  it('saves on Enter', () => {
    const { setSlotContent, field } = show();
    fireEvent.change(field, { target: { value: '2026-12-25' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(setSlotContent).toHaveBeenCalledTimes(1);
    expect(setSlotContent.mock.calls[0]![1]).toMatchObject({ date: '2026-12-25' });
  });

  it('saves nothing when left unchanged', () => {
    const { setSlotContent, field } = show();
    fireEvent.blur(field);
    expect(setSlotContent).not.toHaveBeenCalled();
  });
});
