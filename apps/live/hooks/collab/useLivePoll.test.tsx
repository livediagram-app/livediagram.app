// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { LivePoll } from '@livediagram/api-schema';

const trackMock = vi.fn();
vi.mock('@/lib/telemetry', () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

const { useLivePoll } = await import('./useLivePoll');

const poll = (id: string): LivePoll => ({
  id,
  question: 'Lunch?',
  style: 'text',
  options: [],
  startedAt: 1,
});

function setup() {
  const send = vi.fn();
  return renderHook(() => useLivePoll({ roomRef: { current: { send } } }));
}

const answered = () =>
  trackMock.mock.calls.filter(([c, a, t]) => c === 'Tab' && a === 'Voted' && t === 'Poll');

describe('useLivePoll answer telemetry (spec/22)', () => {
  beforeEach(() => trackMock.mockReset());

  it('counts one response per participant per poll, not each change of mind', () => {
    const { result } = setup();
    act(() => result.current.receivePoll(poll('p1')));
    act(() => result.current.answerPoll('pizza'));
    act(() => result.current.answerPoll('sushi'));
    act(() => result.current.answerPoll(null));
    expect(answered()).toHaveLength(1);
  });

  it('counts again for the next poll', () => {
    const { result } = setup();
    act(() => result.current.receivePoll(poll('p1')));
    act(() => result.current.answerPoll('pizza'));
    act(() => result.current.receivePoll(poll('p2')));
    act(() => result.current.answerPoll('pizza'));
    expect(answered()).toHaveLength(2);
  });
});
