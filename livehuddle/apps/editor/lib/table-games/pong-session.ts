// One Ping-Pong Table's game on one screen (docs/specs/009-elements/social-pieces.md "A game", "The wire"): who plays,
// the match on show, both paddles, and this screen's own moments. Every screen at the table runs one: a player's
// sends its paddle and its moments, a watcher's only listens. Pure: the caller hands it the time, the seats and what
// arrives, and calls `tick` once a frame (or a few times a second under reduced motion); nothing here reads a clock,
// the DOM or the network, so the tests drive a whole game from one place.
//
// The rules it keeps, each from the spec:
// - The left seat opens a match once both seats hold a player whose screen can play: "Ready" for a second, then the
//   serve. A player's screen says it can play by sending its paddle as soon as both seats are held, after a game
//   ends and once a second while it waits, so a reduced-motion player, who sends none, never starts one.
// - Each end judges its own end: when the ball reaches your paddle line your screen sends the hit or the miss.
// - The server serves a second after a point; a won game shows its winner for five seconds, then the left seat opens
//   the next while both still sit.
// - A player whose word is three seconds overdue is gone: the game ends on every screen, theirs included.
// - Anyone standing up (a seat's player changes) ends it at once.

import {
  GAME_INPUT_MS,
  type GameBall,
  type GameEventOp,
  type GameInputOp,
} from '@livehuddle/api-schema';
import type { GameSeats } from './game-seats';
import {
  applyPongEvent,
  arrivalMs,
  ballShown,
  nextSeat,
  paddleLine,
  pointTo,
  PONG,
  serveBall,
  serverAt,
  silentAfter,
  strike,
  winnerAt,
  type PongMatch,
  type Score,
  type Seat,
} from './ping-pong';
import type { GameSignal } from './table-game-scene';

/** The game as the table shows it: what the scoreboard reads. */
export type PongStatus = 'rest' | 'ready' | 'play' | 'won' | 'reduced';
export type PongView = { status: PongStatus; score: Score | null; winner: Seat | null };

/** The paddle's middle stays this far in from the table's long sides, so the whole paddle is on the table. */
export const PADDLE_MIN = PONG.paddleHalf;
export const PADDLE_MAX = 1 - PONG.paddleHalf;
/** How fast a held key moves your paddle, in play areas per second: the table's height in two thirds of a second. */
export const PADDLE_KEY_SPEED = 1.5;
/** How quickly the other player's paddle eases to its newest sample: a time constant of about one sample. */
export const PADDLE_EASE_MS = 50;
/**
 * While no game is on and both seats are held, a player's screen says it can play this often, even with its paddle
 * still: a word lost to a dropped connection, or sent before the other player's screen was listening, is said again.
 */
export const READY_REPEAT_MS = 1_000;

const SEATS = 2;
const clampAxis = (v: number) => Math.min(PADDLE_MAX, Math.max(PADDLE_MIN, v));
const asSeat = (n: number): Seat => (n === 0 ? 0 : 1);
const other = (s: Seat): Seat => (s === 0 ? 1 : 0);

export type PongSessionDeps = {
  pieceId: string;
  send: (op: GameSignal) => void;
  /** A fresh match id (at most 32 characters). */
  newMatchId: () => string;
  /** A number from 0 to 1: a serve's tilt. */
  random: () => number;
  /** A game played to its end, on the left player's screen alone (the telemetry counts it once). */
  onWon?: () => void;
  /** The scoreboard changed (`shownView` is a new object). */
  onView?: () => void;
};

export class PongSession {
  /** The match on show, or null. */
  match: PongMatch | null = null;
  private players: GameSeats = [null, null];
  private mine: Seat | null = null;
  private canPlay = false;
  /** Whether each seat's player has said their screen can play, since they sat (a sample or a moment from them). */
  private heard: [boolean, boolean] = [false, false];
  /** When both seats were first ready with no match on show: the "Ready" second runs from here. */
  private readySince: number | null = null;
  /** Each paddle's newest position (yours exactly, the other's its last sample) and where it is drawn. */
  private target: [number, number] = [0.5, 0.5];
  private shown: [number, number] = [0.5, 0.5];
  private sentAxis: number | null = null;
  private sentAt = Number.NEGATIVE_INFINITY;
  private announce = true;
  private wonCounted: string | null = null;
  private view: PongView = { status: 'rest', score: null, winner: null };

  private readonly deps: PongSessionDeps;

  constructor(deps: PongSessionDeps) {
    this.deps = deps;
  }

  /** The seat this screen plays on, or null for a watcher. */
  get seat(): Seat | null {
    return this.mine;
  }

  /** The scoreboard now. The same object until it changes, so a React store can hand it out as is. */
  get shownView(): PongView {
    return this.view;
  }

  /**
   * Who sits where, and whether this screen can play (motion not reduced). A seat whose player changed ends the game
   * at once; its new player has said nothing yet.
   */
  setSeats(players: GameSeats, canPlay: boolean): void {
    let changed = false;
    for (let s = 0; s < SEATS; s += 1) {
      if (players[s]?.id === this.players[s]?.id) continue;
      changed = true;
      this.heard[s] = false;
      this.target[s] = 0.5;
      this.shown[s] = 0.5;
    }
    const seat = players.findIndex((p) => p?.self);
    this.mine = seat < 0 ? null : asSeat(seat);
    // Your motion setting changing while you play ends your game; a watcher's changes only what they see.
    if (canPlay !== this.canPlay && seat >= 0) changed = true;
    this.players = players;
    this.canPlay = canPlay;
    if (changed) {
      this.match = null;
      this.readySince = null;
      this.announce = true;
    }
    this.refreshView();
  }

  /** A peer's game op for this table: applied only from the person sitting on the seat it names. */
  receive(from: string, op: GameInputOp | GameEventOp, now: number): void {
    if (op.pieceId !== this.deps.pieceId || op.seat >= SEATS) return;
    const seat = asSeat(op.seat);
    const player = this.players[seat];
    if (!player || player.self || player.id !== from) return;
    this.heard[seat] = true;
    if (op.kind === 'game-input') {
      this.target[seat] = op.axis;
    } else {
      this.adopt(applyPongEvent(this.match, op, now));
    }
    this.refreshView();
  }

  /** Your paddle to `axis` (0 the top of the table, 1 the bottom), as a pointer over the table sets it. */
  setAxis(axis: number): void {
    if (this.mine === null) return;
    this.target[this.mine] = clampAxis(axis);
    this.shown[this.mine] = this.target[this.mine];
  }

  /** Your paddle moved by a held key over `dtMs`: `dir` -1 up, 1 down. */
  nudge(dir: -1 | 1, dtMs: number): void {
    if (this.mine === null) return;
    this.setAxis(this.target[this.mine] + (dir * PADDLE_KEY_SPEED * dtMs) / 1000);
  }

  /** Your paddle now, or null for a watcher. */
  get axis(): number | null {
    return this.mine === null ? null : this.target[this.mine];
  }

  /** Where a seat's paddle is drawn. */
  paddle(seat: Seat): number {
    return this.shown[seat];
  }

  /** Where the ball is drawn at `now`: in flight, or resting at the server's paddle before a serve; else none. */
  ball(now: number): { x: number; y: number } | null {
    const m = this.match;
    if (!m) return null;
    if (m.phase === 'serve') {
      const server = serverAt(m.score);
      const x = paddleLine(server) + (server === 0 ? 1 : -1) * (PONG.ballR + 0.02);
      return { x, y: this.shown[server] };
    }
    return ballShown(m, now);
  }

  /** One step of the game at `now`, `dtMs` after the last. */
  tick(now: number, dtMs: number): void {
    this.ease(dtMs);
    if (this.match && now > silentAfter(this.match)) this.silent();
    else if (this.mine !== null && this.canPlay && this.bothReady()) this.myMoment(now);
    this.trackReady(now);
    this.sendAxis(now);
    this.refreshView();
  }

  // --- Inside --------------------------------------------------------------------------------------------------------

  private ease(dtMs: number): void {
    const k = 1 - Math.exp(-Math.max(0, dtMs) / PADDLE_EASE_MS);
    for (const s of [0, 1] as const) {
      if (s !== this.mine) this.shown[s] += (this.target[s] - this.shown[s]) * k;
    }
  }

  // Your paddle goes to the room on change, at most every GAME_INPUT_MS, and once on its own as soon as both seats
  // are held (the word that your screen can play). Only a player whose screen can play, with someone to play.
  private sendAxis(now: number): void {
    const mine = this.mine;
    if (mine === null || !this.canPlay || !this.players[other(mine)]) return;
    const axis = this.target[mine];
    const repeat = !this.match && now - this.sentAt >= READY_REPEAT_MS;
    if (!this.announce && !repeat && axis === this.sentAxis) return;
    if (now - this.sentAt < GAME_INPUT_MS) return;
    this.deps.send({ kind: 'game-input', pieceId: this.deps.pieceId, seat: mine, axis });
    this.sentAxis = axis;
    this.sentAt = now;
    this.announce = false;
  }

  private ready(seat: Seat): boolean {
    const p = this.players[seat];
    if (!p) return false;
    return p.self ? this.canPlay : this.heard[seat];
  }

  private bothReady(): boolean {
    return this.ready(0) && this.ready(1);
  }

  private trackReady(now: number): void {
    if (this.match || !this.bothReady()) this.readySince = null;
    else this.readySince ??= now;
  }

  // The seat whose word is overdue is gone: the game ends. Gone means not ready until they speak again. Your own
  // screen says it can play again either way: back from a pause (a hidden tab) it was you who went quiet.
  private silent(): void {
    const m = this.match!;
    const waiting = nextSeat(m) ?? 0;
    if (waiting !== this.mine) this.heard[waiting] = false;
    this.announce = true;
    this.match = null;
    this.readySince = null;
  }

  private myMoment(now: number): void {
    const mine = this.mine!;
    const m = this.match;
    if (!m || m.phase === 'won') {
      if (mine !== 0) return;
      const due = m ? m.since + PONG.wonPauseMs : (this.readySince ?? now) + PONG.servePauseMs;
      if (now < due) return;
      const ball = serveBall(0, this.target[0], this.deps.random() * 2 - 1);
      this.emit(
        { match: this.deps.newMatchId(), seq: 1, event: 'serve', ball, score: [0, 0] },
        now,
      );
      return;
    }
    if (nextSeat(m) !== mine) return;
    if (m.phase === 'serve') {
      if (now - m.since < PONG.servePauseMs) return;
      const ball = serveBall(mine, this.target[mine], this.deps.random() * 2 - 1);
      this.emit({ match: m.match, seq: m.seq + 1, event: 'serve', ball, score: m.score }, now);
      return;
    }
    if (now - m.since < arrivalMs(m.ball!)) return;
    const back = strike(m.ball!, mine, this.target[mine]);
    if (back)
      this.emit({ match: m.match, seq: m.seq + 1, event: 'hit', ball: back, score: m.score }, now);
    else
      this.emit(
        { match: m.match, seq: m.seq + 1, event: 'miss', score: pointTo(m.score, other(mine)) },
        now,
      );
  }

  private emit(
    moment: {
      match: string;
      seq: number;
      event: GameEventOp['event'];
      ball?: GameBall;
      score: Score;
    },
    now: number,
  ): void {
    const op: Omit<GameEventOp, 'tabId'> = {
      kind: 'game-event',
      pieceId: this.deps.pieceId,
      seat: this.mine!,
      game: 'ping-pong',
      ...moment,
    };
    this.deps.send(op);
    this.adopt(applyPongEvent(this.match, { ...op, tabId: '' }, now));
  }

  private adopt(next: PongMatch | null): void {
    if (next === this.match) return;
    this.match = next;
    // A game played to its end counts once, on the left player's screen.
    if (next?.phase === 'won' && this.mine === 0 && this.wonCounted !== next.match) {
      this.wonCounted = next.match;
      this.deps.onWon?.();
    }
  }

  private refreshView(): void {
    const m = this.match;
    let status: PongStatus;
    if (m) status = m.phase === 'won' ? 'won' : 'play';
    else if (this.mine !== null && !this.canPlay && this.players[other(this.mine)])
      status = 'reduced';
    else status = this.bothReady() ? 'ready' : 'rest';
    const score = m ? m.score : null;
    const winner = m ? winnerAt(m.score) : null;
    const v = this.view;
    if (v.status === status && v.score === score && v.winner === winner) return;
    this.view = { status, score, winner };
    this.deps.onView?.();
  }
}
