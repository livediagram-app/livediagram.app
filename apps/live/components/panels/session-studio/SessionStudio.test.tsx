// @vitest-environment jsdom

// The Session Studio's wiring: which tool it opens on, and that each pane's
// controls call the right session verb with the right arguments. The dial
// maths and phase logic are covered as pure functions in
// session-studio.test.ts; this file is about the buttons.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TabTimer, TabVote } from '@livediagram/diagram';
import type { LivePoll } from '@livediagram/api-schema';
import type { SessionToolsProps } from '@/components/chrome/session-tools-props';
import { SessionStudio } from './SessionStudio';

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
    livePoll: null,
    pollHasAudience: true,
    onStartPoll: vi.fn(),
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
const openVote: TabVote = {
  active: true,
  revealed: false,
  votesPerPerson: 3,
  votes: { a: ['me', 'you'] },
  startedBy: 'me',
};

afterEach(cleanup);

describe('SessionStudio', () => {
  it('opens on the timer by default and on a running tool when there is one', () => {
    render(<SessionStudio {...props()} />);
    expect(screen.getByRole('tab', { name: /Timer/ }).getAttribute('aria-selected')).toBe('true');
    cleanup();
    render(<SessionStudio {...props({ vote: openVote })} />);
    expect(screen.getByRole('tab', { name: /Vote/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('starts a countdown at the preset picked', () => {
    const p = props();
    render(<SessionStudio {...p} />);
    fireEvent.click(screen.getByRole('button', { name: '10m' }));
    fireEvent.click(screen.getByRole('button', { name: /Start 10 min countdown/ }));
    expect(p.onStartTimer).toHaveBeenCalledWith('countdown', 600_000);
  });

  it('sets the length from the dial with the keyboard', () => {
    const p = props();
    render(<SessionStudio {...p} />);
    const dial = screen.getByRole('slider', { name: /Countdown length/ });
    fireEvent.keyDown(dial, { key: 'PageUp' });
    expect(dial.getAttribute('aria-valuenow')).toBe('10');
    fireEvent.keyDown(dial, { key: 'Home' });
    expect(dial.getAttribute('aria-valuenow')).toBe('1');
  });

  it('starts a stopwatch from the Stopwatch mode', () => {
    const p = props();
    render(<SessionStudio {...p} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Stopwatch' }));
    fireEvent.click(screen.getByRole('button', { name: /Start stopwatch/ }));
    expect(p.onStartTimer).toHaveBeenCalledWith('stopwatch');
  });

  it('drives a running countdown: extend, pause, reset, end', () => {
    const p = props({ timer: running });
    render(<SessionStudio {...p} />);
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
    render(<SessionStudio {...p} />);
    fireEvent.click(screen.getByRole('tab', { name: /Vote/ }));
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
    render(<SessionStudio {...p} />);
    fireEvent.click(screen.getByRole('tab', { name: /Vote/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'One each' }));
    fireEvent.click(screen.getByRole('radio', { name: '1 dot each' }));
    expect(screen.queryByRole('radio', { name: 'One each' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start vote' }));
    expect(p.onStartVote).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ onePerElement: false }),
    );
  });

  it('gives the vote host one next step per phase, and a participant none', () => {
    const p = props({ vote: openVote });
    render(<SessionStudio {...p} />);
    expect(screen.getByText('dots placed').previousElementSibling?.textContent).toBe('2');
    expect(screen.getByText('people voted').previousElementSibling?.textContent).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: 'End vote' }));
    expect(p.onEndVote).toHaveBeenCalled();
    cleanup();

    render(<SessionStudio {...props({ vote: { ...openVote, active: false } })} />);
    expect(screen.getByRole('button', { name: 'Show results' })).toBeTruthy();
    cleanup();

    render(<SessionStudio {...props({ vote: openVote, selfId: 'someone-else' })} />);
    expect(screen.queryByRole('button', { name: 'End vote' })).toBeNull();
  });

  it('names what a poll is missing instead of starting it', () => {
    const p = props();
    render(<SessionStudio {...p} />);
    fireEvent.click(screen.getByRole('tab', { name: /Poll/ }));
    const ask = screen.getByRole('button', { name: 'Write a question to ask' });
    expect((ask as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Poll question'), { target: { value: 'Lunch?' } });
    fireEvent.click(screen.getByRole('radio', { name: /Choices/ }));
    expect(screen.getByRole('button', { name: 'Add at least 2 answers' })).toBeTruthy();
  });

  it('adds the next answer on Enter and asks with the trimmed list', () => {
    const p = props();
    render(<SessionStudio {...p} />);
    fireEvent.click(screen.getByRole('tab', { name: /Poll/ }));
    fireEvent.change(screen.getByLabelText('Poll question'), { target: { value: ' Lunch? ' } });
    fireEvent.click(screen.getByRole('radio', { name: /Choices/ }));
    fireEvent.change(screen.getByLabelText('Answer 1'), { target: { value: 'Pizza' } });
    fireEvent.change(screen.getByLabelText('Answer 2'), { target: { value: 'Tacos' } });
    fireEvent.keyDown(screen.getByLabelText('Answer 2'), { key: 'Enter' });
    const third = screen.getByLabelText('Answer 3');
    expect(document.activeElement).toBe(third);
    fireEvent.click(screen.getByRole('button', { name: 'Ask everyone' }));
    expect(p.onStartPoll).toHaveBeenCalledWith({
      question: 'Lunch?',
      style: 'choice',
      options: ['Pizza', 'Tacos'],
    });
  });

  it('lets a poll start on an unshared diagram, with a note', () => {
    const p = props({ pollHasAudience: false });
    render(<SessionStudio {...p} />);
    fireEvent.click(screen.getByRole('tab', { name: /Poll/ }));
    expect(screen.getByText(/only you will get this poll/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Poll question'), { target: { value: 'Ready?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask everyone' }));
    expect(p.onStartPoll).toHaveBeenCalled();
  });

  it('shows a running poll instead of the composer', () => {
    const poll: LivePoll = {
      id: 'p1',
      question: 'Ship it?',
      style: 'yesNo',
      options: [],
      startedAt: 0,
    };
    render(<SessionStudio {...props({ livePoll: poll })} />);
    expect(screen.getByRole('tab', { name: /Poll/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Ship it?')).toBeTruthy();
    expect(screen.queryByLabelText('Poll question')).toBeNull();
  });
});
