// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { LivePoll, RoomOutgoing } from '@livehuddle/api-schema';

const trackMock = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({
  track: (...args: Parameters<typeof trackMock>) => trackMock(...args),
}));

const { pollHostFor, useLivePoll } = await import('./useLivePoll');

const poll = (id: string): LivePoll => ({
  id,
  question: 'Lunch?',
  style: 'text',
  options: [],
  startedAt: 1,
});

// The ops a hook sent its room, in order.
const sentOps = (send: { mock: { calls: [RoomOutgoing][] } }) =>
  send.mock.calls.map(([msg]) => (msg.kind === 'op' ? msg.op : undefined));

function setup() {
  const send = vi.fn();
  return renderHook(() => useLivePoll({ roomRef: { current: { send } } }));
}

const answered = () =>
  trackMock.mock.calls.filter(([c, a, t]) => c === 'Tab' && a === 'Voted' && t === 'Poll');

describe('useLivePoll answer telemetry (docs/specs/017-telemetry/telemetry.md)', () => {
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

describe('starting a collaborators poll (docs/specs/012-collaboration/live-poll.md)', () => {
  beforeEach(() => trackMock.mockReset());

  // The op the room would receive, so the assertions are about what peers
  // actually get rather than about local state.
  function startWith(
    collaborators: { id: string; name: string }[],
    style: 'collaborators' | 'choice' = 'collaborators',
    options: string[] = [],
  ) {
    const send = vi.fn<(msg: RoomOutgoing) => void>();
    const { result } = renderHook(() =>
      useLivePoll({
        roomRef: { current: { send } },
        collaboratorsRef: { current: collaborators },
      }),
    );
    act(() => result.current.startPoll({ question: 'Who chose this?', style, options }));
    const op = sentOps(send)[0];
    return { op, send, result };
  }

  it('freezes the room into the poll options', () => {
    const { op } = startWith([
      { id: '1', name: 'Ariel' },
      { id: '2', name: 'Pete' },
    ]);
    expect(op).toMatchObject({ poll: { style: 'collaborators', options: ['Ariel', 'Pete'] } });
  });

  it('numbers shared names, so two Guests cannot share a bar', () => {
    const { op } = startWith([
      { id: '1', name: 'Guest' },
      { id: '2', name: 'Guest' },
    ]);
    expect(op).toMatchObject({ poll: { options: ['Guest', 'Guest (2)'] } });
  });

  it('reads the roster at the press, not when the composer rendered', () => {
    // The whole reason the roster arrives as a ref: someone joining between
    // opening the Studio and pressing Ask should be on the ballot.
    const send = vi.fn<(msg: RoomOutgoing) => void>();
    const roster = { current: [{ id: '1', name: 'Ariel' }] };
    const { result } = renderHook(() =>
      useLivePoll({ roomRef: { current: { send } }, collaboratorsRef: roster }),
    );
    roster.current = [
      { id: '1', name: 'Ariel' },
      { id: '2', name: 'Pete' },
    ];
    act(() => result.current.startPoll({ question: 'Who?', style: 'collaborators', options: [] }));
    expect(sentOps(send)[0]).toMatchObject({ poll: { options: ['Ariel', 'Pete'] } });
  });

  it('refuses a room too small to vote on, sending nothing', () => {
    const { op, send } = startWith([{ id: '1', name: 'Ariel' }]);
    expect(op).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it('leaves a choice poll’s own answers alone', () => {
    const { op } = startWith([{ id: '1', name: 'Ariel' }], 'choice', ['Tea', 'Coffee']);
    expect(op).toMatchObject({ poll: { options: ['Tea', 'Coffee'] } });
  });
});

describe('surviving reconnects and refreshes (docs/specs/012-collaboration/collab-race-hardening.md)', () => {
  function withKey(key: string) {
    const send = vi.fn<(msg: RoomOutgoing) => void>();
    const hook = renderHook(() =>
      useLivePoll({ roomRef: { current: { send } }, selfKeyRef: { current: key } }),
    );
    return { ...hook, send };
  }

  it("a replayed poll-start for the poll on screen keeps everyone's answers", () => {
    const { result } = withKey('me');
    act(() => result.current.receivePoll(poll('p1')));
    act(() => result.current.receiveAnswer('socket-1', 'p1', 'pizza', 'ada'));
    act(() => result.current.receivePoll(poll('p1')));
    expect(result.current.answers.get('ada')).toBe('pizza');
  });

  it('keys an answer by who gave it, so a reconnect re-answer replaces it', () => {
    const { result } = withKey('me');
    act(() => result.current.receivePoll(poll('p1')));
    act(() => result.current.receiveAnswer('socket-1', 'p1', 'pizza', 'ada'));
    act(() => result.current.receiveAnswer('socket-2', 'p1', 'sushi', 'ada'));
    expect([...result.current.answers.entries()]).toEqual([['ada', 'sushi']]);
  });

  it('knows its own answer and its own poll after a refresh', () => {
    const { result } = withKey('me');
    act(() => result.current.receivePoll({ ...poll('p1'), hostKey: 'me' }));
    act(() => result.current.receiveAnswer('system', 'p1', 'pizza', 'me'));
    expect(result.current.isHost).toBe(true);
    expect(result.current.myAnswer).toEqual({ value: 'pizza' });
  });

  it('sends its key with a start and an answer', () => {
    const { result, send } = withKey('me');
    act(() => result.current.startPoll({ question: 'Lunch?', style: 'text', options: [] }));
    act(() => result.current.answerPoll('pizza'));
    const ops = sentOps(send);
    expect(ops[0]).toMatchObject({ poll: { hostKey: 'me' } });
    expect(ops[1]).toMatchObject({ kind: 'poll-answer', value: 'pizza', key: 'me' });
  });

  // docs/specs/012-collaboration/vote-integrity.md: the proof is this browser's own secret, the same on every
  // answer (so a re-answer after a reconnect still counts as ours), and never the public key.
  it('proves its answers with one per-browser secret', () => {
    const { result, send } = withKey('me');
    act(() => result.current.receivePoll(poll('p1')));
    act(() => result.current.answerPoll('pizza'));
    act(() => result.current.answerPoll('sushi'));
    const [first, second] = sentOps(send).map((op) =>
      op?.kind === 'poll-answer' ? op.proof : undefined,
    );
    expect(first?.length).toBeGreaterThan(20);
    expect(second).toBe(first);
    expect(first).not.toBe('me');
    expect(localStorage.getItem('livehuddle:v2:collab-secret')).toBe(first);
  });

  it('hosts the poll it starts, until it ends or a peer poll replaces it', () => {
    const { result } = withKey('me');
    act(() => result.current.startPoll({ question: 'Lunch?', style: 'text', options: [] }));
    expect(result.current.isHost).toBe(true);
    act(() => result.current.endPoll());
    expect(result.current.isHost).toBe(false);
    act(() => result.current.startPoll({ question: 'Tea?', style: 'text', options: [] }));
    act(() => result.current.receivePoll({ ...poll('peer'), startedAt: Date.now() + 1000 }));
    expect(result.current.poll?.id).toBe('peer');
    expect(result.current.isHost).toBe(false);
  });

  it('stays on the newer of two polls started at once', () => {
    const { result } = withKey('me');
    act(() => result.current.receivePoll({ ...poll('late'), startedAt: 9 }));
    act(() => result.current.receivePoll({ ...poll('early'), startedAt: 3 }));
    expect(result.current.poll?.id).toBe('late');
  });
});

// docs/specs/012-collaboration/facilitator.md "Poll: start, end"
describe('pollHostFor', () => {
  const base = { started: false, open: true, sessionToolsBlocked: false, facilitating: false };

  it('is the starter while nobody else holds the baton', () => {
    expect(pollHostFor({ ...base, started: true })).toBe(true);
    expect(pollHostFor(base)).toBe(false);
  });

  it('passes to the facilitator when the baton is taken mid-poll', () => {
    expect(pollHostFor({ ...base, started: true, sessionToolsBlocked: true })).toBe(false);
    expect(pollHostFor({ ...base, facilitating: true })).toBe(true);
  });

  it('is nobody once the poll has closed', () => {
    expect(pollHostFor({ ...base, open: false, facilitating: true })).toBe(false);
  });
});
