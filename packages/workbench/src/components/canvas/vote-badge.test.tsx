// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useVoteBadge, voteStepperCollapses, VOTE_STEPPER_PX } from './vote-badge';

// docs/specs/012-collaboration/session-tools.md "On a small note when zoomed out it folds to a badge".

describe('voteStepperCollapses', () => {
  it('never folds at 100% and above, or without a box', () => {
    expect(voteStepperCollapses({ width: 20, height: 20 }, 1)).toBe(false);
    expect(voteStepperCollapses({ width: 20, height: 20 }, 2)).toBe(false);
    expect(voteStepperCollapses(undefined, 0.2)).toBe(false);
  });

  it('folds zoomed out when the element on screen is too narrow or too short for the stepper', () => {
    // 160 x 160 at 0.5 is 80 px on screen: narrower than two steppers.
    expect(voteStepperCollapses({ width: 160, height: 160 }, 0.5)).toBe(true);
    // Wide but short: 400 x 160 at 0.6 is 240 x 96, under three stepper heights.
    expect(voteStepperCollapses({ width: 400, height: 160 }, 0.6)).toBe(true);
    // Right at the thresholds it keeps the stepper.
    const z = 0.5;
    expect(
      voteStepperCollapses(
        { width: (VOTE_STEPPER_PX.width * 2) / z, height: (VOTE_STEPPER_PX.height * 3) / z },
        z,
      ),
    ).toBe(false);
    expect(voteStepperCollapses({ width: 400, height: 400 }, 0.9)).toBe(false);
  });
});

function Probe({ collapsed }: { collapsed: boolean }) {
  const { ref, open, setOpen } = useVoteBadge(collapsed);
  return (
    <div>
      <div ref={ref} data-testid="inside">
        <button type="button" onClick={() => setOpen(true)}>
          open
        </button>
      </div>
      <span data-testid="outside" />
      <output>{open ? 'open' : 'closed'}</output>
    </div>
  );
}

describe('useVoteBadge', () => {
  it('opens on request and closes on a press outside or Escape, not on a press inside', () => {
    const r = render(<Probe collapsed />);
    const state = () => r.container.querySelector('output')!.textContent;
    fireEvent.click(r.getByText('open'));
    expect(state()).toBe('open');
    fireEvent.pointerDown(r.getByTestId('inside'));
    expect(state()).toBe('open');
    fireEvent.pointerDown(r.getByTestId('outside'));
    expect(state()).toBe('closed');
    fireEvent.click(r.getByText('open'));
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(state()).toBe('open');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(state()).toBe('closed');
  });

  it('is never open while not folded, and a fold lifting closes it', () => {
    const r = render(<Probe collapsed={false} />);
    const state = () => r.container.querySelector('output')!.textContent;
    fireEvent.click(r.getByText('open'));
    expect(state()).toBe('closed');
    r.rerender(<Probe collapsed />);
    // The lifted fold reset it, so folding again starts closed.
    expect(state()).toBe('closed');
    fireEvent.click(r.getByText('open'));
    expect(state()).toBe('open');
    act(() => r.rerender(<Probe collapsed={false} />));
    r.rerender(<Probe collapsed />);
    expect(state()).toBe('closed');
  });
});
