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

describe('starting a collaborators poll (spec/88)', () => {
  beforeEach(() => trackMock.mockReset());

  // The op the room would receive, so the assertions are about what peers
  // actually get rather than about local state.
  function startWith(
    collaborators: { id: string; name: string }[],
    style: 'collaborators' | 'choice' = 'collaborators',
    options: string[] = [],
  ) {
    const send = vi.fn();
    const { result } = renderHook(() =>
      useLivePoll({
        roomRef: { current: { send } },
        collaboratorsRef: { current: collaborators },
      }),
    );
    act(() => result.current.startPoll({ question: 'Who chose this?', style, options }));
    const op = send.mock.calls[0]?.[0]?.op;
    return { op, send, result };
  }

  it('freezes the room into the poll options', () => {
    const { op } = startWith([
      { id: '1', name: 'Ariel' },
      { id: '2', name: 'Pete' },
    ]);
    expect(op.poll.style).toBe('collaborators');
    expect(op.poll.options).toEqual(['Ariel', 'Pete']);
  });

  it('numbers shared names, so two Guests cannot share a bar', () => {
    const { op } = startWith([
      { id: '1', name: 'Guest' },
      { id: '2', name: 'Guest' },
    ]);
    expect(op.poll.options).toEqual(['Guest', 'Guest (2)']);
  });

  it('reads the roster at the press, not when the composer rendered', () => {
    // The whole reason the roster arrives as a ref: someone joining between
    // opening the Studio and pressing Ask should be on the ballot.
    const send = vi.fn();
    const roster = { current: [{ id: '1', name: 'Ariel' }] };
    const { result } = renderHook(() =>
      useLivePoll({ roomRef: { current: { send } }, collaboratorsRef: roster }),
    );
    roster.current = [
      { id: '1', name: 'Ariel' },
      { id: '2', name: 'Pete' },
    ];
    act(() => result.current.startPoll({ question: 'Who?', style: 'collaborators', options: [] }));
    expect(send.mock.calls[0]![0].op.poll.options).toEqual(['Ariel', 'Pete']);
  });

  it('refuses a room too small to vote on, sending nothing', () => {
    const { op, send } = startWith([{ id: '1', name: 'Ariel' }]);
    expect(op).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it('leaves a choice poll’s own answers alone', () => {
    const { op } = startWith([{ id: '1', name: 'Ariel' }], 'choice', ['Tea', 'Coffee']);
    expect(op.poll.options).toEqual(['Tea', 'Coffee']);
  });
});
