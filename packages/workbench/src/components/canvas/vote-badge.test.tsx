// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  useVoteBadge,
  voteBadgeShrinks,
  voteStepperCollapses,
  VOTE_BADGE_FOOTPRINT_PX,
  VOTE_BADGE_PX,
  VOTE_DOT_PX,
  VOTE_STEPPER_PX,
} from './vote-badge';

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

// docs/specs/012-collaboration/session-tools.md "Smaller still it shrinks to a dot".
describe('voteBadgeShrinks', () => {
  it('never shrinks at 100% and above, or without a box', () => {
    expect(voteBadgeShrinks({ width: 10, height: 10 }, 1)).toBe(false);
    expect(voteBadgeShrinks(undefined, 0.1)).toBe(false);
  });

  it('shrinks when the element on screen is narrower or shorter than the badge’s footprint', () => {
    // A phone's full Fit of a large board: a 180 px note at 0.13 zoom is 23 px, under the 24 px badge itself.
    expect(voteBadgeShrinks({ width: 180, height: 180 }, 0.13)).toBe(true);
    // Wide but short still shrinks: the badge would cover the note's height.
    expect(voteBadgeShrinks({ width: 2000, height: 60 }, 0.4)).toBe(true);
    // A 120 x 80 note at 0.4 is 48 x 32 on screen: room for the badge.
    expect(voteBadgeShrinks({ width: 120, height: 80 }, 0.4)).toBe(false);
    expect(VOTE_BADGE_FOOTPRINT_PX).toBe(32);
    // Right at the threshold the badge stays; just under it, the dot.
    const z = 0.25;
    const edge = VOTE_BADGE_FOOTPRINT_PX / z;
    expect(voteBadgeShrinks({ width: edge, height: edge }, z)).toBe(false);
    expect(voteBadgeShrinks({ width: edge - 1, height: edge }, z)).toBe(true);
    // The dot is smaller than any note it marks.
    expect(VOTE_DOT_PX).toBeLessThan(VOTE_BADGE_PX);
  });

  it('decides a 2,000-note board over 60 zoom frames within a CPU budget, with no layout read', () => {
    const boxes = Array.from({ length: 2000 }, (_, i) => ({ width: 120 + (i % 200), height: 180 }));
    let shrunk = 0;
    const ms = cpuMsOf(() => {
      for (let f = 0; f < 60; f++) {
        const zoom = 0.1 + f * 0.015;
        for (const box of boxes) if (voteBadgeShrinks(box, zoom)) shrunk++;
      }
    });
    expect(shrunk).toBeGreaterThan(0);
    expect(ms).toBeLessThan(cpuBudgetMs(30));
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
