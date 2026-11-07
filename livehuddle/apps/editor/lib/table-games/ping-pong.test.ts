import { describe, expect, it } from 'vitest';
import type { GameBall, GameEventOp } from '@livehuddle/api-schema';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  applyPongEvent,
  arrivalMs,
  ballAt,
  ballShown,
  endOf,
  nextSeat,
  paddleLine,
  PONG,
  pointTo,
  serveBall,
  serverAt,
  silentAfter,
  strike,
  winnerAt,
  type PongMatch,
  type Score,
  type Seat,
} from './ping-pong';

// docs/specs/009-elements/social-pieces.md "A game", "The wire".

const event = (over: Partial<GameEventOp>): GameEventOp => ({
  kind: 'game-event',
  tabId: 't',
  pieceId: 'table',
  seat: 0,
  game: 'ping-pong',
  match: 'm1',
  seq: 1,
  event: 'serve',
  ball: serveBall(0, 0.5, 0),
  score: [0, 0],
  ...over,
});

describe('the ball', () => {
  it('travels straight across and folds at the long sides', () => {
    const ball: GameBall = { x: 0.5, y: 0.5, vx: 1, vy: 0 };
    expect(ballAt(ball, 250).x).toBe(0.75);
    expect(ballAt(ball, 250).y).toBeCloseTo(0.5);
    // Down at one play area a second from the middle: the side (at 1 - r) after 0.46 s, then back up.
    const down: GameBall = { x: 0.5, y: 0.5, vx: 0, vy: 1 };
    const side = 1 - PONG.ballR;
    expect(ballAt(down, (side - 0.5) * 1000).y).toBeCloseTo(side);
    expect(ballAt(down, (side - 0.5 + 0.1) * 1000).y).toBeCloseTo(side - 0.1);
    // Up and off the top side alike, and many laps later still on the area.
    const up: GameBall = { x: 0.5, y: 0.5, vx: 0, vy: -1 };
    expect(ballAt(up, (0.5 - PONG.ballR + 0.1) * 1000).y).toBeCloseTo(PONG.ballR + 0.1);
    for (const ms of [0, 1234, 98_765, 1_000_000]) {
      const { y } = ballAt({ x: 0, y: 0.3, vx: 0, vy: 3.7 }, ms);
      expect(y).toBeGreaterThanOrEqual(PONG.ballR - 1e-9);
      expect(y).toBeLessThanOrEqual(1 - PONG.ballR + 1e-9);
    }
  });

  it('reaches the paddle line it travels to', () => {
    const ball = serveBall(0, 0.5, 0);
    expect(endOf(ball)).toBe(1);
    expect(arrivalMs(ball)).toBeCloseTo(((1 - 2 * PONG.paddleX) / PONG.serveSpeed) * 1000);
    expect(ballAt(ball, arrivalMs(ball)).x).toBeCloseTo(paddleLine(1));
    expect(endOf(serveBall(1, 0.5, 0))).toBe(0);
    expect(arrivalMs({ x: 0.5, y: 0.5, vx: 0, vy: 1 })).toBe(Number.POSITIVE_INFINITY);
  });

  it('serves from the paddle, kept on the area, the tilt bounded', () => {
    expect(serveBall(1, 0.5, 0)).toEqual({
      x: 1 - PONG.paddleX,
      y: 0.5,
      vx: -PONG.serveSpeed,
      vy: 0,
    });
    expect(serveBall(0, 0, 5).y).toBe(PONG.ballR);
    expect(serveBall(0, 1, 5).vy).toBeCloseTo(PONG.serveSlope * PONG.serveSpeed);
    expect(serveBall(0, 1, -5).y).toBe(1 - PONG.ballR);
  });
});

describe('a strike', () => {
  const ball: GameBall = { x: paddleLine(0), y: 0.5, vx: 1, vy: 0 };
  it('sends it straight back from the middle, a little faster', () => {
    const back = strike(ball, 1, 0.5)!;
    expect(back.x).toBe(paddleLine(1));
    expect(back.y).toBeCloseTo(0.5);
    expect(back.vx).toBeCloseTo(-PONG.speedUp);
    expect(back.vy).toBeCloseTo(0);
  });
  it('steeply from a tip, never past the cap', () => {
    const edge = PONG.paddleHalf + PONG.ballR;
    const off = strike(ball, 1, 0.5 - edge + 1e-9)!;
    expect(off.vy).toBeCloseTo(PONG.maxSlope * PONG.speedUp);
    const fast = strike({ ...ball, vx: PONG.maxSpeed }, 1, 0.5)!;
    expect(fast.vx).toBe(-PONG.maxSpeed);
  });
  it('misses past the paddle, or at the wrong end', () => {
    expect(strike(ball, 1, 0.5 - PONG.paddleHalf - PONG.ballR - 0.01)).toBeNull();
    expect(strike(ball, 0, 0.5)).toBeNull();
  });
});

describe('the score', () => {
  it('serves left first, changing every two points and every point from 10 all', () => {
    const at = (l: number, r: number) => serverAt([l, r]);
    expect([at(0, 0), at(1, 0), at(1, 1), at(2, 1), at(2, 2), at(3, 2)]).toEqual([
      0, 0, 1, 1, 0, 0,
    ]);
    expect([at(10, 10), at(11, 10), at(11, 11), at(12, 11)]).toEqual([0, 1, 0, 1]);
  });
  it('is won at 11 by two clear', () => {
    expect(winnerAt([11, 9])).toBe(0);
    expect(winnerAt([3, 11])).toBe(1);
    expect(winnerAt([11, 10])).toBeNull();
    expect(winnerAt([10, 11])).toBeNull();
    expect(winnerAt([14, 12])).toBe(0);
    expect(winnerAt([12, 14])).toBe(1);
    expect(winnerAt([0, 0])).toBeNull();
  });
  it('adds a point to a seat', () => {
    expect(pointTo([2, 3], 0)).toEqual([3, 3]);
    expect(pointTo([2, 3], 1)).toEqual([2, 4]);
  });
});

describe('a match', () => {
  const open = applyPongEvent(null, event({}), 100)!;

  it("opens on the left seat's first serve at 0 all, whatever was showing", () => {
    expect(open).toMatchObject({ match: 'm1', seq: 1, phase: 'flight', score: [0, 0], since: 100 });
    expect(applyPongEvent(open, event({}), 500)).toBe(open);
    const other = applyPongEvent(open, event({ match: 'm2' }), 600)!;
    expect(other.match).toBe('m2');
    // Not an opening: the right seat, a later count or a score.
    expect(applyPongEvent(null, event({ seat: 1 }), 0)).toBeNull();
    expect(applyPongEvent(null, event({ seq: 2 }), 0)).toBeNull();
    expect(applyPongEvent(null, event({ score: [1, 0] }), 0)).toBeNull();
  });

  it('takes a strike from the end the ball reached, and nothing out of turn', () => {
    expect(nextSeat(open)).toBe(1);
    const back = strike(open.ball!, 1, 0.5)!;
    const hit = applyPongEvent(open, event({ seat: 1, seq: 2, event: 'hit', ball: back }), 2000)!;
    expect(hit).toMatchObject({ seq: 2, ball: back, since: 2000, phase: 'flight' });
    expect(nextSeat(hit)).toBe(0);
    // The wrong seat, a skipped or replayed count, another match, a changed score.
    const wrong = [
      event({ seat: 0, seq: 2, event: 'hit', ball: back }),
      event({ seat: 1, seq: 3, event: 'hit', ball: back }),
      event({ seat: 1, seq: 1, event: 'hit', ball: back }),
      event({ seat: 1, seq: 2, event: 'hit', ball: back, match: 'mx' }),
      event({ seat: 1, seq: 2, event: 'hit', ball: back, score: [0, 1] }),
      event({ seat: 1, seq: 2, event: 'serve', ball: back }),
    ];
    for (const ev of wrong) expect(applyPongEvent(open, ev, 2000)).toBe(open);
    expect(applyPongEvent(null, wrong[0]!, 0)).toBeNull();
  });

  it('gives a miss to the other seat, then waits for the server', () => {
    const miss = applyPongEvent(
      open,
      event({ seat: 1, seq: 2, event: 'miss', score: [1, 0] }),
      3000,
    )!;
    expect(miss).toMatchObject({ phase: 'serve', score: [1, 0], ball: null, since: 3000 });
    expect(nextSeat(miss)).toBe(0);
    // A miss claiming the point for itself changes nothing.
    expect(applyPongEvent(open, event({ seat: 1, seq: 2, event: 'miss', score: [0, 1] }), 0)).toBe(
      open,
    );
    // Only a serve follows, at the same score.
    const strikeIn = event({ seat: 0, seq: 3, event: 'hit', score: [1, 0] });
    expect(applyPongEvent(miss, strikeIn, 0)).toBe(miss);
    expect(applyPongEvent(miss, event({ seq: 3, score: [2, 0] }), 0)).toBe(miss);
    const serve = applyPongEvent(miss, event({ seq: 3, score: [1, 0] }), 4000)!;
    expect(serve).toMatchObject({ phase: 'flight', seq: 3, since: 4000 });
    // A miss while waiting for a serve changes nothing.
    expect(applyPongEvent(miss, event({ seat: 0, seq: 3, event: 'miss', score: [1, 1] }), 0)).toBe(
      miss,
    );
  });

  it('ends at a win, and then only a new opening serve moves it', () => {
    const late: PongMatch = { ...open, seq: 40, score: [10, 4] };
    const won = applyPongEvent(
      late,
      event({ seat: 1, seq: 41, event: 'miss', score: [11, 4] }),
      9000,
    )!;
    expect(won.phase).toBe('won');
    expect(nextSeat(won)).toBeNull();
    expect(applyPongEvent(won, event({ seq: 42, score: [11, 4] }), 0)).toBe(won);
    expect(applyPongEvent(won, event({ match: 'm2' }), 0)!.match).toBe('m2');
  });

  it('plays two screens to the same score from the same moments', () => {
    // A whole game: each end strikes from the middle until its paddle sits off the ball, then misses; the two
    // screens get the moments at different times and still agree.
    let a: PongMatch | null = null;
    let b: PongMatch | null = null;
    let seq = 0;
    let score: Score = [0, 0];
    const send = (ev: Partial<GameEventOp>) => {
      seq += 1;
      const op = event({ ...ev, seq, score });
      a = applyPongEvent(a, op, seq * 1000);
      b = applyPongEvent(b, op, seq * 1000 + 87);
    };
    let rally = 0;
    while (winnerAt(score) === null) {
      const server: Seat = serverAt(score);
      send({ seat: server, event: 'serve', ball: serveBall(server, 0.5, 0) });
      let ball = (a as PongMatch | null)!.ball!;
      rally += 1;
      for (let strikes = 0; ; strikes += 1) {
        const end = endOf(ball);
        if (strikes >= rally % 4) {
          score = pointTo(score, end === 0 ? 1 : 0);
          send({ seat: end, event: 'miss' });
          break;
        }
        ball = strike(ball, end, ballAt(ball, arrivalMs(ball)).y)!;
        send({ seat: end, event: 'hit', ball });
      }
    }
    expect(winnerAt(score)).not.toBeNull();
    expect(a).toEqual({ ...(b as unknown as PongMatch), since: (a as unknown as PongMatch).since });
    expect((a as unknown as PongMatch).phase).toBe('won');
    expect((b as unknown as PongMatch).score).toEqual(score);
  });
});

describe('what a screen shows', () => {
  const open = applyPongEvent(null, event({}), 1000)!;
  it('draws the ball in flight, held at the far line until that end answers', () => {
    expect(ballShown(open, 1000)!.x).toBe(paddleLine(0));
    expect(ballShown(open, 1000)!.y).toBeCloseTo(0.5);
    expect(ballShown(open, 500)!.x).toBeCloseTo(paddleLine(0));
    const due = 1000 + arrivalMs(open.ball!);
    expect(ballShown(open, due + 5000)!.x).toBeCloseTo(paddleLine(1));
    expect(ballShown({ ...open, phase: 'serve', ball: null }, 0)).toBeNull();
  });
  it('counts a player gone a few seconds past their due moment', () => {
    const due = 1000 + arrivalMs(open.ball!);
    expect(silentAfter(open)).toBeCloseTo(due + PONG.silentMs);
    expect(silentAfter({ ...open, phase: 'serve' })).toBe(1000 + PONG.servePauseMs + PONG.silentMs);
    expect(silentAfter({ ...open, phase: 'won' })).toBe(1000 + PONG.wonPauseMs + PONG.silentMs);
  });
  it('costs next to nothing a frame', () => {
    // One frame's work is one ballShown: 100,000 of them, a half hour of frames at 60 a second, in a few ms of CPU.
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 100_000; i += 1) ballShown(open, 1000 + (i % 2000));
    });
    expect(ms).toBeLessThan(200);
  });
});
