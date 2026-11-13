import { describe, expect, it } from 'vitest';
import {
  createGameEventThrottle,
  GAME_EVENT_CAP,
  GAME_EVENT_WINDOW_MS,
  parseGameEvent,
  parseGameInput,
} from './table-game';
import { isPresenceOpKind } from './room-messages';

// docs/specs/009-elements/social-pieces.md "The wire".
describe('parseGameInput', () => {
  const input = { kind: 'game-input', tabId: 't', pieceId: 'table-1', seat: 1, axis: 0.25 };
  it('keeps a well-formed input and nothing else', () => {
    expect(parseGameInput({ ...input, extra: 1 })).toEqual(input);
    expect(parseGameInput({ ...input, axis: 0 })).not.toBeNull();
    expect(parseGameInput({ ...input, axis: 1, seat: 7 })).not.toBeNull();
  });
  it('refuses a wrong kind, a bad seat, an axis off the play area, or missing fields', () => {
    expect(parseGameInput(null)).toBeNull();
    expect(parseGameInput({ ...input, kind: 'game-event' })).toBeNull();
    expect(parseGameInput({ ...input, tabId: '' })).toBeNull();
    expect(parseGameInput({ ...input, pieceId: 'x'.repeat(65) })).toBeNull();
    for (const seat of [-1, 8, 0.5, '0']) expect(parseGameInput({ ...input, seat })).toBeNull();
    for (const axis of [-0.01, 1.01, Number.NaN, '0.5', undefined])
      expect(parseGameInput({ ...input, axis })).toBeNull();
  });
});

describe('parseGameEvent', () => {
  const ball = { x: 0.04, y: 0.5, vx: 0.7, vy: -0.2 };
  const serve = {
    kind: 'game-event',
    tabId: 't',
    pieceId: 'table-1',
    seat: 0,
    game: 'ping-pong',
    match: 'm1',
    seq: 1,
    event: 'serve',
    ball,
    score: [0, 0],
  };
  it('keeps a serve and a hit with their ball, and a miss without one', () => {
    expect(parseGameEvent({ ...serve, extra: true })).toEqual(serve);
    expect(parseGameEvent({ ...serve, event: 'hit', seq: 2, seat: 1 })).toEqual({
      ...serve,
      event: 'hit',
      seq: 2,
      seat: 1,
    });
    const { ball: _ball, ...noBall } = serve;
    expect(parseGameEvent({ ...serve, event: 'miss', score: [0, 1] })).toEqual({
      ...noBall,
      event: 'miss',
      score: [0, 1],
    });
  });
  it('refuses a serve or a hit without a ball on the play area', () => {
    expect(parseGameEvent({ ...serve, ball: undefined })).toBeNull();
    expect(parseGameEvent({ ...serve, event: 'hit', ball: null })).toBeNull();
    expect(parseGameEvent({ ...serve, ball: { ...ball, x: 1.5 } })).toBeNull();
    expect(parseGameEvent({ ...serve, ball: { ...ball, vx: 21 } })).toBeNull();
    expect(
      parseGameEvent({ ...serve, ball: { ...ball, vy: Number.POSITIVE_INFINITY } }),
    ).toBeNull();
  });
  it('refuses another game, an unknown moment, a bad match, count or score', () => {
    expect(parseGameEvent(null)).toBeNull();
    expect(parseGameEvent({ ...serve, kind: 'game-input' })).toBeNull();
    expect(parseGameEvent({ ...serve, game: 'pool' })).toBeNull();
    expect(parseGameEvent({ ...serve, event: 'let' })).toBeNull();
    expect(parseGameEvent({ ...serve, match: '' })).toBeNull();
    expect(parseGameEvent({ ...serve, match: 'x'.repeat(33) })).toBeNull();
    for (const seq of [0, 1.5, 100_001]) expect(parseGameEvent({ ...serve, seq })).toBeNull();
    for (const score of [[0], [0, -1], [0, 1000], [0, 0.5], 'x', null])
      expect(parseGameEvent({ ...serve, score })).toBeNull();
    expect(parseGameEvent({ ...serve, seat: 9 })).toBeNull();
  });
  it('is presence: never ordered, logged or replayed', () => {
    expect(isPresenceOpKind('game-input')).toBe(true);
    expect(isPresenceOpKind('game-event')).toBe(true);
  });
});

// social-pieces.md "A cap per sender" (Work Tracker 624).
describe('createGameEventThrottle', () => {
  it('passes up to the cap in a window, then nothing until the window runs out', () => {
    const t = createGameEventThrottle();
    const passed = Array.from({ length: 50 }, () => t.allow('a', 1000)).filter(Boolean);
    expect(passed).toHaveLength(GAME_EVENT_CAP);
    expect(t.allow('a', 1000 + GAME_EVENT_WINDOW_MS - 1)).toBe(false);
    expect(t.allow('b', 1000)).toBe(true);
    expect(t.allow('a', 1000 + GAME_EVENT_WINDOW_MS)).toBe(true);
  });
  it('lets a fast rally through untouched: a moment every 300 ms, and a miss with its serve', () => {
    const t = createGameEventThrottle();
    for (let at = 0; at < 60_000; at += 300) expect(t.allow('a', at)).toBe(true);
    expect(t.allow('a', 60_000)).toBe(true);
    expect(t.allow('a', 60_001)).toBe(true);
  });
  it('forgets a sender, and prunes stale senders past 256', () => {
    const t = createGameEventThrottle(1, 1000);
    expect(t.allow('a', 0)).toBe(true);
    t.forget('a');
    expect(t.allow('a', 0)).toBe(true);
    for (let i = 0; i < 300; i += 1) t.allow(`s${i}`, 0);
    expect(t.allow('late', 5000)).toBe(true);
    expect(t.allow('s1', 5000)).toBe(true);
  });
});
