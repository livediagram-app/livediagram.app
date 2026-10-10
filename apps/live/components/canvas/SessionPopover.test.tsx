// @vitest-environment jsdom

// docs/specs/012-collaboration/session-tools.md "The Session strip": what each button opens. Set-up
// while idle, the live panel while running, the dial alone for a view-role visitor, and the
// facilitator lock.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TabTimer, TabVote } from '@livediagram/document';
import type { SessionToolsProps } from '@/components/chrome/session-tools-props';
import { SessionPopover, type SessionPopoverProps } from './SessionPopover';

afterEach(cleanup);

// jsdom has no ResizeObserver; the popover measures itself with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

function session(overrides: Partial<SessionToolsProps> = {}): SessionToolsProps {
  return {
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
    pollCollaborators: [],
    pollHasAudience: true,
    onStartPoll: vi.fn(),
    voteLayers: [],
    activeLayerId: 'l1',
    ...overrides,
  };
}

function popover(overrides: Partial<SessionPopoverProps> = {}) {
  const props: SessionPopoverProps = {
    segment: 'session-timer',
    onClose: vi.fn(),
    session: session(),
    readOnly: false,
    holdOpen: true,
    voteSelfId: 'me',
    pollPanel: null,
    vote: {
      tabVote: undefined,
      elements: [],
      participantCount: 2,
      results: [],
      reviewIndex: null,
      onJumpToResult: () => {},
      isHost: true,
      review: null,
      onNextResult: () => {},
      onPrevResult: () => {},
      onDoneReview: () => {},
    },
    ...overrides,
  };
  render(<SessionPopover {...props} />);
  return props;
}

const paused: TabTimer = {
  mode: 'countdown',
  running: false,
  durationMs: 300_000,
  frozenMs: 125_000,
};
const openVote: TabVote = {
  active: true,
  revealed: false,
  votesPerPerson: 3,
  votes: { a: ['me'] },
  startedBy: 'me',
};

describe('SessionPopover', () => {
  it('opens the Timer set-up while no timer runs', () => {
    const p = popover();
    fireEvent.click(screen.getByRole('button', { name: /Start 5 min countdown/ }));
    expect(p.session.onStartTimer).toHaveBeenCalledWith('countdown', 300_000);
  });

  it('opens the live Timer with its controls while one runs', () => {
    const p = popover({ session: session({ timer: paused }) });
    expect(screen.getByText('2:05')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(p.session.onResumeTimer).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '+1 min' }));
    expect(p.session.onExtendTimer).toHaveBeenCalledWith(60_000);
  });

  it('gives a view-role visitor the dial and no controls', () => {
    popover({ readOnly: true, session: session({ timer: paused }) });
    expect(screen.getByText('2:05')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+1 min' })).toBeNull();
  });

  it('opens the Vote set-up while no vote runs, and the Vote panel once one does', () => {
    const p = popover({ segment: 'session-vote' });
    fireEvent.click(screen.getByRole('button', { name: 'Start vote' }));
    expect(p.session.onStartVote).toHaveBeenCalled();
    cleanup();
    const q = popover({
      segment: 'session-vote',
      session: session({ vote: openVote }),
      vote: { ...p.vote, tabVote: openVote },
    });
    fireEvent.click(screen.getByRole('button', { name: 'End vote' }));
    expect(q.session.onEndVote).toHaveBeenCalled();
  });

  it('opens the poll composer while idle, and stays open once the poll starts', () => {
    const p = popover({ segment: 'session-poll' });
    fireEvent.change(screen.getByLabelText('Poll question'), { target: { value: 'Lunch?' } });
    fireEvent.click(screen.getByRole('radio', { name: /Choices/ }));
    fireEvent.change(screen.getByLabelText('Answer 1'), { target: { value: 'Pizza' } });
    fireEvent.change(screen.getByLabelText('Answer 2'), { target: { value: 'Tacos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask everyone' }));
    expect(p.session.onStartPoll).toHaveBeenCalled();
    // Asking keeps the popover: it becomes the Poll panel once the poll runs.
    expect(p.onClose).not.toHaveBeenCalled();
  });

  it('opens the Poll panel while a poll runs, and a Dismiss closes it', () => {
    const onDismiss = vi.fn();
    const p = popover({
      segment: 'session-poll',
      pollPanel: {
        poll: {
          id: 'p1',
          question: 'Lunch?',
          style: 'choice',
          options: ['Pizza', 'Tacos'],
        } as never,
        answers: new Map(),
        isHost: false,
        onEnd: vi.fn(),
        onDismiss,
      },
    });
    expect(screen.getByText('Lunch?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
    expect(p.onClose).toHaveBeenCalled();
  });

  it('offers a view-role visitor nothing for an idle tool', () => {
    const { container } = render(
      <SessionPopover
        segment="session-vote"
        onClose={() => {}}
        session={session()}
        readOnly
        holdOpen
        voteSelfId="me"
        pollPanel={null}
        vote={{
          tabVote: undefined,
          elements: [],
          participantCount: 1,
          results: [],
          reviewIndex: null,
          onJumpToResult: () => {},
          isHost: false,
          review: null,
          onNextResult: () => {},
          onPrevResult: () => {},
          onDoneReview: () => {},
        }}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('locks the set-up under the facilitator note while somebody else runs the session', () => {
    popover({ session: session({ facilitatedBy: 'Sam' }) });
    expect(screen.getByText('Sam')).toBeTruthy();
    const start = screen.getByRole('button', { name: /Start 5 min countdown/ });
    expect(start.closest('fieldset')?.disabled).toBe(true);
  });

  it('leads the Vote panel with your dots left while casting is open', () => {
    popover({
      segment: 'session-vote',
      session: session({ vote: openVote }),
      vote: {
        tabVote: openVote,
        elements: [],
        participantCount: 2,
        results: [],
        reviewIndex: null,
        onJumpToResult: () => {},
        isHost: true,
        review: null,
        onNextResult: () => {},
        onPrevResult: () => {},
        onDoneReview: () => {},
      },
    });
    expect(screen.getByText('2 of 3 dots left')).toBeTruthy();
  });

  it('runs the results walkthrough from the Vote panel for whoever drives it', () => {
    const onNextResult = vi.fn();
    const onDoneReview = vi.fn();
    const revealed: TabVote = { ...openVote, active: false, revealed: true };
    const base = {
      tabVote: revealed,
      elements: [],
      participantCount: 2,
      results: [
        { id: 'a', votes: 2 },
        { id: 'b', votes: 1 },
      ],
      reviewIndex: 0,
      onJumpToResult: () => {},
      isHost: true,
      onNextResult,
      onPrevResult: () => {},
      onDoneReview,
    };
    popover({
      segment: 'session-vote',
      session: session({ vote: revealed }),
      vote: { ...base, review: { focusId: 'a', index: 0, total: 2, votes: 2, canControl: true } },
    });
    expect(screen.getByText(/Top result 1 of 2/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNextResult).toHaveBeenCalled();
    cleanup();
    popover({
      segment: 'session-vote',
      session: session({ vote: revealed }),
      vote: { ...base, review: { focusId: 'b', index: 1, total: 2, votes: 1, canControl: true } },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDoneReview).toHaveBeenCalled();
    cleanup();
    popover({
      segment: 'session-vote',
      session: session({ vote: revealed }),
      vote: { ...base, review: { focusId: 'a', index: 0, total: 2, votes: 2, canControl: false } },
    });
    expect(screen.getByText(/Top result 1 of 2/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it('keeps a running tool open on an outside press while holding, and not while idle', () => {
    const running = popover({
      segment: 'session-vote',
      session: session({ vote: openVote }),
      vote: {
        tabVote: openVote,
        elements: [],
        participantCount: 2,
        results: [],
        reviewIndex: null,
        onJumpToResult: () => {},
        isHost: true,
        review: null,
        onNextResult: () => {},
        onPrevResult: () => {},
        onDoneReview: () => {},
      },
    });
    fireEvent.pointerDown(document.body);
    expect(running.onClose).not.toHaveBeenCalled();
    cleanup();
    const idle = popover({ segment: 'session-vote' });
    fireEvent.pointerDown(document.body);
    expect(idle.onClose).toHaveBeenCalled();
  });

  it('closes a running timer on an outside press, even while holding', () => {
    const p = popover({ session: session({ timer: paused }) });
    fireEvent.pointerDown(document.body);
    expect(p.onClose).toHaveBeenCalled();
  });
});
