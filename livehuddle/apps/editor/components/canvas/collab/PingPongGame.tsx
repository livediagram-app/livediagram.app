'use client';

import { useCallback, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { pieceFacing, type ShapeElement } from '@livehuddle/document';
import { IDENTITY_FILL, identityVars } from '@livehuddle/ui';
import { pieceControlProps } from '@/lib/piece-control';
import { paddleLine, PONG, type Seat } from '@/lib/table-games/ping-pong';
import {
  framePointerAxis,
  paddleLength,
  pongFrame,
  type PongFrame,
} from '@/lib/table-games/pong-frame';
import type { PongSession, PongView } from '@/lib/table-games/pong-session';
import type { GamePlayer } from '@/lib/table-games/game-seats';
import { Overlay } from './SocialFaces';
import { usePingPong } from './usePingPong';

// The Ping-Pong Table's game (docs/specs/009-elements/social-pieces.md "A game", "Controls", "Reduced motion"), over
// the table's art on the art's own grid: the ball and both paddles, moved each frame through refs by the game's loop
// (usePingPong), and the scoreboard beside the table, a pill in each player's colour. For you, while you play here, the
// table is your paddle's control: the pointer's or your finger's position over it moves your paddle. With a seat empty
// nothing is drawn and the art plays its resting rally (SocialArt). A turned table plays on the drawing its facing
// shows (lib/table-games/pong-frame.ts, docs/specs/009-elements/furniture-facing.md "Live faces"): on its side the
// ends are at the top and the bottom and the paddles move across the canvas.

const pct = (v: number, of: number) => `${(v / of) * 100}%`;
/** The paddle's thickness, on the grid. */
const PADDLE_W = 3;
/** The ball as drawn: a touch larger than the model's, so it reads at the canvas's zoom. */
const BALL_R = 2.4;
const OFF = 'translate(-999 -999)';

const NEUTRAL =
  'rounded-full border border-slate-300 bg-white/95 px-2 py-[2px] text-slate-700 dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-100';

const at = (frame: PongFrame, along: number, side: number) => {
  const p = frame.at(along, side);
  return `translate(${p.x} ${p.y})`;
};

export function PingPongGame({ element }: { element: ShapeElement }) {
  const facing = pieceFacing(element);
  const frame = useMemo(() => pongFrame(facing), [facing]);
  const ball = useRef<SVGGElement>(null);
  const left = useRef<SVGGElement>(null);
  const right = useRef<SVGGElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const draw = useCallback(
    (s: PongSession, now: number) => {
      const b = s.ball(now);
      ball.current?.setAttribute('transform', b ? at(frame, b.x, b.y) : OFF);
      left.current?.setAttribute('transform', at(frame, paddleLine(0), s.paddle(0)));
      right.current?.setAttribute('transform', at(frame, paddleLine(1), s.paddle(1)));
    },
    [frame],
  );
  const { view, seats, reduced, session, mine } = usePingPong(element.id, draw, frame.across);
  const [p0, p1] = seats;
  if (!p0 || !p1 || view.status === 'rest') return null;

  // Your paddle follows the pointer (mouse or pen hovering, a finger dragging) over the table.
  const follow = (e: ReactPointerEvent) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    session.setAxis(framePointerAxis(frame, e, box));
  };
  const moving = view.status !== 'reduced' && !reduced;
  const { grid } = frame;
  return (
    <Overlay element={element}>
      {moving ? (
        <svg
          ref={svg}
          viewBox={`0 0 ${grid.width} ${grid.height}`}
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
          data-pong=""
          data-pong-across={frame.across}
        >
          <Paddle ref={left} seat={0} player={p0} frame={frame} axis={session.paddle(0)} />
          <Paddle ref={right} seat={1} player={p1} frame={frame} axis={session.paddle(1)} />
          <g ref={ball} transform={OFF} data-pong-ball="">
            <ellipse cx={0} cy={3.4} rx={2.2} ry={0.9} fill="#0f172a" opacity={0.2} />
            <circle r={BALL_R} fill="#ffffff" stroke="#f59e0b" strokeWidth={0.9} />
          </g>
        </svg>
      ) : null}
      {mine && moving ? (
        <div
          {...pieceControlProps}
          className={`pointer-events-auto absolute inset-0 touch-none ${frame.across === 'y' ? 'cursor-ns-resize' : 'cursor-ew-resize'}`}
          data-pong-control=""
          onPointerDown={(e) => {
            pieceControlProps.onPointerDown(e);
            e.currentTarget.setPointerCapture?.(e.pointerId);
            follow(e);
          }}
          onPointerMove={follow}
        />
      ) : null}
      <Scoreboard view={view} players={[p0, p1]} frame={frame} />
    </Overlay>
  );
}

function Paddle({
  ref,
  seat,
  player,
  frame,
  axis,
}: {
  ref: React.Ref<SVGGElement>;
  seat: Seat;
  player: GamePlayer;
  frame: PongFrame;
  axis: number;
}) {
  const length = paddleLength(frame, PONG.paddleHalf);
  const [w, h] = frame.across === 'y' ? [PADDLE_W, length] : [length, PADDLE_W];
  return (
    <g ref={ref} transform={at(frame, paddleLine(seat), axis)} data-pong-paddle={seat}>
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
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

// Above the table, in the middle, clear of both players' heads at its ends; on a table turned onto its side, whose
// ends are its top and bottom, beside it at the net. Each player's points sit nearest their own end.
function Scoreboard({
  view,
  players,
  frame,
}: {
  view: PongView;
  players: readonly [GamePlayer, GamePlayer];
  frame: PongFrame;
}) {
  const text = scoreboardText(view, players);
  const { grid, table } = frame;
  const onSide = frame.across === 'x';
  const place = onSide
    ? 'absolute -translate-y-1/2 whitespace-nowrap'
    : 'absolute left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap';
  const style = onSide
    ? {
        left: pct(table.x + table.w + 4, grid.width),
        top: pct(table.y + table.h / 2, grid.height),
      }
    : { top: pct(table.y - 3, grid.height) };
  if (view.status === 'play') {
    const [l, r] = view.score ?? [0, 0];
    // Screen order: the left seat's end is the left (the top on its side), or the right on a table seen from behind.
    const order: Seat[] = frame.at(0, 0).x > frame.at(1, 0).x ? [1, 0] : [0, 1];
    const points = [l, r];
    return (
      <div
        className={`${place} flex gap-px shadow-sm ${onSide ? 'flex-col' : ''}`}
        style={style}
        role="status"
        data-pong-score={`${l}-${r}`}
      >
        <span className="sr-only">{text}</span>
        {order.map((seat, i) => (
          <span
            key={seat}
            aria-hidden
            data-pong-points={seat}
            className={`${IDENTITY_FILL} min-w-[18px] px-1.5 py-[2px] text-center text-[10px] font-bold tabular-nums leading-none ${i === 0 ? (onSide ? 'rounded-t-full' : 'rounded-l-full') : onSide ? 'rounded-b-full' : 'rounded-r-full'}`}
            style={identityVars(players[seat].color)}
          >
            {points[seat]}
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
