// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { statusColumn } from '@liveplanner/items';
import { WipLimitRow } from './PlanColumnFields';

// docs/specs/026-plan/plan-board.md "A column's own settings": the WIP limit's number box.
afterEach(cleanup);

function row(wip: number | null) {
  const setWip = vi.fn();
  render(<WipLimitRow column={statusColumn('todo', 'To Do')} wip={wip} setWip={setWip} />);
  return { setWip, input: screen.getByRole<HTMLInputElement>('spinbutton') };
}

describe('WipLimitRow', () => {
  it('sets the typed limit, and Off when emptied', () => {
    const { setWip, input } = row(4);
    fireEvent.blur(input, { target: { value: '6' } });
    expect(setWip).toHaveBeenLastCalledWith(6);
    fireEvent.blur(input, { target: { value: '' } });
    expect(setWip).toHaveBeenLastCalledWith(null);
  });

  // Text the box can't read (some browsers let "4 cards" in) reads as '': the limit stays, never Off.
  it('keeps the limit when the box holds no number', () => {
    const { setWip, input } = row(4);
    Object.defineProperty(input, 'validity', { value: { badInput: true }, configurable: true });
    input.value = '';
    fireEvent.blur(input);
    expect(setWip).not.toHaveBeenCalled();
    expect(input.value).toBe('4');
  });
});
