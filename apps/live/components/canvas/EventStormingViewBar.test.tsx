// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventStormingViewBar } from './EventStormingViewBar';

// The workshop-view switcher (spec/139): three exclusive stage chips
// floating in the bottom-centre slot on event-storming boards. The chips
// drive SHARED layer visibility, so the contract worth pinning is which
// handler fires with what, and that the pressed state reads from props
// (the room's tab data), not local state.
describe('EventStormingViewBar', () => {
  afterEach(cleanup);

  const renderBar = (over: Partial<Parameters<typeof EventStormingViewBar>[0]> = {}) => {
    const onStage = vi.fn();
    render(<EventStormingViewBar stage="process" onStage={onStage} {...over} />);
    return { onStage };
  };

  it('renders exactly the three stage chips in workshop order', () => {
    renderBar();
    const group = screen.getByRole('group', { name: /event storming view/i });
    expect(group).toBeTruthy();
    const names = screen.getAllByRole('button').map((b) => b.textContent);
    expect(names).toEqual(['Big picture', 'Process', 'Design']);
  });

  it('presses only the current stage chip', () => {
    renderBar({ stage: 'process' });
    expect(screen.getByRole('button', { name: 'Big picture' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(screen.getByRole('button', { name: 'Process' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('clicking a stage chip fires onStage with that stage; the current one is a no-op', () => {
    const { onStage } = renderBar({ stage: 'big-picture' });
    fireEvent.click(screen.getByRole('button', { name: 'Design' }));
    expect(onStage).toHaveBeenCalledWith('design');
    fireEvent.click(screen.getByRole('button', { name: 'Big picture' }));
    expect(onStage).toHaveBeenCalledTimes(1);
  });
});
