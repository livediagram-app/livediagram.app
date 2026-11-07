import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { GAME_INPUT_MS, type GameEventOp } from '@livehuddle/api-schema';
import type { GameSeats } from './game-seats';
import { arrivalMs, ballAt, endOf, PONG, silentAfter } from './ping-pong';
import { PADDLE_MAX, PADDLE_MIN, PongSession } from './pong-session';
import type { GameSignal } from './table-game-scene';

// docs/specs/009-elements/social-pieces.md "A game", "The wire": two players' screens and a watcher's, joined by a
// fake room that relays every op to the others at once (or never, for a player gone silent).

const PIECE = 'table';
const ANN = { id: 'ann', name: 'Ann', color: '#ef4444' };
const BOB = { id: 'bob', name: 'Bob', color: '#3b82f6' };
const FRAME = 16;

function seatsFor(selfId: string | null, left = ANN, right: typeof BOB | null = BOB): GameSeats {
  return [
    { ...left, self: left.id === selfId },
    right ? { ...right, self: right.id === selfId } : null,
  ];
}

type Screen = { id: string; session: PongSession; sent: GameSignal[]; won: number };

function table() {
  let ids = 0;
  const screens: Screen[] = [];
  const muted = new Set<string>();
  // Screens whose frames stop (a hidden tab): they hear the room but take no step.
  const paused = new Set<string>();
  let now = 0;
  const make = (id: string) => {
    const screen: Screen = { id, session: null!, sent: [], won: 0 };
    screen.session = new PongSession({
      pieceId: PIECE,
      send: (op) => {
        screen.sent.push(op);
        if (muted.has(id)) return;
        for (const other of screens)
          if (other !== screen) other.session.receive(id, { ...op, tabId: 't' }, now);
      },
      newMatchId: () => `m${(ids += 1)}`,
      random: () => 0.75,
      onWon: () => {
        screen.won += 1;
      },
    });
    screens.push(screen);
    return screen;
  };
  const ann = make(ANN.id);
  const bob = make(BOB.id);
  const sam = make('sam');
  const seatAll = (canPlay = true) => {
    ann.session.setSeats(seatsFor(ANN.id), canPlay);
    bob.session.setSeats(seatsFor(BOB.id), canPlay);
    sam.session.setSeats(seatsFor('sam'), canPlay);
  };
  // Run frames until `done` holds (at most `ms`); true when it did.
  const until = (done: () => boolean, ms: number, each?: () => void) => {
    for (let t = 0; t < ms; t += FRAME) {
      if (done()) return true;
      now += FRAME;
      each?.();
      for (const s of screens) if (!paused.has(s.id)) s.session.tick(now, FRAME);
    }
    return done();
  };
  const run = (ms: number, each?: () => void) => {
    for (let t = 0; t < ms; t += FRAME) {
      now += FRAME;
      each?.();
      for (const s of screens) if (!paused.has(s.id)) s.session.tick(now, FRAME);
    }
  };
  return { ann, bob, sam, seatAll, run, until, muted, paused, at: () => now };
}

// A player who meets every ball: the paddle where the ball will cross its line.
function meet(s: PongSession, seat: 0 | 1) {
  const m = s.match;
  if (m?.phase === 'flight' && m.ball && endOf(m.ball) === seat)
    s.setAxis(ballAt(m.ball, arrivalMs(m.ball)).y);
}
// A player who misses every ball: the paddle as far from it as the table allows.
function dodge(s: PongSession, seat: 0 | 1) {
  const m = s.match;
  if (m?.phase === 'flight' && m.ball && endOf(m.ball) === seat)
    s.setAxis(ballAt(m.ball, arrivalMs(m.ball)).y > 0.5 ? PADDLE_MIN : PADDLE_MAX);
}

describe('PongSession: a game', () => {
  it('plays to 11 with the same score on both players and a watcher, counted once on the left', () => {
    const { ann, bob, sam, seatAll, until } = table();
    seatAll();
    // Ann misses the first ball that comes to her and meets every one after; Bob misses every ball.
    const won = until(
      () => ann.session.shownView.status === 'won',
      90_000,
      () => {
        if (ann.session.match?.score[1] === 0) dodge(ann.session, 0);
        else meet(ann.session, 0);
        dodge(bob.session, 1);
      },
    );
    expect(won).toBe(true);
    const views = [ann, bob, sam].map((s) => s.session.shownView);
    expect(views[0]).toEqual({ status: 'won', score: [11, 1], winner: 0 });
    expect(views[1]).toEqual(views[0]);
    expect(views[2]).toEqual(views[0]);
    expect([ann.won, bob.won, sam.won]).toEqual([1, 0, 0]);
  });

  it('starts the next game five seconds after a win while both still sit', () => {
    const { ann, bob, seatAll, until, at } = table();
    seatAll();
    const play = () => {
      meet(ann.session, 0);
      dodge(bob.session, 1);
    };
    until(() => ann.session.match?.phase === 'won', 90_000, play);
    const wonAt = at();
    until(() => ann.session.match?.match === 'm2', 10_000, play);
    expect(at() - wonAt).toBeGreaterThanOrEqual(PONG.wonPauseMs - FRAME);
    expect(at() - wonAt).toBeLessThanOrEqual(PONG.wonPauseMs + FRAME * 2);
    expect(bob.session.match?.match).toBe('m2');
    expect(ann.session.shownView).toEqual({ status: 'play', score: [0, 0], winner: null });
  });

  it('reads Ready for a second, then the left player serves', () => {
    const { ann, bob, sam, seatAll, run } = table();
    seatAll();
    run(FRAME * 4);
    expect(ann.session.shownView.status).toBe('ready');
    expect(bob.session.shownView.status).toBe('ready');
    expect(sam.session.shownView.status).toBe('ready');
    expect(ann.session.match).toBeNull();
    run(PONG.servePauseMs);
    expect(ann.session.shownView).toEqual({ status: 'play', score: [0, 0], winner: null });
    expect(bob.session.match?.phase).toBe('flight');
    expect(sam.session.match?.seq).toBe(1);
  });

  it('rests the ball at the server before a serve, and draws none with no game', () => {
    const { ann, bob, seatAll, until } = table();
    expect(ann.session.ball(0)).toBeNull();
    seatAll();
    // Ann serves, Bob misses: Ann serves again, the ball resting at her paddle meanwhile.
    until(
      () => ann.session.match?.phase === 'serve',
      5_000,
      () => dodge(bob.session, 1),
    );
    expect(ann.session.match?.score).toEqual([1, 0]);
    const rest = ann.session.ball(0)!;
    expect(rest.x).toBeGreaterThan(PONG.paddleX);
    expect(rest.y).toBeCloseTo(ann.session.paddle(0));
    // After two points the service passes to Bob: the ball rests at his paddle, on his side of it.
    const bobServes = () =>
      ann.session.match?.score[0] === 2 && ann.session.match.phase === 'serve';
    until(bobServes, 5_000, () => dodge(bob.session, 1));
    const his = ann.session.ball(0)!;
    expect(his.x).toBeLessThan(1 - PONG.paddleX);
    expect(his.y).toBeCloseTo(ann.session.paddle(1));
  });
});

describe('PongSession: who may play', () => {
  it('starts nothing while a seat is empty, and sends no paddle', () => {
    const { ann, run } = table();
    ann.session.setSeats(seatsFor(ANN.id, ANN, null), true);
    run(5_000);
    expect(ann.session.shownView.status).toBe('rest');
    expect(ann.sent).toEqual([]);
  });

  it('starts nothing while the other player has not said their screen can play (reduced motion)', () => {
    const { ann, bob, run } = table();
    ann.session.setSeats(seatsFor(ANN.id), true);
    bob.session.setSeats(seatsFor(BOB.id), false);
    run(10_000);
    expect(ann.session.match).toBeNull();
    expect(ann.session.shownView.status).toBe('rest');
    expect(bob.session.shownView.status).toBe('reduced');
    expect(bob.sent).toEqual([]);
  });

  it('ends a player’s game when their motion turns reduced, but not a watcher’s', () => {
    const { ann, bob, sam, seatAll, run } = table();
    seatAll();
    run(PONG.servePauseMs + 100);
    sam.session.setSeats(seatsFor('sam'), false);
    expect(sam.session.match).not.toBeNull();
    bob.session.setSeats(seatsFor(BOB.id), false);
    expect(bob.session.match).toBeNull();
    expect(ann.session.match).not.toBeNull();
  });

  it('ignores ops from anyone but the seat’s sitter, for another table, or for a seat it lacks', () => {
    const { ann, seatAll } = table();
    seatAll();
    const input = { kind: 'game-input', tabId: 't', pieceId: PIECE, seat: 1, axis: 0.9 } as const;
    ann.session.receive('mallory', input, 0);
    ann.session.receive(BOB.id, { ...input, pieceId: 'other' }, 0);
    ann.session.receive(BOB.id, { ...input, seat: 2 }, 0);
    ann.session.receive(ANN.id, { ...input, seat: 0 }, 0);
    ann.session.tick(1, 1_000);
    expect(ann.session.paddle(1)).toBe(0.5);
    expect(ann.session.shownView.status).toBe('rest');
    ann.session.receive(BOB.id, input, 0);
    ann.session.tick(2, 1_000);
    expect(ann.session.paddle(1)).toBeCloseTo(0.9);
    expect(ann.session.shownView.status).toBe('ready');
  });

  it('ignores a forged opening serve from the right seat', () => {
    const { sam, seatAll } = table();
    seatAll();
    const serve: GameEventOp = {
      kind: 'game-event',
      tabId: 't',
      pieceId: PIECE,
      seat: 1,
      game: 'ping-pong',
      match: 'x',
      seq: 1,
      event: 'serve',
      ball: { x: 0.96, y: 0.5, vx: -0.7, vy: 0 },
      score: [0, 0],
    };
    sam.session.receive(BOB.id, serve, 0);
    expect(sam.session.match).toBeNull();
  });
});

describe('PongSession: leaving and silence', () => {
  it('ends the game at once on every screen when a player stands up', () => {
    const { ann, bob, sam, seatAll, run } = table();
    seatAll();
    run(PONG.servePauseMs + 300);
    expect(sam.session.match).not.toBeNull();
    for (const [s, id] of [
      [ann, ANN.id],
      [bob, BOB.id],
      [sam, 'sam'],
    ] as const)
      s.session.setSeats(seatsFor(id, ANN, null), true);
    expect([ann, bob, sam].map((s) => s.session.shownView.status)).toEqual([
      'rest',
      'rest',
      'rest',
    ]);
  });

  it('ends the game when the player whose moment it is goes silent for three seconds, and starts again when they speak', () => {
    const { ann, bob, sam, seatAll, run, muted, at } = table();
    seatAll();
    run(PONG.servePauseMs + 50);
    const m = ann.session.match!;
    // Bob's screen stops reaching the room (a dropped connection) just as the ball heads for him.
    muted.add(BOB.id);
    const due = silentAfter(m);
    run(due - at() - 100);
    expect(ann.session.match).not.toBeNull();
    run(300);
    expect(ann.session.match).toBeNull();
    expect(sam.session.match).toBeNull();
    expect(ann.session.shownView.status).toBe('rest');
    // Back: Bob's screen says it can play again (its own game ended the same way), and a new game starts.
    muted.delete(BOB.id);
    run(PONG.silentMs + 1_000 + PONG.servePauseMs + 500);
    expect(bob.session.match).not.toBeNull();
    expect(ann.session.match?.match).toBe(bob.session.match?.match);
  });
  it('ends a won game on the right player’s screen when the left player never opens the next', () => {
    const { ann, bob, seatAll, until, muted, run } = table();
    seatAll();
    until(
      () => bob.session.match?.phase === 'won',
      90_000,
      () => {
        meet(ann.session, 0);
        dodge(bob.session, 1);
      },
    );
    muted.add(ANN.id);
    run(PONG.wonPauseMs + PONG.silentMs + 200);
    expect(bob.session.match).toBeNull();
    expect(bob.session.shownView.status).toBe('rest');
  });
});

describe('PongSession: a hidden tab', () => {
  it('ends your own game when you come back past your due moment, and says you can play again', () => {
    const { ann, bob, seatAll, run, paused, at } = table();
    seatAll();
    run(PONG.servePauseMs + 50);
    paused.add(BOB.id);
    run(silentAfter(bob.session.match!) - at() + 200);
    expect(ann.session.match).toBeNull();
    const before = bob.sent.length;
    paused.delete(BOB.id);
    run(FRAME);
    expect(bob.session.match).toBeNull();
    expect(bob.sent.slice(before).map((o) => o.kind)).toEqual(['game-input']);
  });
});

describe('PongSession: the paddle', () => {
  it('sends your paddle once on sitting, then only on change, at most every 50 ms', () => {
    const { ann, bob, seatAll, run } = table();
    seatAll();
    run(FRAME);
    expect(ann.sent.filter((o) => o.kind === 'game-input')).toHaveLength(1);
    // A paddle held still sends nothing more (once a game is on, nothing at all; before, a word a second).
    run(400);
    expect(ann.sent.filter((o) => o.kind === 'game-input')).toHaveLength(1);
    // Moving every frame for a second sends at most twenty.
    let y = 0.3;
    run(1_000, () => ann.session.setAxis((y = y === 0.3 ? 0.6 : 0.3)));
    const inputs = ann.sent.filter((o) => o.kind === 'game-input').length - 1;
    expect(inputs).toBeLessThanOrEqual(1_000 / GAME_INPUT_MS + 1);
    expect(inputs).toBeGreaterThanOrEqual(10);
    // Bob's still paddle said only that his screen can play, before the serve.
    expect(bob.sent.filter((o) => o.kind === 'game-input').length).toBeLessThanOrEqual(2);
  });

  it('keeps your paddle on the table, moves it with a held key, and leaves a watcher none', () => {
    const { ann, sam, seatAll } = table();
    seatAll();
    ann.session.setAxis(-1);
    expect(ann.session.axis).toBe(PADDLE_MIN);
    ann.session.setAxis(2);
    expect(ann.session.axis).toBe(PADDLE_MAX);
    ann.session.setAxis(0.5);
    ann.session.nudge(1, 100);
    expect(ann.session.axis).toBeCloseTo(0.65);
    ann.session.nudge(-1, 100);
    expect(ann.session.axis).toBeCloseTo(0.5);
    sam.session.setAxis(0.9);
    sam.session.nudge(1, 100);
    expect(sam.session.axis).toBeNull();
    expect(sam.session.seat).toBeNull();
    expect(ann.session.seat).toBe(0);
  });

  it('eases the other player’s paddle toward their newest sample', () => {
    const { ann, bob, seatAll, run } = table();
    seatAll();
    bob.session.setAxis(0.8);
    run(FRAME * 2);
    const partway = ann.session.paddle(1);
    expect(partway).toBeGreaterThan(0.5);
    expect(partway).toBeLessThan(0.8);
    run(500);
    expect(ann.session.paddle(1)).toBeCloseTo(0.8, 3);
  });
});

describe('PongSession: cost', () => {
  it('steps a running game for half an hour of frames inside a small CPU budget', () => {
    const { ann, seatAll, run } = table();
    seatAll();
    run(PONG.servePauseMs + 100);
    const s = ann.session;
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 100_000; i += 1) {
        s.tick(2_000 + (i % 400), FRAME);
        s.ball(2_000 + (i % 400));
      }
    });
    expect(ms).toBeLessThan(300);
  });
});
