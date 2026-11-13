// A game played at a piece (docs/specs/009-elements/social-pieces.md "Ping-Pong Table", "The wire"): two presence ops,
// never stored, ordered or replayed. `game-input` is one player's control, a sample at most every GAME_INPUT_MS;
// `game-event` is one moment of the game, sent only by the player whose moment it is. Both name the piece and a seat
// and carry the game's own payload, so the Arcade Machine's game (Work Tracker #529) rides the same two ops.

const TAB_ID_MAX = 64;
/** A piece's element id, as long as an element id may be. */
const PIECE_ID_MAX = 64;
/** A match id: a short random id the starting player picks. */
const MATCH_ID_MAX = 32;
/** The most seats a game piece has. */
const SEATS_MAX = 8;
/** The highest moment count a match may reach: far past any game of ping-pong. */
const SEQ_MAX = 100_000;
/** The highest score either side may hold. */
const SCORE_MAX = 999;
/** The fastest a ball may travel, in play areas per second. */
const SPEED_MAX = 20;

/** A player's input goes at most this often (20 a second), and only when it changed. */
export const GAME_INPUT_MS = 50;

/** One player's control: `axis` from 0 (the top of the play area) to 1 (its bottom). */
export type GameInputOp = {
  kind: 'game-input';
  tabId: string;
  pieceId: string;
  seat: number;
  axis: number;
};

/** The ball as it leaves a paddle: position across the play area (0 to 1) and speed in play areas per second. */
export type GameBall = { x: number; y: number; vx: number; vy: number };

/** A ping-pong moment: a serve, a strike or a miss, by the player whose moment it is. */
export type PingPongEvent = 'serve' | 'hit' | 'miss';

export type GameEventOp = {
  kind: 'game-event';
  tabId: string;
  pieceId: string;
  seat: number;
  game: 'ping-pong';
  /** The match this moment belongs to: a fresh id per game. */
  match: string;
  /** The moment's count in its match, from 1. */
  seq: number;
  event: PingPongEvent;
  /** The ball as it leaves, on a serve or a hit. */
  ball?: GameBall;
  /** The score after this moment, left seat first. */
  score: [number, number];
};

const isField = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;
const isCount = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isUnit = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const isSpeed = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= SPEED_MAX;

type Loose<T> = Partial<Record<keyof T, unknown>> | null;

/** The piece and seat every game op names, or null. */
function parseGameSeat(
  o: Loose<GameInputOp>,
): { tabId: string; pieceId: string; seat: number } | null {
  if (!o || !isField(o.tabId, TAB_ID_MAX) || !isField(o.pieceId, PIECE_ID_MAX)) return null;
  if (!isCount(o.seat, 0, SEATS_MAX - 1)) return null;
  return { tabId: o.tabId, pieceId: o.pieceId, seat: o.seat };
}

/** A `game-input` op as sent, or null. */
export function parseGameInput(op: unknown): GameInputOp | null {
  const o = op as Loose<GameInputOp>;
  if (o?.kind !== 'game-input') return null;
  const at = parseGameSeat(o);
  if (!at || !isUnit(o.axis)) return null;
  return { kind: 'game-input', ...at, axis: o.axis };
}

function parseBall(v: unknown): GameBall | null {
  const b = v as Loose<GameBall>;
  if (typeof b !== 'object' || b === null) return null;
  if (!isUnit(b.x) || !isUnit(b.y) || !isSpeed(b.vx) || !isSpeed(b.vy)) return null;
  return { x: b.x, y: b.y, vx: b.vx, vy: b.vy };
}

function parseScore(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [l, r] = v as unknown[];
  return isCount(l, 0, SCORE_MAX) && isCount(r, 0, SCORE_MAX) ? [l, r] : null;
}

/** A `game-event` op as sent, or null: a serve and a hit carry the ball, a miss none. */
export function parseGameEvent(op: unknown): GameEventOp | null {
  const o = op as Loose<GameEventOp>;
  if (o?.kind !== 'game-event' || o.game !== 'ping-pong') return null;
  const at = parseGameSeat(o);
  if (!at || !isField(o.match, MATCH_ID_MAX) || !isCount(o.seq, 1, SEQ_MAX)) return null;
  const score = parseScore(o.score);
  if (!score) return null;
  const base = {
    kind: 'game-event',
    ...at,
    game: 'ping-pong',
    match: o.match,
    seq: o.seq,
  } as const;
  if (o.event === 'miss') return { ...base, event: 'miss', score };
  if (o.event !== 'serve' && o.event !== 'hit') return null;
  const ball = parseBall(o.ball);
  return ball ? { ...base, event: o.event, ball, score } : null;
}

/**
 * The most `game-event`s the room relays from one sender in one window (social-pieces.md "A cap per sender"). A fast
 * rally is one or two moments a second from each player (a miss and the next serve together are two), so a real game
 * never meets it; a flood from one screen reaches nobody past it.
 */
export const GAME_EVENT_CAP = 6;
/** The cap's window: a reset-on-expiry second, as the room's flood cap counts. */
export const GAME_EVENT_WINDOW_MS = 1_000;
/** Past this many senders the throttle prunes those whose window has run out. */
const GAME_EVENT_SENDERS_MAX = 256;

/**
 * The room's per-sender `game-event` cap: whether one from `sender` at `now` may pass, counting it when it does.
 * Bounded by the connections in the room (the caller forgets a sender when its socket closes) and pruned of stale
 * windows as it goes, like the knock throttle.
 */
export function createGameEventThrottle(cap = GAME_EVENT_CAP, windowMs = GAME_EVENT_WINDOW_MS) {
  const windows = new Map<string, { count: number; start: number }>();
  return {
    allow(sender: string, now: number): boolean {
      const w = windows.get(sender);
      if (w && now - w.start < windowMs) {
        if (w.count >= cap) return false;
        w.count += 1;
        return true;
      }
      windows.set(sender, { count: 1, start: now });
      if (windows.size > GAME_EVENT_SENDERS_MAX)
        for (const [id, x] of windows) if (now - x.start >= windowMs) windows.delete(id);
      return true;
    },
    forget(sender: string): void {
      windows.delete(sender);
    },
  };
}
