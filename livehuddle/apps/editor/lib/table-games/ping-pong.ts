// The Ping-Pong Table's game (docs/specs/009-elements/social-pieces.md "A game", "The wire"), as pure functions every
// screen runs alike: the ball's flight between two moments, a strike at a paddle, the score and the service, and the
// match each screen keeps from the moments it receives. Nothing here reads a clock or the network: the caller passes
// its own time, so every screen given the same moments draws the same rally.
//
// The play area is the table top, 0 to 1 across (left seat's end to right seat's) and 0 to 1 down. Speeds are play
// areas per second. Seat 0 is the left end, seat 1 the right.

import type { GameBall, GameEventOp } from '@livehuddle/api-schema';

export type Seat = 0 | 1;
export type Score = [number, number];

export const PONG = {
  /** Each paddle's line, in from its end. */
  paddleX: 0.04,
  /** Half a paddle's length. */
  paddleHalf: 0.16,
  /** The ball's radius, down the play area. */
  ballR: 0.04,
  /** A serve's speed across. */
  serveSpeed: 0.7,
  /** Each strike multiplies the speed across by this, up to `maxSpeed`. */
  speedUp: 1.06,
  maxSpeed: 1.6,
  /** At a paddle's tip the ball leaves this steeply: speed down over speed across. */
  maxSlope: 1.4,
  /** A serve's steepest slope. */
  serveSlope: 0.5,
  /** First to this, by `winBy` clear. */
  winAt: 11,
  winBy: 2,
  /** The pause before a serve, after a point or at a game's start ("Ready"). */
  servePauseMs: 1_000,
  /** How long a won game shows its winner before the next starts. */
  wonPauseMs: 5_000,
  /** How long past its due moment a player's word may take before they count as gone. */
  silentMs: 3_000,
} as const;

/** The seat a ball is travelling to. */
export function endOf(ball: GameBall): Seat {
  return ball.vx > 0 ? 1 : 0;
}

/** A seat's paddle line, across the play area. */
export function paddleLine(seat: Seat): number {
  return seat === 0 ? PONG.paddleX : 1 - PONG.paddleX;
}

/** The ball `ms` after it left: straight across, folded at the long sides. */
export function ballAt(ball: GameBall, ms: number): { x: number; y: number } {
  const t = ms / 1000;
  const r = PONG.ballR;
  const span = 1 - 2 * r;
  const travelled = ball.y - r + ball.vy * t;
  const lap = 2 * span;
  let m = ((travelled % lap) + lap) % lap;
  if (m > span) m = lap - m;
  return { x: ball.x + ball.vx * t, y: r + m };
}

/** How long after it left the ball reaches the paddle line it is travelling to. */
export function arrivalMs(ball: GameBall): number {
  if (ball.vx === 0) return Number.POSITIVE_INFINITY;
  return ((paddleLine(endOf(ball)) - ball.x) / ball.vx) * 1000;
}

/**
 * The ball as it leaves `seat`'s paddle when it meets it there, the paddle's middle at `paddleY`; null when it
 * misses. Where it meets the paddle sets the angle: the middle straight, the tips steeply.
 */
export function strike(ball: GameBall, seat: Seat, paddleY: number): GameBall | null {
  if (endOf(ball) !== seat) return null;
  const { y } = ballAt(ball, arrivalMs(ball));
  const offset = (y - paddleY) / (PONG.paddleHalf + PONG.ballR);
  if (Math.abs(offset) > 1) return null;
  const speed = Math.min(Math.abs(ball.vx) * PONG.speedUp, PONG.maxSpeed);
  return {
    x: paddleLine(seat),
    y,
    vx: seat === 0 ? speed : -speed,
    vy: offset * PONG.maxSlope * speed,
  };
}

/** A serve from `seat`'s paddle at `paddleY`, `tilt` from -1 (steeply up) to 1 (steeply down). */
export function serveBall(seat: Seat, paddleY: number, tilt: number): GameBall {
  const r = PONG.ballR;
  const t = Math.max(-1, Math.min(1, tilt));
  return {
    x: paddleLine(seat),
    y: Math.max(r, Math.min(1 - r, paddleY)),
    vx: seat === 0 ? PONG.serveSpeed : -PONG.serveSpeed,
    vy: t * PONG.serveSlope * PONG.serveSpeed,
  };
}

/** Who serves at `score`: the left seat first, service changing every two points, and every point from 10 all. */
export function serverAt(score: Score): Seat {
  const total = score[0] + score[1];
  const deuce = (PONG.winAt - 1) * 2;
  const turn = total < deuce ? Math.floor(total / 2) : total;
  return turn % 2 === 0 ? 0 : 1;
}

/** The seat that has won at `score`, or null while the game goes on. */
export function winnerAt(score: Score): Seat | null {
  const [l, r] = score;
  if (l >= PONG.winAt && l - r >= PONG.winBy) return 0;
  if (r >= PONG.winAt && r - l >= PONG.winBy) return 1;
  return null;
}

/** The score after a point to `seat`. */
export function pointTo(score: Score, seat: Seat): Score {
  return seat === 0 ? [score[0] + 1, score[1]] : [score[0], score[1] + 1];
}

// --- A match, as each screen keeps it -------------------------------------------------------------------------------

/**
 * One game as a screen knows it. `serve`: waiting for the server; `flight`: the ball travelling to its end, which
 * strikes or misses next; `won`: the game is over. `since` is the screen's own time the phase began.
 */
export type PongMatch = {
  match: string;
  seq: number;
  score: Score;
  phase: 'serve' | 'flight' | 'won';
  ball: GameBall | null;
  since: number;
};

/** The seat whose moment is next, or null once the game is won. */
export function nextSeat(m: PongMatch): Seat | null {
  if (m.phase === 'won') return null;
  if (m.phase === 'serve') return serverAt(m.score);
  return endOf(m.ball!);
}

const sameScore = (a: readonly number[], b: readonly number[]) => a[0] === b[0] && a[1] === b[1];

/**
 * The match after one moment, received (or sent) at `now`: `current` itself when the moment does not follow it. A
 * left seat's first serve at 0 all starts a new match whatever was showing; every other moment must be the next one
 * of the match on show, from the seat whose moment it is, keeping the score (a serve, a hit) or giving the point to
 * the other seat (a miss).
 */
export function applyPongEvent(
  current: PongMatch | null,
  ev: GameEventOp,
  now: number,
): PongMatch | null {
  const opens =
    ev.event === 'serve' && ev.seq === 1 && ev.seat === 0 && sameScore(ev.score, [0, 0]);
  if (opens) {
    // A replay of the opening serve already on show changes nothing.
    if (current?.match === ev.match) return current;
    return { match: ev.match, seq: 1, score: [0, 0], phase: 'flight', ball: ev.ball!, since: now };
  }
  // A screen that opened the tab (or came back) mid-game joins from its next moment, which carries the score after
  // it (the spec's "Watching"): with no game on show, or only a won one, a later moment of another match is taken.
  if (!current || (current.phase === 'won' && ev.match !== current.match)) {
    return joinLate(ev, now) ?? current;
  }
  if (ev.match !== current.match || ev.seq !== current.seq + 1) return current;
  if (ev.seat !== nextSeat(current)) return current;
  if (ev.event === 'serve') {
    if (current.phase !== 'serve' || !sameScore(ev.score, current.score)) return current;
    return { ...current, seq: ev.seq, phase: 'flight', ball: ev.ball!, since: now };
  }
  if (current.phase !== 'flight') return current;
  if (ev.event === 'hit') {
    if (!sameScore(ev.score, current.score)) return current;
    return { ...current, seq: ev.seq, ball: ev.ball!, since: now };
  }
  const score = pointTo(current.score, ev.seat === 0 ? 1 : 0);
  if (!sameScore(ev.score, score)) return current;
  const phase = winnerAt(score) === null ? 'serve' : 'won';
  return { ...current, seq: ev.seq, score, phase, ball: null, since: now };
}

/**
 * A match picked up from one moment of it, or null when the moment could not be one: a serve from the seat that
 * serves at that score, after a point; a strike sending the ball away from the striker; a miss giving the other seat
 * a point.
 */
function joinLate(ev: GameEventOp, now: number): PongMatch | null {
  const score: Score = [ev.score[0], ev.score[1]];
  if (ev.seq < 2 || !score.every((n) => Number.isInteger(n) && n >= 0)) return null;
  if (ev.event === 'miss') {
    if (score[ev.seat === 0 ? 1 : 0] < 1) return null;
    const phase = winnerAt(score) === null ? 'serve' : 'won';
    return { match: ev.match, seq: ev.seq, score, phase, ball: null, since: now };
  }
  if (!ev.ball || winnerAt(score) !== null) return null;
  if (ev.event === 'serve' && (score[0] + score[1] === 0 || serverAt(score) !== ev.seat))
    return null;
  if (endOf(ev.ball) === ev.seat) return null;
  return { match: ev.match, seq: ev.seq, score, phase: 'flight', ball: ev.ball, since: now };
}

/** Where the ball is drawn at `now`: in flight, held at the far paddle line until that end's word comes; else none. */
export function ballShown(m: PongMatch, now: number): { x: number; y: number } | null {
  if (m.phase !== 'flight' || !m.ball) return null;
  return ballAt(m.ball, Math.min(Math.max(0, now - m.since), arrivalMs(m.ball)));
}

/**
 * The screen's time after which the player whose moment is next counts as gone (docs/specs/009-elements/
 * social-pieces.md "A silent player"): `silentMs` past the moment's due time. The next game after a win is the left
 * seat's to start.
 */
export function silentAfter(m: PongMatch): number {
  if (m.phase === 'flight') return m.since + arrivalMs(m.ball!) + PONG.silentMs;
  if (m.phase === 'serve') return m.since + PONG.servePauseMs + PONG.silentMs;
  return m.since + PONG.wonPauseMs + PONG.silentMs;
}
