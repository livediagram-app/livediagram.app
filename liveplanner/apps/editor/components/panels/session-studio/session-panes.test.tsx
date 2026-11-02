// @vitest-environment jsdom

// The session panes' wiring (the set-up and live tools the Session strip's popovers open,
// docs/specs/012-collaboration/session-tools.md): each control calls the right session verb with
// the right arguments. The dial
// maths and phase logic are covered as pure functions in
// session-studio.test.ts; this file is about the buttons.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TabTimer } from '@liveplanner/project';
import type { SessionToolsProps } from '@/components/chrome/session-tools-props';
import { TimerPane } from './TimerPane';
import { VotePane } from './VotePane';

type Props = SessionToolsProps & { selfId: string };
function Timer(p: Props) {
  return <TimerPane {...p} />;
}
function Vote(p: Props) {
  return <VotePane {...p} />;
}

function props(overrides: Partial<SessionToolsProps & { selfId: string }> = {}) {
  return {
    selfId: 'me',
    timer: null,
    vote: null,
    onStartTimer: vi.fn(),
    onPauseTimer: vi.fn(),
    onResumeTimer: vi.fn(),
    onResetTimer: vi.fn(),
    onClearTimer: vi.fn(),
    onExtendTimer: vi.fn(),
    onStartVote: vi.fn(),
    onEndVote: vi.fn(),
    onRevealVote: vi.fn(),
    onClearVote: vi.fn(),
    voteLayers: [],
    activeLayerId: 'l1',
    ...overrides,
  } satisfies SessionToolsProps & { selfId: string };
}

const running: TabTimer = {
  mode: 'countdown',
  running: true,
  durationMs: 300_000,
  anchorAt: Date.now() + 120_000,
};

afterEach(cleanup);

describe('session panes', () => {
  it('starts a countdown at the preset picked', () => {
    const p = props();
    render(<Timer {...p} />);
    fireEvent.click(screen.getByRole('button', { name: '10m' }));
    fireEvent.click(screen.getByRole('button', { name: /Start 10 min countdown/ }));
    expect(p.onStartTimer).toHaveBeenCalledWith('countdown', 600_000);
  });

  it('sets the length from the dial with the keyboard', () => {
    const p = props();
    render(<Timer {...p} />);
    const dial = screen.getByRole('slider', { name: /Countdown length/ });
    fireEvent.keyDown(dial, { key: 'PageUp' });
    expect(dial.getAttribute('aria-valuenow')).toBe('10');
    fireEvent.keyDown(dial, { key: 'Home' });
    expect(dial.getAttribute('aria-valuenow')).toBe('1');
  });

  it('starts a stopwatch from the Stopwatch mode', () => {
    const p = props();
    render(<Timer {...p} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Stopwatch' }));
    fireEvent.click(screen.getByRole('button', { name: /Start stopwatch/ }));
    expect(p.onStartTimer).toHaveBeenCalledWith('stopwatch');
  });

  it('drives a running countdown: extend, pause, reset, end', () => {
    const p = props({ timer: running });
    render(<Timer {...p} />);
    fireEvent.click(screen.getByRole('button', { name: '+1 min' }));
    expect(p.onExtendTimer).toHaveBeenCalledWith(60_000);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'End' }));
    expect(p.onPauseTimer).toHaveBeenCalled();
    expect(p.onResetTimer).toHaveBeenCalled();
    expect(p.onClearTimer).toHaveBeenCalled();
  });

  it('starts a vote with the budget, privacy and one-per-item choices', () => {
    const p = props();
    render(<Vote {...p} />);
    fireEvent.click(screen.getByRole('radio', { name: '5 dots each' }));
    fireEvent.click(screen.getByRole('radio', { name: 'One each' }));
    fireEvent.click(screen.getByRole('button', { name: /Hide running counts/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start vote' }));
    expect(p.onStartVote).toHaveBeenCalledWith(5, {
      hideCursors: true,
      hideCounts: true,
      layerId: undefined,
      onePerElement: true,
    });
  });

  it('hides the per-item choice when everyone has a single dot', () => {
    const p = props();
    render(<Vote {...p} />);
    fireEvent.click(screen.getByRole('radio', { name: 'One each' }));
    fireEvent.click(screen.getByRole('radio', { name: '1 dot each' }));
    expect(screen.queryByRole('radio', { name: 'One each' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start vote' }));
    expect(p.onStartVote).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ onePerElement: false }),
    );
  });

  // docs/specs/012-collaboration/session-tools.md "Count In".
  it('counts in the built-in Votes unless another Votes field is picked', () => {
    const voteFields = [
      { id: 'votes', label: 'Votes' },
      { id: 'f-pri', label: 'Priority Vote' },
    ];
    const p = props({ voteFields });
    render(<Vote {...p} />);
    const group = screen.getByRole('radiogroup', { name: 'Count In' });
    expect(screen.getByRole('radio', { name: 'Votes' }).getAttribute('aria-checked')).toBe('true');
    expect(group.textContent).toBe('VotesPriority Vote');
    fireEvent.click(screen.getByRole('button', { name: 'Start vote' }));
    expect(p.onStartVote).toHaveBeenLastCalledWith(
      3,
      expect.objectContaining({ voteField: undefined }),
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Priority Vote' }));
    screen.getByText(/added to its Priority Vote, or to its Votes when its type has none/);
    fireEvent.click(screen.getByRole('button', { name: 'Start vote' }));
    expect(p.onStartVote).toHaveBeenLastCalledWith(
      3,
      expect.objectContaining({ voteField: 'f-pri' }),
    );
  });

  it('shows no Count In with only the built-in Votes', () => {
    render(<Vote {...props()} />);
    expect(screen.queryByRole('radiogroup', { name: 'Count In' })).toBeNull();
  });
});
