'use client';

import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { OFFICE_ART, PING_PONG_TOP, type ShapeElement } from '@livehuddle/document';
import { IDENTITY_FILL, identityVars } from '@livehuddle/ui';
import { pieceControlProps } from '@/lib/piece-control';
import { paddleLine, PONG, type Seat } from '@/lib/table-games/ping-pong';
import type { PongSession, PongView } from '@/lib/table-games/pong-session';
import type { GamePlayer } from '@/lib/table-games/game-seats';
import { Overlay } from './SocialFaces';
import { pointerAxis, usePingPong } from './usePingPong';

// The Ping-Pong Table's game (docs/specs/009-elements/social-pieces.md "A game", "Controls", "Reduced motion"), over
// the table's art on the art's own grid: the ball and both paddles, moved each frame through refs by the game's loop
// (usePingPong), and the scoreboard above the table, a pill in each player's colour. For you, while you play here, the
// table is your paddle's control: the pointer's or your finger's height over it moves your paddle. With a seat empty
// nothing is drawn and the art plays its resting rally (SocialArt).

const GRID = OFFICE_ART['ping-pong-table'].front;
const T = PING_PONG_TOP;
const gx = (x: number) => T.x + x * T.w;
const gy = (y: number) => T.y + y * T.h;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;
/** The paddle as drawn: its length on the grid (the model's), and its thickness. */
const PADDLE_LEN = PONG.paddleHalf * 2 * T.h;
const PADDLE_W = 3;
/** The ball as drawn: a touch larger than the model's, so it reads at the canvas's zoom. */
const BALL_R = 2.4;
const OFF = 'translate(-999 -999)';

const NEUTRAL =
  'rounded-full border border-slate-300 bg-white/95 px-2 py-[2px] text-slate-700 dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-100';

export function PingPongGame({ element }: { element: ShapeElement }) {
  const ball = useRef<SVGGElement>(null);
  const left = useRef<SVGGElement>(null);
  const right = useRef<SVGGElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const draw = useCallback((s: PongSession, now: number) => {
    const b = s.ball(now);
    ball.current?.setAttribute('transform', b ? `translate(${gx(b.x)} ${gy(b.y)})` : OFF);
    left.current?.setAttribute('transform', `translate(0 ${gy(s.paddle(0))})`);
    right.current?.setAttribute('transform', `translate(0 ${gy(s.paddle(1))})`);
  }, []);
  const { view, seats, reduced, session, mine } = usePingPong(element.id, draw);
  const [p0, p1] = seats;
  if (!p0 || !p1 || view.status === 'rest') return null;

  // Your paddle follows the pointer (mouse or pen hovering, a finger dragging) over the table.
  const follow = (e: ReactPointerEvent) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const top = box.top + (T.y / GRID.height) * box.height;
    session.setAxis(pointerAxis(e, { top, height: (T.h / GRID.height) * box.height }));
  };
  const moving = view.status !== 'reduced' && !reduced;
  return (
    <Overlay element={element}>
      {moving ? (
        <svg
          ref={svg}
          viewBox={`0 0 ${GRID.width} ${GRID.height}`}
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
          data-pong=""
        >
          <Paddle ref={left} seat={0} player={p0} y={gy(session.paddle(0))} />
          <Paddle ref={right} seat={1} player={p1} y={gy(session.paddle(1))} />
          <g ref={ball} transform={OFF} data-pong-ball="">
            <ellipse cx={0} cy={3.4} rx={2.2} ry={0.9} fill="#0f172a" opacity={0.2} />
            <circle r={BALL_R} fill="#ffffff" stroke="#f59e0b" strokeWidth={0.9} />
          </g>
        </svg>
      ) : null}
      {mine && moving ? (
        <div
          {...pieceControlProps}
          className="pointer-events-auto absolute inset-0 cursor-ns-resize touch-none"
          data-pong-control=""
          onPointerDown={(e) => {
            pieceControlProps.onPointerDown(e);
            e.currentTarget.setPointerCapture?.(e.pointerId);
            follow(e);
          }}
          onPointerMove={follow}
        />
      ) : null}
      <Scoreboard view={view} players={[p0, p1]} />
    </Overlay>
  );
}

function Paddle({
  ref,
  seat,
  player,
  y,
}: {
  ref: React.Ref<SVGGElement>;
  seat: Seat;
  player: GamePlayer;
  y: number;
}) {
  const x = gx(paddleLine(seat));
  return (
    <g ref={ref} transform={`translate(0 ${y})`} data-pong-paddle={seat}>
      <rect
        x={x - PADDLE_W / 2}
        y={-PADDLE_LEN / 2}
        width={PADDLE_W}
        height={PADDLE_LEN}
        rx={PADDLE_W / 2}
        fill={player.color}
        stroke="#ffffff"
        strokeWidth={0.8}
      />
    </g>
  );
}

/** What the scoreboard says, for a screen reader and the tests. */
export function scoreboardText(view: PongView, players: readonly [GamePlayer, GamePlayer]): string {
  switch (view.status) {
    case 'ready':
      return 'Ready';
    case 'reduced':
      return 'Motion Reduced';
    case 'won': {
      const p = players[view.winner ?? 0];
      return p.self ? 'You Win' : `${p.name} Wins`;
    }
    default: {
      const [l, r] = view.score ?? [0, 0];
      return `${players[0].name} ${l}, ${players[1].name} ${r}`;
    }
  }
}

// Above the table, in the middle, clear of both players' heads at its ends.
function Scoreboard({
  view,
  players,
}: {
  view: PongView;
  players: readonly [GamePlayer, GamePlayer];
}) {
  const text = scoreboardText(view, players);
  const place = 'absolute left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap';
  const style = { top: pct(T.y - 3, GRID.height) };
  if (view.status === 'play') {
    const [l, r] = view.score ?? [0, 0];
    return (
      <div
        className={`${place} flex gap-px shadow-sm`}
        style={style}
        role="status"
        data-pong-score={`${l}-${r}`}
      >
        <span className="sr-only">{text}</span>
        {[l, r].map((points, seat) => (
          <span
            key={seat}
            aria-hidden
            className={`${IDENTITY_FILL} min-w-[18px] px-1.5 py-[2px] text-center text-[10px] font-bold tabular-nums leading-none ${seat === 0 ? 'rounded-l-full' : 'rounded-r-full'}`}
            style={identityVars(players[seat]!.color)}
          >
            {points}
          </span>
        ))}
      </div>
    );
  }
  const winner = view.status === 'won' ? players[view.winner ?? 0] : null;
  return (
    <div
      className={`${place} text-[9px] font-semibold leading-none shadow-sm ${winner ? `${IDENTITY_FILL} rounded-full px-2 py-[3px]` : NEUTRAL}`}
      style={winner ? { ...style, ...identityVars(winner.color) } : style}
      role="status"
      data-pong-status={view.status}
      data-pong-score={view.score ? `${view.score[0]}-${view.score[1]}` : undefined}
    >
      {text}
    </div>
  );
}
